"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { acceptInvite } from "@/lib/org/actions";
import { Button } from "@/components/ui/button";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function accept() {
    setPending(true);
    try {
      await acceptInvite(token);
      toast.success("You've joined the organization");
      router.replace("/admin");
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't accept the invitation",
      );
      setPending(false);
    }
  }

  return (
    <Button className="w-full" onClick={accept} disabled={pending}>
      {pending ? "Joining…" : "Accept invitation"}
    </Button>
  );
}
