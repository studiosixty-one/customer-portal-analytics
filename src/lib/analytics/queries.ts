import { unstable_cache } from "next/cache";

import type { StatRow } from "@/lib/types";
import { AE, AE_DATASET } from "./event-schema";
import { queryAE } from "./client";
import { COUNTRY_CENTROIDS, countryName } from "./countries";
import { FILTER_KEYS, type Filters, type FilterKey } from "./filters";

export const RANGES = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 } as const;
export type Range = keyof typeof RANGES;
export const RANGE_LABELS: Record<Range, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

export type Overview = {
  visitors: number;
  pageviews: number;
  viewsPerVisitor: number;
};
export type TrendPoint = { bucket: string; visitors: number; views: number };
export type LiveLocation = {
  lat: number;
  lng: number;
  visitors: number;
  label: string;
};

// ── SQL building blocks ─────────────────────────────────────────────────────--
// trackingId is our own generated hex; sanitize anyway since it's interpolated.
function cleanId(trackingId: string): string {
  return trackingId.replace(/[^a-z0-9]/gi, "");
}

// Filter values come from the URL (user-controlled) → escape before embedding.
function sqlStr(v: string): string {
  return `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'").slice(0, 1024)}'`;
}

const FILTER_COLUMN: Record<FilterKey, string> = {
  page: AE.path,
  source: AE.referrer,
  country: AE.country,
  device: AE.device,
  browser: AE.browser,
  os: AE.os,
  utm_source: AE.utmSource,
  utm_medium: AE.utmMedium,
  utm_campaign: AE.utmCampaign,
  user: AE.userId,
};

function filterClause(filters: Filters): string {
  let c = "";
  for (const k of FILTER_KEYS) {
    const v = filters[k];
    if (v) c += ` AND ${FILTER_COLUMN[k]} = ${sqlStr(v)}`;
  }
  return c;
}

// "Reset views" floor: only count events on/after the site's reset time.
function resetClause(resetAt?: Date | null): string {
  if (!resetAt) return "";
  const ts = resetAt.toISOString().slice(0, 19).replace("T", " ");
  return ` AND timestamp >= toDateTime('${ts}')`;
}

// All events for a site (any event_type), scoped by range / filters / reset.
function baseWhere(
  trackingId: string,
  days: number,
  filters: Filters,
  resetAt?: Date | null,
): string {
  const since = `timestamp >= now() - INTERVAL '${Math.max(1, Math.floor(days))}' DAY`;
  return `${AE.trackingId} = '${cleanId(trackingId)}' AND ${since}${filterClause(filters)}${resetClause(resetAt)}`;
}

