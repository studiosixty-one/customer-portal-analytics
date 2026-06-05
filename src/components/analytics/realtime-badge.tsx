export function RealtimeBadge({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      <span>
        <span className="font-medium text-foreground">
          {count.toLocaleString()}
        </span>{" "}
        online now
      </span>
    </div>
  );
}
