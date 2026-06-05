"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { checkInstall } from "@/lib/sites/actions";
import { Button } from "@/components/ui/button";

export function InstallCheck({ siteId }: { siteId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ views: number } | null>(null);

  function run() {
    start(async () => {
      try {
        setResult(await checkInstall(siteId));
      } catch {
        setResult({ views: 0 });
      }
    });
  }

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        onClick={run}
        disabled={pending}
        className="gap-2"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Checking…" : "Test installation"}
      </Button>

      {result &&
        (result.views > 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-500">
            <CheckCircle2 className="size-4 shrink-0" />
            Working! {result.views.toLocaleString()} pageview
            {result.views === 1 ? "" : "s"} received in the last 24 hours.
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="size-4 shrink-0" />
            No pageviews yet. Make sure the snippet is in your{" "}
            <code className="text-xs">&lt;head&gt;</code>, visit your site, then
            test again (data can take ~1 minute to appear).
          </p>
        ))}
    </div>
  );
}
