import type { Finding } from "../lib/api";

interface Props {
  findings: Finding[];
}

const severityIcon: Record<string, string> = {
  critical: "🔴",
  major: "🟠",
  minor: "🟡",
  info: "⚪",
};

const severityOrder: Record<string, number> = { critical: 0, major: 1, minor: 2, info: 3 };

export default function A11yReport({ findings }: Props) {
  const a11yFindings = findings
    .filter((f) => f.finding_type === "accessibility")
    .sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

  if (a11yFindings.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900 p-8 text-center text-gray-500 text-sm">
        No accessibility findings for this run.
      </div>
    );
  }

  // Group by WCAG criterion
  const grouped = a11yFindings.reduce<Record<string, Finding[]>>((acc, f) => {
    const key = f.wcag_criterion ?? "Uncategorized";
    (acc[key] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([criterion, items]) => (
        <div key={criterion} className="rounded-lg border border-gray-700 bg-gray-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700 bg-gray-800/50">
            <span className="text-sm font-mono text-blue-400">{criterion}</span>
            <span className="ml-auto text-xs text-gray-500">{items.length} issue{items.length !== 1 ? "s" : ""}</span>
          </div>
          <ul className="divide-y divide-gray-800">
            {items.map((f) => (
              <li key={f.id} className="px-4 py-3 flex gap-3">
                <span className="text-base mt-0.5 flex-shrink-0">{severityIcon[f.severity] ?? "⚪"}</span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 leading-relaxed">{f.description}</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${severityClasses(f.severity)}`}>
                    {f.severity}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function severityClasses(severity: string): string {
  switch (severity) {
    case "critical": return "bg-red-900/60 text-red-300";
    case "major": return "bg-orange-900/60 text-orange-300";
    case "minor": return "bg-yellow-900/60 text-yellow-300";
    default: return "bg-gray-700 text-gray-400";
  }
}
