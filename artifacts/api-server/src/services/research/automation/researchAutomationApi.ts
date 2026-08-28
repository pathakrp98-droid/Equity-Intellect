import type { SecurityType } from "@workspace/research-contracts";

export interface ResearchIdentityCorrectionInput {
  ticker: string;
  exchange: string;
  isin: string | null;
  name: string;
  securityType: Exclude<SecurityType, "unknown">;
}

export interface ResearchAutomationApiService {
  listCoverage(userId: string): Promise<unknown[]>;
  getCompany(userId: string, ticker: string): Promise<unknown | null>;
  listHistory(userId: string, ticker: string): Promise<unknown[] | null>;
  requestRefresh(
    userId: string,
    ticker: string,
  ): Promise<{ jobId: number; created: boolean } | null>;
  correctIdentity(
    userId: string,
    ticker: string,
    input: ResearchIdentityCorrectionInput,
  ): Promise<unknown | null>;
  getJob(userId: string, id: number): Promise<unknown | null>;
}

export class ResearchRefreshCooldownError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Research refresh is cooling down");
    this.name = "ResearchRefreshCooldownError";
  }
}
