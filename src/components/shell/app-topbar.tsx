"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { OrgSwitcher, type OrgSummary } from "./org-switcher";
import { UserMenu } from "./user-menu";

const NAV: { href: string; label: string; match: (p: string) => boolean }[] = [
  {
    href: "/admin",
    label: "Sites",
    match: (p) => p === "/admin" || p.startsWith("/admin/sites"),
  },
  {
    href: "/admin/members",
    label: "Members",
    match: (p) => p.startsWith("/admin/members"),
  },
];

export function AppTopbar({
  user,
  memberships,
  activeOrgId,
  isSuperAdmin,
}: {
  user: { name: string | null; email: string };
  memberships: OrgSummary[];
  activeOrgId: string | null;
  isSuperAdmin: boolean;
}) {
  const pathname = usePathname();
  const nav = isSuperAdmin
    ? [
        ...NAV,
        {
          href: "/admin/platform",
          label: "Platform",
          match: (p: string) => p.startsWith("/admin/platform"),
        },
      ]
    : NAV;

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <Link href="/admin" className="font-semibold tracking-tight">
          Studio 61: Analytics
        </Link>
        <OrgSwitcher memberships={memberships} activeOrgId={activeOrgId} />
        <nav className="ml-1 hidden items-center gap-1 sm:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                n.match(pathname)
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
