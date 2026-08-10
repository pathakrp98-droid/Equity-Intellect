export type PortfolioTransactionType =
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

export interface EngineTransaction {
  id?: number | string;
  ticker?: string | null;
  name?: string | null;
  exchange?: string | null;
  sector?: string | null;
  type: PortfolioTransactionType;
  quantity?: number | null;
  price?: number | null;
  amount?: number | null;
  fees?: number | null;
  taxes?: number | null;
  currency?: string | null;
  tradeDate: Date | string;
  splitNumerator?: number | null;
  splitDenominator?: number | null;
  broker?: string | null;
}

export interface MarketQuote {
  ticker: string;
  price: number;
  previousClose?: number | null;
  asOf?: Date | string;
  source?: string;
}

export interface CalculatedHolding {
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  quantity: number;
  averageCost: number;
  marketPrice: number;
  previousClose: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  dayChange: number;
  dayChangePct: number;
  allocationPct: number;
  firstTradeDate: Date;
  priceSource: "quote" | "last_transaction";
  brokers: string[];
}

export interface SectorAllocation {
  sector: string;
  value: number;
  allocationPct: number;
  herfindahlIndex: number;
}

export interface PortfolioCalculation {
  asOf: Date;
  holdings: CalculatedHolding[];
  marketValue: number;
  cashBalance: number;
  totalValue: number;
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
  holdingsCount: number;
  largestPositionTicker: string | null;
  largestPositionPct: number;
  topFiveConcentrationPct: number;
  concentrationRisk: "low" | "medium" | "high";
  sectorAllocation: SectorAllocation[];
  riskFlags: string[];
}

interface PositionState {
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  quantity: number;
  costBasis: number;
  realizedPnl: number;
  firstTradeDate: Date;
  lastTransactionPrice: number;
  brokers: Set<string>;
}

interface CashFlow {
  date: Date;
  amount: number;
}

const EPSILON = 1e-8;
const DAYS_PER_YEAR = 365.2425;

