import { useEffect, useState, type FormEvent } from "react";
import { Fingerprint, Loader2 } from "lucide-react";

import type { SecurityType } from "@workspace/research-contracts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  useCorrectResearchIdentity,
  type AutomatedResearchCompany,
  type ResearchIdentityCorrectionInput,
} from "../automationApi";

const SECURITY_TYPES: Array<Exclude<SecurityType, "unknown">> = [
  "equity",
  "etf",
  "mutual_fund",
  "unlisted",
];

export function IdentityCorrectionCard({
  company,
  onCorrected,
}: {
  company: AutomatedResearchCompany;
  onCorrected?: (ticker: string) => void;
}) {
  const correct = useCorrectResearchIdentity(company.ticker);
  const [form, setForm] = useState<ResearchIdentityCorrectionInput>({
    ticker: company.ticker,
    exchange: company.exchange,
    isin: company.isin,
    name: company.name,
    securityType:
      company.securityType === "unknown" ? "equity" : company.securityType,
  });

  useEffect(() => {
    setForm({
      ticker: company.ticker,
      exchange: company.exchange,
      isin: company.isin,
      name: company.name,
      securityType:
        company.securityType === "unknown" ? "equity" : company.securityType,
    });
  }, [company]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const input = {
      ...form,
      ticker: form.ticker.trim().toUpperCase(),
      exchange: form.exchange.trim().toUpperCase(),
      name: form.name.trim(),
      isin: form.isin?.trim().toUpperCase() || null,
    };
    correct.mutate(input, {
      onSuccess: (updated) => onCorrected?.(updated.ticker),
    });
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Fingerprint className="h-4 w-4 text-amber-500" />
          Confirm this investment
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          AlphaDesk paused research to avoid analysing the wrong security. Check
          these details once, then automatic research can continue.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ticker">
              <Input
                required
                value={form.ticker}
                onChange={(event) =>
                  setForm((value) => ({ ...value, ticker: event.target.value }))
                }
              />
            </Field>
            <Field label="Exchange">
              <Input
                required
                value={form.exchange}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    exchange: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Investment name">
              <Input
                required
                value={form.name}
                onChange={(event) =>
                  setForm((value) => ({ ...value, name: event.target.value }))
                }
              />
            </Field>
            <Field label="ISIN (if known)">
              <Input
                value={form.isin ?? ""}
                onChange={(event) =>
                  setForm((value) => ({ ...value, isin: event.target.value }))
                }
              />
            </Field>
            <Field label="Investment type">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.securityType}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    securityType: event.target.value as Exclude<
                      SecurityType,
                      "unknown"
                    >,
                  }))
                }
              >
                {SECURITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {correct.isError ? (
            <p className="text-sm text-destructive">{correct.error.message}</p>
          ) : null}
          {correct.isSuccess ? (
            <p className="text-sm text-emerald-500">
              Identity confirmed. Research has been queued.
            </p>
          ) : null}
          <Button
            className="w-full sm:w-auto"
            disabled={correct.isPending}
            type="submit"
          >
            {correct.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Confirm and prepare research
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
