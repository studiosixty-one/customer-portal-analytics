"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createInvite,
  deleteOrg,
  leaveOrg,
  removeMember,
  renameOrg,
  revokeInvite,
  updateMemberRole,
} from "@/lib/org/actions";
import type { OrgRole } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Member = {
  userId: string;
  name: string | null;
  email: string;
  role: OrgRole;
};
type Invite = { id: string; email: string; role: OrgRole; token: string };

export function MembersManager({
  orgId,
  orgName,
  myUserId,
  myRole,
  members,
  invites,
}: {
  orgId: string;
  orgName: string;
  myUserId: string;
  myRole: OrgRole;
  members: Member[];
  invites: Invite[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canManage = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";

  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const inviteUrl = (token: string) => `${base}/invite/${token}`;

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");
  const [name, setName] = useState(orgName);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [danger, setDanger] = useState<"leave" | "delete" | null>(null);

  function run(fn: () => Promise<unknown>, ok?: string) {
    startTransition(async () => {
      try {
        await fn();
        if (ok) toast.success(ok);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Invite link copied");
  }

  async function onCreateInvite() {
    if (!inviteEmail.trim()) return;
    startTransition(async () => {
      try {
        const { token } = await createInvite(orgId, inviteEmail, inviteRole);
        await navigator.clipboard.writeText(inviteUrl(token));
        toast.success("Invite link created & copied");
        setInviteEmail("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't create invite");
      }
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-muted-foreground">
          People in <span className="font-medium">{orgName}</span>.
        </p>
      </div>

      {canManage && (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-medium">Invite a teammate</h2>
          <p className="text-sm text-muted-foreground">
            Creates a shareable link (no email is sent). The link is copied to
            your clipboard.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as OrgRole)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={onCreateInvite} disabled={pending}>
              <Link2 className="size-4" />
              Create link
            </Button>
          </div>
        </section>
      )}

      {invites.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Pending invitations</h2>
          <div className="divide-y rounded-lg border">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <span className="flex-1 truncate">{inv.email}</span>
                <Badge variant="secondary" className="capitalize">
                  {inv.role}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copy(inviteUrl(inv.token))}
                  aria-label="Copy invite link"
                >
                  <Copy className="size-4" />
                </Button>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    disabled={pending}
                    onClick={() => run(() => revokeInvite(inv.id), "Invite revoked")}
                    aria-label="Revoke invite"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">
          {members.length} member{members.length === 1 ? "" : "s"}
        </h2>
        <div className="divide-y rounded-lg border">
          {members.map((m) => {
            const isSelf = m.userId === myUserId;
            const ownerCount = members.filter((x) => x.role === "owner").length;
            const canEditRole =
              canManage &&
              !isSelf &&
              (m.role !== "owner" || isOwner);
            const canRemove =
              canEditRole && !(m.role === "owner" && ownerCount <= 1);

            return (
              <div
                key={m.userId}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.name || m.email}
                    {isSelf && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="truncate text-muted-foreground">{m.email}</p>
                </div>
                {canEditRole ? (
                  <Select
                    value={m.role}
                    onValueChange={(v) =>
                      run(
                        () => updateMemberRole(orgId, m.userId, v as OrgRole),
                        "Role updated",
                      )
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      {isOwner && <SelectItem value="owner">Owner</SelectItem>}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className="capitalize">
                    {m.role}
                  </Badge>
                )}
                {canRemove && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => setRemoveTarget(m)}
                    aria-label="Remove member"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Organization</h2>
        {canManage && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              disabled={pending || name.trim() === orgName}
              onClick={() => run(() => renameOrg(orgId, name), "Organization renamed")}
            >
              Save
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" onClick={() => setDanger("leave")}>
            Leave organization
          </Button>
          {isOwner && (
            <Button variant="destructive" onClick={() => setDanger("delete")}>
              Delete organization
            </Button>
          )}
        </div>
      </section>

      {/* Remove member confirm */}
      <Dialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              {removeTarget?.name || removeTarget?.email} will lose access to{" "}
              {orgName}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (removeTarget)
                  run(
                    () => removeMember(orgId, removeTarget.userId),
                    "Member removed",
                  );
                setRemoveTarget(null);
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave / delete confirm */}
      <Dialog open={!!danger} onOpenChange={(o) => !o && setDanger(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {danger === "delete"
                ? `Delete ${orgName}?`
                : `Leave ${orgName}?`}
            </DialogTitle>
            <DialogDescription>
              {danger === "delete"
                ? "This permanently deletes the organization and all its sites and analytics. This can't be undone."
                : "You'll lose access to this organization's sites."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const action = danger;
                setDanger(null);
                startTransition(async () => {
                  try {
                    if (action === "delete") await deleteOrg(orgId);
                    else await leaveOrg(orgId);
                    router.replace("/admin");
                    router.refresh();
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Something went wrong",
                    );
                  }
                });
              }}
            >
              {danger === "delete" ? "Delete" : "Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
