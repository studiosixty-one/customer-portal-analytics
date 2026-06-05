# CRM → Analytics SSO (token handoff)

This app and the CRM keep **separate databases**. Single sign-on is bridged with
a short-lived signed token, so the two systems share only a **secret** — never a
database. (Identical mechanism to the other Studio 61 apps; only the endpoint
differs.)

Flow: a signed-in portal customer clicks **Links** → the CRM mints a 60-second
JWT and POSTs it to this app → we verify it, just-in-time provision a local user
+ organization (linked to the CRM's user/company ids), issue **our own**
session, and land the customer in the builder.

## The contract

- **Endpoint:** `POST https://links.studiosixty-one.com/api/sso/handoff`
- **Body (form-encoded):** `token` (the JWT), optional `next` (relative path, default `/admin`)
- **Token:** JWT, **HS256**, signed with `SSO_SHARED_SECRET` (identical on both apps)
- **Claims:**

  | claim | required | notes |
  | --- | --- | --- |
  | `userId` | ✅ | CRM user id (or `sub`) |
  | `companyId` | ✅ | CRM company id — becomes the tenant (org) |
  | `email` | recommended | used for the local user |
  | `name` | optional | user display name |
  | `companyName` | recommended | names the org |
  | `exp` | ✅ | keep short (~60s) |

## This app — already implemented

- `SSO_SHARED_SECRET` env (+ optional `CRM_PORTAL_URL`).
- `src/lib/sso.ts` — `verifyHandoffToken` + idempotent `provisionFromToken`.
- A `crm-sso` Auth.js provider + `POST /api/sso/handoff` route.
- `users.external_id` / `organizations.external_id` link to the CRM ids; the
  customer becomes an **owner** of their company's org.
- Studio 61 staff still sign in at `/login` (super-admin/platform unchanged).

## CRM side — what to add (per app)

### 1. Env (Vercel → CRM project)

```
SSO_SHARED_SECRET = <same value as this app + the other apps>
```

### 2. Mint helper (shared across apps)

```ts
import { SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.SSO_SHARED_SECRET!);

export async function mintHandoff(
  user: { id: string; email: string; name?: string | null },
  company: { id: string; name: string },
) {
  return new SignJWT({
    userId: user.id,
    companyId: company.id,
    email: user.email,
    name: user.name ?? undefined,
    companyName: company.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(secret);
}
```

### 3. Launch route (mints a *fresh* token per click, keeps it out of URLs)

The sidebar "Links" item is a normal anchor to this CRM route. It mints a token
and returns a tiny auto-submitting POST form — so the token is never in a URL,
log, or history entry, and never goes stale.

```ts
// CRM: app/links/route.ts
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { mintHandoff } from "@/lib/sso";
// ...resolve the portal's active company for this user...

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.redirect("/sign-in");
  const company = await getActiveCompany(session.user.id); // your logic
  const token = await mintHandoff(session.user, company);

  const action = "https://links.studiosixty-one.com/api/sso/handoff";
  return new Response(
    `<!doctype html><form id="f" method="POST" action="${action}">
       <input type="hidden" name="token" value="${token}">
       <input type="hidden" name="next" value="/admin">
     </form><script>document.getElementById('f').submit()</script>`,
    { headers: { "content-type": "text/html" } },
  );
}
```

Sidebar item (gated by your existing `unlocks_app_keys`): `<a href="/links">Links</a>`.

## Security notes

- POST (not GET) keeps the token out of access logs, history, and Referer.
- Short `exp` (~60s) limits replay; minting per click avoids stale tokens.
- Optional hardening: add a `jti` claim and reject reused ids within the expiry.
- Rotate `SSO_SHARED_SECRET` in lockstep across the CRM and every app.
- All traffic over HTTPS.

## Local development

You can exercise the SSO side by minting a token with the shared secret and
POSTing it to `/api/sso/handoff`. The CRM and this app can run on different
localhost ports independently.
