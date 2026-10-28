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
import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarCheck, Check, CheckCircle2, ChevronRight, Plus, Send } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { CommitteeAgenda } from "@/components/modules/structure/feed/committee-agenda";
import { daLabel, recipientLabel, roleLabel } from "@/components/modules/structure/feed/labels";
import { DetectedPanel, useSignalText } from "@/components/modules/structure/feed/detected-panel";
import { ConversationPanel } from "@/components/modules/structure/feed/conversation-panel";
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
import { ARTISTS, getArtist, getDa } from "@/lib/demo/data";
import type { OrgState } from "@/lib/demo/org";
import { scopedArtists } from "@/lib/demo/scope";
import { useRole } from "@/lib/role";
import { JOB_ROLES, roleScope, type JobRole } from "@/lib/roles";
import { TENANT } from "@/lib/tenant";
import {
  FEED_PEOPLE,
  FEED_TEXT_MAX,
  LINK_TARGETS,
  URGENCIES,
  canActOn,
  committeeAgenda,
  mentionEffects,
  openPlan,
  sortNotes,
  statusOf,
  type Actor,
  type FeedLink,
  type FeedNote,
  type FeedStatus,
  type OpenPlan,
  type Urgency,
} from "@/lib/userdata/feed-model";
import { FEED_TODAY, useFeed } from "@/lib/userdata/use-feed";
import { useFeedSeen } from "@/lib/userdata/use-feed-seen";
import { seenSnapshot, subscribeSeen, viewerKey } from "@/lib/userdata/feed-seen";
import { react, reactionsSnapshot, subscribeReactions, type Reaction } from "@/lib/userdata/feed-reactions";
import { stakeFor, waitingFor } from "@/lib/userdata/feed-stakes";
import { detectSignals, detectedSnapshot, markDetected, subscribeDetected, type Signal } from "@/lib/userdata/feed-detect";
import { addAttachment, attachmentsSnapshot, subscribeAttachments } from "@/lib/userdata/feed-attachments-store";
import type { FeedAttachment } from "@/lib/userdata/feed-attachment";
import { cn } from "@/lib/utils";

/* Les artistes du rôle : ceux du DA, sinon tout le roster. Partagé par le filtre de la page et
   le dialogue. Même règle que /roster et Pulse : `roleScope` (roles.ts) + `scopedArtists` (scope.ts). */
const artistsFor = (jobRole: JobRole | null, daId: string | null, org: OrgState) =>
  scopedArtists(roleScope(jobRole, daId), ARTISTS, org);

/** Classe posée sur <html> tant que l'ordre du jour est ouvert : la feuille d'impression ne sort que lui. */
const PRINT_CLASS = "print-fil-agenda";

/* L'urgence se lit à un point de couleur devant le titre de section et au liseré de chaque ligne :
   rouge = aujourd'hui, ambre = cette semaine, gris-bleu = pour info. Pas de fond teinté. */
const GROUP_DOT: Record<Urgency, string> = {
  urgent: "bg-destructive",
  important: "bg-warning",
  info: "bg-muted-foreground/60",
};

/* Grand écran (≥ lg) : la conversation à droite du fil. En dessous : plein écran, rendu sous <body>
   — l'animation d'entrée de la page pose un transform qui ferait d'un `fixed` un simple `absolute`. */
const WIDE = "(min-width: 1024px)";
const subscribeWide = (fn: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
};
const wideNow = () => window.matchMedia(WIDE).matches;

