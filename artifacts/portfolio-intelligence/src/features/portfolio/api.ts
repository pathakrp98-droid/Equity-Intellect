import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export type TransactionType =
  | "buy"
  | "sell"
  | "dividend"
  | "bonus"
  | "split"
  | "rights"
  | "deposit"
  | "withdrawal"
  | "interest"
  | "fees";

export interface PortfolioRecord {
  id: number;
  name: string;
  baseCurrency: string;
  benchmark: string;
  updatedAt: string;
}

export interface PortfolioSnapshot {
  id: number;
  asOf: string;
  totalValue: number;
  marketValue: number;
  cashBalance: number;
  costBasis: number;
  realizedPnl: number;
  unrealizedPnl: number;
  dividendIncome: number;
  interestIncome: number;
  feesPaid: number;
  netContributions: number;
  totalPnl: number;
  totalReturnPct: number;
  xirrPct: number | null;
  largestPositionTicker: string | null;
  largestPositionPct: number;
  topFiveConcentrationPct: number;
  concentrationRisk: "low" | "medium" | "high";
  holdingsCount: number;
  sectorAllocation: Array<{
    sector: string;
    value: number;
    allocationPct: number;
    herfindahlIndex?: number;
  }>;
  riskFlags: string[];
}

export interface PortfolioHolding {
  id: number;
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  quantity: number;
  averageCost: number;
  marketPrice: number;
  previousClose: number | null;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  allocationPct: number;
  dayChange: number;
  dayChangePct: number;
  firstTradeDate: string | null;
  updatedAt: string;
  priceSource: string;
  brokers: string[];
}

export interface PortfolioOverview {
  portfolio: PortfolioRecord;
  snapshot: PortfolioSnapshot | null;
  holdings: PortfolioHolding[];
  transactionCount: number;
  priceCoverage: {
    quoted: number;
    fallback: number;
  };
}

export interface PortfolioTransaction {
  id: number;
  portfolioId: number;
  brokerAccountId: number | null;
  broker: string | null;
  accountName: string | null;
  externalId: string | null;
  ticker: string | null;
  name: string | null;
  exchange: string | null;
  sector: string | null;
  type: TransactionType;
  quantity: number | null;
  price: number | null;
  amount: number | null;
  fees: number;
  taxes: number;
  currency: string;
  tradeDate: string;
  settlementDate: string | null;
  splitNumerator: number | null;
  splitDenominator: number | null;
  notes: string | null;
}

export interface CreateTransactionPayload {
  portfolioId?: number;
  broker?: string;
  accountName?: string;
  ticker?: string;
  name?: string;
  exchange?: string;
  sector?: string;
  type: TransactionType;
  quantity?: number;
  price?: number;
  amount?: number;
  fees?: number;
  taxes?: number;
  tradeDate: string;
  splitNumerator?: number;
  splitDenominator?: number;
  notes?: string;
}

export interface ImportCsvPayload {
  portfolioId?: number;
  broker: "manual" | "zerodha" | "groww";
  accountName?: string;
  csv: string;
}

export interface CsvImportResponse {
  imported: number;
  duplicates: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export interface PriceInput {
  ticker: string;
  price: number;
  previousClose?: number;
}

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Preserve the HTTP status message when the response is not JSON.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const portfolioKey = ["portfolio-engine"] as const;
const transactionsKey = ["portfolio-engine", "transactions"] as const;

function useRefreshPortfolio() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: portfolioKey }),
      queryClient.invalidateQueries({ queryKey: transactionsKey }),
      queryClient.invalidateQueries({ queryKey: ["getHoldings"] }),
      queryClient.invalidateQueries({ queryKey: ["getPerformance"] }),
      queryClient.invalidateQueries({ queryKey: ["getRiskDashboard"] }),
    ]);
  };
}

export function usePortfolioOverview() {
  return useQuery({
    queryKey: portfolioKey,
    queryFn: () => apiRequest<PortfolioOverview>("/api/portfolio"),
    retry: (attempt, error) =>
      !(error instanceof ApiError && error.status === 401) && attempt < 2,
  });
}

export function usePortfolioTransactions() {
  return useQuery({
    queryKey: transactionsKey,
    queryFn: () =>
      apiRequest<PortfolioTransaction[]>("/api/portfolio/transactions"),
    retry: (attempt, error) =>
      !(error instanceof ApiError && error.status === 401) && attempt < 2,
  });
}

export function useCreatePortfolioTransaction() {
  const refresh = useRefreshPortfolio();
  return useMutation({
    mutationFn: (payload: CreateTransactionPayload) =>
      apiRequest("/api/portfolio/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await refresh();
    },
  });
}

export function useDeletePortfolioTransaction() {
  const refresh = useRefreshPortfolio();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/portfolio/transactions/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await refresh();
    },
  });
}

export function useImportPortfolioCsv() {
  const refresh = useRefreshPortfolio();
  return useMutation({
    mutationFn: (payload: ImportCsvPayload) =>
      apiRequest<CsvImportResponse>("/api/portfolio/import", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await refresh();
    },
  });
}

export function useUpdatePortfolioPrices() {
  const refresh = useRefreshPortfolio();
  return useMutation({
    mutationFn: (prices: PriceInput[]) =>
      apiRequest("/api/portfolio/prices", {
        method: "PUT",
        body: JSON.stringify({ prices }),
      }),
    onSuccess: async () => {
      await refresh();
    },
  });
}

export function useRecalculatePortfolio() {
  const refresh = useRefreshPortfolio();
  return useMutation({
    mutationFn: () =>
      apiRequest("/api/portfolio/recalculate", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: async () => {
      await refresh();
    },
  });
}
