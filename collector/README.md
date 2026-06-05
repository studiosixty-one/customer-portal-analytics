# Analytics collector (Cloudflare Worker)

The edge ingestion half of Studio 61 Analytics. Serves the tracking script and
writes pageview/event beacons to **Workers Analytics Engine**. The dashboard app
(in the repo root) reads that data back via the Analytics Engine SQL API.

## What it does

- `GET /script.js` — the cookieless tracking snippet (served with a 1-day cache).
- `POST /event` — receives beacons, filters bots, computes a privacy-preserving
  visitor hash, enriches with country + device/browser/OS, and calls
  `writeDataPoint()`.
- `OPTIONS *` — CORS preflight (the script runs on arbitrary customer domains).

The Analytics Engine column map lives at the top of [`src/index.ts`](src/index.ts)
and **must stay in sync** with the dashboard reader at
`../src/lib/analytics/event-schema.ts`.

## Setup & deploy

```bash
cd collector
pnpm install                 # or npm install

# 1. Create the KV namespace for the daily salt, then paste the id into
#    wrangler.jsonc (kv_namespaces[0].id). Add a preview_id for local dev.
npx wrangler kv namespace create SALT_KV
npx wrangler kv namespace create SALT_KV --preview

# 2. Run locally (Analytics Engine writes require --remote; plain dev no-ops them).
npx wrangler dev --remote

# 3. Deploy.
npx wrangler deploy
```

After deploy, copy the Worker URL (e.g. `https://analytics-collector.<acct>.workers.dev`)
into the dashboard's `NEXT_PUBLIC_COLLECTOR_URL`. Optionally bind a custom route
like `https://t.studiosixty-one.com` in the Cloudflare dashboard.

## Notes

- **No secrets required.** The visitor-hash salt is a random value generated and
  stored in KV per UTC day (48h TTL), cached in-memory per isolate so KV is read
  at most once per day.
- Analytics Engine data is retained ~90 days; the dashboard's daily rollup cron
  copies older aggregates into Postgres for long-term history.
