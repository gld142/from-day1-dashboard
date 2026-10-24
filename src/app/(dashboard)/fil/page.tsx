"use client";

/**
 * /fil — le fil entre services (spec Universal v2, §5). Liste triée urgence puis
 * échéance ; filtres « à traiter pour moi / tout / par artiste » ; nouvelle note ;
 * « Traité ». Démo : localStorage (feed-store). Sans rôle choisi (maison day1),
 * tout est « pour moi » et l'auteur est « Structure ».
 *
 * Réservé à la persona structure (nav.ts + garde `LabelGuard`, comme /roster) : les
 * notes parlent d'autres artistes qu'un artiste solo n'a pas à lire, même en tapant l'URL.
 */
import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Plus } from "lucide-react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { LabelGuard } from "@/components/modules/structure/label-guard";
import { Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ARTISTS, getArtist, getDa } from "@/lib/demo/data";
import { fmtDate } from "@/lib/format";
import { JOB_ROLES, type JobRole } from "@/lib/roles";
import { FEED_TEXT_MAX, URGENCIES, sortNotes, type Urgency } from "@/lib/userdata/feed-store";
import { useRole } from "@/lib/role";
import { useFeed } from "@/lib/userdata/use-feed";
import { cn } from "@/lib/utils";

const URGENCY_TONE: Record<Urgency, string> = {
  urgent: "border-transparent bg-destructive/10 text-destructive",
  important: "border-transparent bg-warning/10 text-warning",
  info: "border-transparent bg-muted text-muted-foreground",
};

export default function FeedPage() {
  // `useSearchParams` dans un composant client : frontière Suspense obligatoire (docs Next 16).
  return (
    <Suspense fallback={null}>
      <Feed />
    </Suspense>
  );
}

