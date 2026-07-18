import { Router, type Request, type Response } from "express";
import { db, watchlistTable, decisionJournalTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// ── Demo Holdings (read-only demo data — will require live-data integration for production) ──
const HOLDINGS = [
  { ticker: "HDFCBANK", name: "HDFC Bank", sector: "Banking & Finance", quantity: 350, avgBuyPrice: 1482.4, ltp: 1618.75, currentValue: 566562.5, investedValue: 518840, pnl: 47722.5, pnlPct: 9.2, dayChange: 14.25, dayChangePct: 0.89, allocationPct: 11.74, conviction: "high", thesisStatus: "intact", entryDate: "2022-11-14", targetPrice: 1700, stopLoss: 1380, idealWeight: 12.0, broker: "Zerodha", hasAlert: false },
  { ticker: "RELIANCE", name: "Reliance Industries", sector: "Energy", quantity: 210, avgBuyPrice: 2210.6, ltp: 2847.3, currentValue: 597933, investedValue: 464226, pnl: 133707, pnlPct: 28.8, dayChange: -22.4, dayChangePct: -0.78, allocationPct: 12.39, conviction: "high", thesisStatus: "intact", entryDate: "2021-08-03", targetPrice: 3000, stopLoss: 2400, idealWeight: 12.0, broker: "Zerodha", hasAlert: false },
  { ticker: "INFY", name: "Infosys", sector: "Technology", quantity: 420, avgBuyPrice: 1456.8, ltp: 1742.5, currentValue: 731850, investedValue: 611856, pnl: 119994, pnlPct: 19.61, dayChange: 28.6, dayChangePct: 1.67, allocationPct: 15.17, conviction: "high", thesisStatus: "intact", entryDate: "2021-05-18", targetPrice: 2000, stopLoss: 1500, idealWeight: 15.0, broker: "Zerodha", hasAlert: false },
  { ticker: "TCS", name: "Tata Consultancy Services", sector: "Technology", quantity: 80, avgBuyPrice: 3248.5, ltp: 3812.4, currentValue: 304992, investedValue: 259880, pnl: 45112, pnlPct: 17.36, dayChange: 42.1, dayChangePct: 1.12, allocationPct: 6.32, conviction: "medium", thesisStatus: "intact", entryDate: "2022-04-12", targetPrice: 4000, stopLoss: 3200, idealWeight: 6.0, broker: "HDFC Securities", hasAlert: false },
  { ticker: "BAJFINANCE", name: "Bajaj Finance", sector: "Banking & Finance", quantity: 180, avgBuyPrice: 6842.3, ltp: 6924.6, currentValue: 1246428, investedValue: 1231614, pnl: 14814, pnlPct: 1.2, dayChange: -86.4, dayChangePct: -1.23, allocationPct: 13.41, conviction: "high", thesisStatus: "weakening", entryDate: "2020-09-22", targetPrice: 8500, stopLoss: 6200, idealWeight: 13.0, broker: "Zerodha", hasAlert: true },
  { ticker: "ASIANPAINT", name: "Asian Paints", sector: "Consumer", quantity: 240, avgBuyPrice: 2986.4, ltp: 2318.5, currentValue: 556440, investedValue: 716736, pnl: -160296, pnlPct: -22.36, dayChange: -31.2, dayChangePct: -1.33, allocationPct: 11.53, conviction: "medium", thesisStatus: "weakening", entryDate: "2021-11-30", targetPrice: 3200, stopLoss: 2100, idealWeight: 10.0, broker: "HDFC Securities", hasAlert: true },
  { ticker: "KOTAKBANK", name: "Kotak Mahindra Bank", sector: "Banking & Finance", quantity: 190, avgBuyPrice: 1724.6, ltp: 1893.2, currentValue: 359708, investedValue: 327674, pnl: 32034, pnlPct: 9.77, dayChange: 11.8, dayChangePct: 0.63, allocationPct: 7.45, conviction: "medium", thesisStatus: "intact", entryDate: "2023-02-08", targetPrice: 2000, stopLoss: 1600, idealWeight: 8.0, broker: "Zerodha", hasAlert: false },
  { ticker: "DMART", name: "Avenue Supermarts", sector: "Consumer", quantity: 65, avgBuyPrice: 4218.6, ltp: 4682.3, currentValue: 304349.5, investedValue: 282609, pnl: 21740.5, pnlPct: 7.69, dayChange: 24.6, dayChangePct: 0.53, allocationPct: 6.31, conviction: "high", thesisStatus: "intact", entryDate: "2022-07-19", targetPrice: 5000, stopLoss: 4000, idealWeight: 6.0, broker: "Zerodha", hasAlert: false },
  { ticker: "MARUTI", name: "Maruti Suzuki", sector: "Auto", quantity: 42, avgBuyPrice: 8642.3, ltp: 10284.6, currentValue: 431953.2, investedValue: 362976.6, pnl: 68976.6, pnlPct: 19.0, dayChange: 82.4, dayChangePct: 0.81, allocationPct: 8.95, conviction: "high", thesisStatus: "intact", entryDate: "2022-02-14", targetPrice: 11000, stopLoss: 8800, idealWeight: 9.0, broker: "HDFC Securities", hasAlert: false },
  { ticker: "SUNPHARMA", name: "Sun Pharmaceutical", sector: "Pharma", quantity: 145, avgBuyPrice: 1124.6, ltp: 1386.4, currentValue: 201028, investedValue: 163067, pnl: 37961, pnlPct: 23.28, dayChange: -14.2, dayChangePct: -1.01, allocationPct: 4.17, conviction: "medium", thesisStatus: "intact", entryDate: "2023-05-11", targetPrice: 1750, stopLoss: 1200, idealWeight: 4.0, broker: "Zerodha", hasAlert: false },
  { ticker: "TITAN", name: "Titan Company", sector: "Consumer", quantity: 78, avgBuyPrice: 2886.4, ltp: 3124.8, currentValue: 243734.4, investedValue: 225139.2, pnl: 18595.2, pnlPct: 8.26, dayChange: 18.6, dayChangePct: 0.6, allocationPct: 5.05, conviction: "medium", thesisStatus: "intact", entryDate: "2023-08-22", targetPrice: 3300, stopLoss: 2700, idealWeight: 5.0, broker: "Zerodha", hasAlert: false },
  { ticker: "PIDILITIND", name: "Pidilite Industries", sector: "Consumer", quantity: 62, avgBuyPrice: 2486.4, ltp: 2714.2, currentValue: 168280.4, investedValue: 154156.8, pnl: 14123.6, pnlPct: 9.16, dayChange: 16.8, dayChangePct: 0.62, allocationPct: 3.49, conviction: "low", thesisStatus: "intact", entryDate: "2023-11-06", targetPrice: 2700, stopLoss: 2300, idealWeight: 3.0, broker: "HDFC Securities", hasAlert: false },
];

const DEMO_WATCHLIST = [
  { ticker: "ZOMATO", name: "Zomato", sector: "Consumer Tech", ltp: 224.6, dayChangePct: 2.14, watchedSince: "2024-08-01", notes: "Profitability inflection — monitoring for entry", targetEntry: 190, conviction: "medium" },
  { ticker: "POLYCAB", name: "Polycab India", sector: "Capital Goods", ltp: 5842.3, dayChangePct: 0.84, watchedSince: "2024-09-14", notes: "Premiumisation + infra capex beneficiary", targetEntry: 5200, conviction: "high" },
  { ticker: "LTIM", name: "LTIMindtree", sector: "Technology", ltp: 4682.8, dayChangePct: -0.42, watchedSince: "2024-11-22", notes: "AI-services portfolio — evaluating vs INFY thesis", targetEntry: 4400, conviction: "low" },
  { ticker: "NAUKRI", name: "Info Edge (Naukri)", sector: "Consumer Tech", ltp: 6842.1, dayChangePct: 0.31, watchedSince: "2025-01-08", notes: "Job market recovery + Zomato stake optionality", targetEntry: 6400, conviction: "medium" },
];

const PERFORMANCE_DATA = {
  timeSeries: [
    { date: "2024-07", portfolioValue: 3820000, benchmark: 3720000 },
    { date: "2024-08", portfolioValue: 4012000, benchmark: 3890000 },
    { date: "2024-09", portfolioValue: 3968000, benchmark: 3841000 },
    { date: "2024-10", portfolioValue: 4142000, benchmark: 3980000 },
    { date: "2024-11", portfolioValue: 4284000, benchmark: 4086000 },
    { date: "2024-12", portfolioValue: 4418000, benchmark: 4142000 },
    { date: "2025-01", portfolioValue: 4523000, benchmark: 4214000 },
    { date: "2025-02", portfolioValue: 4382000, benchmark: 4087000 },
    { date: "2025-03", portfolioValue: 4612000, benchmark: 4282000 },
    { date: "2025-04", portfolioValue: 4742000, benchmark: 4386000 },
    { date: "2025-05", portfolioValue: 4814000, benchmark: 4442000 },
    { date: "2025-06", portfolioValue: 4824000, benchmark: 4498000 },
  ],
  attribution: [
    { name: "INFY", contribution: 2.48, reason: "Deal wins + margin expansion" },
    { name: "MARUTI", contribution: 1.43, reason: "Volume recovery + EV optionality" },
    { name: "RELIANCE", contribution: 1.38, reason: "Retail + Jio growth" },
    { name: "ASIANPAINT", contribution: -3.32, reason: "Margin compression + competition" },
    { name: "BAJFINANCE", contribution: 0.31, reason: "NIM pressure partially offset by volume" },
  ],
  metrics: {
    absoluteReturn: 26.4,
    niftyReturn: 21.2,
    alpha: 5.2,
    sharpeRatio: 1.84,
    maxDrawdown: -12.4,
    winRate: 67,
    avgHoldingDays: 482,
    bestMonth: "+8.2% (Oct 2023)",
    worstMonth: "-6.1% (Jan 2022)",
  },
};

// ── GET /portfolio/holdings — demo data always ─────────────────────────────
router.get("/holdings", (_req: Request, res: Response) => {
  res.json(HOLDINGS);
});

// ── GET /portfolio/watchlist ───────────────────────────────────────────────
router.get("/watchlist", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.json(DEMO_WATCHLIST.map((item) => ({
      ...item,
      isDemo: true,
    })));
    return;
  }

  const dbItems = await db
    .select()
    .from(watchlistTable)
    .where(eq(watchlistTable.userId, req.user.id));

  if (dbItems.length === 0) {
    // Return demo items with isDemo flag when the user has no saved items yet
    res.json(DEMO_WATCHLIST.map((item) => ({
      ...item,
      isDemo: true,
      seedHint: "These are demo items — add your first real watchlist item to replace them",
    })));
    return;
  }

  res.json(dbItems.map((item) => ({
    ticker: item.ticker,
    name: item.name,
    sector: item.sector,
    notes: item.notes,
    watchedSince: item.addedAt.toISOString().split("T")[0],
    id: item.id,
    isDemo: false,
  })));
});

