import { describe, expect, it } from "vitest";
import {
  calculateOpportunityScore,
  qualificationForScore,
} from "@/server/services/scoring";

const base = {
  websiteStatus: "reachable" as const,
  https: true,
  performanceScore: 90,
  hasViewport: true,
  hasPrimaryCta: true,
  hasContactPath: true,
  hasLeadForm: true,
  rating: 4.5,
  reviewCount: 120,
  hasPhone: true,
  hasAddress: true,
  categoryFit: true,
};

describe("opportunity scoring", () => {
  it("makes a missing website a strong but evidence-bounded opportunity", () => {
    const result = calculateOpportunityScore(
      {
        ...base,
        websiteStatus: "missing",
        performanceScore: null,
        hasViewport: false,
        hasPrimaryCta: false,
        hasContactPath: false,
        hasLeadForm: false,
      },
      80,
    );
    expect(result.ruleScore).toBeGreaterThanOrEqual(65);
    expect(result.finalScore).toBeGreaterThanOrEqual(65);
    expect(result.isProvisional).toBe(false);
    expect(result.reasons).toContain(
      "No website is linked to the business profile",
    );
  });

  it("preserves a labelled deterministic score when AI is absent", () => {
    const result = calculateOpportunityScore({
      ...base,
      performanceScore: 35,
      hasPrimaryCta: false,
      hasLeadForm: false,
    });
    expect(result.aiScore).toBeNull();
    expect(result.finalScore).toBe(result.ruleScore);
    expect(result.isProvisional).toBe(true);
  });

  it("maps score boundaries predictably", () => {
    expect(qualificationForScore(29)).toBe("unqualified");
    expect(qualificationForScore(30)).toBe("low");
    expect(qualificationForScore(50)).toBe("medium");
    expect(qualificationForScore(70)).toBe("high");
    expect(qualificationForScore(85)).toBe("hot");
  });
});