function toDate(value: Date | string): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid transaction date: ${String(value)}`);
  }
  return date;
}

function finite(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positive(value: number | null | undefined, field: string): number {
  const normalized = finite(value);
  if (normalized <= 0) {
    throw new Error(`${field} must be greater than zero`);
  }
  return normalized;
}

function securityTicker(transaction: EngineTransaction): string {
  const ticker = transaction.ticker?.trim().toUpperCase();
  if (!ticker) {
    throw new Error(`${transaction.type} transaction requires a ticker`);
  }
  return ticker;
}

function amountForCashTransaction(transaction: EngineTransaction): number {
  const explicit = finite(transaction.amount);
  if (explicit > 0) return explicit;

  const quantity = finite(transaction.quantity);
  const price = finite(transaction.price);
  const calculated = quantity * price;
  if (calculated > 0) return calculated;

  throw new Error(`${transaction.type} transaction requires a positive amount`);
}

function getOrCreatePosition(
  positions: Map<string, PositionState>,
  transaction: EngineTransaction,
): PositionState {
  const ticker = securityTicker(transaction);
  const date = toDate(transaction.tradeDate);
  const existing = positions.get(ticker);

  if (existing) {
    if (transaction.name) existing.name = transaction.name;
    if (transaction.exchange) existing.exchange = transaction.exchange;
    if (transaction.sector) existing.sector = transaction.sector;
    if (transaction.broker) existing.brokers.add(transaction.broker);
    return existing;
  }

  const state: PositionState = {
    ticker,
    name: transaction.name?.trim() || ticker,
    exchange: transaction.exchange?.trim().toUpperCase() || "NSE",
    sector: transaction.sector?.trim() || "Unclassified",
    quantity: 0,
    costBasis: 0,
    realizedPnl: 0,
    firstTradeDate: date,
    lastTransactionPrice: finite(transaction.price),
    brokers: new Set(transaction.broker ? [transaction.broker] : []),
  };
  positions.set(ticker, state);
  return state;
}

function calculateXirr(cashFlows: CashFlow[]): number | null {
  const filtered = cashFlows
    .filter((flow) => Number.isFinite(flow.amount) && Math.abs(flow.amount) > EPSILON)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (filtered.length < 2) return null;
  if (!filtered.some((flow) => flow.amount < 0)) return null;
  if (!filtered.some((flow) => flow.amount > 0)) return null;

  const firstDate = filtered[0].date;
  const years = filtered.map(
    (flow) =>
      (flow.date.getTime() - firstDate.getTime()) /
      (1000 * 60 * 60 * 24 * DAYS_PER_YEAR),
  );

  const npv = (rate: number): number =>
    filtered.reduce(
      (sum, flow, index) => sum + flow.amount / (1 + rate) ** years[index],
      0,
    );

  const derivative = (rate: number): number =>
    filtered.reduce((sum, flow, index) => {
      if (years[index] === 0) return sum;
      return (
        sum -
        (years[index] * flow.amount) /
          (1 + rate) ** (years[index] + 1)
      );
    }, 0);

  let rate = 0.12;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (rate <= -0.999999) rate = -0.9;
    const value = npv(rate);
    if (Math.abs(value) < 1e-7) return rate;
    const slope = derivative(rate);
    if (!Number.isFinite(slope) || Math.abs(slope) < 1e-10) break;
    const next = rate - value / slope;
    if (!Number.isFinite(next) || next <= -0.999999 || next > 1e6) break;
    if (Math.abs(next - rate) < 1e-10) return next;
    rate = next;
  }

  let lower = -0.9999;
  let upper = 1;
  let lowerValue = npv(lower);
  let upperValue = npv(upper);

  for (let expansion = 0; expansion < 50 && lowerValue * upperValue > 0; expansion += 1) {
    upper *= 2;
    upperValue = npv(upper);
  }

  if (!Number.isFinite(lowerValue) || !Number.isFinite(upperValue)) return null;
  if (lowerValue * upperValue > 0) return null;

  for (let attempt = 0; attempt < 160; attempt += 1) {
    const midpoint = (lower + upper) / 2;
    const midpointValue = npv(midpoint);
    if (Math.abs(midpointValue) < 1e-7) return midpoint;
    if (lowerValue * midpointValue <= 0) {
      upper = midpoint;
      upperValue = midpointValue;
    } else {
      lower = midpoint;
      lowerValue = midpointValue;
    }
  }

  return (lower + upper) / 2;
}

function round(value: number, decimals = 8): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculatePortfolio(
  inputTransactions: EngineTransaction[],
  quotes: MarketQuote[] = [],
  asOf = new Date(),
): PortfolioCalculation {
  const transactions = [...inputTransactions].sort((a, b) => {
    const dateDifference = toDate(a.tradeDate).getTime() - toDate(b.tradeDate).getTime();
    if (dateDifference !== 0) return dateDifference;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });

  const quoteMap = new Map(
    quotes.map((quote) => [quote.ticker.trim().toUpperCase(), quote]),
  );
  const positions = new Map<string, PositionState>();
  const investorCashFlows: CashFlow[] = [];

  let cashBalance = 0;
  let dividendIncome = 0;
  let interestIncome = 0;
  let feesPaid = 0;
  let netContributions = 0;
  let closedPositionRealizedPnl = 0;

  for (const transaction of transactions) {
    const date = toDate(transaction.tradeDate);
    const fees = Math.max(0, finite(transaction.fees));
    const taxes = Math.max(0, finite(transaction.taxes));

    switch (transaction.type) {
      case "buy":
      case "rights": {
        const position = getOrCreatePosition(positions, transaction);
        const quantity = positive(transaction.quantity, "quantity");
        const price = positive(transaction.price, "price");
        const totalCost = quantity * price + fees + taxes;

        position.quantity += quantity;
        position.costBasis += totalCost;
        position.lastTransactionPrice = price;
        cashBalance -= totalCost;
        feesPaid += fees + taxes;
        break;
      }

      case "sell": {
        const ticker = securityTicker(transaction);
        const position = positions.get(ticker);
        if (!position || position.quantity <= EPSILON) {
          throw new Error(`Cannot sell ${ticker}: no open position exists`);
        }

        const quantity = positive(transaction.quantity, "quantity");
        const price = positive(transaction.price, "price");
        if (quantity - position.quantity > EPSILON) {
          throw new Error(
            `Cannot sell ${quantity} ${ticker}; only ${position.quantity} is available`,
          );
        }

        const averageCost = position.costBasis / position.quantity;
        const removedCost = averageCost * quantity;
        const netProceeds = quantity * price - fees - taxes;
        const realized = netProceeds - removedCost;

        position.quantity -= quantity;
        position.costBasis -= removedCost;
        position.realizedPnl += realized;
        position.lastTransactionPrice = price;
        if (transaction.broker) position.brokers.add(transaction.broker);
        cashBalance += netProceeds;
        feesPaid += fees + taxes;

        if (position.quantity <= EPSILON) {
          closedPositionRealizedPnl += position.realizedPnl;
          positions.delete(ticker);
        }
        break;
      }

      case "bonus": {
        const position = getOrCreatePosition(positions, transaction);
        if (position.quantity <= EPSILON) {
          throw new Error(`Cannot apply bonus shares to ${position.ticker} without a position`);
        }
        position.quantity += positive(transaction.quantity, "bonus quantity");
        break;
      }

      case "split": {
        const ticker = securityTicker(transaction);
        const position = positions.get(ticker);
        if (!position || position.quantity <= EPSILON) {
          throw new Error(`Cannot apply split to ${ticker} without a position`);
        }
        const numerator = positive(transaction.splitNumerator, "split numerator");
        const denominator = positive(
          transaction.splitDenominator,
          "split denominator",
        );
        position.quantity *= numerator / denominator;
        break;
      }

      case "dividend": {
        const amount = amountForCashTransaction(transaction);
        cashBalance += amount;
        dividendIncome += amount;
        break;
      }

      case "deposit": {
        const amount = amountForCashTransaction(transaction);
        cashBalance += amount;
        netContributions += amount;
        investorCashFlows.push({ date, amount: -amount });
        break;
      }

      case "withdrawal": {
        const amount = amountForCashTransaction(transaction);
        cashBalance -= amount;
        netContributions -= amount;
        investorCashFlows.push({ date, amount });
        break;
      }

      case "interest": {
        const amount = amountForCashTransaction(transaction);
        cashBalance += amount;
        interestIncome += amount;
        break;
      }

      case "fees": {
        const amount =
          finite(transaction.amount) > 0
            ? finite(transaction.amount)
            : fees + taxes;
        if (amount <= 0) {
          throw new Error("fees transaction requires a positive amount");
        }
        cashBalance -= amount;
        feesPaid += amount;
        break;
      }

      default: {
        const exhaustiveCheck: never = transaction.type;
        throw new Error(`Unsupported transaction type: ${exhaustiveCheck}`);
      }
    }
  }

  const openPositions = [...positions.values()].filter(
    (position) => position.quantity > EPSILON,
  );

  const provisional = openPositions.map((position) => {
    const quote = quoteMap.get(position.ticker);
    const marketPrice = quote?.price ?? position.lastTransactionPrice;
    if (!Number.isFinite(marketPrice) || marketPrice < 0) {
      throw new Error(`No usable price is available for ${position.ticker}`);
    }
    const previousClose = quote?.previousClose ?? marketPrice;
    const marketValue = position.quantity * marketPrice;
    const unrealizedPnl = marketValue - position.costBasis;

    return {
      position,
      quote,
      marketPrice,
      previousClose,
      marketValue,
      unrealizedPnl,
    };
  });

  const marketValue = provisional.reduce((sum, item) => sum + item.marketValue, 0);
  const totalValue = marketValue + cashBalance;
  const allocationDenominator = totalValue > EPSILON ? totalValue : marketValue;

  const holdings: CalculatedHolding[] = provisional
    .map(({ position, quote, marketPrice, previousClose, marketValue: value, unrealizedPnl }) => {
      const averageCost = position.costBasis / position.quantity;
      const dayChange = marketPrice - previousClose;
      return {
        ticker: position.ticker,
        name: position.name,
        exchange: position.exchange,
        sector: position.sector,
        quantity: round(position.quantity),
        averageCost: round(averageCost),
        marketPrice: round(marketPrice),
        previousClose: round(previousClose),
        marketValue: round(value),
        costBasis: round(position.costBasis),
        unrealizedPnl: round(unrealizedPnl),
        unrealizedPnlPct:
          position.costBasis > EPSILON
            ? round((unrealizedPnl / position.costBasis) * 100)
            : 0,
        realizedPnl: round(position.realizedPnl),
        dayChange: round(dayChange),
        dayChangePct:
          previousClose > EPSILON ? round((dayChange / previousClose) * 100) : 0,
        allocationPct:
          allocationDenominator > EPSILON
            ? round((value / allocationDenominator) * 100)
            : 0,
        firstTradeDate: position.firstTradeDate,
        priceSource: quote ? ("quote" as const) : ("last_transaction" as const),
        brokers: [...position.brokers].sort(),
      };
    })
    .sort((a, b) => b.marketValue - a.marketValue);

  const costBasis = holdings.reduce((sum, holding) => sum + holding.costBasis, 0);
  const unrealizedPnl = holdings.reduce(
    (sum, holding) => sum + holding.unrealizedPnl,
    0,
  );
  const realizedPnl =
    closedPositionRealizedPnl +
    holdings.reduce((sum, holding) => sum + holding.realizedPnl, 0);
  const totalPnl = totalValue - netContributions;
  const totalReturnPct =
    Math.abs(netContributions) > EPSILON
      ? (totalPnl / Math.abs(netContributions)) * 100
      : costBasis > EPSILON
        ? ((unrealizedPnl + realizedPnl + dividendIncome + interestIncome) /
            costBasis) *
          100
        : 0;

  if (totalValue > EPSILON) {
    investorCashFlows.push({ date: asOf, amount: totalValue });
  }
  const xirr = calculateXirr(investorCashFlows);

  const sectorValues = new Map<string, number>();
  for (const holding of holdings) {
    sectorValues.set(
      holding.sector,
      (sectorValues.get(holding.sector) ?? 0) + holding.marketValue,
    );
  }
  const sectorAllocation = [...sectorValues.entries()]
    .map(([sector, value]) => {
      const weight = marketValue > EPSILON ? value / marketValue : 0;
      return {
        sector,
        value: round(value),
        allocationPct: round(weight * 100),
        herfindahlIndex: round(weight ** 2),
      };
    })
    .sort((a, b) => b.value - a.value);

  const largestPosition = holdings[0] ?? null;
  const largestPositionPct = largestPosition?.allocationPct ?? 0;
  const topFiveConcentrationPct = round(
    holdings.slice(0, 5).reduce((sum, holding) => sum + holding.allocationPct, 0),
  );
  const concentrationRisk: PortfolioCalculation["concentrationRisk"] =
    largestPositionPct > 25 || topFiveConcentrationPct > 80
      ? "high"
      : largestPositionPct > 15 || topFiveConcentrationPct > 65
        ? "medium"
        : "low";

  const riskFlags: string[] = [];
  if (cashBalance < -EPSILON) {
    riskFlags.push("Cash balance is negative; imported funding transactions may be incomplete.");
  }
  if (largestPositionPct > 20 && largestPosition) {
    riskFlags.push(
      `${largestPosition.ticker} is ${largestPositionPct.toFixed(1)}% of total portfolio value.`,
    );
  }
  const concentratedSector = sectorAllocation.find(
    (sector) => sector.allocationPct > 35,
  );
  if (concentratedSector) {
    riskFlags.push(
      `${concentratedSector.sector} is ${concentratedSector.allocationPct.toFixed(1)}% of invested assets.`,
    );
  }
  if (totalValue > EPSILON && (cashBalance / totalValue) * 100 < 5) {
    riskFlags.push("Cash buffer is below 5% of total portfolio value.");
  }
  const stalePriceTickers = holdings
    .filter((holding) => holding.priceSource === "last_transaction")
    .map((holding) => holding.ticker);
  if (stalePriceTickers.length > 0) {
    riskFlags.push(
      `Manual market prices are missing for: ${stalePriceTickers.join(", ")}.`,
    );
  }

  return {
    asOf,
    holdings,
    marketValue: round(marketValue),
    cashBalance: round(cashBalance),
    totalValue: round(totalValue),
    costBasis: round(costBasis),
    realizedPnl: round(realizedPnl),
    unrealizedPnl: round(unrealizedPnl),
    dividendIncome: round(dividendIncome),
    interestIncome: round(interestIncome),
    feesPaid: round(feesPaid),
    netContributions: round(netContributions),
    totalPnl: round(totalPnl),
    totalReturnPct: round(totalReturnPct),
    xirrPct: xirr === null ? null : round(xirr * 100),
    holdingsCount: holdings.length,
    largestPositionTicker: largestPosition?.ticker ?? null,
    largestPositionPct: round(largestPositionPct),
    topFiveConcentrationPct,
    concentrationRisk,
    sectorAllocation,
    riskFlags,
  };
}
