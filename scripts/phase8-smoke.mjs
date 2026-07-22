#!/usr/bin/env node

const baseUrl = (
  process.env.ALPHADESK_BASE_URL ?? "http://localhost:5000"
).replace(/\/$/, "");

const checks = [
  {
    name: "API health",
    path: "/api/health",
    accepted: [200],
  },
  {
    name: "Integration endpoint protection",
    path: "/api/integration/health",
    accepted: [200, 401],
  },
  {
    name: "Legacy mock dashboard removed",
    path: "/api/dashboard/summary",
    accepted: [404],
  },
  {
    name: "Legacy mock market scanner removed",
    path: "/api/market/scanner",
    accepted: [404],
  },
];

let failures = 0;
for (const check of checks) {
  try {
    const response = await fetch(`${baseUrl}${check.path}`, {
      redirect: "manual",
      headers: { Accept: "application/json" },
    });
    const passed = check.accepted.includes(response.status);
    if (!passed) failures += 1;
    console.log(
      `${passed ? "PASS" : "FAIL"} ${check.name}: HTTP ${response.status} (expected ${check.accepted.join("/")})`,
    );
  } catch (error) {
    failures += 1;
    console.error(
      `FAIL ${check.name}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} smoke check${failures === 1 ? "" : "s"} failed.`,
  );
  process.exitCode = 1;
} else {
  console.log("\nAll Phase 8 smoke checks passed.");
}
