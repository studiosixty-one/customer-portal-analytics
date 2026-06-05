import { requireContext } from "@/lib/auth/context";
import { AppTopbar } from "@/components/shell/app-topbar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth is enforced by middleware + here; org-scoped pages additionally call
  // requireOrg(). Users with no org see the topbar's "Create organization".
  const ctx = await requireContext();

  return (
    <div className="min-h-screen bg-muted/20">
      <AppTopbar
        user={{ name: ctx.name, email: ctx.email }}
        memberships={ctx.switchableOrgs.map((o) => ({
          id: o.id,
          name: o.name,
          role: ctx.memberships.find((m) => m.org.id === o.id)?.role ?? null,
        }))}
        activeOrgId={ctx.org?.id ?? null}
        isSuperAdmin={ctx.isSuperAdmin}
      />
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
