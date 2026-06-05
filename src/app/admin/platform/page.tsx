import { requireSuperAdmin } from "@/lib/auth/context";
import { listPlatformOrgs, listPlatformUsers } from "@/lib/platform/queries";
import { PlatformOrgs } from "@/components/platform/platform-orgs";
import { PlatformUsers } from "@/components/platform/platform-users";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default async function PlatformPage() {
  const ctx = await requireSuperAdmin();
  const [orgs, users] = await Promise.all([
    listPlatformOrgs(),
    listPlatformUsers(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform admin</h1>
        <p className="text-muted-foreground">
          Provision organizations and user logins.
        </p>
      </div>
      <Tabs defaultValue="orgs">
        <TabsList>
          <TabsTrigger value="orgs">Organizations</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="orgs" className="mt-4">
          <PlatformOrgs orgs={orgs} />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <PlatformUsers users={users} myUserId={ctx.userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
