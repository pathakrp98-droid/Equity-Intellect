import {
  alertPreferencesTable,
  alertRulesTable,
  db,
  investmentAlertsTable,
  investmentThesesTable,
  liveDataPreferencesTable,
  marketDataPointsTable,
  marketEventsTable,
  marketNewsTable,
  marketProviderRunsTable,
  researchCompaniesTable,
  researchInvalidationTriggersTable,
  type AlertRuleConfig,
} from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";

import { portfolioService } from "../portfolio/portfolioService";
import {
  evaluateRule,
  makeSystemDedupeKey,
  meetsSeverityThreshold,
  type AlertCandidate,
  type AlertRuleType,
  type AlertSeverity,
} from "./alertEngine";

export interface CreateAlertRuleInput {
  name: string;
  ticker?: string | null;
  ruleType: AlertRuleType;
  severity?: AlertSeverity;
  threshold?: number | null;
  textValue?: string | null;
  lookaheadDays?: number | null;
  cooldownMinutes?: number;
  isEnabled?: boolean;
  config?: AlertRuleConfig;
}

export interface UpdateAlertPreferencesInput {
  severityThreshold?: AlertSeverity;
  portfolioOnly?: boolean;
  enablePriceAlerts?: boolean;
  enableThesisAlerts?: boolean;
  enableNewsAlerts?: boolean;
  enableCalendarAlerts?: boolean;
  enableDataQualityAlerts?: boolean;
  enableProviderFailureAlerts?: boolean;
  inAppNotifications?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

const alertTypes = new Set<AlertRuleType>([
  "price_above",
  "price_below",
  "day_change_above",
  "day_change_below",
  "thesis_status",
  "thesis_review_due",
  "invalidation_trigger",
  "news_keyword",
  "earnings_upcoming",
  "corporate_action_upcoming",
  "data_stale",
  "provider_failure",
]);

const severities = new Set<AlertSeverity>([
  "critical",
  "high",
  "medium",
  "low",
]);

function normalizeTicker(value: string | null | undefined): string | null {
  const ticker = value?.trim().toUpperCase();
  if (!ticker) return null;
  if (ticker.length > 30 || !/^[A-Z0-9._&-]+$/.test(ticker)) {
    throw new Error("ticker is invalid");
  }
  return ticker;
}

function cleanText(
  value: string | null | undefined,
  maximum: number,
): string | null {
  const text = value?.trim();
  if (!text) return null;
  if (text.length > maximum) throw new Error(`Text cannot exceed ${maximum} characters`);
  return text;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Numeric value must be zero or greater");
  }
  return Math.round(value);
}

function validateTime(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const normalized = value.trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
    throw new Error("Quiet hours must use HH:MM format");
  }
  return normalized;
}

function validateRule(input: CreateAlertRuleInput) {
  if (!alertTypes.has(input.ruleType)) throw new Error("Unsupported alert rule type");
  const name = cleanText(input.name, 220);
  if (!name) throw new Error("Rule name is required");
  const ticker = normalizeTicker(input.ticker);
  const severity = input.severity ?? "medium";
  if (!severities.has(severity)) throw new Error("Invalid alert severity");
  const priceRule = [
    "price_above",
    "price_below",
    "day_change_above",
    "day_change_below",
  ].includes(input.ruleType);
  if (priceRule && (input.threshold === undefined || input.threshold === null)) {
    throw new Error("A numeric threshold is required for price rules");
  }
  if (priceRule && !ticker) throw new Error("ticker is required for price rules");
  if (input.ruleType === "news_keyword" && !cleanText(input.textValue, 300)) {
    throw new Error("A keyword is required for news keyword rules");
  }
  return {
    name,
    ticker,
    ruleType: input.ruleType,
    severity,
    threshold:
      input.threshold === undefined || input.threshold === null
        ? null
        : Number(input.threshold),
    textValue: cleanText(input.textValue, 300),
    lookaheadDays:
      input.lookaheadDays === undefined || input.lookaheadDays === null
        ? null
        : positiveInteger(input.lookaheadDays, 7),
    cooldownMinutes: positiveInteger(input.cooldownMinutes, 1_440),
    isEnabled: input.isEnabled ?? true,
    config: input.config ?? {},
  };
}

