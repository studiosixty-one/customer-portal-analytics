import Link from "next/link";
import { Globe, Lock } from "lucide-react";

import { requireOrg } from "@/lib/auth/context";
import { listSites } from "@/lib/sites/queries";
import { NewSiteButton } from "@/components/sites/new-site-button";

export default async function AdminHomePage() {
  const { org, isSuperAdmin } = await requireOrg();
  const sites = await listSites();
  const canAdd = isSuperAdmin || org.canAddSites;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>
          <p className="text-muted-foreground">
            Track visitors and pageviews across your websites.
          </p>
        </div>
        {canAdd && <NewSiteButton />}
      </div>

      {sites.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          {canAdd ? (
            <>
              <Globe className="size-10 text-muted-foreground" />
              <h2 className="mt-4 font-medium">No sites yet</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Add your first website to get a tracking snippet and start
                seeing analytics.
              </p>
              <div className="mt-4">
                <NewSiteButton />
              </div>
            </>
          ) : (
            <>
              <Lock className="size-10 text-muted-foreground" />
              <h2 className="mt-4 font-medium">No sites yet</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Adding sites is disabled for your organization. Contact your
                administrator to enable it.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Link
              key={site.id}
              href={`/admin/sites/${site.id}`}
              className="group rounded-lg border p-4 transition-colors hover:border-foreground/20 hover:bg-muted/40"
            >
              <div className="flex items-center gap-2">
                <Globe className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{site.name}</span>
              </div>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                {site.domain}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
