import { Router } from "express";

const router = Router();

router.get("/scanner", (req, res) => {
  res.json([
    { ticker: "INFY", name: "Infosys", sector: "Technology", ltp: 1742.5, volumeRatio: 2.84, deliveryPct: 72.4, oi: null, dayChangePct: 1.67, signal: "accumulation", timestamp: new Date().toISOString() },
    { ticker: "TITAN", name: "Titan Company", sector: "Consumer", ltp: 3214.8, volumeRatio: 2.14, deliveryPct: 68.2, oi: null, dayChangePct: 1.09, signal: "delivery_surge", timestamp: new Date().toISOString() },
    { ticker: "BAJFINANCE", name: "Bajaj Finance", sector: "Banking & Finance", ltp: 6830.5, volumeRatio: 3.48, deliveryPct: 58.4, oi: 48_24_000, dayChangePct: -1.22, signal: "distribution", timestamp: new Date().toISOString() },
    { ticker: "ASIANPAINT", name: "Asian Paints", sector: "Consumer", ltp: 2964.3, volumeRatio: 1.92, deliveryPct: 62.8, oi: null, dayChangePct: -0.63, signal: "distribution", timestamp: new Date().toISOString() },
    { ticker: "ZOMATO", name: "Zomato", sector: "Consumer Tech", ltp: 248.6, volumeRatio: 4.12, deliveryPct: 84.2, oi: 1_24_80_000, dayChangePct: 1.97, signal: "unusual_volume", timestamp: new Date().toISOString() },
    { ticker: "DIXON", name: "Dixon Technologies", sector: "Technology", ltp: 14248.5, volumeRatio: 2.64, deliveryPct: 74.6, oi: null, dayChangePct: -1.28, signal: "distribution", timestamp: new Date().toISOString() },
    { ticker: "SUNPHARMA", name: "Sun Pharma", sector: "Pharma", ltp: 1628.4, volumeRatio: 1.86, deliveryPct: 66.8, oi: null, dayChangePct: 1.38, signal: "accumulation", timestamp: new Date().toISOString() },
    { ticker: "HDFCBANK", name: "HDFC Bank", sector: "Banking & Finance", ltp: 1618.75, volumeRatio: 1.42, deliveryPct: 78.4, oi: 1_84_40_000, dayChangePct: 0.89, signal: "accumulation", timestamp: new Date().toISOString() },
    { ticker: "RELIANCE", name: "Reliance Industries", sector: "Energy", ltp: 2847.3, volumeRatio: 1.28, deliveryPct: 52.4, oi: 2_84_20_000, dayChangePct: -0.78, signal: "normal", timestamp: new Date().toISOString() },
    { ticker: "TCS", name: "TCS", sector: "Technology", ltp: 3812.4, volumeRatio: 1.64, deliveryPct: 70.2, oi: null, dayChangePct: 1.11, signal: "accumulation", timestamp: new Date().toISOString() },
    { ticker: "NAUKRI", name: "Info Edge India", sector: "Technology", ltp: 7248.6, volumeRatio: 3.84, deliveryPct: 82.4, oi: null, dayChangePct: -0.59, signal: "unusual_volume", timestamp: new Date().toISOString() },
    { ticker: "MARUTI", name: "Maruti Suzuki", sector: "Auto", ltp: 10482.5, volumeRatio: 1.94, deliveryPct: 64.6, oi: null, dayChangePct: 0.95, signal: "delivery_surge", timestamp: new Date().toISOString() },
  ]);
});

