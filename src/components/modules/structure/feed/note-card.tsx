"use client";

/**
 * Une note du fil, lisible d'un coup d'œil et traitable en un clic.
 *
 * - Une barre de couleur à gauche dit l'urgence (rouge, ambre, bleu) ; la vue regroupe aussi
 *   les notes par urgence, sur des fonds teintés.
 * - « +N nouveaux » quand un autre service a écrit depuis mon dernier passage (feed-seen.ts).
 * - La dernière réponse est visible sans rien ouvrir ; « Répondre » est toujours là.
 * - À droite : l'échéance, puis chez qui la note attend et depuis quand.
 * - L'enjeu en chiffres (avance et recoupement, montant à réclamer) dans la ligne du dessous.
 * - Au survol : « Je m'en occupe », « Traité », « Ouvrir ». Dans le fil de réponses : Validé,
 *   Besoin d'infos, Relancé, et « Transmettre à » un service — un clic, rien à recopier.
 *
 * Le statut et la prise en charge restent des <select> natifs posés sur leur pastille : clavier,
 * lecteur d'écran et rendu serveur testé (feed-components.test.ts) gardent le vrai contrôle.
 */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowUpRight,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  History,
  Paperclip,
  type LucideIcon,
  ChevronsUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Artist } from "@/lib/demo/types";
import { fmtDate, fmtEur } from "@/lib/format";
import type { JobRole } from "@/lib/roles";
import {
  FEED_STATUSES,
  assignableFor,
  dueState,
  getPerson,
  openPlan,
  statusOf,
  type DaOf,
  type FeedEvent,
  type FeedNote,
  type FeedStatus,
  type OpenPlan,
  type Urgency,
} from "@/lib/userdata/feed-model";
import type { FeedAttachment } from "@/lib/userdata/feed-attachment";
import type { Stake, Waiting } from "@/lib/userdata/feed-stakes";
import { cn } from "@/lib/utils";
import { personLabel, recipientLabel, toLabel } from "./labels";
import { AttachmentCard, type AttachmentCtxInput } from "./attachment-card";
import { FeedComposer } from "./composer";
import { MentionText } from "./mention-text";

/* Pastilles de l'ordre du jour imprimable (committee-agenda.tsx). */
export const URGENCY_TONE: Record<Urgency, string> = {
  urgent: "border-transparent bg-destructive/10 text-destructive",
  important: "border-transparent bg-warning/10 text-warning",
  info: "border-transparent bg-muted text-muted-foreground",
};

export const STATUS_TONE: Record<FeedStatus, string> = {
  todo: "border-border text-foreground",
  doing: "border-brand/40 bg-brand/10 text-brand",
  decided: "border-warning/40 bg-warning/10 text-warning",
  done: "border-success/40 bg-success/10 text-success",
};

export const DUE_TONE = { overdue: "bg-destructive text-white", soon: "bg-warning/15 text-warning" } as const;

/** La barre de gauche : l'urgence se voit avant de lire. */
export const URGENCY_BAR: Record<Urgency, string> = {
  urgent: "shadow-[inset_3px_0_0_var(--destructive)]",
  important: "shadow-[inset_3px_0_0_var(--warning)]",
  info: "shadow-[inset_3px_0_0_color-mix(in_oklab,var(--muted-foreground)_45%,transparent)]",
};

/** L'étape se lit à la forme ; seule « en cours » prend l'accent de la marque. */
const STATUS_GLYPH: Record<FeedStatus, { Icon: LucideIcon; tone: string }> = {
  todo: { Icon: Circle, tone: "text-muted-foreground" },
  doing: { Icon: CircleDashed, tone: "text-[var(--fil-accent,var(--brand))]" },
  decided: { Icon: CircleDot, tone: "text-foreground" },
  done: { Icon: CircleCheck, tone: "text-muted-foreground/70" },
};

