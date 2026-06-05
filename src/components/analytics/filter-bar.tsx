import Link from "next/link";
import { X } from "lucide-react";

import type { Range } from "@/lib/analytics/queries";
import {
  buildSiteQuery,
  FILTER_KEYS,
  FILTER_LABEL,
  hasFilters,
  withoutFilter,
  type Filters,
} from "@/lib/analytics/filters";
import { rowLabel, type RowKind } from "./row-icon";

export function FilterBar({
  siteId,
  range,
  filters,
}: {
  siteId: string;
  range: Range;
  filters: Filters;
}) {
  if (!hasFilters(filters)) return null;
  const active = FILTER_KEYS.filter((k) => filters[k]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Filters</span>
      {active.map((k) => (
        <Link
          key={k}
          href={`/admin/sites/${siteId}${buildSiteQuery(range, withoutFilter(filters, k))}`}
          scroll={false}
          className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs transition-colors hover:bg-muted"
        >
          <span className="text-muted-foreground">{FILTER_LABEL[k]}:</span>
          <span className="font-medium">
            {rowLabel(k as RowKind, filters[k]!)}
          </span>
          <X className="size-3 text-muted-foreground" />
        </Link>
      ))}
      {active.length > 1 && (
        <Link
          href={`/admin/sites/${siteId}${buildSiteQuery(range, {})}`}
          scroll={false}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Clear all
        </Link>
      )}
    </div>
  );
}
