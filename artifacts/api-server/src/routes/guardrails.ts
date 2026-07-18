import { Router, type IRouter, type Request, type Response } from "express";
import { db, guardrailSettingsTable, guardrailAuditTable, type GuardrailSettingsData } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

// ── Default settings ──────────────────────────────────────────────────────
const DEFAULT_SETTINGS: GuardrailSettingsData = {
  portfolioLimits: {
    maxStockConcentrationPct: 20,
    maxSectorConcentrationPct: 35,
    maxSmallCapExposurePct: 20,
    minCashBufferPct: 5,
    maxCorrelatedPositions: 4,
    maxWeeklyNewPositions: 2,
    maxPortfolioDrawdownPct: 15,
  },
  preTradeRequirements: {
    requireRationale: true,
    requireInvestmentHorizon: true,
    requireBearCase: true,
    requireTargetPrice: true,
    requireThesisInvalidation: true,
    requireMaxAcceptableLoss: true,
    requireExitConditions: true,
    minResearchCompletenessScore: 70,
  },
  biasChecks: {
    enabled: true,
    recency: true,
    confirmationBias: true,
    anchoring: true,
    overconfidence: true,
    narrativeBias: true,
    fomo: true,
    revengeTrading: true,
    panicSelling: true,
    overtrading: true,
    unjustifiedAveragingDown: true,
  },
  stressTests: {
    enabled: true,
    marketCorrection: true,
    recession: true,
    rateHike: true,
    crudeShock: true,
    currencyShock: true,
    companySpecific: true,
  },
  guardianMode: {
    enabled: true,
    allowOverrideWithRationale: true,
    requireAuditLog: true,
  },
};

// ── Sector map for stress-test assumptions ────────────────────────────────
const SECTOR_MAP: Record<string, string> = {
  INFY: "IT", TCS: "IT", WIPRO: "IT", HCLTECH: "IT",
  HDFCBANK: "Banking", KOTAKBANK: "Banking", ICICIBANK: "Banking", SBIN: "Banking", AXISBANK: "Banking",
  BAJFINANCE: "NBFC", BAJAJFINSV: "NBFC", MUTHOOTFIN: "NBFC",
  RELIANCE: "Energy", ONGC: "Energy", IOC: "Energy",
  MARUTI: "Auto", TATAMOTORS: "Auto", BAJAJ_AUTO: "Auto", HEROMOTOCO: "Auto",
  SUNPHARMA: "Pharma", DRREDDY: "Pharma", CIPLA: "Pharma",
  ASIANPAINT: "Consumer", DMART: "Consumer", TITAN: "Consumer", PIDILITIND: "Consumer",
};

// ── Research completeness — tickers with full data ────────────────────────
const FULL_RESEARCH_TICKERS = new Set([
  "INFY", "BAJFINANCE", "HDFCBANK", "RELIANCE", "TCS",
  "DMART", "ASIANPAINT", "KOTAKBANK", "MARUTI", "SUNPHARMA", "TITAN", "PIDILITIND",
]);

function calcResearchScore(ticker: string, body: CheckRequest): number {
  if (!FULL_RESEARCH_TICKERS.has(ticker.toUpperCase())) return 30;
  let score = 0;
  if (body.rationale && body.rationale.length > 20) score += 20;
  if (body.bearCase && body.bearCase.length > 10) score += 20;
  if (body.targetPrice && body.targetPrice > 0) score += 20;
  if (body.thesisInvalidation && body.thesisInvalidation.length > 10) score += 15;
  if (body.exitConditions && body.exitConditions.length > 10) score += 10;
  score += 15; // management commentary always present for full-research tickers
  return score;
}