export type NoteCardProps = {
  note: FeedNote;
  /** Jour de la démo, AAAA-MM-JJ. */
  today: string;
  /** Statut, réponse, prise en charge permis (un DA : ses artistes seulement). */
  canAct: boolean;
  /** L'artiste est dans mon périmètre (filtre et « Ouvrir »). */
  canSeeArtist: boolean;
  artist: Pick<Artist, "hue" | "initials" | "name"> | null;
  daOf: DaOf;
  onStatus: (s: FeedStatus) => void;
  onDone: () => void;
  onReply: (text: string) => void;
  onAssign: (personId: string | null) => void;
  onOpen: (plan: OpenPlan) => void;
  onFilterArtist: (artistId: string) => void;
  /** Note sélectionnée au clavier (j / k). */
  active?: boolean;
  /** Éléments nouveaux pour moi (réponses d'autres services, la note elle-même). */
  unread?: number;
  /** J'ouvre le fil de réponses : ce qui était nouveau ne l'est plus. */
  onSeen?: () => void;
  /** Ma fiche dans le fil (« Je m'en occupe ») ; null : pas de prise en charge possible. */
  myPersonId?: string | null;
  /** Mon service, pour ne pas me proposer de me transmettre la note. */
  myRole?: JobRole | null;
  stake?: Stake | null;
  waiting?: Waiting | null;
  /** Pièces jointes traduites par Day One (Excel, relevé, contrat). */
  attachments?: FeedAttachment[];
  /** Joindre : la traduction est gardée et une réponse prévient les services. */
  onAttach?: (a: FeedAttachment) => void;
  /** Auteur, artiste et jour de la démo pour la traduction. */
  attachCtx?: AttachmentCtxInput;
  /** Ouvre la conversation dans le panneau de droite ; absent : réponses dépliées sous la note. */
  onOpenThread?: () => void;
  /** Première visite : une bulle montre où changer le statut. */
  statusTip?: boolean;
  onDismissTip?: () => void;
  /** Panneau ouvert au premier rendu (tests). */
  defaultPanel?: "replies" | "history" | null;
};