// ── POST /portfolio/watchlist ──────────────────────────────────────────────
router.post("/watchlist", async (req: Request, res: Response) => {
  const { ticker, name, sector, notes } = req.body;
  if (!ticker || !name) {
    res.status(400).json({ error: "ticker and name are required" });
    return;
  }

  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in to save watchlist items permanently" });
    return;
  }

  const [item] = await db
    .insert(watchlistTable)
    .values({ userId: req.user.id, ticker: ticker.toUpperCase(), name, sector, notes })
    .onConflictDoNothing()
    .returning();

  res.status(201).json({ ticker: item.ticker, name: item.name, sector: item.sector, notes: item.notes, isDemo: false });
});

// ── DELETE /portfolio/watchlist/:ticker ────────────────────────────────────
router.delete("/watchlist/:ticker", async (req: Request, res: Response) => {
  const ticker = req.params.ticker.toUpperCase();

  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in to manage your watchlist" });
    return;
  }

  await db
    .delete(watchlistTable)
    .where(and(eq(watchlistTable.userId, req.user.id), eq(watchlistTable.ticker, ticker)));

  res.status(204).send();
});

// ── GET /portfolio/performance ─────────────────────────────────────────────
router.get("/performance", (_req: Request, res: Response) => {
  res.json(PERFORMANCE_DATA);
});

