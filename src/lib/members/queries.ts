import { and, eq, isNull } from "drizzle-orm";

import { db, invitations, memberships } from "@/lib/db";

export async function getOrgMembers(orgId: string) {
  return db.query.memberships.findMany({
    where: eq(memberships.orgId, orgId),
    with: { user: { columns: { id: true, name: true, email: true } } },
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  });
}

export async function getOrgInvites(orgId: string) {
  return db.query.invitations.findMany({
    where: and(eq(invitations.orgId, orgId), isNull(invitations.acceptedAt)),
    orderBy: (i, { desc }) => [desc(i.createdAt)],
  });
}
