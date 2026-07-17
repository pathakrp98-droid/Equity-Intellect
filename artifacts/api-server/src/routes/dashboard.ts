import { Router } from "express";

const router = Router();

router.get("/summary", (req, res) => {
  res.json({
    portfolioValue: 4_82_35_000,
    dailyPnl: 2_18_500,
    dailyPnlPct: 0.46,
    overallPnl: 98_45_000,
    overallPnlPct: 25.63,
    cashBalance: 12_50_000,
    investedValue: 4_69_85_000,
    numberOfHoldings: 12,
    convictionChanges: [
      {
        ticker: "BAJFINANCE",
        name: "Bajaj Finance",
        previousConviction: "high",
        newConviction: "medium",
        reason: "NIM compression concerns post Q3 results; credit cost guidance raised",
        changedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        ticker: "ZOMATO",
        name: "Zomato",
        previousConviction: "medium",
        newConviction: "high",
        reason: "Blinkit profitability ahead of expectations; GOV growth accelerating",
        changedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    sectorAllocation: [
      { sector: "Banking & Finance", allocationPct: 28.4, value: 1_37_15_000 },
      { sector: "Technology", allocationPct: 22.1, value: 1_06_75_000 },
      { sector: "Consumer", allocationPct: 16.8, value: 81_10_000 },
      { sector: "Energy", allocationPct: 12.3, value: 59_38_500 },
      { sector: "Pharma", allocationPct: 8.6, value: 41_52_100 },
      { sector: "Auto", allocationPct: 7.2, value: 34_76_700 },
      { sector: "Chemicals", allocationPct: 4.6, value: 22_21_600 },
    ],
    lastUpdated: new Date().toISOString(),
  });
});

router.get("/alerts", (req, res) => {
  res.json([
    {
      id: "alert-1",
      ticker: "BAJFINANCE",
      name: "Bajaj Finance",
      alertType: "earnings_cut",
      severity: "high",
      headline: "Q3 PAT estimates cut by 8–12% across brokerages after NIM miss",
      detail:
        "Net interest margin at 10.1% vs 10.6% guided. Credit cost revised upward from 1.45% to 1.75%. Four brokerages (Kotak, HDFC, Axis, Nomura) have cut FY25 PAT estimates by 8–12%. Thesis assumption of NIM stability at 10.5%+ now under question.",
      source: "BSE Filing + Brokerage Reports",
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      dismissed: false,
    },
    {
      id: "alert-2",
      ticker: "ASIANPAINT",
      name: "Asian Paints",
      alertType: "margin_deterioration",
      severity: "high",
      headline: "EBITDA margin contracts 180bps YoY due to crude-linked RM inflation",
      detail:
        "EBITDA margin at 18.2% vs 20.0% in Q3FY24. Raw material costs up 7.3% QoQ. Volume growth at 5% missed 8% estimate. Competition from Birla Opus intensifying in Tier-2 markets. Revisit pricing power thesis.",
      source: "Q3FY25 Results Concall",
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      dismissed: false,
    },
    {
      id: "alert-3",
      ticker: "HDFCBANK",
      name: "HDFC Bank",
      alertType: "pledge_increase",
      severity: "medium",
      headline: "Promoter entity pledging disclosed in latest shareholding pattern",
      detail:
        "HDFC Ltd (post-merger entity) has pledged 0.8% of shares as collateral. While absolute quantum is small, first instance of promoter-level pledge since merger. Monitor for any escalation.",
      source: "NSE Shareholding Pattern Filing",
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      dismissed: false,
    },
  ]);
});

router.get("/overnight-markets", (req, res) => {
  res.json([
    { name: "S&P 500", value: 5248.3, change: 18.6, changePct: 0.36, region: "US", asOf: "NYSEClose" },
    { name: "Dow Jones", value: 39_127.4, change: -42.1, changePct: -0.11, region: "US", asOf: "NYSEClose" },
    { name: "Nasdaq", value: 16_432.5, change: 87.3, changePct: 0.53, region: "US", asOf: "NYSEClose" },
    { name: "FTSE 100", value: 8_234.7, change: -15.2, changePct: -0.18, region: "UK", asOf: "LSEClose" },
    { name: "Nikkei 225", value: 38_947.2, change: 312.8, changePct: 0.81, region: "Japan", asOf: "TSEClose" },
    { name: "Hang Seng", value: 17_214.6, change: -88.4, changePct: -0.51, region: "HK", asOf: "HKEXClose" },
    { name: "Shanghai", value: 3_087.5, change: 14.2, changePct: 0.46, region: "China", asOf: "SSEClose" },
    { name: "DAX", value: 18_156.3, change: 52.7, changePct: 0.29, region: "Germany", asOf: "FSEClose" },
    { name: "SGX Nifty", value: 22_418.0, change: 45.0, changePct: 0.2, region: "Singapore", asOf: "SGXFutures" },
  ]);
});

router.get("/india-macro", (req, res) => {
  res.json([
    { name: "CPI Inflation", value: 5.1, unit: "%", trend: "down", previousValue: 5.4, asOf: "Jan 2025" },
    { name: "RBI Repo Rate", value: 6.5, unit: "%", trend: "flat", previousValue: 6.5, asOf: "Feb 2025 MPC" },
    { name: "GDP Growth", value: 8.4, unit: "% YoY", trend: "up", previousValue: 7.6, asOf: "Q3 FY24" },
    { name: "INR/USD", value: 83.42, unit: "₹", trend: "down", previousValue: 83.15, asOf: "15 Jul 2025" },
    { name: "10Y G-Sec", value: 7.08, unit: "%", trend: "flat", previousValue: 7.12, asOf: "15 Jul 2025" },
    { name: "FII Flows (MTD)", value: 4823, unit: "₹ Cr", trend: "up", previousValue: -1240, asOf: "Jul 2025" },
    { name: "DII Flows (MTD)", value: 6341, unit: "₹ Cr", trend: "up", previousValue: 5120, asOf: "Jul 2025" },
    { name: "WPI Inflation", value: 2.8, unit: "%", trend: "up", previousValue: 2.4, asOf: "Dec 2024" },
    { name: "Nifty P/E", value: 22.4, unit: "x", trend: "flat", previousValue: 22.1, asOf: "15 Jul 2025" },
  ]);
});

router.get("/top-actions", (req, res) => {
  res.json([
    {
      id: "action-1",
      ticker: "INFY",
      name: "Infosys",
      action: "add",
      rationale: "Deal wins accelerating post Q3; management guidance raised. Trading at 5% discount to 5Y avg PE. Stage 2nd tranche.",
      priority: "high",
      source: "Internal Research",
      suggestedPrice: 1742.5,
    },
    {
      id: "action-2",
      ticker: "BAJFINANCE",
      name: "Bajaj Finance",
      action: "review",
      rationale: "NIM miss and credit cost revision threaten thesis. Convene conviction review before next tranche.",
      priority: "high",
      source: "Alert Triggered",
      suggestedPrice: null,
    },
    {
      id: "action-3",
      ticker: "DMART",
      name: "Avenue Supermarts",
      action: "trim",
      rationale: "Position at 9.8% — above ideal 8% weight cap. Trim 1% at ₹4,850+ to rebalance. Near-term risk from quick commerce disruption.",
      priority: "medium",
      source: "Rebalancing Rule",
      suggestedPrice: 4850,
    },
    {
      id: "action-4",
      ticker: "SUNPHARMA",
      name: "Sun Pharmaceutical",
      action: "buy",
      rationale: "US specialty business beating expectations; Ilumya royalties growing. Under-owned in portfolio at 4.2%. Initiate 2nd stage.",
      priority: "medium",
      source: "Portfolio Construction",
      suggestedPrice: 1628.0,
    },
    {
      id: "action-5",
      ticker: "KOTAKBANK",
      name: "Kotak Mahindra Bank",
      action: "hold",
      rationale: "Digital embargo lifted. Monitoring credit growth recovery. No action until Q4 results.",
      priority: "low",
      source: "Monitoring",
      suggestedPrice: null,
    },
  ]);
});

router.get("/catalysts", (req, res) => {
  res.json([
    {
      id: "cat-1",
      ticker: "RELIANCE",
      name: "Reliance Industries",
      event: "Jio Financial Services results + potential re-rating",
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      impact: "high",
      probability: "high",
      notes: "NBFC license activation + AUM growth could trigger re-rating of JFS stake",
    },
    {
      id: "cat-2",
      ticker: "INFY",
      name: "Infosys",
      event: "Q4 FY25 Results + FY26 Guidance",
      date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      impact: "high",
      probability: "medium",
      notes: "Key catalyst: FY26 revenue growth guidance. Mgmt indicated 8–10% organic growth possible.",
    },
    {
      id: "cat-3",
      ticker: "BAJFINANCE",
      name: "Bajaj Finance",
      event: "RBI credit card circular clarity",
      date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
      impact: "high",
      probability: "medium",
      notes: "Regulatory clarity on credit card co-branding norms could unlock EMI card growth",
    },
    {
      id: "cat-4",
      ticker: "TITAN",
      name: "Titan Company",
      event: "Jewellery SSSG for Q4",
      date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      impact: "medium",
      probability: "high",
      notes: "Wedding season + gold price tailwind should drive strong Q4 SSSG. Positive for thesis.",
    },
    {
      id: "cat-5",
      ticker: "SUNPHARMA",
      name: "Sun Pharmaceutical",
      event: "USFDA inspection outcome for Halol plant",
      date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      impact: "medium",
      probability: "medium",
      notes: "Halol re-inspection ongoing. Clean EIR would unlock new product approvals.",
    },
  ]);
});

export default router;
