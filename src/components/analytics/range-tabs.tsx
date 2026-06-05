import Link from "next/link";

import { cn } from "@/lib/utils";
import type { Range } from "@/lib/analytics/queries";

const ORDER: Range[] = ["24h", "7d", "30d", "90d"];

export function RangeTabs({ siteId, active }: { siteId: string; active: Range }) {
  return (
    <div className="inline-flex rounded-lg border p-0.5">
      {ORDER.map((r) => (
        <Link
          key={r}
          href={`/admin/sites/${siteId}?range=${r}`}
          scroll={false}
          className={cn(
            "rounded-md px-3 py-1 text-sm transition-colors",
            active === r
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r}
        </Link>
      ))}
    </div>
  );
}