const when = (locale: string, iso: string) =>
  fmtDate(locale, iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function NoteCard(props: NoteCardProps) {
  const { note, today, canAct, canSeeArtist, artist, daOf, active = false, unread = 0 } = props;
  const tf = useTranslations("fil");
  const tp = useTranslations("filpage");
  const tn = useTranslations("nav");
  const locale = useLocale();
  const [panel, setPanel] = useState<"replies" | "history" | null>(props.defaultPanel ?? null);
  const status = statusOf(note);
  const due = dueState(note, today);
  const plan = openPlan(note, canSeeArtist);
  const { Icon, tone } = STATUS_GLYPH[status];
  const assignee = note.assigneeId ? personLabel(tf, tp, note.assigneeId) : null;
  const assigneeText = assignee ? tp("assign.taken", { name: assignee }) : tp("assign.unassigned");
  const assigneeName = note.assigneeId ? (getPerson(note.assigneeId)?.name ?? note.assigneeId) : null;
  const last = note.replies[note.replies.length - 1] ?? null;
  const canTakeIt = canAct && status !== "done" && !!props.myPersonId && note.assigneeId !== props.myPersonId;

  const openPanel = (p: "replies" | "history") => {
    if (props.onOpenThread) return props.onOpenThread();
    const next = panel === p ? null : p;
    setPanel(next);
    if (next === "replies") props.onSeen?.();
  };
  const takeIt = () => {
    if (!props.myPersonId) return;
    props.onAssign(props.myPersonId);
    if (status === "todo") props.onStatus("doing");
    props.onReply(tp("quick.mineText"));
    props.onSeen?.();
  };

  const openLabel = note.link
    ? note.link.kind === "page"
      ? tp("link.open.page", { page: tn(`items.${note.link.href.slice(1)}`) })
      : tp(`link.open.${note.link.kind}`)
    : "";

  const stakeText = props.stake
    ? props.stake.kind === "advance"
      ? tp("stake.advance", { amount: fmtEur(locale, props.stake.amount, { compact: true }), pct: props.stake.pct })
      : props.stake.kind === "claim"
        ? tp("stake.claim", { amount: fmtEur(locale, props.stake.amount) })
        : tp("stake.valuation", { amount: fmtEur(locale, props.stake.amount, { compact: true }) })
    : null;

  return (
    <article
      data-note={note.id}
      className={cn(
        "group/note relative rounded-xl transition-colors duration-200",
        active ? "bg-muted/70" : "hover:bg-muted/40",
      )}
    >
      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-3 py-3.5 pr-3 pl-3">
        {/* L'étape se lit à la forme ; on la change dans la pastille « Statut » ci-dessous. */}
        <span className="mt-px flex size-5 items-center justify-center" title={tp(`status.${status}`)}>
          <Icon className={cn("size-[18px]", tone)} aria-hidden />
        </span>

        <div className="min-w-0">
          <p
            className={cn(
              "line-clamp-2 max-w-[72ch] text-[15px] leading-[1.35] font-medium tracking-[-0.012em]",
              status === "done" ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {unread > 0 && (
              <span className="mr-2 inline-flex items-center gap-1 align-baseline text-[12px] font-semibold text-[var(--fil-accent,var(--brand))] tabular-nums">
                <span aria-hidden className="size-2 rounded-full bg-[var(--fil-accent,var(--brand))]" />
                {tp("unread", { count: unread })}
              </span>
            )}
            <MentionText text={note.text} artistId={note.artistId} daOf={daOf} />
          </p>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
            {note.artistId && artist ? (
              canSeeArtist ? (
                <button
                  type="button"
                  className="text-foreground/85 hover:text-foreground font-semibold underline-offset-2 hover:underline"
                  onClick={() => props.onFilterArtist(note.artistId!)}
                >
                  {artist.name}
                </button>
              ) : (
                <span className="text-foreground/85 font-semibold">{artist.name}</span>
              )
            ) : (
              <span>{tf("note.noArtist")}</span>
            )}
            <span aria-hidden>·</span>
            <span>{tf("note.from", { from: note.fromName, to: toLabel(tf, note) })}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{fmtDate(locale, note.createdAt.slice(0, 10), { day: "numeric", month: "short" })}</span>
            {stakeText && (
              <>
                <span aria-hidden>·</span>
                <span className="text-foreground/80 font-medium tabular-nums">{stakeText}</span>
              </>
            )}
            {note.doneAt && (
              <>
                <span aria-hidden>·</span>
                <span>{tf("note.done", { date: fmtDate(locale, note.doneAt.slice(0, 10), { day: "numeric", month: "short" }) })}</span>
              </>
            )}
          </p>

          {/* Les pièces jointes, traduites par Day One : la ligne de mon service mise en avant (vue
              maison : celle de la Direction), les autres services repliés. */}
          {(props.attachments ?? []).map((a) => (
            <AttachmentCard key={a.id} attachment={a} role={props.myRole ?? "direction"} className="mt-2 max-w-[72ch]" />
          ))}

          {/* La discussion, visible sans rien ouvrir : la dernière réponse, en bulle grise comme un aperçu de Messages
              (le bleu est réservé à la conversation, pour mes messages). */}
          {last && panel !== "replies" && (
            <button
              type="button"
              onClick={() => openPanel("replies")}
              className="group/bubble mt-2.5 block max-w-[min(64ch,100%)] text-left"
            >
              <span className="text-muted-foreground mb-1 block pl-3 text-[12px]">
                <span className="text-foreground/80 font-medium">{last.by.name}</span>
                <span className="tabular-nums"> · {when(locale, last.at)}</span>
              </span>
              <span
                className="text-foreground line-clamp-3 inline-block rounded-[18px] bg-[var(--fil-bubble,var(--muted))] px-3.5 py-2 text-[14px] leading-snug transition-[filter] duration-200 group-hover/bubble:brightness-95"
              >
                <MentionText text={last.text} artistId={note.artistId} daOf={daOf} />
              </span>
            </button>
          )}
          <div className="mt-2.5 -ml-2 flex flex-wrap items-center gap-x-0.5 gap-y-1 text-[13px]">
            <StatusPill
              status={status}
              canAct={canAct}
              onStatus={props.onStatus}
              tip={!!props.statusTip}
              onDismissTip={props.onDismissTip}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-[13px] font-medium text-[var(--fil-accent,var(--brand))] hover:text-[var(--fil-accent,var(--brand))]"
              aria-expanded={panel === "replies"}
              onClick={() => openPanel("replies")}
            >
              {note.replies.length === 0 ? tp("thread.start") : tp("thread.reply")}
              <span data-replies={note.replies.length} className="text-muted-foreground tabular-nums">
                {note.replies.length > 0 && <span aria-hidden>{note.replies.length}</span>}
                <span className="sr-only">{tp("replies.toggle", { count: note.replies.length })}</span>
              </span>
            </Button>
            {canTakeIt && (
              <Button size="sm" variant="ghost" className="text-foreground/75 hover:text-foreground h-7 px-2 text-[13px] font-medium" onClick={takeIt}>
                {tp("quick.mine")}
              </Button>
            )}
            {canAct && status !== "done" && (
              <Button size="sm" variant="ghost" className="text-foreground/75 hover:text-foreground h-7 px-2 text-[13px] font-medium" onClick={props.onDone}>
                {tf("note.markDone")}
              </Button>
            )}
            {plan && (
              <Button size="sm" variant="ghost" className="text-foreground/75 hover:text-foreground h-7 gap-1 px-2 text-[13px] font-medium" onClick={() => props.onOpen(plan)}>
                {openLabel}
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Button>
            )}
            {canAct && props.onAttach && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground h-7 px-2"
                onClick={() => {
                  if (panel !== "replies") openPanel("replies");
                }}
                aria-label={tp("attach.button")}
                title={tp("attach.button")}
              >
                <Paperclip className="size-3.5" aria-hidden />
              </Button>
            )}
            {!props.onOpenThread && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground h-7 gap-1 px-2 text-[12px]"
              aria-expanded={panel === "history"}
              onClick={() => openPanel("history")}
              title={tp("history.toggle", { count: note.history.length })}
            >
              <History className="size-3.5" aria-hidden />
              <span aria-hidden className="tabular-nums">{note.history.length}</span>
              <span className="sr-only">{tp("history.toggle", { count: note.history.length })}</span>
            </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 pt-0.5">
          {/* Échéance : rouge seulement en retard, appuyée si elle tombe cette semaine. */}
          <span
            className={cn(
              "text-right text-[12.5px] leading-tight tabular-nums",
              due === "overdue"
                ? "text-destructive font-semibold"
                : due === "soon"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground",
            )}
            title={note.dueDate ? tf("note.due", { date: fmtDate(locale, note.dueDate, { day: "numeric", month: "long" }) }) : undefined}
          >
            {note.dueDate ? fmtDate(locale, note.dueDate, { day: "numeric", month: "short" }) : "—"}
            {due && (
              <span
                data-due={due}
                className={cn("mt-0.5 block text-[11px] font-medium", due === "overdue" ? "text-destructive" : "text-warning")}
              >
                {tp(`due.${due}`)}
              </span>
            )}
          </span>

          {/* Chez qui ça attend, et depuis quand ; le vrai <select> de prise en charge posé dessus. */}
          <span
            data-assignee={note.assigneeId ?? ""}
            title={assigneeText}
            className={cn(
              "has-[select:focus-visible]:ring-ring hover:bg-muted relative -mr-1 rounded-md px-1 py-0.5 text-right text-[12px] leading-tight has-[select:focus-visible]:ring-2",
              assigneeName ? "text-foreground/85" : "text-muted-foreground italic",
            )}
          >
            <span aria-hidden className="block font-medium">
              {assigneeName ? tp("waiting.with", { name: assigneeName }) : tp("waiting.nobody")}
            </span>
            {props.waiting && (
              <span aria-hidden className="text-muted-foreground block text-[11px] not-italic">
                {tp("waiting.since", { days: props.waiting.days })}
              </span>
            )}
            <span className="sr-only">{assigneeText}</span>
            {canAct && (
              <select
                aria-label={tp("assign.label")}
                value={note.assigneeId ?? ""}
                onChange={(e) => props.onAssign(e.target.value || null)}
                className="absolute inset-0 cursor-pointer appearance-none rounded-md opacity-0"
              >
                <option value="">{`${tp("assign.label")} : ${tp("assign.nobody")}`}</option>
                {assignableFor(note, daOf).map((p) => (
                  <option key={p.id} value={p.id}>
                    {personLabel(tf, tp, p.id)}
                  </option>
                ))}
              </select>
            )}
          </span>
        </div>

      </div>

      {panel === "replies" && <Replies {...props} />}
      {panel === "history" && (
        <ol className="text-muted-foreground mx-3.5 mb-3 ml-11 space-y-1 border-l pl-3 text-[11.5px]">
          {note.history.map((e, i) => (
            <li key={i}>
              <span className="num">{when(locale, e.at)}</span> · <EventLine event={e} />
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export function EventLine({ event: e }: { event: FeedEvent }) {
  const tf = useTranslations("fil");
  const tp = useTranslations("filpage");
  const list = (rs: Extract<FeedEvent, { added: unknown }>["added"]) => rs.map((r) => recipientLabel(tf, r)).join(", ");
  switch (e.type) {
    case "created":
      return <>{tp("history.created", { by: e.by?.name ?? "—" })}</>;
    case "status": {
      const v = { from: tp(`status.${e.from}`), to: tp(`status.${e.to}`) };
      return <>{e.by ? tp("history.status", { ...v, by: e.by.name }) : tp("history.statusAnon", v)}</>;
    }
    case "reply":
      return <>{e.added.length ? tp("history.replyAdds", { by: e.by.name, list: list(e.added) }) : tp("history.reply", { by: e.by.name })}</>;
    case "assign": {
      const by = e.by?.name ?? "—";
      if (!e.personId) return <>{tp("history.unassign", { by })}</>;
      const name = personLabel(tf, tp, e.personId);
      return <>{e.added.length ? tp("history.assignAdds", { name, by, list: list(e.added) }) : tp("history.assign", { name, by })}</>;
    }
  }
}

function Replies({ note, artist, canAct, daOf, onReply, onStatus, myRole = null, onAttach, attachCtx }: NoteCardProps) {
  const tp = useTranslations("filpage");
  const locale = useLocale();
  return (
    <div className="mx-3.5 mb-3.5 ml-11 space-y-2.5">
      {note.replies.length > 0 && (
        <ul className="space-y-2 border-l-2 pl-3">
          {note.replies.map((r) => (
            <li key={r.id} className="text-[12.5px] leading-snug">
              <p className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">{r.by.name}</span> · <span className="tabular-nums">{when(locale, r.at)}</span>
              </p>
              <p>
                <MentionText text={r.text} artistId={note.artistId} daOf={daOf} />
              </p>
            </li>
          ))}
        </ul>
      )}
      {canAct ? (
        <FeedComposer
          note={note}
          artistName={artist?.name ?? null}
          daOf={daOf}
          myRole={myRole}
          onReply={onReply}
          onStatus={onStatus}
          onAttach={onAttach}
          attachCtx={attachCtx}
        />
      ) : (
        <p className="text-[11px] text-muted-foreground">{tp("readOnly")}</p>
      )}
    </div>
  );
}

/**
 * Le statut, visible et explicite : « ● Décidé ▾ ». Le vrai <select> natif est posé dessus
 * (clavier, lecteur d'écran, rendu serveur testé). Sans droit d'agir : la pastille seule.
 */
export function StatusPill({
  status,
  canAct,
  onStatus,
  tip = false,
  onDismissTip,
  size = "sm",
}: {
  status: FeedStatus;
  canAct: boolean;
  onStatus: (s: FeedStatus) => void;
  tip?: boolean;
  onDismissTip?: () => void;
  size?: "sm" | "md";
}) {
  const tp = useTranslations("filpage");
  return (
    <span className="relative inline-flex">
      <span
        className={cn(
          "has-[select:focus-visible]:ring-ring text-foreground/80 hover:bg-muted relative inline-flex items-center gap-1 rounded-md font-medium transition-colors duration-200 has-[select:focus-visible]:ring-2",
          size === "md" ? "h-8 px-2.5 text-[13px]" : "h-7 px-2 text-[13px]",
        )}
        title={canAct ? tp("status.label") : undefined}
      >
        {canAct ? <span aria-hidden>{tp(`status.${status}`)}</span> : <span data-status={status}>{tp(`status.${status}`)}</span>}
        {canAct && <ChevronsUpDown className="text-muted-foreground size-3.5" aria-hidden />}
        {canAct && (
          <select
            aria-label={tp("status.label")}
            value={status}
            onChange={(e) => {
              onStatus(e.target.value as FeedStatus);
              onDismissTip?.();
            }}
            className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
          >
            {FEED_STATUSES.map((s) => (
              <option key={s} value={s}>
                {tp(`status.${s}`)}
              </option>
            ))}
          </select>
        )}
      </span>
      {/* Première visite : on montre où se change le statut, une fois. */}
      {tip && canAct && (
        <span
          role="note"
          className="bg-foreground text-background absolute bottom-full left-0 z-20 mb-2 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium whitespace-nowrap shadow-lg"
        >
          {tp("tip.status")}
          <button type="button" onClick={onDismissTip} className="bg-background/15 hover:bg-background/25 rounded px-1.5 py-0.5 text-[11px]">
            {tp("tip.ok")}
          </button>
          <span aria-hidden className="bg-foreground absolute top-full left-4 size-2 -translate-y-1 rotate-45" />
        </span>
      )}
    </span>
  );
}
