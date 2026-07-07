import {
  FileText,
  Globe,
  Megaphone,
  Monitor,
  Share2,
  Smartphone,
  Tablet,
  Tag,
  User,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

import { countryName, flagEmoji } from "@/lib/analytics/countries";
import { BrandImg } from "./brand-img";

export type RowKind =
  | "page"
  | "source"
  | "country"
  | "device"
  | "browser"
  | "os"
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "user"
  | "event";

// Brand-icon slugs on cdn.simpleicons.org. Rendered in a neutral gray so they
// stay visible in both light and dark themes; BrandImg falls back if a slug is
// wrong or the CDN is unreachable.
const BROWSER_SLUG: Record<string, string> = {
  Chrome: "googlechrome",
  Firefox: "firefoxbrowser",
  Safari: "safari",
  Edge: "microsoftedge",
  Opera: "opera",
};
const OS_SLUG: Record<string, string> = {
  Windows: "windows",
  macOS: "apple",
  iOS: "apple",
  Android: "android",
  Linux: "linux",
};

const simpleIcon = (slug: string) => `https://cdn.simpleicons.org/${slug}/888888`;
const favicon = (host: string) =>
  `https://icons.duckduckgo.com/ip3/${host}.ico`;

/** Human-friendly label for a breakdown row key. */
export function rowLabel(kind: RowKind, value: string): string {
  if (kind === "country") return countryName(value);
  if (kind === "source" && value === "(direct)") return "Direct";
  return value;
}

/** The leading icon for a breakdown row. */
export function RowIcon({
  kind,
  value,
}: {
  kind: RowKind;
  value: string;
}): ReactNode {
  switch (kind) {
    case "country":
      return (
        <span className="w-4 shrink-0 text-center text-base leading-none">
          {flagEmoji(value)}
        </span>
      );
    case "device": {
      const Icon =
        value === "mobile" ? Smartphone : value === "tablet" ? Tablet : Monitor;
      return <Icon className="size-4 shrink-0 text-muted-foreground" />;
    }
    case "browser": {
      const slug = BROWSER_SLUG[value];
      const fallback = <Globe className="size-4 shrink-0 text-muted-foreground" />;
      return slug ? (
        <BrandImg src={simpleIcon(slug)} alt={value} fallback={fallback} />
      ) : (
        fallback
      );
    }
    case "os": {
      const slug = OS_SLUG[value];
      const fallback = <Monitor className="size-4 shrink-0 text-muted-foreground" />;
      return slug ? (
        <BrandImg src={simpleIcon(slug)} alt={value} fallback={fallback} />
      ) : (
        fallback
      );
    }
    case "source": {
      const fallback = <Globe className="size-4 shrink-0 text-muted-foreground" />;
      return value && value !== "(direct)" ? (
        <BrandImg src={favicon(value)} alt={value} fallback={fallback} />
      ) : (
        fallback
      );
    }
    case "utm_source":
      return <Tag className="size-4 shrink-0 text-muted-foreground" />;
    case "utm_medium":
      return <Share2 className="size-4 shrink-0 text-muted-foreground" />;
    case "utm_campaign":
      return <Megaphone className="size-4 shrink-0 text-muted-foreground" />;
    case "user":
      return <User className="size-4 shrink-0 text-muted-foreground" />;
    case "event":
      return <Zap className="size-4 shrink-0 text-muted-foreground" />;
    default:
      return <FileText className="size-4 shrink-0 text-muted-foreground" />;
  }
}
