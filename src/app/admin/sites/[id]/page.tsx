import { requireSiteAccess } from "@/lib/auth/context";
import { isAnalyticsConfigured } from "@/lib/analytics/client";
import {
  getBrowsers,
  getDevices,
  getOSes,
  getOverview,
  getRealtime,
  getTopCountries,
  getTopPages,
  getTopReferrers,
  getTrend,
  RANGES,
  type Range,
} from "@/lib/analytics/queries";
import { parseFilters } from "@/lib/analytics/filters";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BreakdownCard } from "@/components/analytics/breakdown-card";
import { FilterBar } from "@/components/analytics/filter-bar";
import { VisitorMap } from "@/components/analytics/visitor-map";
import { RangeTabs } from "@/components/analytics/range-tabs";
import { RealtimeBadge } from "@/components/analytics/realtime-badge";
import { StatCards } from "@/components/analytics/stat-cards";
import { TrendChart } from "@/components/analytics/trend-chart";

export default async function SiteOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const rawRange = typeof sp.range === "string" ? sp.range : undefined;
  const range: Range = rawRange && rawRange in RANGES ? (rawRange as Range) : "7d";
  const filters = parseFilters(sp);

  const { site } = await requireSiteAccess(id);
  const tid = site.trackingId;

  const [
    overview,
    trend,
    pages,
    referrers,
    countries,
    devices,
    browsers,
    oses,
    realtime,
  ] = await Promise.all([
    getOverview(tid, range, filters),
    getTrend(tid, range, filters),
    getTopPages(tid, range, filters),
    getTopReferrers(tid, range, filters),
    getTopCountries(tid, range, filters),
    getDevices(tid, range, filters),
    getBrowsers(tid, range, filters),
    getOSes(tid, range, filters),
    getRealtime(tid, filters),
  ]);

  const cardProps = { siteId: id, range, filters };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangeTabs siteId={id} active={range} />
        <RealtimeBadge count={realtime} />
      </div>

      <FilterBar siteId={id} range={range} filters={filters} />

      {!isAnalyticsConfigured() && (
        <Alert>
          <AlertTitle>Analytics not connected yet</AlertTitle>
          <AlertDescription>
            Set <code>CLOUDFLARE_ACCOUNT_ID</code> and{" "}
            <code>CLOUDFLARE_API_TOKEN</code> to load data from Analytics Engine.
            Until then these numbers read zero.
          </AlertDescription>
        </Alert>
      )}

      <StatCards overview={overview} />

      <Card>
        <CardHeader>
          <CardTitle>Where your visitors are</CardTitle>
          <CardAction>
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              LIVE
            </span>
          </CardAction>
        </CardHeader>
        <CardContent>
          {/* Full-bleed: cancel the card's horizontal padding so the map spans
              the whole tile. */}
          <div className="-mx-4">
            <VisitorMap siteId={id} filters={filters} />
          </div>
        </CardContent>
      </Card>

      <TrendChart points={trend} range={range} />

      <div className="grid gap-4 md:grid-cols-2">
        <BreakdownCard title="Top pages" rows={pages} kind="page" {...cardProps} />
        <BreakdownCard
          title="Top sources"
          rows={referrers}
          kind="source"
          {...cardProps}
        />
        <BreakdownCard
          title="Top countries"
          rows={countries}
          kind="country"
          {...cardProps}
        />
        <BreakdownCard
          title="Devices"
          rows={devices}
          kind="device"
          {...cardProps}
        />
        <BreakdownCard
          title="Browsers"
          rows={browsers}
          kind="browser"
          {...cardProps}
        />
        <BreakdownCard
          title="Operating systems"
          rows={oses}
          kind="os"
          {...cardProps}
        />
      </div>
    </div>
  );
}
