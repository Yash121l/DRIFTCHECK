interface Props {
  status: "pending" | "running" | "completed" | "failed";
  className?: string;
}

const config: Record<Props["status"], { label: string; classes: string }> = {
  pending: { label: "Pending", classes: "bg-gray-700 text-gray-300" },
  running: { label: "Running", classes: "bg-blue-900 text-blue-300 animate-pulse" },
  completed: { label: "Completed", classes: "bg-green-900 text-green-300" },
  failed: { label: "Failed", classes: "bg-red-900 text-red-300" },
};

export default function RunStatusBadge({ status, className = "" }: Props) {
  const { label, classes } = config[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes} ${className}`}>
      {label}
    </span>
  );
}