function runStressTests(ticker: string, targetPrice?: number, suggestedPrice?: number) {
  const sector = SECTOR_MAP[ticker.toUpperCase()] ?? "Other";
  const price = suggestedPrice ?? 1000;
  const bearImpactPct = targetPrice && suggestedPrice
    ? ((targetPrice * 0.7 - suggestedPrice) / suggestedPrice) * 100
    : -30;

  const rateHitMap: Record<string, number> = {
    Banking: -8, NBFC: -12, IT: -5, Auto: -6, Pharma: -4,
    Energy: -3, Consumer: -5, Other: -6,
  };
  const crudeMap: Record<string, number> = {
    Energy: 15, Auto: -8, Consumer: -4, IT: -2, Banking: -2, NBFC: -2, Pharma: -3, Other: -3,
  };
  const fxMap: Record<string, number> = {
    IT: 12, Pharma: 8, Energy: -5, Auto: -6, Consumer: -4, Banking: -1, NBFC: -1, Other: -2,
  };

  return [
    {
      scenario: "Market Correction (-20%)",
      portfolioImpactPct: -20,
      positionImpactPct: -20,
      severity: "high" as const,
    },
    {
      scenario: "Recession (-35%)",
      portfolioImpactPct: -35,
      positionImpactPct: -35,
      severity: "critical" as const,
    },
    {
      scenario: "Rate Hike +100bps",
      portfolioImpactPct: -8,
      positionImpactPct: rateHitMap[sector] ?? -6,
      severity: (Math.abs(rateHitMap[sector] ?? -6) >= 10 ? "high" : "medium") as const,
    },
    {
      scenario: "Crude Oil +30%",
      portfolioImpactPct: -3,
      positionImpactPct: crudeMap[sector] ?? -3,
      severity: (Math.abs(crudeMap[sector] ?? -3) >= 8 ? "medium" : "low") as const,
    },
    {
      scenario: "INR Depreciation -10%",
      portfolioImpactPct: 4.5,
      positionImpactPct: fxMap[sector] ?? -2,
      severity: "low" as const,
    },
    {
      scenario: "Company Bear Case",
      portfolioImpactPct: bearImpactPct * 0.15,
      positionImpactPct: bearImpactPct,
      severity: (Math.abs(bearImpactPct) >= 30 ? "high" : "medium") as const,
    },
  ];
}

function detectBiases(body: CheckRequest, settings: GuardrailSettingsData): BiasFlag[] {
  const flags: BiasFlag[] = [];
  if (!settings.biasChecks.enabled) return flags;

  const rationale = (body.rationale ?? "").toLowerCase();
  const action = body.action ?? "";

  if (settings.biasChecks.overconfidence) {
    const overconfidenceWords = ["certain", "definitely", "guaranteed", "can't lose", "cannot lose", "sure thing", "no doubt", "will definitely"];
    const hit = overconfidenceWords.find((w) => rationale.includes(w));
    flags.push({
      bias: "Overconfidence",
      detected: !!hit,
      description: hit
        ? `Rationale contains "${hit}" — avoid certainty language in uncertain markets`
        : "No overconfidence language detected",
      severity: hit ? "warning" : "info",
    });
  }

  if (settings.biasChecks.fomo && ["buy", "add"].includes(action)) {
    const fomoWords = ["missed", "fomo", "running away", "can't miss", "everyone is buying", "all-time high", "momentum"];
    const hit = fomoWords.find((w) => rationale.includes(w));
    flags.push({
      bias: "FOMO",
      detected: !!hit,
      description: hit
        ? `FOMO signal in rationale ("${hit}") — ensure thesis is research-driven, not momentum-driven`
        : "No obvious FOMO language detected",
      severity: hit ? "warning" : "info",
    });
  }

  if (settings.biasChecks.panicSelling && ["sell", "trim", "exit"].includes(action)) {
    const panicWords = ["scared", "worried", "panic", "afraid", "fear", "terrified", "crash"];
    const hit = panicWords.find((w) => rationale.includes(w));
    flags.push({
      bias: "Panic Selling",
      detected: !!hit,
      description: hit
        ? `Emotional language ("${hit}") detected in sell rationale — is this thesis-driven or fear-driven?`
        : "No panic selling signals detected",
      severity: hit ? "warning" : "info",
    });
  }

  if (settings.biasChecks.anchoring && body.targetPrice) {
    const isRound = body.targetPrice % 100 === 0 || body.targetPrice % 500 === 0;
    const noMethodology = !body.rationale?.toLowerCase().includes("dcf") &&
      !body.rationale?.toLowerCase().includes("pe") &&
      !body.rationale?.toLowerCase().includes("abv") &&
      !body.rationale?.toLowerCase().includes("ebitda") &&
      !body.rationale?.toLowerCase().includes("multiple");
    flags.push({
      bias: "Anchoring",
      detected: isRound && noMethodology,
      description: isRound && noMethodology
        ? `Target ₹${body.targetPrice} is a round number with no valuation methodology cited — document DCF/PE/ABV basis`
        : "Target price appears methodology-backed",
      severity: isRound && noMethodology ? "warning" : "info",
    });
  }

  if (settings.biasChecks.narrativeBias) {
    const hasNumbers = /[\d]+/.test(rationale);
    const hasValuation = ["pe", "dcf", "abv", "ebitda", "multiple", "yield", "margin", "roe", "eps"].some((w) => rationale.includes(w));
    flags.push({
      bias: "Narrative Bias",
      detected: !hasValuation,
      description: !hasValuation
        ? "Rationale appears qualitative-only — include at least one quantitative metric (PE, margin, ROE, EPS)"
        : "Quantitative evidence present in rationale",
      severity: !hasValuation ? "warning" : "info",
    });
  }

  if (settings.biasChecks.unjustifiedAveragingDown && ["buy", "add"].includes(action) && (body.currentAllocationPct ?? 0) > 10) {
    flags.push({
      bias: "Averaging Down",
      detected: true,
      description: `Adding to an existing position (${body.currentAllocationPct?.toFixed(1)}% allocation) — verify fresh evidence justifies averaging, not just hope for recovery`,
      severity: "warning",
    });
  }

  return flags;
}