// ── GET /portfolio/risk ────────────────────────────────────────────────────
router.get("/risk", (_req: Request, res: Response) => {
  res.json({
    dataSource: "DEMO — connect live portfolio data for real-time risk calculations",
    sectorBreakdown: [
      { sector: "Banking & Finance", weight: 32.6, limit: 35, status: "caution" },
      { sector: "Technology", weight: 21.49, limit: 30, status: "ok" },
      { sector: "Consumer", weight: 21.07, limit: 30, status: "ok" },
      { sector: "Energy", weight: 12.39, limit: 25, status: "ok" },
      { sector: "Auto", weight: 8.95, limit: 15, status: "ok" },
      { sector: "Pharma", weight: 4.17, limit: 15, status: "ok" },
    ],
    marketCapBreakdown: [
      { cap: "Large Cap", weight: 91.8, limit: 100, status: "ok" },
      { cap: "Mid Cap", weight: 4.8, limit: 20, status: "ok" },
      { cap: "Small Cap", weight: 3.4, limit: 20, status: "ok" },
    ],
    riskMetrics: {
      portfolioBeta: 0.92,
      portfolioVolatility: 18.4,
      correlationRisk: "Medium — Tech cluster (INFY/TCS) shows 0.78 correlation",
      concentrationScore: 62,
      liquidityScore: 94,
      varOneDayPct: -2.14,
      varFiveDayPct: -4.82,
    },
    topCorrelatedPairs: [
      { pair: "INFY / TCS", correlation: 0.78, risk: "High" },
      { pair: "HDFCBANK / KOTAKBANK", correlation: 0.71, risk: "Medium" },
      { pair: "BAJFINANCE / HDFCBANK", correlation: 0.64, risk: "Medium" },
    ],
  });
});

