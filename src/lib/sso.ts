import { jwtVerify } from "jose";
import { eq } from "drizzle-orm";

import { db, memberships, organizations, users } from "@/lib/db";
import { slugify } from "@/lib/slug";

/**
 * SSO handoff from the CRM (separate database). The CRM mints a short-lived
 * HS256 JWT signed with the shared SSO_SHARED_SECRET and POSTs it to
 * /api/sso/handoff. We verify it and just-in-time provision a local user +
 * organization (linked to the CRM's user/company ids), then issue our own
 * session. The two apps share only this secret — never a database.
 */
export type HandoffPayload = {
  userId: string; // CRM user id
  companyId: string; // CRM company id
  email?: string;
  name?: string;
  companyName?: string;
};

export async function verifyHandoffToken(
  token: string,
): Promise<HandoffPayload> {
  const secret = process.env.SSO_SHARED_SECRET;
  if (!secret) {
    throw new Error("SSO is not configured (missing SSO_SHARED_SECRET).");
  }

  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(secret),
    { algorithms: ["HS256"] },
  );

  const userId =
    typeof payload.userId === "string"
      ? payload.userId
      : typeof payload.sub === "string"
        ? payload.sub
        : null;
  const companyId =
    typeof payload.companyId === "string" ? payload.companyId : null;
  if (!userId || !companyId) {
    throw new Error("Handoff token is missing userId or companyId.");
  }

  return {
    userId,
    companyId,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
    companyName:
      typeof payload.companyName === "string" ? payload.companyName : undefined,
  };
}

async function uniqueOrgSlug(name: string): Promise<string> {
  const root = slugify(name);
  let candidate = root;
  for (let i = 0; i < 6; i++) {
    const existing = await db.query.organizations.findFirst({
      where: eq(organizations.slug, candidate),
      columns: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${root}-${crypto.randomUUID().slice(0, 6)}`;
  }
  return `${root}-${crypto.randomUUID().slice(0, 8)}`;
}

export type ProvisionResult = {
  userId: string;
  orgId: string;
  email: string;
  name: string | null;
};

/** Idempotently map a CRM user+company onto a local user + org + membership. */
export async function provisionFromToken(
  payload: HandoffPayload,
): Promise<ProvisionResult> {
  const email = (payload.email ?? `${payload.userId}@sso.local`).toLowerCase();
  const name = payload.name ?? null;
  const companyName = payload.companyName?.trim() || "Organization";

  // Organization, keyed by the CRM company id.
  let org = await db.query.organizations.findFirst({
    where: eq(organizations.externalId, payload.companyId),
  });
  if (!org) {
    const slug = await uniqueOrgSlug(companyName);
    const inserted = await db
      .insert(organizations)
      .values({ name: companyName, slug, externalId: payload.companyId })
      .returning();
    org = inserted[0];
  } else if (org.name !== companyName) {
    await db
      .update(organizations)
      .set({ name: companyName })
      .where(eq(organizations.id, org.id));
  }
  if (!org) throw new Error("Failed to provision organization.");

  // User, keyed by the CRM user id (falling back to linking an existing email).
  let user = await db.query.users.findFirst({
    where: eq(users.externalId, payload.userId),
  });
  if (!user) {
    const byEmail = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (byEmail) {
      await db
        .update(users)
        .set({ externalId: payload.userId, name: name ?? byEmail.name })
        .where(eq(users.id, byEmail.id));
      user = { ...byEmail, externalId: payload.userId };
    } else {
      const inserted = await db
        .insert(users)
        .values({ email, name, externalId: payload.userId, passwordHash: null })
        .returning();
      user = inserted[0];
    }
  }
  if (!user) throw new Error("Failed to provision user.");

  // Owner membership of their company's org.
  await db
    .insert(memberships)
    .values({ orgId: org.id, userId: user.id, role: "owner" })
    .onConflictDoNothing();

  return { userId: user.id, orgId: org.id, email: user.email, name: user.name };
}

export async function provisionFromHandoffToken(
  token: string,
): Promise<ProvisionResult> {
  return provisionFromToken(await verifyHandoffToken(token));
}
