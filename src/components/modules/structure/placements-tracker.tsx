"use client";

/**
 * Suivi des placements — l'activité d'édition du roster : qui a placé quoi, chez qui, où ça en est.
 *
 * Pensé pour 400 auteurs (Gaël, 28/10/2026) : un seul tableau, des vues écrites (nouveautés, en
 * cours, signées, sorties, à déclarer) avec leur compte, une recherche (œuvre, auteur, interprète),
 * l'année, un tri écrit. L'étape se change À LA MAIN, dans la ligne, avec le même sélecteur que le
 * fil entre services ; chaque changement est daté, signé, et peut prévenir le fil (Juridique à la
 * signature, Finance à la sortie et à la déclaration).
 */
import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Plus, Search, X } from "lucide-react";
import type { Artist } from "@/lib/demo/types";
import { fmtCompact, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fold } from "@/lib/demo/contract-view";
import type { JobRole } from "@/lib/roles";
import { addNote } from "@/lib/userdata/feed-store";
import {
  STAGES,
  addPlacement,
  isRecent,
  setPlacementStage,
  type PlacementEvent,
  type PlacementStage,
  type TrackedPlacement,
} from "@/lib/userdata/placements-store";
import { DEMO_TODAY } from "@/lib/demo/seed";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { Panel, Segmented } from "@/components/dashboard/panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

const STAGE_DOT: Record<PlacementStage, string> = {
  proposee: "bg-muted-foreground/50",
  discussion: "bg-brand",
  signee: "bg-warning",
  sortie: "bg-sky-500",
  declaree: "bg-success",
};

type View = "all" | "recent" | "progress" | "signee" | "released" | "todeclare";
const VIEWS: readonly View[] = ["all", "recent", "progress", "signee", "released", "todeclare"];

function inView(p: TrackedPlacement, v: View, now: Date): boolean {
  switch (v) {
    case "all":
      return true;
    case "recent":
      return isRecent(p, now);
    case "progress":
      return p.stage === "proposee" || p.stage === "discussion";
    case "signee":
      return p.stage === "signee";
    case "released":
      return p.stage === "sortie" || p.stage === "declaree";
    case "todeclare":
      return p.stage === "sortie";
  }
}

type SortKey = "changed" | "title" | "author" | "date";
const SORTS: readonly SortKey[] = ["changed", "title", "author", "date"];
const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

/** Qui prévenir dans le fil, selon l'étape atteinte. Rien pour une proposition ou une discussion. */
const NOTIFY: Partial<Record<PlacementStage, JobRole[]>> = {
  signee: ["juridique", "finance"],
  sortie: ["finance"],
  declaree: ["finance"],
};

export function StageSelect({
  stage,
  label,
  onChange,
}: {
  stage: PlacementStage;
  label: string;
  onChange: (s: PlacementStage) => void;
}) {
  const t = useTranslations("placements");
  return (
    <span className="has-[select:focus-visible]:ring-ring bg-background hover:border-foreground/25 text-foreground relative inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] font-medium whitespace-nowrap transition-colors has-[select:focus-visible]:ring-2">
      <span aria-hidden className={cn("size-2 rounded-full", STAGE_DOT[stage])} />
      <span aria-hidden>{t(`stages.${stage}`)}</span>
      <ChevronDown className="text-muted-foreground size-3" aria-hidden />
      <select
        aria-label={label}
        value={stage}
        onChange={(e) => onChange(e.target.value as PlacementStage)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {t(`stages.${s}`)}
          </option>
        ))}
      </select>
    </span>
  );
}

/** « aujourd'hui », « il y a 5 jours » ; au-delà d'un mois, le mois et l'année (« sept. 22 »). */
function ago(at: string, now: Date, t: ReturnType<typeof useTranslations>, locale: string) {
  const d = Math.floor((now.getTime() - Date.parse(at)) / 86_400_000);
  if (d <= 0) return t("tracker.today");
  if (d <= 30) return t("tracker.daysAgo", { days: d });
  return fmtDate(locale, at.slice(0, 10), { month: "short", year: "2-digit" });
}