interface CheckRequest {
  action?: string;
  ticker?: string;
  name?: string;
  suggestedQuantity?: number;
  suggestedPrice?: number;
  rationale?: string;
  investmentHorizon?: string;
  bearCase?: string;
  targetPrice?: number;
  thesisInvalidation?: string;
  maxAcceptableLossPct?: number;
  exitConditions?: string;
  currentAllocationPct?: number;
  sectorAllocationPct?: number;
  isSmallCap?: boolean;
}

interface RuleBreachItem {
  ruleId: string;
  ruleName: string;
  currentValue?: number;
  threshold?: number;
  message: string;
  severity: "blocking" | "warning";
}

interface BiasFlag {
  bias: string;
  detected: boolean;
  description: string;
  severity: "warning" | "info";
}

interface PreTradeFailure {
  field: string;
  message: string;
}

function runGuardianCheck(body: CheckRequest, settings: GuardrailSettingsData) {
  const hard: RuleBreachItem[] = [];
  const soft: RuleBreachItem[] = [];
  const preTrade: PreTradeFailure[] = [];
  const passed: string[] = [];

  const limits = settings.portfolioLimits;
  const req = settings.preTradeRequirements;

  // Hard: stock concentration
  if (body.currentAllocationPct !== undefined) {
    if (body.currentAllocationPct > limits.maxStockConcentrationPct) {
      hard.push({
        ruleId: "MAX_STOCK_CONC",
        ruleName: "Max Stock Concentration",
        currentValue: body.currentAllocationPct,
        threshold: limits.maxStockConcentrationPct,
        message: `Position would be ${body.currentAllocationPct.toFixed(1)}% of portfolio — limit is ${limits.maxStockConcentrationPct}%`,
        severity: "blocking",
      });
    } else {
      passed.push(`Stock concentration OK (${body.currentAllocationPct.toFixed(1)}% ≤ ${limits.maxStockConcentrationPct}%)`);
    }
  }

  // Soft: sector concentration
  if (body.sectorAllocationPct !== undefined) {
    if (body.sectorAllocationPct > limits.maxSectorConcentrationPct) {
      soft.push({
        ruleId: "MAX_SECTOR_CONC",
        ruleName: "Max Sector Concentration",
        currentValue: body.sectorAllocationPct,
        threshold: limits.maxSectorConcentrationPct,
        message: `Sector would be ${body.sectorAllocationPct.toFixed(1)}% of portfolio — limit is ${limits.maxSectorConcentrationPct}%`,
        severity: "warning",
      });
    } else {
      passed.push(`Sector concentration OK`);
    }
  }

  // Soft: small-cap exposure
  if (body.isSmallCap) {
    soft.push({
      ruleId: "SMALL_CAP",
      ruleName: "Small-Cap Exposure",
      message: "This is a small-cap stock — verify total small-cap exposure stays within limit",
      severity: "warning",
    });
  }

  // Pre-trade requirements
  if (req.requireRationale) {
    if (!body.rationale || body.rationale.length < 20) {
      preTrade.push({ field: "rationale", message: "Investment rationale required (minimum 20 characters)" });
    } else {
      passed.push("Rationale documented ✓");
    }
  }
  if (req.requireBearCase) {
    if (!body.bearCase || body.bearCase.length < 10) {
      preTrade.push({ field: "bearCase", message: "Bear case required — what could go wrong?" });
    } else {
      passed.push("Bear case documented ✓");
    }
  }
  if (req.requireTargetPrice) {
    if (!body.targetPrice || body.targetPrice <= 0) {
      preTrade.push({ field: "targetPrice", message: "Price target required with valuation methodology" });
    } else {
      passed.push("Target price set ✓");
    }
  }
  if (req.requireThesisInvalidation) {
    if (!body.thesisInvalidation || body.thesisInvalidation.length < 10) {
      preTrade.push({ field: "thesisInvalidation", message: "Thesis invalidation conditions required — what would make you wrong?" });
    } else {
      passed.push("Invalidation conditions defined ✓");
    }
  }
  if (req.requireMaxAcceptableLoss) {
    if (!body.maxAcceptableLossPct || body.maxAcceptableLossPct <= 0) {
      preTrade.push({ field: "maxAcceptableLossPct", message: "Maximum acceptable loss % required" });
    } else {
      passed.push("Max loss defined ✓");
    }
  }
  if (req.requireInvestmentHorizon) {
    if (!body.investmentHorizon || body.investmentHorizon.length < 3) {
      soft.push({
        ruleId: "INVESTMENT_HORIZON",
        ruleName: "Investment Horizon",
        message: "Investment horizon not specified — document expected holding period",
        severity: "warning",
      });
    } else {
      passed.push("Investment horizon documented ✓");
    }
  }
  if (req.requireExitConditions) {
    if (!body.exitConditions || body.exitConditions.length < 10) {
      soft.push({
        ruleId: "EXIT_CONDITIONS",
        ruleName: "Exit Conditions",
        message: "Exit conditions not defined — when will you sell?",
        severity: "warning",
      });
    } else {
      passed.push("Exit conditions defined ✓");
    }
  }

  // Research completeness
  const researchScore = calcResearchScore(body.ticker ?? "", body);
  if (researchScore < req.minResearchCompletenessScore) {
    soft.push({
      ruleId: "RESEARCH_SCORE",
      ruleName: "Research Completeness",
      currentValue: researchScore,
      threshold: req.minResearchCompletenessScore,
      message: `Research completeness score ${researchScore}/100 — minimum is ${req.minResearchCompletenessScore}`,
      severity: "warning",
    });
  } else {
    passed.push(`Research completeness OK (${researchScore}/100)`);
  }

  // Determine guardian decision
  let decision: "approve" | "approve_with_warnings" | "require_evidence" | "reject";
  let severity: "low" | "medium" | "high" | "critical";
  let summary: string;

  if (hard.length > 0) {
    decision = "reject";
    severity = "critical";
    summary = `Action blocked: ${hard.length} hard rule breach${hard.length > 1 ? "es" : ""} detected. ${hard[0].message}`;
  } else if (preTrade.length > 0) {
    decision = "require_evidence";
    severity = "high";
    summary = `${preTrade.length} required pre-trade field${preTrade.length > 1 ? "s" : ""} missing before this action can proceed.`;
  } else if (soft.length > 0) {
    decision = "approve_with_warnings";
    severity = soft.length >= 3 ? "high" : "medium";
    summary = `Action approved with ${soft.length} warning${soft.length > 1 ? "s" : ""}. Review before proceeding.`;
  } else {
    decision = "approve";
    severity = "low";
    summary = `All guardrail checks passed. Action approved by Guardian Mode.`;
  }

  return { hard, soft, preTrade, passed, decision, severity, summary, researchScore };
}

