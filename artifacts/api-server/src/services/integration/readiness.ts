export type IntegrationModuleKey =
  | "portfolio"
  | "research"
  | "copilot"
  | "intelligence"
  | "guardian"
  | "journal"
  | "liveData"
  | "alerts";

export type IntegrationModuleStatus =
  "ready" | "attention" | "blocked" | "optional";

export interface IntegrationFacts {
  portfolio: {
    portfolios: number;
    holdings: number;
    transactions: number;
    holdingsWithPrices: number;
    stalePrices: number;
  };
  research: {
    companies: number;
    activeTheses: number;
    brokenTheses: number;
    overdueReviews: number;
  };
  copilot: {
    conversations: number;
    memories: number;
    aiProviderConfigured: boolean;
  };
  intelligence: {
    briefs: number;
    marketDataPoints: number;
    latestBriefAt: string | null;
    latestProviderStatus: string | null;
  };
  guardian: {
    healthSnapshots: number;
    latestHealthScore: number | null;
    pendingPackets: number;
  };
  journal: {
    entries: number;
    dueReviews: number;
    completedReviews: number;
  };
  liveData: {
    configuredProviders: string[];
    cachedRecords: number;
    latestFetchAt: string | null;
  };
  alerts: {
    active: number;
    critical: number;
    enabledRules: number;
  };
}

export interface IntegrationModuleResult {
  key: IntegrationModuleKey;
  name: string;
  status: IntegrationModuleStatus;
  score: number;
  maxScore: number;
  summary: string;
  metrics: Array<{ label: string; value: string | number }>;
  href: string;
}

export interface IntegrationReadinessResult {
  score: number;
  band: "ready" | "nearly_ready" | "setup_required";
  modules: IntegrationModuleResult[];
  blockers: string[];
  recommendations: string[];
}

function ratioScore(value: number, target: number, maxScore: number): number {
  if (target <= 0) return maxScore;
  return Math.max(
    0,
    Math.min(maxScore, Math.round((value / target) * maxScore)),
  );
}

function moduleResult(
  key: IntegrationModuleKey,
  name: string,
  status: IntegrationModuleStatus,
  score: number,
  maxScore: number,
  summary: string,
  metrics: IntegrationModuleResult["metrics"],
  href: string,
): IntegrationModuleResult {
  return { key, name, status, score, maxScore, summary, metrics, href };
}