// ── GET /portfolio/broker-snapshots ───────────────────────────────────────
router.get("/broker-snapshots", (_req: Request, res: Response) => {
  res.json([
    { broker: "Zerodha", holdingsCount: 8, portfolioValue: 3628526.5, cashBalance: 86420, lastSync: "2025-07-14T09:30:00Z", status: "connected", dataSource: "DEMO" },
    { broker: "HDFC Securities", holdingsCount: 4, portfolioValue: 1024513.2, cashBalance: 41800, lastSync: "2025-07-14T09:15:00Z", status: "demo", dataSource: "DEMO" },
  ]);
});

// ── GET /portfolio/recommendation-history ─────────────────────────────────
router.get("/recommendation-history", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.json({
      entries: DEMO_HISTORY,
      isDemo: true,
      message: "Sign in to view your personal decision journal",
    });
    return;
  }

  const dbEntries = await db
    .select()
    .from(decisionJournalTable)
    .where(eq(decisionJournalTable.userId, req.user.id));

  if (dbEntries.length === 0) {
    res.json({ entries: DEMO_HISTORY, isDemo: true, message: "No journal entries yet — your first entries will appear here" });
    return;
  }

  res.json({ entries: dbEntries, isDemo: false });
});

const DEMO_HISTORY = [
  { id: 1, ticker: "INFY", name: "Infosys", action: "ADD", date: "2025-06-14", rationale: "Strong deal pipeline — FY26 guidance upgrade likely after Q1 beat", outcome: "win", pnl: "+₹28,400", learnings: "Guided by fundamentals, not sentiment" },
  { id: 2, ticker: "ASIANPAINT", name: "Asian Paints", action: "HOLD", date: "2025-05-22", rationale: "Weak quarter but thesis intact long-term. Birla Opus competition being priced in.", outcome: "neutral", pnl: "N/A", learnings: "Should have trimmed on thesis weakening earlier" },
  { id: 3, ticker: "BAJFINANCE", name: "Bajaj Finance", action: "TRIM", date: "2025-04-08", rationale: "NIM guidance cut + macro headwind. Reduced from 15% to 13% allocation.", outcome: "win", pnl: "+₹12,200", learnings: "Act early on thesis change, not after big drawdown" },
  { id: 4, ticker: "POLYCAB", name: "Polycab India", action: "WATCH", date: "2025-03-19", rationale: "Strong infra capex play. Waiting for post-election clarity before entry.", outcome: "N/A", pnl: "N/A", learnings: "" },
  { id: 5, ticker: "MARUTI", name: "Maruti Suzuki", action: "BUY", date: "2025-01-12", rationale: "Volume recovery + EV transition less threatening than feared. Initiating.", outcome: "win", pnl: "+₹31,800", learnings: "Good entry on sector fear = Alpha" },
];

