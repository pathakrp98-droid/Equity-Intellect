# AlphaDesk v0.8

Cumulative production-integration release containing Phases 1–8:

- holdings-first Portfolio Engine with manual holding/price support and CSV import;
- persistent manual Research Engine plus evidence-first automated coverage for every active holding;
- grounded AI Copilot;
- Morning Brief and Market Intelligence;
- Guardian Mode;
- Decision Journal and Review System;
- Live Data and Alerts;
- System Health, responsive shell, error resilience and API security hardening.

Apply this package alone over the repository root. Start with `docs/PHASE8_IMPLEMENTATION.md` and `docs/PHASE8_DEPLOYMENT_CHECKLIST.md`.

Automated research publishes immutable, cited snapshots without an approval queue. Facts retain evidence IDs and links; conclusions are visibly labelled `AI judgement`. Limited, stale, failed, queued, running, and needs-identity states remain explicit, while existing manual research is never overwritten.

Production setup requires the reviewed database migration and a separate 15-minute Replit Scheduled Deployment. See `docs/AUTOMATED_RESEARCH_DEPLOYMENT.md` before publishing.