export function evaluateIntegrationReadiness(
  facts: IntegrationFacts,
): IntegrationReadinessResult {
  const blockers: string[] = [];
  const recommendations: string[] = [];
  const modules: IntegrationModuleResult[] = [];

  let portfolioScore = 0;
  let portfolioStatus: IntegrationModuleStatus = "ready";
  if (facts.portfolio.portfolios === 0) {
    portfolioStatus = "blocked";
    blockers.push("Create a portfolio before using the decision workflow.");
  } else {
    portfolioScore += 4;
    portfolioScore += facts.portfolio.transactions > 0 ? 4 : 0;
    portfolioScore += facts.portfolio.holdings > 0 ? 4 : 0;
    portfolioScore += ratioScore(
      facts.portfolio.holdingsWithPrices,
      Math.max(1, facts.portfolio.holdings),
      6,
    );
    portfolioScore += facts.portfolio.stalePrices === 0 ? 2 : 0;
    if (
      facts.portfolio.transactions === 0 ||
      facts.portfolio.holdings === 0 ||
      facts.portfolio.holdingsWithPrices < facts.portfolio.holdings ||
      facts.portfolio.stalePrices > 0
    ) {
      portfolioStatus = "attention";
    }
  }
  if (facts.portfolio.portfolios > 0 && facts.portfolio.transactions === 0) {
    recommendations.push("Import or record portfolio transactions.");
  }
  if (facts.portfolio.holdings > facts.portfolio.holdingsWithPrices) {
    recommendations.push("Refresh missing holding prices.");
  }
  if (facts.portfolio.stalePrices > 0) {
    recommendations.push("Refresh stale market prices before relying on P&L.");
  }
  modules.push(
    moduleResult(
      "portfolio",
      "Portfolio Engine",
      portfolioStatus,
      portfolioScore,
      20,
      portfolioStatus === "blocked"
        ? "Portfolio setup has not started."
        : portfolioStatus === "ready"
          ? "Ledger, holdings and prices are ready."
          : "Portfolio exists but needs fresher or more complete data.",
      [
        { label: "Holdings", value: facts.portfolio.holdings },
        { label: "Transactions", value: facts.portfolio.transactions },
        { label: "Stale prices", value: facts.portfolio.stalePrices },
      ],
      "/portfolio",
    ),
  );

  const researchCoverage =
    facts.portfolio.holdings > 0
      ? Math.min(1, facts.research.companies / facts.portfolio.holdings)
      : facts.research.companies > 0
        ? 1
        : 0;
  let researchScore = Math.round(researchCoverage * 7);
  researchScore += ratioScore(
    facts.research.activeTheses,
    Math.max(1, facts.research.companies),
    6,
  );
  researchScore += facts.research.overdueReviews === 0 ? 2 : 0;
  let researchStatus: IntegrationModuleStatus = "ready";
  if (facts.research.companies === 0) researchStatus = "attention";
  if (researchCoverage < 1 || facts.research.overdueReviews > 0)
    researchStatus = "attention";
  if (facts.research.brokenTheses > 0) researchStatus = "attention";
  if (facts.portfolio.holdings > 0 && facts.research.companies === 0) {
    recommendations.push("Create research workspaces for portfolio holdings.");
  }
  if (facts.research.overdueReviews > 0) {
    recommendations.push(
      `Complete ${facts.research.overdueReviews} overdue thesis review${facts.research.overdueReviews === 1 ? "" : "s"}.`,
    );
  }
  modules.push(
    moduleResult(
      "research",
      "Research Engine",
      researchStatus,
      researchScore,
      15,
      researchStatus === "ready"
        ? "Research coverage and review cadence are healthy."
        : "Research coverage, thesis status or review cadence needs attention.",
      [
        { label: "Companies", value: facts.research.companies },
        { label: "Active theses", value: facts.research.activeTheses },
        { label: "Overdue reviews", value: facts.research.overdueReviews },
      ],
      "/research",
    ),
  );

  let copilotScore = 4;
  copilotScore += facts.copilot.conversations > 0 ? 2 : 0;
  copilotScore += facts.copilot.memories > 0 ? 2 : 0;
  copilotScore += facts.copilot.aiProviderConfigured ? 2 : 0;
  const copilotStatus: IntegrationModuleStatus = facts.copilot
    .aiProviderConfigured
    ? "ready"
    : "optional";
  if (!facts.copilot.aiProviderConfigured) {
    recommendations.push(
      "Add OPENAI_API_KEY to enable the live Copilot; deterministic grounded fallback remains available.",
    );
  }
  modules.push(
    moduleResult(
      "copilot",
      "AI Copilot",
      copilotStatus,
      copilotScore,
      10,
      facts.copilot.aiProviderConfigured
        ? "Live grounded Copilot is configured."
        : "Offline grounded mode is available; live AI is optional.",
      [
        { label: "Conversations", value: facts.copilot.conversations },
        { label: "Pinned memories", value: facts.copilot.memories },
        {
          label: "Live AI",
          value: facts.copilot.aiProviderConfigured
            ? "Configured"
            : "Not configured",
        },
      ],
      "/copilot",
    ),
  );

  let intelligenceScore = 0;
  intelligenceScore += facts.intelligence.briefs > 0 ? 7 : 0;
  intelligenceScore += facts.intelligence.marketDataPoints > 0 ? 5 : 0;
  intelligenceScore +=
    facts.intelligence.latestProviderStatus === "success" ? 3 : 0;
  const intelligenceStatus: IntegrationModuleStatus =
    facts.intelligence.briefs > 0 && facts.intelligence.marketDataPoints > 0
      ? "ready"
      : "attention";
  if (facts.intelligence.briefs === 0)
    recommendations.push("Generate the first Morning Brief.");
  if (facts.intelligence.marketDataPoints === 0)
    recommendations.push("Import or refresh market intelligence data.");
  modules.push(
    moduleResult(
      "intelligence",
      "Morning Brief & Intelligence",
      intelligenceStatus,
      intelligenceScore,
      15,
      intelligenceStatus === "ready"
        ? "Briefing and market context are available."
        : "Briefing or market context is incomplete.",
      [
        { label: "Briefs", value: facts.intelligence.briefs },
        { label: "Market facts", value: facts.intelligence.marketDataPoints },
        {
          label: "Latest provider",
          value: facts.intelligence.latestProviderStatus ?? "No run",
        },
      ],
      "/market-intelligence",
    ),
  );

  let guardianScore = 0;
  guardianScore += facts.guardian.healthSnapshots > 0 ? 8 : 0;
  guardianScore += facts.guardian.latestHealthScore !== null ? 4 : 0;
  guardianScore += facts.guardian.pendingPackets === 0 ? 3 : 1;
  const guardianStatus: IntegrationModuleStatus =
    facts.guardian.healthSnapshots > 0 ? "ready" : "attention";
  if (facts.guardian.healthSnapshots === 0)
    recommendations.push(
      "Calculate the first Guardian portfolio-health snapshot.",
    );
  modules.push(
    moduleResult(
      "guardian",
      "Guardian Mode",
      guardianStatus,
      guardianScore,
      15,
      guardianStatus === "ready"
        ? "Portfolio-health monitoring is active."
        : "Guardian is installed but has not calculated portfolio health yet.",
      [
        {
          label: "Health score",
          value: facts.guardian.latestHealthScore ?? "—",
        },
        { label: "Pending packets", value: facts.guardian.pendingPackets },
        { label: "Snapshots", value: facts.guardian.healthSnapshots },
      ],
      "/guardrails",
    ),
  );

  let journalScore = facts.journal.entries > 0 ? 5 : 1;
  journalScore += facts.journal.dueReviews === 0 ? 3 : 1;
  journalScore += facts.journal.completedReviews > 0 ? 2 : 0;
  const journalStatus: IntegrationModuleStatus =
    facts.journal.dueReviews > 0
      ? "attention"
      : facts.journal.entries > 0
        ? "ready"
        : "optional";
  if (facts.journal.dueReviews > 0) {
    recommendations.push(
      `Complete ${facts.journal.dueReviews} due decision review${facts.journal.dueReviews === 1 ? "" : "s"}.`,
    );
  }
  modules.push(
    moduleResult(
      "journal",
      "Decision Journal",
      journalStatus,
      journalScore,
      10,
      facts.journal.entries === 0
        ? "The journal is ready for the first decision."
        : facts.journal.dueReviews > 0
          ? "Decision reviews are overdue."
          : "Decision documentation and reviews are current.",
      [
        { label: "Decisions", value: facts.journal.entries },
        { label: "Due reviews", value: facts.journal.dueReviews },
        { label: "Completed reviews", value: facts.journal.completedReviews },
      ],
      "/journal",
    ),
  );

  let liveDataScore = 2;
  liveDataScore += facts.liveData.configuredProviders.length > 0 ? 4 : 0;
  liveDataScore += facts.liveData.cachedRecords > 0 ? 3 : 0;
  liveDataScore += facts.liveData.latestFetchAt ? 1 : 0;
  const liveDataStatus: IntegrationModuleStatus =
    facts.liveData.configuredProviders.length > 0 ? "ready" : "optional";
  if (facts.liveData.configuredProviders.length === 0) {
    recommendations.push(
      "Configure a live-data provider or continue with normalized manual imports.",
    );
  }
  modules.push(
    moduleResult(
      "liveData",
      "Live Data",
      liveDataStatus,
      liveDataScore,
      10,
      liveDataStatus === "ready"
        ? "At least one live-data provider is configured."
        : "Live data is optional; manual normalized imports remain supported.",
      [
        {
          label: "Providers",
          value: facts.liveData.configuredProviders.length,
        },
        { label: "Cached records", value: facts.liveData.cachedRecords },
        { label: "Latest fetch", value: facts.liveData.latestFetchAt ?? "—" },
      ],
      "/live-data",
    ),
  );

  let alertScore = facts.alerts.enabledRules > 0 ? 2 : 0;
  alertScore += facts.alerts.critical === 0 ? 2 : 0;
  alertScore += facts.alerts.active === 0 ? 1 : 0;
  const alertStatus: IntegrationModuleStatus =
    facts.alerts.critical > 0 || facts.alerts.active > 0
      ? "attention"
      : "ready";
  if (facts.alerts.critical > 0)
    blockers.push(
      `${facts.alerts.critical} critical alert${facts.alerts.critical === 1 ? " requires" : "s require"} review.`,
    );
  if (facts.alerts.enabledRules === 0)
    recommendations.push(
      "Create alert rules for material price, thesis or data-quality changes.",
    );
  modules.push(
    moduleResult(
      "alerts",
      "Alerts",
      alertStatus,
      alertScore,
      5,
      alertStatus === "ready"
        ? "No unresolved material alerts."
        : "Active alerts require review.",
      [
        { label: "Active", value: facts.alerts.active },
        { label: "Critical", value: facts.alerts.critical },
        { label: "Enabled rules", value: facts.alerts.enabledRules },
      ],
      "/alerts",
    ),
  );

  const rawScore = modules.reduce((sum, module) => sum + module.score, 0);
  const score = Math.max(0, Math.min(100, rawScore));
  const band =
    blockers.length > 0 || score < 55
      ? "setup_required"
      : score < 80
        ? "nearly_ready"
        : "ready";

  return {
    score,
    band,
    modules,
    blockers: [...new Set(blockers)],
    recommendations: [...new Set(recommendations)].slice(0, 10),
  };
}
