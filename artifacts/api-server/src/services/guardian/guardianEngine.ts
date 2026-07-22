export type GuardianAction =
  | "buy"
  | "add"
  | "sell"
  | "trim"
  | "exit"
  | "hold"
  | "review";

export interface GuardianSettings {
  portfolioLimits: {
    maxStockConcentrationPct: number;
    maxSectorConcentrationPct: number;
    maxSmallCapExposurePct: number;
    minCashBufferPct: number;
    maxCorrelatedPositions: number;
    maxWeeklyNewPositions: number;
    maxPortfolioDrawdownPct: number;
  };
  preTradeRequirements: {
    requireRationale: boolean;
    requireInvestmentHorizon: boolean;
    requireBearCase: boolean;
    requireTargetPrice: boolean;
    requireThesisInvalidation: boolean;
    requireMaxAcceptableLoss: boolean;
    requireExitConditions: boolean;
    minResearchCompletenessScore: number;
  };
  biasChecks: {
    enabled: boolean;
    recency: boolean;
    confirmationBias: boolean;
    anchoring: boolean;
    overconfidence: boolean;
    narrativeBias: boolean;
    fomo: boolean;
    revengeTrading: boolean;
    panicSelling: boolean;
    overtrading: boolean;
    unjustifiedAveragingDown: boolean;
  };
  stressTests: {
    enabled: boolean;
    marketCorrection: boolean;
    recession: boolean;
    rateHike: boolean;
    crudeShock: boolean;
    currencyShock: boolean;
    companySpecific: boolean;
  };
  guardianMode: {
    enabled: boolean;
    allowOverrideWithRationale: boolean;
    requireAuditLog: boolean;
  };
}

export interface GuardianHoldingContext {
  ticker: string;
  name: string;
  sector: string;
  quantity: number;
  averageCost: number;
  marketPrice: number;
  marketValue: number;
  allocationPct: number;
  unrealizedPnlPct: number;
}

export interface GuardianPortfolioContext {
  portfolioId: number;
  totalValue: number;
  cashBalance: number;
  cashBufferPct: number;
  holdings: GuardianHoldingContext[];
  sectorAllocation: Array<{ sector: string; value: number; allocationPct: number }>;
  largestPositionPct: number;
  topFiveConcentrationPct: number;
  maxDrawdownPct: number;
  weeklyNewPositions: number;
  weeklyPortfolioChanges: number;
  smallCapExposurePct: number;
  correlatedClusters: Array<{ label: string; tickers: string[]; count: number }>;
  priceCoveragePct: number;
}

export interface GuardianResearchContext {
  ticker: string;
  isCovered: boolean;
  completenessScore: number;
  thesisStatus: "draft" | "intact" | "monitoring" | "weakening" | "broken" | "closed";
  conviction: "high" | "medium" | "low" | "watch";
  targetPrice: number | null;
  bearPrice: number | null;
  maxAcceptableLossPct: number | null;
  investmentHorizon: string | null;
  invalidationCount: number;
  riskCount: number;
  sourceCount: number;
  lastReviewedAt: string | null;
  isSmallCap: boolean;
}

export interface GuardianMarketContext {
  priceChange5dPct: number | null;
  highSeverityNewsCount: number;
  negativeNewsCount: number;
  latestNewsAt: string | null;
  priceAsOf: string | null;
}

export interface GuardianProposal {
  action: GuardianAction;
  ticker: string;
  name?: string | null;
  quantity?: number | null;
  price?: number | null;
  fees?: number | null;
  rationale?: string | null;
  investmentHorizon?: string | null;
  bearCase?: string | null;
  targetPrice?: number | null;
  thesisInvalidation?: string | null;
  maxAcceptableLossPct?: number | null;
  exitConditions?: string | null;
  evidenceQuality?: "high" | "medium" | "low" | null;
  citedSourceIds?: string[];
}

export interface GuardianRuleResult {
  ruleId: string;
  ruleName: string;
  currentValue?: number | null;
  projectedValue?: number | null;
  threshold?: number | null;
  message: string;
  severity: "blocking" | "warning";
}

export interface GuardianBiasFlag {
  bias: string;
  detected: boolean;
  description: string;
  severity: "warning" | "info";
}

