import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Cloud,
  Database,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineError, PageLoader } from "@/components/system/AsyncState";
import {
  useIntegrationHealth,
  type IntegrationModuleStatus,
} from "@/features/integration/api";
import { cn } from "@/lib/utils";

function bandLabel(band: "ready" | "nearly_ready" | "setup_required") {
  return band === "ready"
    ? "Ready"
    : band === "nearly_ready"
      ? "Nearly ready"
      : "Setup required";
}

function statusClass(status: IntegrationModuleStatus): string {
  if (status === "ready")
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-500";
  if (status === "blocked")
    return "border-destructive/30 bg-destructive/10 text-destructive";
  if (status === "attention")
    return "border-amber-500/30 bg-amber-500/10 text-amber-500";
  return "border-blue-500/30 bg-blue-500/10 text-blue-400";
}

function relativeTime(value: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export function SystemHealth() {
  const query = useIntegrationHealth();

  if (query.isLoading)
    return <PageLoader label="Checking AlphaDesk modules…" />;
  if (query.isError) {
    return (
      <div className="mx-auto max-w-5xl">
        <InlineError
          title="System check unavailable"
          message={
            query.error instanceof Error
              ? query.error.message
              : "Unable to check system readiness."
          }
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const health = query.data;
  if (!health) return null;

  const readiness = health.readiness;
  const scoreTone =
    readiness.band === "ready"
      ? "text-emerald-500"
      : readiness.band === "nearly_ready"
        ? "text-amber-500"
        : "text-destructive";

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <ServerCog className="h-4 w-4" /> Integration and deployment
          </div>
          <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One view of setup completeness, unresolved risks and production
            configuration.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw
            className={cn("mr-2 h-4 w-4", query.isFetching && "animate-spin")}
          />
          Recheck
        </Button>
      </div>

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
        <CardContent className="grid gap-6 p-6 md:grid-cols-[220px_1fr] md:p-8">
          <div className="flex items-center gap-5 md:block md:text-center">
            <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-8 border-secondary bg-background md:mx-auto md:h-36 md:w-36">
              <span className={cn("text-4xl font-black", scoreTone)}>
                {readiness.score}
              </span>
              <span className="absolute bottom-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:bottom-5">
                of 100
              </span>
            </div>
            <div className="md:mt-4">
              <Badge
                className={cn(
                  "border",
                  statusClass(
                    readiness.band === "ready"
                      ? "ready"
                      : readiness.band === "setup_required"
                        ? "blocked"
                        : "attention",
                  ),
                )}
              >
                {bandLabel(readiness.band)}
              </Badge>
              <p className="mt-2 text-xs text-muted-foreground">
                Checked {relativeTime(health.checkedAt)} · v
                {health.environment.buildVersion}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Operational readiness</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The score measures whether the portfolio, evidence, monitoring
                and decision-control layers have usable data. Optional providers
                do not block the application.
              </p>
            </div>

            {readiness.blockers.length > 0 ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Blockers
                </div>
                <div className="space-y-2 text-sm">
                  {readiness.blockers.map((item) => (
                    <p key={item}>• {item}</p>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                No hard operational blockers were detected.
              </div>
            )}

            {readiness.recommendations.length > 0 && (
              <div className="rounded-xl border bg-secondary/20 p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <Wrench className="h-4 w-4 text-primary" /> Recommended next
                  steps
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                  {readiness.recommendations.slice(0, 8).map((item) => (
                    <p key={item}>• {item}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {readiness.modules.map((module) => (
          <Link key={module.key} href={module.href}>
            <Card className="h-full cursor-pointer transition-colors hover:border-primary/40 hover:bg-secondary/10">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">{module.name}</CardTitle>
                  <Badge
                    variant="outline"
                    className={cn("capitalize", statusClass(module.status))}
                  >
                    {module.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <span className="text-3xl font-bold">{module.score}</span>
                    <span className="text-sm text-muted-foreground">
                      /{module.maxScore}
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      module.status === "ready"
                        ? "bg-emerald-500"
                        : module.status === "blocked"
                          ? "bg-destructive"
                          : module.status === "attention"
                            ? "bg-amber-500"
                            : "bg-blue-500",
                    )}
                    style={{
                      width: `${Math.min(100, (module.score / module.maxScore) * 100)}%`,
                    }}
                  />
                </div>
                <p className="min-h-10 text-xs leading-5 text-muted-foreground">
                  {module.summary}
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3">
                  {module.metrics.slice(0, 3).map((metric) => (
                    <div key={metric.label} className="min-w-0">
                      <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                        {metric.label}
                      </p>
                      <p className="mt-1 truncate text-xs font-semibold">
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" /> Production
              safeguards
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <EnvironmentRow
              icon={Database}
              label="Database schema"
              value={health.databaseReady ? "Reachable" : "Unavailable"}
              ok={health.databaseReady}
            />
            <EnvironmentRow
              icon={ShieldCheck}
              label="CORS allow-list"
              value={
                health.environment.corsAllowListConfigured
                  ? "Configured"
                  : "Development defaults"
              }
              ok={
                health.environment.corsAllowListConfigured ||
                health.environment.environment !== "production"
              }
            />
            <EnvironmentRow
              icon={Sparkles}
              label="OpenAI provider"
              value={
                health.environment.openAiConfigured
                  ? "Configured"
                  : "Offline fallback"
              }
              ok
            />
            <EnvironmentRow
              icon={Cloud}
              label="Live-data providers"
              value={
                health.environment.configuredLiveDataProviders.length > 0
                  ? health.environment.configuredLiveDataProviders.join(", ")
                  : "Manual imports only"
              }
              ok
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleGauge className="h-4 w-4 text-primary" /> Release posture
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              AlphaDesk is designed to remain usable when optional AI or
              live-data providers are unavailable. Facts are labelled by source
              and freshness, while missing data stays explicitly missing.
            </p>
            <p>
              Guardian confirmations create an audit record only; no brokerage
              order is transmitted. Provider credentials remain server-side
              environment variables.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/live-data">Review providers</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/guardrails">Review policies</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/">Open Morning Brief</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EnvironmentRow({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: typeof Database;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-secondary/10 p-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{value}</p>
      </div>
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-500" />
      )}
    </div>
  );
}
