"use client";

import { useState, type ReactNode } from "react";

/**
 * Renders a remote logo (brand icon / favicon) and falls back to a local icon
 * if it fails to load — so a missing/blocked image never leaves a broken glyph.
 */
export function BrandImg({
  src,
  alt,
  fallback,
}: {
  src: string;
  alt: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={16}
      height={16}
      loading="lazy"
      className="size-4 shrink-0 rounded-[3px]"
      onError={() => setFailed(true)}
    />
  );
}
