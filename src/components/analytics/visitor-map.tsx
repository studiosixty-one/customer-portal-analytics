"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { liveLocations } from "@/lib/sites/actions";
import type { LiveLocation } from "@/lib/analytics/queries";
import type { Filters } from "@/lib/analytics/filters";

type View = { scale: number; tx: number; ty: number };
const MAX_SCALE = 8;

function clampView(v: View, w: number, h: number): View {
  const scale = Math.min(MAX_SCALE, Math.max(1, v.scale));
  return {
    scale,
    tx: Math.min(0, Math.max(w - w * scale, v.tx)),
    ty: Math.min(0, Math.max(h - h * scale, v.ty)),
  };
}

export function VisitorMap({
  siteId,
  filters,
}: {
  siteId: string;
  filters: Filters;
}) {
  const [dots, setDots] = useState<number[][]>([]);
  const [locations, setLocations] = useState<LiveLocation[]>([]);
  const lastSig = useRef("");
  const filtersKey = JSON.stringify(filters);

  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  );

  // Land-dot grid + live locations.
  useEffect(() => {
    let a = true;
    fetch("/world-dots.json")
      .then((r) => r.json())
      .then((d: number[][]) => a && setDots(d))
      .catch(() => {});
    return () => {
      a = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await liveLocations(siteId, JSON.parse(filtersKey));
        const sig = JSON.stringify(data);
        if (active && sig !== lastSig.current) {
          lastSig.current = sig;
          setLocations(data);
        }
      } catch {
        /* keep last good data */
      }
    };
    load();
    const t = setInterval(load, 20000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [siteId, filtersKey]);

  function zoomBy(factor: number) {
    const vp = viewportRef.current;
    if (!vp) return;
    const cx = vp.clientWidth / 2;
    const cy = vp.clientHeight / 2;
    setView((v) => {
      const s = Math.min(MAX_SCALE, Math.max(1, v.scale * factor));
      const k = s / v.scale;
      return clampView(
        { scale: s, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k },
        vp.clientWidth,
        vp.clientHeight,
      );
    });
  }

  // Static land layer — memoized so panning/zooming only moves the parent.
  const landLayer = useMemo(
    () => (
      <svg
        viewBox="0 0 360 180"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {dots.map(([lng, lat], i) => (
          <circle
            key={i}
            cx={lng + 180}
            cy={90 - lat}
            r={0.6}
            className="fill-muted-foreground/30"
          />
        ))}
      </svg>
    ),
    [dots],
  );

  const max = Math.max(1, ...locations.map((l) => l.visitors));
  const total = locations.reduce((s, l) => s + l.visitors, 0);
  const { scale, tx, ty } = view;

  return (
    <div>
      <div
        ref={viewportRef}
        className="relative w-full touch-none overflow-hidden"
        style={{ aspectRatio: "2 / 1", cursor: "grab" }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, tx, ty };
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* setPointerCapture can throw on some browsers; pan still works */
          }
          e.currentTarget.style.cursor = "grabbing";
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          const vp = viewportRef.current;
          if (!d || !vp) return;
          // Capture everything into locals so the setView updater never
          // dereferences the (possibly-cleared) drag ref.
          const nextTx = d.tx + (e.clientX - d.x);
          const nextTy = d.ty + (e.clientY - d.y);
          const w = vp.clientWidth;
          const h = vp.clientHeight;
          setView((v) => clampView({ ...v, tx: nextTx, ty: nextTy }, w, h));
        }}
        onPointerUp={(e) => {
          drag.current = null;
          e.currentTarget.style.cursor = "grab";
        }}
        onPointerLeave={(e) => {
          drag.current = null;
          e.currentTarget.style.cursor = "grab";
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          {landLayer}
          {locations.map((l, i) => {
            const x = ((l.lng + 180) / 360) * 100;
            const y = ((90 - l.lat) / 180) * 100;
            const core = 7 + (l.visitors / max) * 9;
            const ring = core * 2.6;
            return (
              <div
                key={`${l.lat},${l.lng},${i}`}
                className="absolute"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  // Counter-scale so pings stay a constant size while zooming.
                  transform: `translate(-50%, -50%) scale(${1 / scale})`,
                }}
                title={`${l.label} · ${l.visitors.toLocaleString()} visitor${l.visitors === 1 ? "" : "s"}`}
              >
                <span
                  className="absolute -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-emerald-500/30"
                  style={{ width: ring, height: ring }}
                />
                <span
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500"
                  style={{
                    width: core,
                    height: core,
                    boxShadow: "0 0 6px 1px rgba(16,185,129,0.7)",
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Zoom controls */}
        <div
          className="absolute right-2 top-2 flex flex-col gap-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => zoomBy(1.4)}
            className="flex size-7 items-center justify-center rounded-md border bg-background/80 backdrop-blur transition-colors hover:bg-muted"
            aria-label="Zoom in"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.4)}
            className="flex size-7 items-center justify-center rounded-md border bg-background/80 backdrop-blur transition-colors hover:bg-muted"
            aria-label="Zoom out"
          >
            <Minus className="size-4" />
          </button>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        {total > 0
          ? `${total.toLocaleString()} visitor${total === 1 ? "" : "s"} from ${locations.length} location${locations.length === 1 ? "" : "s"} (last 24h) · drag to pan, +/− to zoom`
          : "Waiting for visitors…"}
      </p>
    </div>
  );
}
