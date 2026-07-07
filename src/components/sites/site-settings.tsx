"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteSite,
  regenerateTrackingId,
  renameSite,
  resetSiteViews,
  updateSiteDomain,
} from "@/lib/sites/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SiteSettings({
  id,
  name: initialName,
  domain: initialDomain,
  trackingId,
  statsResetAt,
}: {
  id: string;
  name: string;
  domain: string;
  trackingId: string;
  statsResetAt: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [domain, setDomain] = useState(initialDomain);
  const [pending, start] = useTransition();

  function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        await Promise.all([renameSite(id, name), updateSiteDomain(id, domain)]);
        toast.success("Saved");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  function rotate() {
    start(async () => {
      try {
        await regenerateTrackingId(id);
        toast.success("Tracking id regenerated — update your snippet");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to regenerate");
      }
    });
  }

  function reset() {
    start(async () => {
      try {
        await resetSiteViews(id);
        toast.success("Views reset — counting fresh from now");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to reset");
      }
    });
  }

  function remove() {
    start(async () => {
      try {
        await deleteSite(id);
        toast.success("Site deleted");
        router.push("/admin");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Site details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveDetails} className="grid max-w-md gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </div>
            <div>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tracking id</CardTitle>
          <CardDescription>
            The id embedded in your snippet. Regenerating it stops data from the
            old snippet — you&apos;ll need to update the code on your site.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
            {trackingId}
          </code>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Regenerate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Regenerate tracking id?</DialogTitle>
                <DialogDescription>
                  Analytics from the current snippet will stop until you install
                  the new one. Past data is unaffected.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={rotate} disabled={pending}>
                  Regenerate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reset views</CardTitle>
          <CardDescription>
            Set every counter back to zero and start counting fresh from now.
            Data collected before the reset stops showing in the dashboard and
            can&apos;t be recovered. Your tracking snippet keeps working — no
            reinstall needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {statsResetAt && (
            <p className="text-xs text-muted-foreground">
              Last reset:{" "}
              <span suppressHydrationWarning>
                {new Date(statsResetAt).toLocaleString()}
              </span>
            </p>
          )}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Reset views
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset all views?</DialogTitle>
                <DialogDescription>
                  Every metric — visitors, pageviews, sources, campaigns, and the
                  map — will restart from zero and only count traffic from now on.
                  Past data is hidden and can&apos;t be brought back.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={reset} disabled={pending}>
                  Reset views
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Delete site</CardTitle>
          <CardDescription>
            Removes this site and its long-term rollups. This can&apos;t be
            undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                Delete site
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this site?</DialogTitle>
                <DialogDescription>
                  This permanently deletes the site and its stored daily
                  rollups. This can&apos;t be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={remove}
                  disabled={pending}
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
