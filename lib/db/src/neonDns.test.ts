import assert from "node:assert/strict";
import { createServer } from "node:net";
import { test } from "node:test";

import {
  createIpv4DnsLookup,
  createIpv4ResolvedSocket,
  shouldUseProtocolDnsResolver,
  type Resolve4,
} from "./neonDns";

test("protocol DNS lookup returns every IPv4 address when requested", async () => {
  const resolve4: Resolve4 = (_hostname, callback) => {
    callback(null, ["203.0.113.10", "203.0.113.11"]);
  };
  const lookup = createIpv4DnsLookup(resolve4);

  const addresses = await new Promise<unknown>((resolve, reject) => {
    lookup("database.example", { all: true }, (error, address) => {
      if (error) reject(error);
      else resolve(address);
    });
  });

  assert.deepEqual(addresses, [
    { address: "203.0.113.10", family: 4 },
    { address: "203.0.113.11", family: 4 },
  ]);
});

test("protocol DNS lookup returns the first IPv4 address for one-address callers", async () => {
  const resolve4: Resolve4 = (_hostname, callback) => {
    callback(null, ["203.0.113.20", "203.0.113.21"]);
  };
  const lookup = createIpv4DnsLookup(resolve4);

  const result = await new Promise<{ address: unknown; family: unknown }>(
    (resolve, reject) => {
      lookup("database.example", { all: false }, (error, address, family) => {
        if (error) reject(error);
        else resolve({ address, family });
      });
    },
  );

  assert.deepEqual(result, { address: "203.0.113.20", family: 4 });
});

test("protocol DNS lookup preserves resolver failures", async () => {
  const expected = Object.assign(new Error("DNS unavailable"), {
    code: "ESERVFAIL",
  });
  const resolve4: Resolve4 = (_hostname, callback) => {
    callback(expected, undefined);
  };
  const lookup = createIpv4DnsLookup(resolve4);

  const error = await new Promise<NodeJS.ErrnoException>((resolve) => {
    lookup("database.example", { all: false }, (lookupError) => {
      assert.ok(lookupError);
      resolve(lookupError);
    });
  });

  assert.equal(error, expected);
});

test("custom database socket uses the supplied protocol DNS lookup", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  let resolvedHostname: string | undefined;
  const lookup = createIpv4DnsLookup((hostname, callback) => {
    resolvedHostname = hostname;
    callback(null, ["127.0.0.1"]);
  });
  const socket = createIpv4ResolvedSocket(lookup);

  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
      socket.connect(address.port, "database.example");
    });
    assert.equal(resolvedHostname, "database.example");
  } finally {
    socket.destroy();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("protocol DNS resolver is limited to Neon PostgreSQL URLs", () => {
  assert.equal(
    shouldUseProtocolDnsResolver(
      "postgresql://user:password@ep-example-pooler.us-east-2.aws.neon.tech/neondb",
    ),
    true,
  );
  assert.equal(
    shouldUseProtocolDnsResolver(
      "postgresql://user:password@localhost:5432/neondb",
    ),
    false,
  );
  assert.equal(shouldUseProtocolDnsResolver("not a URL"), false);
});
