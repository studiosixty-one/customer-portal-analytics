import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StatRow } from "@/lib/types";
import type { Range } from "@/lib/analytics/queries";
import {
  buildSiteQuery,
  withFilter,
  type FilterKey,
  type Filters,
} from "@/lib/analytics/filters";
import { RowIcon, rowLabel, type RowKind } from "./row-icon";

export function BreakdownCard({
  title,
  rows,
  kind,
  siteId,
  range,
  filters,
}: {
  title: string;
  rows: StatRow[];
  kind: RowKind;
  siteId: string;
  range: Range;
  filters: Filters;
}) {
  const max = Math.max(1, ...rows.map((r) => r.visitors));
  // Every breakdown kind is also a filter key (page, source, country, …).
  const filterKey = kind as FilterKey;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No data yet.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {rows.map((r) => (
              <li key={r.key}>
                <Link
                  href={`/admin/sites/${siteId}${buildSiteQuery(range, withFilter(filters, filterKey, r.key))}`}
                  scroll={false}
                  title={`Filter by ${rowLabel(kind, r.key)}`}
                  className="relative flex items-center gap-2 overflow-hidden rounded px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <span
                    className="absolute inset-y-0 left-0 rounded bg-primary/10"
                    style={{ width: `${(r.visitors / max) * 100}%` }}
                    aria-hidden
                  />
                  <span className="relative">
                    <RowIcon kind={kind} value={r.key} />
                  </span>
                  <span className="relative truncate">
                    {rowLabel(kind, r.key)}
                  </span>
                  <span className="relative ml-auto shrink-0 tabular-nums text-muted-foreground">
                    {r.visitors.toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
