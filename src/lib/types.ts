/**
 * Shared analytics domain types.
 *
 * Used by the Drizzle schema (jsonb column shapes) and by UI code, so it must
 * NOT import anything server-only — keep it dependency-free.
 */

/** Per-site config (reserved for future options, e.g. excluded paths). */
export type SiteSettings = {
  excludedPaths?: string[];
};

/**
 * A single breakdown row in a dashboard table (top pages, referrers, countries,
 * devices, …). Also the shape stored in the `stats_daily` jsonb rollup columns.
 */
export type StatRow = {
  /** The dimension value, e.g. "/pricing", "google.com", "GB", a user id. */
  key: string;
  /** Estimated unique visitors (COUNT(DISTINCT visitor) × sampling). */
  visitors: number;
  /** Estimated pageviews (SUM(_sample_interval)). */
  views: number;
  /** Optional friendly display label (e.g. a user's name in place of their id). */
  label?: string;
};
