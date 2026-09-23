"use client";

/**
 * Carte monde choroplèthe — streams par territoire.
 * Topojson world-atlas chargé dynamiquement (skeleton pendant le fetch),
 * intensité de couleur pilotée par une échelle d3 scaleLinear qui mélange
 * var(--surface-2) → var(--chart-1) via color-mix (tokens sémantiques only).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { scaleLinear } from "d3-scale";
import {
  ComposableMap,
  Geographies,
  Geography,
  createCoordinates,
} from "@vnedyalk0v/react19-simple-maps";
import type { Topology } from "topojson-specification";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtCompact, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CountryStreams } from "@/lib/demo/types";

/** ISO-3166 alpha-3 → id numérique des features world-atlas (countries-110m). */
const ISO3_TO_NUMERIC: Record<string, string> = {
  FRA: "250",
  BEL: "056",
  CHE: "756",
  CAN: "124",
  USA: "840",
  DEU: "276",
  GBR: "826",
  MAR: "504",
  SEN: "686",
  CIV: "384",
  ESP: "724",
  ITA: "380",
  NLD: "528",
  BRA: "076",
  JPN: "392",
  MEX: "484",
};

const ANTARCTICA_ID = "010";

/* Teintes empruntées à la feuille hôte (sheet-*), avec repli hors feuille. */
const RAMP = "var(--sheet-line, var(--chart-1))";
const BASE = "var(--sheet-paper, var(--surface-1))";
/** Pays sans données : visible, mais nettement en retrait de la rampe. */
const IDLE = "color-mix(in oklch, var(--sheet-ink, var(--muted-foreground)) 19%, var(--sheet-paper, var(--surface-2)))";
/** Le trait qui sépare deux pays : la surface elle-même, comme un spacer. */
const SEAM = "var(--sheet-paper, var(--background))";

type Tip = {
  x: number;
  y: number;
  name: string;
  streams: number;
  share: number;
};

function normalizeId(id: unknown): string {
  return String(id ?? "").padStart(3, "0");
}

export function WorldMap({
  data,
  className,
}: {
  data: CountryStreams[];
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("streams");
  const containerRef = useRef<HTMLDivElement>(null);
  const [topo, setTopo] = useState<Topology | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    let alive = true;
    import("world-atlas/countries-110m.json")
      .then((mod) => {
        if (alive) setTopo(mod.default as unknown as Topology);
      })
      .catch(() => {
        /* la carte reste en skeleton — la liste des pays couvre l'info */
      });
    return () => {
      alive = false;
    };
  }, []);

  const byNumericId = useMemo(() => {
    const m = new Map<string, CountryStreams>();
    for (const c of data) {
      const id = ISO3_TO_NUMERIC[c.iso3];
      if (id) m.set(id, c);
    }
    return m;
  }, [data]);

  const total = useMemo(() => data.reduce((s, c) => s + c.streams, 0), [data]);

  /** % de mélange chart-1 dans surface-2 : 10 % (traces) → 100 % (max). */
  const mixPct = useMemo(() => {
    const max = Math.max(1, ...data.map((c) => c.streams));
    return scaleLinear().domain([0, max]).range([10, 100]);
  }, [data]);

  const localPoint = (e: React.MouseEvent<SVGPathElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  if (!topo) {
    return (
      <div className={cn("relative w-full", className)}>
        <Skeleton className="aspect-[880/400] w-full rounded-lg" />
        <span className="sr-only">{t("map.loading")}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <ComposableMap
        width={880}
        height={400}
        projection="geoEqualEarth"
        projectionConfig={{ scale: 152, center: createCoordinates(10, 10) }}
        style={{ width: "100%", height: "auto" }}
        role="img"
        aria-label={t("map.title")}
      >
        <Geographies
          geography={topo}
          parseGeographies={(geos) =>
            geos.filter((g) => normalizeId(g.id) !== ANTARCTICA_ID)
          }
        >
          {({ geographies }) =>
            geographies.map((geo, i) => {
              const id = normalizeId(geo.id);
              const country = byNumericId.get(id);
              const pct = country ? Math.round(mixPct(country.streams)) : 0;
              /* Rampe séquentielle d'une seule teinte — celle de la feuille
                 quand la carte y vit, sinon la teinte de graphique par défaut.
                 Les pays sans données prennent un ton *de la feuille* : sur un
                 fond teinté, --surface-2 les rendait indistincts du décor. */
              const fill = country
                ? `color-mix(in oklch, ${RAMP} ${pct}%, ${BASE})`
                : IDLE;
              const hoverFill = country
                ? `color-mix(in oklch, ${RAMP} ${Math.min(100, pct + 16)}%, ${BASE})`
                : IDLE;
              return (
                <Geography
                  key={`geo-${i}-${id ?? "x"}`}
                  geography={geo}
                  onMouseEnter={(e) => {
                    if (!country) return;
                    const { x, y } = localPoint(e);
                    setTip({
                      x,
                      y,
                      name: locale === "fr" ? country.nameFr : country.nameEn,
                      streams: country.streams,
                      share: total > 0 ? (country.streams / total) * 100 : 0,
                    });
                  }}
                  onMouseMove={(e) => {
                    const { x, y } = localPoint(e);
                    setTip((prev) => (prev ? { ...prev, x, y } : prev));
                  }}
                  onMouseLeave={() => setTip(null)}
                  style={{
                    default: {
                      fill,
                      stroke: SEAM,
                      strokeWidth: 0.7,
                      outline: "none",
                      transition: "fill 150ms ease",
                    },
                    hover: {
                      fill: hoverFill,
                      stroke: SEAM,
                      strokeWidth: 0.7,
                      outline: "none",
                      cursor: country ? "pointer" : "default",
                    },
                    pressed: {
                      fill: hoverFill,
                      stroke: SEAM,
                      strokeWidth: 0.7,
                      outline: "none",
                    },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[10.5px]">
        <span className="sheet-ink opacity-80">{t("map.less")}</span>
        {[18, 42, 66, 90].map((step) => (
          <span
            key={step}
            aria-hidden
            className="size-2.5 rounded-[3px]"
            style={{ background: `color-mix(in oklch, ${RAMP} ${step}%, ${BASE})` }}
          />
        ))}
        <span className="sheet-ink opacity-80">{t("map.more")}</span>
      </div>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-[10px] border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: tip.x, top: tip.y - 12, transform: "translate(-50%, -100%)" }}
        >
          <div className="font-medium text-popover-foreground">{tip.name}</div>
          <div className="num mt-0.5 text-muted-foreground">
            {fmtCompact(locale, tip.streams)} {t("map.streamsLabel")}
            <span className="mx-1 opacity-50">·</span>
            {fmtPct(locale, tip.share).replace("+", "")} {t("map.ofTotal")}
          </div>
        </div>
      )}
    </div>
  );
}
