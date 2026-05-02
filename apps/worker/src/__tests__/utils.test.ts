import { describe, expect, it } from "vitest";
import {
  computeDriftSeverity,
  isCronDue,
  isUUID,
  parseA11yResponse,
  sanitizePath,
} from "../utils";

describe("isUUID", () => {
  it("accepts a valid v4 UUID", () => {
    expect(isUUID("1ffacd36-0dbe-4d9a-8a78-ab2c270d35ad")).toBe(true);
  });

  it("rejects a v1 UUID", () => {
    expect(isUUID("550e8400-e29b-11d4-a716-446655440000")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isUUID("")).toBe(false);
  });

  it("rejects SQL injection attempt", () => {
    expect(isUUID("' OR 1=1--")).toBe(false);
  });

  it("rejects UUID with wrong variant bit", () => {
    expect(isUUID("1ffacd36-0dbe-4d9a-1a78-ab2c270d35ad")).toBe(false);
  });
});

describe("sanitizePath", () => {
  it("replaces slashes with underscores", () => {
    expect(sanitizePath("/about/team")).toBe("about_team");
  });

  it("strips leading underscore from root path", () => {
    expect(sanitizePath("/")).toBe("root");
  });

  it("handles empty string", () => {
    expect(sanitizePath("")).toBe("root");
  });

  it("leaves path without slashes unchanged", () => {
    expect(sanitizePath("contact")).toBe("contact");
  });

  it("handles deeply nested path", () => {
    expect(sanitizePath("/docs/api/v2/endpoints")).toBe("docs_api_v2_endpoints");
  });
});

describe("computeDriftSeverity", () => {
  it("returns critical above 0.30", () => {
    expect(computeDriftSeverity(0.31)).toBe("critical");
    expect(computeDriftSeverity(1.0)).toBe("critical");
  });

  it("returns major between 0.15 and 0.30", () => {
    expect(computeDriftSeverity(0.16)).toBe("major");
    expect(computeDriftSeverity(0.30)).toBe("major");
  });

  it("returns minor at or below 0.15", () => {
    expect(computeDriftSeverity(0.09)).toBe("minor");
    expect(computeDriftSeverity(0.15)).toBe("minor");
  });

  it("returns minor just above threshold (0.08)", () => {
    expect(computeDriftSeverity(0.081)).toBe("minor");
  });
});

describe("parseA11yResponse", () => {
  const url = "https://example.com/";

  it("extracts valid JSON embedded in prose", () => {
    const response = `Here are the issues I found:\n{"findings":[{"wcagCriterion":"1.4.3 Contrast (Minimum)","description":"Low contrast","severity":"critical","suggestedFix":"Darken text"}],"overallScore":60}\nEnd of response.`;
    const result = parseA11yResponse(url, response);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].wcagCriterion).toBe("1.4.3 Contrast (Minimum)");
    expect(result.overallScore).toBe(60);
  });

  it("returns empty findings when response has no JSON", () => {
    const result = parseA11yResponse(url, "I cannot analyse this image.");
    expect(result.findings).toEqual([]);
    expect(result.overallScore).toBe(100);
  });

  it("returns empty findings when JSON is malformed", () => {
    const result = parseA11yResponse(url, `{findings: [broken json`);
    expect(result.findings).toEqual([]);
    expect(result.overallScore).toBe(100);
  });

  it("handles missing fields gracefully", () => {
    const result = parseA11yResponse(url, `{"overallScore": 80}`);
    expect(result.findings).toEqual([]);
    expect(result.overallScore).toBe(80);
  });

  it("attaches the url to the result", () => {
    const result = parseA11yResponse(url, `{"findings":[],"overallScore":100}`);
    expect(result.url).toBe(url);
  });
});

describe("isCronDue", () => {
  it("matches exact hour and minute", () => {
    expect(isCronDue("30 9 * * *", 9, 30, 1)).toBe(true);
  });

  it("does not match wrong hour", () => {
    expect(isCronDue("30 9 * * *", 10, 30, 1)).toBe(false);
  });

  it("matches wildcard hour", () => {
    expect(isCronDue("0 * * * *", 14, 0, 3)).toBe(true);
  });

  it("matches day-of-week range Mon–Fri (1–5)", () => {
    expect(isCronDue("0 9 * * 1-5", 9, 0, 3)).toBe(true);  // Wednesday
    expect(isCronDue("0 9 * * 1-5", 9, 0, 6)).toBe(false); // Saturday
  });

  it("matches comma-separated days", () => {
    expect(isCronDue("0 9 * * 1,3,5", 9, 0, 3)).toBe(true);  // Wednesday
    expect(isCronDue("0 9 * * 1,3,5", 9, 0, 2)).toBe(false); // Tuesday
  });

  it("returns false for malformed schedule", () => {
    expect(isCronDue("bad", 9, 0, 1)).toBe(false);
    expect(isCronDue("", 9, 0, 1)).toBe(false);
  });
});
