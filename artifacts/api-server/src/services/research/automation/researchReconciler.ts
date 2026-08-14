import { createHash } from "node:crypto";

import type {
  AutomationStatus,
  AutomationTrigger,
  IdentityStatus,
  SecurityType,
} from "@workspace/research-contracts";

import {
  buildIdempotencyKey,
  buildRefreshBucket,
} from "./researchAutomationRepository";
import { classifySecurity } from "./securityClassifier";

export interface ReconciliationHolding {
  ticker: string;
  name: string | null;
  exchange: string;
  sector: string | null;
  isin: string | null;
  marketPrice: number | null;
  previousClose: number | null;
}

export interface ReconciliationCompany {
  id: number;
  userId: string;
  ticker: string;
  name: string;
  exchange: string;
  sector: string | null;
  isin: string | null;
  normalizedIdentityKey: string | null;
  securityType: SecurityType;
  identityStatus: IdentityStatus;
  identityConfidence: number;
  automationEnabled: boolean;
  isArchived: boolean;
}

export interface ReconciliationTarget {
  id: number;
  userId: string;
  portfolioId: number;
  companyId: number;
  ticker: string;
  holdingFingerprint: string;
  isActive: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
  removedAt: Date | null;
}

export interface ReconciliationSnapshot {
  userId: string;
  companyId: number;
  validUntil: Date;
}

export interface ReconciliationJob {
  id: number;
  userId: string;
  companyId: number;
  trigger: AutomationTrigger;
  idempotencyKey: string;
  status: AutomationStatus;
}

export interface ReconciliationTransaction {
  listHoldings(): Promise<ReconciliationHolding[]>;
  listTargets(): Promise<ReconciliationTarget[]>;
  lockIdentity(normalizedIdentityKey: string): Promise<void>;
  findCompany(input: {
    normalizedIdentityKey: string;
    ticker: string;
  }): Promise<ReconciliationCompany | null>;
  createCompany(input: {
    ticker: string;
    name: string;
    exchange: string;
    sector: string | null;
    isin: string | null;
    normalizedIdentityKey: string;
    securityType: SecurityType;
    identityStatus: IdentityStatus;
    identityConfidence: number;
  }): Promise<ReconciliationCompany>;
  updateCompanyAutomation(
    companyId: number,
    input: {
      isin?: string;
      normalizedIdentityKey?: string;
      securityType?: SecurityType;
      identityStatus?: IdentityStatus;
      identityConfidence?: number;
    },
  ): Promise<ReconciliationCompany>;
  createTarget(input: {
    companyId: number;
    ticker: string;
    holdingFingerprint: string;
    now: Date;
  }): Promise<ReconciliationTarget>;
  updateTarget(
    targetId: number,
    input: {
      companyId?: number;
      holdingFingerprint?: string;
      isActive?: boolean;
      lastSeenAt?: Date;
      removedAt?: Date | null;
    },
  ): Promise<ReconciliationTarget>;
  latestSuccessfulSnapshot(
    companyId: number,
  ): Promise<ReconciliationSnapshot | null>;
  hasPendingJob(companyId: number): Promise<boolean>;
  enqueueJob(input: {
    companyId: number;
    trigger: AutomationTrigger;
    idempotencyKey: string;
    context: Record<string, unknown>;
    runAfter: Date;
  }): Promise<{ job: ReconciliationJob; created: boolean }>;
  hasActiveTarget(companyId: number): Promise<boolean>;
  markReconciled(now: Date): Promise<void>;
}

