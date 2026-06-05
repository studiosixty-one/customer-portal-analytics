import { requireOrg } from "@/lib/auth/context";
import { getOrgInvites, getOrgMembers } from "@/lib/members/queries";
import { MembersManager } from "@/components/members/members-manager";

export default async function MembersPage() {
  const ctx = await requireOrg();
  const [members, invites] = await Promise.all([
    getOrgMembers(ctx.org.id),
    getOrgInvites(ctx.org.id),
  ]);

  return (
    <MembersManager
      orgId={ctx.org.id}
      orgName={ctx.org.name}
      myUserId={ctx.userId}
      myRole={ctx.role}
      members={members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      }))}
      invites={invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        token: i.token,
      }))}
    />
  );
}
