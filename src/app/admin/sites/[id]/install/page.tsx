import { requireSiteAccess } from "@/lib/auth/context";
import { env } from "@/lib/env";
import { CopyButton } from "@/components/sites/copy-button";
import { InstallCheck } from "@/components/sites/install-check";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function InstallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { site } = await requireSiteAccess(id);

  const snippet = `<script defer src="${env.NEXT_PUBLIC_COLLECTOR_URL}/script.js" data-site="${site.trackingId}"></script>`;

  const userSnippet = `// After the user signs in — pass a stable id + optional display label:
s61('identify', 'USER_ID', 'Jane · Pro');

// Log custom actions anywhere in your app:
s61('track', 'created_report');
s61('track', 'upgraded', { plan: 'pro' });

// On logout:
s61('reset');`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Install the tracking snippet</CardTitle>
          <CardDescription>
            Add this to the <code className="text-xs">&lt;head&gt;</code> of
            every page on <span className="font-medium">{site.domain}</span>.
            It&apos;s cookieless and ~1&nbsp;KB, so it won&apos;t need a consent
            banner or slow your site down.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="overflow-x-auto rounded-md border bg-muted p-4 text-sm">
            <code>{snippet}</code>
          </pre>
          <CopyButton value={snippet} label="Copy snippet" />
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Paste the snippet just before the closing &lt;/head&gt; tag.</li>
            <li>Deploy your site.</li>
            <li>
              Visit a page — data appears on the Overview tab within a minute.
            </li>
          </ol>
          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">Verify it&apos;s working</p>
            <InstallCheck siteId={id} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Track signed-in users (optional)</CardTitle>
          <CardDescription>
            For product analytics on logged-in users, call <code>identify</code>{" "}
            after sign-in and <code>track</code> for custom actions. Activity is
            tied to the id you pass — keep it opaque (a user id) to avoid storing
            personal data. A <strong>Top users</strong> and <strong>Events</strong>{" "}
            section then appears on the Overview tab, and clicking a user filters
            the whole dashboard to them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="overflow-x-auto rounded-md border bg-muted p-4 text-sm">
            <code>{userSnippet}</code>
          </pre>
          <CopyButton value={userSnippet} label="Copy example" />
          <p className="text-sm text-muted-foreground">
            Tip: to attribute the very first pageview to a user, add this stub{" "}
            <em>before</em> the tracking snippet so early calls are queued:{" "}
            <code className="text-xs">
              &lt;script&gt;window.s61=window.s61||function()
              {"{"}(s61.q=s61.q||[]).push(arguments){"}"}&lt;/script&gt;
            </code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
