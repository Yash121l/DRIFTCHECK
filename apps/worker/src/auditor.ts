import type { A11yResult, Env, PageCrawlResult } from "./types";
import { parseA11yResponse } from "./utils";

export async function auditAccessibility(
  crawlResult: PageCrawlResult,
  env: Env
): Promise<A11yResult> {
  const prompt = `You are a WCAG 2.1 accessibility auditor. Analyze this webpage screenshot.

Identify up to 8 accessibility issues. For each issue, output ONLY valid JSON in this exact format:
{
  "findings": [
    {
      "wcagCriterion": "1.4.3 Contrast (Minimum)",
      "description": "The button label '#cta' has a contrast ratio of 2.9:1 against its background, which fails WCAG AA (minimum 4.5:1 for normal text)",
      "severity": "critical",
      "elementSelector": "#cta",
      "suggestedFix": "Change text color from #888 to #595959 or darker to achieve 4.5:1 contrast"
    }
  ],
  "overallScore": 72
}

Focus on:
- 1.1.1 Non-text Content (missing alt text)
- 1.3.1 Info and Relationships (semantic HTML)
- 1.4.1 Use of Color (information not conveyed by color alone)
- 1.4.3 Contrast (Minimum)
- 2.1.1 Keyboard accessible
- 2.4.6 Headings and Labels
- 3.3.2 Labels or Instructions
- 4.1.2 Name, Role, Value

Screenshot is for page: ${crawlResult.url}`;

  try {
    const result = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
      prompt,
      // reason: Workers AI vision models accept image as number[] (byte array)
      image: Array.from(Buffer.from(crawlResult.screenshotBase64, "base64")),
      max_tokens: 1200,
    }) as { response: string };

    const responseText = result.response;
    return parseA11yResponse(crawlResult.url, responseText);
  } catch (err) {
    console.error(`a11y audit failed for ${crawlResult.url}:`, err);
    // Non-fatal: store a placeholder so the run continues
    return {
      url: crawlResult.url,
      findings: [{
        wcagCriterion: "Audit unavailable",
        description: "Accessibility audit could not be completed for this page.",
        severity: "info",
        suggestedFix: "Re-run the audit or inspect manually.",
      }],
      overallScore: 0,
    };
  }
}