// Pageviews only (the default for the core web-analytics metrics).
function pageviewWhere(
  trackingId: string,
  days: number,
  filters: Filters,
  resetAt?: Date | null,
): string {
  return `${baseWhere(trackingId, days, filters, resetAt)} AND ${AE.eventType} = 'pageview'`;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// ── Uncached implementations (all degrade to empty on error/no-config) ─────────
async function fetchOverview(
  trackingId: string,
  days: number,
  filters: Filters,
  resetAt?: Date | null,
): Promise<Overview> {
  try {
    const [row] = await queryAE(
      `SELECT SUM(_sample_interval) AS views, COUNT(DISTINCT ${AE.visitor}) AS visitors
       FROM ${AE_DATASET} WHERE ${pageviewWhere(trackingId, days, filters, resetAt)}`,
    );
    const pageviews = num(row?.views);
    const visitors = num(row?.visitors);
    return {
      visitors,
      pageviews,
      viewsPerVisitor: visitors ? Number((pageviews / visitors).toFixed(1)) : 0,
    };
  } catch (e) {
    console.error("[analytics] overview failed:", e);
    return { visitors: 0, pageviews: 0, viewsPerVisitor: 0 };
  }
}

async function fetchTrend(
  trackingId: string,
  days: number,
  filters: Filters,
  resetAt?: Date | null,
): Promise<TrendPoint[]> {
  const bucketExpr =
    days <= 1 ? "toStartOfHour(timestamp)" : "toStartOfDay(timestamp)";
  try {
    // Analytics Engine only allows column names/aliases in GROUP BY (not raw
    // expressions), so group/order by the `bucket` alias.
    const rows = await queryAE(
      `SELECT ${bucketExpr} AS bucket, SUM(_sample_interval) AS views,
              COUNT(DISTINCT ${AE.visitor}) AS visitors
       FROM ${AE_DATASET} WHERE ${pageviewWhere(trackingId, days, filters, resetAt)}
       GROUP BY bucket ORDER BY bucket`,
    );
    return rows.map((r) => ({
      bucket: String(r.bucket ?? ""),
      views: num(r.views),
      visitors: num(r.visitors),
    }));
  } catch (e) {
    console.error("[analytics] trend failed:", e);
    return [];
  }
}

async function fetchBreakdown(
  trackingId: string,
  column: string,
  days: number,
  filters: Filters,
  resetAt?: Date | null,
  limit = 10,
): Promise<StatRow[]> {
  try {
    const rows = await queryAE(
      `SELECT ${column} AS key, SUM(_sample_interval) AS views,
              COUNT(DISTINCT ${AE.visitor}) AS visitors
       FROM ${AE_DATASET}
       WHERE ${pageviewWhere(trackingId, days, filters, resetAt)} AND ${column} != ''
       GROUP BY ${column} ORDER BY visitors DESC LIMIT ${Math.floor(limit)}`,
    );
    return rows.map((r) => ({
      key: String(r.key ?? ""),
      views: num(r.views),
      visitors: num(r.visitors),
    }));
  } catch (e) {
    console.error("[analytics] breakdown failed:", e);
    return [];
  }
}

async function fetchRealtime(
  trackingId: string,
  filters: Filters,
  resetAt?: Date | null,
): Promise<number> {
  try {
    const [row] = await queryAE(
      `SELECT COUNT(DISTINCT ${AE.visitor}) AS visitors
       FROM ${AE_DATASET}
       WHERE ${AE.trackingId} = '${cleanId(trackingId)}'
         AND ${AE.eventType} = 'pageview'
         AND timestamp >= now() - INTERVAL '5' MINUTE${filterClause(filters)}${resetClause(resetAt)}`,
    );
    return num(row?.visitors);
  } catch (e) {
    console.error("[analytics] realtime failed:", e);
    return 0;
  }
}

// Top identified app users by activity (all events). `label` is their friendly
// display label; `visitors` holds their total event count (for the bar/number).
async function fetchUsers(
  trackingId: string,
  days: number,
  filters: Filters,
  resetAt?: Date | null,
): Promise<StatRow[]> {
  try {
    const rows = await queryAE(
      `SELECT ${AE.userId} AS key, max(${AE.userLabel}) AS label,
              SUM(_sample_interval) AS visitors
       FROM ${AE_DATASET}
       WHERE ${baseWhere(trackingId, days, filters, resetAt)} AND ${AE.userId} != ''
       GROUP BY ${AE.userId} ORDER BY visitors DESC LIMIT 10`,
    );
    return rows.map((r) => ({
      key: String(r.key ?? ""),
      label: r.label ? String(r.label) : undefined,
      views: num(r.visitors),
      visitors: num(r.visitors),
    }));
  } catch (e) {
    console.error("[analytics] users failed:", e);
    return [];
  }
}

// Top custom events (event_type != pageview) by count.
async function fetchEvents(
  trackingId: string,
  days: number,
  filters: Filters,
  resetAt?: Date | null,
): Promise<StatRow[]> {
  try {
    const rows = await queryAE(
      `SELECT ${AE.eventType} AS key, SUM(_sample_interval) AS visitors,
              COUNT(DISTINCT ${AE.userId}) AS users
       FROM ${AE_DATASET}
       WHERE ${baseWhere(trackingId, days, filters, resetAt)}
         AND ${AE.eventType} != 'pageview' AND ${AE.eventType} != ''
       GROUP BY ${AE.eventType} ORDER BY visitors DESC LIMIT 10`,
    );
    return rows.map((r) => ({
      key: String(r.key ?? ""),
      views: num(r.visitors),
      visitors: num(r.visitors),
    }));
  } catch (e) {
    console.error("[analytics] events failed:", e);
    return [];
  }
}

// ── Public, cached API (60s; realtime 20s). Filters are part of the cache key. ─
const days = (r: Range) => RANGES[r];
const fkey = (filters: Filters) => JSON.stringify(filters);
const rkey = (resetAt?: Date | null) => String(resetAt ? resetAt.getTime() : 0);

export const getOverview = (
  trackingId: string,
  range: Range,
  filters: Filters,
  resetAt?: Date | null,
) =>
  unstable_cache(
    () => fetchOverview(trackingId, days(range), filters, resetAt),
    ["overview", trackingId, range, fkey(filters), rkey(resetAt)],
    { revalidate: 60 },
  )();

export const getTrend = (
  trackingId: string,
  range: Range,
  filters: Filters,
  resetAt?: Date | null,
) =>
  unstable_cache(
    () => fetchTrend(trackingId, days(range), filters, resetAt),
    ["trend", trackingId, range, fkey(filters), rkey(resetAt)],
    { revalidate: 60 },
  )();

const breakdown =
  (label: string, column: string) =>
  (
    trackingId: string,
    range: Range,
    filters: Filters,
    resetAt?: Date | null,
  ) =>
    unstable_cache(
      () => fetchBreakdown(trackingId, column, days(range), filters, resetAt),
      [label, trackingId, range, fkey(filters), rkey(resetAt)],
      { revalidate: 60 },
    )();

export const getTopPages = breakdown("pages", AE.path);
export const getTopReferrers = breakdown("referrers", AE.referrer);
export const getTopCountries = breakdown("countries", AE.country);
export const getDevices = breakdown("devices", AE.device);
export const getBrowsers = breakdown("browsers", AE.browser);
export const getOSes = breakdown("oses", AE.os);
export const getUtmSources = breakdown("utm-sources", AE.utmSource);
export const getUtmMediums = breakdown("utm-mediums", AE.utmMedium);
export const getUtmCampaigns = breakdown("utm-campaigns", AE.utmCampaign);

export const getTopUsers = (
  trackingId: string,
  range: Range,
  filters: Filters,
  resetAt?: Date | null,
) =>
  unstable_cache(
    () => fetchUsers(trackingId, days(range), filters, resetAt),
    ["users", trackingId, range, fkey(filters), rkey(resetAt)],
    { revalidate: 60 },
  )();

export const getTopEvents = (
  trackingId: string,
  range: Range,
  filters: Filters,
  resetAt?: Date | null,
) =>
  unstable_cache(
    () => fetchEvents(trackingId, days(range), filters, resetAt),
    ["events", trackingId, range, fkey(filters), rkey(resetAt)],
    { revalidate: 60 },
  )();

export const getRealtime = (
  trackingId: string,
  filters: Filters,
  resetAt?: Date | null,
) =>
  unstable_cache(
    () => fetchRealtime(trackingId, filters, resetAt),
    ["realtime", trackingId, fkey(filters), rkey(resetAt)],
    { revalidate: 20 },
  )();

/**
 * On-demand install check (uncached). Pageviews + last-seen in the last 24h.
 */
export async function getInstallStatus(
  trackingId: string,
): Promise<{ views: number; lastSeen: string | null }> {
  try {
    const [row] = await queryAE(
      `SELECT SUM(_sample_interval) AS views, max(timestamp) AS last
       FROM ${AE_DATASET}
       WHERE ${AE.trackingId} = '${cleanId(trackingId)}'
         AND ${AE.eventType} = 'pageview'
         AND timestamp >= now() - INTERVAL '24' HOUR`,
    );
    return {
      views: num(row?.views),
      lastSeen: row?.last ? String(row.last) : null,
    };
  } catch (e) {
    console.error("[analytics] install status failed:", e);
    return { views: 0, lastSeen: null };
  }
}

// ── Live globe locations (city-level when available, else country centroid) ────
async function fetchLiveLocations(
  trackingId: string,
  filters: Filters,
  resetAt?: Date | null,
): Promise<LiveLocation[]> {
  try {
    const rows = await queryAE(
      `SELECT round(${AE.lat}, 1) AS lat, round(${AE.lng}, 1) AS lng,
              ${AE.country} AS country, ${AE.city} AS city,
              COUNT(DISTINCT ${AE.visitor}) AS visitors
       FROM ${AE_DATASET}
       WHERE ${pageviewWhere(trackingId, 1, filters, resetAt)}
       GROUP BY lat, lng, country, city ORDER BY visitors DESC LIMIT 300`,
    );

    // Resolve a coordinate per row: real geo if present, else country centroid.
    const agg = new Map<string, LiveLocation>();
    for (const r of rows) {
      let lat = num(r.lat);
      let lng = num(r.lng);
      const country = String(r.country ?? "");
      const city = String(r.city ?? "");
      if (lat === 0 && lng === 0) {
        const c = COUNTRY_CENTROIDS[country.toUpperCase()];
        if (!c) continue;
        [lat, lng] = c;
      }
      const key = `${lat.toFixed(1)},${lng.toFixed(1)}`;
      const label = city || countryName(country) || country || "Unknown";
      const existing = agg.get(key) ?? { lat, lng, visitors: 0, label };
      existing.visitors += num(r.visitors);
      agg.set(key, existing);
    }
    return [...agg.values()].sort((a, b) => b.visitors - a.visitors).slice(0, 200);
  } catch (e) {
    console.error("[analytics] live locations failed:", e);
    return [];
  }
}

export const getLiveLocations = (
  trackingId: string,
  filters: Filters,
  resetAt?: Date | null,
) =>
  unstable_cache(
    () => fetchLiveLocations(trackingId, filters, resetAt),
    ["live-locations", trackingId, fkey(filters), rkey(resetAt)],
    { revalidate: 15 },
  )();
