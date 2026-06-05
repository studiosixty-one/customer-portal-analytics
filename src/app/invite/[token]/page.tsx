import Link from "next/link";
import { eq } from "drizzle-orm";

import { getCurrentContext } from "@/lib/auth/context";
import { db, invitations } from "@/lib/db";
import { AcceptInvite } from "@/components/members/accept-invite";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
    with: { organization: { columns: { name: true } } },
  });
  const ctx = await getCurrentContext();

  let invalidReason: string | null = null;
  if (!invite) invalidReason = "This invitation link is invalid.";
  else if (invite.acceptedAt)
    invalidReason = "This invitation has already been used.";
  else if (invite.expiresAt && invite.expiresAt < new Date())
    invalidReason = "This invitation has expired.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        {!invite || invalidReason ? (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Invitation</CardTitle>
              <CardDescription>{invalidReason}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin">Go to dashboard</Link>
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-xl">
                Join {invite.organization.name}
              </CardTitle>
              <CardDescription>
                You&apos;ve been invited as {invite.role}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ctx ? (
                <AcceptInvite token={token} />
              ) : (
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Sign in to accept this invitation.
                  </p>
                  <Button asChild className="w-full">
                    <Link
                      href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
                    >
                      Sign in
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