export interface GuardianStressResult {
  scenario: string;
  portfolioImpactPct: number;
  portfolioImpactAmount: number;
  positionImpactPct: number;
  positionImpactAmount: number;
  severity: "low" | "medium" | "high" | "critical";
  methodology: string;
}

export interface GuardianCheckResult {
  decision: "approve" | "approve_with_warnings" | "require_evidence" | "reject";
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
  hardRuleBreaches: GuardianRuleResult[];
  softRuleWarnings: GuardianRuleResult[];
  preTradeFailures: Array<{ field: string; message: string }>;
  biasFlags: GuardianBiasFlag[];
  stressTestResults: GuardianStressResult[];
  passedChecks: string[];
  researchCompletenessScore: number;
  projected: {
    tradeNotional: number;
    cashBalance: number;
    cashBufferPct: number;
    stockAllocationPct: number;
    sectorAllocationPct: number;
    quantity: number;
  };
  requiresOverride: boolean;
  canOverride: boolean;
}

function pct(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function includesAny(text: string, values: string[]): string | null {
  return values.find((value) => text.includes(value)) ?? null;
}

function getSectorSensitivity(sector: string) {
  const value = sector.toLowerCase();
  if (value.includes("bank") || value.includes("finance") || value.includes("nbfc")) {
    return { rate: -11, crude: -2, currency: -1, recession: -38 };
  }
  if (value.includes("technology") || value === "it") {
    return { rate: -4, crude: -1, currency: 10, recession: -31 };
  }
  if (value.includes("auto")) {
    return { rate: -7, crude: -9, currency: -5, recession: -40 };
  }
  if (value.includes("energy") || value.includes("oil")) {
    return { rate: -3, crude: 14, currency: -4, recession: -28 };
  }
  if (value.includes("pharma") || value.includes("health")) {
    return { rate: -3, crude: -2, currency: 7, recession: -20 };
  }
  if (value.includes("consumer")) {
    return { rate: -5, crude: -5, currency: -3, recession: -30 };
  }
  return { rate: -6, crude: -3, currency: -2, recession: -32 };
}

function projectedState(
  proposal: GuardianProposal,
  portfolio: GuardianPortfolioContext,
) {
  const holding = portfolio.holdings.find(
    (item) => item.ticker === proposal.ticker.toUpperCase(),
  );
  const quantity = Math.max(0, proposal.quantity ?? 0);
  const price = Math.max(0, proposal.price ?? holding?.marketPrice ?? 0);
  const fees = Math.max(0, proposal.fees ?? 0);
  const isBuy = proposal.action === "buy" || proposal.action === "add";
  const isSell = proposal.action === "sell" || proposal.action === "trim" || proposal.action === "exit";
  const tradeNotional = quantity * price;
  const signedCash = isBuy
    ? -(tradeNotional + fees)
    : isSell
      ? tradeNotional - fees
      : 0;
  const signedPosition = isBuy ? tradeNotional : isSell ? -tradeNotional : 0;
  const projectedCash = portfolio.cashBalance + signedCash;
  const projectedTotal = Math.max(0, portfolio.totalValue - fees);
  const projectedHoldingValue = Math.max(0, (holding?.marketValue ?? 0) + signedPosition);
  const sector = holding?.sector ?? "Unclassified";
  const currentSector = portfolio.sectorAllocation.find((item) => item.sector === sector);
  const projectedSectorValue = Math.max(0, (currentSector?.value ?? 0) + signedPosition);
  const projectedQuantity = Math.max(
    0,
    (holding?.quantity ?? 0) + (isBuy ? quantity : isSell ? -quantity : 0),
  );
  return {
    holding,
    sector,
    quantity,
    price,
    tradeNotional,
    projectedCash,
    projectedTotal,
    projectedHoldingValue,
    projectedSectorValue,
    projectedQuantity,
    stockAllocationPct: pct(projectedHoldingValue, projectedTotal),
    sectorAllocationPct: pct(projectedSectorValue, projectedTotal),
    cashBufferPct: pct(projectedCash, projectedTotal),
    isBuy,
    isSell,
  };
}

function detectBiases(
  proposal: GuardianProposal,
  portfolio: GuardianPortfolioContext,
  research: GuardianResearchContext | null,
  market: GuardianMarketContext | null,
  settings: GuardianSettings,
): GuardianBiasFlag[] {
  if (!settings.biasChecks.enabled) return [];
  const rationale = (proposal.rationale ?? "").toLowerCase();
  const flags: GuardianBiasFlag[] = [];
  const add = (
    enabled: boolean,
    bias: string,
    detected: boolean,
    description: string,
  ) => {
    if (!enabled) return;
    flags.push({ bias, detected, description, severity: detected ? "warning" : "info" });
  };

  const overconfidence = includesAny(rationale, [
    "guaranteed",
    "cannot lose",
    "can't lose",
    "definitely",
    "certain",
    "sure thing",
    "no downside",
  ]);
  add(
    settings.biasChecks.overconfidence,
    "Overconfidence",
    Boolean(overconfidence),
    overconfidence
      ? `Certainty language detected: “${overconfidence}”. Markets remain probabilistic.`
      : "No obvious certainty language detected.",
  );

  const fomoLanguage = includesAny(rationale, [
    "fomo",
    "running away",
    "can't miss",
    "everyone is buying",
    "before it is too late",
    "momentum",
  ]);
  const sharpMove = Math.abs(market?.priceChange5dPct ?? 0) >= 8;
  add(
    settings.biasChecks.fomo,
    "FOMO",
    (proposal.action === "buy" || proposal.action === "add") && Boolean(fomoLanguage || sharpMove),
    fomoLanguage
      ? `Urgency language detected: “${fomoLanguage}”.`
      : sharpMove
        ? `The stock moved ${round(market?.priceChange5dPct ?? 0, 1)}% in five days; require fresh evidence rather than price-chasing.`
        : "No obvious FOMO signal detected.",
  );

  const panicLanguage = includesAny(rationale, [
    "panic",
    "terrified",
    "scared",
    "crash",
    "get out now",
    "afraid",
  ]);
  add(
    settings.biasChecks.panicSelling,
    "Panic Selling",
    Boolean(panicLanguage) && (proposal.action === "sell" || proposal.action === "trim" || proposal.action === "exit"),
    panicLanguage
      ? `Emotional sell language detected: “${panicLanguage}”. Reconcile the action with thesis evidence.`
      : "No obvious panic-selling language detected.",
  );

  const methodologyWords = ["dcf", "pe", "p/e", "ev/ebitda", "abv", "book value", "multiple", "yield"];
  const hasMethodology = methodologyWords.some((word) => rationale.includes(word));
  const roundTarget = Boolean(proposal.targetPrice && proposal.targetPrice % 100 === 0);
  add(
    settings.biasChecks.anchoring,
    "Anchoring",
    roundTarget && !hasMethodology,
    roundTarget && !hasMethodology
      ? "The target is a round number without a valuation method in the rationale."
      : "Target-price anchoring was not detected.",
  );

  const hasNumbers = /\d/.test(rationale);
  add(
    settings.biasChecks.narrativeBias,
    "Narrative Bias",
    Boolean(rationale) && (!hasNumbers || !hasMethodology),
    Boolean(rationale) && (!hasNumbers || !hasMethodology)
      ? "The rationale is largely qualitative; add measurable evidence and valuation support."
      : "The rationale contains quantitative or valuation evidence.",
  );

  const missingContraryEvidence = !proposal.bearCase || proposal.bearCase.trim().length < 20;
  add(
    settings.biasChecks.confirmationBias,
    "Confirmation Bias",
    missingContraryEvidence && (proposal.action === "buy" || proposal.action === "add"),
    missingContraryEvidence
      ? "A sufficiently developed bear case is missing from a buy/add decision."
      : "Contrary evidence is documented.",
  );

  const currentHolding = portfolio.holdings.find((item) => item.ticker === proposal.ticker.toUpperCase());
  const averagingDown =
    (proposal.action === "buy" || proposal.action === "add") &&
    Boolean(currentHolding && currentHolding.unrealizedPnlPct <= -15) &&
    (research?.lastReviewedAt ? Date.now() - new Date(research.lastReviewedAt).getTime() > 30 * 86_400_000 : true);
  add(
    settings.biasChecks.unjustifiedAveragingDown,
    "Unjustified Averaging Down",
    averagingDown,
    averagingDown
      ? `The position is down ${round(currentHolding?.unrealizedPnlPct ?? 0, 1)}% and the thesis has not been reviewed recently.`
      : "No unsupported averaging-down pattern detected.",
  );

  add(
    settings.biasChecks.overtrading,
    "Overtrading",
    portfolio.weeklyPortfolioChanges >= 3,
    portfolio.weeklyPortfolioChanges >= 3
      ? `${portfolio.weeklyPortfolioChanges} portfolio changes were recorded in the last seven days.`
      : "Weekly transaction frequency is within the behavioural threshold.",
  );

  const recencyDetected =
    settings.biasChecks.recency &&
    Boolean(market?.latestNewsAt) &&
    Date.now() - new Date(market!.latestNewsAt!).getTime() < 48 * 3_600_000;
  add(
    settings.biasChecks.recency,
    "Recency Bias",
    recencyDetected && Boolean(market?.highSeverityNewsCount),
    recencyDetected && Boolean(market?.highSeverityNewsCount)
      ? "A high-impact news item was published within 48 hours; separate durable thesis change from short-term reaction."
      : "No high-impact 48-hour recency trigger detected.",
  );

  return flags;
}

function runStressTests(
  proposal: GuardianProposal,
  portfolio: GuardianPortfolioContext,
  research: GuardianResearchContext | null,
  projected: ReturnType<typeof projectedState>,
  settings: GuardianSettings,
): GuardianStressResult[] {
  if (!settings.stressTests.enabled) return [];
  const sensitivity = getSectorSensitivity(projected.sector);
  const positionValue = projected.projectedHoldingValue;
  const results: GuardianStressResult[] = [];
  const add = (
    enabled: boolean,
    scenario: string,
    portfolioImpactPct: number,
    positionImpactPct: number,
    methodology: string,
  ) => {
    if (!enabled) return;
    const severity: GuardianStressResult["severity"] =
      portfolioImpactPct <= -30 || positionImpactPct <= -40
        ? "critical"
        : portfolioImpactPct <= -15 || positionImpactPct <= -25
          ? "high"
          : portfolioImpactPct <= -7 || positionImpactPct <= -12
            ? "medium"
            : "low";
    results.push({
      scenario,
      portfolioImpactPct: round(portfolioImpactPct),
      portfolioImpactAmount: round((portfolio.totalValue * portfolioImpactPct) / 100),
      positionImpactPct: round(positionImpactPct),
      positionImpactAmount: round((positionValue * positionImpactPct) / 100),
      severity,
      methodology,
    });
  };

  add(settings.stressTests.marketCorrection, "Broad market correction (-20%)", -20, -22, "Linear equity shock with modest high-beta uplift at position level.");
  add(settings.stressTests.recession, "Recession", -32, sensitivity.recession, "Sector sensitivity matrix applied to a broad recession drawdown.");
  add(settings.stressTests.rateHike, "RBI rate shock (+100 bps)", -7, sensitivity.rate, "Sector-level rate sensitivity; not a forecast or VaR model.");
  add(settings.stressTests.crudeShock, "Crude oil shock (+30%)", -3, sensitivity.crude, "Sector-level crude input/revenue sensitivity.");
  add(settings.stressTests.currencyShock, "INR depreciation (-10%)", 2, sensitivity.currency, "Sector-level translation and input-cost sensitivity.");

  const bearPrice = research?.bearPrice ?? null;
  const companyImpact = bearPrice && projected.price > 0
    ? ((bearPrice - projected.price) / projected.price) * 100
    : -(proposal.maxAcceptableLossPct ?? research?.maxAcceptableLossPct ?? 25);
  add(settings.stressTests.companySpecific, "Company bear case", companyImpact * (projected.stockAllocationPct / 100), companyImpact, bearPrice ? "Research bear value compared with proposed execution price." : "Maximum acceptable loss used because no research bear value is available.");
  return results;
}

export function runGuardianCheck(args: {
  proposal: GuardianProposal;
  portfolio: GuardianPortfolioContext;
  research: GuardianResearchContext | null;
  market: GuardianMarketContext | null;
  settings: GuardianSettings;
}): GuardianCheckResult {
  const { proposal, portfolio, research, market, settings } = args;
  const projected = projectedState(proposal, portfolio);
  const hard: GuardianRuleResult[] = [];
  const soft: GuardianRuleResult[] = [];
  const failures: Array<{ field: string; message: string }> = [];
  const passed: string[] = [];
  const limits = settings.portfolioLimits;
  const requirements = settings.preTradeRequirements;
  const ticker = proposal.ticker.toUpperCase();

  if (!settings.guardianMode.enabled) {
    return {
      decision: "approve_with_warnings",
      severity: "medium",
      summary: "Guardian Mode is disabled. The action was not policy-screened.",
      hardRuleBreaches: [],
      softRuleWarnings: [{ ruleId: "GUARDIAN_DISABLED", ruleName: "Guardian Mode", message: "Guardian Mode is disabled in settings.", severity: "warning" }],
      preTradeFailures: [],
      biasFlags: [],
      stressTestResults: [],
      passedChecks: [],
      researchCompletenessScore: research?.completenessScore ?? 0,
      projected: {
        tradeNotional: projected.tradeNotional,
        cashBalance: projected.projectedCash,
        cashBufferPct: projected.cashBufferPct,
        stockAllocationPct: projected.stockAllocationPct,
        sectorAllocationPct: projected.sectorAllocationPct,
        quantity: projected.projectedQuantity,
      },
      requiresOverride: false,
      canOverride: settings.guardianMode.allowOverrideWithRationale,
    };
  }

  if (projected.isSell && projected.quantity > (projected.holding?.quantity ?? 0) + 1e-8) {
    hard.push({ ruleId: "OVERSELL", ruleName: "Available Quantity", currentValue: projected.holding?.quantity ?? 0, projectedValue: projected.quantity, message: `Requested quantity ${projected.quantity} exceeds the available ${projected.holding?.quantity ?? 0}.`, severity: "blocking" });
  }

  if (projected.isBuy && projected.projectedCash < -0.01) {
    hard.push({ ruleId: "NEGATIVE_CASH", ruleName: "Available Cash", currentValue: portfolio.cashBalance, projectedValue: projected.projectedCash, threshold: 0, message: "The proposed purchase would create a negative cash balance.", severity: "blocking" });
  }

  if (projected.isBuy && projected.stockAllocationPct > limits.maxStockConcentrationPct) {
    hard.push({ ruleId: "MAX_STOCK_CONCENTRATION", ruleName: "Maximum Stock Concentration", currentValue: projected.holding?.allocationPct ?? 0, projectedValue: projected.stockAllocationPct, threshold: limits.maxStockConcentrationPct, message: `${ticker} would represent ${round(projected.stockAllocationPct, 1)}% of the portfolio versus the ${limits.maxStockConcentrationPct}% limit.`, severity: "blocking" });
  } else {
    passed.push(`Projected stock concentration is ${round(projected.stockAllocationPct, 1)}%.`);
  }

  const isNewPosition = projected.isBuy && !projected.holding;
  if (isNewPosition && portfolio.weeklyNewPositions + 1 > limits.maxWeeklyNewPositions) {
    hard.push({ ruleId: "WEEKLY_NEW_POSITIONS", ruleName: "Weekly New Position Limit", currentValue: portfolio.weeklyNewPositions, projectedValue: portfolio.weeklyNewPositions + 1, threshold: limits.maxWeeklyNewPositions, message: "This initiation would exceed the weekly new-position limit.", severity: "blocking" });
  }

  if (projected.isBuy && portfolio.maxDrawdownPct > limits.maxPortfolioDrawdownPct) {
    hard.push({ ruleId: "DRAWDOWN_LOCK", ruleName: "Portfolio Drawdown Lock", currentValue: portfolio.maxDrawdownPct, threshold: limits.maxPortfolioDrawdownPct, message: "New risk is blocked while portfolio drawdown exceeds the configured limit.", severity: "blocking" });
  }

  if (projected.isBuy && research?.thesisStatus === "broken") {
    hard.push({ ruleId: "BROKEN_THESIS", ruleName: "Broken Thesis", message: "Buying or adding is blocked while the stored thesis is marked broken.", severity: "blocking" });
  }

  if (projected.isBuy && projected.sectorAllocationPct > limits.maxSectorConcentrationPct) {
    soft.push({ ruleId: "MAX_SECTOR_CONCENTRATION", ruleName: "Maximum Sector Concentration", projectedValue: projected.sectorAllocationPct, threshold: limits.maxSectorConcentrationPct, message: `${projected.sector} would represent ${round(projected.sectorAllocationPct, 1)}% of the portfolio.`, severity: "warning" });
  }

  if (projected.isBuy && projected.cashBufferPct < limits.minCashBufferPct) {
    soft.push({ ruleId: "MIN_CASH_BUFFER", ruleName: "Minimum Cash Buffer", currentValue: portfolio.cashBufferPct, projectedValue: projected.cashBufferPct, threshold: limits.minCashBufferPct, message: `Cash would fall to ${round(projected.cashBufferPct, 1)}% versus the ${limits.minCashBufferPct}% minimum.`, severity: "warning" });
  }

  if (research?.isSmallCap && projected.isBuy && portfolio.smallCapExposurePct + projected.stockAllocationPct > limits.maxSmallCapExposurePct) {
    soft.push({ ruleId: "SMALL_CAP_EXPOSURE", ruleName: "Small-Cap Exposure", currentValue: portfolio.smallCapExposurePct, projectedValue: portfolio.smallCapExposurePct + projected.stockAllocationPct, threshold: limits.maxSmallCapExposurePct, message: "Projected small-cap exposure exceeds the configured limit.", severity: "warning" });
  }

  if (projected.isBuy && research?.thesisStatus === "weakening") {
    soft.push({ ruleId: "WEAKENING_THESIS", ruleName: "Weakening Thesis", message: "The stored thesis is weakening; document the fresh evidence supporting additional capital.", severity: "warning" });
  }

  if (portfolio.correlatedClusters.some((cluster) => cluster.count > limits.maxCorrelatedPositions)) {
    soft.push({ ruleId: "CORRELATED_CLUSTER", ruleName: "Correlated Positions", currentValue: Math.max(...portfolio.correlatedClusters.map((cluster) => cluster.count)), threshold: limits.maxCorrelatedPositions, message: "A correlated portfolio cluster exceeds the configured count.", severity: "warning" });
  }

  const requireText = (enabled: boolean, field: keyof GuardianProposal, min: number, message: string) => {
    if (!enabled) return;
    const value = proposal[field];
    if (typeof value !== "string" || value.trim().length < min) failures.push({ field, message });
    else passed.push(`${field} documented.`);
  };
  requireText(requirements.requireRationale, "rationale", 20, "A specific investment rationale is required (minimum 20 characters).");
  requireText(requirements.requireInvestmentHorizon, "investmentHorizon", 3, "An investment horizon is required.");
  requireText(requirements.requireBearCase, "bearCase", 20, "A quantified or testable bear case is required.");
  requireText(requirements.requireThesisInvalidation, "thesisInvalidation", 15, "Thesis invalidation conditions are required.");
  requireText(requirements.requireExitConditions, "exitConditions", 15, "Exit conditions are required.");
  if (requirements.requireTargetPrice && (!proposal.targetPrice || proposal.targetPrice <= 0)) failures.push({ field: "targetPrice", message: "A positive target price is required." });
  if (requirements.requireMaxAcceptableLoss && (!proposal.maxAcceptableLossPct || proposal.maxAcceptableLossPct <= 0)) failures.push({ field: "maxAcceptableLossPct", message: "Maximum acceptable loss must be defined." });

  const researchScore = research?.completenessScore ?? 0;
  if (projected.isBuy && researchScore < requirements.minResearchCompletenessScore) {
    failures.push({ field: "researchCompleteness", message: `Research completeness is ${researchScore}/100; minimum is ${requirements.minResearchCompletenessScore}.` });
  } else if (research) {
    passed.push(`Research completeness is ${researchScore}/100.`);
  }

  if (projected.isBuy && !research?.isCovered) {
    failures.push({ field: "researchCoverage", message: "Create a Research Engine workspace before committing new capital." });
  }

  if (projected.isBuy && proposal.citedSourceIds?.length === 0) {
    soft.push({ ruleId: "NO_CITED_EVIDENCE", ruleName: "Cited Evidence", message: "No research or market source IDs were attached to the decision.", severity: "warning" });
  }

  const biasFlags = detectBiases(proposal, portfolio, research, market, settings);
  const detectedBiases = biasFlags.filter((flag) => flag.detected);
  const stressTestResults = projected.isBuy ? runStressTests(proposal, portfolio, research, projected, settings) : [];
  const highStress = stressTestResults.filter(
    (item) =>
      item.scenario === "Company bear case" &&
      (item.severity === "high" || item.severity === "critical"),
  );

  let decision: GuardianCheckResult["decision"];
  let severity: GuardianCheckResult["severity"];
  let summary: string;
  if (hard.length > 0) {
    decision = "reject";
    severity = "critical";
    summary = `Blocked by ${hard.length} hard rule${hard.length === 1 ? "" : "s"}: ${hard[0].ruleName}.`;
  } else if (failures.length > 0) {
    decision = "require_evidence";
    severity = "high";
    summary = `${failures.length} required evidence item${failures.length === 1 ? " is" : "s are"} incomplete.`;
  } else if (soft.length > 0 || detectedBiases.length > 0 || highStress.length > 0) {
    decision = "approve_with_warnings";
    severity = soft.length + detectedBiases.length >= 3 || highStress.some((item) => item.severity === "critical") ? "high" : "medium";
    summary = `Policy checks passed with ${soft.length} portfolio warning${soft.length === 1 ? "" : "s"} and ${detectedBiases.length} detected bias flag${detectedBiases.length === 1 ? "" : "s"}.`;
  } else {
    decision = "approve";
    severity = "low";
    summary = "All configured policy, evidence and behavioural checks passed.";
  }

  return {
    decision,
    severity,
    summary,
    hardRuleBreaches: hard,
    softRuleWarnings: soft,
    preTradeFailures: failures,
    biasFlags,
    stressTestResults,
    passedChecks: passed,
    researchCompletenessScore: researchScore,
    projected: {
      tradeNotional: round(projected.tradeNotional),
      cashBalance: round(projected.projectedCash),
      cashBufferPct: round(projected.cashBufferPct),
      stockAllocationPct: round(projected.stockAllocationPct),
      sectorAllocationPct: round(projected.sectorAllocationPct),
      quantity: round(projected.projectedQuantity, 6),
    },
    requiresOverride: decision === "reject",
    canOverride: settings.guardianMode.allowOverrideWithRationale,
  };
}

export interface GuardianHealthResult {
  score: number;
  band: "healthy" | "watch" | "caution" | "high_risk" | "critical";
  components: Array<{
    key: string;
    name: string;
    score: number;
    maxScore: number;
    status: "ok" | "warning" | "breach";
    description: string;
  }>;
  topRisks: string[];
  dataQuality: {
    priceCoveragePct: number;
    researchCoveragePct: number;
    generatedAt: string;
  };
}

export function calculateGuardianHealth(args: {
  portfolio: GuardianPortfolioContext;
  research: GuardianResearchContext[];
  settings: GuardianSettings;
  activeHighSeverityNews: number;
}): GuardianHealthResult {
  const { portfolio, research, settings, activeHighSeverityNews } = args;
  const holdingsCount = portfolio.holdings.length;
  const covered = research.filter((item) => item.isCovered).length;
  const researchCoveragePct = holdingsCount > 0 ? (covered / holdingsCount) * 100 : 0;
  const weightedResearch = holdingsCount > 0
    ? portfolio.holdings.reduce((sum, holding) => {
        const item = research.find((candidate) => candidate.ticker === holding.ticker);
        return sum + (item?.completenessScore ?? 0) * (holding.allocationPct / 100);
      }, 0)
    : 0;
  const thesisBroken = research.filter((item) => item.thesisStatus === "broken").length;
  const thesisWeakening = research.filter((item) => item.thesisStatus === "weakening").length;
  const maxStock = portfolio.largestPositionPct;
  const maxSector = Math.max(0, ...portfolio.sectorAllocation.map((item) => item.allocationPct));

  const thesisScore = Math.max(0, 25 - thesisBroken * 12 - thesisWeakening * 5);
  const concentrationScore = Math.max(0, 20 - Math.max(0, maxStock - settings.portfolioLimits.maxStockConcentrationPct) * 2 - Math.max(0, maxSector - settings.portfolioLimits.maxSectorConcentrationPct));
  const cashScore = portfolio.cashBufferPct >= settings.portfolioLimits.minCashBufferPct ? 15 : Math.max(0, (portfolio.cashBufferPct / Math.max(1, settings.portfolioLimits.minCashBufferPct)) * 15);
  const researchScore = Math.min(20, weightedResearch * 0.2);
  const drawdownScore = portfolio.maxDrawdownPct <= settings.portfolioLimits.maxPortfolioDrawdownPct ? 10 : Math.max(0, 10 - (portfolio.maxDrawdownPct - settings.portfolioLimits.maxPortfolioDrawdownPct));
  const dataScore = Math.max(0, Math.min(10, portfolio.priceCoveragePct / 10 - activeHighSeverityNews));

  const components: GuardianHealthResult["components"] = [
    { key: "thesis", name: "Thesis Integrity", score: round(thesisScore), maxScore: 25, status: thesisBroken > 0 ? "breach" : thesisWeakening > 0 ? "warning" : "ok", description: `${thesisBroken} broken and ${thesisWeakening} weakening thesis records.` },
    { key: "concentration", name: "Concentration", score: round(concentrationScore), maxScore: 20, status: maxStock > settings.portfolioLimits.maxStockConcentrationPct || maxSector > settings.portfolioLimits.maxSectorConcentrationPct ? "breach" : maxStock > settings.portfolioLimits.maxStockConcentrationPct * 0.8 || maxSector > settings.portfolioLimits.maxSectorConcentrationPct * 0.8 ? "warning" : "ok", description: `Largest stock ${round(maxStock, 1)}%; largest sector ${round(maxSector, 1)}%.` },
    { key: "cash", name: "Liquidity Buffer", score: round(cashScore), maxScore: 15, status: portfolio.cashBufferPct < settings.portfolioLimits.minCashBufferPct ? "warning" : "ok", description: `Cash buffer ${round(portfolio.cashBufferPct, 1)}% versus ${settings.portfolioLimits.minCashBufferPct}% minimum.` },
    { key: "research", name: "Research Readiness", score: round(researchScore), maxScore: 20, status: researchCoveragePct < 80 || weightedResearch < settings.preTradeRequirements.minResearchCompletenessScore ? "warning" : "ok", description: `${round(researchCoveragePct, 0)}% coverage; allocation-weighted completeness ${round(weightedResearch, 0)}/100.` },
    { key: "drawdown", name: "Drawdown Control", score: round(drawdownScore), maxScore: 10, status: portfolio.maxDrawdownPct > settings.portfolioLimits.maxPortfolioDrawdownPct ? "breach" : "ok", description: `Observed drawdown ${round(portfolio.maxDrawdownPct, 1)}%.` },
    { key: "data", name: "Data Quality", score: round(dataScore), maxScore: 10, status: portfolio.priceCoveragePct < 90 ? "warning" : "ok", description: `${round(portfolio.priceCoveragePct, 0)}% holdings have explicit market quotes; ${activeHighSeverityNews} high-severity news items active.` },
  ];
  const score = Math.max(0, Math.min(100, Math.round(components.reduce((sum, item) => sum + item.score, 0))));
  const band: GuardianHealthResult["band"] = score >= 85 ? "healthy" : score >= 70 ? "watch" : score >= 55 ? "caution" : score >= 35 ? "high_risk" : "critical";
  const topRisks: string[] = [];
  if (thesisBroken) topRisks.push(`${thesisBroken} holding thesis record${thesisBroken === 1 ? " is" : "s are"} broken.`);
  if (thesisWeakening) topRisks.push(`${thesisWeakening} holding thesis record${thesisWeakening === 1 ? " is" : "s are"} weakening.`);
  if (portfolio.cashBufferPct < settings.portfolioLimits.minCashBufferPct) topRisks.push(`Cash buffer is below the ${settings.portfolioLimits.minCashBufferPct}% minimum.`);
  if (maxStock > settings.portfolioLimits.maxStockConcentrationPct) topRisks.push(`Largest position exceeds the ${settings.portfolioLimits.maxStockConcentrationPct}% stock limit.`);
  if (maxSector > settings.portfolioLimits.maxSectorConcentrationPct) topRisks.push(`Largest sector exceeds the ${settings.portfolioLimits.maxSectorConcentrationPct}% sector limit.`);
  if (researchCoveragePct < 100) topRisks.push(`${holdingsCount - covered} holding${holdingsCount - covered === 1 ? " lacks" : "s lack"} research coverage.`);
  if (portfolio.priceCoveragePct < 100) topRisks.push("Some holdings rely on transaction-price fallback rather than an explicit quote.");
  return {
    score,
    band,
    components,
    topRisks: topRisks.slice(0, 6),
    dataQuality: { priceCoveragePct: round(portfolio.priceCoveragePct), researchCoveragePct: round(researchCoveragePct), generatedAt: new Date().toISOString() },
  };
}
