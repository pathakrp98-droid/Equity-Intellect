import { useMemo, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  WalletCards,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useCreatePortfolioTransaction,
  useDeletePortfolioTransaction,
  useImportPortfolioCsv,
  usePortfolioOverview,
  usePortfolioTransactions,
  useRecalculatePortfolio,
  useUpdatePortfolioPrices,
  type CreateTransactionPayload,
  type CsvImportResponse,
  type PortfolioTransaction,
  type TransactionType,
} from "@/features/portfolio/api";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 4,
});

function money(value: number | null | undefined) {
  return currencyFormatter.format(value ?? 0);
}

function percent(value: number | null | undefined) {
  return `${(value ?? 0).toFixed(2)}%`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function PortfolioEngine() {
  const overview = usePortfolioOverview();
  const transactions = usePortfolioTransactions();
  const recalculate = useRecalculatePortfolio();

  const unauthorized =
    errorMessage(overview.error).toLowerCase().includes("sign in") ||
    errorMessage(overview.error).includes("401");

  if (overview.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-72" />
        <div className="grid gap-4 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-[480px]" />
      </div>
    );
  }

  if (overview.isError) {
    return (
      <Card className="max-w-2xl border-amber-500/30 bg-amber-500/5">
        <CardContent className="space-y-4 p-8">
          <AlertTriangle className="h-9 w-9 text-amber-500" />
          <div>
            <h1 className="text-2xl font-semibold">Portfolio Engine</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {unauthorized
                ? "Sign in to create your private transaction ledger and portfolio."
                : errorMessage(overview.error)}
            </p>
          </div>
          {unauthorized && (
            <Button
              onClick={() => {
                window.location.href = "/api/login?returnTo=/portfolio";
              }}
            >
              Sign in
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const data = overview.data;
  const snapshot = data?.snapshot;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Transaction-ledger portfolio OS
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {data?.portfolio.name ?? "Portfolio Engine"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Holdings, cash and performance are rebuilt from your actual
            transactions.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => recalculate.mutate()}
          disabled={recalculate.isPending}
        >
          {recalculate.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Recalculate
        </Button>
      </div>

      <SummaryCards
        totalValue={snapshot?.totalValue ?? 0}
        marketValue={snapshot?.marketValue ?? 0}
        cashBalance={snapshot?.cashBalance ?? 0}
        totalPnl={snapshot?.totalPnl ?? 0}
        totalReturnPct={snapshot?.totalReturnPct ?? 0}
        xirrPct={snapshot?.xirrPct ?? null}
      />

      <Tabs defaultValue="holdings" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-4">
          <TabsTrigger value="holdings">Holdings</TabsTrigger>
          <TabsTrigger value="transactions">
            Transactions ({data?.transactionCount ?? 0})
          </TabsTrigger>
          <TabsTrigger value="import">Import & prices</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="holdings">
          <HoldingsPanel />
        </TabsContent>
        <TabsContent value="transactions">
          <TransactionsPanel
            transactions={transactions.data ?? []}
            isLoading={transactions.isLoading}
          />
        </TabsContent>
        <TabsContent value="import">
          <ImportAndPricesPanel />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCards({
  totalValue,
  marketValue,
  cashBalance,
  totalPnl,
  totalReturnPct,
  xirrPct,
}: {
  totalValue: number;
  marketValue: number;
  cashBalance: number;
  totalPnl: number;
  totalReturnPct: number;
  xirrPct: number | null;
}) {
  const cards = [
    { label: "Total value", value: money(totalValue), detail: "Equity + cash" },
    {
      label: "Market value",
      value: money(marketValue),
      detail: "Open holdings",
    },
    { label: "Cash", value: money(cashBalance), detail: "Ledger-derived" },
    {
      label: "Total P&L",
      value: money(totalPnl),
      detail: percent(totalReturnPct),
      positive: totalPnl >= 0,
    },
    {
      label: "XIRR",
      value: xirrPct === null ? "—" : percent(xirrPct),
      detail:
        xirrPct === null ? "Add deposits for XIRR" : "Money-weighted return",
      positive: (xirrPct ?? 0) >= 0,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label} className="bg-card/70">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {card.label}
            </p>
            <p
              className={cn(
                "mt-2 text-xl font-semibold tabular-nums",
                card.positive === true && "text-emerald-500",
                card.positive === false && "text-destructive",
              )}
            >
              {card.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function HoldingsPanel() {
  const overview = usePortfolioOverview();
  const [, navigate] = useLocation();
  const holdings = overview.data?.holdings ?? [];

  if (holdings.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
          <WalletCards className="h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">No holdings yet</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Add an opening cash deposit and your first buy transaction, or
            import a broker tradebook CSV. Holdings will be calculated
            automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-secondary/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Asset</th>
              <th className="px-4 py-3 text-right font-medium">Quantity</th>
              <th className="px-4 py-3 text-right font-medium">Average cost</th>
              <th className="px-4 py-3 text-right font-medium">Market price</th>
              <th className="px-4 py-3 text-right font-medium">Market value</th>
              <th className="px-4 py-3 text-right font-medium">
                Unrealized P&L
              </th>
              <th className="px-4 py-3 text-right font-medium">Day</th>
              <th className="px-4 py-3 text-right font-medium">Allocation</th>
              <th className="px-4 py-3 text-left font-medium">Price source</th>
              <th className="px-4 py-3 text-left font-medium">Research</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {holdings.map((holding) => (
              <tr key={holding.ticker} className="hover:bg-secondary/20">
                <td className="px-4 py-4">
                  <p className="font-semibold">{holding.ticker}</p>
                  <p className="text-xs text-muted-foreground">
                    {holding.name} · {holding.sector}
                  </p>
                </td>
                <td className="px-4 py-4 text-right font-mono">
                  {numberFormatter.format(holding.quantity)}
                </td>
                <td className="px-4 py-4 text-right font-mono">
                  {money(holding.averageCost)}
                </td>
                <td className="px-4 py-4 text-right font-mono">
                  {money(holding.marketPrice)}
                </td>
                <td className="px-4 py-4 text-right font-mono font-medium">
                  {money(holding.marketValue)}
                </td>
                <td
                  className={cn(
                    "px-4 py-4 text-right font-mono",
                    holding.unrealizedPnl >= 0
                      ? "text-emerald-500"
                      : "text-destructive",
                  )}
                >
                  <p>{money(holding.unrealizedPnl)}</p>
                  <p className="text-xs">{percent(holding.unrealizedPnlPct)}</p>
                </td>
                <td
                  className={cn(
                    "px-4 py-4 text-right font-mono",
                    holding.dayChange >= 0
                      ? "text-emerald-500"
                      : "text-destructive",
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {holding.dayChange >= 0 ? (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    )}
                    {percent(holding.dayChangePct)}
                  </span>
                </td>
                <td className="px-4 py-4 text-right font-mono">
                  {percent(holding.allocationPct)}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-1 text-[11px]",
                      holding.priceSource !== "last_transaction"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-500",
                    )}
                  >
                    {holding.priceSource !== "last_transaction"
                      ? "Market quote"
                      : "Last transaction"}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate(`/research?ticker=${holding.ticker}`)
                    }
                  >
                    Open thesis
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const EMPTY_TRANSACTION_FORM = {
  type: "buy" as TransactionType,
  tradeDate: new Date().toISOString().slice(0, 10),
  ticker: "",
  name: "",
  sector: "",
  quantity: "",
  price: "",
  amount: "",
  fees: "0",
  taxes: "0",
  splitNumerator: "",
  splitDenominator: "",
  notes: "",
};

function TransactionsPanel({
  transactions,
  isLoading,
}: {
  transactions: PortfolioTransaction[];
  isLoading: boolean;
}) {
  const [form, setForm] = useState(EMPTY_TRANSACTION_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const create = useCreatePortfolioTransaction();
  const remove = useDeletePortfolioTransaction();

  const securityType = ["buy", "sell", "bonus", "split", "rights"].includes(
    form.type,
  );
  const amountType = ["deposit", "withdrawal", "interest", "fees"].includes(
    form.type,
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const payload: CreateTransactionPayload = {
      type: form.type,
      tradeDate: form.tradeDate,
      ticker: form.ticker || undefined,
      name: form.name || undefined,
      sector: form.sector || undefined,
      quantity: form.quantity ? Number(form.quantity) : undefined,
      price: form.price ? Number(form.price) : undefined,
      amount: form.amount ? Number(form.amount) : undefined,
      fees: form.fees ? Number(form.fees) : 0,
      taxes: form.taxes ? Number(form.taxes) : 0,
      splitNumerator: form.splitNumerator
        ? Number(form.splitNumerator)
        : undefined,
      splitDenominator: form.splitDenominator
        ? Number(form.splitDenominator)
        : undefined,
      notes: form.notes || undefined,
    };
    create.mutate(payload, {
      onSuccess: () => {
        setForm(EMPTY_TRANSACTION_FORM);
        setFormError(null);
      },
      onError: (error) => setFormError(errorMessage(error)),
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> Add transaction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      type: event.target.value as TransactionType,
                    }))
                  }
                >
                  {[
                    "buy",
                    "sell",
                    "deposit",
                    "withdrawal",
                    "dividend",
                    "bonus",
                    "split",
                    "rights",
                    "interest",
                    "fees",
                  ].map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/^./, (value) => value.toUpperCase())}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Trade date">
                <Input
                  type="date"
                  value={form.tradeDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tradeDate: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>

            {securityType && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ticker">
                    <Input
                      placeholder="RELIANCE"
                      value={form.ticker}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          ticker: event.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Sector">
                    <Input
                      placeholder="Energy"
                      value={form.sector}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          sector: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
                <Field label="Company name">
                  <Input
                    placeholder="Reliance Industries"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </Field>
              </>
            )}

            {form.type === "split" ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="New shares">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="2"
                    value={form.splitNumerator}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        splitNumerator: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Old shares">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="1"
                    value={form.splitDenominator}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        splitDenominator: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
            ) : (
              (securityType || form.type === "dividend") && (
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label={
                      form.type === "dividend"
                        ? "Shares (optional)"
                        : "Quantity"
                    }
                  >
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={form.quantity}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          quantity: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  {form.type !== "bonus" && (
                    <Field
                      label={
                        form.type === "dividend" ? "Dividend/share" : "Price"
                      }
                    >
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={form.price}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            price: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  )}
                </div>
              )
            )}

            {(amountType || form.type === "dividend") && (
              <Field
                label={
                  form.type === "dividend"
                    ? "Total amount (preferred)"
                    : "Amount"
                }
              >
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                />
              </Field>
            )}

            {["buy", "sell", "rights"].includes(form.type) && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fees">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={form.fees}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        fees: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Taxes">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={form.taxes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        taxes: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
            )}

            <Field label="Notes">
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </Field>

            {(formError || create.isError) && (
              <p className="text-sm text-destructive">
                {formError ?? errorMessage(create.error)}
              </p>
            )}
            <Button className="w-full" disabled={create.isPending}>
              {create.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save and recalculate
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Transaction ledger</CardTitle>
        </CardHeader>
        {isLoading ? (
          <CardContent className="space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="h-12" />
            ))}
          </CardContent>
        ) : transactions.length === 0 ? (
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Your immutable source-of-truth ledger will appear here.
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="bg-secondary/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Asset</th>
                  <th className="px-4 py-3 text-right font-medium">Quantity</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Price/amount
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Broker</th>
                  <th className="px-4 py-3 text-right font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(transaction.tradeDate).toLocaleDateString(
                        "en-IN",
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border px-2 py-1 text-[11px] uppercase">
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {transaction.ticker ?? "Cash"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {transaction.name ?? transaction.notes ?? ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {transaction.quantity == null
                        ? "—"
                        : numberFormatter.format(transaction.quantity)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {transaction.amount != null
                        ? money(transaction.amount)
                        : transaction.price != null
                          ? money(transaction.price)
                          : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {transaction.broker ?? "manual"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Delete this transaction and rebuild the portfolio?",
                            )
                          ) {
                            remove.mutate(transaction.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ImportAndPricesPanel() {
  const [broker, setBroker] = useState<"manual" | "zerodha" | "groww">(
    "manual",
  );
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<CsvImportResponse | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pricesText, setPricesText] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);
  const importer = useImportPortfolioCsv();
  const priceUpdater = useUpdatePortfolioPrices();

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setCsv(await file.text());
    setResult(null);
    setImportError(null);
  }

  function importCsv() {
    setImportError(null);
    setResult(null);
    importer.mutate(
      { broker, csv },
      {
        onSuccess: (response) => setResult(response),
        onError: (error) => setImportError(errorMessage(error)),
      },
    );
  }

  function updatePrices() {
    setPriceError(null);
    try {
      const prices = pricesText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
          const [rawTicker, rawPrice, rawPreviousClose] = line
            .split(",")
            .map((value) => value.trim());
          const price = Number(rawPrice);
          const previousClose = rawPreviousClose
            ? Number(rawPreviousClose)
            : undefined;
          if (!rawTicker || !Number.isFinite(price) || price <= 0) {
            throw new Error(`Invalid price on line ${index + 1}`);
          }
          if (
            previousClose !== undefined &&
            (!Number.isFinite(previousClose) || previousClose <= 0)
          ) {
            throw new Error(`Invalid previous close on line ${index + 1}`);
          }
          return {
            ticker: rawTicker.toUpperCase(),
            price,
            previousClose,
          };
        });
      if (prices.length === 0) throw new Error("Enter at least one price");
      priceUpdater.mutate(prices, {
        onSuccess: () => setPricesText(""),
        onError: (error) => setPriceError(errorMessage(error)),
      });
    } catch (error) {
      setPriceError(errorMessage(error));
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-4 w-4" /> Import tradebook CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={broker}
              onChange={(event) =>
                setBroker(event.target.value as "manual" | "zerodha" | "groww")
              }
            >
              <option value="manual">Manual template</option>
              <option value="zerodha">Zerodha</option>
              <option value="groww">Groww</option>
            </select>
            <label className="flex h-10 cursor-pointer items-center justify-center rounded-md border border-dashed border-input px-3 text-sm hover:bg-secondary/40">
              <Upload className="mr-2 h-4 w-4" />
              {fileName || "Choose CSV"}
              <input
                className="hidden"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void pickFile(event.target.files?.[0])}
              />
            </label>
          </div>

          <a
            className="inline-flex items-center text-sm text-primary hover:underline"
            href="/api/portfolio/template.csv"
          >
            <Download className="mr-2 h-4 w-4" /> Download manual template
          </a>

          <div className="rounded-lg border bg-secondary/20 p-3 text-xs text-muted-foreground">
            Imports are idempotent. Re-uploading the same broker rows will be
            counted as duplicates rather than creating double holdings.
          </div>

          {importError && (
            <p className="text-sm text-destructive">{importError}</p>
          )}
          {result && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
              Imported {result.imported}; skipped {result.duplicates}{" "}
              duplicates; {result.failed} failed.
              {result.errors.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                  {result.errors.slice(0, 5).map((error) => (
                    <li key={`${error.row}-${error.message}`}>
                      Row {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Button
            className="w-full"
            disabled={!csv || importer.isPending}
            onClick={importCsv}
          >
            {importer.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Import and rebuild
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Update market prices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter one security per line as ticker, current price, previous
            close. Until a quote is entered, AlphaDesk clearly uses the latest
            transaction price.
          </p>
          <Textarea
            className="min-h-48 font-mono text-sm"
            placeholder={"RELIANCE, 2985.50, 2940.10\nINFY, 1725.00, 1708.40"}
            value={pricesText}
            onChange={(event) => setPricesText(event.target.value)}
          />
          {priceError && (
            <p className="text-sm text-destructive">{priceError}</p>
          )}
          <Button
            className="w-full"
            variant="outline"
            disabled={!pricesText.trim() || priceUpdater.isPending}
            onClick={updatePrices}
          >
            {priceUpdater.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save quotes and recalculate
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AnalyticsPanel() {
  const overview = usePortfolioOverview();
  const snapshot = overview.data?.snapshot;
  const holdings = overview.data?.holdings ?? [];

  const topFive = useMemo(
    () =>
      holdings
        .slice(0, 5)
        .reduce((sum, holding) => sum + holding.allocationPct, 0),
    [holdings],
  );

  if (!snapshot) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Analytics will appear after the first transaction is saved.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Allocation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(snapshot.sectorAllocation ?? []).map((sector) => (
            <div key={sector.sector} className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span>{sector.sector}</span>
                <span className="font-mono">
                  {percent(sector.allocationPct)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, sector.allocationPct)}%` }}
                />
              </div>
            </div>
          ))}
          {(snapshot.sectorAllocation ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No invested assets yet.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Concentration</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Metric
              label="Largest position"
              value={percent(snapshot.largestPositionPct)}
            />
            <Metric label="Top five" value={percent(topFive)} />
            <Metric label="Holdings" value={String(snapshot.holdingsCount)} />
            <Metric
              label="Cash weight"
              value={
                snapshot.totalValue > 0
                  ? percent((snapshot.cashBalance / snapshot.totalValue) * 100)
                  : "—"
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Data and risk
              flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot.riskFlags.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No basic concentration or cash-buffer flags are active.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {snapshot.riskFlags.map((flag) => (
                  <li
                    key={flag}
                    className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
                  >
                    {flag}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-secondary/20 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
