"use client";

/**
 * Une note du fil : urgence, statut (quatre valeurs, « Traité » en un clic), échéance et sa
 * pastille, prise en charge, lien « Ouvrir », réponses en fil (avec mentions) et historique
 * daté, dépliables. Composant de présentation : l'état vit dans le store, les actions arrivent
 * en props (rendu testé sans navigateur, feed-components.test.ts).
 */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, History, MessageSquare } from "lucide-react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { Badge } from "@/components/ui/badge";
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
  /** Panneau ouvert au premier rendu (tests). */
  defaultPanel?: "replies" | "history" | null;
};

const when = (locale: string, iso: string) =>
  fmtDate(locale, iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function NoteCard(props: NoteCardProps) {
  const { note, today, canAct, canSeeArtist, artist, daOf } = props;
  const tf = useTranslations("fil");
  const tp = useTranslations("filpage");
  const tn = useTranslations("nav");
  const locale = useLocale();
  const [panel, setPanel] = useState<"replies" | "history" | null>(props.defaultPanel ?? null);
  const status = statusOf(note);
  const due = dueState(note, today);
  const plan = openPlan(note, canSeeArtist);
  const toggle = (p: "replies" | "history") => setPanel(panel === p ? null : p);

  const openLabel = note.link
    ? note.link.kind === "page"
      ? tp("link.open.page", { page: tn(`items.${note.link.href.slice(1)}`) })
      : tp(`link.open.${note.link.kind}`)
    : "";

  return (
    <li className={cn("py-3", status === "done" && "opacity-60")} data-note={note.id}>
      <div className="flex flex-wrap items-start gap-3">
        <Badge className={URGENCY_TONE[note.urgency]}>{tf(`urgency.${note.urgency}`)}</Badge>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug">
            <MentionText text={note.text} artistId={note.artistId} daOf={daOf} />
          </p>
          <p className="sheet-ink mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span>{tf("note.from", { from: note.fromName, to: toLabel(tf, note) })}</span>
            <span>{fmtDate(locale, note.createdAt.slice(0, 10), { day: "numeric", month: "short" })}</span>
            {note.dueDate && (
              <span className={note.urgency === "urgent" ? "text-destructive" : undefined}>
                {tf("note.due", { date: fmtDate(locale, note.dueDate, { day: "numeric", month: "long" }) })}
              </span>
            )}
            {due && (
              <span data-due={due} className={cn("rounded-full px-1.5 font-medium leading-4", DUE_TONE[due])}>
                {tp(`due.${due}`)}
              </span>
            )}
            <span data-assignee={note.assigneeId ?? ""}>
              {note.assigneeId ? tp("assign.taken", { name: personLabel(tf, tp, note.assigneeId) }) : tp("assign.unassigned")}
            </span>
            {note.doneAt && (
              <span>{tf("note.done", { date: fmtDate(locale, note.doneAt.slice(0, 10), { day: "numeric", month: "short" }) })}</span>
            )}
          </p>
        </div>
        {note.artistId && artist ? (
          canSeeArtist ? (
            <button type="button" className="shrink-0" onClick={() => props.onFilterArtist(note.artistId!)}>
              <ArtistBadge artist={artist} size="sm" />
            </button>
          ) : (
            <span className="shrink-0">
              <ArtistBadge artist={artist} size="sm" />
            </span>
          )
        ) : (
          <span className="shrink-0 text-[11px] text-muted-foreground">{tf("note.noArtist")}</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 pl-0 text-[12px] sm:pl-[4.5rem]">
        {canAct ? (
          <select
            aria-label={tp("status.label")}
            value={status}
            onChange={(e) => props.onStatus(e.target.value as FeedStatus)}
            className={cn("h-7 rounded-full border bg-background px-2 text-[12px] font-medium", STATUS_TONE[status])}
          >
            {FEED_STATUSES.map((s) => (
              <option key={s} value={s}>
                {tp(`status.${s}`)}
              </option>
            ))}
          </select>
        ) : (
          <span data-status={status} className={cn("rounded-full border px-2 py-0.5 font-medium", STATUS_TONE[status])}>
            {tp(`status.${status}`)}
          </span>
        )}
        {canAct && status !== "done" && (
          <Button size="sm" variant="outline" onClick={props.onDone}>
            {tf("note.markDone")}
          </Button>
        )}
        {canAct && (
          <select
            aria-label={tp("assign.label")}
            value={note.assigneeId ?? ""}
            onChange={(e) => props.onAssign(e.target.value || null)}
            className="h-7 max-w-[12rem] rounded-full border bg-background px-2 text-[12px] text-muted-foreground"
          >
            <option value="">{`${tp("assign.label")} : ${tp("assign.nobody")}`}</option>
            {assignableFor(note, daOf).map((p) => (
              <option key={p.id} value={p.id}>
                {personLabel(tf, tp, p.id)}
              </option>
            ))}
          </select>
        )}
        {plan && (
          <Button size="sm" variant="ghost" className="gap-1" onClick={() => props.onOpen(plan)}>
            <ExternalLink className="size-3.5" aria-hidden />
            {openLabel}
          </Button>
        )}
        <span className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" className="gap-1" aria-expanded={panel === "replies"} onClick={() => toggle("replies")}>
            <MessageSquare className="size-3.5" aria-hidden />
            <span data-replies={note.replies.length}>{tp("replies.toggle", { count: note.replies.length })}</span>
          </Button>
          <Button size="sm" variant="ghost" className="gap-1" aria-expanded={panel === "history"} onClick={() => toggle("history")}>
            <History className="size-3.5" aria-hidden />
            {tp("history.toggle", { count: note.history.length })}
          </Button>
        </span>
      </div>

      {panel === "replies" && <Replies {...props} />}
      {panel === "history" && (
        <ol className="mt-2 space-y-1 border-l pl-3 text-[11.5px] text-muted-foreground sm:ml-[4.5rem]">
          {note.history.map((e, i) => (
            <li key={i}>
              <span className="num">{when(locale, e.at)}</span> — <EventLine event={e} />
            </li>
          ))}
        </ol>
      )}
    </li>
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
    <div className="mt-2 space-y-2 sm:ml-[4.5rem]">
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
