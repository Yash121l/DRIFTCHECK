import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api.projects.list(),
    staleTime: 30_000,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => api.projects.get(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}
