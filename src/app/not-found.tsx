import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-muted/30 p-6 text-center">
      <p className="text-5xl font-bold tracking-tight">404</p>
      <h1 className="text-lg font-semibold">This page doesn&apos;t exist</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The link may be broken, or the page may have been removed.
      </p>
      <Link
        href="/admin"
        className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Go to dashboard
      </Link>
    </main>
  );
}
