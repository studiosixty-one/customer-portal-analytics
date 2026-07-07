import { requireSiteAccess } from "@/lib/auth/context";
import { SiteSettings } from "@/components/sites/site-settings";

export default async function SiteSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { site } = await requireSiteAccess(id);

  return (
    <SiteSettings
      id={site.id}
      name={site.name}
      domain={site.domain}
      trackingId={site.trackingId}
      statsResetAt={site.statsResetAt ? site.statsResetAt.toISOString() : null}
    />
  );
}
