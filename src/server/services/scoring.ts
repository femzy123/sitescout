export type AuditEvidence = {
  websiteStatus: "missing" | "reachable" | "unreachable";
  https: boolean;
  performanceScore: number | null;
  hasViewport: boolean;
  hasPrimaryCta: boolean;
  hasContactPath: boolean;
  hasLeadForm: boolean;
  rating: number | null;
  reviewCount: number | null;
  hasPhone: boolean;
  hasAddress: boolean;
  categoryFit: boolean;
};

export type ScoreResult = {
  ruleScore: number;
  aiScore: number | null;
  finalScore: number;
  isProvisional: boolean;
  qualification: "unqualified" | "low" | "medium" | "high" | "hot";
  reasons: string[];
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function qualificationForScore(
  score: number,
): ScoreResult["qualification"] {
  if (score >= 85) return "hot";
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  if (score >= 30) return "low";
  return "unqualified";
}

export function calculateOpportunityScore(
  evidence: AuditEvidence,
  aiScore?: number | null,
): ScoreResult {
  const reasons: string[] = [];
  let websiteOpportunity = 0;
  if (evidence.websiteStatus === "missing") {
    websiteOpportunity = 45;
    reasons.push("No website is linked to the business profile");
  } else if (evidence.websiteStatus === "unreachable") {
    websiteOpportunity = 38;
    reasons.push("The linked website could not be reached");
  } else {
    if (!evidence.https) {
      websiteOpportunity += 10;
      reasons.push("Website is not protected by HTTPS");
    }
    const performanceGap =
      evidence.performanceScore === null
        ? 8
        : Math.round((100 - evidence.performanceScore) * 0.18);
    if (performanceGap >= 5)
      reasons.push("Page performance leaves meaningful room for improvement");
    websiteOpportunity += Math.min(18, performanceGap);
    if (!evidence.hasViewport) {
      websiteOpportunity += 10;
      reasons.push("Mobile viewport support is missing");
    }
    if (!evidence.hasPrimaryCta) {
      websiteOpportunity += 8;
      reasons.push("No clear primary call to action was detected");
    }
    if (!evidence.hasContactPath) {
      websiteOpportunity += 8;
      reasons.push("Visitors do not have a clear contact path");
    }
    if (!evidence.hasLeadForm) {
      websiteOpportunity += 6;
      reasons.push("No lead-capture form was detected");
    }
    websiteOpportunity = Math.min(70, websiteOpportunity);
  }

  let viability = 0;
  if (evidence.rating !== null)
    viability += Math.min(10, Math.max(0, (evidence.rating - 3) * 5));
  if ((evidence.reviewCount ?? 0) > 0)
    viability += Math.min(10, Math.log10((evidence.reviewCount ?? 0) + 1) * 4);
  if (evidence.hasPhone || evidence.hasAddress) viability += 5;
  if (evidence.categoryFit) viability += 5;
  if (viability >= 18)
    reasons.push("Business activity signals suggest a viable prospect");

  const ruleScore = clamp(websiteOpportunity + Math.min(30, viability));
  const normalizedAi = typeof aiScore === "number" ? clamp(aiScore) : null;
  const finalScore =
    normalizedAi === null
      ? ruleScore
      : clamp(ruleScore * 0.65 + normalizedAi * 0.35);
  return {
    ruleScore,
    aiScore: normalizedAi,
    finalScore,
    isProvisional: normalizedAi === null,
    qualification: qualificationForScore(finalScore),
    reasons: reasons.slice(0, 6),
  };
}
