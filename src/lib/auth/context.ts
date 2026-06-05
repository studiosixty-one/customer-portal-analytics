import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db, memberships, organizations, sites, users } from "@/lib/db";
import type { Organization, OrgRole, Site } from "@/lib/db/schema";

export const ACTIVE_ORG_COOKIE = "s61analytics_active_org";

export type OrgMembership = { org: Organization; role: OrgRole };
export type SwitchableOrg = { id: string; name: string };

export type Context = {
  userId: string;
  email: string;
  name: string | null;
  isSuperAdmin: boolean;
  memberships: OrgMembership[];
  /** Orgs the user may switch into: their memberships, or ALL orgs for super-admins. */
  switchableOrgs: SwitchableOrg[];
  org: Organization | null;
  role: OrgRole | null;
};

export const getCurrentContext = cache(async (): Promise<Context | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const [me, rows] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { isSuperAdmin: true },
    }),
    db.query.memberships.findMany({
      where: eq(memberships.userId, userId),
      with: { organization: true },
    }),
  ]);
  const isSuperAdmin = me?.isSuperAdmin ?? false;

  const mems: OrgMembership[] = rows
    .map((m) => ({ org: m.organization, role: m.role }))
    .sort((a, b) => a.org.name.localeCompare(b.org.name));

  // Super-admins can switch into any org; everyone else only their memberships.
  const switchableOrgs: SwitchableOrg[] = isSuperAdmin
    ? await db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .orderBy(organizations.name)
    : mems.map((m) => ({ id: m.org.id, name: m.org.name }));

  // Resolve the active org from the cookie.
  const activeId = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  let org: Organization | null = null;
  let role: OrgRole | null = null;

  const activeMembership = activeId
    ? mems.find((m) => m.org.id === activeId)
    : undefined;
  if (activeMembership) {
    org = activeMembership.org;
    role = activeMembership.role;
  } else if (isSuperAdmin && activeId) {
    const o = await db.query.organizations.findFirst({
      where: eq(organizations.id, activeId),
    });
    if (o) {
      org = o;
      role = "owner"; // super-admins act with full rights in any org
    }
  }
  if (!org && mems[0]) {
    org = mems[0].org;
    role = mems[0].role;
  }

  return {
    userId,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    isSuperAdmin,
    memberships: mems,
    switchableOrgs,
    org,
    role,
  };
});

export async function requireContext(): Promise<Context> {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** Require an active organization; sends users with none to onboarding. */
export async function requireOrg(): Promise<
  Context & { org: Organization; role: OrgRole }
> {
  const ctx = await requireContext();
  if (!ctx.org || !ctx.role) redirect("/admin/welcome");
  return { ...ctx, org: ctx.org, role: ctx.role };
}

export async function requireSuperAdmin(): Promise<Context> {
  const ctx = await requireContext();
  if (!ctx.isSuperAdmin) notFound();
  return ctx;
}

export function isMemberOf(ctx: Context, orgId: string | null): boolean {
  return orgId != null && ctx.memberships.some((m) => m.org.id === orgId);
}

/** Members can access their own orgs; super-admins can access any org. */
export function canAccessOrg(ctx: Context, orgId: string | null): boolean {
  return ctx.isSuperAdmin || isMemberOf(ctx, orgId);
}

export function requireRole(ctx: Context, roles: OrgRole[]): void {
  if (ctx.isSuperAdmin) return;
  if (!ctx.role || !roles.includes(ctx.role)) {
    throw new Error("You don't have permission to do that.");
  }
}

/**
 * Load a site and assert the current user can access its org (member, or
 * super-admin). 404s if missing or inaccessible (hides cross-tenant existence).
 */
export async function requireSiteAccess(
  siteId: string,
): Promise<{ ctx: Context; site: Site }> {
  const ctx = await requireContext();
  const site = await db.query.sites.findFirst({ where: eq(sites.id, siteId) });
  if (!site || !canAccessOrg(ctx, site.orgId)) notFound();
  return { ctx, site };
}
