"use client";

/**
 * /fil — le fil entre services (spec Universal v2, §5). Liste triée urgence puis
 * échéance ; filtres « à traiter pour moi / tout / par artiste » ; nouvelle note ;
 * statuts (à faire, en cours, décidé, traité — « Traité » en un clic) ; réponses en
 * fil avec mentions ; prise en charge ; « Ouvrir » l'objet lié ; pastilles
 * d'échéance ; ordre du jour du comité imprimable. Démo : localStorage (feed-store).
 * Sans rôle choisi (maison day1), tout est « pour moi » et l'auteur est « Structure ».
 *
 * Réservé à la persona structure (nav.ts + garde `LabelGuard`, comme /roster) : les
 * notes parlent d'autres artistes qu'un artiste solo n'a pas à lire, même en tapant l'URL.
 * Un DA lit tout en « Tout » (comme avant), mais n'agit que sur ses artistes (`canActOn`).
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarCheck, CheckCircle2, Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { CommitteeAgenda } from "@/components/modules/structure/feed/committee-agenda";
import { daLabel, recipientLabel } from "@/components/modules/structure/feed/labels";
import { NoteCard } from "@/components/modules/structure/feed/note-card";
import { LabelGuard } from "@/components/modules/structure/label-guard";
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
import { getArtist, getDa } from "@/lib/demo/data";
import { scopedArtists } from "@/lib/demo/scope";
import { useRole } from "@/lib/role";
import { JOB_ROLES, roleScope, type JobRole } from "@/lib/roles";
import { TENANT } from "@/lib/tenant";
import {
  FEED_TEXT_MAX,
  LINK_TARGETS,
  URGENCIES,
  canActOn,
  committeeAgenda,
  mentionEffects,
  sortNotes,
  type Actor,
  type FeedLink,
  type OpenPlan,
  type Urgency,
} from "@/lib/userdata/feed-model";
import { FEED_TODAY, daOf, useFeed } from "@/lib/userdata/use-feed";
import { cn } from "@/lib/utils";

/* Les artistes du rôle : ceux du DA, sinon tout le roster. Partagé par le filtre de la page et
   le dialogue. Même règle que /roster et Pulse : `roleScope` (roles.ts) + `scopedArtists` (scope.ts). */
const artistsFor = (jobRole: JobRole | null, daId: string | null) => scopedArtists(roleScope(jobRole, daId));

/** Classe posée sur <html> tant que l'ordre du jour est ouvert : la feuille d'impression ne sort que lui. */
const PRINT_CLASS = "print-fil-agenda";

export default function FeedView() {
  // `useSearchParams` dans un composant client : frontière Suspense obligatoire (docs Next 16).
  return (
    <Suspense fallback={null}>
      <Feed />
    </Suspense>
  );
}

/**
 * Auteur : le libellé du rôle seul (« Finance »), « DA · <nom du DA> » pour un DA, ou
 * « Structure » sans rôle. Pas de « · moi » : la note est relue plus tard par d'autres rôles.
 * Texte d'affichage figé dans la langue de l'action (démo).
 */
function useActor(jobRole: JobRole | null, daId: string | null): Actor {
  const t = useTranslations("fil");
  const daName = jobRole === "da" && daId ? (getDa(daId)?.name ?? null) : null;
  const name = jobRole ? (daName ? `${t("roles.da")} · ${daName}` : t(`roles.${jobRole}`)) : t("author.structure");
  return { role: jobRole, daId: jobRole === "da" ? daId : null, name };
}

