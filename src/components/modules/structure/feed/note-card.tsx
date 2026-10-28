"use client";

/**
 * Une note du fil, en une ligne qu'on lit d'un coup d'œil : statut (une forme, pas une
 * couleur), texte, puis à droite l'échéance et qui l'a prise en charge. Les actions
 * (« Traité », « Ouvrir ») n'apparaissent qu'au survol ou au focus — toujours là sur un
 * écran tactile. Réponses et historique se déplient sous la note. L'urgence n'est plus une
 * pastille par ligne : la vue regroupe les notes par urgence.
 *
 * Le statut et la prise en charge restent des <select> natifs, posés invisibles sur leur
 * pastille : clavier, lecteur d'écran et rendu serveur testé (feed-components.test.ts)
 * gardent le vrai contrôle. Composant de présentation : l'état vit dans le store.
 */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowUpRight,
  Check,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  History,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Artist } from "@/lib/demo/types";
import { fmtDate } from "@/lib/format";
import {
  FEED_STATUSES,
  FEED_TEXT_MAX,
  assignableFor,
  dueState,
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
import { cn } from "@/lib/utils";
import { daLabel, personLabel, recipientLabel, toLabel } from "./labels";
import { MentionText } from "./mention-text";

/* Pastilles de l'ordre du jour imprimable (committee-agenda.tsx) — la note, elle, n'en a plus. */
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
  /** Panneau ouvert au premier rendu (tests). */
  defaultPanel?: "replies" | "history" | null;
};

