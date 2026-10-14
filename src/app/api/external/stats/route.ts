import { timingSafeEqual } from "node:crypto";

import { and, eq, gte, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, organizations, sites, statsDaily } from "@/lib/db";
import { env } from "@/lib/env";
import type { StatRow } from "@/lib/types";

/**
 * Read-only stats for one CRM company, for the Studio 61 CRM's monthly
 * client reports.
 *
 *   GET /api/external/stats?companyId=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD
 *   Authorization: Bearer <SSO_SHARED_SECRET>
 *
 * Organisations are found two ways, in order:
 *
 *   1. organizations.external_id — the CRM's company id, set when that
 *      customer first arrived via the SSO handoff.
 *   2. Failing that, by matching the CRM's registered domains against
 *      sites.domain, ignoring any leading "www.".
 *
 * The fallback matters because most organisations here predate SSO:
 * they were created by hand, so they have no external_id even though
 * they clearly belong to a CRM client. Insight222 is one. An ambiguous
 * domain match — sites under two different organisations — is reported
 * as not found rather than guessed at.
 *
 * Reads stats_daily (the rollup), not Analytics Engine, because a
 * monthly report is always asking about complete past days and the
 * rollup is both cheaper and retained beyond AE's ~90 days.
 *
 * Deliberately narrow: totals and top pages/referrers per site. No
 * visitor-level anything, nothing writable.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function authorized(request: Request): boolean {
  const secret = env.SSO_SHARED_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  // timingSafeEqual throws on length mismatch, so compare lengths first.
  return a.length === b.length && timingSafeEqual(a, b);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `https://www.example.com/` and `example.com` are the same site. */
function normaliseDomain(raw: string): string {
  let v = raw.trim().toLowerCase();
  if (!v) return "";
  try {
    if (/^https?:\/\//.test(v)) v = new URL(v).host;
  } catch {
    // fall through and treat it as a bare host
  }
  return v.replace(/^www\./, "").replace(/\/.*$/, "");
}

/**
 * Merge per-day top-N lists into one ranked list for the period.
 *
 * Note this sums each day's top N, so a page that was 11th every day
 * never appears. Fine for a report's "most visited pages", and far
 * cheaper than re-querying Analytics Engine for the whole month.
 */
function mergeRows(lists: StatRow[][], limit = 5): StatRow[] {
  const totals = new Map<string, { visitors: number; views: number }>();
  for (const list of lists) {
    for (const row of list ?? []) {
      const prev = totals.get(row.key) ?? { visitors: 0, views: 0 };
      totals.set(row.key, {
        visitors: prev.visitors + (row.visitors ?? 0),
        views: prev.views + (row.views ?? 0),
      });
    }
  }
  return [...totals.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId")?.trim() ?? "";
  const from = url.searchParams.get("from")?.trim() ?? "";
  const to = url.searchParams.get("to")?.trim() ?? "";
  // Optional: the CRM's registered domains for this company, used only
  // when the organisation has no external_id.
  const domains = (url.searchParams.get("domains") ?? "")
    .split(",")
    .map(normaliseDomain)
    .filter(Boolean);
  if (!companyId || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json(
      { error: "companyId, from and to (YYYY-MM-DD) are required" },
      { status: 400 },
    );
  }

  try {
    let matchedBy: "external_id" | "domain" = "external_id";
    let [org] = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.externalId, companyId))
      .limit(1);

    if (!org && domains.length > 0) {
      const candidates = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          domain: sites.domain,
        })
        .from(sites)
        .innerJoin(organizations, eq(organizations.id, sites.orgId));
      const hits = candidates.filter((c) =>
        domains.includes(normaliseDomain(c.domain)),
      );
      const distinctOrgs = [...new Set(hits.map((h) => h.id))];
      // One organisation or nothing. Two would mean the same domain is
      // tracked under separate accounts, and picking either could put
      // another client's numbers in this client's report.
      if (distinctOrgs.length === 1) {
        const hit = hits[0];
        org = { id: hit.id, name: hit.name };
        matchedBy = "domain";
      }
    }

    // Not an error: plenty of CRM companies have no analytics at all.
    // The CRM treats `found: false` as "no analytics section this month".
    if (!org) {
      return NextResponse.json({ found: false, sites: [] });
    }

    const rows = await db
      .select({
        siteId: sites.id,
        name: sites.name,
        domain: sites.domain,
        pageviews: sql<number>`COALESCE(SUM(${statsDaily.pageviews}), 0)::int`,
        visitors: sql<number>`COALESCE(SUM(${statsDaily.visitors}), 0)::int`,
        days: sql<number>`COUNT(${statsDaily.day})::int`,
        topPages: sql<StatRow[][]>`COALESCE(JSON_AGG(${statsDaily.topPages}) FILTER (WHERE ${statsDaily.day} IS NOT NULL), '[]')`,
        topReferrers: sql<StatRow[][]>`COALESCE(JSON_AGG(${statsDaily.topReferrers}) FILTER (WHERE ${statsDaily.day} IS NOT NULL), '[]')`,
      })
      .from(sites)
      .leftJoin(
        statsDaily,
        and(
          eq(statsDaily.siteId, sites.id),
          gte(statsDaily.day, from),
          lte(statsDaily.day, to),
        ),
      )
      .where(eq(sites.orgId, org.id))
      .groupBy(sites.id, sites.name, sites.domain);

    return NextResponse.json({
      found: true,
      matchedBy,
      organisation: { id: org.id, name: org.name },
      period: { from, to },
      sites: rows.map((r) => ({
        name: r.name,
        domain: r.domain,
        pageviews: Number(r.pageviews ?? 0),
        visitors: Number(r.visitors ?? 0),
        daysWithData: Number(r.days ?? 0),
        topPages: mergeRows(r.topPages ?? []),
        topReferrers: mergeRows(r.topReferrers ?? []),
      })),
    });
  } catch (e) {
    console.error("[api/external/stats] failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
