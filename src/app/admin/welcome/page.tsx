import { Building2 } from "lucide-react";

import { requireContext } from "@/lib/auth/context";

// Users land here when they're signed in but belong to no organization yet
// (e.g. before a super-admin assigns them). Calls requireContext (NOT
// requireOrg) to avoid a redirect loop.
export default async function WelcomePage() {
  await requireContext();

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
      <Building2 className="size-10 text-muted-foreground" />
      <h1 className="mt-4 text-lg font-medium">No organization yet</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Your account isn&apos;t linked to an organization. Ask an administrator
        to add you, or accept an invitation link.
      </p>
    </div>
  );
}