// ── GET /guardrails/settings ────────────────────────────────────────────────
router.get("/settings", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    // Return defaults for unauthenticated (demo mode)
    res.json({ settings: DEFAULT_SETTINGS, isDefault: true });
    return;
  }

  const [row] = await db
    .select()
    .from(guardrailSettingsTable)
    .where(eq(guardrailSettingsTable.userId, req.user.id));

  res.json({ settings: row?.settings ?? DEFAULT_SETTINGS, isDefault: !row });
});

// ── PUT /guardrails/settings ────────────────────────────────────────────────
router.put("/settings", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required to save settings" });
    return;
  }

  const partial = req.body as Partial<GuardrailSettingsData>;
  const [existing] = await db
    .select()
    .from(guardrailSettingsTable)
    .where(eq(guardrailSettingsTable.userId, req.user.id));

  const merged: GuardrailSettingsData = {
    portfolioLimits: { ...DEFAULT_SETTINGS.portfolioLimits, ...(existing?.settings?.portfolioLimits ?? {}), ...(partial.portfolioLimits ?? {}) },
    preTradeRequirements: { ...DEFAULT_SETTINGS.preTradeRequirements, ...(existing?.settings?.preTradeRequirements ?? {}), ...(partial.preTradeRequirements ?? {}) },
    biasChecks: { ...DEFAULT_SETTINGS.biasChecks, ...(existing?.settings?.biasChecks ?? {}), ...(partial.biasChecks ?? {}) },
    stressTests: { ...DEFAULT_SETTINGS.stressTests, ...(existing?.settings?.stressTests ?? {}), ...(partial.stressTests ?? {}) },
    guardianMode: { ...DEFAULT_SETTINGS.guardianMode, ...(existing?.settings?.guardianMode ?? {}), ...(partial.guardianMode ?? {}) },
  };

  if (existing) {
    await db
      .update(guardrailSettingsTable)
      .set({ settings: merged, updatedAt: new Date() })
      .where(eq(guardrailSettingsTable.userId, req.user.id));
  } else {
    await db.insert(guardrailSettingsTable).values({ userId: req.user.id, settings: merged });
  }

  res.json({ settings: merged });
});

