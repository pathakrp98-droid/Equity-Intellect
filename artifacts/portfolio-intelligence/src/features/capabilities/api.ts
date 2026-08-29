import { useQuery } from "@tanstack/react-query";

import type { AppCapabilities } from "./viewModel";

async function fetchAppCapabilities(): Promise<AppCapabilities> {
  const response = await fetch("/api/capabilities", {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Application capabilities are unavailable");
  }
  return (await response.json()) as AppCapabilities;
}

export function useAppCapabilities() {
  return useQuery({
    queryKey: ["app-capabilities"],
    queryFn: fetchAppCapabilities,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
