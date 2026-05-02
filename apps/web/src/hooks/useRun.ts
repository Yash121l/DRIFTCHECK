import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useRun(runId: string) {
  const query = useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.runs.get(runId),
    enabled: !!runId,
    // Poll while the run is still active
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "running" ? 3000 : false;
    },
  });

  return query;
}

export function useRunFindings(
  runId: string,
  opts: { type?: string; severity?: string; page?: number } = {}
) {
  return useQuery({
    queryKey: ["run-findings", runId, opts],
    queryFn: () => api.runs.findings(runId, opts),
    enabled: !!runId,
    staleTime: 10_000,
  });
}