// ── POST /guardrails/check ─────────────────────────────────────────────────
router.post("/check", async (req: Request, res: Response) => {
  const body = req.body as CheckRequest;

  // Load settings (user-specific if authenticated, else defaults)
  let settings = DEFAULT_SETTINGS;
  if (req.isAuthenticated()) {
    const [row] = await db
      .select()
      .from(guardrailSettingsTable)
      .where(eq(guardrailSettingsTable.userId, req.user.id));
    if (row) settings = row.settings;
  }

  const { hard, soft, preTrade, passed, decision, severity, summary, researchScore } = runGuardianCheck(body, settings);
  const biasFlags = detectBiases(body, settings);
  const stressTests = settings.stressTests.enabled && ["buy", "add"].includes(body.action ?? "")
    ? runStressTests(body.ticker ?? "", body.targetPrice, body.suggestedPrice)
    : [];

  const checkId = crypto.randomBytes(16).toString("hex");

  const detectedBiases = biasFlags.filter((b) => b.detected).map((b) => b.bias);
  const breachedRuleNames = [...hard.map((r) => r.ruleName), ...preTrade.map((p) => p.field)];

  // Auto-log to audit trail if authenticated
  if (req.isAuthenticated() && settings.guardianMode.requireAuditLog) {
    await db.insert(guardrailAuditTable).values({
      userId: req.user.id,
      checkId,
      ticker: body.ticker ?? "",
      name: body.name,
      action: body.action ?? "review",
      guardianDecision: decision,
      severity,
      breachedRules: breachedRuleNames,
      biasFlags: detectedBiases,
      preTradeFailures: preTrade.map((p) => p.field),
      researchCompletenessScore: researchScore,
      isOverride: false,
      finalAction: "pending",
    });
  }

  res.json({
    checkId,
    decision,
    severity,
    summary,
    hardRuleBreaches: hard,
    softRuleWarnings: soft,
    preTradeFailures: preTrade,
    biasFlags,
    stressTestResults: stressTests,
    researchCompletenessScore: researchScore,
    researchCompletenessBreakdown: {
      rationale: !!(body.rationale && body.rationale.length > 20),
      bearCase: !!(body.bearCase && body.bearCase.length > 10),
      targetPrice: !!(body.targetPrice && body.targetPrice > 0),
      thesisInvalidation: !!(body.thesisInvalidation && body.thesisInvalidation.length > 10),
      exitConditions: !!(body.exitConditions && body.exitConditions.length > 10),
      managementCommentary: FULL_RESEARCH_TICKERS.has((body.ticker ?? "").toUpperCase()),
    },
    passedChecks: passed,
    requiresOverride: decision === "reject",
    canOverride: settings.guardianMode.allowOverrideWithRationale,
    timestamp: new Date().toISOString(),
  });
});

