import { eq } from "drizzle-orm";

import { requireOrg } from "@/lib/auth/context";
import { db, sites } from "@/lib/db";

/** All sites for the active organization, newest first. */
export async function listSites() {
  const { org } = await requireOrg();
  return db.query.sites.findMany({
    where: eq(sites.orgId, org.id),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });
}
