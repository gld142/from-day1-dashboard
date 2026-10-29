"use client";

/**
 * Répartition SACEM d'un auteur-compositeur, source par source, recopiée de son relevé.
 *
 * Sans relevé : on dit pourquoi le chiffre du dashboard est partiel (un compositeur à l'image vit
 * de la diffusion, que les streams ne mesurent pas) et on propose la saisie. Avec relevé : le total
 * « renseigné », la répartition par source et la part que le streaming y pèse. Rien d'inventé.
 */
import { useId, useMemo, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import type { Artist } from "@/lib/demo/types";
import { fmtEur } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SACEM_SOURCES, getSacem, parseAmount, sacemTotal, saveSacem, type SacemSource } from "@/lib/userdata/sacem-store";
import { useSacemSnapshot } from "@/lib/userdata/use-sacem";
import { Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

/** Même roue que le Marché : une teinte par source, luminosité égale. */
const SOURCE_COLOR: Record<SacemSource, string> = {
  tv: "oklch(0.63 0.13 250)",
  radio: "oklch(0.66 0.11 200)",
  cinema: "oklch(0.64 0.13 300)",
  pub: "oklch(0.71 0.13 62)",
  streaming: "oklch(0.68 0.12 158)",
  live: "oklch(0.66 0.14 28)",
  etranger: "oklch(0.74 0.12 100)",
};

export function SacemPanel({ artist, actor, streamingEstimate }: { artist: Pick<Artist, "id" | "name">; actor: string; streamingEstimate: number }) {
  const t = useTranslations("placements");
  const locale = useLocale();
  const key = useSacemSnapshot();
  const entry = useMemo(() => {
    void key;
    return getSacem(artist.id);
  }, [artist.id, key]);
  const [editing, setEditing] = useState(false);
  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });

  if (editing || !entry) {
    return (
      <Sheet family="money">
        <SheetHeading action={t("sacem.caption")}>{t("sacem.title")}</SheetHeading>
        {!entry && !editing && (
          <>
            <p className="sheet-ink mt-1 max-w-[70ch] text-[13px] leading-relaxed">
              {t("sacem.why", { name: artist.name, amount: eur(streamingEstimate) })}
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="bg-foreground text-background hover:bg-foreground/90 mt-3 inline-flex h-8 items-center rounded-md px-3 text-[12.5px] font-medium"
            >
              {t("sacem.enter")}
            </button>
          </>
        )}
        {editing && <SacemForm artistId={artist.id} actor={actor} initial={entry} onDone={() => setEditing(false)} />}
      </Sheet>
    );
  }

  const total = sacemTotal(entry);
  const parts = SACEM_SOURCES.map((s) => ({ s, v: entry.bySource[s] })).filter((x) => x.v > 0);
  const streamingShare = total > 0 ? entry.bySource.streaming / total : 0;
  return (
    <Sheet family="money">
      <SheetHeading action={t("sacem.captionYear", { year: entry.year })}>{t("sacem.title")}</SheetHeading>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{eur(total)}</p>
        <ProvenanceBadge provenance="declared" className="align-middle" />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="sheet-ink hover:text-foreground ml-auto inline-flex items-center gap-1 text-[12.5px] font-medium"
        >
          <Pencil className="size-3.5" aria-hidden />
          {t("sacem.edit")}
        </button>
      </div>
      <p className="sheet-ink mt-1.5 text-[13px]">
        {t("sacem.sub", { pct: Math.round(streamingShare * 100), by: entry.by ?? "—" })}
      </p>
      <div className="mt-3 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden>
        {parts.map(({ s, v }) => (
          <span key={s} style={{ width: `${(v / total) * 100}%`, background: SOURCE_COLOR[s] }} />
        ))}
      </div>
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
        {parts.map(({ s, v }) => (
          <li key={s} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: SOURCE_COLOR[s] }} />
            <span className="font-medium">{t(`sacem.sources.${s}`)}</span>
            <span className="sheet-ink num ml-auto">
              {eur(v)} · {Math.round((v / total) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function SacemForm({
  artistId,
  actor,
  initial,
  onDone,
}: {
  artistId: string;
  actor: string;
  initial: ReturnType<typeof getSacem>;
  onDone: () => void;
}) {
  const t = useTranslations("placements");
  const ids = useId();
  const [year, setYear] = useState(String(initial?.year ?? 2025));
  const [values, setValues] = useState<Record<SacemSource, string>>(
    () => Object.fromEntries(SACEM_SOURCES.map((s) => [s, initial?.bySource[s] ? String(initial.bySource[s]) : ""])) as Record<SacemSource, string>,
  );
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) return setError(t("sacem.errYear"));
    const bySource = {} as Record<SacemSource, number>;
    for (const s of SACEM_SOURCES) {
      const n = parseAmount(values[s]);
      if (n === null) return setError(t("sacem.errAmount", { source: t(`sacem.sources.${s}`) }));
      bySource[s] = n;
    }
    if (sacemTotal({ bySource }) <= 0) return setError(t("sacem.errEmpty"));
    saveSacem({ artistId, year: y, bySource, by: actor });
    onDone();
  };

  const field = "border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-md border px-2.5 text-[13px] tabular-nums outline-none focus-visible:ring-2";
  return (
    <form onSubmit={submit} className="mt-2 space-y-3" noValidate>
      <p className="sheet-ink text-[12.5px]">{t("sacem.formHint")}</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <label htmlFor={`${ids}-y`} className="sheet-ink grid gap-1 text-[12px]">
          {t("sacem.year")}
          <input id={`${ids}-y`} value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" className={field} />
        </label>
        {SACEM_SOURCES.map((s) => (
          <label key={s} className="sheet-ink grid gap-1 text-[12px]">
            {t(`sacem.sources.${s}`)}
            <input
              value={values[s]}
              onChange={(e) => {
                setError(null);
                setValues((v) => ({ ...v, [s]: e.target.value }));
              }}
              inputMode="decimal"
              placeholder="0 €"
              className={cn(field)}
            />
          </label>
        ))}
      </div>
      {error && <p className="text-destructive text-[12.5px]">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="bg-foreground text-background hover:bg-foreground/90 h-8 rounded-md px-3 text-[12.5px] font-medium">
          {t("sacem.save")}
        </button>
        <button type="button" onClick={onDone} className="sheet-ink hover:text-foreground h-8 rounded-md px-2 text-[12.5px]">
          {t("sacem.cancel")}
        </button>
      </div>
    </form>
  );
}