export function PlacementsTracker({
  placements,
  artistOf,
  writers,
  showAuthor,
  actor,
  jobRole,
  footer,
}: {
  placements: readonly TrackedPlacement[];
  artistOf: (id: string) => Artist;
  /** Les auteurs qu'on peut choisir en ajoutant un placement (le périmètre du rôle). */
  writers: readonly Artist[];
  showAuthor: boolean;
  /** Qui agit, figé dans l'historique (« Finance », « DA · Inès M. »). */
  actor: string;
  jobRole: JobRole | null;
  footer?: ReactNode;
}) {
  const t = useTranslations("placements");
  const locale = useLocale();
  const ids = useId();
  const now = DEMO_TODAY;
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("changed");
  const [notify, setNotify] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const counts = useMemo(() => {
    const c = {} as Record<View, number>;
    for (const v of VIEWS) c[v] = placements.filter((p) => inView(p, v, now)).length;
    return c;
  }, [placements, now]);

  const years = useMemo(() => [...new Set(placements.map((p) => p.date.slice(0, 4)))].sort().reverse(), [placements]);

  const shown = useMemo(() => {
    const q = fold(query);
    const rows = placements.filter((p) => {
      if (!inView(p, view, now)) return false;
      if (year && p.date.slice(0, 4) !== year) return false;
      if (!q) return true;
      return [p.title, p.performer, artistOf(p.artistId).name].some((f) => fold(f).includes(q));
    });
    return [...rows].sort((a, b) => {
      switch (sort) {
        case "changed":
          return b.changedAt.localeCompare(a.changedAt);
        case "title":
          return collator.compare(a.title, b.title);
        case "author":
          return collator.compare(artistOf(a.artistId).name, artistOf(b.artistId).name) || collator.compare(a.title, b.title);
        case "date":
          return b.date.localeCompare(a.date);
      }
    });
  }, [placements, view, year, query, sort, artistOf, now]);

  const filtered = query.trim() !== "" || year !== "";

  const change = (p: TrackedPlacement, stage: PlacementStage) => {
    if (stage === p.stage) return;
    setPlacementStage(p.id, stage, actor);
    const to = NOTIFY[stage];
    if (notify && to) {
      addNote({
        from: jobRole ?? "direction",
        fromName: actor,
        to,
        artistId: p.artistId,
        urgency: stage === "sortie" ? "important" : "info",
        dueDate: null,
        text: t("tracker.note", { title: p.title, performer: p.performer, author: artistOf(p.artistId).name, stage: t(`stages.${stage}`) }),
        link: { kind: "page", href: "/placements" },
      });
      setFlash(t("tracker.notified", { services: to.map((r) => t(`tracker.services.${r}`)).join(", ") }));
    } else {
      setFlash(t("tracker.saved", { title: p.title, stage: t(`stages.${stage}`) }));
    }
  };

  return (
    <Panel
      title={t("tracker.title")}
      meta={t("tracker.count", { shown: shown.length, total: placements.length })}
      actions={
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          aria-expanded={adding}
          className="bg-foreground text-background hover:bg-foreground/90 focus-visible:ring-ring/50 inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium outline-none focus-visible:ring-2"
        >
          <Plus className="size-3.5" aria-hidden />
          {t("add.open")}
        </button>
      }
    >
      {adding && (
        <AddForm
          writers={writers}
          onCancel={() => setAdding(false)}
          onAdd={(input, stage) => {
            addPlacement(input, stage, actor);
            setAdding(false);
            setView("all");
            setSort("changed");
            setFlash(t("add.done", { title: input.title }));
          }}
        />
      )}

      {/* Vues */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:px-5">
        <Segmented
          label={t("views.label")}
          value={view}
          options={VIEWS.map((v) => ({ value: v, label: t(`views.${v}`), count: counts[v] }))}
          onChange={setView}
        />
      </div>

      {/* Recherche, année, tri, fil */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:px-5">
        <label htmlFor={`${ids}-q`} className="sr-only">
          {t("tracker.searchLabel")}
        </label>
        <div className="relative min-w-[13rem] flex-1 sm:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
          <input
            id={`${ids}-q`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("tracker.search")}
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-md border pr-2.5 pl-8 text-[13px] outline-none focus-visible:ring-2"
          />
        </div>
        <label className="text-muted-foreground inline-flex items-center gap-2 text-[12.5px]">
          {t("tracker.year")}
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="border-input bg-background text-foreground focus-visible:ring-ring/50 h-8 rounded-md border px-2 text-[13px] outline-none focus-visible:ring-2"
          >
            <option value="">{t("tracker.allYears")}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setYear("");
            }}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px]"
          >
            <X className="size-3.5" aria-hidden />
            {t("tracker.reset")}
          </button>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-3">
          <Segmented
            label={t("tracker.sortLabel")}
            value={sort}
            options={SORTS.filter((s) => showAuthor || s !== "author").map((s) => ({ value: s, label: t(`tracker.sort.${s}`) }))}
            onChange={setSort}
          />
          <label className="text-muted-foreground inline-flex cursor-pointer items-center gap-1.5 text-[12.5px]">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-foreground size-3.5" />
            {t("tracker.notify")}
          </label>
        </span>
      </div>

      {flash && (
        <p role="status" className="bg-muted/40 text-foreground/80 flex items-center justify-between gap-3 border-b px-4 py-2 text-[12.5px] sm:px-5">
          {flash}
          <button type="button" onClick={() => setFlash(null)} className="text-muted-foreground hover:text-foreground" aria-label={t("tracker.dismiss")}>
            <X className="size-3.5" aria-hidden />
          </button>
        </p>
      )}

      {shown.length === 0 ? (
        <p className="text-muted-foreground px-5 py-6 text-[13px]">{placements.length === 0 ? t("tracker.none") : t("tracker.noMatch")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-[13px]">
            <caption className="sr-only">{t("tracker.title")}</caption>
            <thead className="text-muted-foreground border-b text-[12px] whitespace-nowrap">
              <tr className="text-left">
                <th scope="col" className="h-9 pr-2 pl-4 font-medium sm:pl-5">{t("tracker.cols.work")}</th>
                {showAuthor && <th scope="col" className="h-9 px-2 font-medium">{t("tracker.cols.author")}</th>}
                <th scope="col" className="h-9 px-2 font-medium">{t("tracker.cols.performer")}</th>
                <th scope="col" className="h-9 px-2 font-medium">{t("tracker.cols.stage")}</th>
                <th scope="col" className="h-9 px-2 font-medium">{t("tracker.cols.changed")}</th>
                <th scope="col" className="h-9 px-2 text-right font-medium">{t("tracker.cols.date")}</th>
                <th scope="col" className="h-9 px-2 text-right font-medium">{t("tracker.cols.share")}</th>
                <th scope="col" className="h-9 px-2 text-right font-medium">{t("tracker.cols.streams")}</th>
                <th scope="col" className="h-9 pr-4 pl-2 text-right font-medium sm:pr-5">{t("tracker.cols.sacem")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const released = p.stage === "sortie" || p.stage === "declaree";
                return (
                  <tr key={p.id} className="hover:bg-muted/40 border-b transition-colors last:border-b-0">
                    <td className="max-w-[16rem] py-2 pr-2 pl-4 sm:pl-5">
                      <span className="inline-flex max-w-full items-center gap-1.5">
                        <span className="truncate font-medium">{p.title}</span>
                        {p.simulated && !released && <ProvenanceBadge provenance="simulated" className="shrink-0" />}
                        {p.added && <ProvenanceBadge provenance="declared" className="shrink-0" />}
                      </span>
                    </td>
                    {showAuthor && (
                      <td className="max-w-[11rem] px-2 py-2">
                        <ArtistBadge artist={artistOf(p.artistId)} size="sm" />
                      </td>
                    )}
                    <td className="text-muted-foreground max-w-[11rem] truncate px-2 py-2">{p.performer}</td>
                    <td className="px-2 py-2">
                      <StageSelect stage={p.stage} label={t("tracker.stageOf", { title: p.title })} onChange={(s) => change(p, s)} />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className="block text-[12.5px]">{ago(p.changedAt, now, t, locale)}</span>
                      <span className="text-muted-foreground block text-[11.5px]">{p.changedBy ?? t("tracker.byDemo")}</span>
                    </td>
                    <td className="num px-2 py-2 text-right whitespace-nowrap">
                      {fmtDate(locale, p.date, { day: "numeric", month: "short", year: "2-digit" })}
                    </td>
                    <td className="num px-2 py-2 text-right whitespace-nowrap">{p.writerSharePct} %</td>
                    <td className="num px-2 py-2 text-right">{p.streams > 0 ? fmtCompact(locale, p.streams) : "—"}</td>
                    <td className="py-2 pr-4 pl-2 text-right whitespace-nowrap sm:pr-5">
                      {!released ? (
                        <span className="text-muted-foreground">{p.declared ? t("tracker.deposited") : "—"}</span>
                      ) : p.declared ? (
                        <span className="text-success">{t("table.yes")}</span>
                      ) : (
                        <span className="text-warning font-medium">{t("tracker.toDeclare")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {footer && <div className="text-muted-foreground border-t px-4 py-2.5 text-[11.5px] leading-relaxed sm:px-5">{footer}</div>}
    </Panel>
  );
}

function AddForm({
  writers,
  onAdd,
  onCancel,
}: {
  writers: readonly Artist[];
  onAdd: (input: { artistId: string; title: string; performer: string; date: string; writerSharePct: number }, stage: PlacementStage) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("placements");
  const ids = useId();
  const [title, setTitle] = useState("");
  const [performer, setPerformer] = useState("");
  const [artistId, setArtistId] = useState(writers[0]?.id ?? "");
  const [stage, setStage] = useState<PlacementStage>("proposee");
  const [date, setDate] = useState(DEMO_TODAY.toISOString().slice(0, 10));
  const [share, setShare] = useState("25");
  const ok = title.trim() !== "" && performer.trim() !== "" && artistId !== "" && /^\d{4}-\d{2}-\d{2}$/.test(date);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    const pct = Number(share.replace(",", "."));
    onAdd({ artistId, title, performer, date, writerSharePct: Number.isFinite(pct) ? pct : 0 }, stage);
  };

  const field = "border-input bg-background focus-visible:ring-ring/50 h-8 w-full rounded-md border px-2.5 text-[13px] outline-none focus-visible:ring-2";
  return (
    <form onSubmit={submit} className="bg-muted/30 grid gap-3 border-b px-4 py-3 sm:grid-cols-2 sm:px-5 lg:grid-cols-[1.4fr_1fr_1fr_0.9fr_0.9fr_0.6fr_auto] lg:items-end">
      <label className="text-muted-foreground grid gap-1 text-[12px]">
        {t("add.title")}
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} required />
      </label>
      <label className="text-muted-foreground grid gap-1 text-[12px]">
        {t("add.author")}
        <select value={artistId} onChange={(e) => setArtistId(e.target.value)} className={field}>
          {writers.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-muted-foreground grid gap-1 text-[12px]">
        {t("add.performer")}
        <input value={performer} onChange={(e) => setPerformer(e.target.value)} className={field} required />
      </label>
      <label className="text-muted-foreground grid gap-1 text-[12px]">
        {t("add.stage")}
        <select value={stage} onChange={(e) => setStage(e.target.value as PlacementStage)} className={field}>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {t(`stages.${s}`)}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`${ids}-d`} className="text-muted-foreground grid gap-1 text-[12px]">
        {t("add.date")}
        <input id={`${ids}-d`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
      </label>
      <label className="text-muted-foreground grid gap-1 text-[12px]">
        {t("add.share")}
        <input value={share} onChange={(e) => setShare(e.target.value)} inputMode="decimal" className={field} />
      </label>
      <span className="flex gap-2">
        <button type="submit" disabled={!ok} className="bg-foreground text-background hover:bg-foreground/90 h-8 rounded-md px-3 text-[12.5px] font-medium disabled:opacity-40">
          {t("add.submit")}
        </button>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground h-8 rounded-md px-2 text-[12.5px]">
          {t("add.cancel")}
        </button>
      </span>
    </form>
  );
}

/** Qui a placé quoi, quand : les derniers changements d'étape, le plus récent en tête. */
export function PlacementsActivity({
  events,
  byId,
  artistOf,
  limit = 12,
}: {
  events: readonly PlacementEvent[];
  byId: ReadonlyMap<string, TrackedPlacement>;
  artistOf: (id: string) => Artist;
  limit?: number;
}) {
  const t = useTranslations("placements");
  const locale = useLocale();
  const list = events.filter((e) => byId.has(e.placementId)).slice(0, limit);
  return (
    <Panel title={t("activity.title")} meta={t("activity.meta", { count: list.length })}>
      {list.length === 0 ? (
        <p className="text-muted-foreground px-5 py-4 text-[13px]">{t("activity.none")}</p>
      ) : (
        <ol>
          {list.map((e) => {
            const p = byId.get(e.placementId)!;
            return (
              <li key={e.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 border-b px-4 py-2.5 text-[13px] last:border-b-0 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:px-5">
                <span className="num text-muted-foreground text-[12.5px] whitespace-nowrap">
                  {fmtDate(locale, e.at.slice(0, 10), { day: "numeric", month: "short", year: "2-digit" })}
                </span>
                <span className="min-w-0">
                  <b className="font-medium">{p.title}</b>
                  <span className="text-muted-foreground"> · {p.performer} · </span>
                  <span className="inline-flex items-center gap-1.5 align-middle">
                    <span aria-hidden className={cn("size-2 rounded-full", STAGE_DOT[e.stage])} />
                    {t(`stages.${e.stage}`)}
                  </span>
                  <span className="text-muted-foreground"> · {artistOf(p.artistId).name}</span>
                </span>
                <span className="text-muted-foreground col-start-2 text-[12px] sm:col-start-auto sm:text-right">
                  {e.by ?? t("tracker.byDemo")}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