export interface ReconciliationRepository {
  transaction<T>(
    userId: string,
    portfolioId: number,
    operation: (tx: ReconciliationTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface ReconcilePortfolioInput {
  userId: string;
  portfolioId: number;
  now?: Date;
  timezone?: string;
}

export interface ReconcilePortfolioResult {
  memberships: {
    new: string[];
    reactivated: string[];
    changed: string[];
    unchanged: string[];
    removed: string[];
  };
  companiesCreated: number;
  jobsCreated: number;
  needsIdentity: string[];
  effectiveCoverage: Map<number, boolean>;
}

function normalizedText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ").toUpperCase() ?? "";
}

function normalizeTicker(value: string): string {
  const ticker = normalizedText(value);
  if (!/^[A-Z0-9.&_-]{1,30}$/.test(ticker)) {
    throw new Error("holding ticker is invalid");
  }
  return ticker;
}

function normalizeIsin(value: string | null): string | null {
  const isin = normalizedText(value);
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin) ? isin : null;
}

export function normalizeHoldingIdentity(holding: ReconciliationHolding): {
  isin: string | null;
  normalizedIdentityKey: string;
} {
  const ticker = normalizeTicker(holding.ticker);
  const isin = normalizeIsin(holding.isin);
  if (isin) return { isin, normalizedIdentityKey: `isin:${isin}` };
  const exchange = normalizedText(holding.exchange) || "UNKNOWN";
  return {
    isin: null,
    normalizedIdentityKey: `security:${exchange}:${ticker}`,
  };
}

export function holdingIdentityFingerprint(
  holding: ReconciliationHolding,
  normalizedIdentityKey = normalizeHoldingIdentity(holding)
    .normalizedIdentityKey,
): string {
  const stableIdentity = [
    normalizedIdentityKey,
    normalizeTicker(holding.ticker),
    normalizedText(holding.name),
    normalizedText(holding.exchange),
    normalizedText(holding.sector),
  ].join("|");
  return createHash("sha256").update(stableIdentity).digest("hex");
}

function confidenceValue(
  confidence: ReturnType<typeof classifySecurity>["confidence"],
): number {
  if (confidence === "high") return 1;
  if (confidence === "moderate") return 0.75;
  return 0.25;
}

function classificationFor(holding: ReconciliationHolding) {
  const identity = normalizeHoldingIdentity(holding);
  const classification = classifySecurity({
    ticker: holding.ticker,
    name: holding.name,
    exchange: holding.exchange,
    isin: identity.isin,
  });
  return {
    ...identity,
    securityType: classification.securityType,
    identityStatus:
      classification.confidence === "limited" ? "needs_identity" : "resolved",
    identityConfidence: confidenceValue(classification.confidence),
  } satisfies {
    isin: string | null;
    normalizedIdentityKey: string;
    securityType: SecurityType;
    identityStatus: IdentityStatus;
    identityConfidence: number;
  };
}

function jobTriggerFor(
  disposition: "new" | "reactivated" | "changed" | "unchanged",
  companyWasCreated: boolean,
  identityWasResolved: boolean,
): AutomationTrigger {
  if (disposition === "reactivated") return "portfolio_reconciled";
  if (disposition === "changed" || identityWasResolved)
    return "holding_changed";
  if (companyWasCreated || disposition === "new") return "holding_added";
  return "holding_added";
}

export async function reconcilePortfolioHoldings(
  repository: ReconciliationRepository,
  input: ReconcilePortfolioInput,
): Promise<ReconcilePortfolioResult> {
  const userId = input.userId.trim();
  if (!userId) throw new Error("userId is required");
  if (!Number.isInteger(input.portfolioId) || input.portfolioId <= 0) {
    throw new Error("portfolioId is invalid");
  }
  const now = input.now ?? new Date();
  const timezone = input.timezone?.trim() || "Asia/Kolkata";

  return repository.transaction(userId, input.portfolioId, async (tx) => {
    const result: ReconcilePortfolioResult = {
      memberships: {
        new: [],
        reactivated: [],
        changed: [],
        unchanged: [],
        removed: [],
      },
      companiesCreated: 0,
      jobsCreated: 0,
      needsIdentity: [],
      effectiveCoverage: new Map<number, boolean>(),
    };
    const holdings = await tx.listHoldings();
    const existingTargets = await tx.listTargets();
    const targetByTicker = new Map(
      existingTargets.map((target) => [normalizeTicker(target.ticker), target]),
    );
    const seenTickers = new Set<string>();

    for (const rawHolding of holdings) {
      const ticker = normalizeTicker(rawHolding.ticker);
      if (seenTickers.has(ticker)) continue;
      seenTickers.add(ticker);
      const holding = { ...rawHolding, ticker };
      const classified = classificationFor(holding);
      await tx.lockIdentity(classified.normalizedIdentityKey);
      let company = await tx.findCompany({
        normalizedIdentityKey: classified.normalizedIdentityKey,
        ticker,
      });
      const companyWasCreated = !company;
      const identityWasResolved =
        Boolean(company) &&
        company!.identityStatus === "needs_identity" &&
        classified.identityStatus === "resolved";

      if (!company) {
        company = await tx.createCompany({
          ticker,
          name: rawHolding.name?.trim() || ticker,
          exchange: normalizedText(rawHolding.exchange) || "NSE",
          sector: rawHolding.sector?.trim() || null,
          ...classified,
        });
        result.companiesCreated += 1;
        const createConflictHasDifferentIsin =
          Boolean(company.isin) &&
          Boolean(classified.isin) &&
          company.isin !== classified.isin;
        if (createConflictHasDifferentIsin) {
          company = await tx.updateCompanyAutomation(company.id, {
            identityStatus: "needs_identity",
            identityConfidence: 0,
          });
        } else if (
          classified.isin &&
          company.normalizedIdentityKey?.startsWith("security:")
        ) {
          company = await tx.updateCompanyAutomation(company.id, {
            isin: company.isin ?? classified.isin,
            normalizedIdentityKey: classified.normalizedIdentityKey,
            securityType: classified.securityType,
            identityStatus: classified.identityStatus,
            identityConfidence: classified.identityConfidence,
          });
        }
      } else {
        const matchedExactIdentity =
          company.normalizedIdentityKey === classified.normalizedIdentityKey;
        const conflictingStableIsin =
          Boolean(classified.isin) &&
          Boolean(company.isin) &&
          company.isin !== classified.isin &&
          !matchedExactIdentity;
        const canUpgradeTickerIdentity =
          Boolean(classified.isin) &&
          company.normalizedIdentityKey?.startsWith("security:") === true;
        const preserveResolvedIdentity =
          company.identityStatus === "resolved" &&
          Boolean(company.normalizedIdentityKey) &&
          classified.identityStatus === "needs_identity";
        company = await tx.updateCompanyAutomation(company.id, {
          ...(conflictingStableIsin || company.isin
            ? {}
            : classified.isin
              ? { isin: classified.isin }
              : {}),
          ...(conflictingStableIsin
            ? {}
            : canUpgradeTickerIdentity
              ? { normalizedIdentityKey: classified.normalizedIdentityKey }
              : company.normalizedIdentityKey
                ? {}
                : { normalizedIdentityKey: classified.normalizedIdentityKey }),
          ...(conflictingStableIsin
            ? { identityStatus: "needs_identity", identityConfidence: 0 }
            : preserveResolvedIdentity
              ? {}
              : {
                  securityType: classified.securityType,
                  identityStatus: classified.identityStatus,
                  identityConfidence: classified.identityConfidence,
                }),
        });
      }

      const normalizedIdentityKey =
        company.normalizedIdentityKey ?? classified.normalizedIdentityKey;
      const fingerprint = holdingIdentityFingerprint(
        holding,
        normalizedIdentityKey,
      );
      const existingTarget = targetByTicker.get(ticker);
      let disposition: "new" | "reactivated" | "changed" | "unchanged";

      if (!existingTarget) {
        const target = await tx.createTarget({
          companyId: company.id,
          ticker,
          holdingFingerprint: fingerprint,
          now,
        });
        targetByTicker.set(ticker, target);
        disposition = "new";
      } else if (!existingTarget.isActive) {
        await tx.updateTarget(existingTarget.id, {
          companyId: company.id,
          holdingFingerprint: fingerprint,
          isActive: true,
          lastSeenAt: now,
          removedAt: null,
        });
        disposition = "reactivated";
      } else if (
        existingTarget.holdingFingerprint !== fingerprint ||
        existingTarget.companyId !== company.id
      ) {
        await tx.updateTarget(existingTarget.id, {
          companyId: company.id,
          holdingFingerprint: fingerprint,
          lastSeenAt: now,
          removedAt: null,
        });
        disposition = "changed";
      } else {
        await tx.updateTarget(existingTarget.id, {
          lastSeenAt: now,
          removedAt: null,
        });
        disposition = "unchanged";
      }
      result.memberships[disposition].push(ticker);

      if (company.identityStatus === "needs_identity") {
        result.needsIdentity.push(ticker);
      } else if (company.automationEnabled) {
        const [snapshot, hasPendingJob] = await Promise.all([
          tx.latestSuccessfulSnapshot(company.id),
          tx.hasPendingJob(company.id),
        ]);
        const needsResearch =
          !snapshot || snapshot.validUntil.getTime() <= now.getTime();
        if (needsResearch && !hasPendingJob) {
          const trigger = jobTriggerFor(
            disposition,
            companyWasCreated,
            identityWasResolved,
          );
          const refreshBucket = buildRefreshBucket({
            trigger,
            holdingFingerprint: fingerprint,
            now,
            timezone,
          });
          const idempotencyKey = buildIdempotencyKey({
            userId,
            normalizedIdentityKey,
            trigger,
            refreshBucket,
          });
          const enqueued = await tx.enqueueJob({
            companyId: company.id,
            trigger,
            idempotencyKey,
            context: {
              portfolioId: input.portfolioId,
              ticker,
              holdingFingerprint: fingerprint,
            },
            runAfter: now,
          });
          if (enqueued.created) result.jobsCreated += 1;
        }
      }
      result.effectiveCoverage.set(company.id, true);
    }

    for (const target of existingTargets) {
      const ticker = normalizeTicker(target.ticker);
      if (!target.isActive || seenTickers.has(ticker)) continue;
      await tx.updateTarget(target.id, {
        isActive: false,
        lastSeenAt: now,
        removedAt: now,
      });
      result.memberships.removed.push(ticker);
      result.effectiveCoverage.set(
        target.companyId,
        await tx.hasActiveTarget(target.companyId),
      );
    }

    await tx.markReconciled(now);
    return result;
  });
}
