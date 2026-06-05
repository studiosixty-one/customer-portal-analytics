"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireOrg, requireRole, requireSiteAccess } from "@/lib/auth/context";
import { db, sites } from "@/lib/db";
import { getInstallStatus, getLiveLocations } from "@/lib/analytics/queries";
import type { Filters } from "@/lib/analytics/filters";

/** Opaque public id embedded in the tracking snippet and used as the AE index. */
function newTrackingId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Normalize a user-entered domain to a bare hostname (no scheme/path). */
function normalizeDomain(input: string): string {
  const v = input.trim().toLowerCase();
  if (!v) return "";
  try {
    return new URL(v.includes("://") ? v : `https://${v}`).hostname;
  } catch {
    return v.replace(/^https?:\/\//, "").split("/")[0];
  }
}

export async function createSite(input: { name: string; domain: string }) {
  const { org, isSuperAdmin } = await requireOrg();
  if (!isSuperAdmin && !org.canAddSites) {
    throw new Error(
      "Adding sites is disabled for your organization. Contact your administrator.",
    );
  }
  const name = input.name.trim();
  const domain = normalizeDomain(input.domain);
  if (!name) throw new Error("Site name is required.");
  if (!domain) throw new Error("Domain is required.");

  const [site] = await db
    .insert(sites)
    .values({ orgId: org.id, name, domain, trackingId: newTrackingId() })
    .returning();
  revalidatePath("/admin");
  return { id: site.id };
}

export async function renameSite(id: string, name: string) {
  const { ctx } = await requireSiteAccess(id);
  requireRole(ctx, ["owner", "admin", "member"]);
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.update(sites).set({ name: trimmed }).where(eq(sites.id, id));
  revalidatePath("/admin");
  revalidatePath(`/admin/sites/${id}`, "layout");
}

export async function updateSiteDomain(id: string, domain: string) {
  const { ctx } = await requireSiteAccess(id);
  requireRole(ctx, ["owner", "admin", "member"]);
  const normalized = normalizeDomain(domain);
  if (!normalized) throw new Error("Domain is required.");
  await db.update(sites).set({ domain: normalized }).where(eq(sites.id, id));
  revalidatePath(`/admin/sites/${id}`, "layout");
}

/** Rotate the tracking id — invalidates the old snippet on the customer site. */
export async function regenerateTrackingId(id: string) {
  const { ctx } = await requireSiteAccess(id);
  requireRole(ctx, ["owner", "admin"]);
  const trackingId = newTrackingId();
  await db.update(sites).set({ trackingId }).where(eq(sites.id, id));
  revalidatePath(`/admin/sites/${id}`, "layout");
  return { trackingId };
}

export async function deleteSite(id: string) {
  const { ctx } = await requireSiteAccess(id);
  requireRole(ctx, ["owner", "admin"]);
  await db.delete(sites).where(eq(sites.id, id)); // cascades stats_daily
  revalidatePath("/admin");
}

/** Used by the Install tab's "Test installation" button. */
export async function checkInstall(id: string) {
  const { site } = await requireSiteAccess(id);
  return getInstallStatus(site.trackingId);
}

/** Live visitor locations for the globe widget (polled by the client). */
export async function liveLocations(id: string, filters: Filters = {}) {
  const { site } = await requireSiteAccess(id);
  return getLiveLocations(site.trackingId, filters);
}
