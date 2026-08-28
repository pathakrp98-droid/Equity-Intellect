#!/usr/bin/env node

const baseUrl = (
  process.env.ALPHADESK_BASE_URL ?? "http://localhost:5000"
).replace(/\/$/, "");
const sessionCookie = process.env.ALPHADESK_SESSION_COOKIE?.replace(
  /^cookie:\s*/i,
  "",
);
const secondUserCookie = process.env.ALPHADESK_SECOND_USER_COOKIE?.replace(
  /^cookie:\s*/i,
  "",
);
const allowMutation = process.env.ALPHADESK_SMOKE_MUTATE === "1";

let failures = 0;

function report(passed, name, detail) {
  if (!passed) failures += 1;
  console.log(`${passed ? "PASS" : "FAIL"} ${name}: ${detail}`);
  return passed;
}

function skip(name, detail) {
  console.log(`SKIP ${name}: ${detail}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    redirect: "manual",
    headers: {
      Accept: "application/json",
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Status assertions still provide useful smoke evidence.
  }
  return { response, payload };
}

function findKey(value, matcher, path = "response") {
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (matcher(key)) return childPath;
    const nested = findKey(child, matcher, childPath);
    if (nested) return nested;
  }
  return null;
}

async function statusCheck(name, path, accepted) {
  try {
    const { response } = await request(path);
    report(
      accepted.includes(response.status),
      name,
      `HTTP ${response.status} (expected ${accepted.join("/")})`,
    );
  } catch (error) {
    report(false, name, error instanceof Error ? error.message : String(error));
  }
}

await statusCheck("API health", "/api/health", [200]);
await statusCheck("Integration endpoint protection", "/api/integration/health", [401]);
await statusCheck("Research endpoint protection", "/api/research/automation/coverage", [401]);
await statusCheck("Legacy mock dashboard removed", "/api/dashboard/summary", [404]);
await statusCheck("Legacy mock market scanner removed", "/api/market/scanner", [404]);

if (!sessionCookie) {
  skip(
    "Authenticated portfolio and research smoke",
    "set ALPHADESK_SESSION_COOKIE to a signed-in preview session",
  );
} else {
  try {
    const [holdingsResult, coverageResult] = await Promise.all([
      request("/api/portfolio/holdings", { cookie: sessionCookie }),
      request("/api/research/automation/coverage", { cookie: sessionCookie }),
    ]);
    const holdings = Array.isArray(holdingsResult.payload)
      ? holdingsResult.payload
      : [];
    const coverage = Array.isArray(coverageResult.payload?.coverage)
      ? coverageResult.payload.coverage
      : [];
    report(
      holdingsResult.response.status === 200,
      "Authenticated portfolio",
      `HTTP ${holdingsResult.response.status}`,
    );
    report(
      coverageResult.response.status === 200,
      "Authenticated research coverage",
      `HTTP ${coverageResult.response.status}`,
    );
    const coveredHoldingRows = coverage.filter((item) => item?.isHolding);
    report(
      coveredHoldingRows.length >= holdings.length &&
        coveredHoldingRows.every((item) => item.isCovered),
      "Coverage follows active holdings",
      `${coveredHoldingRows.length}/${holdings.length} active holdings covered`,
    );
    const honestStates = new Set([
      "queued",
      "running",
      "current",
      "limited",
      "stale",
      "failed",
      "needs_identity",
      "archived",
    ]);
    report(
      coveredHoldingRows.every(
        (item) => item.automationState === null || honestStates.has(item.automationState),
      ),
      "Honest coverage status",
      "every covered holding exposes a recognized current or non-current state",
    );

    const candidate = coveredHoldingRows.find(
      (item) =>
        typeof item.ticker === "string" &&
        item.id !== null &&
        item.identityStatus === "resolved",
    );
    if (!candidate) {
      skip("Snapshot and history smoke", "no covered holding is available");
    } else {
      const ticker = encodeURIComponent(candidate.ticker);
      const companyResult = await request(
        `/api/research/automation/companies/${ticker}`,
        { cookie: sessionCookie },
      );
      report(
        companyResult.response.status === 200,
        "Owned automated research",
        `HTTP ${companyResult.response.status}`,
      );
      const cashPath = findKey(companyResult.payload, (key) => /cash/i.test(key));
      report(
        !cashPath,
        "Research response excludes cash fields",
        cashPath ? `unexpected field ${cashPath}` : "no cash-related API key exposed",
      );
      const latest = companyResult.payload?.company?.latestSnapshot;
      if (!latest) {
        skip("Grounded snapshot assertions", "latest snapshot is not available yet");
      } else {
        const claims = Array.isArray(latest.payload?.claims)
          ? latest.payload.claims
          : [];
        const facts = claims.filter((claim) => claim.kind === "fact");
        const judgements = claims.filter(
          (claim) => claim.kind === "ai_judgement",
        );
        report(
          facts.length > 0 &&
            facts.every(
              (claim) =>
                Array.isArray(claim.evidenceIds) && claim.evidenceIds.length > 0,
            ),
          "Snapshot facts are grounded",
          `${facts.length} factual claims contain evidence IDs`,
        );
        report(
          judgements.length > 0 &&
            judgements.every((claim) => claim.kind === "ai_judgement"),
          "AI judgements are labelled",
          `${judgements.length} conclusions use the ai_judgement kind`,
        );
      }

      const historyResult = await request(
        `/api/research/automation/companies/${ticker}/history`,
        { cookie: sessionCookie },
      );
      const history = Array.isArray(historyResult.payload?.history)
        ? historyResult.payload.history
        : [];
      const versions = history.map((item) => item.version);
      report(
        historyResult.response.status === 200 &&
          new Set(versions).size === versions.length &&
          versions.every((version, index) =>
            index === 0 ? true : versions[index - 1] > version,
          ),
        "Snapshot history is append-only",
        `${history.length} unique versions in newest-first order`,
      );

      if (secondUserCookie) {
        const jobId = companyResult.payload?.company?.recentJobs?.[0]?.id;
        if (Number.isInteger(jobId)) {
          const denied = await request(
            `/api/research/automation/jobs/${jobId}`,
            { cookie: secondUserCookie },
          );
          report(
            denied.response.status === 404,
            "Cross-user research is denied",
            `HTTP ${denied.response.status}`,
          );
        } else {
          skip(
            "Cross-user research isolation",
            "no first-user job is available for an unambiguous ownership check",
          );
        }
      } else {
        skip(
          "Cross-user research isolation",
          "set ALPHADESK_SECOND_USER_COOKIE to a different signed-in user",
        );
      }

      if (allowMutation) {
        const refresh = await request(
          `/api/research/automation/companies/${ticker}/refresh`,
          { cookie: sessionCookie, method: "POST" },
        );
        const queued =
          refresh.response.status === 202 &&
          Number.isInteger(refresh.payload?.job?.jobId) &&
          refresh.payload.job.created === true;
        const coolingDown = refresh.response.status === 429;
        report(
          queued || coolingDown,
          "Manual research refresh",
          queued
            ? `queued job ${refresh.payload.job.jobId}`
            : coolingDown
              ? "cooldown honestly returned HTTP 429"
              : `HTTP ${refresh.response.status}`,
        );
      } else {
        skip(
          "Manual research refresh",
          "set ALPHADESK_SMOKE_MUTATE=1 in an approved preview environment",
        );
      }
    }
  } catch (error) {
    report(
      false,
      "Authenticated portfolio and research smoke",
      error instanceof Error ? error.message : String(error),
    );
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} smoke check${failures === 1 ? "" : "s"} failed.`,
  );
  process.exitCode = 1;
} else {
  console.log("\nAll executed AlphaDesk smoke checks passed.");
}
