import { env } from "@/lib/env";

/**
 * Thin client for the Cloudflare Analytics Engine SQL API.
 *
 * The API takes a raw SQL string as the POST body and returns rows under the
 * top-level `data` key. Column aliases in the SELECT become the row keys.
 */

export type AERow = Record<string, string | number | null>;

export function isAnalyticsConfigured(): boolean {
  return Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN);
}

export async function queryAE<T = AERow>(sql: string): Promise<T[]> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    throw new Error(
      "Analytics is not configured — set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.",
    );
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: sql,
      // Freshness is handled by the caller's unstable_cache wrapper.
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Analytics query failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as { data?: T[] };
  return json.data ?? [];
}
