import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseBindingArgs,
  runBindingCommand,
  type BindingCommandDependencies,
} from "./bindExternalIdentity";

const validArguments = [
  "--issuer",
  "https://accounts.google.com",
  "--subject",
  "123456789",
  "--user-id",
  "existing-owner",
];

describe("external identity binding command", () => {
  it("parses only the three required exact flags", () => {
    assert.deepEqual(parseBindingArgs(validArguments), {
      issuer: "https://accounts.google.com",
      subject: "123456789",
      userId: "existing-owner",
    });
  });

  it("rejects missing, duplicate, unknown, and positional arguments", () => {
    const invalidArguments = [
      [],
      validArguments.slice(0, -2),
      [...validArguments, "--subject", "duplicate"],
      [...validArguments, "--email", "display@example.com"],
      [...validArguments, "positional"],
      ["--issuer"],
      ["--issuer", "--subject", "value", "--user-id", "owner"],
    ];

    for (const argumentsList of invalidArguments) {
      assert.throws(() => parseBindingArgs(argumentsList), /Usage:/);
    }
  });

  it("rejects blank, oversized, or control-character values", () => {
    for (const argumentsList of [
      validArguments.map((value) => (value === "123456789" ? " " : value)),
      validArguments.map((value) =>
        value === "123456789" ? "x".repeat(256) : value,
      ),
      validArguments.map((value) =>
        value === "123456789" ? "subject\nline" : value,
      ),
    ]) {
      assert.throws(() => parseBindingArgs(argumentsList), /identity/i);
    }
  });

  it("binds once, reports the result, and closes resources", async () => {
    const calls: string[] = [];
    const dependencies: BindingCommandDependencies = {
      async bind(input) {
        calls.push(JSON.stringify(input));
        return "created";
      },
      log(message) {
        calls.push(message);
      },
      async close() {
        calls.push("closed");
      },
    };

    assert.equal(await runBindingCommand(validArguments, dependencies), 0);
    assert.deepEqual(calls, [
      JSON.stringify({
        issuer: "https://accounts.google.com",
        subject: "123456789",
        userId: "existing-owner",
      }),
      "External identity binding: created.",
      "closed",
    ]);
  });

  it("returns nonzero and still closes on a binding conflict", async () => {
    const calls: string[] = [];
    const dependencies: BindingCommandDependencies = {
      async bind() {
        throw new Error("External identity is already bound to another user.");
      },
      log(message) {
        calls.push(message);
      },
      async close() {
        calls.push("closed");
      },
    };

    assert.equal(await runBindingCommand(validArguments, dependencies), 1);
    assert.deepEqual(calls, [
      "External identity is already bound to another user.",
      "closed",
    ]);
  });
});