function Feed() {
  const t = useTranslations("fil");
  const tp = useTranslations("filpage");
  const params = useSearchParams();
  const router = useRouter();
  const { notes, forMe, add, done, status, reply, assign, jobRole, daId } = useFeed();
  const { isLabel, setPersona, setFocusedArtistId } = useRole();
  const me = useActor(jobRole, daId);
  const [agendaOpen, setAgendaOpen] = useState(false);

  /* Les artistes que je peux filtrer ou citer : les siens pour un DA, tout le roster sinon. */
  const myArtists = artistsFor(jobRole, daId);
  /* Le filtre artiste vient de l'URL (`?artist=`) : partageable, et la colonne Notes du roster
     arrive déjà filtrée. Un id inconnu de la maison, ou hors du périmètre du DA = pas de filtre. */
  const artistParam = params.get("artist");
  const artistFilter = artistParam && myArtists.some((a) => a.id === artistParam) ? artistParam : null;
  /* Arrivée depuis le roster (`?artist=`) : on ouvre en « Tout » (le compteur du roster compte
     toutes les notes ouvertes de l'artiste). Sur le filtre VALIDÉ ; seul l'état initial change. */
  const [mode, setMode] = useState<"mine" | "all">(() => (artistFilter ? "all" : "mine"));
  /* Écriture de l'URL sans aller-retour serveur — même motif que /roster. */
  const setArtistFilter = useCallback((id: string | null) => {
    window.history.replaceState(null, "", id ? `/fil?artist=${encodeURIComponent(id)}` : "/fil");
  }, []);

  const lists = useMemo(() => {
    const byArtist = (l: typeof notes) => (artistFilter ? l.filter((n) => n.artistId === artistFilter) : l);
    return { mine: byArtist(forMe), all: byArtist(notes) };
  }, [forMe, notes, artistFilter]);
  const shown = useMemo(() => sortNotes(lists[mode]), [lists, mode]);
  /* L'ordre du jour : toutes les notes non traitées de la maison (comme « Tout »), sans filtre. */
  const agenda = useMemo(() => committeeAgenda(notes), [notes]);

  useEffect(() => {
    if (!agendaOpen) return;
    document.documentElement.classList.add(PRINT_CLASS);
    return () => document.documentElement.classList.remove(PRINT_CLASS);
  }, [agendaOpen]);

  /* « Ouvrir » : zoom posé (ou retiré) AVANT la navigation, puis la page. Le zoom vit dans
     role.tsx (localStorage) et survit à la navigation client. */
  const open = useCallback(
    (plan: OpenPlan) => {
      if (plan.focus) setFocusedArtistId(plan.focus.artistId);
      router.push(plan.href);
    },
    [router, setFocusedArtistId],
  );

  const seesArtist = (artistId: string | null) => !artistId || myArtists.some((a) => a.id === artistId);

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
        <div className="flex flex-wrap gap-2">
          <Dialog open={agendaOpen} onOpenChange={setAgendaOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <CalendarCheck className="size-4" aria-hidden />
                {tp("agenda.button")}
              </Button>
            </DialogTrigger>
            <DialogContent
              id="fil-agenda"
              className="inset-0 top-0 left-0 block h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none p-6 sm:max-w-none sm:p-10"
            >
              <DialogTitle className="sr-only">{tp("agenda.title")}</DialogTitle>
              <DialogDescription className="sr-only">{tp("agenda.subtitle")}</DialogDescription>
              <div className="mx-auto max-w-3xl">
                <CommitteeAgenda
                  groups={agenda}
                  today={FEED_TODAY}
                  houseName={TENANT.name}
                  artistName={(id) => getArtist(id).name}
                  onPrint={() => window.print()}
                />
              </div>
            </DialogContent>
          </Dialog>
          <NewNoteDialog onSubmit={add} jobRole={jobRole} daId={daId} me={me} />
        </div>
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
            {myArtists.map((a) => (
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
              <NoteCard
                key={n.id}
                note={n}
                today={FEED_TODAY}
                canAct={canActOn(n, jobRole, daId, daOf)}
                canSeeArtist={seesArtist(n.artistId)}
                artist={n.artistId ? getArtist(n.artistId) : null}
                daOf={daOf}
                onStatus={(s) => status(n.id, s, me)}
                onDone={() => done(n.id, me)}
                onReply={(text) => reply(n.id, text, me)}
                onAssign={(personId) => assign(n.id, personId, me)}
                onOpen={open}
                onFilterArtist={(id) => setArtistFilter(id)}
              />
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
  me,
}: {
  onSubmit: ReturnType<typeof useFeed>["add"];
  jobRole: JobRole | null;
  daId: string | null;
  me: Actor;
}) {
  const t = useTranslations("fil");
  const tp = useTranslations("filpage");
  const tn = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [artistId, setArtistId] = useState<string>("");
  const [to, setTo] = useState<JobRole[]>([]);
  const [urgency, setUrgency] = useState<Urgency>("info");
  const [dueDate, setDueDate] = useState("");
  const [linkIndex, setLinkIndex] = useState("");
  const [error, setError] = useState<string | null>(null);

  const artistsForMe = artistsFor(jobRole, daId);
  /* Ce que les mentions du texte ajouteront (aperçu, mêmes règles que le store). */
  const effects = mentionEffects({ to, toDas: [], artistId: artistId || null }, text, daOf);
  const link: FeedLink | null = linkIndex === "" ? null : (LINK_TARGETS[Number(linkIndex)] ?? null);
  const linkLabel = (l: FeedLink) =>
    l.kind === "page" ? tp("link.choice.page", { page: tn(`items.${l.href.slice(1)}`) }) : tp(`link.choice.${l.kind}`);

  const reset = () => {
    setText("");
    setArtistId("");
    setTo([]);
    setUrgency("info");
    setDueDate("");
    setLinkIndex("");
    setError(null);
  };
  const submit = () => {
    if (!text.trim()) return setError(t("new.needText"));
    if (to.length === 0 && effects.added.length === 0) return setError(t("new.needTo"));
    onSubmit({
      from: jobRole ?? "direction",
      fromName: me.name,
      fromDaId: me.daId,
      to,
      artistId: artistId || null,
      urgency,
      dueDate: dueDate || null,
      text,
      link: link && link.kind === "artist" && !artistId ? null : link,
    });
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
            <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
              <span>{tp("mentionsHint")}</span>
              <span className="num ml-auto">{t("new.textHint", { count: text.length })}</span>
            </div>
            {effects.added.length > 0 && (
              <p className="mt-1 text-[11px] text-brand">
                {tp("replies.adds", { list: effects.added.map((r) => recipientLabel(t, r)).join(", ") })}
              </p>
            )}
            {effects.outOfScope.length > 0 && (
              <p className="mt-1 text-[11px] text-warning">
                {tp("replies.outOfScope", { names: effects.outOfScope.map((d) => daLabel(t, d)).join(", ") })}
              </p>
            )}
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="fil-due">{t("new.dueDate")}</Label>
              <input
                id="fil-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="fil-link">{tp("link.label")}</Label>
              <select
                id="fil-link"
                value={linkIndex}
                onChange={(e) => setLinkIndex(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-sm"
              >
                <option value="">{tp("link.none")}</option>
                {LINK_TARGETS.map((l, i) => (
                  <option key={`${l.kind}${l.href}`} value={String(i)} disabled={l.kind === "artist" && !artistId}>
                    {linkLabel(l)}
                  </option>
                ))}
              </select>
            </div>
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

