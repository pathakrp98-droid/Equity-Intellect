import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { User } from "@workspace/db";

import {
  bindExternalIdentity,
  findUserByExternalIdentity,
  type ExternalIdentityRepositoryAdapter,
  type IdentityBindingTransaction,
} from "./externalIdentityRepository";

const owner: User = {
  id: "existing-owner",
  email: "display@example.com",
  firstName: "Existing",
  lastName: "Owner",
  profileImageUrl: null,
  createdAt: new Date("2026-08-30T00:00:00.000Z"),
  updatedAt: new Date("2026-08-30T00:00:00.000Z"),
};

function identityKey(issuer: string, subject: string): string {
  return JSON.stringify([issuer, subject]);
}

function fakeRepository(
  users: User[] = [owner],
): ExternalIdentityRepositoryAdapter & {
  identities: Map<string, string>;
  transactionCount: number;
} {
  const userMap = new Map(users.map((user) => [user.id, user]));
  const identities = new Map<string, string>();
  const repository = {
    identities,
    transactionCount: 0,
    async findUser(issuer: string, subject: string) {
      const userId = identities.get(identityKey(issuer, subject));
      return userId ? (userMap.get(userId) ?? null) : null;
    },
    async transaction<T>(
      operation: (transaction: IdentityBindingTransaction) => Promise<T>,
    ) {
      repository.transactionCount += 1;
      return operation({
        async lockUser(userId) {
          return userMap.get(userId) ?? null;
        },
        async findBinding(issuer, subject) {
          const userId = identities.get(identityKey(issuer, subject));
          return userId ? { userId } : null;
        },
        async insertBindingIfAbsent(input) {
          const key = identityKey(input.issuer, input.subject);
          if (identities.has(key)) return false;
          identities.set(key, input.userId);
          return true;
        },
      });
    },
  } satisfies ExternalIdentityRepositoryAdapter & {
    identities: Map<string, string>;
    transactionCount: number;
  };
  return repository;
}

const googleIdentity = {
  issuer: "https://accounts.google.com",
  subject: "123456789",
  userId: owner.id,
};

describe("external identity binding", () => {
  it("rejects a missing internal owner before insertion", async () => {
    const repository = fakeRepository([]);

    await assert.rejects(
      bindExternalIdentity(googleIdentity, repository),
      /Selected internal user does not exist/,
    );
    assert.equal(repository.identities.size, 0);
    assert.equal(repository.transactionCount, 1);
  });

  it("creates one exact issuer and subject binding", async () => {
    const repository = fakeRepository();

    assert.equal(
      await bindExternalIdentity(googleIdentity, repository),
      "created",
    );
    assert.equal(
      repository.identities.get(
        identityKey(googleIdentity.issuer, googleIdentity.subject),
      ),
      owner.id,
    );
  });

  it("is idempotent only for the same internal owner", async () => {
    const repository = fakeRepository();

    await bindExternalIdentity(googleIdentity, repository);
    assert.equal(
      await bindExternalIdentity(googleIdentity, repository),
      "already_bound",
    );
    assert.equal(repository.identities.size, 1);
  });

  it("refuses an identity already bound to another owner", async () => {
    const secondOwner = { ...owner, id: "second-owner" };
    const repository = fakeRepository([owner, secondOwner]);
    await bindExternalIdentity(googleIdentity, repository);

    await assert.rejects(
      bindExternalIdentity(
        { ...googleIdentity, userId: secondOwner.id },
        repository,
      ),
      /External identity is already bound to another user/,
    );
    assert.equal(repository.identities.size, 1);
  });

  it("looks up exact case-sensitive issuer and subject pairs", async () => {
    const repository = fakeRepository();
    await bindExternalIdentity(googleIdentity, repository);

    assert.equal(
      await findUserByExternalIdentity(
        googleIdentity.issuer,
        googleIdentity.subject,
        repository,
      ),
      owner,
    );
    assert.equal(
      await findUserByExternalIdentity(
        googleIdentity.issuer.toUpperCase(),
        googleIdentity.subject,
        repository,
      ),
      null,
    );
    assert.equal(
      await findUserByExternalIdentity(
        googleIdentity.issuer,
        `0${googleIdentity.subject}`,
        repository,
      ),
      null,
    );
  });

  it("validates database key lengths and control characters", async () => {
    const repository = fakeRepository();

    await assert.rejects(
      bindExternalIdentity(
        { ...googleIdentity, issuer: `https://${"a".repeat(505)}` },
        repository,
      ),
      /issuer/i,
    );
    await assert.rejects(
      bindExternalIdentity(
        { ...googleIdentity, subject: "subject\nwith-control" },
        repository,
      ),
      /subject/i,
    );
  });
});
