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
};

function filterClause(filters: Filters): string {
  let c = "";
  for (const k of FILTER_KEYS) {
    const v = filters[k];
    if (v) c += ` AND ${FILTER_COLUMN[k]} = ${sqlStr(v)}`;
  }
  return c;
}

function pageviewWhere(
  trackingId: string,
  days: number,
  filters: Filters,
): string {
  const since = `timestamp >= now() - INTERVAL '${Math.max(1, Math.floor(days))}' DAY`;
  return `${AE.trackingId} = '${cleanId(trackingId)}' AND ${AE.eventType} = 'pageview' AND ${since}${filterClause(filters)}`;
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
): Promise<Overview> {
  try {
    const [row] = await queryAE(
      `SELECT SUM(_sample_interval) AS views, COUNT(DISTINCT ${AE.visitor}) AS visitors
       FROM ${AE_DATASET} WHERE ${pageviewWhere(trackingId, days, filters)}`,
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
): Promise<TrendPoint[]> {
  const bucketExpr =
    days <= 1 ? "toStartOfHour(timestamp)" : "toStartOfDay(timestamp)";
  try {
    // Analytics Engine only allows column names/aliases in GROUP BY (not raw
    // expressions), so group/order by the `bucket` alias.
    const rows = await queryAE(
      `SELECT ${bucketExpr} AS bucket, SUM(_sample_interval) AS views,
              COUNT(DISTINCT ${AE.visitor}) AS visitors
       FROM ${AE_DATASET} WHERE ${pageviewWhere(trackingId, days, filters)}
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
  limit = 10,
): Promise<StatRow[]> {
  try {
    const rows = await queryAE(
      `SELECT ${column} AS key, SUM(_sample_interval) AS views,
              COUNT(DISTINCT ${AE.visitor}) AS visitors
       FROM ${AE_DATASET}
       WHERE ${pageviewWhere(trackingId, days, filters)} AND ${column} != ''
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
): Promise<number> {
  try {
    const [row] = await queryAE(
      `SELECT COUNT(DISTINCT ${AE.visitor}) AS visitors
       FROM ${AE_DATASET}
       WHERE ${AE.trackingId} = '${cleanId(trackingId)}'
         AND ${AE.eventType} = 'pageview'
         AND timestamp >= now() - INTERVAL '5' MINUTE${filterClause(filters)}`,
    );
    return num(row?.visitors);
  } catch (e) {
    console.error("[analytics] realtime failed:", e);
    return 0;
  }
}

// ── Public, cached API (60s; realtime 20s). Filters are part of the cache key. ─
const days = (r: Range) => RANGES[r];
const fkey = (filters: Filters) => JSON.stringify(filters);

export const getOverview = (trackingId: string, range: Range, filters: Filters) =>
  unstable_cache(
    () => fetchOverview(trackingId, days(range), filters),
    ["overview", trackingId, range, fkey(filters)],
    { revalidate: 60 },
  )();

export const getTrend = (trackingId: string, range: Range, filters: Filters) =>
  unstable_cache(
    () => fetchTrend(trackingId, days(range), filters),
    ["trend", trackingId, range, fkey(filters)],
    { revalidate: 60 },
  )();

const breakdown =
  (label: string, column: string) =>
  (trackingId: string, range: Range, filters: Filters) =>
    unstable_cache(
      () => fetchBreakdown(trackingId, column, days(range), filters),
      [label, trackingId, range, fkey(filters)],
      { revalidate: 60 },
    )();

export const getTopPages = breakdown("pages", AE.path);
export const getTopReferrers = breakdown("referrers", AE.referrer);
export const getTopCountries = breakdown("countries", AE.country);
export const getDevices = breakdown("devices", AE.device);
export const getBrowsers = breakdown("browsers", AE.browser);
export const getOSes = breakdown("oses", AE.os);

export const getRealtime = (trackingId: string, filters: Filters) =>
  unstable_cache(
    () => fetchRealtime(trackingId, filters),
    ["realtime", trackingId, fkey(filters)],
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
): Promise<LiveLocation[]> {
  try {
    const rows = await queryAE(
      `SELECT round(${AE.lat}, 1) AS lat, round(${AE.lng}, 1) AS lng,
              ${AE.country} AS country, ${AE.city} AS city,
              COUNT(DISTINCT ${AE.visitor}) AS visitors
       FROM ${AE_DATASET}
       WHERE ${pageviewWhere(trackingId, 1, filters)}
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

export const getLiveLocations = (trackingId: string, filters: Filters) =>
  unstable_cache(
    () => fetchLiveLocations(trackingId, filters),
    ["live-locations", trackingId, fkey(filters)],
    { revalidate: 15 },
  )();
