import Chromium from "@sparticuz/chromium-min";
import { launch, type LaunchedChrome } from "chrome-launcher";
import { chromium, type Browser } from "playwright-core";

import { getServerEnv } from "@/lib/env";
import { validateSafeUrl } from "./url-safety";

export type BrowserEvidence = {
  finalUrl: string;
  title: string;
  description: string;
  lang: string;
  hasViewport: boolean;
  h1Count: number;
  imageCount: number;
  imagesWithoutAlt: number;
  hasPrimaryCta: boolean;
  hasContactPath: boolean;
  hasLeadForm: boolean;
  textLength: number;
  performanceScore: number | null;
  seoScore: number | null;
  accessibilityScore: number | null;
};

export type BrowserAuditDiagnosticStage =
  "chromium_setup" | "page_load" | "lighthouse";

async function executablePath() {
  const env = getServerEnv();
  if (env.CHROME_EXECUTABLE_PATH) return env.CHROME_EXECUTABLE_PATH;
  if (env.CHROMIUM_PACK_URL)
    return Chromium.executablePath(env.CHROMIUM_PACK_URL);
  return undefined;
}

export async function runBrowserAudit(
  url: URL,
  onProgress?: (
    progress: number,
    stage: string,
    message: string,
  ) => Promise<void>,
  onDiagnostic?: (
    stage: BrowserAuditDiagnosticStage,
    error: unknown,
  ) => Promise<void>,
): Promise<BrowserEvidence> {
  const env = getServerEnv();
  let chrome: LaunchedChrome | undefined;
  let browser: Browser | undefined;
  try {
    try {
      chrome = await launch({
        chromePath: await executablePath(),
        chromeFlags: [
          ...Chromium.args,
          "--headless=new",
          "--disable-dev-shm-usage",
        ],
        logLevel: "silent",
      });
      browser = await chromium.connectOverCDP(
        `http://127.0.0.1:${chrome.port}`,
      );
    } catch (error) {
      await onDiagnostic?.("chromium_setup", error);
      throw error;
    }

    const { finalUrl, dom } = await (async () => {
      try {
        const context = browser.contexts()[0] ?? (await browser.newContext());
        const page = await context.newPage();
        await page.route("**/*", async (route) => {
          if (route.request().resourceType() === "document") {
            try {
              await validateSafeUrl(route.request().url());
            } catch {
              await route.abort("blockedbyclient");
              return;
            }
          }
          await route.continue();
        });
        await onProgress?.(22, "loading", "Loading the website");
        await page.goto(url.toString(), {
          waitUntil: "domcontentloaded",
          timeout: env.AUDIT_PAGE_TIMEOUT_MS,
        });
        await page.waitForTimeout(1_000);
        const finalUrl = await validateSafeUrl(page.url());
        await onProgress?.(
          42,
          "inspecting",
          "Inspecting structure and conversion paths",
        );
        const dom = await page.evaluate(() => {
          const text = document.body?.innerText ?? "";
          const actionPattern =
            /(book|contact|call|quote|appointment|get started|request|reserve|order|buy)/i;
          const interactiveText = [...document.querySelectorAll("a, button")]
            .map((node) => node.textContent?.trim() ?? "")
            .join(" ");
          return {
            title: document.title,
            description:
              document
                .querySelector('meta[name="description"]')
                ?.getAttribute("content") ?? "",
            lang: document.documentElement.lang,
            hasViewport: Boolean(
              document.querySelector('meta[name="viewport"]'),
            ),
            h1Count: document.querySelectorAll("h1").length,
            imageCount: document.images.length,
            imagesWithoutAlt: [...document.images].filter(
              (image) => !image.alt.trim(),
            ).length,
            hasPrimaryCta: actionPattern.test(interactiveText),
            hasContactPath: Boolean(
              document.querySelector(
                'a[href^="tel:"], a[href^="mailto:"], a[href*="contact" i]',
              ),
            ),
            hasLeadForm: Boolean(
              document.querySelector(
                'form input[type="email"], form input[type="tel"], form textarea',
              ),
            ),
            textLength: text.length,
          };
        });
        return { finalUrl, dom };
      } catch (error) {
        await onDiagnostic?.("page_load", error);
        throw error;
      }
    })();

    let performanceScore: number | null = null;
    let seoScore: number | null = null;
    let accessibilityScore: number | null = null;
    try {
      await onProgress?.(
        62,
        "lighthouse",
        "Measuring performance, SEO, and accessibility",
      );
      const { default: lighthouse } = await import("lighthouse");
      const result = await Promise.race([
        lighthouse(finalUrl.toString(), {
          port: chrome.port,
          output: "json",
          logLevel: "silent",
          onlyCategories: ["performance", "seo", "accessibility"],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Lighthouse timed out")),
            env.AUDIT_LIGHTHOUSE_TIMEOUT_MS,
          ),
        ),
      ]);
      performanceScore =
        result?.lhr.categories.performance?.score == null
          ? null
          : Math.round(result.lhr.categories.performance.score * 100);
      seoScore =
        result?.lhr.categories.seo?.score == null
          ? null
          : Math.round(result.lhr.categories.seo.score * 100);
      accessibilityScore =
        result?.lhr.categories.accessibility?.score == null
          ? null
          : Math.round(result.lhr.categories.accessibility.score * 100);
    } catch (error) {
      await onDiagnostic?.("lighthouse", error);
      /* Deterministic DOM evidence remains valid when Lighthouse is unavailable. */
    }

    await onProgress?.(
      74,
      "evidence_ready",
      "Deterministic evidence collected",
    );

    return {
      finalUrl: finalUrl.toString(),
      ...dom,
      performanceScore,
      seoScore,
      accessibilityScore,
    };
  } finally {
    await browser?.close().catch(() => undefined);
    chrome?.kill();
  }
}
