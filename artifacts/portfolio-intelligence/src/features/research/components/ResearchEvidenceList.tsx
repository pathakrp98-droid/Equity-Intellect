import { ExternalLink, FileText } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import type { AutomatedResearchSource } from "../automationApi";
import { evidenceLinkCopy, safeEvidenceUrl } from "../automationViewModel";

function EvidenceItems({ sources }: { sources: AutomatedResearchSource[] }) {
  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No publishable sources were attached to this snapshot.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {sources.map((source) => {
        const copy = evidenceLinkCopy(source);
        const href = safeEvidenceUrl(source.url);
        return (
          <Card key={source.citationKey} className="bg-secondary/15">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={copy.accessibleLabel}
                      className="inline-flex max-w-full items-start gap-1 break-words text-sm font-semibold text-primary hover:underline"
                    >
                      <span className="min-w-0 break-words">
                        {source.title}
                      </span>
                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    </a>
                  ) : (
                    <p className="break-words text-sm font-semibold">
                      {source.title}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {copy.publisher} · {copy.date} · {source.authority}
                  </p>
                </div>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {source.evidenceSummary}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function ResearchEvidenceList({
  sources,
}: {
  sources: AutomatedResearchSource[];
}) {
  return (
    <>
      <details className="rounded-lg border bg-secondary/10 p-4 md:hidden">
        <summary className="cursor-pointer text-sm font-semibold">
          View evidence and sources ({sources.length})
        </summary>
        <div className="mt-4">
          <EvidenceItems sources={sources} />
        </div>
      </details>
      <div className="hidden md:block">
        <EvidenceItems sources={sources} />
      </div>
    </>
  );
}