router.get("/promoter-activity", (req, res) => {
  res.json([
    { id: "pa-1", ticker: "HDFCBANK", name: "HDFC Bank", quarter: "Q3FY25", promoterHoldingPct: 0.0, changeInHolding: 0.0, pledgedPct: 0.8, pledgeChange: 0.8, category: "pledge_increase", filingDate: "2025-01-14", remarks: "HDFC Ltd entity pledged 0.8% shares as collateral — first instance post-merger" },
    { id: "pa-2", ticker: "BAJFINANCE", name: "Bajaj Finance", quarter: "Q3FY25", promoterHoldingPct: 54.78, changeInHolding: -0.12, pledgedPct: 0.0, pledgeChange: 0.0, category: "promoter_selling", filingDate: "2025-01-14", remarks: "Bajaj Finserv sold 0.12% via secondary market in December 2024" },
    { id: "pa-3", ticker: "RELIANCE", name: "Reliance Industries", quarter: "Q3FY25", promoterHoldingPct: 50.33, changeInHolding: 0.0, pledgedPct: 0.0, pledgeChange: 0.0, category: "unchanged", filingDate: "2025-01-13", remarks: "No change in promoter holding for 8th consecutive quarter" },
    { id: "pa-4", ticker: "INFY", name: "Infosys", quarter: "Q3FY25", promoterHoldingPct: 14.4, changeInHolding: -0.08, pledgedPct: 0.0, pledgeChange: 0.0, category: "promoter_selling", filingDate: "2025-01-13", remarks: "Narayana Murthy family trust reduced holding by 0.08% via open market transactions" },
    { id: "pa-5", ticker: "DMART", name: "Avenue Supermarts", quarter: "Q3FY25", promoterHoldingPct: 74.99, changeInHolding: 0.0, pledgedPct: 0.0, pledgeChange: 0.0, category: "unchanged", filingDate: "2025-01-12", remarks: "Radhakishan Damani group unchanged. No pledge." },
    { id: "pa-6", ticker: "ASIANPAINT", name: "Asian Paints", quarter: "Q3FY25", promoterHoldingPct: 52.88, changeInHolding: 0.0, pledgedPct: 0.0, pledgeChange: 0.0, category: "unchanged", filingDate: "2025-01-14", remarks: "Promoter holding stable. No change." },
    { id: "pa-7", ticker: "TRENT", name: "Trent", quarter: "Q3FY25", promoterHoldingPct: 37.01, changeInHolding: 0.42, pledgedPct: 0.0, pledgeChange: 0.0, category: "promoter_buying", filingDate: "2025-01-14", remarks: "Tata Sons increased stake by 0.42% via creeping acquisition — bullish signal" },
    { id: "pa-8", ticker: "DIXON", name: "Dixon Technologies", quarter: "Q3FY25", promoterHoldingPct: 33.14, changeInHolding: -0.24, pledgedPct: 2.4, pledgeChange: 0.6, category: "pledge_increase", filingDate: "2025-01-13", remarks: "Promoter pledged additional 0.6% — cumulative pledge now at 2.4% of equity. Monitoring." },
  ]);
});

router.get("/bulk-block-deals", (req, res) => {
  res.json([
    { id: "bd-1", ticker: "ZOMATO", name: "Zomato", date: "2025-07-15", type: "block", client: "Government of Singapore", quantity: 1_24_80_000, price: 244.2, value: 304_72_560, side: "buy", exchange: "NSE" },
    { id: "bd-2", ticker: "BAJFINANCE", name: "Bajaj Finance", date: "2025-07-14", type: "block", client: "Norges Bank Investment", quantity: 4_82_400, price: 7020.0, value: 338_64_48_000, side: "sell", exchange: "BSE" },
    { id: "bd-3", ticker: "INFY", name: "Infosys", date: "2025-07-12", type: "bulk", client: "Vanguard Total Int'l Stock Index", quantity: 84_24_000, price: 1718.4, value: 144_76_81_600, side: "buy", exchange: "NSE" },
    { id: "bd-4", ticker: "ASIANPAINT", name: "Asian Paints", date: "2025-07-11", type: "block", client: "HDFC MF — Flexi Cap Fund", quantity: 18_40_000, price: 2980.0, value: 54_83_200_000, side: "buy", exchange: "NSE" },
    { id: "bd-5", ticker: "KOTAKBANK", name: "Kotak Mahindra Bank", date: "2025-07-10", type: "block", client: "Blackrock Inc", quantity: 42_80_000, price: 1882.0, value: 80_55_16_000, side: "buy", exchange: "NSE" },
    { id: "bd-6", ticker: "DIXON", name: "Dixon Technologies", date: "2025-07-09", type: "bulk", client: "Nippon India MF — Small Cap", quantity: 1_84_200, price: 14480.0, value: 26_66_81_600, side: "sell", exchange: "BSE" },
    { id: "bd-7", ticker: "TRENT", name: "Trent", date: "2025-07-08", type: "block", client: "Capital Group", quantity: 28_40_000, price: 5760.0, value: 163_58_400_000, side: "buy", exchange: "NSE" },
  ]);
});

