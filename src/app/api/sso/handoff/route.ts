import { cookies } from "next/headers";

import { signIn } from "@/auth";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth/context";
import { provisionFromToken, verifyHandoffToken } from "@/lib/sso";

/**
 * SSO landing point. The CRM POSTs a short-lived signed JWT here (form field
 * `token`, optional `next`). We verify it, provision the local user/org, set
 * the active-org cookie, then establish our own session and redirect in.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get("token") ?? "");
  const nextRaw = String(form.get("next") ?? "/admin");
  // Only allow same-app relative paths (no open redirect).
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/admin";

  if (!token) return new Response("Missing token.", { status: 400 });

  let orgId: string;
  try {
    const payload = await verifyHandoffToken(token);
    const result = await provisionFromToken(payload);
    orgId = result.orgId;
  } catch {
    return new Response("Invalid or expired sign-in link.", { status: 401 });
  }

  (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // Runs the crm-sso provider (re-verifies the token, resolves the user),
  // sets the session cookie, and throws a redirect to `next`.
  await signIn("crm-sso", { token, redirectTo: next });
}
