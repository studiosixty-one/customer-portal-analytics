# Studio 61 — Analytics

A privacy-first, **multi-tenant website analytics** product. Customers add a tiny
tracking snippet to their site and see visitors, pageviews, top pages, sources,
countries, and devices in a dashboard. Part of the Studio 61 app suite — it plugs
into the **same SSO** as the other apps (the CRM mints a token, this app
provisions its own session).

## Architecture (built for low cost / low ops)

Two workloads are split so the high-volume event firehose never touches the
dashboard's database:

- **Dashboard + accounts** — Next.js on Vercel + **Neon Postgres** (this app's own
  DB). Neon stores only accounts and per-site config — it stays tiny.
- **Event ingestion + storage** — a **Cloudflare Worker** ([`collector/`](collector))
  writes events to **Workers Analytics Engine** (columnar, pay-per-use, ~90-day
  retention). The dashboard reads aggregates back via the AE SQL API, cached 60s.
- **Long-term history** — a daily Vercel Cron rolls per-site daily aggregates from
  AE into Postgres (`stats_daily`), so history survives beyond AE's 90 days.

```
customer site → <script data-site=…> → Cloudflare Worker (collector)
                                          • bot filter · cookieless visitor hash
                                          • country + device/browser/os enrich
                                          • writeDataPoint()  ──► Analytics Engine
Vercel — Next.js dashboard ──(SQL API, cached)──────────────────► Analytics Engine
         (NextAuth + CRM SSO + orgs + sites; Neon for accounts/config + rollups)
```

New infra cost is roughly **$0–5/mo** to ~5M events/mo. Tracking is **cookieless**
(visitor id = daily-rotating salt + IP + UA hash, no cookie, no stored IP), so
customer sites don't need a consent banner.

## Stack

- **Next.js 15** (App Router, RSC, TypeScript) · **Tailwind v4** + **shadcn/ui**
- **Drizzle ORM** + **Neon** serverless Postgres
- **Auth.js (NextAuth v5)** — credentials + CRM SSO, JWT sessions
- **Cloudflare Workers** + **Workers Analytics Engine** (the event store)
- Deploy: dashboard → **Vercel**, collector → **Cloudflare** · package manager **pnpm**

## Setup

### 1. Dashboard app

```bash
pnpm install
cp .env.example .env.local        # fill in the values (see table below)
pnpm db:generate && pnpm db:migrate
pnpm create-admin you@example.com 'password' 'Your Name' 'Your Org'
pnpm exec tsx scripts/make-super.ts you@example.com
pnpm dev                          # http://localhost:3000
```

Sign in at `/login`, land on **Sites**, add a site, and copy its snippet from the
**Install** tab.

### 2. Collector (Cloudflare Worker)

See [`collector/README.md`](collector/README.md). In short:

```bash
cd collector && pnpm install
npx wrangler kv namespace create SALT_KV   # paste id into wrangler.jsonc
npx wrangler deploy
```

Then set `NEXT_PUBLIC_COLLECTOR_URL` (dashboard env) to the deployed Worker URL,
and `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` (token needs *Account
Analytics: Read*) so the dashboard can query.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Neon Postgres (pooled). This app's own DB. |
| `AUTH_SECRET` | ✅ | Auth.js session secret (per-app). |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public base URL (auth callbacks). |
| `NEXT_PUBLIC_COLLECTOR_URL` | ✅ | Collector Worker URL (embedded in the snippet). |
| `CLOUDFLARE_ACCOUNT_ID` | for data | Cloudflare account id (AE SQL API). |
| `CLOUDFLARE_API_TOKEN` | for data | Token with *Account Analytics: Read*. |
| `SSO_SHARED_SECRET` | for SSO | Shared HMAC secret with the CRM — identical across apps. |
| `CRM_PORTAL_URL` |  | CRM portal URL (return-to-portal link). |
| `CRON_SECRET` |  | Protects the daily rollup cron. |

## Project structure

```
src/
  app/
    admin/                  # authenticated app
      page.tsx              #   sites list
      sites/[id]/           #   overview (dashboard) · install · settings
      members/  platform/   #   members · super-admin
    api/
      cron/rollup/          # daily AE → Postgres rollup (Vercel Cron)
      sso/handoff/          # CRM SSO landing
    login/  invite/[token]/
  lib/
    analytics/              # event-schema (column map) · client (SQL API) · queries · rollup
    sites/                  # site CRUD (actions + queries)
    auth/  org/  members/  platform/  db/  sso.ts   # shared suite scaffolding
  components/
    analytics/  sites/  shell/  members/  platform/  ui/
collector/                  # Cloudflare Worker (script.js + /event → Analytics Engine)
drizzle/                    # generated SQL migrations
```

## Multi-tenancy & SSO

Same contract as the other Studio 61 apps: identity tables
(`users/organizations/memberships/invitations`) are kept identical so the CRM
handoff can JIT-provision via `external_id`. The tenant boundary is `sites.org_id`;
access goes through `requireSiteAccess` / `requireOrg` in
[`src/lib/auth/context.ts`](src/lib/auth/context.ts). See
[`docs/sso-handoff.md`](docs/sso-handoff.md).

## Deployment

1. **Collector** → `cd collector && npx wrangler deploy` (Cloudflare).
2. **Dashboard** → import the repo in Vercel (e.g. `insights.studiosixty-one.com`);
   set env vars; `pnpm db:migrate` against prod; bootstrap a super-admin. The
   `vercel.json` cron runs the daily rollup automatically.
