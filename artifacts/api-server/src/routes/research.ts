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
  HDFCBANK: {
    ticker: "HDFCBANK",
    name: "HDFC Bank",
    sector: "Banking & Finance",
    marketCap: 12_34_820,
    ltp: 1618.75,
    thesis: {
      summary:
        "HDFC Bank is India's largest private sector bank by assets, with a best-in-class liability franchise, superior asset quality, and industry-leading return ratios. The merger with HDFC Ltd creates a full-service financial conglomerate with unmatched distribution and cross-sell opportunity. The thesis rests on NIM stabilization, loan growth re-acceleration, and operating leverage as merger integration matures.",
      bullCase:
        "Loan growth re-accelerates to 18%+ in FY26 as HDFC Ltd book runs off legacy high-cost borrowings. NIM recovers to 3.8%+ on CD ratio normalization. ROA reaches 2.0% with credit costs stable at 0.5%. Multiple re-rates to 3.3x ABV as integration premium is recognized.",
      baseCase:
        "Loan growth sustains at 14-16% in FY26. NIM stabilizes at 3.5-3.6%. Credit costs remain controlled at 0.55-0.65%. ROA at 1.8-1.9%. Book value growth of 16% annually supports base case return of 15-18%.",
      bearCase:
        "Merger integration drags longer than expected — NIM stays depressed at 3.2% on legacy HDFC borrowings. Unsecured credit cycle turns with credit costs rising to 0.9%+. Loan growth slows to 10-12%. De-rating to 2.0x ABV on ROA concerns.",
      conviction: "high",
      keyAssumptions: [
        "CD ratio normalizes to 85-87% over FY26 from current 110%+",
        "NIM recovery of 20-30bps over 6-8 quarters post merger",
        "Credit costs stay below 0.7% through the cycle",
        "HDFC Ltd legacy book runs off without adverse surprises",
        "RBI regulatory environment remains stable for large private banks",
      ],
      moatRating: "wide",
      managementRating: "excellent",
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    valuation: {
      bull: 1900,
      base: 1700,
      bear: 1350,
      currentPrice: 1618.75,
      upside: 5.0,
      methodology: "3.3x FY26E ABV (base) | 3.7x bull | 2.6x bear",
    },
    financialTrends: [
      {
        metric: "Net Interest Income (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [23352, 27869, 27385, 28471, 29077, 29837, 30114, 30651],
        trend: "improving",
        unit: "₹ Cr",
      },
      {
        metric: "NIM (%)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [4.1, 3.6, 3.65, 3.6, 3.63, 3.62, 3.46, 3.43],
        trend: "stable",
        unit: "%",
      },
      {
        metric: "PAT (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [12047, 11952, 15976, 16373, 16512, 16175, 16821, 17657],
        trend: "improving",
        unit: "₹ Cr",
      },
      {
        metric: "GNPA (%)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [1.12, 1.17, 1.34, 1.26, 1.24, 1.33, 1.36, 1.42],
        trend: "stable",
        unit: "%",
      },
    ],
    technicals: {
      rsi14: 54.2,
      ema50: 1594.3,
      ema200: 1548.7,
      support: 1570,
      resistance: 1680,
      macdSignal: "bullish",
      volumeVsAvg20d: 1.12,
      trend: "uptrend",
    },
    managementCommentary: [
      {
        id: "mc-hdfc-1",
        quarter: "Q3FY25",
        date: "2025-01-22",
        speaker: "Srinivasan Vaidyanathan (CFO)",
        comment:
          "Our NIM at 3.43% reflects the ongoing normalization of the merged entity's liability book. We expect NIM to gradually recover as high-cost HDFC Ltd borrowings mature over the next 6-8 quarters. Loan growth is healthy at 15.4% YoY and we are focused on CD ratio optimization.",
        sentiment: "neutral",
        tags: ["NIM", "merger", "loan growth"],
      },
      {
        id: "mc-hdfc-2",
        quarter: "Q3FY25",
        date: "2025-01-22",
        speaker: "Sashidhar Jagdishan (MD & CEO)",
        comment:
          "The merger integration is progressing well. Cross-sell of mortgages to our existing liability customers is a significant medium-term opportunity. Asset quality remains pristine with GNPA at 1.42% — well within our comfort zone.",
        sentiment: "positive",
        tags: ["integration", "cross-sell", "asset quality"],
      },
      {
        id: "mc-hdfc-3",
        quarter: "Q2FY25",
        date: "2024-10-19",
        speaker: "Sashidhar Jagdishan (MD & CEO)",
        comment:
          "We have consciously moderated loan growth to focus on deposit mobilization and CD ratio improvement. This is a deliberate calibration. Once CD ratio is comfortable, we will re-accelerate loan growth in FY26.",
        sentiment: "neutral",
        tags: ["loan growth", "deposits", "CD ratio"],
      },
    ],
    catalysts: [
      { id: "cat-hdfc-1", ticker: "HDFCBANK", name: "HDFC Bank", event: "Q4 FY25 Results + NIM trajectory", date: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(), impact: "high", probability: "high", notes: "Key watch: NIM recovery signal and FY26 loan growth guidance" },
      { id: "cat-hdfc-2", ticker: "HDFCBANK", name: "HDFC Bank", event: "RBI repo rate cut transmission", date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), impact: "medium", probability: "medium", notes: "Rate cut would ease liability cost and aid NIM recovery" },
    ],
    invalidationTriggers: [
      { id: "inv-hdfc-1", trigger: "NIM falls below 3.2% for two consecutive quarters", severity: "critical", description: "Would indicate structural funding cost disadvantage post-merger — thesis breaking", triggered: false },
      { id: "inv-hdfc-2", trigger: "GNPA rises above 2.0% with credit cost exceeding 0.9%", severity: "high", description: "Asset quality deterioration would break the premium valuation thesis", triggered: false },
      { id: "inv-hdfc-3", trigger: "Loan growth below 10% for two quarters without management guidance improvement", severity: "high", description: "Growth engine stalling would require full thesis revaluation", triggered: false },
    ],
    earningsQualityFlags: [
      { id: "eq-hdfc-1", flag: "Treasury income contribution", severity: "green", description: "Core NII dominates earnings — treasury < 8% of total income. High quality earnings base.", detected: false },
      { id: "eq-hdfc-2", flag: "Provision coverage ratio", severity: "green", description: "PCR at 72%+ — well above RBI norms. Conservative provisioning approach.", detected: false },
      { id: "eq-hdfc-3", flag: "HDFC Ltd legacy NPA migration", severity: "amber", description: "Some slippage from legacy HDFC Ltd mortgage book possible as merger NPA classification aligns.", detected: true },
    ],
    lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  RELIANCE: {
    ticker: "RELIANCE",
    name: "Reliance Industries",
    sector: "Energy",
    marketCap: 19_28_400,
    ltp: 2847.3,
    thesis: {
      summary:
        "Reliance Industries is a vertically integrated conglomerate spanning O2C, Retail, and Telecom with growing new energy ambitions. The thesis is a sum-of-parts re-rating story where Jio Platforms and Reliance Retail each have the potential to be valued as standalone businesses at significant premiums. The ongoing new energy capex cycle could unlock a fourth growth vector.",
      bullCase:
        "Jio Financial Services gets NBFC license and AUM ramp triggers significant re-rating. Reliance Retail EBITDA crosses ₹25,000 Cr in FY26. O2C margin recovery on global refining cycle. New energy projects begin generating returns. SoP target of ₹3,400 achievable.",
      baseCase:
        "Jio ARPU reaches ₹250+ on tariff hikes. Retail continues 20%+ revenue growth. O2C margins stable. New energy capex peak. Blended EBITDA growth of 15-18% drives base case ₹3,000 target at 12x EV/EBITDA.",
      bearCase:
        "O2C margins compress on weak petrochemical cycle. Jio ARPU growth disappoints on competitive intensity. Retail growth moderates to 12-15%. New energy capex without returns creates balance sheet risk. De-rating to 8x EV/EBITDA.",
      conviction: "high",
      keyAssumptions: [
        "Jio ARPU reaches ₹230-250 by FY26 on tariff hikes",
        "Reliance Retail EBITDA margin improves to 8%+ on scale",
        "New energy capex is disciplined and returns become visible by FY27",
        "O2C GRM stays at $9-10/bbl through the cycle",
        "Jio Financial Services gets regulatory approvals and scales",
      ],
      moatRating: "wide",
      managementRating: "excellent",
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    valuation: {
      bull: 3400,
      base: 3000,
      bear: 2300,
      currentPrice: 2847.3,
      upside: 5.4,
      methodology: "12x FY26E EV/EBITDA (base) | 14x bull | 8x bear",
    },
    financialTrends: [
      {
        metric: "Revenue (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [221152, 208668, 231993, 240536, 226735, 257490, 241440, 243004],
        trend: "stable",
        unit: "₹ Cr",
      },
      {
        metric: "EBITDA (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [41718, 43197, 43934, 45068, 43931, 48135, 46918, 48003],
        trend: "improving",
        unit: "₹ Cr",
      },
      {
        metric: "PAT (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [19299, 16011, 17394, 17265, 18948, 15138, 16563, 18540],
        trend: "stable",
        unit: "₹ Cr",
      },
    ],
    technicals: {
      rsi14: 48.6,
      ema50: 2892.4,
      ema200: 2956.8,
      support: 2780,
      resistance: 2960,
      macdSignal: "bearish",
      volumeVsAvg20d: 0.94,
      trend: "sideways",
    },
    managementCommentary: [
      {
        id: "mc-rel-1",
        quarter: "Q3FY25",
        date: "2025-01-31",
        speaker: "Mukesh Ambani (CMD)",
        comment:
          "Our new energy business is on track — we have committed ₹75,000 Cr investment in green energy and are on schedule. Jio's 5G rollout is complete across India and monetization through fixed wireless access is beginning. Retail is expanding into new categories and geographies.",
        sentiment: "positive",
        tags: ["new energy", "5G", "retail"],
      },
      {
        id: "mc-rel-2",
        quarter: "Q3FY25",
        date: "2025-01-31",
        speaker: "V. Srikanth (CFO)",
        comment:
          "O2C segment saw margin compression due to softer global petchem cycle. However, our integrated model provides resilience. Net debt is managed at comfortable levels. Retail EBITDA margin improving sequentially on operating leverage.",
        sentiment: "neutral",
        tags: ["O2C", "margins", "debt"],
      },
    ],
    catalysts: [
      { id: "cat-rel-1", ticker: "RELIANCE", name: "Reliance Industries", event: "Jio Financial Services AUM milestone", date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), impact: "high", probability: "medium", notes: "JFS AUM growth and product launch could trigger SoP re-rating" },
      { id: "cat-rel-2", ticker: "RELIANCE", name: "Reliance Industries", event: "New Energy project commissioning", date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), impact: "medium", probability: "medium", notes: "First green hydrogen or solar manufacturing milestone could unlock valuation" },
    ],
    invalidationTriggers: [
      { id: "inv-rel-1", trigger: "O2C EBITDA margin falls below 8% for two consecutive quarters", severity: "high", description: "Structural weakness in petchem cycle would reduce SoP significantly", triggered: false },
      { id: "inv-rel-2", trigger: "Jio ARPU growth stalls below ₹200 on competitive pricing pressure", severity: "critical", description: "Telecom thesis breaks — Jio re-rating reverses", triggered: false },
      { id: "inv-rel-3", trigger: "New energy capex overrun exceeds 50% of committed budget", severity: "high", description: "Capital allocation discipline would be questioned; balance sheet risk rises", triggered: false },
    ],
    earningsQualityFlags: [
      { id: "eq-rel-1", flag: "Retail revenue recognition", severity: "green", description: "Retail revenue is primarily consumption-based with high repeat purchase rate. Quality is high.", detected: false },
      { id: "eq-rel-2", flag: "Depreciation on new energy capex", severity: "amber", description: "New energy assets are being capitalized; depreciation drag will increase in FY27-28 as projects go live.", detected: true },
      { id: "eq-rel-3", flag: "Inter-segment eliminations", severity: "green", description: "Intra-group transactions are properly eliminated. Standalone financials align with consolidated.", detected: false },
    ],
    lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  TCS: {
    ticker: "TCS",
    name: "Tata Consultancy Services",
    sector: "Technology",
    marketCap: 13_74_200,
    ltp: 3812.4,
    thesis: {
      summary:
        "TCS is India's largest IT services company and a global top-5 player, with a unique full-stack capability spanning consulting, cloud, and AI. The thesis is a steady-growth compounder driven by multi-year digital transformation spending from global enterprises, with best-in-class capital allocation returning ~100% FCF to shareholders.",
      bullCase:
        "Global IT spending upcycle drives revenue growth to 12%+ in FY26. BFSI and retail verticals recover strongly. Operating margins reach 26%+ on operating leverage and AI-driven efficiency. Multiple re-rates to 36x forward PE on premium quality compounding.",
      baseCase:
        "Revenue growth of 8-10% in FY26 as deal wins convert. Margins stable at 24-25%. EPS growth of 10-12% annually. Multiple stays at 28-32x forward PE. FCF yield of 3% provides return floor.",
      bearCase:
        "US recession and tech sector spending freeze reduces revenue growth to 3-4%. Margins compress to 22-23% on fixed cost deleverage. De-rating to 22x PE as growth premium erodes. EPS cuts of 15-20% across street.",
      conviction: "high",
      keyAssumptions: [
        "BFSI vertical spending recovers to 8-10% growth by H1 FY26",
        "GenAI augments rather than cannibalizes services revenue",
        "Operating margins sustain at 24%+ through the cycle",
        "Deal TCV sustains above $8B quarterly",
        "Dividend payout + buyback returns 100% FCF annually",
      ],
      moatRating: "wide",
      managementRating: "excellent",
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    valuation: {
      bull: 4600,
      base: 4000,
      bear: 3100,
      currentPrice: 3812.4,
      upside: 4.9,
      methodology: "32x FY26E EPS (base) | 37x bull | 25x bear",
    },
    financialTrends: [
      {
        metric: "Revenue (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [59162, 59381, 59692, 60583, 61237, 62613, 63974, 63973],
        trend: "improving",
        unit: "₹ Cr",
      },
      {
        metric: "EBIT Margin (%)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [24.5, 24.2, 24.3, 24.5, 24.5, 24.7, 24.6, 24.5],
        trend: "stable",
        unit: "%",
      },
      {
        metric: "PAT (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [11392, 11074, 11342, 11058, 12434, 12040, 11909, 12380],
        trend: "improving",
        unit: "₹ Cr",
      },
    ],
    technicals: {
      rsi14: 56.8,
      ema50: 3742.6,
      ema200: 3612.4,
      support: 3720,
      resistance: 3920,
      macdSignal: "bullish",
      volumeVsAvg20d: 1.08,
      trend: "uptrend",
    },
    managementCommentary: [
      {
        id: "mc-tcs-1",
        quarter: "Q3FY25",
        date: "2025-01-09",
        speaker: "K. Krithivasan (CEO)",
        comment:
          "Our deal TCV for Q3 was $10.2B — a record. The pipeline is strong across all verticals. GenAI opportunities are materializing into real contracts and we have over 600 AI and GenAI engagements. We remain confident of revenue growth acceleration in FY26.",
        sentiment: "positive",
        tags: ["deal TCV", "GenAI", "pipeline"],
      },
      {
        id: "mc-tcs-2",
        quarter: "Q3FY25",
        date: "2025-01-09",
        speaker: "Samir Seksaria (CFO)",
        comment:
          "Our EBIT margin at 24.5% reflects our consistent focus on operational efficiency. We expect margins to stay in the 24-25% range. Headcount is stabilizing and utilization has improved to 87%. Dividend payout reflects our continued commitment to shareholder returns.",
        sentiment: "positive",
        tags: ["margins", "utilization", "dividends"],
      },
    ],
    catalysts: [
      { id: "cat-tcs-1", ticker: "TCS", name: "TCS", event: "Q4 FY25 Results + FY26 Guidance Signals", date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), impact: "high", probability: "high", notes: "Strong deal TCV in Q3 should convert to revenue in FY26 — watch for management signals" },
    ],
    invalidationTriggers: [
      { id: "inv-tcs-1", trigger: "Revenue growth falls below 4% for two consecutive quarters", severity: "critical", description: "Structural market share loss or macro freeze in IT spending — thesis breaking", triggered: false },
      { id: "inv-tcs-2", trigger: "EBIT margin drops below 22%", severity: "high", description: "Premium margin profile is a core thesis element; sustained decline would de-rate the stock", triggered: false },
      { id: "inv-tcs-3", trigger: "Deal TCV drops below $6B for two quarters", severity: "high", description: "Weak deal wins signal pipeline depletion and future revenue risk", triggered: false },
    ],
    earningsQualityFlags: [
      { id: "eq-tcs-1", flag: "CFO/PAT conversion", severity: "green", description: "FCF conversion at 95%+ of PAT. Exceptional cash generation quality.", detected: false },
      { id: "eq-tcs-2", flag: "Revenue recognition policy", severity: "green", description: "Revenue recognized on percentage completion basis — no aggressive accounting. Consistent with global peers.", detected: false },
      { id: "eq-tcs-3", flag: "Cross-currency headwinds", severity: "amber", description: "EUR and GBP weakness against USD creates cross-currency drag of 50-80bps on reported growth.", detected: true },
    ],
    lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  DMART: {
    ticker: "DMART",
    name: "Avenue Supermarts",
    sector: "Consumer",
    marketCap: 3_07_200,
    ltp: 4724.6,
    thesis: {
      summary:
        "DMart is India's most efficient offline grocery retailer with an EDLC-EDLP model that creates structural cost advantages over competition. The thesis rests on consistent same-store sales growth, disciplined store expansion, and an owned real estate model that creates long-term asset value. The key risk is quick commerce disruption to urban demand.",
      bullCase:
        "Same-store sales growth recovers to 12%+ on premiumization and private label expansion. Quick commerce disruption proves manageable in Tier-1; DMart accelerates in Tier-2. Revenue per sq ft crosses ₹45,000. EPS growth of 22%+ justifies 90x PE.",
      baseCase:
        "SSSG sustains at 7-9% in Tier-2/3 markets. New store additions of 35-40 annually. Margins stable at 8-8.5% EBITDA. EPS growth of 15-18%. Multiple of 80x FY26E EPS gives base case ₹5,000.",
      bearCase:
        "Quick commerce structurally cannibalizes urban DMart stores with 15%+ SSSG decline. Margins compress on food inflation and private label competition. New store ROIs deteriorate. De-rating to 55x PE on growth concerns.",
      conviction: "high",
      keyAssumptions: [
        "SSSG sustains at 7-9% over FY26-FY28",
        "Quick commerce disruption stays in metros and doesn't spread to Tier-2",
        "EBITDA margin sustains at 8-8.5%",
        "35-40 new store additions annually with consistent unit economics",
        "Private label mix improves to 18%+ aiding margin",
      ],
      moatRating: "wide",
      managementRating: "excellent",
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    valuation: {
      bull: 5800,
      base: 5000,
      bear: 3600,
      currentPrice: 4724.6,
      upside: 5.8,
      methodology: "80x FY26E EPS (base) | 93x bull | 58x bear",
    },
    financialTrends: [
      {
        metric: "Revenue (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [11865, 10638, 11865, 14137, 13248, 11412, 13277, 15361],
        trend: "improving",
        unit: "₹ Cr",
      },
      {
        metric: "EBITDA Margin (%)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [8.6, 8.2, 8.4, 8.7, 8.5, 8.1, 8.3, 8.6],
        trend: "stable",
        unit: "%",
      },
      {
        metric: "PAT (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [773, 690, 773, 942, 862, 774, 842, 1032],
        trend: "improving",
        unit: "₹ Cr",
      },
    ],
    technicals: {
      rsi14: 52.4,
      ema50: 4680.2,
      ema200: 4420.6,
      support: 4550,
      resistance: 4900,
      macdSignal: "neutral",
      volumeVsAvg20d: 0.88,
      trend: "uptrend",
    },
    managementCommentary: [
      {
        id: "mc-dmart-1",
        quarter: "Q3FY25",
        date: "2025-01-11",
        speaker: "Neville Noronha (CEO)",
        comment:
          "Revenue growth of 18.6% in Q3 was driven by both SSSG and new stores. We added 9 stores in Q3, taking our total to 371. Urban store SSSG is under pressure from quick commerce but we continue to see strong performance in Tier-2 and Tier-3 markets.",
        sentiment: "neutral",
        tags: ["SSSG", "new stores", "quick commerce"],
      },
      {
        id: "mc-dmart-2",
        quarter: "Q2FY25",
        date: "2024-10-14",
        speaker: "Neville Noronha (CEO)",
        comment:
          "Our general merchandise and apparel segment showed strong performance this quarter. Food and FMCG segment SSSG was moderate but non-food categories are outperforming. We are investing in private labels and the category is gaining traction.",
        sentiment: "positive",
        tags: ["general merchandise", "private labels", "categories"],
      },
    ],
    catalysts: [
      { id: "cat-dmart-1", ticker: "DMART", name: "Avenue Supermarts", event: "Q4 FY25 results + SSSG trend", date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), impact: "high", probability: "high", notes: "Urban SSSG trajectory is key — any recovery from quick commerce disruption would be re-rating positive" },
    ],
    invalidationTriggers: [
      { id: "inv-dmart-1", trigger: "SSSG falls below 5% for two consecutive quarters", severity: "critical", description: "Signals structural loss of urban market share to quick commerce — growth thesis breaks", triggered: false },
      { id: "inv-dmart-2", trigger: "EBITDA margin drops below 7.5% on cost escalation", severity: "high", description: "EDLC model premium collapses — margin compression would trigger significant de-rating", triggered: false },
      { id: "inv-dmart-3", trigger: "New store unit economics deteriorate with revenue/sq ft below ₹30,000", severity: "high", description: "Expansion thesis relies on consistent unit economics — deterioration caps growth premium", triggered: false },
    ],
    earningsQualityFlags: [
      { id: "eq-dmart-1", flag: "Revenue recognition", severity: "green", description: "100% cash-and-carry retail — no credit risk, no deferred revenue. Purest income quality in retail.", detected: false },
      { id: "eq-dmart-2", flag: "Owned real estate book", severity: "green", description: "85%+ stores are owned properties. Asset value is understated on historical cost — creates hidden value.", detected: false },
      { id: "eq-dmart-3", flag: "Working capital efficiency", severity: "green", description: "Negative working capital model — vendor credit of 30+ days with immediate customer cash. Structurally superior.", detected: false },
    ],
    lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  ASIANPAINT: {
    ticker: "ASIANPAINT",
    name: "Asian Paints",
    sector: "Consumer",
    marketCap: 2_84_200,
    ltp: 2964.3,
    thesis: {
      summary:
        "Asian Paints is India's dominant decorative paints company with 55%+ market share, a deeply entrenched dealer network of 70,000+ dealers, and unmatched brand equity in the home improvement space. The thesis rests on long-term volume growth from housing and construction activity, pricing power, and steady margin recovery as input costs normalize.",
      bullCase:
        "Volume growth recovers to 12%+ on housing demand and lower crude/TiO2 costs. EBITDA margin recovers to 22%+ as pricing holds and RM costs ease. Birla Opus competition proves less disruptive than feared. Re-rating to 50x forward PE.",
      baseCase:
        "Volume growth sustains at 7-9%. EBITDA margin recovers to 20-21% in FY26. Pricing power intact despite competition. EPS growth of 15%. Multiple of 45x FY26E EPS gives base case ₹2,900.",
      bearCase:
        "Birla Opus captures 5-7% decorative market share by FY27. Volume growth slows to 4-5%. Margin compression to 17-18% from competition-driven price reductions. De-rating to 32x PE on structural market share risk.",
      conviction: "medium",
      keyAssumptions: [
        "Decorative paints volume growth sustains at 7-9%",
        "Crude oil and TiO2 prices remain benign in FY26",
        "Birla Opus market share gain capped at 3-4% in 3 years",
        "EBITDA margins recover to 20%+ by H2 FY26",
        "Industrial and international segments grow 12%+ to diversify revenue",
      ],
      moatRating: "wide",
      managementRating: "good",
      updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
    valuation: {
      bull: 3400,
      base: 2900,
      bear: 2100,
      currentPrice: 2964.3,
      upside: -2.2,
      methodology: "45x FY26E EPS (base) | 52x bull | 32x bear",
    },
    financialTrends: [
      {
        metric: "Revenue (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [8614, 8868, 8978, 8757, 8762, 8903, 8003, 8404],
        trend: "stable",
        unit: "₹ Cr",
      },
      {
        metric: "EBITDA Margin (%)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [20.4, 19.8, 21.2, 20.0, 19.4, 19.0, 17.8, 18.2],
        trend: "deteriorating",
        unit: "%",
      },
      {
        metric: "PAT (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [1257, 1422, 1531, 1447, 1170, 1177, 694, 1020],
        trend: "deteriorating",
        unit: "₹ Cr",
      },
    ],
    technicals: {
      rsi14: 38.4,
      ema50: 3124.8,
      ema200: 3284.6,
      support: 2850,
      resistance: 3100,
      macdSignal: "bearish",
      volumeVsAvg20d: 1.42,
      trend: "downtrend",
    },
    managementCommentary: [
      {
        id: "mc-apnt-1",
        quarter: "Q3FY25",
        date: "2025-01-24",
        speaker: "Amit Syngle (MD & CEO)",
        comment:
          "Volume growth of 5% was below our expectations. We saw demand softness in the premium segment. Birla Opus has intensified competitive activity in Tier-2 markets. We are responding with our Royale Play variants and service differentiation. RM costs remain elevated on crude and TiO2.",
        sentiment: "concerning",
        tags: ["volume", "competition", "RM costs"],
      },
      {
        id: "mc-apnt-2",
        quarter: "Q3FY25",
        date: "2025-01-24",
        speaker: "Amit Syngle (MD & CEO)",
        comment:
          "We expect margin recovery in Q4 and FY26 as crude-linked RM basket normalizes. Our network of 70,000+ dealers is a structural moat that competitors cannot replicate quickly. Home improvement services through Beautiful Homes is a long-term differentiation strategy.",
        sentiment: "neutral",
        tags: ["margins", "dealer network", "home services"],
      },
    ],
    catalysts: [
      { id: "cat-apnt-1", ticker: "ASIANPAINT", name: "Asian Paints", event: "Crude oil price decline", date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), impact: "high", probability: "medium", notes: "Any meaningful crude correction would relieve RM pressure and aid margin recovery" },
    ],
    invalidationTriggers: [
      { id: "inv-apnt-1", trigger: "Birla Opus achieves 7%+ decorative market share by FY27", severity: "critical", description: "Structural duopoly disruption — Asian Paints premium valuation collapses", triggered: false },
      { id: "inv-apnt-2", trigger: "EBITDA margin stays below 17% for three consecutive quarters", severity: "high", description: "Pricing power thesis broken — indicates structural rather than cyclical compression", triggered: false },
      { id: "inv-apnt-3", trigger: "Volume growth below 5% for two consecutive years", severity: "high", description: "Market saturation or demand destruction would fundamentally alter growth premium", triggered: false },
    ],
    earningsQualityFlags: [
      { id: "eq-apnt-1", flag: "RM cost transparency", severity: "green", description: "Company provides detailed RM basket breakdown. High transparency on cost drivers.", detected: false },
      { id: "eq-apnt-2", flag: "International subsidiary performance", severity: "amber", description: "International operations (Middle East, Bangladesh) showing margin pressure. Cross-subsidization risk.", detected: true },
      { id: "eq-apnt-3", flag: "Impairment risk on international assets", severity: "amber", description: "Bangladesh operations impacted by political disruption. Potential write-down risk exists.", detected: true },
    ],
    lastUpdated: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  KOTAKBANK: {
    ticker: "KOTAKBANK",
    name: "Kotak Mahindra Bank",
    sector: "Banking & Finance",
    marketCap: 3_76_200,
    ltp: 1892.6,
    thesis: {
      summary:
        "Kotak Mahindra Bank is a high-quality private bank with a premium liability franchise, best-in-class asset quality, and a proven management team under Ashok Vaswani post the leadership transition from Uday Kotak. The thesis rests on digital embargo resolution, loan growth re-acceleration, and sustained ROA leadership in the private banking space.",
      bullCase:
        "Digital embargo fully lifted — online customer acquisition restores. Loan growth re-accelerates to 20%+ in FY26. ROA sustains at 2.5%+. Wealth management and insurance subsidiaries re-rate as separate value pools. Multiple reaches 3.0x ABV.",
      baseCase:
        "Loan growth recovers to 15-17% in FY26. NIM stable at 4.8-5.0%. Credit costs controlled at 0.4-0.5%. ROA at 2.2-2.4%. Base case multiple of 3.0x FY26E ABV gives ₹2,000 target.",
      bearCase:
        "Digital embargo resolution slower than expected. Loan growth stays at 10-12%. Competitive NIM compression to 4.5%. Management transition risks materialize. De-rating to 2.2x ABV.",
      conviction: "medium",
      keyAssumptions: [
        "RBI digital embargo fully resolved by H1 FY26",
        "Leadership transition from Uday Kotak to Ashok Vaswani is seamless",
        "NIM sustains at 4.8%+ through rate cycle",
        "Asset quality stays pristine with GNPA < 1.7%",
        "Kotak Securities and Life Insurance subsidiaries continue to create value",
      ],
      moatRating: "wide",
      managementRating: "good",
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    valuation: {
      bull: 2300,
      base: 2000,
      bear: 1550,
      currentPrice: 1892.6,
      upside: 5.7,
      methodology: "3.0x FY26E ABV (base) | 3.5x bull | 2.3x bear",
    },
    financialTrends: [
      {
        metric: "Net Interest Income (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [6103, 6232, 6297, 6554, 6909, 7106, 7249, 7196],
        trend: "improving",
        unit: "₹ Cr",
      },
      {
        metric: "NIM (%)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [5.57, 5.57, 4.96, 4.99, 5.02, 5.02, 4.91, 4.93],
        trend: "stable",
        unit: "%",
      },
      {
        metric: "PAT (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [3495, 3452, 3452, 3005, 4133, 6250, 3344, 3305],
        trend: "stable",
        unit: "₹ Cr",
      },
    ],
    technicals: {
      rsi14: 50.2,
      ema50: 1876.4,
      ema200: 1784.2,
      support: 1820,
      resistance: 1960,
      macdSignal: "neutral",
      volumeVsAvg20d: 1.04,
      trend: "sideways",
    },
    managementCommentary: [
      {
        id: "mc-kotak-1",
        quarter: "Q3FY25",
        date: "2025-01-18",
        speaker: "Ashok Vaswani (MD & CEO)",
        comment:
          "We are making progress on the digital embargo resolution with the RBI. Our core banking fundamentals remain very strong — NIM at 4.93%, GNPA at 1.49%, ROA at 2.3%. The digital channel restrictions are temporary and we are confident of resolution in the near term.",
        sentiment: "positive",
        tags: ["digital embargo", "NIM", "asset quality"],
      },
      {
        id: "mc-kotak-2",
        quarter: "Q3FY25",
        date: "2025-01-18",
        speaker: "Devang Gheewala (CFO)",
        comment:
          "Our deposit franchise remains strong — CASA at 44.8% despite the digital restrictions. Loan growth moderated to 15% as we focus on quality over quantity. Our subsidiaries — Kotak Securities, Kotak Life — are performing well and contribute meaningfully to group value.",
        sentiment: "neutral",
        tags: ["CASA", "loan growth", "subsidiaries"],
      },
    ],
    catalysts: [
      { id: "cat-kotak-1", ticker: "KOTAKBANK", name: "Kotak Mahindra Bank", event: "RBI digital embargo resolution", date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), impact: "high", probability: "medium", notes: "Full embargo lift would be a significant re-rating catalyst for customer acquisition" },
    ],
    invalidationTriggers: [
      { id: "inv-kotak-1", trigger: "Digital embargo continues beyond FY26", severity: "high", description: "Structural customer acquisition disadvantage vs digital-first competitors — re-rating reverses", triggered: false },
      { id: "inv-kotak-2", trigger: "NIM compression below 4.5% on competitive liability pricing", severity: "high", description: "NIM premium is a key differentiator; sustained compression reduces earnings quality", triggered: false },
      { id: "inv-kotak-3", trigger: "Ashok Vaswani exits within 2 years", severity: "high", description: "Another leadership change would severely dent management credibility", triggered: false },
    ],
    earningsQualityFlags: [
      { id: "eq-kotak-1", flag: "CASA ratio sustainability", severity: "green", description: "44.8% CASA — structurally superior funding. Low-cost liability moat intact.", detected: false },
      { id: "eq-kotak-2", flag: "One-time items in Q1FY25 PAT", severity: "amber", description: "Q1FY25 PAT of ₹6,250 Cr included one-time gains from stake sale. Normalized PAT ~₹3,300 Cr.", detected: true },
      { id: "eq-kotak-3", flag: "Provision coverage", severity: "green", description: "PCR at 72%+ — adequate. No aggressive write-back pattern observed.", detected: false },
    ],
    lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  MARUTI: {
    ticker: "MARUTI",
    name: "Maruti Suzuki India",
    sector: "Auto",
    marketCap: 3_24_800,
    ltp: 10482.5,
    thesis: {
      summary:
        "Maruti Suzuki is India's dominant passenger vehicle manufacturer with 43%+ market share and an unrivaled distribution network of 3,500+ outlets. The thesis is a structural volume growth story driven by India's low PV penetration (30 per 1,000 people vs 400+ in developed markets), rising incomes, and Maruti's successful transition into CNG, hybrid, and SUV segments.",
      bullCase:
        "SUV and CNG volume acceleration drives market share recovery to 46%+. Hybrid models gain regulatory tailwinds. Export volumes to 300,000 units by FY27. EPS growth of 22%+ and re-rating to 30x forward PE.",
      baseCase:
        "Volume growth of 10-12% in FY26. Market share stable at 43-44%. EBITDA margin at 12-13% on scale and royalty reduction. EPS at ₹390+ in FY26. Base case of 28x FY26E EPS gives ₹11,000 target.",
      bearCase:
        "EV transition accelerates faster than expected and Maruti's readiness lags. Competition from Hyundai/Tata gains share. Market share falls to 38-40%. EBITDA margin compresses. De-rating to 20x PE.",
      conviction: "high",
      keyAssumptions: [
        "India PV industry grows 8-10% annually through FY26-FY28",
        "Maruti's SUV portfolio gains are sustainable",
        "CNG vehicles remain demand-accretive with 20%+ volume share",
        "EV strategy via Suzuki partnership executes without major delay",
        "Royalty rationalization continues improving reported margins",
      ],
      moatRating: "wide",
      managementRating: "excellent",
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    valuation: {
      bull: 13000,
      base: 11000,
      bear: 8200,
      currentPrice: 10482.5,
      upside: 4.9,
      methodology: "28x FY26E EPS (base) | 33x bull | 21x bear",
    },
    financialTrends: [
      {
        metric: "Revenue (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [31422, 32334, 37044, 37166, 38905, 35531, 37084, 37734],
        trend: "improving",
        unit: "₹ Cr",
      },
      {
        metric: "EBITDA Margin (%)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [10.0, 11.4, 12.3, 12.0, 12.4, 12.6, 12.1, 12.3],
        trend: "improving",
        unit: "%",
      },
      {
        metric: "PAT (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [2624, 3770, 3687, 3130, 3878, 3993, 3767, 3727],
        trend: "improving",
        unit: "₹ Cr",
      },
    ],
    technicals: {
      rsi14: 56.2,
      ema50: 10284.6,
      ema200: 9842.4,
      support: 10100,
      resistance: 10800,
      macdSignal: "bullish",
      volumeVsAvg20d: 1.14,
      trend: "uptrend",
    },
    managementCommentary: [
      {
        id: "mc-maruti-1",
        quarter: "Q3FY25",
        date: "2025-01-30",
        speaker: "Hisashi Takeuchi (MD & CEO)",
        comment:
          "We sold 5.63 lakh vehicles in Q3 — our best-ever Q3. SUVs now account for 42% of our mix. CNG remains a strong demand driver with 30% of volumes. Our EV strategy is on track with first launch expected in FY26 via the Suzuki-Toyota platform.",
        sentiment: "positive",
        tags: ["volumes", "SUV", "CNG", "EV"],
      },
      {
        id: "mc-maruti-2",
        quarter: "Q3FY25",
        date: "2025-01-30",
        speaker: "Rahul Bharti (CFO)",
        comment:
          "EBITDA margin at 12.3% reflects improved scale and commodity tailwinds. We expect royalty payments to rationalize further as the Suzuki licensing terms come up for renewal. Net cash position of ₹32,000 Cr provides significant financial flexibility.",
        sentiment: "positive",
        tags: ["margins", "royalty", "cash"],
      },
    ],
    catalysts: [
      { id: "cat-maruti-1", ticker: "MARUTI", name: "Maruti Suzuki", event: "EV model launch in FY26", date: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(), impact: "high", probability: "medium", notes: "First Maruti EV would signal successful transition and protect long-term market share" },
      { id: "cat-maruti-2", ticker: "MARUTI", name: "Maruti Suzuki", event: "Royalty rationalization announcement", date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), impact: "medium", probability: "medium", notes: "Any reduction in royalty rate would directly improve reported EBITDA margin" },
    ],
    invalidationTriggers: [
      { id: "inv-maruti-1", trigger: "Market share falls below 38% for two consecutive quarters", severity: "critical", description: "Structural shift in consumer preference to competition — core thesis breaks", triggered: false },
      { id: "inv-maruti-2", trigger: "EV transition materially delayed beyond FY27", severity: "high", description: "India EV adoption risk without readiness would compromise long-term positioning", triggered: false },
      { id: "inv-maruti-3", trigger: "EBITDA margin falls below 10% on competitive discounting", severity: "high", description: "Pricing power erosion on intense competition would reduce earnings quality", triggered: false },
    ],
    earningsQualityFlags: [
      { id: "eq-maruti-1", flag: "Royalty as % of revenue", severity: "amber", description: "Royalty to Suzuki at ~3.5% of revenue. This is above-market and creates an earnings leakage vs owned IP peers.", detected: true },
      { id: "eq-maruti-2", flag: "Other income contribution", severity: "green", description: "Treasury income from ₹32,000+ Cr cash contributes ₹800-900 Cr quarterly. Legitimate and recurring.", detected: false },
      { id: "eq-maruti-3", flag: "Subsidiary income consolidation", severity: "green", description: "Insurance and financial services subsidiaries are properly accounted. No earnings quality concern.", detected: false },
    ],
    lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  SUNPHARMA: {
    ticker: "SUNPHARMA",
    name: "Sun Pharmaceutical Industries",
    sector: "Pharma",
    marketCap: 3_91_200,
    ltp: 1628.4,
    thesis: {
      summary:
        "Sun Pharma is India's largest pharma company and a leading global specialty pharma player. The thesis is a specialty-led transformation from a generic manufacturer to a branded specialty business driven by Ilumya (dermatology), Winlevi, and the US specialty pipeline. India domestic business provides a stable high-margin anchor while US specialty drives re-rating.",
      bullCase:
        "Ilumya and US specialty revenue crosses $600M by FY27. India business grows 14%+ on chronic therapies. EBITDA margin expands to 28%+. US FDA issues clean EIRs for all key plants. Re-rating to 36x forward PE.",
      baseCase:
        "US specialty grows at 18-20% annually. India branded business at 10-12% growth. EBITDA margin sustains at 25-26%. EPS at ₹50+ in FY26. Base of 32x FY26E EPS gives ₹1,750 target.",
      bearCase:
        "US FDA issues Form 483 or warning letter at key manufacturing plants. Ilumya faces biosimilar competition earlier than expected. India business faces NLEM pricing pressure. Margins compress to 20-22%. De-rating to 22x PE.",
      conviction: "high",
      keyAssumptions: [
        "Ilumya peak sales reach $700M+ by FY27 in US and Europe",
        "No major US FDA regulatory action on manufacturing plants",
        "India branded business sustains 12% growth on chronic therapies",
        "US generics business stabilizes and doesn't erode further",
        "R&D pipeline of GL0034 (GLP-1) and other NCEs shows promise",
      ],
      moatRating: "wide",
      managementRating: "excellent",
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    valuation: {
      bull: 2000,
      base: 1750,
      bear: 1350,
      currentPrice: 1628.4,
      upside: 7.5,
      methodology: "32x FY26E EPS (base) | 37x bull | 25x bear",
    },
    financialTrends: [
      {
        metric: "Revenue (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [10892, 11484, 11666, 12377, 12299, 12310, 13208, 13898],
        trend: "improving",
        unit: "₹ Cr",
      },
      {
        metric: "EBITDA Margin (%)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [23.4, 24.2, 25.1, 25.8, 26.2, 26.4, 27.2, 26.8],
        trend: "improving",
        unit: "%",
      },
      {
        metric: "PAT (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [2114, 2237, 2386, 2809, 2651, 2834, 3000, 3131],
        trend: "improving",
        unit: "₹ Cr",
      },
    ],
    technicals: {
      rsi14: 62.4,
      ema50: 1588.6,
      ema200: 1446.2,
      support: 1560,
      resistance: 1700,
      macdSignal: "bullish",
      volumeVsAvg20d: 1.28,
      trend: "uptrend",
    },
    managementCommentary: [
      {
        id: "mc-sunp-1",
        quarter: "Q3FY25",
        date: "2025-02-05",
        speaker: "Dilip Shanghvi (MD)",
        comment:
          "US specialty business continues to grow strongly — Ilumya net revenues grew 26% to $148M in Q3. We are investing significantly in our specialty pipeline including GL0034 (GLP-1 analog). India business growth at 11% — broad-based across therapies. EBITDA margin at 26.8% reflects our specialty mix shift.",
        sentiment: "positive",
        tags: ["Ilumya", "GLP-1", "India business", "margins"],
      },
      {
        id: "mc-sunp-2",
        quarter: "Q2FY25",
        date: "2024-11-08",
        speaker: "Abhay Gandhi (CEO, North America)",
        comment:
          "The US specialty portfolio is performing ahead of plan. We are preparing launches for Winlevi in additional indications and exploring expansion of Cequa into new markets. The US generics business has stabilized. We expect specialty to be 55%+ of US revenue by FY26.",
        sentiment: "positive",
        tags: ["US specialty", "Winlevi", "Cequa", "generics"],
      },
    ],
    catalysts: [
      { id: "cat-sunp-1", ticker: "SUNPHARMA", name: "Sun Pharma", event: "USFDA Halol plant re-inspection result", date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), impact: "high", probability: "medium", notes: "Clean EIR would unlock US product pipeline from Halol" },
      { id: "cat-sunp-2", ticker: "SUNPHARMA", name: "Sun Pharma", event: "GL0034 (GLP-1) clinical data readout", date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), impact: "high", probability: "low", notes: "Positive data would open a massive new market opportunity" },
    ],
    invalidationTriggers: [
      { id: "inv-sunp-1", trigger: "US FDA Warning Letter for any major Sun Pharma plant", severity: "critical", description: "Import alert risk would severely impair US specialty and generic revenues", triggered: false },
      { id: "inv-sunp-2", trigger: "Ilumya biosimilar approved and capturing 20%+ market share by FY27", severity: "high", description: "Earlier-than-expected biosimilar entry would compress US specialty runway", triggered: false },
      { id: "inv-sunp-3", trigger: "India business growth falls below 8% for two consecutive quarters", severity: "high", description: "India branded business is the quality anchor — growth deceleration breaks the thesis balance", triggered: false },
    ],
    earningsQualityFlags: [
      { id: "eq-sunp-1", flag: "R&D capitalization", severity: "amber", description: "Sun Pharma capitalizes significant R&D — watch for changes in policy that could reverse write-offs.", detected: true },
      { id: "eq-sunp-2", flag: "US specialty net price realization", severity: "green", description: "Gross-to-net adjustments for Ilumya are disclosed and consistent. Net price holds at $18,000/year.", detected: false },
      { id: "eq-sunp-3", flag: "Provisions for Modafinil settlement", severity: "green", description: "All material legal provisions made. No significant undisclosed contingent liabilities.", detected: false },
    ],
    lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  TITAN: {
    ticker: "TITAN",
    name: "Titan Company",
    sector: "Consumer",
    marketCap: 2_85_600,
    ltp: 3214.8,
    thesis: {
      summary:
        "Titan is India's most aspirational consumer brand conglomerate with dominant positions in jewellery (Tanishq — #1), watches, eyewear, and emerging segments. The thesis is a long-term premiumization and formalization play in India's large unorganized jewellery market, with Tanishq driving consistent same-store sales growth and market share gains from local jewellers.",
      bullCase:
        "Jewellery SSSG sustains at 12%+ on gold price tailwind and wedding demand. Tanishq gains 300bps market share from unorganized. Watches and eyewear contribute meaningfully. International expansion in the Middle East scales. Re-rating to 85x forward PE.",
      baseCase:
        "Jewellery SSSG at 8-10%. Tanishq store count reaches 500 by FY27. Overall revenue growth 18-20%. EBITDA margin stable at 11-12%. EPS growth of 20%+ gives base case ₹3,300 at 75x FY26E EPS.",
      bearCase:
        "Gold prices correct 15-20% dampening demand. SSSG falls to 4-5%. Competition from Reliance Jewels and online platforms. Watches segment continues secular decline. De-rating to 50x PE.",
      conviction: "high",
      keyAssumptions: [
        "Tanishq jewellery SSSG sustains at 8%+ on wedding and gifting demand",
        "Formalization tailwind from GST and lab-grown diamond clarity",
        "Gold prices broadly stable or rising supporting sentiment",
        "New Tanishq store ROIs remain healthy with payback < 3 years",
        "CaratLane and Mia online jewellery gain 15%+ revenue growth",
      ],
      moatRating: "wide",
      managementRating: "excellent",
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    valuation: {
      bull: 3900,
      base: 3300,
      bear: 2400,
      currentPrice: 3214.8,
      upside: 2.7,
      methodology: "75x FY26E EPS (base) | 89x bull | 55x bear",
    },
    financialTrends: [
      {
        metric: "Revenue (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [10220, 8694, 9841, 13099, 11716, 9459, 10066, 13964],
        trend: "improving",
        unit: "₹ Cr",
      },
      {
        metric: "EBITDA Margin (%)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [10.8, 9.8, 10.2, 11.4, 10.6, 10.2, 10.8, 11.2],
        trend: "stable",
        unit: "%",
      },
      {
        metric: "PAT (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [769, 770, 816, 1017, 786, 838, 715, 1013],
        trend: "improving",
        unit: "₹ Cr",
      },
    ],
    technicals: {
      rsi14: 54.6,
      ema50: 3148.4,
      ema200: 3028.6,
      support: 3080,
      resistance: 3380,
      macdSignal: "bullish",
      volumeVsAvg20d: 1.18,
      trend: "uptrend",
    },
    managementCommentary: [
      {
        id: "mc-titan-1",
        quarter: "Q3FY25",
        date: "2025-01-13",
        speaker: "C.K. Venkataraman (MD)",
        comment:
          "Q3 was an outstanding quarter — jewellery SSSG of 19% driven by wedding season and studded category strength. We crossed 500 Tanishq stores. CaratLane is growing 30%+ and is on path to meaningful scale. Watches business is growing well in premium segment.",
        sentiment: "positive",
        tags: ["SSSG", "Tanishq", "CaratLane", "watches"],
      },
      {
        id: "mc-titan-2",
        quarter: "Q2FY25",
        date: "2024-10-08",
        speaker: "Ashok Sonthalia (CFO)",
        comment:
          "Our balance sheet remains strong with net cash positive position. Working capital is well managed as we keep inventory turns high in jewellery. We are investing in expanding capacity for lab-grown diamond jewellery as a complementary category.",
        sentiment: "positive",
        tags: ["balance sheet", "working capital", "lab-grown diamonds"],
      },
    ],
    catalysts: [
      { id: "cat-titan-1", ticker: "TITAN", name: "Titan Company", event: "Q4 FY25 Results + jewellery SSSG", date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), impact: "high", probability: "high", notes: "Wedding season Q4 should be strong — any SSSG above 15% is positive for thesis" },
    ],
    invalidationTriggers: [
      { id: "inv-titan-1", trigger: "Jewellery SSSG falls below 5% for two consecutive quarters outside Q1", severity: "critical", description: "Structural demand disruption or market share loss — premium valuation cannot be sustained", triggered: false },
      { id: "inv-titan-2", trigger: "Unorganized jewellers reverse formalization trend", severity: "high", description: "GST rollback or regulatory easing could restore competitive pricing of local jewellers", triggered: false },
      { id: "inv-titan-3", trigger: "Gold prices correct more than 25% dampening demand", severity: "medium", description: "Sharp gold correction historically leads to demand deferral and SSSG miss", triggered: false },
    ],
    earningsQualityFlags: [
      { id: "eq-titan-1", flag: "Gold on lease scheme", severity: "amber", description: "Titan uses gold on lease from banks — off-balance-sheet gold inventory. Limit exposure if lease rates rise sharply.", detected: true },
      { id: "eq-titan-2", flag: "Hedge accounting effectiveness", severity: "green", description: "Gold hedging policy is well-structured and effective. No unusual hedge gains/losses in last 4 quarters.", detected: false },
      { id: "eq-titan-3", flag: "CaratLane goodwill", severity: "amber", description: "CaratLane acquisition created ₹1,200+ Cr goodwill. Impairment test required if growth slows.", detected: false },
    ],
    lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  PIDILITIND: {
    ticker: "PIDILITIND",
    name: "Pidilite Industries",
    sector: "Chemicals",
    marketCap: 1_31_200,
    ltp: 2580.3,
    thesis: {
      summary:
        "Pidilite is India's dominant adhesives and sealants company, with Fevicol as one of India's most valuable consumer brands. The thesis is a quality compounder with a near-monopoly in consumer adhesives (70%+ market share), expanding into construction chemicals, waterproofing, and artist materials — providing long growth runway at premium margins.",
      bullCase:
        "Construction chemicals revenue doubles by FY27 on real estate boom. Fevicol maintains pricing power. International operations scale to 20%+ of revenue. EBITDA margin expands to 24%+. Re-rating to 60x forward PE.",
      baseCase:
        "Revenue growth of 12-14% driven by volume and mix. EBITDA margin sustains at 22-23%. EPS growth of 16-18%. Base case of 55x FY26E EPS gives ₹2,700 target.",
      bearCase:
        "Crude-linked vinyl acetate monomer costs inflate sharply. Real estate slowdown dampens construction chemical demand. Competition in construction segment from Sika and Henkel. Margin compression to 18-19%. De-rating to 38x PE.",
      conviction: "high",
      keyAssumptions: [
        "Fevicol maintains 70%+ market share in consumer adhesives",
        "Construction chemicals grow 25%+ on real estate and infrastructure boom",
        "VAM and crude-linked input cost stays benign",
        "International operations (US, Middle East, Africa) scale profitably",
        "B2B industrial segment diversifies away from commodity dependence",
      ],
      moatRating: "wide",
      managementRating: "excellent",
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    valuation: {
      bull: 3200,
      base: 2700,
      bear: 2000,
      currentPrice: 2580.3,
      upside: 4.6,
      methodology: "55x FY26E EPS (base) | 65x bull | 41x bear",
    },
    financialTrends: [
      {
        metric: "Revenue (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [2980, 2842, 3021, 3224, 3106, 3014, 3182, 3384],
        trend: "improving",
        unit: "₹ Cr",
      },
      {
        metric: "EBITDA Margin (%)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [20.8, 22.4, 21.8, 22.4, 22.0, 22.8, 22.2, 22.8],
        trend: "stable",
        unit: "%",
      },
      {
        metric: "PAT (₹ Cr)",
        periods: ["Q4FY23", "Q1FY24", "Q2FY24", "Q3FY24", "Q4FY24", "Q1FY25", "Q2FY25", "Q3FY25"],
        values: [416, 476, 494, 554, 504, 512, 546, 592],
        trend: "improving",
        unit: "₹ Cr",
      },
    ],
    technicals: {
      rsi14: 55.8,
      ema50: 2528.4,
      ema200: 2408.6,
      support: 2480,
      resistance: 2680,
      macdSignal: "bullish",
      volumeVsAvg20d: 1.06,
      trend: "uptrend",
    },
    managementCommentary: [
      {
        id: "mc-pidilite-1",
        quarter: "Q3FY25",
        date: "2025-02-04",
        speaker: "Bharat Puri (MD)",
        comment:
          "Volume growth of 12% in Q3 was strong across both consumer and B2B segments. Fevicol continues to grow in the mid-teens. Construction chemicals segment grew 22% — real estate and infrastructure activity is strong. Margins at 22.8% reflect stable input costs and operating leverage.",
        sentiment: "positive",
        tags: ["volume", "Fevicol", "construction chemicals", "margins"],
      },
      {
        id: "mc-pidilite-2",
        quarter: "Q2FY25",
        date: "2024-10-29",
        speaker: "Sudhanshu Vats (CFO)",
        comment:
          "Our international business grew 18% in Q2. We are investing in SMARTCARE (waterproofing) as a construction business platform. VAM prices have remained benign helping margins. We continue to invest in distribution expansion — now at 8,00,000 retailers.",
        sentiment: "positive",
        tags: ["international", "SMARTCARE", "VAM", "distribution"],
      },
    ],
    catalysts: [
      { id: "cat-pidilite-1", ticker: "PIDILITIND", name: "Pidilite Industries", event: "Construction chemicals milestone — 25% of revenue", date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), impact: "medium", probability: "medium", notes: "When construction chemicals reaches 25% revenue, diversification re-rating possible" },
    ],
    invalidationTriggers: [
      { id: "inv-pidilite-1", trigger: "Fevicol market share falls below 65% on competition", severity: "critical", description: "Core brand moat erosion — entire premium valuation thesis questioned", triggered: false },
      { id: "inv-pidilite-2", trigger: "EBITDA margin falls below 18% for two quarters on VAM spike", severity: "high", description: "Input cost vulnerability exposed — Pidilite is a VAM price-taker", triggered: false },
      { id: "inv-pidilite-3", trigger: "Real estate cycle turns sharply negative for 2+ years", severity: "medium", description: "Construction chemicals growth thesis depends on sustained real estate and infra activity", triggered: false },
    ],
    earningsQualityFlags: [
      { id: "eq-pidilite-1", flag: "VAM inventory cycle gains/losses", severity: "amber", description: "When VAM prices fall sharply, Pidilite can see inventory gains — normalize for underlying trend.", detected: true },
      { id: "eq-pidilite-2", flag: "Cash conversion cycle", severity: "green", description: "Working capital days are consistently managed at 45-50 days. No deterioration observed.", detected: false },
      { id: "eq-pidilite-3", flag: "Subsidiary dividend income", severity: "green", description: "Wholly-owned subsidiaries generate steady dividends. No quality concern.", detected: false },
    ],
    lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
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
