interface Props {
  status: "pending" | "running" | "completed" | "failed";
}

const labels: Record<Props["status"], string> = {
  pending: "Pending",
  running: "Running",
  completed: "Done",
  failed: "Failed",
};

export default function RunStatusBadge({ status }: Props) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {labels[status]}
    </span>
  );
}
