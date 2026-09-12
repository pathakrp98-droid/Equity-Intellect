INSERT INTO research_automation_trigger_events (
  user_id,
  portfolio_id,
  ticker,
  trigger,
  status,
  dedupe_key,
  priority,
  payload,
  available_at
)
SELECT DISTINCT
  t.user_id,
  t.portfolio_id,
  NULL::varchar(30),
  'portfolio_reconciled'::research_automation_trigger,
  'queued'::research_automation_status,
  concat('identity-reconcile-v1:', t.portfolio_id),
  110,
  jsonb_build_object(
    'portfolioId', t.portfolio_id,
    'reason', 'identity_backfill'
  ),
  now()
FROM research_coverage_targets t
WHERE t.is_active = true
ON CONFLICT (user_id, dedupe_key) DO NOTHING;
