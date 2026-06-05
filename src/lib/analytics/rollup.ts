import { db, sites, statsDaily } from "@/lib/db";
import type { StatRow } from "@/lib/types";
import { AE, AE_DATASET } from "./event-schema";
import { queryAE } from "./client";

/**
 * Daily rollup: Analytics Engine only retains ~90 days, so a daily cron copies
 * the previous day's per-site aggregates into Postgres (`stats_daily`) for
 * unlimited history. One compact row per site per day.
 */

function cleanId(id: string): string {
  return id.replace(/[^a-z0-9]/gi, "");
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** UTC date string (YYYY-MM-DD) for N days ago. */
export function utcDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function rollupSiteDay(trackingId: string, day: string) {
  const id = cleanId(trackingId);
  const where =
    `${AE.trackingId} = '${id}' AND ${AE.eventType} = 'pageview' ` +
    `AND timestamp >= toDateTime('${day} 00:00:00') ` +
    `AND timestamp < toDateTime('${day} 00:00:00') + INTERVAL '1' DAY`;

  const [tot] = await queryAE(
    `SELECT SUM(_sample_interval) AS views, COUNT(DISTINCT ${AE.visitor}) AS visitors
     FROM ${AE_DATASET} WHERE ${where}`,
  );

  const breakdown = async (col: string): Promise<StatRow[]> => {
    const rows = await queryAE(
      `SELECT ${col} AS key, SUM(_sample_interval) AS views,
              COUNT(DISTINCT ${AE.visitor}) AS visitors
       FROM ${AE_DATASET} WHERE ${where} AND ${col} != ''
       GROUP BY ${col} ORDER BY visitors DESC LIMIT 20`,
    );
    return rows.map((r) => ({
      key: String(r.key ?? ""),
      views: num(r.views),
      visitors: num(r.visitors),
    }));
  };

  const [topPages, topReferrers, topCountries, byDevice] = await Promise.all([
    breakdown(AE.path),
    breakdown(AE.referrer),
    breakdown(AE.country),
    breakdown(AE.device),
  ]);

  return {
    pageviews: num(tot?.views),
    visitors: num(tot?.visitors),
    topPages,
    topReferrers,
    topCountries,
    byDevice,
  };
}

/** Roll up a single UTC day for every site. Idempotent (upsert). */
export async function rollupDay(day: string) {
  const allSites = await db
    .select({ id: sites.id, trackingId: sites.trackingId })
    .from(sites);

  for (const s of allSites) {
    const agg = await rollupSiteDay(s.trackingId, day);
    await db
      .insert(statsDaily)
      .values({ siteId: s.id, day, ...agg })
      .onConflictDoUpdate({
        target: [statsDaily.siteId, statsDaily.day],
        set: agg,
      });
  }

  return { day, sites: allSites.length };
}