router.get("/fno-positioning", (req, res) => {
  res.json([
    { ticker: "NIFTY", name: "Nifty 50", openInterest: 1_84_28_000, oiChange: 12_40_000, oiChangePct: 7.2, pcr: 0.84, ivPercentile: 28.4, maxPainStrike: 22200, keyStrikes: [{ strike: 22000, callOi: 48_24_000, putOi: 42_80_000, callOiChange: 4_82_000, putOiChange: -2_40_000 }, { strike: 22200, callOi: 84_20_000, putOi: 62_40_000, callOiChange: 8_40_000, putOiChange: 4_20_000 }, { strike: 22400, callOi: 42_80_000, putOi: 28_40_000, callOiChange: 2_40_000, putOiChange: 1_20_000 }] },
    { ticker: "BANKNIFTY", name: "Bank Nifty", openInterest: 84_24_000, oiChange: -4_80_000, oiChangePct: -5.4, pcr: 0.72, ivPercentile: 34.8, maxPainStrike: 47800, keyStrikes: [{ strike: 47500, callOi: 24_80_000, putOi: 18_40_000, callOiChange: 2_40_000, putOiChange: -1_20_000 }, { strike: 48000, callOi: 42_40_000, putOi: 24_80_000, callOiChange: 4_80_000, putOiChange: 2_40_000 }] },
    { ticker: "BAJFINANCE", name: "Bajaj Finance", openInterest: 48_24_000, oiChange: 8_42_000, oiChangePct: 21.4, pcr: 0.58, ivPercentile: 64.2, maxPainStrike: 7000, keyStrikes: [{ strike: 6800, callOi: 8_40_000, putOi: 4_20_000, callOiChange: 2_40_000, putOiChange: -1_20_000 }, { strike: 7000, callOi: 12_40_000, putOi: 8_40_000, callOiChange: 4_20_000, putOiChange: 2_40_000 }] },
    { ticker: "ZOMATO", name: "Zomato", openInterest: 1_24_80_000, oiChange: 24_80_000, oiChangePct: 24.8, pcr: 1.24, ivPercentile: 42.6, maxPainStrike: 240, keyStrikes: [{ strike: 240, callOi: 24_80_000, putOi: 28_40_000, callOiChange: 4_80_000, putOiChange: 6_40_000 }, { strike: 260, callOi: 18_40_000, putOi: 12_40_000, callOiChange: 2_40_000, putOiChange: -1_20_000 }] },
    { ticker: "RELIANCE", name: "Reliance Industries", openInterest: 2_84_20_000, oiChange: -8_40_000, oiChangePct: -2.88, pcr: 0.96, ivPercentile: 22.4, maxPainStrike: 2900, keyStrikes: [{ strike: 2800, callOi: 48_24_000, putOi: 42_80_000, callOiChange: -4_80_000, putOiChange: 2_40_000 }, { strike: 2900, callOi: 84_20_000, putOi: 62_40_000, callOiChange: -8_40_000, putOiChange: 4_80_000 }] },
  ]);
});

