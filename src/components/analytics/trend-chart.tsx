import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Range, TrendPoint } from "@/lib/analytics/queries";

function labelFor(bucket: string, range: Range): string {
  const d = new Date(bucket.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return bucket;
  return range === "24h"
    ? d.toLocaleTimeString(undefined, { hour: "numeric" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TrendChart({
  points,
  range,
}: {
  points: TrendPoint[];
  range: Range;
}) {
  if (points.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Visitors over time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-16 text-center text-sm text-muted-foreground">
            No data for this period yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const n = points.length;
  const yMax = Math.max(1, ...points.map((p) => p.views));
  const X = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const Y = (v: number) => 100 - (v / yMax) * 95; // 5% headroom; baseline = 100

  const linePath = (sel: (p: TrendPoint) => number) =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(2)},${Y(sel(p)).toFixed(2)}`)
      .join(" ");

  const visitorsArea =
    `M${X(0).toFixed(2)},100 ` +
    points.map((p, i) => `L${X(i).toFixed(2)},${Y(p.visitors).toFixed(2)}`).join(" ") +
    ` L${X(n - 1).toFixed(2)},100 Z`;

  const colW = 100 / n;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visitors over time</CardTitle>
        <CardAction>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" /> Visitors
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 border-t border-dashed border-muted-foreground" />{" "}
              Pageviews
            </span>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-48 w-full overflow-visible"
          role="img"
          aria-label="Visitors and pageviews over time"
        >
          <path d={visitorsArea} className="fill-primary/15" />
          <path
            d={linePath((p) => p.views)}
            className="fill-none stroke-muted-foreground/50"
            strokeWidth={1}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={linePath((p) => p.visitors)}
            className="fill-none stroke-primary"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((p, i) => (
            <rect
              key={p.bucket}
              x={Math.max(0, X(i) - colW / 2)}
              y={0}
              width={colW}
              height={100}
              fill="transparent"
            >
              <title>
                {labelFor(p.bucket, range)} · {p.visitors.toLocaleString()}{" "}
                visitors · {p.views.toLocaleString()} pageviews
              </title>
            </rect>
          ))}
        </svg>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{labelFor(points[0].bucket, range)}</span>
          <span>{labelFor(points[n - 1].bucket, range)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
