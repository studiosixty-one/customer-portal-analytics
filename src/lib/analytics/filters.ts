/**
 * Page-wide dashboard filters, encoded in the URL query string so they're
 * shareable and survive refresh. Each key maps to an Analytics Engine dimension
 * (see FILTER_COLUMN in queries.ts). Clicking a breakdown row adds a filter;
 * the filter bar removes them.
 */

export const FILTER_KEYS = [
  "page",
  "source",
  "country",
  "device",
  "browser",
  "os",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "user",
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];
export type Filters = Partial<Record<FilterKey, string>>;

export const FILTER_LABEL: Record<FilterKey, string> = {
  page: "Page",
  source: "Source",
  country: "Country",
  device: "Device",
  browser: "Browser",
  os: "OS",
  utm_source: "UTM source",
  utm_medium: "UTM medium",
  utm_campaign: "Campaign",
  user: "User",
};

export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): Filters {
  const f: Filters = {};
  for (const k of FILTER_KEYS) {
    const v = sp[k];
    if (typeof v === "string" && v) f[k] = v;
  }
  return f;
}

export function hasFilters(filters: Filters): boolean {
  return FILTER_KEYS.some((k) => filters[k]);
}

/** Build the query string for a site URL, omitting the default range. */
export function buildSiteQuery(range: string, filters: Filters): string {
  const p = new URLSearchParams();
  if (range && range !== "7d") p.set("range", range);
  for (const k of FILTER_KEYS) if (filters[k]) p.set(k, filters[k]!);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function withFilter(
  filters: Filters,
  key: FilterKey,
  value: string,
): Filters {
  return { ...filters, [key]: value };
}

export function withoutFilter(filters: Filters, key: FilterKey): Filters {
  const next = { ...filters };
  delete next[key];
  return next;
}
