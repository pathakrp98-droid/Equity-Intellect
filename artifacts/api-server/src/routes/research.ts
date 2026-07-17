import { Router } from "express";

const router = Router();

const COMPANIES: Record<string, any> = {
  HDFCBANK: {
    ticker: "HDFCBANK",
    name: "HDFC Bank",
    sector: "Banking & Finance",
    marketCap: 12_34_820,
    ltp: 1618.75,
    dayChangePct: 0.89,
    pe: 18.4,
    conviction: "high",
    thesisStatus: "intact",
    analystCoverage: "52 analysts — 44 Buy, 6 Hold, 2 Sell",
    lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  RELIANCE: {
    ticker: "RELIANCE",
    name: "Reliance Industries",
    sector: "Energy",
    marketCap: 19_28_400,
    ltp: 2847.3,
    dayChangePct: -0.78,
    pe: 24.8,
    conviction: "high",
    thesisStatus: "intact",
    analystCoverage: "48 analysts — 40 Buy, 6 Hold, 2 Sell",
    lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  INFY: {
    ticker: "INFY",
    name: "Infosys",
    sector: "Technology",
    marketCap: 7_21_840,
    ltp: 1742.5,
    dayChangePct: 1.67,
    pe: 26.4,
    conviction: "high",
    thesisStatus: "intact",
    analystCoverage: "56 analysts — 38 Buy, 14 Hold, 4 Sell",
    lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  TCS: {
    ticker: "TCS",
    name: "Tata Consultancy Services",
    sector: "Technology",
    marketCap: 13_74_200,
    ltp: 3812.4,
    dayChangePct: 1.11,
    pe: 28.6,
    conviction: "high",
    thesisStatus: "intact",
    analystCoverage: "52 analysts — 36 Buy, 12 Hold, 4 Sell",
    lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  BAJFINANCE: {
    ticker: "BAJFINANCE",
    name: "Bajaj Finance",
    sector: "Banking & Finance",
    marketCap: 4_12_240,
    ltp: 6830.5,
    dayChangePct: -1.22,
    pe: 34.2,
    conviction: "medium",
    thesisStatus: "weakening",
    analystCoverage: "44 analysts — 28 Buy, 12 Hold, 4 Sell",
    lastUpdated: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  DMART: {
    ticker: "DMART",
    name: "Avenue Supermarts",
    sector: "Consumer",
    marketCap: 3_07_200,
    ltp: 4724.6,
    dayChangePct: 0.77,
    pe: 98.4,
    conviction: "high",
    thesisStatus: "intact",
    analystCoverage: "36 analysts — 18 Buy, 14 Hold, 4 Sell",
    lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  ASIANPAINT: {
    ticker: "ASIANPAINT",
    name: "Asian Paints",
    sector: "Consumer",
    marketCap: 2_84_200,
    ltp: 2964.3,
    dayChangePct: -0.63,
    pe: 52.4,
    conviction: "medium",
    thesisStatus: "weakening",
    analystCoverage: "42 analysts — 22 Buy, 14 Hold, 6 Sell",
    lastUpdated: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  KOTAKBANK: {
    ticker: "KOTAKBANK",
    name: "Kotak Mahindra Bank",
    sector: "Banking & Finance",
    marketCap: 3_76_200,
    ltp: 1892.6,
    dayChangePct: 0.66,
    pe: 20.4,
    conviction: "medium",
    thesisStatus: "monitoring",
    analystCoverage: "50 analysts — 32 Buy, 14 Hold, 4 Sell",
    lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  MARUTI: {
    ticker: "MARUTI",
    name: "Maruti Suzuki India",
    sector: "Auto",
    marketCap: 3_24_800,
    ltp: 10482.5,
    dayChangePct: 0.95,
    pe: 28.8,
    conviction: "high",
    thesisStatus: "intact",
    analystCoverage: "46 analysts — 36 Buy, 8 Hold, 2 Sell",
    lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  SUNPHARMA: {
    ticker: "SUNPHARMA",
    name: "Sun Pharmaceutical Industries",
    sector: "Pharma",
    marketCap: 3_91_200,
    ltp: 1628.4,
    dayChangePct: 1.38,
    pe: 34.8,
    conviction: "high",
    thesisStatus: "intact",
    analystCoverage: "44 analysts — 38 Buy, 4 Hold, 2 Sell",
    lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  TITAN: {
    ticker: "TITAN",
    name: "Titan Company",
    sector: "Consumer",
    marketCap: 2_85_600,
    ltp: 3214.8,
    dayChangePct: 1.09,
    pe: 88.4,
    conviction: "high",
    thesisStatus: "intact",
    analystCoverage: "40 analysts — 28 Buy, 10 Hold, 2 Sell",
    lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  PIDILITIND: {
    ticker: "PIDILITIND",
    name: "Pidilite Industries",
    sector: "Chemicals",
    marketCap: 1_31_200,
    ltp: 2580.3,
    dayChangePct: 0.74,
    pe: 68.4,
    conviction: "high",
    thesisStatus: "intact",
    analystCoverage: "38 analysts — 28 Buy, 8 Hold, 2 Sell",
    lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
};

const COMPANY_DETAILS: Record<string, any> = {
  INFY: {
    ticker: "INFY",
    name: "Infosys",
    sector: "Technology",
    marketCap: 7_21_840,
    ltp: 1742.5,
    thesis: {
      summary:
        "Infosys is a high-quality large-cap IT services business with improving deal momentum, expanding GenAI competencies, and a strong management team under Salil Parekh. The key thesis is a multi-year IT spending upcycle driven by GenAI-led transformation and cloud adoption among BFSI and retail verticals.",
      bullCase:
        "Revenue growth reaccelerates to 10%+ in FY26 on GenAI-led transformation mandates. Operating margins recover to 22%+ as fresher hiring dominates. Deal TCV sustains above $3.5B per quarter. Multiple re-rating to 32x forward PE.",
      baseCase:
        "Revenue growth of 7-9% in FY26 with stable margins at 20-21%. Deal wins sustain at current pace. Multiple stays in the 26-28x range. Returns driven by earnings growth with modest re-rating.",
      bearCase:
        "US macro slowdown curtails discretionary IT spending. Revenue growth stalls at 4-5%. Margin pressure from wage hikes without offsetting pricing power. De-rating to 20x forward PE as growth premium erodes.",
      conviction: "high",
      keyAssumptions: [
        "US BFSI spending on transformation recovers in CY2025",
        "Operating margins sustain at 20%+ through the cycle",
        "GenAI strategy differentiated enough to drive new deal wins",
        "Management retains ability to renegotiate contracts for pricing",
        "Attrition stays below 14% allowing efficient fresher-driven pyramid",
      ],
      moatRating: "wide",
      managementRating: "excellent",
      updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    valuation: {
      bull: 2100,
      base: 1800,
      bear: 1350,
      currentPrice: 1742.5,
      upside: 3.3,
      methodology: "30x FY26E EPS (base) | 38x bull | 20x bear",
    },
    financialTrends: [
      {
        metric: "Revenue (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [37441, 37933, 38994, 38821, 37923, 39315, 40986, 41764],
        trend: "improving",
        unit: "₹ Cr",
      },
      {
        metric: "EBITDA Margin",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [21.0, 20.8, 21.2, 20.5, 20.7, 21.1, 21.4, 21.6],
        trend: "stable",
        unit: "%",
      },
      {
        metric: "PAT (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [6128, 5945, 6212, 6106, 7975, 6368, 6506, 6806],
        trend: "improving",
        unit: "₹ Cr",
      },
      {
        metric: "EPS (₹)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [14.8, 14.4, 15.1, 14.8, 19.3, 15.4, 15.7, 16.4],
        trend: "improving",
        unit: "₹",
      },
      {
        metric: "Deal TCV ($B)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [2.1, 2.3, 2.4, 3.2, 4.5, 3.4, 3.8, 4.2],
        trend: "improving",
        unit: "$B",
      },
    ],
    technicals: {
      rsi14: 58.4,
      ema50: 1698.4,
      ema200: 1582.6,
      support: 1680,
      resistance: 1780,
      macdSignal: "bullish",
      volumeVsAvg20d: 1.24,
      trend: "uptrend",
    },
    managementCommentary: [
      {
        id: "mc-1",
        quarter: "Q3FY25",
        date: "2025-01-16",
        speaker: "Salil Parekh (CEO)",
        comment:
          "We had a very strong quarter for large deal wins at $4.2B. GenAI-powered transformation is becoming a genuine differentiator with 350+ active GenAI projects. We are raising our FY25 guidance to 4.5-5% constant currency growth.",
        sentiment: "positive",
        tags: ["deal wins", "GenAI", "guidance raise"],
      },
      {
        id: "mc-2",
        quarter: "Q3FY25",
        date: "2025-01-16",
        speaker: "Jayesh Sanghrajka (CFO)",
        comment:
          "Our operating margin for Q3 at 21.6% is within our guidance band of 20-22%. We expect margin improvement in Q4 driven by utilization improvement and fresher ramp. Headcount reduction is largely behind us.",
        sentiment: "positive",
        tags: ["margins", "headcount", "Q4 outlook"],
      },
      {
        id: "mc-3",
        quarter: "Q2FY25",
        date: "2024-10-17",
        speaker: "Salil Parekh (CEO)",
        comment:
          "BFSI vertical remains slightly soft but we see signs of recovery. Manufacturing and energy & utilities are strong. We continue to see high level of client activity in decision making for large transformational programs.",
        sentiment: "neutral",
        tags: ["BFSI", "verticals", "client activity"],
      },
    ],
    catalysts: [
      { id: "cat-infy-1", ticker: "INFY", name: "Infosys", event: "Q4 FY25 Results + FY26 Guidance", date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), impact: "high", probability: "medium", notes: "Key catalyst: FY26 revenue growth guidance" },
      { id: "cat-infy-2", ticker: "INFY", name: "Infosys", event: "Large Deal Pipeline Update", date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), impact: "medium", probability: "high", notes: "Ongoing deal pipeline visibility at analyst day" },
    ],
    invalidationTriggers: [
      { id: "inv-1", trigger: "Revenue growth falls below 3% for two consecutive quarters", severity: "critical", description: "Would suggest structural market share loss and demand destruction beyond cycle", triggered: false },
      { id: "inv-2", trigger: "Operating margin drops below 19% with no recovery guidance", severity: "high", description: "Would indicate pricing pressure and wage inflation beyond management control", triggered: false },
      { id: "inv-3", trigger: "CEO/CFO leadership change without clear succession", severity: "high", description: "Salil Parekh's stability is a key thesis component; unexpected exit would trigger review", triggered: false },
      { id: "inv-4", trigger: "Major US client concentration risk event (>10% client loss)", severity: "critical", description: "Top 10 clients contribute ~30% revenue; loss of anchor client breaks growth thesis", triggered: false },
    ],
    earningsQualityFlags: [
      { id: "eq-1", flag: "CFO/PAT divergence", severity: "green", description: "Cash conversion at 98%+ of PAT — exceptional. No earnings quality concern.", detected: false },
      { id: "eq-2", flag: "DSO trend", severity: "green", description: "Days Sales Outstanding stable at 65-68 days. No receivables build-up.", detected: false },
      { id: "eq-3", flag: "Other income reliance", severity: "amber", description: "Treasury income (₹800-1000 Cr/quarter) contributes ~12% of PAT. Rates-sensitive.", detected: true },
      { id: "eq-4", flag: "Exceptional items", severity: "green", description: "No large one-time charges or gains in last 6 quarters. Clean GAAP earnings.", detected: false },
    ],
    lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  BAJFINANCE: {
    ticker: "BAJFINANCE",
    name: "Bajaj Finance",
    sector: "Banking & Finance",
    marketCap: 4_12_240,
    ltp: 6830.5,
    thesis: {
      summary:
        "Bajaj Finance is India's preeminent consumer NBFC with an unparalleled distribution network across consumer electronics, EMI cards, and digital payments. The thesis rests on sustained cross-sell efficiency, stable NIMs above 10%, and controlled credit costs enabling 25%+ AUM CAGR.",
      bullCase:
        "NIM stabilizes at 10.5%+ in H2 FY26 as funding cost pressures ease with rate cuts. Credit costs revert to 1.35%. AUM growth re-accelerates to 28%+. Multiple re-rates to 40x forward PE.",
      baseCase:
        "NIM compress to 10.0-10.2% over FY26 before recovering. Credit costs elevated at 1.6-1.8%. AUM growth moderates to 22%. Earnings growth at 18-20% — reasonable for current multiple.",
      bearCase:
        "NIM compression persists below 10% on funding cost pressure. Credit cycle turns adverse with credit costs at 2.0%+. AUM growth slows to 15%. Multiple de-rates to 25x forward PE. Thesis review required.",
      conviction: "medium",
      keyAssumptions: [
        "NIM sustains at 10%+ through FY26",
        "Credit costs stay below 1.75% despite new segments",
        "EMI card penetration continues to grow at 25%+",
        "Digital platform (app) retains competitive moat vs banks",
        "No major regulatory intervention on consumer lending",
      ],
      moatRating: "wide",
      managementRating: "excellent",
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    valuation: {
      bull: 9200,
      base: 7800,
      bear: 5400,
      currentPrice: 6830.5,
      upside: 14.2,
      methodology: "3.8x FY26E BV (base) | 4.4x bull | 2.6x bear",
    },
    financialTrends: [
      { metric: "AUM (₹ Cr)", periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"], values: [247379, 261552, 281630, 300684, 330615, 352286, 374539, 393701], trend: "improving", unit: "₹ Cr" },
      { metric: "NIM (%)", periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"], values: [10.8, 10.9, 10.7, 10.6, 10.5, 10.4, 10.2, 10.1], trend: "deteriorating", unit: "%" },
      { metric: "Credit Cost (%)", periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"], values: [1.22, 1.28, 1.34, 1.38, 1.42, 1.48, 1.56, 1.72], trend: "deteriorating", unit: "%" },
      { metric: "PAT (₹ Cr)", periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"], values: [3825, 3825, 4215, 3639, 4420, 3912, 4014, 3842], trend: "stable", unit: "₹ Cr" },
    ],
    technicals: {
      rsi14: 44.2,
      ema50: 7124.5,
      ema200: 7480.2,
      support: 6600,
      resistance: 7200,
      macdSignal: "bearish",
      volumeVsAvg20d: 1.68,
      trend: "downtrend",
    },
    managementCommentary: [
      { id: "mc-baf-1", quarter: "Q3FY25", date: "2025-01-28", speaker: "Rajeev Jain (MD)", comment: "NIM compression is temporary — driven by our conscious mix shift to secured products. We expect NIM to stabilize in Q4 and recover in FY26 as funding costs ease. Credit costs are elevated in rural segments and we are tightening underwriting.", sentiment: "neutral", tags: ["NIM", "credit cost", "rural"] },
      { id: "mc-baf-2", quarter: "Q3FY25", date: "2025-01-28", speaker: "Sandeep Jain (CFO)", comment: "We have raised credit cost guidance to 1.75-1.85% for FY25. This is driven by specific portfolio stress in 2W and rural book. We are cutting disbursements in these segments proactively.", sentiment: "concerning", tags: ["credit cost", "guidance revision", "2W rural"] },
    ],
    catalysts: [
      { id: "cat-baf-1", ticker: "BAJFINANCE", name: "Bajaj Finance", event: "RBI credit card circular clarity", date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(), impact: "high", probability: "medium", notes: "Could unlock co-branded card growth" },
    ],
    invalidationTriggers: [
      { id: "inv-baf-1", trigger: "NIM falls below 9.5% for two consecutive quarters", severity: "critical", description: "Would fundamentally challenge the NBFC business model profitability", triggered: false },
      { id: "inv-baf-2", trigger: "Credit costs rise above 2.2%", severity: "critical", description: "Indicates adverse credit cycle — thesis breaking", triggered: false },
      { id: "inv-baf-3", trigger: "AUM growth slows below 15% YoY", severity: "high", description: "Growth premium collapses; multiple de-rating warranted", triggered: false },
      { id: "inv-baf-4", trigger: "Rajeev Jain exits or significant promoter stake change", severity: "high", description: "Key man risk is significant at Bajaj Finance", triggered: false },
    ],
    earningsQualityFlags: [
      { id: "eq-baf-1", flag: "Provisions below ECL model requirements", severity: "amber", description: "Provision coverage slightly below peers at 62% vs 72%+ for HDFC Bank. Monitor.", detected: true },
      { id: "eq-baf-2", flag: "Yield on AUM compression", severity: "amber", description: "Yield has compressed 40bps in last 4 quarters as mix shifts to secured. Reduces NIM buffer.", detected: true },
      { id: "eq-baf-3", flag: "Opex leverage normalizing", severity: "green", description: "Cost to income ratio stable at 34% — operating leverage intact despite investments.", detected: false },
    ],
    lastUpdated: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
};

const JOURNAL_ENTRIES = [
  { id: "j-1", ticker: "INFY", name: "Infosys", action: "buy", date: "2021-05-18", price: 1456.8, rationale: "Q4FY21 beat + strong deal pipeline. Entry on macro dip. IT upcycle beginning. US tech budgets expanding. First tranche at 8% weight.", emotionalState: "confident", keyFactors: ["Deal TCV at $1.9B — record", "Management guidance raised", "Valuation at 22x FY22E — reasonable"], revisitDate: "2021-08-18", outcome: null },
  { id: "j-2", ticker: "BAJFINANCE", name: "Bajaj Finance", action: "buy", date: "2020-07-10", price: 3820.0, rationale: "Post-COVID dip. Business model intact — consumer credit demand will recover. Management credibility high. Long runway for penetration.", emotionalState: "confident", keyFactors: ["COVID dip overpriced the risk", "AUM growth momentum pre-COVID at 40%+", "Management buyback signal conviction"], revisitDate: "2020-10-10", outcome: "PAT recovered ahead of schedule" },
  { id: "j-3", ticker: "ZOMATO", name: "Zomato", action: "sell", date: "2022-03-08", price: 84.4, rationale: "Grew impatient with cash burn. Unit economics not showing improvement. Swiggy competition heating up. Fear-driven decision in hindsight.", emotionalState: "fearful", keyFactors: ["Monthly cash burn at ₹800Cr+", "No profitability timeline visible", "Market downturn amplifying anxiety"], revisitDate: "2022-09-08", outcome: "Wrong decision — stock 3x from exit" },
  { id: "j-4", ticker: "BAJFINANCE", name: "Bajaj Finance", action: "review", date: "2025-01-28", price: 7284.0, rationale: "Q3 results missed NIM expectations. Credit cost guidance raised to 1.75-1.85%. Conviction downgraded from high to medium. Position trimming being considered.", emotionalState: "anxious", keyFactors: ["NIM at 10.1% vs 10.5% thesis assumption", "Credit cost revision upward", "4 brokerages cut estimates by 8-12%"], revisitDate: "2025-04-28", outcome: null },
];

router.get("/companies", (req, res) => {
  res.json(Object.values(COMPANIES));
});

router.get("/companies/:ticker", (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const detail = COMPANY_DETAILS[ticker];
  if (!detail) {
    const summary = COMPANIES[ticker];
    if (!summary) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    // Return a minimal detail from summary
    res.json({
      ...summary,
      thesis: { summary: "Research pending.", bullCase: "", baseCase: "", bearCase: "", conviction: summary.conviction, keyAssumptions: [], moatRating: "narrow", managementRating: "good", updatedAt: new Date().toISOString() },
      valuation: { bull: 0, base: 0, bear: 0, currentPrice: summary.ltp, upside: 0, methodology: "Pending" },
      financialTrends: [],
      technicals: { rsi14: 50, ema50: summary.ltp, ema200: summary.ltp, support: summary.ltp * 0.9, resistance: summary.ltp * 1.1, macdSignal: "neutral", volumeVsAvg20d: 1.0, trend: "sideways" },
      managementCommentary: [],
      catalysts: [],
      invalidationTriggers: [],
      earningsQualityFlags: [],
      lastUpdated: new Date().toISOString(),
    });
    return;
  }
  res.json(detail);
});

router.get("/decision-journal", (req, res) => {
  res.json(JOURNAL_ENTRIES);
});

router.post("/decision-journal", (req, res) => {
  const entry = { id: `j-${Date.now()}`, ...req.body, outcome: null };
  JOURNAL_ENTRIES.unshift(entry);
  res.status(201).json(entry);
});

export default router;
