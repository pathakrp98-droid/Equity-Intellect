import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Router as WouterRouter, Switch } from "wouter";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApplicationErrorBoundary } from "./components/system/ApplicationErrorBoundary";
import { PageLoader } from "./components/system/AsyncState";
import { Layout } from "./components/layout/Layout";
import NotFound from "@/pages/not-found";

const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })),
);
const PortfolioEngine = lazy(() =>
  import("./pages/PortfolioEngine").then((module) => ({
    default: module.PortfolioEngine,
  })),
);
const Research = lazy(() =>
  import("./pages/Research").then((module) => ({ default: module.Research })),
);
const MarketIntelligence = lazy(() =>
  import("./pages/MarketIntelligence").then((module) => ({
    default: module.MarketIntelligence,
  })),
);
const Copilot = lazy(() =>
  import("./pages/Copilot").then((module) => ({ default: module.Copilot })),
);
const Alerts = lazy(() =>
  import("./pages/Alerts").then((module) => ({ default: module.Alerts })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((module) => ({ default: module.Settings })),
);
const Guardrails = lazy(() =>
  import("./pages/Guardrails").then((module) => ({
    default: module.Guardrails,
  })),
);
const Journal = lazy(() =>
  import("./pages/Journal").then((module) => ({ default: module.Journal })),
);
const LiveData = lazy(() =>
  import("./pages/LiveData").then((module) => ({ default: module.LiveData })),
);
const SystemHealth = lazy(() =>
  import("./pages/SystemHealth").then((module) => ({
    default: module.SystemHealth,
  })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry(failureCount, error) {
        const status =
          typeof error === "object" && error !== null && "status" in error
            ? Number((error as { status?: unknown }).status)
            : undefined;
        return status !== 401 && status !== 403 && failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

function Router() {
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/portfolio" component={PortfolioEngine} />
          <Route path="/research" component={Research} />
          <Route path="/market-intelligence" component={MarketIntelligence} />
          <Route path="/market" component={MarketIntelligence} />
          <Route path="/copilot" component={Copilot} />
          <Route path="/alerts" component={Alerts} />
          <Route path="/live-data" component={LiveData} />
          <Route path="/settings" component={Settings} />
          <Route path="/guardrails" component={Guardrails} />
          <Route path="/journal" component={Journal} />
          <Route path="/system-health" component={SystemHealth} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function ThemeEnforcer({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  return <>{children}</>;
}

function App() {
  return (
    <ApplicationErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeEnforcer>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </ThemeEnforcer>
      </QueryClientProvider>
    </ApplicationErrorBoundary>
  );
}

export default App;
