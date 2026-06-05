import { BarChart3, Eye, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { Overview } from "@/lib/analytics/queries";

export function StatCards({ overview }: { overview: Overview }) {
  const items = [
    { icon: Users, label: "Visitors", value: overview.visitors.toLocaleString() },
    { icon: Eye, label: "Pageviews", value: overview.pageviews.toLocaleString() },
    {
      icon: BarChart3,
      label: "Views / visitor",
      value: String(overview.viewsPerVisitor),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map(({ icon: Icon, label, value }) => (
        <Card key={label}>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="size-4" />
              {label}
            </div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">
              {value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