const when = (locale: string, iso: string) =>
  fmtDate(locale, iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** « Camille (Juridique) » → « C », « Sofia K. (DA) » → « SK ». */
const initialsOf = (label: string) =>
  label
    .replace(/\s*\(.*\)\s*$/, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function NoteCard(props: NoteCardProps) {
  const { note, today, canAct, canSeeArtist, artist, daOf, active = false } = props;
  const tf = useTranslations("fil");
  const tp = useTranslations("filpage");
  const tn = useTranslations("nav");
  const locale = useLocale();
  const [panel, setPanel] = useState<"replies" | "history" | null>(props.defaultPanel ?? null);
  const status = statusOf(note);
  const due = dueState(note, today);
  const plan = openPlan(note, canSeeArtist);
  const toggle = (p: "replies" | "history") => setPanel(panel === p ? null : p);
  const { Icon, tone } = STATUS_GLYPH[status];
  const assignee = note.assigneeId ? personLabel(tf, tp, note.assigneeId) : null;
  const assigneeText = assignee ? tp("assign.taken", { name: assignee }) : tp("assign.unassigned");

  const openLabel = note.link
    ? note.link.kind === "page"
      ? tp("link.open.page", { page: tn(`items.${note.link.href.slice(1)}`) })
      : tp(`link.open.${note.link.kind}`)
    : "";

  return (
    <article
      data-note={note.id}
      className={cn(
        "group/note relative rounded-lg transition-colors",
        active ? "bg-brand/[0.06] ring-brand/30 ring-1" : "hover:bg-foreground/[0.025]",
      )}
    >
      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-3 px-3 py-2.5">
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
              "line-clamp-2 max-w-[72ch] text-[13.5px] leading-snug",
              status === "done" ? "text-muted-foreground" : "text-foreground",
            )}
          >
            <MentionText text={note.text} artistId={note.artistId} daOf={daOf} />
          </p>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]">
            {note.artistId && artist ? (
              canSeeArtist ? (
                <button
                  type="button"
                  className="text-foreground/80 hover:text-foreground font-medium underline-offset-2 hover:underline"
                  onClick={() => props.onFilterArtist(note.artistId!)}
                >
                  {artist.name}
                </button>
              ) : (
                <span className="text-foreground/80 font-medium">{artist.name}</span>
              )
            ) : (
              <span>{tf("note.noArtist")}</span>
            )}
            <span aria-hidden>·</span>
            <span>{tf("note.from", { from: note.fromName, to: toLabel(tf, note) })}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{fmtDate(locale, note.createdAt.slice(0, 10), { day: "numeric", month: "short" })}</span>
            {note.doneAt && (
              <>
                <span aria-hidden>·</span>
                <span>{tf("note.done", { date: fmtDate(locale, note.doneAt.slice(0, 10), { day: "numeric", month: "short" }) })}</span>
              </>
            )}
            <button
              type="button"
              aria-expanded={panel === "replies"}
              onClick={() => toggle("replies")}
              title={tp("replies.toggle", { count: note.replies.length })}
              className={cn(
                "hover:text-foreground ml-1 inline-flex items-center gap-1 rounded px-1 tabular-nums",
                panel === "replies" && "text-foreground",
              )}
            >
              <MessageSquare className="size-3.5" aria-hidden />
              <span data-replies={note.replies.length}>
                {note.replies.length > 0 && <span aria-hidden>{note.replies.length}</span>}
                <span className="sr-only">{tp("replies.toggle", { count: note.replies.length })}</span>
              </span>
            </button>
            <button
              type="button"
              aria-expanded={panel === "history"}
              onClick={() => toggle("history")}
              title={tp("history.toggle", { count: note.history.length })}
              className={cn(
                "hover:text-foreground inline-flex items-center gap-1 rounded px-1 tabular-nums",
                panel === "history" && "text-foreground",
              )}
            >
              <History className="size-3.5" aria-hidden />
              <span aria-hidden>{note.history.length}</span>
              <span className="sr-only">{tp("history.toggle", { count: note.history.length })}</span>
            </button>
          </p>
        </div>

        <div className="flex items-start gap-2.5">
          {/* Échéance : rouge seulement en retard, appuyée si elle tombe cette semaine. */}
          <span
            className={cn(
              "w-[5.5rem] pt-0.5 text-right text-[12px] leading-tight tabular-nums",
              due === "overdue"
                ? "text-destructive font-semibold"
                : due === "soon"
                  ? "text-foreground font-medium"
                  : "text-muted-foreground",
            )}
            title={note.dueDate ? tf("note.due", { date: fmtDate(locale, note.dueDate, { day: "numeric", month: "long" }) }) : undefined}
          >
            {note.dueDate ? fmtDate(locale, note.dueDate, { day: "numeric", month: "short" }) : "—"}
            {due && (
              <span data-due={due} className="block text-[10.5px] font-normal">
                {tp(`due.${due}`)}
              </span>
            )}
          </span>

          {/* Prise en charge : initiales, cercle pointillé quand c'est à attribuer. */}
          <span
            data-assignee={note.assigneeId ?? ""}
            title={assigneeText}
            className={cn(
              "has-[select:focus-visible]:ring-ring relative flex size-7 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold has-[select:focus-visible]:ring-2",
              assignee ? "bg-foreground/[0.07] text-foreground/80" : "text-muted-foreground border border-dashed",
            )}
          >
            <span aria-hidden>{assignee ? initialsOf(assignee) : "+"}</span>
            <span className="sr-only">{assigneeText}</span>
            {canAct && (
              <select
                aria-label={tp("assign.label")}
                value={note.assigneeId ?? ""}
                onChange={(e) => props.onAssign(e.target.value || null)}
                className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
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
        {/* Actions : une barre qui flotte sur l'échéance au survol ou au focus ; sans souris
            (tactile), elle reste visible sous le texte. Rien à faire : pas de barre. */}
        {((canAct && status !== "done") || plan) && (
          <div className="bg-card absolute top-1.5 right-2 flex items-center gap-0.5 rounded-md border p-0.5 opacity-0 shadow-sm transition-opacity group-focus-within/note:opacity-100 group-hover/note:opacity-100 [@media(hover:none)]:static [@media(hover:none)]:col-start-2 [@media(hover:none)]:mt-1 [@media(hover:none)]:w-fit [@media(hover:none)]:opacity-100">
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
        <ol className="text-muted-foreground mx-3 mb-3 ml-11 space-y-1 border-l pl-3 text-[11.5px]">
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

function Replies({ note, canAct, daOf, onReply }: NoteCardProps) {
  const tf = useTranslations("fil");
  const tp = useTranslations("filpage");
  const locale = useLocale();
  const [text, setText] = useState("");
  const effects = mentionEffects(note, text, daOf);
  const send = () => {
    if (!text.trim()) return;
    onReply(text);
    setText("");
  };
  return (
    <div className="mx-3 mb-3 ml-11 space-y-2">
      {note.replies.length > 0 && (
        <ul className="space-y-2 border-l pl-3">
          {note.replies.map((r) => (
            <li key={r.id} className="text-[12.5px] leading-snug">
              <p className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{r.by.name}</span> · <span className="num">{when(locale, r.at)}</span>
              </p>
              <p>
                <MentionText text={r.text} artistId={note.artistId} daOf={daOf} />
              </p>
            </li>
          ))}
        </ul>
      )}
      {canAct ? (
        <div>
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
            className="text-[12.5px]"
          />
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
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
