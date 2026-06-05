import { count } from "drizzle-orm";

import { db, sites, users } from "@/lib/db";

export async function listPlatformOrgs() {
  const orgs = await db.query.organizations.findMany({
    with: {
      memberships: {
        with: { user: { columns: { id: true, name: true, email: true } } },
      },
    },
    orderBy: (o, { asc }) => [asc(o.name)],
  });

  const siteCounts = await db
    .select({ orgId: sites.orgId, total: count() })
    .from(sites)
    .groupBy(sites.orgId);
  const sc = new Map(siteCounts.map((r) => [r.orgId, Number(r.total)]));

  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    canAddSites: o.canAddSites,
    siteCount: sc.get(o.id) ?? 0,
    members: o.memberships.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    })),
  }));
}

export async function listPlatformUsers() {
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isSuperAdmin: users.isSuperAdmin,
    })
    .from(users)
    .orderBy(users.email);
}
