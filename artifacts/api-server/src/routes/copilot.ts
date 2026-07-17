import { Router } from "express";

const router = Router();

const HISTORY: any[] = [
  {
    id: "msg-1",
    role: "user",
    content: "What is the impact of the RBI rate decision on my banking holdings?",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    response: null,
  },
  {
    id: "msg-2",
    role: "assistant",
    content: "Based on the RBI's current stance and your portfolio composition, here is a structured assessment.",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 5000).toISOString(),
    response: {
      id: "resp-1",
      question: "What is the impact of the RBI rate decision on my banking holdings?",
      answer:
        "Your banking exposure is 28.4% of portfolio (HDFC Bank 11.7%, Bajaj Finance 13.5%, Kotak Bank 7.3%). RBI has held rates at 6.5% in the Feb 2025 MPC — neutral for NIMs in the near term. However, the key risk for your largest banking holding (Bajaj Finance) is NOT the repo rate itself but their internal funding cost which lags by 2-3 quarters. HDFC Bank is better positioned with a higher CASA ratio (42%) offering more NIM stability. Kotak Bank benefits from the embargo lift and conservative provisioning.\n\nNet: Hold HDFC Bank and Kotak. Review Bajaj Finance separately given earnings quality concerns.",
      sources: [
        { title: "RBI MPC February 2025 Resolution", type: "bse_filing", url: "#", date: "2025-02-07" },
        { title: "Bajaj Finance Q3FY25 Concall Transcript", type: "concall", url: "#", date: "2025-01-28" },
        { title: "HDFC Bank Q3FY25 Analyst Presentation", type: "annual_report", url: "#", date: "2025-01-18" },
      ],
      thesisImpact: [
        { ticker: "HDFCBANK", name: "HDFC Bank", impact: "neutral", reason: "High CASA protects NIM; rate hold is neutral" },
        { ticker: "BAJFINANCE", name: "Bajaj Finance", impact: "negative", reason: "Funding cost pressures lag policy rate; NIM thesis under pressure" },
        { ticker: "KOTAKBANK", name: "Kotak Mahindra Bank", impact: "positive", reason: "Conservative book + rate hold supports margin recovery narrative" },
      ],
      convictionChange: null,
      recommendedActions: ["Review Bajaj Finance thesis separately", "Hold HDFC Bank and Kotak positions", "Monitor next MPC meeting for rate cut signals"],
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 5000).toISOString(),
    },
  },
];

const CANNED_RESPONSES: Record<string, any> = {
  default: {
    answer:
      "Based on my analysis of your portfolio and available market data, here is a structured assessment of your question. The key considerations for your specific holdings involve valuation, earnings trajectory, and thesis integrity checks against current developments.\n\nFor your portfolio's Indian equity exposure, the primary risks to monitor are: (1) macro headwinds from any INR depreciation, (2) sector-specific regulatory risks in financial services, and (3) global risk-off events that tend to create disproportionate FII outflows from emerging markets.\n\nI recommend reviewing your highest-conviction names against their invalidation triggers quarterly, and treating any 3+ sigma move in promoter activity or credit metrics as a thesis checkpoint.",
    sources: [
      { title: "Portfolio Holdings Analysis — Demo Data", type: "internal", url: "#", date: new Date().toISOString().split("T")[0] },
      { title: "NSE Market Intelligence — 15 Jul 2025", type: "nse_data", url: "#", date: new Date().toISOString().split("T")[0] },
      { title: "RBI Annual Report 2024-25", type: "annual_report", url: "#", date: "2025-05-28" },
    ],
    thesisImpact: [
      { ticker: "INFY", name: "Infosys", impact: "positive", reason: "IT spending recovery thesis remains intact per latest guidance" },
      { ticker: "BAJFINANCE", name: "Bajaj Finance", impact: "negative", reason: "NIM and credit cost pressures challenge the core thesis assumptions" },
      { ticker: "RELIANCE", name: "Reliance Industries", impact: "neutral", reason: "Conglomerate thesis intact; Jio ARPU and retail expansion on track" },
    ],
    convictionChange: null,
    recommendedActions: [
      "Review Bajaj Finance conviction level",
      "Consider adding to Infosys on any dip below ₹1,680",
      "Monitor Asian Paints margin recovery trajectory",
    ],
  },
};

router.post("/query", (req, res) => {
  const { question } = req.body;
  const response = {
    id: `resp-${Date.now()}`,
    question,
    ...CANNED_RESPONSES.default,
    timestamp: new Date().toISOString(),
  };

  const userMsg = {
    id: `msg-user-${Date.now()}`,
    role: "user",
    content: question,
    timestamp: new Date().toISOString(),
    response: null,
  };
  const assistantMsg = {
    id: `msg-asst-${Date.now()}`,
    role: "assistant",
    content: response.answer.substring(0, 120) + "...",
    timestamp: new Date(Date.now() + 2000).toISOString(),
    response,
  };
  HISTORY.push(userMsg);
  HISTORY.push(assistantMsg);

  res.json(response);
});

router.get("/history", (req, res) => {
  res.json(HISTORY);
});

export default router;
