import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireSiteAccess } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { SiteTabs } from "@/components/sites/site-tabs";

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { site } = await requireSiteAccess(id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="size-8">
          <Link href="/admin" aria-label="Back to sites">
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <div className="mr-auto">
          <h1 className="text-xl font-semibold tracking-tight">{site.name}</h1>
          <p className="font-mono text-xs text-muted-foreground">
            {site.domain}
          </p>
        </div>
      </div>
      <SiteTabs siteId={id} />
      {children}
    </div>
  );
}