router.get("/sector-rotation", (req, res) => {
  res.json([
    { sector: "Banking & Finance", weekReturn: 1.84, monthReturn: 4.24, quarterReturn: 8.42, fiiFlows: 2840, diiFlows: 1820, breadth: 0.68, topGainers: ["HDFCBANK", "ICICIBANK", "AXISBANK"], topLosers: ["BAJFINANCE", "FEDERALBNK"] },
    { sector: "Technology", weekReturn: 2.42, monthReturn: 6.84, quarterReturn: 14.28, fiiFlows: 4820, diiFlows: 2840, breadth: 0.82, topGainers: ["INFY", "TCS", "HCLTECH"], topLosers: ["WIPRO", "TECHM"] },
    { sector: "Consumer", weekReturn: 0.84, monthReturn: 2.14, quarterReturn: 6.84, fiiFlows: 1240, diiFlows: 2480, breadth: 0.58, topGainers: ["TITAN", "DMART"], topLosers: ["ASIANPAINT", "NESTLEIND"] },
    { sector: "Energy", weekReturn: -0.42, monthReturn: 1.84, quarterReturn: 4.28, fiiFlows: -840, diiFlows: 1820, breadth: 0.48, topGainers: ["RELIANCE", "ONGC"], topLosers: ["BPCL", "HINDPETRO"] },
    { sector: "Pharma", weekReturn: 1.28, monthReturn: 3.84, quarterReturn: 9.42, fiiFlows: 840, diiFlows: 1240, breadth: 0.72, topGainers: ["SUNPHARMA", "DRREDDY"], topLosers: ["AUROPHARMA", "LUPIN"] },
    { sector: "Auto", weekReturn: 1.42, monthReturn: 3.24, quarterReturn: 7.84, fiiFlows: 1840, diiFlows: 2480, breadth: 0.76, topGainers: ["MARUTI", "M&M", "TATAMOTORS"], topLosers: ["BAJAJ-AUTO"] },
    { sector: "Infrastructure", weekReturn: -0.84, monthReturn: -1.24, quarterReturn: -2.48, fiiFlows: -1840, diiFlows: 840, breadth: 0.38, topGainers: ["L&T"], topLosers: ["DLF", "GODREJPROP"] },
    { sector: "Chemicals", weekReturn: 0.48, monthReturn: 1.84, quarterReturn: 4.28, fiiFlows: 240, diiFlows: 840, breadth: 0.54, topGainers: ["PIDILITIND", "ASAHIINDIA"], topLosers: ["AAVAS", "SRF"] },
  ]);
});

router.get("/earnings-calendar", (req, res) => {
  res.json([
    { id: "ec-1", ticker: "INFY", name: "Infosys", sector: "Technology", date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], quarter: "Q4FY25", estimatedEps: 16.8, previousEps: 16.4, marketCap: 7_21_840, isInPortfolio: true, revenuEst: 43200 },
    { id: "ec-2", ticker: "TCS", name: "TCS", sector: "Technology", date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], quarter: "Q4FY25", estimatedEps: 34.2, previousEps: 33.8, marketCap: 13_74_200, isInPortfolio: true, revenuEst: 63400 },
    { id: "ec-3", ticker: "HDFCBANK", name: "HDFC Bank", sector: "Banking & Finance", date: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], quarter: "Q4FY25", estimatedEps: 22.4, previousEps: 21.8, marketCap: 12_34_820, isInPortfolio: true, revenuEst: null },
    { id: "ec-4", ticker: "RELIANCE", name: "Reliance Industries", sector: "Energy", date: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], quarter: "Q4FY25", estimatedEps: 29.8, previousEps: 28.4, marketCap: 19_28_400, isInPortfolio: true, revenuEst: 248400 },
    { id: "ec-5", ticker: "ZOMATO", name: "Zomato", sector: "Consumer Tech", date: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], quarter: "Q4FY25", estimatedEps: 0.28, previousEps: 0.12, marketCap: 2_18_400, isInPortfolio: false, revenuEst: 4800 },
    { id: "ec-6", ticker: "BAJFINANCE", name: "Bajaj Finance", sector: "Banking & Finance", date: new Date(Date.now() + 24 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], quarter: "Q4FY25", estimatedEps: 62.4, previousEps: 60.2, marketCap: 4_12_240, isInPortfolio: true, revenuEst: null },
    { id: "ec-7", ticker: "MARUTI", name: "Maruti Suzuki", sector: "Auto", date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], quarter: "Q4FY25", estimatedEps: 96.4, previousEps: 88.2, marketCap: 3_24_800, isInPortfolio: true, revenuEst: 42800 },
    { id: "ec-8", ticker: "TRENT", name: "Trent", sector: "Consumer", date: new Date(Date.now() + 26 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], quarter: "Q4FY25", estimatedEps: 14.8, previousEps: 10.2, marketCap: 2_07_200, isInPortfolio: false, revenuEst: 3840 },
  ]);
});

