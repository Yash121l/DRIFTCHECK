import type { A11yFinding } from "./types";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUUID(v: string): boolean {
  return UUID_RE.test(v);
}

export function sanitizePath(path: string): string {
  return path.replace(/\//g, "_").replace(/^_/, "") || "root";
}

export function computeDriftSeverity(diffScore: number): "critical" | "major" | "minor" {
  if (diffScore > 0.3) return "critical";
  if (diffScore > 0.15) return "major";
  return "minor";
}

export function parseA11yResponse(
  url: string,
  responseText: string
): { url: string; findings: A11yFinding[]; overallScore: number } {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { url, findings: [], overallScore: 100 };
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      findings: A11yFinding[];
      overallScore: number;
    };
    return { url, findings: parsed.findings ?? [], overallScore: parsed.overallScore ?? 100 };
  } catch {
    return { url, findings: [], overallScore: 100 };
  }
}

export function isCronDue(schedule: string, hour: number, minute: number, dow: number): boolean {
  const parts = schedule.split(" ");
  if (parts.length < 5) return false;
  const [min, hr, , , day] = parts;
  const matchMin = min === "*" || Number(min) === minute;
  const matchHr = hr === "*" || Number(hr) === hour;
  const matchDow =
    day === "*" ||
    day.split(",").includes(String(dow)) ||
    (day.includes("-") &&
      (() => {
        const [start, end] = day.split("-").map(Number);
        return dow >= start && dow <= end;
      })());
  return matchMin && matchHr && matchDow;
}
