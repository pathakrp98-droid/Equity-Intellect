import { Router, type Request, type Response } from "express";
import { db, copilotHistoryTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

// ── Portfolio context injected into every response ────────────────────────
const DEMO_PORTFOLIO_CONTEXT = {
  totalValue: "₹4.82 Cr",
  holdings: 12,
  topHoldings: ["INFY (15.2%)", "BAJFINANCE (13.4%)", "RELIANCE (12.4%)", "HDFCBANK (11.7%)", "ASIANPAINT (11.5%)"],
  sectorBreakdown: "Banking & Finance 32.6%, Technology 21.5%, Consumer 21.1%, Energy 12.4%, Auto 9.0%, Pharma 4.2%",
  alertsActive: 2,
  weakenedThesis: ["BAJFINANCE (NIM compression)", "ASIANPAINT (margin + competition)"],
  cashPct: 2.6,
  dataSource: "DEMO PORTFOLIO — not connected to live broker data",
};

// ── Structured response templates ────────────────────────────────────────
function buildPortfolioAwareResponse(question: string, portfolioContext: typeof DEMO_PORTFOLIO_CONTEXT) {
  const q = question.toLowerCase();

  // Match question intent and tailor the response
  if (q.includes("rbi") || q.includes("rate") || q.includes("interest")) {
    return buildRateResponse(portfolioContext);
  } else if (q.includes("bajaj") || q.includes("bajfinance") || q.includes("nbfc")) {
    return buildBajFinanceResponse(portfolioContext);
  } else if (q.includes("asian paint") || q.includes("asianpaint") || q.includes("paint")) {
    return buildAsianPaintResponse(portfolioContext);
  } else if (q.includes("infy") || q.includes("infosys") || q.includes("it sector") || q.includes("technology")) {
    return buildInfyResponse(portfolioContext);
  } else if (q.includes("risk") || q.includes("drawdown") || q.includes("hedge")) {
    return buildRiskResponse(portfolioContext);
  } else if (q.includes("watchlist") || q.includes("add") || q.includes("buy") || q.includes("initiat")) {
    return buildWatchlistResponse(portfolioContext);
  } else {
    return buildDefaultResponse(portfolioContext);
  }
}

function buildRateResponse(ctx: typeof DEMO_PORTFOLIO_CONTEXT) {
  return {
    answer: `[DATA SOURCE: Demo portfolio + public RBI MPC records]\n\nYour portfolio has ${ctx.sectorBreakdown.split(",")[0]} exposure — the largest single sector. Rate sensitivity analysis:\n\n**HDFC Bank (11.7%)**: High CASA ratio (~42%) provides NIM stability. Rate hold is marginally positive. [VERIFIED: HDFC Bank Q4FY25 analyst presentation]\n\n**Bajaj Finance (13.4%)**: Funding costs lag policy rate by 2–3 quarters. NIM guidance already cut. Rate hold does NOT immediately relieve pressure. [VERIFIED: BAJFINANCE Q4FY25 concall transcript — internal data]\n\n**Kotak Mahindra Bank (7.5%)**: Conservative loan book + post-embargo normalization. Rate environment is supportive. [CONFIDENCE: HIGH]\n\n**Net view**: Your banking & finance exposure is near the 35% sector limit (currently ~32.6%). A rate cut cycle would be disproportionately positive for your book, but current neutral stance is manageable. No immediate action required — Bajaj Finance thesis weakness is earnings-driven, not rate-driven.\n\n⚠️ [UNVERIFIED]: Latest RBI MPC decision post July 2026 — please verify current policy stance independently.`,
    sources: [
      { title: "HDFC Bank Q4FY25 Analyst Presentation", type: "annual_report", url: "#", date: "2025-04-19" },
      { title: "Bajaj Finance Q4FY25 Earnings Call Transcript", type: "concall", url: "#", date: "2025-04-28" },
      { title: "RBI MPC Resolution (most recent in demo data: Feb 2025)", type: "bse_filing", url: "#", date: "2025-02-07" },
      { title: "Demo Portfolio Data — Not Live", type: "internal", url: "#", date: new Date().toISOString().split("T")[0] },
    ],
    thesisImpact: [
      { ticker: "HDFCBANK", name: "HDFC Bank", impact: "neutral", reason: "High CASA protects NIM; rate hold is neutral-to-positive" },
      { ticker: "BAJFINANCE", name: "Bajaj Finance", impact: "negative", reason: "Funding costs lag; NIM thesis remains under pressure independent of rate hold" },
      { ticker: "KOTAKBANK", name: "Kotak Mahindra Bank", impact: "positive", reason: "Conservative book + embargo normalization supports thesis" },
    ],
    convictionChange: null,
    recommendedActions: ["No immediate rate-driven action needed", "Review Bajaj Finance thesis separately (earnings, not rate issue)", "Monitor next MPC for rate cut signal — would be net positive for book"],
  };
}

function buildBajFinanceResponse(ctx: typeof DEMO_PORTFOLIO_CONTEXT) {
  return {
    answer: `[DATA SOURCE: Demo portfolio + public earnings data]\n\nBajaj Finance is your 2nd largest position at 13.4% (₹64.7L estimated value based on demo data).\n\n**Thesis Status**: WEAKENING — NIM compression is the primary concern.\n\n**What changed**: Q4FY25 NIM guidance cut from 10.8% to 10.2%. AUM growth still strong (28% YoY) but spreads narrowing. Credit costs ticking up on unsecured book.\n\n**Bear case trigger**: If AUM growth decelerates below 20% or credit costs exceed 2% of AUM — thesis is broken, not just weakened.\n\n**Current position vs. ideal**: 13.4% vs. 11% ideal weight. Guardian Mode recommendation: Trim 2–2.5% on any bounce towards ₹7,200+.\n\n**What I cannot verify** [UNKNOWN]: Live NIM data for Q1FY26, latest credit cost trends, promoter pledge status, or any post-Jul 2026 corporate actions. These must be checked on BSE/NSE directly.\n\n⚠️ This analysis is based on demo data and historical public filings. Do not trade on AI-generated analysis without verifying live data.`,
    sources: [
      { title: "Bajaj Finance Q4FY25 Concall Transcript", type: "concall", url: "#", date: "2025-04-28" },
      { title: "Bajaj Finance Q3FY25 Analyst Presentation", type: "annual_report", url: "#", date: "2025-01-28" },
      { title: "Demo Portfolio — Position Data (not live)", type: "internal", url: "#", date: new Date().toISOString().split("T")[0] },
    ],
    thesisImpact: [
      { ticker: "BAJFINANCE", name: "Bajaj Finance", impact: "negative", reason: "NIM compression + credit cost uptick challenging core assumptions" },
    ],
    convictionChange: "High → Medium (review needed)",
    recommendedActions: ["Trim position from 13.4% to ~11% on next bounce", "Set thesis break alert: NIM < 10% or credit cost > 2% of AUM", "Review Q1FY26 results before adding back"],
  };
}

function buildAsianPaintResponse(ctx: typeof DEMO_PORTFOLIO_CONTEXT) {
  return {
    answer: `[DATA SOURCE: Demo portfolio + public earnings data]\n\nAsian Paints is your 5th largest position at 11.5% — currently the only position in loss (demo data shows -22.4% unrealized loss).\n\n**Thesis Status**: WEAKENING — margin compression + competitive threat.\n\n**Root cause**: Birla Opus (Aditya Birla Group) launched a credible premium paint brand. Asian Paints' moat is structural but pricing power is being tested. EBITDA margins compressed from 21% (FY22) to ~16% (TTM estimate).\n\n**What's debated**: Is margin normalization temporary (raw material) or structural (competition)? The market is pricing in structural impairment — hence the derating.\n\n**Your average cost**: Demo data shows avg buy price ₹2,986 vs. LTP ₹2,318 — ~22% under water. The question is: is this a thesis break or a price opportunity?\n\n**Guardian Mode view**: At current conviction (Medium), ideal weight is 8–9%. You're at 11.5%. Trim to ideal weight.\n\n[UNKNOWN]: Live margin data for Q1FY26, Birla Opus market share, latest raw material cost trajectory. Verify independently before acting.`,
    sources: [
      { title: "Asian Paints Q4FY25 Earnings Call", type: "concall", url: "#", date: "2025-04-24" },
      { title: "Birla Opus Brand Launch Analysis — Demo Research Note", type: "internal", url: "#", date: "2025-01-15" },
      { title: "Demo Portfolio Position Data", type: "internal", url: "#", date: new Date().toISOString().split("T")[0] },
    ],
    thesisImpact: [
      { ticker: "ASIANPAINT", name: "Asian Paints", impact: "negative", reason: "Structural margin pressure from Birla Opus + raw material costs" },
    ],
    convictionChange: "High → Medium (already reflected in demo)",
    recommendedActions: ["Trim from 11.5% to 8% over next 30 days", "Set thesis break trigger: EBITDA margin < 14% for 2 quarters", "Track Birla Opus market share quarterly"],
  };
}

function buildInfyResponse(ctx: typeof DEMO_PORTFOLIO_CONTEXT) {
  return {
    answer: `[DATA SOURCE: Demo portfolio + public IT sector data]\n\nInfosys is your largest holding at 15.2% — at ideal weight (15%). Thesis: INTACT.\n\n**Why it's working**: AI-led deal wins, margin recovery from FY24 lows, FY26 guidance of 4.5–7% revenue growth in CC terms.\n\n**Key risks to monitor**: (1) US macro slowdown → discretionary IT spend deferral, (2) EUR/USD headwind (30% Europe revenue), (3) Attrition normalization affecting delivery margins.\n\n**Valuation check** [demo data]: Bull ₹2,100 | Base ₹1,742 (current LTP) | Bear ₹1,380 — at base, little upside. Add only on dips to ₹1,580–1,640.\n\n**IT sector view**: TCS (6.3%) + INFY (15.2%) = 21.5% tech exposure — already at comfortable maximum. Do not add further.\n\n[UNKNOWN]: Q1FY26 earnings data, latest deal win disclosures, US client budget cycle status post Jul 2026. Please verify on NSE/BSE.`,
    sources: [
      { title: "Infosys Q4FY25 Earnings and Guidance", type: "concall", url: "#", date: "2025-04-17" },
      { title: "NSE IT Sector Data — Demo Snapshot", type: "nse_data", url: "#", date: new Date().toISOString().split("T")[0] },
      { title: "Demo Portfolio Position", type: "internal", url: "#", date: new Date().toISOString().split("T")[0] },
    ],
    thesisImpact: [
      { ticker: "INFY", name: "Infosys", impact: "positive", reason: "Thesis intact — AI deal pipeline + margin recovery on track" },
      { ticker: "TCS", name: "TCS", impact: "neutral", reason: "Steady compounder, less AI-driven upside catalysts vs INFY near-term" },
    ],
    convictionChange: null,
    recommendedActions: ["Hold INFY at 15% — at ideal weight", "Add only on dips below ₹1,640", "Do not increase IT sector above 25% total"],
  };
}

function buildRiskResponse(ctx: typeof DEMO_PORTFOLIO_CONTEXT) {
  return {
    answer: `[DATA SOURCE: Demo portfolio risk calculations — not live data]\n\n**Portfolio Risk Summary** (demo portfolio, ₹4.82 Cr)\n\n**Concentration**: Max position INFY 15.2% (limit: 20% ✓). Max sector Banking & Finance 32.6% (limit: 35% — caution zone).\n\n**Cash buffer**: 2.6% — BELOW minimum 5% limit. This is flagged in Guardian Mode. Consider raising cash before adding new positions.\n\n**Correlation risk**: INFY/TCS correlation 0.78 — tech cluster creates hidden concentration. Total tech exposure 21.5%.\n\n**Stressed portfolio** (demo calculations):\n- Market correction -20%: Portfolio ≈ -₹96L (-20%)\n- Recession scenario -35%: Portfolio ≈ -₹169L (-35%)\n- Rate hike +100bps: Estimated -₹37L (-7.8%) — Banking/NBFC sector hit\n\n**Key vulnerabilities**: (1) ASIANPAINT unrealized loss ₹1.6L dragging, (2) Bajaj Finance NIM risk, (3) Cash below limit limits response to opportunities.\n\n[UNVERIFIED]: Live option Greeks, actual FII flow, current India VIX, or real-time correlations. All figures are demo approximations.`,
    sources: [
      { title: "Demo Portfolio Risk Model", type: "internal", url: "#", date: new Date().toISOString().split("T")[0] },
      { title: "SEBI Stress Test Guidelines — Public", type: "nse_data", url: "#", date: "2025-03-01" },
    ],
    thesisImpact: [
      { ticker: "ASIANPAINT", name: "Asian Paints", impact: "negative", reason: "Largest unrealized loss, weakening thesis — primary risk contributor" },
      { ticker: "BAJFINANCE", name: "Bajaj Finance", impact: "negative", reason: "NIM risk + sector concentration — secondary risk" },
    ],
    convictionChange: null,
    recommendedActions: ["Raise cash to 5%+ before adding positions (sell ASIANPAINT trim)", "Avoid adding to Banking & Finance (approaching 35% limit)", "Review INFY/TCS as pair — reduce TCS if adding elsewhere in tech"],
  };
}

function buildWatchlistResponse(ctx: typeof DEMO_PORTFOLIO_CONTEXT) {
  return {
    answer: `[DATA SOURCE: Demo portfolio + watchlist]\n\nYour current watchlist (demo): Zomato, Polycab India, LTIMindtree, Info Edge (Naukri).\n\n**New position capacity**: Cash at 2.6% (below 5% minimum). Guardian Mode will flag any new entry until cash is replenished.\n\n**Best-positioned watchlist candidate** (demo view): Polycab India — strong capex cycle tailwind, premium cable/wire + EPC mix, pricing power intact. However: research completeness score is 30/100 for this watchlist item — you need to complete a full thesis before Guardian Mode approves entry.\n\n**Pre-trade checklist required** for any new initiation:\n1. Why now? What has changed?\n2. Bear case with specific triggers\n3. Price target with DCF or PE methodology\n4. Thesis invalidation conditions\n5. Maximum acceptable loss %\n\nComplete this in Research Terminal before executing.\n\n[UNVERIFIED]: Live prices, recent filings, broker recommendations, or analyst targets for watchlist names.`,
    sources: [
      { title: "Demo Watchlist Data", type: "internal", url: "#", date: new Date().toISOString().split("T")[0] },
      { title: "Polycab India FY25 Annual Report (Demo)", type: "annual_report", url: "#", date: "2025-05-28" },
    ],
    thesisImpact: [],
    convictionChange: null,
    recommendedActions: ["Complete Polycab research before entry (score: 30/100)", "Raise portfolio cash to 5%+ before new position", "Run Guardian Mode check before any new initiation"],
  };
}

function buildDefaultResponse(ctx: typeof DEMO_PORTFOLIO_CONTEXT) {
  return {
    answer: `[DATA SOURCE: Demo portfolio analysis — not connected to live data]\n\nBased on your demo portfolio (${ctx.totalValue}, ${ctx.holdings} holdings), here is a structured assessment:\n\n**Portfolio Status**: ${ctx.alertsActive} active alerts. Weakening thesis on: ${ctx.weakenedThesis.join(", ")}.\n\n**Thesis Integrity**: 2 positions weakening, 0 thesis breaks. Overall thesis integrity is reasonable but banking & finance sector concentration (32.6%) is approaching the 35% limit.\n\n**Cash Position**: ${ctx.cashPct}% — below the 5% minimum buffer. Guardian Mode flags this as a soft limit breach. Avoid adding new positions until cash is replenished.\n\n**Key considerations**:\n1. Largest winners (INFY, RELIANCE, MARUTI) are at or near ideal weights — hold\n2. ASIANPAINT and BAJFINANCE both have weakening thesis — trim to ideal weight\n3. Tech cluster (INFY + TCS = 21.5%) creating hidden correlation — manage as a pair\n\n**What I cannot verify** [UNKNOWN]: Any market data, filings, news, or corporate actions after July 2026. Please verify all current data independently on BSE/NSE.\n\n⚠️ All analysis is based on demo data and public historical filings. This is not financial advice.`,
    sources: [
      { title: "Demo Portfolio Holdings", type: "internal", url: "#", date: new Date().toISOString().split("T")[0] },
      { title: "NSE India Market Data (Demo Snapshot — Jul 2025)", type: "nse_data", url: "#", date: "2025-07-14" },
      { title: "Public BSE Filings (Demo References)", type: "bse_filing", url: "#", date: "2025-07-01" },
    ],
    thesisImpact: [
      { ticker: "INFY", name: "Infosys", impact: "positive", reason: "Thesis intact, AI deal pipeline growing" },
      { ticker: "BAJFINANCE", name: "Bajaj Finance", impact: "negative", reason: "NIM compression challenging core thesis" },
      { ticker: "ASIANPAINT", name: "Asian Paints", impact: "negative", reason: "Margin erosion + competitive pressure" },
    ],
    convictionChange: null,
    recommendedActions: [
      "Trim ASIANPAINT to 8% and BAJFINANCE to 11%",
      "Raise cash buffer to minimum 5%",
      "No new positions until Guardian Mode pre-trade checklist is complete",
    ],
  };
}

// ── POST /copilot/query ────────────────────────────────────────────────────
router.post("/query", async (req: Request, res: Response) => {
  const { question } = req.body;
  if (!question) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  const portfolioContext = DEMO_PORTFOLIO_CONTEXT;
  const responseData = buildPortfolioAwareResponse(question, portfolioContext);

  const response = {
    id: `resp-${Date.now()}`,
    question,
    ...responseData,
    timestamp: new Date().toISOString(),
  };

  // Persist to DB if authenticated
  if (req.isAuthenticated()) {
    await db.insert(copilotHistoryTable).values({
      userId: req.user.id,
      role: "user",
      content: question,
    });
    await db.insert(copilotHistoryTable).values({
      userId: req.user.id,
      role: "assistant",
      content: response.answer.substring(0, 200) + "...",
      responseData: response as unknown as Record<string, unknown>,
    });
  }

  res.json(response);
});

// ── GET /copilot/history ──────────────────────────────────────────────────
router.get("/history", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    // Return seeded demo history for unauthenticated users
    res.json(DEMO_HISTORY);
    return;
  }

  const dbMessages = await db
    .select()
    .from(copilotHistoryTable)
    .where(eq(copilotHistoryTable.userId, req.user.id))
    .orderBy(desc(copilotHistoryTable.createdAt))
    .limit(50);

  if (dbMessages.length === 0) {
    res.json(DEMO_HISTORY);
    return;
  }

  res.json(
    dbMessages.reverse().map((m) => ({
      id: String(m.id),
      role: m.role,
      content: m.content,
      timestamp: m.createdAt.toISOString(),
      response: m.responseData ?? null,
    })),
  );
});

const DEMO_HISTORY = [
  {
    id: "demo-1",
    role: "user",
    content: "What is the impact of the RBI rate decision on my banking holdings?",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    response: null,
  },
  {
    id: "demo-2",
    role: "assistant",
    content: "[DATA SOURCE: Demo portfolio + public RBI MPC records] Your banking exposure is 32.6% of portfolio. Rate hold is neutral for NIMs near-term. Key risk for Bajaj Finance is funding cost, not repo rate directly...",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 5000).toISOString(),
    response: {
      id: "resp-demo-1",
      question: "What is the impact of the RBI rate decision on my banking holdings?",
      answer: "[DATA SOURCE: Demo portfolio] Your banking exposure is 32.6%...",
      sources: [{ title: "Demo Data — Not Live", type: "internal", url: "#", date: "2025-07-14" }],
      thesisImpact: [],
      convictionChange: null,
      recommendedActions: ["No immediate action needed"],
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 5000).toISOString(),
    },
  },
];

export default router;
