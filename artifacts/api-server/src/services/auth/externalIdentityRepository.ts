import {
  authExternalIdentitiesTable,
  usersTable,
  type User,
} from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

export interface ExternalIdentityBindingInput {
  issuer: string;
  subject: string;
  userId: string;
}

export interface IdentityBindingTransaction {
  lockUser(userId: string): Promise<User | null>;
  findBinding(
    issuer: string,
    subject: string,
  ): Promise<{ userId: string } | null>;
  insertBindingIfAbsent(input: ExternalIdentityBindingInput): Promise<boolean>;
}

export interface ExternalIdentityRepositoryAdapter {
  findUser(issuer: string, subject: string): Promise<User | null>;
  transaction<T>(
    operation: (transaction: IdentityBindingTransaction) => Promise<T>,
  ): Promise<T>;
}

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

function validateIdentityPart(
  name: "issuer" | "subject" | "userId",
  value: string,
  maxLength?: number,
): void {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    CONTROL_CHARACTER.test(value) ||
    (maxLength !== undefined && value.length > maxLength)
  ) {
    throw new Error(`Invalid external identity ${name}.`);
  }
}

export function validateExternalIdentityBinding(
  input: ExternalIdentityBindingInput,
): ExternalIdentityBindingInput {
  validateIdentityPart("issuer", input.issuer, 512);
  validateIdentityPart("subject", input.subject, 255);
  validateIdentityPart("userId", input.userId);
  return input;
}

const databaseRepository: ExternalIdentityRepositoryAdapter = {
  async findUser(issuer, subject) {
    const { db } = await import("@workspace/db");
    const [result] = await db
      .select({ user: usersTable })
      .from(authExternalIdentitiesTable)
      .innerJoin(
        usersTable,
        eq(usersTable.id, authExternalIdentitiesTable.userId),
      )
      .where(
        and(
          eq(authExternalIdentitiesTable.issuer, issuer),
          eq(authExternalIdentitiesTable.subject, subject),
        ),
      )
      .limit(1);
    return result?.user ?? null;
  },

  async transaction(operation) {
    const { db } = await import("@workspace/db");
    return db.transaction(async (databaseTransaction) =>
      operation({
        async lockUser(userId) {
          const [user] = await databaseTransaction
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .limit(1)
            .for("update");
          return user ?? null;
        },

        async findBinding(issuer, subject) {
          const [binding] = await databaseTransaction
            .select({ userId: authExternalIdentitiesTable.userId })
            .from(authExternalIdentitiesTable)
            .where(
              and(
                eq(authExternalIdentitiesTable.issuer, issuer),
                eq(authExternalIdentitiesTable.subject, subject),
              ),
            )
            .limit(1)
            .for("update");
          return binding ?? null;
        },

        async insertBindingIfAbsent(input) {
          const inserted = await databaseTransaction
            .insert(authExternalIdentitiesTable)
            .values(input)
            .onConflictDoNothing({
              target: [
                authExternalIdentitiesTable.issuer,
                authExternalIdentitiesTable.subject,
              ],
            })
            .returning({ issuer: authExternalIdentitiesTable.issuer });
          return inserted.length === 1;
        },
      }),
    );
  },
};

export async function findUserByExternalIdentity(
  issuer: string,
  subject: string,
  repository: ExternalIdentityRepositoryAdapter = databaseRepository,
): Promise<User | null> {
  validateIdentityPart("issuer", issuer, 512);
  validateIdentityPart("subject", subject, 255);
  return repository.findUser(issuer, subject);
}

export async function bindExternalIdentity(
  rawInput: ExternalIdentityBindingInput,
  repository: ExternalIdentityRepositoryAdapter = databaseRepository,
): Promise<"created" | "already_bound"> {
  const input = validateExternalIdentityBinding(rawInput);
  return repository.transaction(async (transaction) => {
    const user = await transaction.lockUser(input.userId);
    if (!user) {
      throw new Error("Selected internal user does not exist.");
    }

    const existing = await transaction.findBinding(input.issuer, input.subject);
    if (existing) {
      if (existing.userId === input.userId) return "already_bound";
      throw new Error("External identity is already bound to another user.");
    }

    if (await transaction.insertBindingIfAbsent(input)) return "created";

    const racedBinding = await transaction.findBinding(
      input.issuer,
      input.subject,
    );
    if (racedBinding?.userId === input.userId) return "already_bound";
    if (racedBinding) {
      throw new Error("External identity is already bound to another user.");
    }
    throw new Error("External identity binding could not be confirmed.");
  });
}
