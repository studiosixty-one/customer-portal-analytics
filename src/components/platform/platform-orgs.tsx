"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { switchOrg } from "@/lib/org/actions";
import {
  assignMembership,
  createOrganization,
  deleteOrganization,
  removeMembership,
  setOrgCanAddSites,
  updateMembershipRole,
} from "@/lib/platform/actions";
import type { OrgRole } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
type Org = {
  id: string;
  name: string;
  slug: string;
  canAddSites: boolean;
  siteCount: number;
  members: Member[];
};

const ROLES: OrgRole[] = ["owner", "admin", "member"];

export function PlatformOrgs({ orgs }: { orgs: Org[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [addEmail, setAddEmail] = useState<Record<string, string>>({});
  const [addRole, setAddRole] = useState<Record<string, OrgRole>>({});
  const [toDelete, setToDelete] = useState<Org | null>(null);

  function run(fn: () => Promise<unknown>, ok?: string) {
    startTransition(async () => {
      try {
        await fn();
        if (ok) toast.success(ok);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function openOrg(id: string) {
    startTransition(async () => {
      try {
        await switchOrg(id);
        router.push("/admin");
      } catch {
        toast.error("Couldn't open organization");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="flex items-end gap-2 rounded-lg border p-4">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="new-org">New organization</Label>
          <Input
            id="new-org"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Acme Inc."
          />
        </div>
        <Button
          disabled={pending || !newName.trim()}
          onClick={() => {
            run(() => createOrganization(newName), "Organization created");
            setNewName("");
          }}
        >
          <Plus className="size-4" />
          Create
        </Button>
      </section>

      {orgs.map((org) => (
        <section key={org.id} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-medium">{org.name}</h3>
              <p className="font-mono text-xs text-muted-foreground">
                /{org.slug} · {org.siteCount} site{org.siteCount === 1 ? "" : "s"}{" "}
                · {org.members.length} member{org.members.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openOrg(org.id)}
                disabled={pending}
              >
                <Eye className="size-4" />
                Open
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => setToDelete(org)}
                aria-label="Delete organization"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          <label className="flex w-fit items-center gap-2 text-sm">
            <Switch
              checked={org.canAddSites}
              disabled={pending}
              onCheckedChange={(v) =>
                run(
                  () => setOrgCanAddSites(org.id, v),
                  v ? "Site creation enabled" : "Site creation disabled",
                )
              }
            />
            <span className="text-muted-foreground">
              {org.canAddSites
                ? "Can add sites"
                : "Site creation disabled"}
            </span>
          </label>

          <div className="divide-y rounded-md border">
            {org.members.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No members yet.
              </p>
            )}
            {org.members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center gap-2 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate">{m.name || m.email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.email}
                  </p>
                </div>
                <Select
                  value={m.role}
                  onValueChange={(v) =>
                    run(
                      () => updateMembershipRole(org.id, m.userId, v as OrgRole),
                      "Role updated",
                    )
                  }
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() =>
                    run(
                      () => removeMembership(org.id, m.userId),
                      "Member removed",
                    )
                  }
                  aria-label="Remove member"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label>Add member (existing user&apos;s email)</Label>
              <Input
                type="email"
                value={addEmail[org.id] ?? ""}
                onChange={(e) =>
                  setAddEmail({ ...addEmail, [org.id]: e.target.value })
                }
                placeholder="user@example.com"
              />
            </div>
            <Select
              value={addRole[org.id] ?? "member"}
              onValueChange={(v) =>
                setAddRole({ ...addRole, [org.id]: v as OrgRole })
              }
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={pending || !(addEmail[org.id] ?? "").trim()}
              onClick={() => {
                run(
                  () =>
                    assignMembership(
                      org.id,
                      addEmail[org.id],
                      addRole[org.id] ?? "member",
                    ),
                  "Member added",
                );
                setAddEmail({ ...addEmail, [org.id]: "" });
              }}
            >
              Add
            </Button>
          </div>
        </section>
      ))}

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {toDelete?.name}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the organization and all its sites and
              analytics. This can&apos;t be undone.
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
                if (toDelete)
                  run(
                    () => deleteOrganization(toDelete.id),
                    "Organization deleted",
                  );
                setToDelete(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