class AlertService {
  async getPreferences(userId: string) {
    const [existing] = await db
      .select()
      .from(alertPreferencesTable)
      .where(eq(alertPreferencesTable.userId, userId))
      .limit(1);
    if (existing) return existing;
    const [created] = await db
      .insert(alertPreferencesTable)
      .values({ userId })
      .returning();
    return created;
  }

  async updatePreferences(userId: string, input: UpdateAlertPreferencesInput) {
    await this.getPreferences(userId);
    if (input.severityThreshold && !severities.has(input.severityThreshold)) {
      throw new Error("Invalid severity threshold");
    }
    const [updated] = await db
      .update(alertPreferencesTable)
      .set({
        ...(input.severityThreshold
          ? { severityThreshold: input.severityThreshold }
          : {}),
        ...(input.portfolioOnly !== undefined
          ? { portfolioOnly: input.portfolioOnly }
          : {}),
        ...(input.enablePriceAlerts !== undefined
          ? { enablePriceAlerts: input.enablePriceAlerts }
          : {}),
        ...(input.enableThesisAlerts !== undefined
          ? { enableThesisAlerts: input.enableThesisAlerts }
          : {}),
        ...(input.enableNewsAlerts !== undefined
          ? { enableNewsAlerts: input.enableNewsAlerts }
          : {}),
        ...(input.enableCalendarAlerts !== undefined
          ? { enableCalendarAlerts: input.enableCalendarAlerts }
          : {}),
        ...(input.enableDataQualityAlerts !== undefined
          ? { enableDataQualityAlerts: input.enableDataQualityAlerts }
          : {}),
        ...(input.enableProviderFailureAlerts !== undefined
          ? { enableProviderFailureAlerts: input.enableProviderFailureAlerts }
          : {}),
        ...(input.inAppNotifications !== undefined
          ? { inAppNotifications: input.inAppNotifications }
          : {}),
        ...(input.quietHoursStart !== undefined
          ? { quietHoursStart: validateTime(input.quietHoursStart) }
          : {}),
        ...(input.quietHoursEnd !== undefined
          ? { quietHoursEnd: validateTime(input.quietHoursEnd) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(alertPreferencesTable.userId, userId))
      .returning();
    return updated;
  }

  async listRules(userId: string) {
    return db
      .select()
      .from(alertRulesTable)
      .where(eq(alertRulesTable.userId, userId))
      .orderBy(desc(alertRulesTable.updatedAt));
  }

  async createRule(userId: string, input: CreateAlertRuleInput) {
    const validated = validateRule(input);
    const [created] = await db
      .insert(alertRulesTable)
      .values({ userId, ...validated })
      .returning();
    return created;
  }

  async updateRule(userId: string, id: number, input: Partial<CreateAlertRuleInput>) {
    const [existing] = await db
      .select()
      .from(alertRulesTable)
      .where(
        and(eq(alertRulesTable.id, id), eq(alertRulesTable.userId, userId)),
      )
      .limit(1);
    if (!existing) throw new Error("Alert rule not found");
    const validated = validateRule({
      name: input.name ?? existing.name,
      ticker: input.ticker === undefined ? existing.ticker : input.ticker,
      ruleType: input.ruleType ?? existing.ruleType,
      severity: input.severity ?? existing.severity,
      threshold: input.threshold === undefined ? existing.threshold : input.threshold,
      textValue: input.textValue === undefined ? existing.textValue : input.textValue,
      lookaheadDays:
        input.lookaheadDays === undefined
          ? existing.lookaheadDays
          : input.lookaheadDays,
      cooldownMinutes: input.cooldownMinutes ?? existing.cooldownMinutes,
      isEnabled: input.isEnabled ?? existing.isEnabled,
      config: input.config ?? existing.config,
    });
    const [updated] = await db
      .update(alertRulesTable)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(alertRulesTable.id, existing.id))
      .returning();
    return updated;
  }

  async deleteRule(userId: string, id: number) {
    const [deleted] = await db
      .delete(alertRulesTable)
      .where(
        and(eq(alertRulesTable.id, id), eq(alertRulesTable.userId, userId)),
      )
      .returning();
    if (!deleted) throw new Error("Alert rule not found");
    return deleted;
  }

  async listAlerts(
    userId: string,
    options: {
      status?: "active" | "acknowledged" | "dismissed" | "resolved" | "all";
      severity?: AlertSeverity;
      ticker?: string;
      limit?: number;
    } = {},
  ) {
    const rows = await db
      .select()
      .from(investmentAlertsTable)
      .where(eq(investmentAlertsTable.userId, userId))
      .orderBy(desc(investmentAlertsTable.triggeredAt))
      .limit(Math.max(1, Math.min(500, options.limit ?? 200)));
    const ticker = options.ticker ? normalizeTicker(options.ticker) : null;
    return rows.filter((row) => {
      if (options.severity && row.severity !== options.severity) return false;
      if (ticker && row.ticker !== ticker) return false;
      switch (options.status ?? "active") {
        case "active":
          return !row.dismissedAt && !row.resolvedAt;
        case "acknowledged":
          return Boolean(row.acknowledgedAt) && !row.dismissedAt && !row.resolvedAt;
        case "dismissed":
          return Boolean(row.dismissedAt);
        case "resolved":
          return Boolean(row.resolvedAt);
        case "all":
          return true;
      }
    });
  }

  async getSummary(userId: string) {
    const [alerts, rules] = await Promise.all([
      this.listAlerts(userId, { status: "all", limit: 500 }),
      this.listRules(userId),
    ]);
    const active = alerts.filter((alert) => !alert.dismissedAt && !alert.resolvedAt);
    return {
      active: active.length,
      critical: active.filter((alert) => alert.severity === "critical").length,
      high: active.filter((alert) => alert.severity === "high").length,
      acknowledged: active.filter((alert) => alert.acknowledgedAt).length,
      enabledRules: rules.filter((rule) => rule.isEnabled).length,
      latestTriggeredAt: active[0]?.triggeredAt ?? null,
    };
  }

  private async updateAlertState(
    userId: string,
    id: number,
    state: "acknowledge" | "dismiss" | "reopen" | "resolve",
  ) {
    const now = new Date();
    const [updated] = await db
      .update(investmentAlertsTable)
      .set({
        ...(state === "acknowledge" ? { acknowledgedAt: now } : {}),
        ...(state === "dismiss" ? { dismissedAt: now } : {}),
        ...(state === "resolve" ? { resolvedAt: now } : {}),
        ...(state === "reopen"
          ? { acknowledgedAt: null, dismissedAt: null, resolvedAt: null }
          : {}),
        updatedAt: now,
      })
      .where(
        and(
          eq(investmentAlertsTable.id, id),
          eq(investmentAlertsTable.userId, userId),
        ),
      )
      .returning();
    if (!updated) throw new Error("Alert not found");
    return updated;
  }

  acknowledge(userId: string, id: number) {
    return this.updateAlertState(userId, id, "acknowledge");
  }

  dismiss(userId: string, id: number) {
    return this.updateAlertState(userId, id, "dismiss");
  }

  reopen(userId: string, id: number) {
    return this.updateAlertState(userId, id, "reopen");
  }

  resolve(userId: string, id: number) {
    return this.updateAlertState(userId, id, "resolve");
  }

  private async upsertCandidate(userId: string, candidate: AlertCandidate) {
    const [row] = await db
      .insert(investmentAlertsTable)
      .values({ userId, ...candidate })
      .onConflictDoUpdate({
        target: [investmentAlertsTable.userId, investmentAlertsTable.dedupeKey],
        set: {
          severity: candidate.severity,
          title: candidate.title,
          detail: candidate.detail,
          source: candidate.source,
          sourceUrl: candidate.sourceUrl,
          triggeredAt: candidate.triggeredAt,
          metadata: candidate.metadata,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async evaluate(userId: string) {
    const now = new Date();
    const [preferences, overview, rules, livePreferences] = await Promise.all([
      this.getPreferences(userId),
      portfolioService.getOverview(userId),
      this.listRules(userId),
      db
        .select()
        .from(liveDataPreferencesTable)
        .where(eq(liveDataPreferencesTable.userId, userId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);
    const portfolioTickers = new Set(
      overview.holdings.map((holding) => holding.ticker.toUpperCase()),
    );
    const recentNewsSince = new Date(now.getTime() - 7 * 86_400_000);
    const [quoteRows, newsRows, eventRows, companyTheses, invalidations, providerRuns] =
      await Promise.all([
        db
          .select()
          .from(marketDataPointsTable)
          .where(eq(marketDataPointsTable.userId, userId)),
        db
          .select()
          .from(marketNewsTable)
          .where(
            and(
              eq(marketNewsTable.userId, userId),
              gte(marketNewsTable.publishedAt, recentNewsSince),
            ),
          ),
        db
          .select()
          .from(marketEventsTable)
          .where(eq(marketEventsTable.userId, userId)),
        db
          .select({ company: researchCompaniesTable, thesis: investmentThesesTable })
          .from(researchCompaniesTable)
          .leftJoin(
            investmentThesesTable,
            eq(investmentThesesTable.companyId, researchCompaniesTable.id),
          )
          .where(eq(researchCompaniesTable.userId, userId)),
        db
          .select({
            trigger: researchInvalidationTriggersTable,
            company: researchCompaniesTable,
          })
          .from(researchInvalidationTriggersTable)
          .innerJoin(
            researchCompaniesTable,
            eq(
              researchCompaniesTable.id,
              researchInvalidationTriggersTable.companyId,
            ),
          )
          .where(eq(researchInvalidationTriggersTable.userId, userId)),
        db
          .select()
          .from(marketProviderRunsTable)
          .where(eq(marketProviderRunsTable.userId, userId))
          .orderBy(desc(marketProviderRunsTable.startedAt))
          .limit(50),
      ]);

    const quotes = quoteRows
      .filter((row) => row.kind === "equity")
      .map((row) => ({
        ticker: row.symbol.toUpperCase(),
        price: row.value,
        changePct: row.changePct,
        previousClose:
          typeof row.metadata.previousClose === "number"
            ? row.metadata.previousClose
            : null,
        asOf: row.asOf,
        source: row.source,
        sourceUrl: row.sourceUrl,
      }));
    const news = newsRows.map((row) => ({
      id: row.id,
      ticker: row.ticker?.toUpperCase() ?? null,
      headline: row.headline,
      summary: row.summary,
      sentiment: row.sentiment,
      relevanceScore: row.relevanceScore,
      publishedAt: row.publishedAt,
      source: row.source,
      sourceUrl: row.sourceUrl,
    }));
    const events = eventRows.map((row) => ({
      id: row.id,
      ticker: row.ticker?.toUpperCase() ?? null,
      eventType: row.eventType,
      title: row.title,
      description: row.description,
      eventAt: row.eventAt,
      source: row.source,
      sourceUrl: row.sourceUrl,
    }));
    const theses = companyTheses
      .filter((row) => row.thesis)
      .map((row) => ({
        ticker: row.company.ticker.toUpperCase(),
        name: row.company.name,
        status: row.thesis!.status,
        nextReviewAt: row.thesis!.nextReviewAt,
      }));

    const candidates: AlertCandidate[] = [];
    for (const rule of rules.filter((item) => item.isEnabled)) {
      const isPriceRule = [
        "price_above",
        "price_below",
        "day_change_above",
        "day_change_below",
      ].includes(rule.ruleType);
      if (isPriceRule && !preferences.enablePriceAlerts) continue;
      if (
        ["thesis_status", "thesis_review_due"].includes(rule.ruleType) &&
        !preferences.enableThesisAlerts
      ) {
        continue;
      }
      if (rule.ruleType === "news_keyword" && !preferences.enableNewsAlerts) continue;
      if (
        ["earnings_upcoming", "corporate_action_upcoming"].includes(
          rule.ruleType,
        ) &&
        !preferences.enableCalendarAlerts
      ) {
        continue;
      }
      candidates.push(
        ...evaluateRule(
          {
            id: rule.id,
            name: rule.name,
            ticker: rule.ticker,
            ruleType: rule.ruleType,
            severity: rule.severity,
            threshold: rule.threshold,
            textValue: rule.textValue,
            lookaheadDays: rule.lookaheadDays,
            cooldownMinutes: rule.cooldownMinutes,
            lastTriggeredAt: rule.lastTriggeredAt,
            config: rule.config,
          },
          { quotes, news, events, theses, now },
        ),
      );
    }

    if (preferences.enableThesisAlerts) {
      for (const thesis of theses) {
        if (!portfolioTickers.has(thesis.ticker)) continue;
        if (["weakening", "broken"].includes(thesis.status)) {
          candidates.push({
            ruleId: null,
            ticker: thesis.ticker,
            alertType: "thesis_status",
            severity: thesis.status === "broken" ? "critical" : "high",
            title: `${thesis.ticker} thesis is ${thesis.status}`,
            detail: `${thesis.name} is marked ${thesis.status} in the Research Engine. Review the evidence and position sizing.`,
            source: "Research Engine",
            sourceUrl: null,
            dedupeKey: makeSystemDedupeKey(
              "thesis_status",
              thesis.ticker,
              thesis.status,
            ),
            triggeredAt: now,
            metadata: { thesisStatus: thesis.status },
          });
        }
        if (thesis.nextReviewAt && thesis.nextReviewAt.getTime() <= now.getTime()) {
          candidates.push({
            ruleId: null,
            ticker: thesis.ticker,
            alertType: "thesis_review_due",
            severity: "medium",
            title: `${thesis.ticker} research review is overdue`,
            detail: `The scheduled thesis review date was ${thesis.nextReviewAt.toLocaleDateString("en-IN")}.`,
            source: "Research Engine",
            sourceUrl: null,
            dedupeKey: makeSystemDedupeKey(
              "thesis_review_due",
              thesis.ticker,
              thesis.nextReviewAt.toISOString().slice(0, 10),
            ),
            triggeredAt: now,
            metadata: { reviewAt: thesis.nextReviewAt.toISOString() },
          });
        }
      }
      for (const row of invalidations) {
        const ticker = row.company.ticker.toUpperCase();
        if (preferences.portfolioOnly && !portfolioTickers.has(ticker)) continue;
        if (row.trigger.status !== "triggered") continue;
        candidates.push({
          ruleId: null,
          ticker,
          alertType: "invalidation_trigger",
          severity: row.trigger.severity === "high" ? "critical" : "high",
          title: `${ticker} invalidation trigger activated`,
          detail: row.trigger.description || row.trigger.trigger,
          source: "Research Engine",
          sourceUrl: null,
          dedupeKey: makeSystemDedupeKey(
            "invalidation_trigger",
            ticker,
            String(row.trigger.id),
          ),
          triggeredAt: now,
          metadata: {
            triggerId: row.trigger.id,
            trigger: row.trigger.trigger,
            triggeredAt: row.trigger.triggeredAt?.toISOString() ?? null,
          },
        });
      }
    }

    if (preferences.enableNewsAlerts) {
      for (const item of news) {
        if (preferences.portfolioOnly && item.ticker && !portfolioTickers.has(item.ticker)) {
          continue;
        }
        if (item.sentiment !== "negative" || item.relevanceScore < 0.65) continue;
        candidates.push({
          ruleId: null,
          ticker: item.ticker,
          alertType: "news_keyword",
          severity: item.relevanceScore >= 0.85 ? "high" : "medium",
          title: item.headline,
          detail: item.summary || "High-relevance negative news detected.",
          source: item.source,
          sourceUrl: item.sourceUrl ?? null,
          dedupeKey: makeSystemDedupeKey(
            "news_keyword",
            item.ticker ?? "market",
            String(item.id),
          ),
          triggeredAt: now,
          metadata: {
            publishedAt: item.publishedAt.toISOString(),
            sentiment: item.sentiment,
            relevanceScore: item.relevanceScore,
          },
        });
      }
    }

    if (preferences.enableCalendarAlerts) {
      const until = now.getTime() + 7 * 86_400_000;
      for (const event of events) {
        if (preferences.portfolioOnly && event.ticker && !portfolioTickers.has(event.ticker)) {
          continue;
        }
        if (event.eventAt.getTime() < now.getTime() || event.eventAt.getTime() > until) {
          continue;
        }
        const type =
          event.eventType === "earnings"
            ? "earnings_upcoming"
            : ["corporate_action", "dividend"].includes(event.eventType)
              ? "corporate_action_upcoming"
              : null;
        if (!type) continue;
        candidates.push({
          ruleId: null,
          ticker: event.ticker,
          alertType: type,
          severity: event.eventAt.getTime() - now.getTime() <= 2 * 86_400_000 ? "high" : "medium",
          title: event.title,
          detail:
            event.description ||
            `Scheduled for ${event.eventAt.toLocaleDateString("en-IN")}.`,
          source: event.source,
          sourceUrl: event.sourceUrl ?? null,
          dedupeKey: makeSystemDedupeKey(type, event.ticker ?? "market", String(event.id)),
          triggeredAt: now,
          metadata: {
            eventAt: event.eventAt.toISOString(),
            eventType: event.eventType,
          },
        });
      }
    }

    if (preferences.enableDataQualityAlerts) {
      const staleMinutes = Math.max(
        30,
        (livePreferences?.quoteTtlMinutes ?? 15) +
          (livePreferences?.staleIfErrorMinutes ?? 1_440),
      );
      const quoteByTicker = new Map(quotes.map((quote) => [quote.ticker, quote]));
      for (const holding of overview.holdings) {
        const ticker = holding.ticker.toUpperCase();
        const quote = quoteByTicker.get(ticker);
        const ageMinutes = quote
          ? (now.getTime() - quote.asOf.getTime()) / 60_000
          : Number.POSITIVE_INFINITY;
        if (ageMinutes <= staleMinutes) continue;
        candidates.push({
          ruleId: null,
          ticker,
          alertType: "data_stale",
          severity: quote ? "medium" : "high",
          title: `${ticker} market price is ${quote ? "stale" : "missing"}`,
          detail: quote
            ? `Latest provider quote is ${Math.round(ageMinutes)} minutes old. Portfolio valuation may be stale.`
            : "No provider quote is available. Portfolio valuation is using a transaction-price fallback.",
          source: "Live Data Monitor",
          sourceUrl: null,
          dedupeKey: makeSystemDedupeKey(
            "data_stale",
            ticker,
            now.toISOString().slice(0, 10),
          ),
          triggeredAt: now,
          metadata: {
            quoteAsOf: quote?.asOf.toISOString() ?? null,
            ageMinutes: Number.isFinite(ageMinutes) ? ageMinutes : null,
          },
        });
      }
    }

    if (preferences.enableProviderFailureAlerts) {
      const latestByProvider = new Map<string, (typeof providerRuns)[number]>();
      for (const run of providerRuns) {
        if (!latestByProvider.has(run.provider)) latestByProvider.set(run.provider, run);
      }
      for (const run of latestByProvider.values()) {
        if (run.status !== "failed") continue;
        if (now.getTime() - run.startedAt.getTime() > 24 * 60 * 60_000) continue;
        candidates.push({
          ruleId: null,
          ticker: null,
          alertType: "provider_failure",
          severity: "high",
          title: `${run.provider} live-data refresh failed`,
          detail: run.error || "The latest live-data provider run failed.",
          source: "Live Data Monitor",
          sourceUrl: null,
          dedupeKey: makeSystemDedupeKey(
            "provider_failure",
            run.provider,
            String(run.id),
          ),
          triggeredAt: now,
          metadata: { providerRunId: run.id },
        });
      }
    }

    const accepted = candidates.filter((candidate) => {
      if (!preferences.inAppNotifications) return false;
      if (!meetsSeverityThreshold(candidate.severity, preferences.severityThreshold)) {
        return false;
      }
      return !(
        preferences.portfolioOnly &&
        candidate.ticker &&
        !portfolioTickers.has(candidate.ticker)
      );
    });

    for (const candidate of accepted) await this.upsertCandidate(userId, candidate);

    const triggeredRuleIds = new Set(
      accepted
        .map((candidate) => candidate.ruleId)
        .filter((id): id is number => typeof id === "number"),
    );
    for (const rule of rules) {
      await db
        .update(alertRulesTable)
        .set({
          lastEvaluatedAt: now,
          ...(triggeredRuleIds.has(rule.id) ? { lastTriggeredAt: now } : {}),
          updatedAt: now,
        })
        .where(eq(alertRulesTable.id, rule.id));
    }

    return {
      evaluatedAt: now,
      rulesEvaluated: rules.filter((rule) => rule.isEnabled).length,
      candidates: candidates.length,
      alertsUpserted: accepted.length,
      suppressedByPreferences: candidates.length - accepted.length,
      summary: await this.getSummary(userId),
    };
  }
}

export const alertService = new AlertService();
