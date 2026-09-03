import { and, eq, lt } from "drizzle-orm";

import type { AuditProgress } from "@/lib/audit-events";
import { getServerEnv } from "@/lib/env";
import { getDb } from "@/server/db";
import {
  businesses,
  leadEvents,
  leadScores,
  leads,
  websiteAudits,
} from "@/server/db/schema";
import { getAIService } from "@/server/services/ai/service";
import {
  calculateOpportunityScore,
  type AuditEvidence,
} from "@/server/services/scoring";
import type {
  BrowserAuditDiagnosticStage,
  BrowserEvidence,
} from "./browser-audit";
import { reportAuditDiagnostic } from "./diagnostics";
import { validateSafeUrl } from "./url-safety";

export type { AuditProgress } from "@/lib/audit-events";

export async function runLeadAudit(
  leadId: string,
  context: { organizationId: string; userId: string },
  emit: (event: AuditProgress) => Promise<void>,
) {
  const env = getServerEnv();
  const db = getDb();
  const staleBefore = new Date(Date.now() - env.AUDIT_TIMEOUT_MS - 15_000);
  await db
    .update(websiteAudits)
    .set({
      status: "failed",
      currentStage: "timed_out",
      errorCode: "STALE_REQUEST",
      errorMessage: "The previous request ended before the audit completed.",
      completedAt: new Date(),
    })
    .where(
      and(
        eq(websiteAudits.organizationId, context.organizationId),
        eq(websiteAudits.leadId, leadId),
        eq(websiteAudits.status, "running"),
        lt(websiteAudits.startedAt, staleBefore),
      ),
    );

  const [record] = await db
    .select({
      id: leads.id,
      qualificationOverridden: leads.qualificationOverridden,
      websiteStatus: leads.websiteStatus,
      business: {
        name: businesses.name,
        websiteUrl: businesses.websiteUrl,
        rating: businesses.rating,
        reviewCount: businesses.userRatingCount,
        phone: businesses.phone,
        address: businesses.formattedAddress,
        category: businesses.primaryCategory,
      },
    })
    .from(leads)
    .innerJoin(businesses, eq(businesses.id, leads.businessId))
    .where(
      and(
        eq(leads.organizationId, context.organizationId),
        eq(leads.id, leadId),
      ),
    )
    .limit(1);
  if (!record) throw new Error("Lead not found");

  const [active] = await db
    .select({ id: websiteAudits.id })
    .from(websiteAudits)
    .where(
      and(
        eq(websiteAudits.organizationId, context.organizationId),
        eq(websiteAudits.leadId, leadId),
        eq(websiteAudits.status, "running"),
      ),
    )
    .limit(1);
  if (active) throw new Error("This lead is already being analyzed");

  const started = Date.now();
  let normalizedUrl: string | null = null;
  const [audit] = await db
    .insert(websiteAudits)
    .values({
      organizationId: context.organizationId,
      leadId,
      websiteUrl: record.business.websiteUrl,
      normalizedUrl,
      status: "running",
      progress: 0,
      currentStage: "starting",
    })
    .returning({ id: websiteAudits.id });

  let currentProgress = 0;
  const progress = async (value: number, stage: string, message: string) => {
    currentProgress = value;
    await db
      .update(websiteAudits)
      .set({ progress: value, currentStage: stage })
      .where(eq(websiteAudits.id, audit.id));
    await emit({
      type: "progress",
      progress: value,
      stage,
      message,
      auditId: audit.id,
      leadId,
    });
  };
  const diagnostic = async (
    stage: BrowserAuditDiagnosticStage | "ai_assessment" | "audit_fatal",
    error: unknown,
    value = currentProgress,
  ) =>
    reportAuditDiagnostic({
      enabled: env.AUDIT_DEBUG,
      emit,
      error,
      stage,
      progress: value,
      leadId,
      auditId: audit.id,
    });

  try {
    await progress(5, "validating", "Validating website and network safety");
    let status: AuditEvidence["websiteStatus"] = record.business.websiteUrl
      ? "reachable"
      : "missing";
    let browser: BrowserEvidence | null = null;

    if (record.business.websiteUrl) {
      let safeUrl: URL | undefined;
      try {
        safeUrl = await validateSafeUrl(record.business.websiteUrl);
        normalizedUrl = safeUrl.toString();
        await db
          .update(websiteAudits)
          .set({ normalizedUrl })
          .where(eq(websiteAudits.id, audit.id));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unsafe website URL";
        if (/private|reserved|credentials|only http/i.test(message)) {
          await db
            .update(leads)
            .set({ websiteStatus: "unsafe", updatedAt: new Date() })
            .where(
              and(
                eq(leads.organizationId, context.organizationId),
                eq(leads.id, leadId),
              ),
            );
          throw new Error(message, { cause: error });
        }
        await diagnostic("page_load", error, 5);
        status = "unreachable";
        await progress(
          74,
          "unreachable",
          "Website did not resolve; using business signals",
        );
      }

      if (safeUrl) {
        let browserFailureReported = false;
        try {
          const { runBrowserAudit } = await import("./browser-audit");
          browser = await runBrowserAudit(
            safeUrl,
            progress,
            async (stage, error) => {
              browserFailureReported = true;
              const diagnosticProgress =
                stage === "chromium_setup"
                  ? 10
                  : stage === "page_load"
                    ? 22
                    : 62;
              await diagnostic(stage, error, diagnosticProgress);
            },
          );
        } catch (error) {
          if (!browserFailureReported)
            await diagnostic("chromium_setup", error, 10);
          status = "unreachable";
          await progress(
            74,
            "unreachable",
            "Website could not be loaded; using business signals",
          );
        }
      }
    } else {
      await progress(
        74,
        "no_website",
        "No website found; evaluating business viability",
      );
    }

    const evidence: AuditEvidence = {
      websiteStatus: status,
      https: normalizedUrl?.startsWith("https://") ?? false,
      performanceScore: browser?.performanceScore ?? null,
      hasViewport: browser?.hasViewport ?? false,
      hasPrimaryCta: browser?.hasPrimaryCta ?? false,
      hasContactPath: browser?.hasContactPath ?? false,
      hasLeadForm: browser?.hasLeadForm ?? false,
      rating: record.business.rating,
      reviewCount: record.business.reviewCount,
      hasPhone: Boolean(record.business.phone),
      hasAddress: Boolean(record.business.address),
      categoryFit: true,
    };

    await progress(
      80,
      "ai_assessment",
      "Assessing the opportunity with Gemini",
    );
    let assessment: Awaited<
      ReturnType<ReturnType<typeof getAIService>["assessOpportunity"]>
    > | null = null;
    try {
      assessment = await Promise.race([
        getAIService().assessOpportunity({
          business: record.business,
          website: browser,
          deterministicEvidence: evidence,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("AI assessment timed out")),
            env.AUDIT_AI_TIMEOUT_MS,
          ),
        ),
      ]);
    } catch (error) {
      await diagnostic("ai_assessment", error, 80);
      /* The deterministic score remains useful and is explicitly provisional. */
    }

    await progress(92, "scoring", "Calculating the opportunity score");
    const score = calculateOpportunityScore(evidence, assessment?.score);
    await db.insert(leadScores).values({
      organizationId: context.organizationId,
      leadId,
      auditId: audit.id,
      ruleScore: score.ruleScore,
      aiScore: score.aiScore,
      finalScore: score.finalScore,
      isProvisional: score.isProvisional,
      suggestedQualification: score.qualification,
      evidence: { ...evidence, reasons: score.reasons },
      summary: assessment?.summary ?? score.reasons.join(". "),
      scoringVersion: "v1",
    });

    await db
      .update(leads)
      .set({
        websiteStatus: status,
        opportunityScore: score.finalScore,
        scoreStatus: score.isProvisional ? "provisional" : "complete",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(leads.organizationId, context.organizationId),
          eq(leads.id, leadId),
        ),
      );
    if (!record.qualificationOverridden)
      await db
        .update(leads)
        .set({ qualification: score.qualification })
        .where(
          and(
            eq(leads.organizationId, context.organizationId),
            eq(leads.id, leadId),
          ),
        );

    await db
      .update(websiteAudits)
      .set({
        status: "completed",
        progress: 100,
        currentStage: "complete",
        performanceScore: browser?.performanceScore,
        seoScore: browser?.seoScore,
        accessibilityScore: browser?.accessibilityScore,
        mobileScore: browser ? (browser.hasViewport ? 85 : 30) : null,
        designScore: assessment ? Math.max(0, 100 - assessment.score) : null,
        businessFunctionalityScore: browser
          ? [
              browser.hasPrimaryCta,
              browser.hasContactPath,
              browser.hasLeadForm,
            ].filter(Boolean).length * 33
          : null,
        overallWebsiteScore: browser
          ? Math.round(
              [
                browser.performanceScore ?? 50,
                browser.seoScore ?? 50,
                browser.accessibilityScore ?? 50,
              ].reduce((sum, item) => sum + item, 0) / 3,
            )
          : null,
        technicalFindings: browser ?? {},
        businessFindings: evidence,
        strengths: assessment?.strengths ?? [],
        opportunities: assessment?.opportunities ?? score.reasons,
        aiSummary: assessment?.summary,
        durationMs: Date.now() - started,
        completedAt: new Date(),
      })
      .where(eq(websiteAudits.id, audit.id));
    await db.insert(leadEvents).values({
      organizationId: context.organizationId,
      leadId,
      actorUserId: context.userId,
      type: "audit.completed",
      metadata: {
        auditId: audit.id,
        score: score.finalScore,
        provisional: score.isProvisional,
      },
    });
    await emit({
      type: "complete",
      progress: 100,
      stage: "complete",
      message: score.isProvisional
        ? "Analysis complete with a provisional score"
        : "Analysis complete",
      auditId: audit.id,
      leadId,
    });
    return { auditId: audit.id, score };
  } catch (error) {
    await diagnostic("audit_fatal", error).catch(() => undefined);
    const message =
      error instanceof Error ? error.message : "Website analysis failed";
    await db
      .update(websiteAudits)
      .set({
        status: "failed",
        currentStage: "failed",
        errorCode: "AUDIT_FAILED",
        errorMessage: message,
        durationMs: Date.now() - started,
        completedAt: new Date(),
      })
      .where(eq(websiteAudits.id, audit.id));
    await db.insert(leadEvents).values({
      organizationId: context.organizationId,
      leadId,
      actorUserId: context.userId,
      type: "audit.failed",
      metadata: { auditId: audit.id, message },
    });
    throw error;
  }
}
