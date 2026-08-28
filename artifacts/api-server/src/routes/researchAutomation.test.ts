import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

import {
  ResearchRefreshCooldownError,
  createResearchAutomationRouter,
  type ResearchAutomationApiService,
} from "./researchAutomation";

function service(
  overrides: Partial<ResearchAutomationApiService> = {},
): ResearchAutomationApiService {
  return {
    listCoverage: async (userId) => [{ ticker: "RELIANCE", userId }],
    getCompany: async (userId, ticker) => ({
      ticker,
      userId,
      status: "current",
    }),
    listHistory: async (userId, ticker) => [{ ticker, userId, version: 1 }],
    requestRefresh: async () => ({ jobId: 9, created: true }),
    correctIdentity: async (userId, _ticker, input) => ({ userId, ...input }),
    getJob: async (userId, id) => ({ userId, id, status: "queued" }),
    ...overrides,
  };
}

async function withServer<T>(
  apiService: ResearchAutomationApiService,
  operation: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = req.header("x-test-user");
    (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated =
      () => Boolean(userId);
    if (userId) req.user = { id: userId } as never;
    next();
  });
  app.use(
    "/api/research/automation",
    createResearchAutomationRouter(apiService),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("missing address");
  try {
    return await operation(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("automation route: every read endpoint requires authentication", async () => {
  await withServer(service(), async (baseUrl) => {
    for (const path of [
      "/coverage",
      "/companies/RELIANCE",
      "/companies/RELIANCE/history",
      "/jobs/9",
    ]) {
      const response = await fetch(`${baseUrl}/api/research/automation${path}`);
      assert.equal(response.status, 401, path);
      assert.deepEqual(await response.json(), {
        error: "Sign in to use automated research",
      });
    }
  });
});

test("automation route: owned coverage, company, history, and job responses are tenant-scoped", async () => {
  await withServer(service(), async (baseUrl) => {
    const headers = { "x-test-user": "user-a" };
    const coverage = await fetch(
      `${baseUrl}/api/research/automation/coverage`,
      { headers },
    );
    assert.equal(coverage.status, 200);
    assert.deepEqual(await coverage.json(), {
      coverage: [{ ticker: "RELIANCE", userId: "user-a" }],
    });

    const company = await fetch(
      `${baseUrl}/api/research/automation/companies/reliance`,
      { headers },
    );
    assert.equal(company.status, 200);
    assert.deepEqual(await company.json(), {
      company: { ticker: "RELIANCE", userId: "user-a", status: "current" },
    });

    const history = await fetch(
      `${baseUrl}/api/research/automation/companies/RELIANCE/history`,
      { headers },
    );
    assert.equal(history.status, 200);
    assert.deepEqual(await history.json(), {
      history: [{ ticker: "RELIANCE", userId: "user-a", version: 1 }],
    });

    const job = await fetch(`${baseUrl}/api/research/automation/jobs/9`, {
      headers,
    });
    assert.equal(job.status, 200);
    assert.deepEqual(await job.json(), {
      job: { userId: "user-a", id: 9, status: "queued" },
    });
  });
});

test("automation route: another user's company, history, refresh, and job return 404", async () => {
  await withServer(
    service({
      getCompany: async () => null,
      listHistory: async () => null as never,
      requestRefresh: async () => null,
      getJob: async () => null,
    }),
    async (baseUrl) => {
      const headers = { "x-test-user": "user-b" };
      const company = await fetch(
        `${baseUrl}/api/research/automation/companies/RELIANCE`,
        { headers },
      );
      assert.equal(company.status, 404);
      const history = await fetch(
        `${baseUrl}/api/research/automation/companies/RELIANCE/history`,
        { headers },
      );
      assert.equal(history.status, 404);
      const refresh = await fetch(
        `${baseUrl}/api/research/automation/companies/RELIANCE/refresh`,
        { method: "POST", headers },
      );
      assert.equal(refresh.status, 404);
      const job = await fetch(`${baseUrl}/api/research/automation/jobs/9`, {
        headers,
      });
      assert.equal(job.status, 404);
    },
  );
});

test("automation route: refresh cooldown returns 429 without leaking internals", async () => {
  await withServer(
    service({
      requestRefresh: async () => {
        throw new ResearchRefreshCooldownError(300);
      },
    }),
    async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/research/automation/companies/RELIANCE/refresh`,
        { method: "POST", headers: { "x-test-user": "user-a" } },
      );
      assert.equal(response.status, 429);
      assert.equal(response.headers.get("retry-after"), "300");
      assert.deepEqual(await response.json(), {
        error: "Research refresh is cooling down",
        retryAfterSeconds: 300,
      });
    },
  );
});

test("automation route: identity correction validates and normalizes safe fields", async () => {
  let received: unknown;
  await withServer(
    service({
      correctIdentity: async (userId, ticker, input) => {
        received = { userId, ticker, input };
        return { ticker: input.ticker, status: "queued" };
      },
    }),
    async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/research/automation/companies/old/identity`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "x-test-user": "user-a",
          },
          body: JSON.stringify({
            ticker: " reliance ",
            exchange: " nse ",
            isin: " ine002a01018 ",
            name: " Reliance Industries ",
            securityType: "equity",
          }),
        },
      );
      assert.equal(response.status, 200);
      assert.deepEqual(received, {
        userId: "user-a",
        ticker: "OLD",
        input: {
          ticker: "RELIANCE",
          exchange: "NSE",
          isin: "INE002A01018",
          name: "Reliance Industries",
          securityType: "equity",
        },
      });
    },
  );
});

test("automation route: unexpected errors return one generic safe message", async () => {
  await withServer(
    service({
      listCoverage: async () => {
        throw new Error("OPENAI_API_KEY=secret upstream response body");
      },
    }),
    async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/research/automation/coverage`,
        { headers: { "x-test-user": "user-a" } },
      );
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), {
        error: "Automated research is temporarily unavailable",
      });
    },
  );
});
