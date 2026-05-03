import type { Finding } from "../lib/api";

interface Props { findings: Finding[] }

const order: Record<string, number> = { critical: 0, major: 1, minor: 2, info: 3 };
const chip: Record<string, string> = {
  critical: "sev-chip sev-chip-critical",
  major:    "sev-chip sev-chip-major",
  minor:    "sev-chip sev-chip-minor",
  info:     "sev-chip sev-chip-info",
};

export default function A11yReport({ findings }: Props) {
  const sorted = [...findings]
    .filter(f => f.finding_type === "accessibility")
    .sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4));

  if (sorted.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
            <path d="M8 2a6 6 0 100 12A6 6 0 008 2zM8 5v4M8 10.5v.5"/>
          </svg>
        </div>
        <p className="empty-state-title">No accessibility findings</p>
        <p className="empty-state-sub">This run found no WCAG issues</p>
      </div>
    );
  }

  const grouped = sorted.reduce<Record<string, Finding[]>>((acc, f) => {
    const key = f.wcag_criterion ?? "Uncategorized";
    (acc[key] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Object.entries(grouped).map(([criterion, items]) => (
        <div key={criterion} className="wcag-group anim-fade-up">
          <div className="wcag-header">
            <span className="wcag-criterion">{criterion}</span>
            <span className="wcag-count">{items.length} issue{items.length !== 1 ? "s" : ""}</span>
          </div>
          {items.map(f => (
            <div key={f.id} className="wcag-item">
              <span className={chip[f.severity] ?? chip.info} style={{ marginTop: 2, flexShrink: 0 }}>
                {f.severity}
              </span>
              <p className="wcag-item-text">{f.description}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