function Feed() {
  const t = useTranslations("fil");
  const locale = useLocale();
  const params = useSearchParams();
  const { notes, forMe, add, done, jobRole, daId } = useFeed();
  const { isLabel, setPersona } = useRole();

  /* Arrivée depuis le roster (`?artist=`) : le compteur Notes du roster compte TOUTES les
     notes ouvertes de l'artiste, donc on ouvre en « Tout » (sinon la liste filtrée par rôle
     est souvent vide). Seul l'état initial change : changer d'artiste ensuite garde le mode. */
  const [mode, setMode] = useState<"mine" | "all">(() => (params.get("artist") ? "all" : "mine"));
  /* Le filtre artiste vient de l'URL (`?artist=`) : partageable, et la colonne
     Notes du roster arrive déjà filtrée. Un id inconnu de la maison = pas de filtre. */
  const artistParam = params.get("artist");
  const artistFilter = artistParam && ARTISTS.some((a) => a.id === artistParam) ? artistParam : null;
  /* Écriture de l'URL sans aller-retour serveur — même motif que /roster : `replaceState`
     s'intègre au routeur Next 16 et `useSearchParams` ci-dessus relit la valeur. */
  const setArtistFilter = useCallback((id: string | null) => {
    window.history.replaceState(null, "", id ? `/fil?artist=${encodeURIComponent(id)}` : "/fil");
  }, []);

  /* Listes que chaque mode affichera, filtre artiste appliqué : les compteurs des pastilles
     sont exactement ces longueurs (« Tout » inclut les notes traitées, comme la liste). */
  const lists = useMemo(() => {
    const byArtist = (l: typeof notes) => (artistFilter ? l.filter((n) => n.artistId === artistFilter) : l);
    return { mine: byArtist(forMe), all: byArtist(notes) };
  }, [forMe, notes, artistFilter]);
  const shown = useMemo(() => sortNotes(lists[mode]), [lists, mode]);

  const roleName = (r: JobRole) => t(`roles.${r}`);
  const toLabel = (to: JobRole[]) => (to.length === JOB_ROLES.length ? t("note.everyone") : to.map(roleName).join(", "));

  /* Garde persona APRÈS tous les hooks (ordre constant), comme /roster et /ar-watch. */
  if (!isLabel) {
    return (
      <LabelGuard
        title={t("guard.title")}
        description={t("guard.description")}
        cta={t("guard.cta")}
        onSwitch={() => setPersona("label")}
      />
    );
  }

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        <NewNoteDialog onSubmit={add} jobRole={jobRole} daId={daId} />
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
        <div className="flex items-center gap-1.5" role="group" aria-label={t("filters.modeLabel")}>
          {(["mine", "all"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full border px-2.5 py-1 transition-colors",
                mode === m ? "border-brand bg-brand/10 text-brand" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`filters.${m}`)}{" "}
              <span className="num opacity-70">{lists[m].length}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">{t("filters.artist")}</span>
          <select
            value={artistFilter ?? ""}
            onChange={(e) => setArtistFilter(e.target.value || null)}
            className="h-8 rounded-lg border bg-background px-2 text-[12px]"
          >
            <option value="">{t("filters.anyArtist")}</option>
            {ARTISTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Sheet family="catalog">
        <SheetHeading action={t("filters.count", { count: shown.length })}>
          {mode === "mine" ? t("filters.mine") : t("filters.all")}
        </SheetHeading>
        {shown.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" aria-hidden />
            {t(mode === "mine" ? "empty.mine" : "empty.all")}
          </p>
        ) : (
          <ul className="mt-2 divide-y">
            {shown.map((n) => (
              <li key={n.id} className={cn("flex flex-wrap items-start gap-3 py-3", n.status === "done" && "opacity-60")}>
                <Badge className={URGENCY_TONE[n.urgency]}>{t(`urgency.${n.urgency}`)}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">{n.text}</p>
                  <p className="sheet-ink mt-1 flex flex-wrap gap-x-3 text-[11px]">
                    <span>{t("note.from", { from: n.fromName, to: toLabel(n.to) })}</span>
                    <span>{fmtDate(locale, n.createdAt.slice(0, 10), { day: "numeric", month: "short" })}</span>
                    {n.dueDate && (
                      <span className={n.urgency === "urgent" ? "text-destructive" : undefined}>
                        {t("note.due", { date: fmtDate(locale, n.dueDate, { day: "numeric", month: "long" }) })}
                      </span>
                    )}
                    {n.doneAt && (
                      <span>{t("note.done", { date: fmtDate(locale, n.doneAt.slice(0, 10), { day: "numeric", month: "short" }) })}</span>
                    )}
                  </p>
                </div>
                {n.artistId ? (
                  <Link href={`/fil?artist=${encodeURIComponent(n.artistId)}`} className="shrink-0">
                    <ArtistBadge artist={getArtist(n.artistId)} size="sm" />
                  </Link>
                ) : (
                  <span className="shrink-0 text-[11px] text-muted-foreground">{t("note.noArtist")}</span>
                )}
                {n.status === "open" && (
                  <Button size="sm" variant="outline" onClick={() => done(n.id)}>
                    {t("note.markDone")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}

function NewNoteDialog({
  onSubmit,
  jobRole,
  daId,
}: {
  onSubmit: ReturnType<typeof useFeed>["add"];
  jobRole: JobRole | null;
  daId: string | null;
}) {
  const t = useTranslations("fil");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [artistId, setArtistId] = useState<string>("");
  const [to, setTo] = useState<JobRole[]>([]);
  const [urgency, setUrgency] = useState<Urgency>("info");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  /* Auteur : le libellé du rôle seul (« Finance »), « DA · <nom du DA> » pour un DA, ou
     « Structure » sans rôle. Pas de « · moi » : la note est relue plus tard par d'autres rôles.
     `fromName` est un texte d'affichage figé dans la langue de création (démo). */
  const daName = jobRole === "da" && daId ? (getDa(daId)?.name ?? null) : null;
  const fromName = jobRole
    ? daName
      ? `${t("roles.da")} · ${daName}`
      : t(`roles.${jobRole}`)
    : t("author.structure");
  const artistsForMe = jobRole === "da" && daId ? ARTISTS.filter((a) => a.daId === daId) : ARTISTS;

  const reset = () => {
    setText("");
    setArtistId("");
    setTo([]);
    setUrgency("info");
    setDueDate("");
    setError(null);
  };
  const submit = () => {
    if (!text.trim()) return setError(t("new.needText"));
    if (to.length === 0) return setError(t("new.needTo"));
    onSubmit({ from: jobRole ?? "direction", fromName, to, artistId: artistId || null, urgency, dueDate: dueDate || null, text });
    reset();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" aria-hidden />
          {t("new.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("new.title")}</DialogTitle>
          <DialogDescription>{t("new.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="fil-text">{t("new.text")}</Label>
            <Textarea
              id="fil-text"
              value={text}
              maxLength={FEED_TEXT_MAX}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="mt-1"
            />
            <p className="num mt-1 text-right text-[11px] text-muted-foreground">{t("new.textHint", { count: text.length })}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="fil-artist">{t("new.artist")}</Label>
              <select
                id="fil-artist"
                value={artistId}
                onChange={(e) => setArtistId(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-sm"
              >
                <option value="">{t("note.noArtist")}</option>
                {artistsForMe.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="fil-urgency">{t("new.urgency")}</Label>
              <select
                id="fil-urgency"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as Urgency)}
                className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-sm"
              >
                {URGENCIES.map((u) => (
                  <option key={u} value={u}>
                    {t(`urgency.${u}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">{t("new.to")}</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {JOB_ROLES.map((r) => {
                const on = to.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setTo(on ? to.filter((x) => x !== r) : [...to, r])}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[12px]",
                      on ? "border-brand bg-brand/10 text-brand" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(`roles.${r}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div>
            <Label htmlFor="fil-due">{t("new.dueDate")}</Label>
            <input
              id="fil-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 h-9 rounded-lg border bg-background px-2 text-sm"
            />
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            {t("new.cancel")}
          </Button>
          <Button onClick={submit}>{t("new.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
