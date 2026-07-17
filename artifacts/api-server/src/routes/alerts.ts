import { Router } from "express";

const router = Router();

const ALERTS = [
  {
    id: "alert-1",
    ticker: "BAJFINANCE",
    name: "Bajaj Finance",
    alertType: "earnings_cut",
    severity: "high",
    headline: "Q3 PAT estimates cut 8–12% across brokerages after NIM miss",
    detail: "Net interest margin at 10.1% vs 10.6% guided. Credit cost revised upward from 1.45% to 1.75%. Four brokerages (Kotak, HDFC, Axis, Nomura) have cut FY25 PAT estimates by 8–12%. Thesis assumption of NIM stability at 10.5%+ now under question. Recommend conviction review.",
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
    headline: "EBITDA margin contracts 180bps YoY on crude-linked RM inflation",
    detail: "EBITDA margin at 18.2% vs 20.0% in Q3FY24. Raw material costs up 7.3% QoQ driven by crude oil and titanium dioxide prices. Volume growth at 5% missed 8% estimate. Birla Opus competition intensifying in Tier-2 markets. Revisit pricing power thesis.",
    source: "Q3FY25 Results + Concall Transcript",
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    dismissed: false,
  },
  {
    id: "alert-3",
    ticker: "HDFCBANK",
    name: "HDFC Bank",
    alertType: "pledge_increase",
    severity: "medium",
    headline: "Promoter entity pledge of 0.8% disclosed in Q3FY25 shareholding pattern",
    detail: "HDFC Ltd (post-merger entity) has pledged 0.8% of shares as collateral. While absolute quantum is small relative to 0% historical pledge, this is the first instance of promoter-level pledge since the HDFC merger in 2023. Monitor for any escalation in pledged quantity.",
    source: "NSE Shareholding Pattern Filing — Q3FY25",
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    dismissed: false,
  },
  {
    id: "alert-4",
    ticker: "INFY",
    name: "Infosys",
    alertType: "promoter_selling",
    severity: "medium",
    headline: "Narayana Murthy family trust reduces stake by 0.08% in secondary market",
    detail: "NRN and family trust sold approximately 16.8 lakh shares (0.08% of equity) in open market transactions during December 2024. Cumulative promoter stake now at 14.32%. While quantum is modest, any further reduction in an already-low promoter holding warrants monitoring.",
    source: "NSE Insider Trading Disclosure",
    timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    dismissed: false,
  },
  {
    id: "alert-5",
    ticker: "DIXON",
    name: "Dixon Technologies",
    alertType: "pledge_increase",
    severity: "medium",
    headline: "Promoter pledge increases to 2.4% of equity — up 0.6% QoQ",
    detail: "Dixon Technologies promoter group has incrementally pledged shares; cumulative pledge at 2.4% of equity vs 1.8% in Q2FY25. Not at alarming levels but trend is increasing. Company has not disclosed the purpose of the pledge.",
    source: "NSE Shareholding Pattern Filing — Q3FY25",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    dismissed: true,
  },
  {
    id: "alert-6",
    ticker: "BAJFINANCE",
    name: "Bajaj Finance",
    alertType: "rating_downgrade",
    severity: "high",
    headline: "HDFC Securities and Axis Capital downgrade to NEUTRAL from BUY",
    detail: "Two brokerages have simultaneously downgraded Bajaj Finance following Q3FY25 results. HDFC Securities cuts target from ₹8,400 to ₹7,200 (NEUTRAL). Axis Capital moves to REDUCE with ₹6,800 target. Key concern: credit cost and NIM guidance cuts are likely to continue into H1FY26.",
    source: "Brokerage Research Reports — 28 Jan 2025",
    timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    dismissed: false,
  },
];

let alertSettings = {
  enabledAlertTypes: [
    "promoter_selling", "pledge_increase", "auditor_resignation", "management_exit",
    "rating_downgrade", "regulatory_investigation", "fraud_allegation", "debt_issue",
    "order_cancellation", "earnings_cut", "margin_deterioration", "governance_issue",
    "dilution", "other"
  ],
  severityThreshold: "medium",
  emailNotifications: true,
  pushNotifications: false,
  portfolioOnly: true,
};

router.get("/", (req, res) => {
  res.json(ALERTS);
});

router.get("/settings", (req, res) => {
  res.json(alertSettings);
});

router.put("/settings", (req, res) => {
  alertSettings = { ...alertSettings, ...req.body };
  res.json(alertSettings);
});

router.post("/:id/dismiss", (req, res) => {
  const alert = ALERTS.find((a) => a.id === req.params.id);
  if (alert) {
    alert.dismissed = true;
  }
  res.json(alert ?? { error: "Not found" });
});

export default router;
