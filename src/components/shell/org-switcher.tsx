"use client";

import { useTransition } from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

import { switchOrg } from "@/lib/org/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type OrgSummary = { id: string; name: string; role: string | null };

export function OrgSwitcher({
  memberships,
  activeOrgId,
}: {
  memberships: OrgSummary[];
  activeOrgId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const active = memberships.find((m) => m.id === activeOrgId);
  // Super-admin viewing an org they don't belong to (role unknown).
  const viewingOnly = !!active && active.role === null;

  function choose(id: string) {
    if (id === activeOrgId) return;
    startTransition(() => {
      switchOrg(id).catch(() => toast.error("Couldn't switch organization"));
    });
  }

  if (memberships.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">No organization</span>
    );
  }

  if (memberships.length === 1) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium">
        <Building2 className="size-4 text-muted-foreground" />
        <span className="max-w-40 truncate">{memberships[0].name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={pending}>
          <Building2 className="size-4" />
          <span className="max-w-32 truncate">
            {active?.name ?? "Select organization"}
          </span>
          {viewingOnly && (
            <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700">
              viewing
            </span>
          )}
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
        <DropdownMenuLabel>Switch organization</DropdownMenuLabel>
        {memberships.map((m) => (
          <DropdownMenuItem key={m.id} onClick={() => choose(m.id)}>
            <Check
              className={cn(
                "size-4",
                m.id === activeOrgId ? "opacity-100" : "opacity-0",
              )}
            />
            <span className="flex-1 truncate">{m.name}</span>
            <span className="text-xs capitalize text-muted-foreground">
              {m.role ?? "view"}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
