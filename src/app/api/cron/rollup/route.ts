import { NextResponse } from "next/server";

import { rollupDay, utcDaysAgo } from "@/lib/analytics/rollup";

// Node runtime (uses the DB client + Analytics Engine SQL API). Daily cron —
// see vercel.json. Rolls up *yesterday* (UTC), by which time it's complete.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // When CRON_SECRET is set, require it. Vercel Cron sends it automatically as
  // `Authorization: Bearer <CRON_SECRET>`. Left open in local dev (no secret).
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await rollupDay(utcDaysAgo(1));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron/rollup] failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
