import React from "react";
import { AlertOctagon, Home, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface State {
  error: Error | null;
}

export class ApplicationErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("AlphaDesk UI error", error, info);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-xl rounded-2xl border bg-card p-8 text-center shadow-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertOctagon className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">
            AlphaDesk hit an unexpected error
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your saved portfolio and research data are unaffected. Retry the
            page, or return to the Morning Brief.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                this.reset();
                window.location.assign("/");
              }}
            >
              <Home className="mr-2 h-4 w-4" /> Morning Brief
            </Button>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reload application
            </Button>
          </div>
          {import.meta.env.DEV && (
            <pre className="mt-6 max-h-40 overflow-auto rounded-lg bg-secondary p-3 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