router.get("/economic-calendar", (req, res) => {
  res.json([
    { id: "ev-1", event: "RBI MPC Meeting Decision", date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], country: "India", impact: "high", previous: "6.50%", forecast: "6.50%", actual: null },
    { id: "ev-2", event: "India CPI Inflation (Jun 2025)", date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], country: "India", impact: "high", previous: "5.1%", forecast: "4.9%", actual: null },
    { id: "ev-3", event: "India IIP (May 2025)", date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], country: "India", impact: "medium", previous: "5.8%", forecast: "6.2%", actual: null },
    { id: "ev-4", event: "US Federal Reserve FOMC Minutes", date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], country: "US", impact: "high", previous: null, forecast: null, actual: null },
    { id: "ev-5", event: "US CPI (June 2025)", date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], country: "US", impact: "high", previous: "3.3%", forecast: "3.1%", actual: "3.0%" },
    { id: "ev-6", event: "India WPI Inflation (Jun 2025)", date: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], country: "India", impact: "medium", previous: "2.8%", forecast: "2.6%", actual: null },
    { id: "ev-7", event: "India Trade Balance (Jun 2025)", date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], country: "India", impact: "medium", previous: "-$19.1B", forecast: "-$18.4B", actual: null },
    { id: "ev-8", event: "India GDP Q1FY26 (Advance)", date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], country: "India", impact: "high", previous: "8.4%", forecast: "8.1%", actual: null },
  ]);
});

router.get("/ipos", (req, res) => {
  res.json([
    { id: "ipo-1", name: "Ola Electric Mobility", sector: "Auto", openDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], closeDate: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], issuePrice: 76, lotSize: 195, gmpPct: 22.4, subscriptionStatus: "upcoming", issueSizeInCr: 5500, rating: "Apply" },
    { id: "ipo-2", name: "Swiggy", sector: "Consumer Tech", openDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], closeDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], issuePrice: 390, lotSize: 38, gmpPct: 8.4, subscriptionStatus: "upcoming", issueSizeInCr: 11327, rating: "Avoid" },
    { id: "ipo-3", name: "MobiKwik Systems", sector: "Fintech", openDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], closeDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], issuePrice: 279, lotSize: 53, gmpPct: 34.2, subscriptionStatus: "closed", issueSizeInCr: 572, rating: null },
    { id: "ipo-4", name: "Emcure Pharmaceuticals", sector: "Pharma", openDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], closeDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], issuePrice: 1008, lotSize: 14, gmpPct: 4.2, subscriptionStatus: "listed", issueSizeInCr: 1952, rating: "Apply" },
    { id: "ipo-5", name: "NTPC Green Energy", sector: "Energy", openDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], issuePrice: 108, lotSize: 138, gmpPct: 14.8, subscriptionStatus: "upcoming", issueSizeInCr: 10000, rating: null },
  ]);
});

router.get("/corporate-actions", (req, res) => {
  res.json([
    { id: "ca-1", ticker: "HDFCBANK", name: "HDFC Bank", type: "dividend", exDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], recordDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], details: "Interim Dividend of ₹19 per share (face value ₹1)" },
    { id: "ca-2", ticker: "INFY", name: "Infosys", type: "dividend", exDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], recordDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], details: "Final Dividend of ₹21 per share + Special Dividend ₹8 per share (FY25 closure)" },
    { id: "ca-3", ticker: "TCS", name: "TCS", type: "buyback", exDate: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], recordDate: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], details: "Share Buyback at ₹4,150 per share — total size ₹17,000 Cr. Record date for eligibility." },
    { id: "ca-4", ticker: "PIDILITIND", name: "Pidilite Industries", type: "dividend", exDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], recordDate: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], details: "Final Dividend of ₹12 per share for FY25" },
    { id: "ca-5", ticker: "MARUTI", name: "Maruti Suzuki", type: "dividend", exDate: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], recordDate: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], details: "Final Dividend of ₹125 per share for FY25 — payout ratio 18%" },
    { id: "ca-6", ticker: "ZOMATO", name: "Zomato", type: "split", exDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], recordDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], details: "Stock split in ratio 1:2 — face value ₹1 becomes ₹0.5" },
  ]);
});

