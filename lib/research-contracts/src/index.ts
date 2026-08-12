import { z } from "zod/v4";

export type SecurityType = "equity" | "etf" | "mutual_fund" | "unlisted" | "unknown";
export type IdentityStatus = "resolved" | "needs_identity";
export type CoverageState = "queued" | "running" | "current" | "limited" | "stale" | "failed" | "needs_identity" | "archived";
export type AutomationTrigger = "holding_added" | "holding_changed" | "portfolio_reconciled" | "scheduled_refresh" | "material_event" | "manual_refresh";
export type AutomationStatus = "queued" | "running" | "succeeded" | "partial" | "failed" | "dead_letter" | "cancelled" | "skipped";
export type StatementKind = "fact" | "calculation" | "ai_judgement";
export type EvidenceTier = "primary" | "secondary" | "excluded";
export type EvidenceStrength = "strong" | "moderate" | "limited";

export const securityTypeSchema = z.enum([
  "equity",
  "etf",
  "mutual_fund",
  "unlisted",
  "unknown",
]);
export const identityStatusSchema = z.enum(["resolved", "needs_identity"]);
export const coverageStateSchema = z.enum([
  "queued",
  "running",
  "current",
  "limited",
  "stale",
  "failed",
  "needs_identity",
  "archived",
]);
export const automationTriggerSchema = z.enum([
  "holding_added",
  "holding_changed",
  "portfolio_reconciled",
  "scheduled_refresh",
  "material_event",
  "manual_refresh",
]);
export const automationStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "partial",
  "failed",
  "dead_letter",
  "cancelled",
  "skipped",
]);
export const statementKindSchema = z.enum([
  "fact",
  "calculation",
  "ai_judgement",
]);
export const evidenceTierSchema = z.enum(["primary", "secondary", "excluded"]);
export const evidenceStrengthSchema = z.enum(["strong", "moderate", "limited"]);

export const researchEvidenceInputSchema = z
  .object({
    id: z.string().min(1).max(128),
    title: z.string().min(1).max(2_000),
    publisher: z.string().min(1).max(500),
    sourceType: z.string().min(1).max(100).optional(),
    url: z.string().max(2_000).nullable(),
    publishedAt: z.iso.datetime().nullable(),
    retrievedAt: z.iso.datetime(),
    tier: evidenceTierSchema,
    summary: z.string().min(1).max(1_000),
  })
  .strict();
export type ResearchEvidenceInput = z.infer<typeof researchEvidenceInputSchema>;

export const researchStatementSchema = z
  .object({
    id: z.string().min(1).max(128),
    text: z.string().min(1).max(2_000),
    kind: statementKindSchema,
    confidence: z.enum(["high", "moderate", "limited"]),
    evidenceIds: z.array(z.string().min(1).max(128)).min(1).max(8),
  })
  .strict();
export type ResearchStatement = z.infer<typeof researchStatementSchema>;

const snapshotSectionKeys = [
  "whatYouOwn",
  "investmentCase",
  "whatChanged",
  "risks",
  "catalysts",
  "assessment",
  "watchNext",
] as const;
const factualSectionSchema = z.enum(["whatYouOwn", "whatChanged"]);
const evaluativeSectionSchema = z.enum([
  "investmentCase",
  "risks",
  "catalysts",
  "assessment",
  "watchNext",
]);
const snapshotClaimSchema = z.discriminatedUnion("section", [
  researchStatementSchema.extend({ section: factualSectionSchema }),
  researchStatementSchema.extend({
    section: evaluativeSectionSchema,
    kind: z.literal("ai_judgement"),
  }),
]);

export const automatedResearchSnapshotSchema = z
  .object({
    securityType: securityTypeSchema,
    claims: z.array(snapshotClaimSchema).min(7).max(100),
    unknowns: z.array(z.string().min(1).max(2_000)).max(20),
    numericTarget: z.number().finite().positive().optional(),
    evidenceStrength: evidenceStrengthSchema,
    evidenceStrengthReason: z.string().min(1).max(2_000),
    generatedAt: z.iso.datetime(),
    staleAt: z.iso.datetime(),
  })
  .strict()
  .superRefine((snapshot, context) => {
    for (const section of snapshotSectionKeys) {
      const claimCount = snapshot.claims.filter(
        (claim) => claim.section === section,
      ).length;
      if (claimCount === 0) {
        context.addIssue({
          code: "custom",
          path: ["claims"],
          message: `The ${section} section requires at least one statement.`,
        });
      }
      if (claimCount > 20) {
        context.addIssue({
          code: "custom",
          path: ["claims"],
          message: `The ${section} section cannot contain more than 20 statements.`,
        });
      }
    }
  });
export type AutomatedResearchSnapshotPayload = z.infer<
  typeof automatedResearchSnapshotSchema
>;

export const automatedResearchSnapshotJsonSchema = z.toJSONSchema(
  automatedResearchSnapshotSchema,
  { target: "draft-7", reused: "inline", cycles: "throw" },
);

export function validateSnapshotClaims(
  payload: unknown,
  evidenceIds: ReadonlySet<string>,
): AutomatedResearchSnapshotPayload {
  const snapshot = automatedResearchSnapshotSchema.parse(payload);

  if (snapshot.securityType !== "equity" && snapshot.numericTarget !== undefined) {
    throw new Error("Numeric targets are only allowed for equity securities.");
  }

  for (const statement of snapshot.claims) {
    for (const evidenceId of statement.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        throw new Error(`Statement ${statement.id} references unknown evidence ${evidenceId}.`);
      }
    }
  }

  return snapshot;
}
