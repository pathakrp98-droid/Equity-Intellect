export interface AppCapabilities {
  ai: {
    enabled: boolean;
    available: boolean;
    reason: "disabled" | "missing_key" | "available";
  };
}

export function aiAvailabilityCopy(
  capabilities: AppCapabilities | null | undefined,
) {
  const available = capabilities?.ai.available === true;
  return {
    available,
    refreshDisabled: !available,
    message: available
      ? "AI generation is available."
      : "AI generation is disabled on this deployment.",
  };
}
