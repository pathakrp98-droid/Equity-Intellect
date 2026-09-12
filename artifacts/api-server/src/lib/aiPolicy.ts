type Environment = Record<string, string | undefined>;

export function aiRequestsEnabled(
  environment: Environment = process.env,
): boolean {
  return environment.AI_REQUESTS_ENABLED === "true";
}

export function openAiAvailable(
  environment: Environment = process.env,
): boolean {
  return (
    aiRequestsEnabled(environment) &&
    Boolean(environment.OPENAI_API_KEY?.trim())
  );
}

export function assertOpenAiAvailable(
  environment: Environment = process.env,
): void {
  if (!aiRequestsEnabled(environment)) {
    throw new Error("Paid AI requests are disabled.");
  }
  if (!environment.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
}