// ── POST /guardrails/execute ───────────────────────────────────────────────
router.post("/execute", async (req: Request, res: Response) => {
  const { checkId, action, ticker, name, overrideRationale, userConfirmed } = req.body as {
    checkId: string;
    action: string;
    ticker: string;
    name?: string;
    overrideRationale?: string;
    userConfirmed: boolean;
  };

  if (!userConfirmed) {
    res.status(400).json({ error: "User confirmation required" });
    return;
  }

  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required to log execution" });
    return;
  }

  // Find and update the audit entry
  const [existing] = await db
    .select()
    .from(guardrailAuditTable)
    .where(eq(guardrailAuditTable.checkId, checkId));

  if (existing) {
    const isOverride = existing.guardianDecision === "reject" || !!overrideRationale;
    if (isOverride && !overrideRationale) {
      res.status(400).json({ error: "Override rationale required for blocked actions" });
      return;
    }
    await db
      .update(guardrailAuditTable)
      .set({
        isOverride,
        overrideRationale: overrideRationale ?? null,
        finalAction: "executed",
      })
      .where(eq(guardrailAuditTable.id, existing.id));

    res.json({ success: true, auditId: existing.id, isOverride });
  } else {
    // Create new entry if checkId not found (e.g., demo mode)
    const [row] = await db.insert(guardrailAuditTable).values({
      userId: req.user.id,
      checkId,
      ticker,
      name,
      action,
      guardianDecision: "approve",
      severity: "low",
      isOverride: false,
      overrideRationale: overrideRationale ?? null,
      finalAction: "executed",
    }).returning();
    res.json({ success: true, auditId: row.id, isOverride: false });
  }
});

// ── GET /guardrails/audit-trail ────────────────────────────────────────────
router.get("/audit-trail", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    // Return demo audit trail for unauthenticated users
    res.json({
      entries: DEMO_AUDIT_TRAIL,
      isDemo: true,
      message: "Sign in to see your personal audit trail",
    });
    return;
  }

  const entries = await db
    .select()
    .from(guardrailAuditTable)
    .where(eq(guardrailAuditTable.userId, req.user.id))
    .orderBy(desc(guardrailAuditTable.createdAt))
    .limit(100);

  res.json({ entries, isDemo: false });
});