router.get("/brokerage-actions", (req, res) => {
  res.json([
    { id: "ba-1", ticker: "INFY", name: "Infosys", date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], broker: "Kotak Securities", action: "upgrade", targetPrice: 2000, previousTarget: 1800, analyst: "Kawaljeet Saluja", rationale: "Deal momentum stronger than expected; GenAI differentiation becoming real. Raise to BUY." },
    { id: "ba-2", ticker: "BAJFINANCE", name: "Bajaj Finance", date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], broker: "HDFC Securities", action: "downgrade", targetPrice: 7200, previousTarget: 8400, analyst: "Krishnan ASV", rationale: "NIM compression and credit cost revision disappoint. Downgrade to NEUTRAL from BUY." },
    { id: "ba-3", ticker: "ASIANPAINT", name: "Asian Paints", date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], broker: "Axis Securities", action: "downgrade", targetPrice: 2800, previousTarget: 3400, analyst: "Preeyam Tolia", rationale: "Margin compression structurally higher than priced in. Competition headwinds real. REDUCE." },
    { id: "ba-4", ticker: "ZOMATO", name: "Zomato", date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], broker: "Nomura", action: "upgrade", targetPrice: 300, previousTarget: 240, analyst: "Vishal Gutka", rationale: "Blinkit profitability ahead of schedule materially de-risks the model. Upgrade to BUY." },
    { id: "ba-5", ticker: "SUNPHARMA", name: "Sun Pharma", date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], broker: "Jefferies", action: "maintain", targetPrice: 1900, previousTarget: 1900, analyst: "Prakash Agarwal", rationale: "US specialty business execution strong; Halol inspection overhang near resolution. BUY." },
    { id: "ba-6", ticker: "TRENT", name: "Trent", date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], broker: "Motilal Oswal", action: "initiate", targetPrice: 6500, previousTarget: null, analyst: "Aniket Sethi", rationale: "Initiating with BUY. Zudio store count fastest-growing format in Indian retail history. Structural share gainer." },
    { id: "ba-7", ticker: "RELIANCE", name: "Reliance Industries", date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], broker: "Morgan Stanley", action: "reiterate", targetPrice: 3400, previousTarget: 3400, analyst: "Mayank Maheshwari", rationale: "Overweight. JFS NBFC potential the next big catalyst. Telecom ARPU expansion on track." },
  ]);
});

router.get("/commodities", (req, res) => {
  res.json([
    { name: "Gold (MCX)", price: 71840, unit: "₹/10g", change: 284.0, changePct: 0.4, asOf: new Date().toISOString() },
    { name: "Crude Oil (WTI)", price: 82.4, unit: "$/bbl", change: -0.84, changePct: -1.01, asOf: new Date().toISOString() },
    { name: "Crude Oil (Brent)", price: 84.8, unit: "$/bbl", change: -0.72, changePct: -0.84, asOf: new Date().toISOString() },
    { name: "Silver (MCX)", price: 86240, unit: "₹/kg", change: -824.0, changePct: -0.95, asOf: new Date().toISOString() },
    { name: "Natural Gas (MCX)", price: 248.4, unit: "₹/MMBtu", change: 4.8, changePct: 1.97, asOf: new Date().toISOString() },
    { name: "Copper (MCX)", price: 842.4, unit: "₹/kg", change: 8.4, changePct: 1.01, asOf: new Date().toISOString() },
    { name: "Zinc (MCX)", price: 284.6, unit: "₹/kg", change: -2.4, changePct: -0.84, asOf: new Date().toISOString() },
    { name: "Cotton (MCX)", price: 61240, unit: "₹/bale", change: 480.0, changePct: 0.79, asOf: new Date().toISOString() },
    { name: "USD/INR", price: 83.42, unit: "₹/$", change: 0.12, changePct: 0.14, asOf: new Date().toISOString() },
  ]);
});

export default router;
