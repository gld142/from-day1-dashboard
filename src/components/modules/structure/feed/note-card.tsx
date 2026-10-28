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
import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowUpRight,
  Check,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CornerUpRight,
  Hand,
  History,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Artist } from "@/lib/demo/types";
import { fmtDate, fmtEur } from "@/lib/format";
import { JOB_ROLES, type JobRole } from "@/lib/roles";
import {
  FEED_STATUSES,
  FEED_TEXT_MAX,
  assignableFor,
  dueState,
  getPerson,
  mentionEffects,
  openPlan,
  statusOf,
  type DaOf,
  type FeedEvent,
  type FeedNote,
  type FeedStatus,
  type OpenPlan,
  type Urgency,
} from "@/lib/userdata/feed-model";
import type { Stake, Waiting } from "@/lib/userdata/feed-stakes";
import { cn } from "@/lib/utils";
import { daLabel, personLabel, recipientLabel, roleLabel, toLabel } from "./labels";
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
  urgent: "border-l-destructive",
  important: "border-l-warning",
  info: "border-l-brand/70",
};

/** L'étape se lit à la forme ; seule « en cours » prend l'accent de la marque. */
const STATUS_GLYPH: Record<FeedStatus, { Icon: LucideIcon; tone: string }> = {
  todo: { Icon: Circle, tone: "text-muted-foreground" },
  doing: { Icon: CircleDashed, tone: "text-brand" },
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
        "group/note bg-card relative rounded-lg border border-l-[3px] shadow-xs transition-shadow",
        URGENCY_BAR[note.urgency],
        active ? "ring-brand/40 ring-2" : "hover:shadow-sm",
        unread > 0 && !active && "ring-destructive/25 ring-1",
      )}
    >
      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-3 px-3.5 py-3">
        {/* Statut : la forme dit l'étape ; le vrai <select> est posé dessus. */}
        <span
          className="has-[select:focus-visible]:ring-ring relative mt-px flex size-5 items-center justify-center rounded-full has-[select:focus-visible]:ring-2"
          title={tp(`status.${status}`)}
        >
          <Icon className={cn("size-[18px]", tone)} aria-hidden />
          {canAct ? (
            <select
              aria-label={tp("status.label")}
              value={status}
              onChange={(e) => props.onStatus(e.target.value as FeedStatus)}
              className="absolute inset-0 cursor-pointer appearance-none opacity-0"
            >
              {FEED_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {tp(`status.${s}`)}
                </option>
              ))}
            </select>
          ) : (
            <span data-status={status} className="sr-only">
              {tp(`status.${status}`)}
            </span>
          )}
        </span>

        <div className="min-w-0">
          <p
            className={cn(
              "line-clamp-2 max-w-[72ch] text-[14px] leading-snug font-medium",
              status === "done" ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {unread > 0 && (
              <span className="bg-destructive mr-2 inline-flex translate-y-[-1px] items-center rounded-full px-1.5 align-middle text-[10.5px] leading-4 font-semibold text-white tabular-nums">
                {tp("unread", { count: unread })}
              </span>
            )}
            <MentionText text={note.text} artistId={note.artistId} daOf={daOf} />
          </p>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
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
              <span className="bg-foreground/[0.06] text-foreground/85 rounded px-1.5 py-px text-[11.5px] font-medium tabular-nums">
                {stakeText}
              </span>
            )}
            {note.doneAt && (
              <>
                <span aria-hidden>·</span>
                <span>{tf("note.done", { date: fmtDate(locale, note.doneAt.slice(0, 10), { day: "numeric", month: "short" }) })}</span>
              </>
            )}
          </p>

          {/* La discussion, visible sans rien ouvrir : la dernière réponse, puis Répondre. */}
          {last && panel !== "replies" && (
            <button
              type="button"
              onClick={() => openPanel("replies")}
              className="bg-muted/70 hover:bg-muted mt-2 block w-full max-w-[72ch] rounded-md px-3 py-2 text-left transition-colors"
            >
              <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                <MessageSquare className="size-3" aria-hidden />
                <span className="text-foreground font-semibold">{last.by.name}</span>
                <span className="tabular-nums">· {when(locale, last.at)}</span>
              </span>
              <span className="text-foreground/90 mt-0.5 line-clamp-2 block text-[12.5px] leading-snug">
                <MentionText text={last.text} artistId={note.artistId} daOf={daOf} />
              </span>
            </button>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
            <Button
              size="sm"
              variant={panel === "replies" ? "secondary" : "outline"}
              className="h-7 gap-1.5 px-2.5 text-[12px]"
              aria-expanded={panel === "replies"}
              onClick={() => openPanel("replies")}
            >
              <MessageSquare className="size-3.5" aria-hidden />
              {note.replies.length === 0 ? tp("thread.start") : tp("thread.reply")}
              <span data-replies={note.replies.length} className="text-muted-foreground tabular-nums">
                {note.replies.length > 0 && <span aria-hidden>{note.replies.length}</span>}
                <span className="sr-only">{tp("replies.toggle", { count: note.replies.length })}</span>
              </span>
            </Button>
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
                className={cn(
                  "mt-0.5 block rounded px-1 text-[10.5px] font-semibold",
                  due === "overdue" ? "bg-destructive text-white" : "bg-warning/15 text-warning",
                )}
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
              "has-[select:focus-visible]:ring-ring relative rounded-md px-2 py-0.5 text-right text-[11.5px] leading-tight has-[select:focus-visible]:ring-2",
              assigneeName ? "bg-foreground/[0.06] text-foreground/85" : "text-muted-foreground border border-dashed",
            )}
          >
            <span aria-hidden className="block font-semibold">
              {assigneeName ? tp("waiting.with", { name: assigneeName }) : tp("waiting.nobody")}
            </span>
            {props.waiting && (
              <span aria-hidden className="text-muted-foreground block text-[10.5px]">
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

        {/* Au survol (toujours visible sans souris) : les gestes qui comptent, en un clic. */}
        {(canTakeIt || (canAct && status !== "done") || plan) && (
          <div className="bg-card absolute top-2 right-2 flex items-center gap-0.5 rounded-md border p-0.5 opacity-0 shadow-sm transition-opacity group-focus-within/note:opacity-100 group-hover/note:opacity-100 [@media(hover:none)]:static [@media(hover:none)]:col-start-2 [@media(hover:none)]:mt-1 [@media(hover:none)]:w-fit [@media(hover:none)]:opacity-100">
            {canTakeIt && (
              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[12px]" onClick={takeIt}>
                <Hand className="size-3.5" aria-hidden />
                {tp("quick.mine")}
              </Button>
            )}
            {canAct && status !== "done" && (
              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[12px]" onClick={props.onDone}>
                <Check className="size-3.5" aria-hidden />
                {tf("note.markDone")}
              </Button>
            )}
            {plan && (
              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[12px]" onClick={() => props.onOpen(plan)}>
                <ArrowUpRight className="size-3.5" aria-hidden />
                {openLabel}
              </Button>
            )}
          </div>
        )}
      </div>

      {panel === "replies" && <Replies {...props} />}
      {panel === "history" && (
        <ol className="text-muted-foreground mx-3.5 mb-3 ml-11 space-y-1 border-l pl-3 text-[11.5px]">
          {note.history.map((e, i) => (
            <li key={i}>
              <span className="num">{when(locale, e.at)}</span> — <EventLine event={e} />
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

function EventLine({ event: e }: { event: FeedEvent }) {
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

function Replies({ note, canAct, daOf, onReply, onStatus, myRole = null }: NoteCardProps) {
  const tf = useTranslations("fil");
  const tp = useTranslations("filpage");
  const locale = useLocale();
  const [text, setText] = useState("");
  const effects = mentionEffects(note, text, daOf);
  const status = statusOf(note);
  const send = () => {
    if (!text.trim()) return;
    onReply(text);
    setText("");
  };
  /* Les services à qui transmettre : ceux qui ne l'ont pas déjà, sauf le mien. */
  const forwardTo = JOB_ROLES.filter((r) => r !== myRole && !note.to.includes(r));
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
        <div className="bg-muted/50 rounded-lg p-2.5">
          {/* En un clic : une réponse toute faite, ou la note transmise à un service. */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground mr-0.5 text-[11px] font-semibold tracking-wide uppercase">{tp("quick.title")}</span>
            <QuickChip
              onClick={() => {
                if (status !== "done") onStatus("decided");
                onReply(tp("quick.okText"));
              }}
            >
              <Check className="size-3" aria-hidden />
              {tp("quick.ok")}
            </QuickChip>
            <QuickChip onClick={() => onReply(tp("quick.infoText"))}>{tp("quick.info")}</QuickChip>
            <QuickChip onClick={() => onReply(tp("quick.chaseText"))}>{tp("quick.chase")}</QuickChip>
            <span className="text-muted-foreground ml-1.5 inline-flex items-center gap-1 text-[11.5px]">
              <CornerUpRight className="size-3" aria-hidden />
              {tp("quick.forward")}
            </span>
            {forwardTo.map((r) => (
              <QuickChip key={r} tone="brand" onClick={() => onReply(tp("quick.forwardText", { service: roleLabel(tf, r) }))}>
                {roleLabel(tf, r)}
              </QuickChip>
            ))}
          </div>
          <Textarea
            aria-label={tp("replies.label")}
            value={text}
            maxLength={FEED_TEXT_MAX}
            rows={2}
            placeholder={tp("replies.placeholder")}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
            className="bg-background text-[12.5px]"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {effects.added.length > 0 && (
              <span className="text-brand">{tp("replies.adds", { list: effects.added.map((r) => recipientLabel(tf, r)).join(", ") })}</span>
            )}
            {effects.outOfScope.length > 0 && (
              <span className="text-warning">
                {tp("replies.outOfScope", { names: effects.outOfScope.map((d) => daLabel(tf, d)).join(", ") })}
              </span>
            )}
            <Button size="sm" className="ml-auto" disabled={!text.trim()} onClick={send}>
              {tp("replies.send")}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">{tp("readOnly")}</p>
      )}
    </div>
  );
}

function QuickChip({
  onClick,
  children,
  tone = "neutral",
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: "neutral" | "brand";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors",
        tone === "brand"
          ? "border-brand/30 bg-brand/10 text-brand hover:bg-brand/20"
          : "bg-background hover:border-foreground/25",
      )}
    >
      {children}
    </button>
  );
}
