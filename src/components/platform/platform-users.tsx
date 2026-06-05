"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  createUser,
  deleteUser,
  resetUserPassword,
  setUserSuperAdmin,
} from "@/lib/platform/actions";
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
import { Switch } from "@/components/ui/switch";

type U = { id: string; email: string; name: string | null; isSuperAdmin: boolean };

export function PlatformUsers({
  users,
  myUserId,
}: {
  users: U[];
  myUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [resetUser, setResetUser] = useState<U | null>(null);
  const [newPw, setNewPw] = useState("");
  const [toDelete, setToDelete] = useState<U | null>(null);

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

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border p-4">
        <h3 className="font-medium">Create user login</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            type="password"
            placeholder="password (min 8)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button
          disabled={pending || !email.trim() || password.length < 8}
          onClick={() => {
            run(() => createUser(email, name, password), "User created");
            setEmail("");
            setName("");
            setPassword("");
          }}
        >
          <UserPlus className="size-4" />
          Create user
        </Button>
      </section>

      <div className="divide-y rounded-lg border">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {u.name || u.email}
                {u.id === myUserId && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (you)
                  </span>
                )}
              </p>
              <p className="truncate text-muted-foreground">{u.email}</p>
            </div>
            {u.isSuperAdmin && <Badge variant="secondary">super-admin</Badge>}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Super-admin
              <Switch
                checked={u.isSuperAdmin}
                disabled={pending || (u.id === myUserId && u.isSuperAdmin)}
                onCheckedChange={(v) =>
                  run(() => setUserSuperAdmin(u.id, v), "Updated")
                }
              />
            </label>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setResetUser(u);
                setNewPw("");
              }}
              aria-label="Reset password"
            >
              <KeyRound className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              disabled={u.id === myUserId}
              onClick={() => setToDelete(u)}
              aria-label="Delete user"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Reset password */}
      <Dialog open={!!resetUser} onOpenChange={(o) => !o && setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-pw">New password</Label>
            <Input
              id="new-pw"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="min 8 characters"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              disabled={pending || newPw.length < 8}
              onClick={() => {
                if (resetUser)
                  run(
                    () => resetUserPassword(resetUser.id, newPw),
                    "Password reset",
                  );
                setResetUser(null);
              }}
            >
              Set password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete user */}
      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {toDelete?.email}?</DialogTitle>
            <DialogDescription>
              This removes the user and all their organization memberships.
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
                  run(() => deleteUser(toDelete.id), "User deleted");
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
