"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { ACTIVE_ORG_COOKIE, requireContext } from "@/lib/auth/context";
import { db, invitations, memberships, organizations } from "@/lib/db";
import type { OrgRole } from "@/lib/db/schema";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function setActiveOrgCookie(orgId: string) {
  (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Assert the current user is a member of orgId with one of the given roles. */
async function requireOrgRole(orgId: string, roles: OrgRole[]) {
  const ctx = await requireContext();
  const membership = ctx.memberships.find((m) => m.org.id === orgId);
  // Super-admins have full rights in any organization.
  if (ctx.isSuperAdmin) {
    return { ctx, role: membership?.role ?? ("owner" as OrgRole) };
  }
  if (!membership) throw new Error("You are not a member of this organization.");
  if (!roles.includes(membership.role)) {
    throw new Error("You don't have permission to do that.");
  }
  return { ctx, role: membership.role };
}

async function countOwners(orgId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.role, "owner")));
  return Number(row?.c ?? 0);
}

// ── Org lifecycle ─────────────────────────────────────────────────────────────
export async function switchOrg(orgId: string) {
  const ctx = await requireContext();
  const isMember = ctx.memberships.some((m) => m.org.id === orgId);
  if (!isMember && !ctx.isSuperAdmin) {
    throw new Error("You are not a member of that organization.");
  }
  await setActiveOrgCookie(orgId);
  revalidatePath("/admin", "layout");
}

export async function renameOrg(orgId: string, name: string) {
  await requireOrgRole(orgId, ["owner", "admin"]);
  const trimmed = name.trim();
  if (!trimmed) return;
  await db
    .update(organizations)
    .set({ name: trimmed })
    .where(eq(organizations.id, orgId));
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/members");
}

export async function deleteOrg(orgId: string) {
  await requireOrgRole(orgId, ["owner"]);
  await db.delete(organizations).where(eq(organizations.id, orgId)); // cascades
  const store = await cookies();
  if (store.get(ACTIVE_ORG_COOKIE)?.value === orgId) {
    store.delete(ACTIVE_ORG_COOKIE);
  }
  revalidatePath("/admin", "layout");
}

export async function leaveOrg(orgId: string) {
  const ctx = await requireContext();
  const mine = ctx.memberships.find((m) => m.org.id === orgId);
  if (!mine) return;
  if (mine.role === "owner" && (await countOwners(orgId)) <= 1) {
    throw new Error(
      "You're the last owner — transfer ownership or delete the organization first.",
    );
  }
  await db
    .delete(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, ctx.userId)));
  const store = await cookies();
  if (store.get(ACTIVE_ORG_COOKIE)?.value === orgId) {
    store.delete(ACTIVE_ORG_COOKIE);
  }
  revalidatePath("/admin", "layout");
}

// ── Members ───────────────────────────────────────────────────────────────────
export async function removeMember(orgId: string, userId: string) {
  const { role: myRole } = await requireOrgRole(orgId, ["owner", "admin"]);
  const target = await db.query.memberships.findFirst({
    where: and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)),
  });
  if (!target) return;
  if (target.role === "owner" && myRole !== "owner") {
    throw new Error("Only an owner can remove an owner.");
  }
  if (target.role === "owner" && (await countOwners(orgId)) <= 1) {
    throw new Error("You can't remove the last owner.");
  }
  await db
    .delete(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  revalidatePath("/admin/members");
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: OrgRole,
) {
  const { role: myRole } = await requireOrgRole(orgId, ["owner", "admin"]);
  const target = await db.query.memberships.findFirst({
    where: and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)),
  });
  if (!target) return;
  if ((target.role === "owner" || role === "owner") && myRole !== "owner") {
    throw new Error("Only an owner can manage owners.");
  }
  if (
    target.role === "owner" &&
    role !== "owner" &&
    (await countOwners(orgId)) <= 1
  ) {
    throw new Error("You can't demote the last owner.");
  }
  await db
    .update(memberships)
    .set({ role })
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  revalidatePath("/admin/members");
}

// ── Invitations ───────────────────────────────────────────────────────────────
export async function createInvite(orgId: string, email: string, role: OrgRole) {
  const { ctx } = await requireOrgRole(orgId, ["owner", "admin"]);
  const token = crypto.randomUUID();
  await db.insert(invitations).values({
    orgId,
    email: email.toLowerCase().trim(),
    role: role === "owner" ? "admin" : role,
    token,
    invitedByUserId: ctx.userId,
    expiresAt: new Date(Date.now() + WEEK_MS),
  });
  revalidatePath("/admin/members");
  return { token };
}

export async function revokeInvite(inviteId: string) {
  const invite = await db.query.invitations.findFirst({
    where: eq(invitations.id, inviteId),
    columns: { id: true, orgId: true },
  });
  if (!invite) return;
  await requireOrgRole(invite.orgId, ["owner", "admin"]);
  await db.delete(invitations).where(eq(invitations.id, inviteId));
  revalidatePath("/admin/members");
}

export async function acceptInvite(token: string) {
  const ctx = await requireContext();
  const invite = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
  });
  if (!invite) throw new Error("Invitation not found.");
  if (invite.acceptedAt) throw new Error("This invitation has already been used.");
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new Error("This invitation has expired.");
  }

  const alreadyMember = ctx.memberships.some((m) => m.org.id === invite.orgId);
  if (!alreadyMember) {
    await db
      .insert(memberships)
      .values({ orgId: invite.orgId, userId: ctx.userId, role: invite.role });
  }
  await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(invitations.id, invite.id));

  await setActiveOrgCookie(invite.orgId);
  revalidatePath("/admin", "layout");
  return { orgId: invite.orgId };
}