// ── GET /guardrails/portfolio-health ───────────────────────────────────────
router.get("/portfolio-health", async (_req: Request, res: Response) => {
  // Computed from the demo portfolio; will be user-specific when live data is connected
  res.json({
    score: 71,
    band: "caution",
    components: [
      { name: "Thesis Integrity", score: 16, maxScore: 20, description: "2 positions weakening, 0 thesis breaks" },
      { name: "Conviction Distribution", score: 14, maxScore: 20, description: "7 High, 3 Medium, 2 Low — concentrated in high-conviction" },
      { name: "Concentration Risk", score: 15, maxScore: 20, description: "Max position 15.2%. Sector max 30.1%" },
      { name: "Alert Severity", score: 10, maxScore: 20, description: "3 active alerts (2 high severity)" },
      { name: "Diversification", score: 16, maxScore: 20, description: "5 sectors, 12 stocks. Tech + Finance dominant" },
    ],
    activeAlertCount: 3,
    thesisBrokenCount: 0,
    thesisWeakeningCount: 2,
    topRisks: [
      "Bajaj Finance NIM compression — thesis assumption under pressure",
      "Asian Paints margin deterioration — competition from Birla Opus accelerating",
      "HDFC Bank promoter pledge level — monitor for escalation",
    ],
    cashBufferPct: 2.6,
    cashBufferBelowLimit: true,
    lastCalculated: new Date().toISOString(),
    dataSource: "DEMO — connect live portfolio for real calculations",
  });
});

// ── Demo audit trail (shown when not authenticated) ────────────────────────
const DEMO_AUDIT_TRAIL = [
  {
    id: 1,
    checkId: "demo-1",
    ticker: "INFY",
    name: "Infosys",
    action: "add",
    guardianDecision: "approve",
    severity: "low",
    breachedRules: [],
    biasFlags: [],
    preTradeFailures: [],
    researchCompletenessScore: 100,
    isOverride: false,
    overrideRationale: null,
    finalAction: "executed",
    createdAt: "2026-07-10T10:22:00Z",
  },
  {
    id: 2,
    checkId: "demo-2",
    ticker: "BAJFINANCE",
    name: "Bajaj Finance",
    action: "trim",
    guardianDecision: "approve_with_warnings",
    severity: "medium",
    breachedRules: ["Exit Conditions"],
    biasFlags: ["Narrative Bias"],
    preTradeFailures: [],
    researchCompletenessScore: 85,
    isOverride: false,
    overrideRationale: null,
    finalAction: "executed",
    createdAt: "2026-07-08T14:05:00Z",
  },
  {
    id: 3,
    checkId: "demo-3",
    ticker: "ASIANPAINT",
    name: "Asian Paints",
    action: "buy",
    guardianDecision: "require_evidence",
    severity: "high",
    breachedRules: [],
    biasFlags: [],
    preTradeFailures: ["bearCase", "thesisInvalidation", "maxAcceptableLossPct"],
    researchCompletenessScore: 60,
    isOverride: false,
    overrideRationale: null,
    finalAction: "cancelled",
    createdAt: "2026-07-05T09:30:00Z",
  },
  {
    id: 4,
    checkId: "demo-4",
    ticker: "ZOMATO",
    name: "Zomato",
    action: "buy",
    guardianDecision: "reject",
    severity: "critical",
    breachedRules: ["Max Stock Concentration"],
    biasFlags: ["FOMO"],
    preTradeFailures: [],
    researchCompletenessScore: 30,
    isOverride: true,
    overrideRationale: "High conviction despite concentration breach — reducing position in DMART to compensate",
    finalAction: "executed",
    createdAt: "2026-07-01T11:45:00Z",
  },
  {
    id: 5,
    checkId: "demo-5",
    ticker: "DMART",
    name: "Avenue Supermarts",
    action: "add",
    guardianDecision: "approve",
    severity: "low",
    breachedRules: [],
    biasFlags: [],
    preTradeFailures: [],
    researchCompletenessScore: 100,
    isOverride: false,
    overrideRationale: null,
    finalAction: "executed",
    createdAt: "2026-06-28T13:10:00Z",
  },
];

export default router;