// ── POST /portfolio/recommendation-history (decision journal) ──────────────
router.post("/recommendation-history", async (req: Request, res: Response) => {
  const { ticker, name, action, date, rationale, outcome, pnl, learnings } = req.body;

  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in to save journal entries" });
    return;
  }

  const [entry] = await db
    .insert(decisionJournalTable)
    .values({ userId: req.user.id, ticker, name, action, date: date ?? new Date().toISOString().split("T")[0], rationale, outcome, pnl, learnings })
    .returning();

  res.status(201).json(entry);
});

// ── GET /portfolio/position-sizing ────────────────────────────────────────
router.get("/position-sizing", (_req: Request, res: Response) => {
  res.json({
    dataSource: "DEMO — sizing suggestions based on demo portfolio",
    suggestions: [
      { ticker: "INFY", name: "Infosys", currentWeight: 15.17, idealWeight: 15.0, action: "Hold", conviction: "high", upsidePct: 14.8, safetyMarginPct: 22.4, riskRewardRatio: 2.8, comment: "At ideal weight. Hold." },
      { ticker: "ASIANPAINT", name: "Asian Paints", currentWeight: 11.53, idealWeight: 8.0, action: "Trim 3%", conviction: "medium", upsidePct: 38.0, safetyMarginPct: 9.4, riskRewardRatio: 1.2, comment: "Conviction downgraded. Trim to 8%." },
      { ticker: "BAJFINANCE", name: "Bajaj Finance", currentWeight: 13.41, idealWeight: 11.0, action: "Trim 2%", conviction: "high", upsidePct: 22.8, safetyMarginPct: 10.5, riskRewardRatio: 2.1, comment: "Thesis weakening. Slight trim prudent." },
      { ticker: "KOTAKBANK", name: "Kotak Mahindra Bank", currentWeight: 7.45, idealWeight: 9.0, action: "Add 1.5%", conviction: "medium", upsidePct: 5.6, safetyMarginPct: 15.5, riskRewardRatio: 1.8, comment: "Embargo lifted. Gradual add on dips." },
      { ticker: "POLYCAB", name: "Polycab India (Watch)", currentWeight: 0.0, idealWeight: 3.0, action: "Initiate", conviction: "high", upsidePct: 28.4, safetyMarginPct: 18.2, riskRewardRatio: 3.2, comment: "New entry candidate. Complete research first." },
    ],
  });
});

export default router;