/** ease-out-quart : la note qui part ralentit en se repliant. */
const EASE_OUT = [0.25, 1, 0.5, 1] as const;

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
  const { notes, forMe, add, done, status, reply, assign, jobRole, daId, org, daOf } = useFeed();
  const { isLabel, setPersona, setFocusedArtistId } = useRole();
  const me = useActor(jobRole, daId);
  const [agendaOpen, setAgendaOpen] = useState(false);

  /* Les artistes que je peux filtrer ou citer : les siens pour un DA, tout le roster sinon. */
  const myArtists = artistsFor(jobRole, daId, org);
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

  /* ── Triage : sélection au clavier, « Traité » qui se défait, ce qui a été fait aujourd'hui ── */
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);
  /** La note dont la conversation est ouverte à droite. */
  const [openId, setOpenId] = useState<string | null>(null);
  /** Bulle « Clique ici pour changer le statut » : une fois par navigateur. */
  /* Lu à l'initialisation : côté serveur aucune note n'est rendue, donc pas de bulle à hydrater. */
  const [tipDismissed, setTipDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem("day1-fil-tip-status") === "1";
    } catch {
      return true; // navigation privée : pas de bulle
    }
  });
  const dismissTip = () => {
    setTipDismissed(true);
    try {
      window.localStorage.setItem("day1-fil-tip-status", "1");
    } catch {
      /* navigation privée */
    }
  };
  const [undo, setUndo] = useState<{ id: string; prev: FeedStatus } | null>(null);
  const [undoPaused, setUndoPaused] = useState(false);
  const [showDone, setShowDone] = useState(false);
  /* Le jour réel du clic : le store date `doneAt` à l'heure de l'action, pas au jour de la démo. */
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const openShown = useMemo(() => shown.filter((n) => n.status !== "done"), [shown]);
  const doneShown = useMemo(() => shown.filter((n) => n.status === "done"), [shown]);
  const groups = useMemo(
    () =>
      URGENCIES.map((urgency) => ({ urgency, items: openShown.filter((n) => n.urgency === urgency) })).filter(
        (g) => g.items.length > 0,
      ),
    [openShown],
  );
  const handledToday = notes.filter((n) => n.doneAt?.slice(0, 10) === today).length;
  const progress = handledToday + lists.mine.length === 0 ? 0 : handledToday / (handledToday + lists.mine.length);

  const markDone = useCallback(
    (n: FeedNote) => {
      setUndo({ id: n.id, prev: statusOf(n) });
      setUndoPaused(false);
      done(n.id, me);
    },
    [done, me],
  );
  /* Annuler rend l'étape d'avant ; l'historique le dit (« Traité → Décidé »). */
  const undoDone = useCallback(() => {
    if (!undo) return;
    status(undo.id, undo.prev, me);
    setUndo(null);
  }, [undo, status, me]);
  useEffect(() => {
    if (!undo || undoPaused) return;
    const timer = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(timer);
  }, [undo, undoPaused]);

  /* j / k : note suivante, précédente · e : traité · o : ouvrir · z : annuler · Échap.
     Jamais dans un champ, un dialogue, ni avec une touche de modification. */
  const navigable = useMemo(() => [...openShown, ...(showDone ? doneShown : [])], [openShown, doneShown, showDone]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const target = e.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (document.querySelector("[role='dialog']")) return;
      const i = navigable.findIndex((n) => n.id === activeId);
      const current = i >= 0 ? navigable[i] : null;
      const go = (j: number) => {
        const n = navigable[Math.max(0, Math.min(navigable.length - 1, j))];
        if (!n) return;
        setActiveId(n.id);
        document.querySelector(`[data-note="${n.id}"]`)?.scrollIntoView({ block: "nearest" });
      };
      switch (e.key) {
        case "j":
          go(i + 1);
          break;
        case "k":
          go(i < 0 ? 0 : i - 1);
          break;
        case "e": {
          if (!current || current.status === "done" || !canActOn(current, jobRole, daId, daOf)) return;
          const next = navigable[i + 1] ?? navigable[i - 1];
          markDone(current);
          setActiveId(next?.id ?? null);
          break;
        }
        case "o": {
          const plan = current ? openPlan(current, seesArtist(current.artistId)) : null;
          if (!plan) return;
          open(plan);
          break;
        }
        case "z":
          if (!undo) return;
          undoDone();
          break;
        case "Enter":
          if (!current) return;
          setOpenId(current.id);
          break;
        case "Escape":
          if (openId) {
            setOpenId(null);
            break;
          }
          if (!activeId) return;
          setActiveId(null);
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* Nouveau pour moi (« +1 »), et ma fiche pour « Je m'en occupe » (un DA est sa propre fiche). */
  const { unread, see } = useFeedSeen(notes);
  const reactionsSnap = useSyncExternalStore(subscribeReactions, reactionsSnapshot, () => "{}");
  const reactions = useMemo(() => JSON.parse(reactionsSnap) as Record<string, Partial<Record<Reaction, string[]>>>, [reactionsSnap]);
  const seenSnap = useSyncExternalStore(subscribeSeen, seenSnapshot, () => "{}");
  const seenState = useMemo(() => JSON.parse(seenSnap) as Record<string, Record<string, string>>, [seenSnap]);
  const myViewer = viewerKey(jobRole, daId);
  const isWide = useSyncExternalStore(subscribeWide, wideNow, () => true);
  const openNote = openId ? (notes.find((n) => n.id === openId) ?? null) : null;
  const openThread = (id: string) => {
    setOpenId(id);
    setActiveId(id);
    see(id);
  };
  /* Conversation ouverte : ce qui y arrive est vu aussitôt. */
  const openReplies = openNote?.replies.length ?? 0;
  useEffect(() => {
    if (openId) see(openId);
  }, [openId, openReplies, see]);
  const newForMe = useMemo(() => lists.mine.reduce((s, n) => s + unread(n), 0), [lists.mine, unread]);
  const myPersonId = jobRole === "da" ? daId : (FEED_PEOPLE.find((p) => p.role === jobRole && p.daId === null)?.id ?? null);
  const [now] = useState(() => Date.now());

  /* « Envoyé à … » : la confirmation de chaque réponse, avec ceux qui la reçoivent. */
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(timer);
  }, [flash]);
  const sendReply = (n: FeedNote, text: string) => {
    const added = mentionEffects(n, text, daOf).added.map((r) => recipientLabel(t, r));
    const list = [...new Set([...n.to.map((r) => roleLabel(t, r)), ...added])].join(", ");
    reply(n.id, text, me);
    see(n.id);
    setFlash(tp("sent", { list }));
  };

  /* « Day One a repéré » : ce que les données disent déjà, pour les services qui me concernent
     (Direction, Présidence et la vue maison : tout). Sans doublon avec une note ouverte sur le
     même artiste et le même sujet ; ce qui a été posé ou écarté ne revient pas. */
  const signalText = useSignalText();
  const detectedSnap = useSyncExternalStore(subscribeDetected, detectedSnapshot, () => "[]");
  const myIds = myArtists.map((a) => a.id).join(",");
  const signals = useMemo(() => {
    const gone = new Set(JSON.parse(detectedSnap) as string[]);
    const covered = new Set(
      notes.filter((n) => n.status === "open" && n.artistId && n.link).map((n) => `${n.artistId}:${n.link!.kind}`),
    );
    const mineToo = (s: Signal) => !jobRole || jobRole === "direction" || jobRole === "presidence" || s.to.includes(jobRole);
    return detectSignals(myIds ? myIds.split(",") : [], FEED_TODAY, 12)
      .filter((s) => !gone.has(s.id) && !covered.has(`${s.artistId}:${s.link.kind}`) && mineToo(s))
      .slice(0, 4);
  }, [myIds, detectedSnap, notes, jobRole]);
  const postSignal = (s: Signal) => {
    // Ce que je pose moi-même n'est jamais « nouveau » pour moi (sans rôle, la note est signée Direction).
    const posted = add({
      from: jobRole ?? "direction",
      fromName: me.name,
      fromDaId: me.daId,
      to: s.to,
      artistId: s.artistId,
      urgency: s.urgency,
      dueDate: s.dueDate,
      text: tp("detect.prefix", { text: signalText(s) }),
      link: s.link,
    });
    see(posted.id);
    markDetected(s.id);
    setFlash(tp("detect.posted", { list: s.to.map((r) => roleLabel(t, r)).join(", ") }));
  };

  /* Pièces jointes traduites par Day One, gardées à part ; joindre prévient les services. */
  const attachSnap = useSyncExternalStore(subscribeAttachments, attachmentsSnapshot, () => "{}");
  const attachments = useMemo(() => JSON.parse(attachSnap) as Record<string, FeedAttachment[]>, [attachSnap]);
  const attach = (n: FeedNote, a: FeedAttachment) => {
    addAttachment(n.id, a);
    sendReply(n, tp("attach.posted", { name: a.name }));
  };

  const firstNoteId = groups[0]?.items[0]?.id ?? null;
  const renderNote = (n: FeedNote) => (
    <NoteCard
      note={n}
      today={FEED_TODAY}
      canAct={canActOn(n, jobRole, daId, daOf)}
      canSeeArtist={seesArtist(n.artistId)}
      artist={n.artistId ? getArtist(n.artistId) : null}
      daOf={daOf}
      active={n.id === activeId}
      unread={unread(n)}
      onSeen={() => see(n.id)}
      myPersonId={myPersonId}
      myRole={jobRole}
      stake={stakeFor(n)}
      waiting={waitingFor(n, now)}
      attachments={attachments[n.id]}
      onAttach={(a) => attach(n, a)}
      attachCtx={{ by: { role: jobRole, name: me.name }, artistId: n.artistId, today: FEED_TODAY }}
      onStatus={(s) => status(n.id, s, me)}
      onDone={() => markDone(n)}
      onReply={(text) => sendReply(n, text)}
      onAssign={(personId) => assign(n.id, personId, me)}
      onOpen={open}
      onFilterArtist={(id) => setArtistFilter(id)}
      onOpenThread={() => openThread(n.id)}
      statusTip={!tipDismissed && n.id === firstNoteId}
      onDismissTip={dismissTip}
    />
  );

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
          <NewNoteDialog
            onSubmit={(input) => {
              const created = add(input);
              see(created.id);
              return created;
            }}
            jobRole={jobRole}
            daId={daId}
            me={me}
            org={org}
            daOf={daOf}
          />
        </div>
      </PageHeader>

      {/* Une barre : le mode (segments), l'artiste, et ce qui a été traité aujourd'hui. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="bg-muted/70 inline-flex rounded-lg p-0.5 text-[12.5px]"
            role="group"
            aria-label={t("filters.modeLabel")}
          >
            {(["mine", "all"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-3 py-1 font-medium transition-colors",
                  mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`filters.${m}`)} <span className="num ml-0.5 font-normal opacity-60">{lists[m].length}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[12.5px]">
            <span className="sr-only">{t("filters.artist")}</span>
            <select
              value={artistFilter ?? ""}
              onChange={(e) => setArtistFilter(e.target.value || null)}
              className={cn(
                "hover:bg-muted/60 h-8 rounded-md bg-transparent px-2 text-[12.5px] transition-colors",
                artistFilter ? "text-foreground font-medium" : "text-muted-foreground",
              )}
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
        <p className="flex items-center gap-3 text-[12px]" aria-live="polite">
          {newForMe > 0 && (
            <span className="text-destructive inline-flex items-center gap-1.5 font-semibold tabular-nums">
              <span aria-hidden className="bg-destructive size-1.5 rounded-full" />
              {tp("newMessages", { count: newForMe })}
            </span>
          )}
          <span className="text-muted-foreground">{tp("progress.today", { count: handledToday })}</span>
        </p>
      </div>

      <div className={cn(openNote && isWide && "grid grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)] items-start gap-4")}>
      <div className="min-w-0">
        {/* Le filet se remplit à mesure que la pile « pour moi » descend. */}
        <div className="bg-border h-px" aria-hidden>
          <div className="bg-foreground/70 h-full transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
        </div>

        {openShown.length === 0 && mode === "mine" && !artistFilter ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <motion.span
              initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
            >
              <CheckCircle2 className="text-success size-9" aria-hidden />
            </motion.span>
            <p className="text-[15px] font-semibold">{tp("zero.title")}</p>
            <p className="text-muted-foreground text-[12.5px]">{tp("zero.body", { count: handledToday })}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setMode("all")}>
              {tp("zero.seeAll")}
            </Button>
          </div>
        ) : openShown.length === 0 && (mode === "mine" || doneShown.length === 0) ? (
          <p className="text-muted-foreground flex items-center gap-2 px-5 py-8 text-sm">
            <CheckCircle2 className="text-success size-4" aria-hidden />
            {t(mode === "mine" ? "empty.mine" : "empty.all")}
          </p>
        ) : (
          <div className="space-y-5 pt-4">
            <DetectedPanel signals={signals} onPost={postSignal} onDismiss={(sg) => markDetected(sg.id)} />
            {groups.map((g) => (
              <section key={g.urgency} aria-labelledby={`fil-g-${g.urgency}`}>
                <h3 id={`fil-g-${g.urgency}`} className="text-foreground mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold">
                  <span aria-hidden className={cn("size-2 rounded-full", GROUP_DOT[g.urgency])} />
                  {t(`urgency.${g.urgency}`)}
                  <span className="text-muted-foreground font-normal tabular-nums">{g.items.length}</span>
                </h3>
                <ul className="bg-card divide-border/70 overflow-hidden rounded-lg border divide-y">
                  <AnimatePresence initial={false}>
                    {g.items.map((n) => (
                      <motion.li
                        key={n.id}
                        layout="position"
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: EASE_OUT }}
                        onMouseDown={() => setActiveId(n.id)}
                      >
                        {renderNote(n)}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            ))}
            {doneShown.length > 0 && (
              <section>
                <button
                  type="button"
                  aria-expanded={showDone}
                  onClick={() => setShowDone((v) => !v)}
                  className="text-muted-foreground hover:text-foreground mb-2 flex w-full items-center gap-1.5 px-1 text-[13px] font-semibold"
                >
                  <ChevronRight className={cn("size-3.5 transition-transform", showDone && "rotate-90")} aria-hidden />
                  {tp("groups.done")}
                  <span className="num font-normal">{doneShown.length}</span>
                </button>
                {showDone && (
                  <ul className="bg-card divide-border/70 overflow-hidden rounded-lg border divide-y">
                    {doneShown.map((n) => (
                      <li key={n.id}>{renderNote(n)}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}
        <p className="text-muted-foreground mt-4 px-1 text-[11px] [@media(hover:none)]:hidden">
          {tp("keys.hint")}
        </p>
      </div>

      {/* La conversation de la note ouverte : à droite sur grand écran, plein écran sinon. */}
      {openNote && (() => {
        const panel = (
        <ConversationPanel
          key={openNote.id}
          note={openNote}
          artist={openNote.artistId ? getArtist(openNote.artistId) : null}
          today={FEED_TODAY}
          canAct={canActOn(openNote, jobRole, daId, daOf)}
          canSeeArtist={seesArtist(openNote.artistId)}
          daOf={daOf}
          myRole={jobRole}
          myDaId={daId}
          myViewer={myViewer}
          myPersonId={myPersonId}
          attachments={attachments[openNote.id] ?? []}
          reactions={reactions}
          seenState={seenState}
          stake={stakeFor(openNote)}
          waiting={waitingFor(openNote, now)}
          onClose={() => setOpenId(null)}
          onStatus={(st) => status(openNote.id, st, me)}
          onDone={() => markDone(openNote)}
          onAssign={(personId) => {
            assign(openNote.id, personId, me);
            if (personId && statusOf(openNote) === "todo") status(openNote.id, "doing", me);
            if (personId) sendReply(openNote, tp("quick.mineText"));
          }}
          onReply={(text) => sendReply(openNote, text)}
          onOpen={open}
          onAttach={(a) => attach(openNote, a)}
          onReact={(messageId, r) => react(messageId, r, myViewer)}
          attachCtx={{ by: { role: jobRole, name: me.name }, artistId: openNote.artistId, today: FEED_TODAY }}
          className={isWide ? "sticky top-20 h-[calc(100dvh-6.5rem)]" : "fixed inset-0 z-50 h-dvh rounded-none"}
        />
        );
        return isWide ? panel : createPortal(panel, document.body);
      })()}
      </div>

      {/* « Envoyé à … » : la réponse est partie, et on voit à qui. */}
      <AnimatePresence>
        {flash && !undo && (
          <motion.div
            key={flash}
            role="status"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="bg-brand text-brand-foreground fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium shadow-lg"
          >
            <Send className="size-3.5" aria-hidden />
            {flash}
          </motion.div>
        )}
      </AnimatePresence>

      {/* « Traité » se défait sur place pendant six secondes (pause au survol). */}
      <AnimatePresence>
        {undo && (
          <motion.div
            key={undo.id}
            role="status"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            onMouseEnter={() => setUndoPaused(true)}
            onMouseLeave={() => setUndoPaused(false)}
            className="bg-foreground text-background fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full py-1.5 pr-1.5 pl-4 text-[12.5px] shadow-lg"
          >
            <Check className="size-3.5" aria-hidden />
            {tp("undo.done")}
            <button
              type="button"
              onClick={undoDone}
              className="bg-background/15 hover:bg-background/25 rounded-full px-3 py-1 font-medium transition-colors"
            >
              {tp("undo.action")} <kbd className="ml-1 font-mono text-[10.5px] opacity-70">Z</kbd>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NewNoteDialog({
  onSubmit,
  jobRole,
  daId,
  me,
  org,
  daOf,
}: {
  onSubmit: ReturnType<typeof useFeed>["add"];
  jobRole: JobRole | null;
  daId: string | null;
  me: Actor;
  org: OrgState;
  daOf: ReturnType<typeof useFeed>["daOf"];
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

  const artistsForMe = artistsFor(jobRole, daId, org);
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

