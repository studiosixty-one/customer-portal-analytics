/**
 * Analytics Engine column map (the reader side).
 *
 * Analytics Engine columns are positional (index1, blob1…blob20, double1…), so
 * the writer and reader must agree on what each slot means. This MUST stay in
 * sync with the writer in `collector/src/index.ts`.
 */
export const AE_DATASET = "events";

export const AE = {
  /** Sampling key + primary filter — every query filters on this. */
  trackingId: "index1",
  eventType: "blob1",
  path: "blob2",
  hostname: "blob3",
  referrer: "blob4",
  country: "blob5",
  device: "blob6",
  browser: "blob7",
  os: "blob8",
  /** Cookieless daily-rotating visitor hash — COUNT(DISTINCT) for uniques. */
  visitor: "blob9",
  utmSource: "blob10",
  utmMedium: "blob11",
  utmCampaign: "blob12",
  city: "blob13",
  /** Identified app-user id (opaque, provided by the customer's app). */
  userId: "blob14",
  /** Friendly display label for the user (name / plan / role). */
  userLabel: "blob15",
  /** Custom-event properties, JSON-encoded (stored for display). */
  props: "blob16",
  count: "double1",
  /** Approx visitor coordinates (Cloudflare geo) for the globe. */
  lat: "double2",
  lng: "double3",
} as const;
