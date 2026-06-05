"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

import { requireSuperAdmin } from "@/lib/auth/context";
import { db, memberships, organizations, users } from "@/lib/db";
import type { OrgRole } from "@/lib/db/schema";
import { slugify } from "@/lib/slug";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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

// ── Organizations ─────────────────────────────────────────────────────────────
export async function createOrganization(name: string) {
  await requireSuperAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Organization name is required.");
  await db
    .insert(organizations)
    .values({ name: trimmed, slug: await uniqueOrgSlug(trimmed) });
  revalidatePath("/admin/platform");
}

export async function deleteOrganization(orgId: string) {
  await requireSuperAdmin();
  await db.delete(organizations).where(eq(organizations.id, orgId)); // cascades
  revalidatePath("/admin/platform");
  revalidatePath("/admin", "layout");
}

/** Toggle whether a customer org may create new sites. */
export async function setOrgCanAddSites(orgId: string, value: boolean) {
  await requireSuperAdmin();
  await db
    .update(organizations)
    .set({ canAddSites: value })
    .where(eq(organizations.id, orgId));
  revalidatePath("/admin/platform");
  revalidatePath("/admin", "layout");
}

// ── Memberships (cross-org, super-admin) ──────────────────────────────────────
export async function assignMembership(
  orgId: string,
  email: string,
  role: OrgRole,
) {
  await requireSuperAdmin();
  const normalized = email.toLowerCase().trim();
  const user = await db.query.users.findFirst({
    where: eq(users.email, normalized),
    columns: { id: true },
  });
  if (!user) throw new Error("No user with that email — create the user first.");
  await db
    .insert(memberships)
    .values({ orgId, userId: user.id, role })
    .onConflictDoUpdate({
      target: [memberships.orgId, memberships.userId],
      set: { role },
    });
  revalidatePath("/admin/platform");
  revalidatePath("/admin", "layout");
}

export async function updateMembershipRole(
  orgId: string,
  userId: string,
  role: OrgRole,
) {
  await requireSuperAdmin();
  await db
    .update(memberships)
    .set({ role })
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  revalidatePath("/admin/platform");
}

export async function removeMembership(orgId: string, userId: string) {
  await requireSuperAdmin();
  await db
    .delete(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  revalidatePath("/admin/platform");
  revalidatePath("/admin", "layout");
}

// ── Users / logins ────────────────────────────────────────────────────────────
export async function createUser(
  email: string,
  name: string,
  password: string,
) {
  await requireSuperAdmin();
  const normalized = email.toLowerCase().trim();
  if (!EMAIL_RE.test(normalized)) throw new Error("Enter a valid email.");
  if (password.length < 8)
    throw new Error("Password must be at least 8 characters.");
  const existing = await db.query.users.findFirst({
    where: eq(users.email, normalized),
    columns: { id: true },
  });
  if (existing) throw new Error("A user with that email already exists.");

  const passwordHash = await bcrypt.hash(password, 12);
  await db
    .insert(users)
    .values({ email: normalized, name: name.trim() || null, passwordHash });
  revalidatePath("/admin/platform");
}

export async function deleteUser(userId: string) {
  const ctx = await requireSuperAdmin();
  if (ctx.userId === userId) throw new Error("You can't delete your own account.");
  await db.delete(users).where(eq(users.id, userId)); // cascades memberships
  revalidatePath("/admin/platform");
}

export async function setUserSuperAdmin(userId: string, value: boolean) {
  const ctx = await requireSuperAdmin();
  if (ctx.userId === userId && !value)
    throw new Error("You can't remove your own super-admin access.");
  await db.update(users).set({ isSuperAdmin: value }).where(eq(users.id, userId));
  revalidatePath("/admin/platform");
}

export async function resetUserPassword(userId: string, password: string) {
  await requireSuperAdmin();
  if (password.length < 8)
    throw new Error("Password must be at least 8 characters.");
  const passwordHash = await bcrypt.hash(password, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}
