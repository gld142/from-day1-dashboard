"use client";

/**
 * La conversation d'une note, à droite du fil (plein écran sur un petit écran) : comme un fil de
 * discussion, pas un commentaire et un historique rangés à part.
 *
 * - En tête : la note, son artiste, l'enjeu, le statut (pastille), chez qui elle attend, et les
 *   gestes (Je m'en occupe, Traité, Ouvrir).
 * - Au milieu, sur une seule ligne de temps (feed-thread.ts) : la note, les réponses en bulles —
 *   les miennes à droite —, les gestes de l'équipe en lignes discrètes, les pièces jointes
 *   traduites ; sous chaque message, les réactions en un clic ; à la fin, « Vu par ».
 * - En bas, toujours là : la zone de réponse (composer.tsx).
 */
import { useEffect, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, Check, Eye, Hand, X } from "lucide-react";
import { ArtistAvatar } from "@/components/dashboard/artist-badge";
import { Button } from "@/components/ui/button";
import type { Artist } from "@/lib/demo/types";
import { fmtDate, fmtEur } from "@/lib/format";
import type { JobRole } from "@/lib/roles";
import type { FeedAttachment } from "@/lib/userdata/feed-attachment";
import { getPerson, openPlan, statusOf, type DaOf, type FeedNote, type FeedStatus, type OpenPlan } from "@/lib/userdata/feed-model";
import { REACTIONS, type Reaction } from "@/lib/userdata/feed-reactions";
import { isMine } from "@/lib/userdata/feed-seen";
import type { Stake, Waiting } from "@/lib/userdata/feed-stakes";
import { lastMessageAt, seenBy, threadItems } from "@/lib/userdata/feed-thread";
import { cn } from "@/lib/utils";
import { AttachmentCard, type AttachmentCtxInput } from "./attachment-card";
import { FeedComposer } from "./composer";
import { daLabel, recipientLabel, roleLabel, toLabel } from "./labels";
import { MentionText } from "./mention-text";
import { EventLine, StatusPill, URGENCY_BAR } from "./note-card";

type Reactions = Record<string, Partial<Record<Reaction, string[]>>>;

export type ConversationPanelProps = {
  note: FeedNote;
  artist: Pick<Artist, "hue" | "initials" | "name"> | null;
  today: string;
  canAct: boolean;
  canSeeArtist: boolean;
  daOf: DaOf;
  /** Moi : service, DA, clé de lecteur (feed-seen). */
  myRole: JobRole | null;
  myDaId: string | null;
  myViewer: string;
  myPersonId: string | null;
  attachments: FeedAttachment[];
  reactions: Reactions;
  /** Ce que chaque lecteur a vu (feed-seen) : pour « Vu par ». */
  seenState: Record<string, Record<string, string>>;
  stake: Stake | null;
  waiting: Waiting | null;
  onClose: () => void;
  onStatus: (s: FeedStatus) => void;
  onDone: () => void;
  onAssign: (personId: string | null) => void;
  onReply: (text: string) => void;
  onOpen: (plan: OpenPlan) => void;
  onAttach: (a: FeedAttachment) => void;
  onReact: (messageId: string, r: Reaction) => void;
  attachCtx: AttachmentCtxInput;
  className?: string;
};

const when = (locale: string, iso: string) =>
  fmtDate(locale, iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function ConversationPanel(p: ConversationPanelProps) {
  const { note, daOf } = p;
  const tf = useTranslations("fil");
  const tp = useTranslations("filpage");
  const tn = useTranslations("nav");
  const locale = useLocale();
  const status = statusOf(note);
  const plan = openPlan(note, p.canSeeArtist);
  const items = useMemo(() => threadItems(note, p.attachments), [note, p.attachments]);
  const last = lastMessageAt(note, p.attachments);
  const viewers = seenBy(p.seenState, note.id, last, p.myViewer);
  const body = useRef<HTMLDivElement>(null);

  /* À l'ouverture et à chaque nouveau message : on descend au plus récent. */
  useEffect(() => {
    body.current?.scrollTo({ top: body.current.scrollHeight });
  }, [note.id, items.length]);

  const viewerLabel = (v: string) =>
    v === "structure" ? tf("author.structure") : v.startsWith("da:") ? daLabel(tf, v.slice(3)) : roleLabel(tf, v as JobRole);
  const openLabel = note.link
    ? note.link.kind === "page"
      ? tp("link.open.page", { page: tn(`items.${note.link.href.slice(1)}`) })
      : tp(`link.open.${note.link.kind}`)
    : "";
  const assigneeName = note.assigneeId ? (getPerson(note.assigneeId)?.name ?? note.assigneeId) : null;
  const canTakeIt = p.canAct && status !== "done" && !!p.myPersonId && note.assigneeId !== p.myPersonId;
  const stakeText = p.stake
    ? p.stake.kind === "advance"
      ? tp("stake.advance", { amount: fmtEur(locale, p.stake.amount, { compact: true }), pct: p.stake.pct })
      : p.stake.kind === "claim"
        ? tp("stake.claim", { amount: fmtEur(locale, p.stake.amount) })
        : tp("stake.valuation", { amount: fmtEur(locale, p.stake.amount, { compact: true }) })
    : null;

  const reactionsRow = (messageId: string, mine: boolean) => {
    const r = p.reactions[messageId] ?? {};
    return (
      <div className={cn("mt-1 flex flex-wrap items-center gap-1", mine && "justify-end")}>
        {REACTIONS.map((emoji) => {
          const who = r[emoji] ?? [];
          const pressed = who.includes(p.myViewer);
          return (
            <button
              key={emoji}
              type="button"
              aria-pressed={pressed}
              aria-label={`${tp("conv.react")} ${emoji}`}
              title={who.length ? who.map(viewerLabel).join(", ") : tp("conv.react")}
              onClick={() => p.onReact(messageId, emoji)}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-[12px] tabular-nums transition-all",
                who.length
                  ? pressed
                    ? "border-brand/40 bg-brand/10"
                    : "bg-background"
                  : "border-transparent opacity-0 group-hover/msg:opacity-60 hover:!opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-50",
              )}
            >
              <span aria-hidden>{emoji}</span>
              {who.length > 0 && <span className="text-muted-foreground text-[11px]">{who.length}</span>}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <aside
      aria-label={tp("conv.title")}
      className={cn("bg-card flex min-h-0 flex-col overflow-hidden rounded-xl border border-l-[3px] shadow-lg", URGENCY_BAR[note.urgency], p.className)}
    >
      {/* En tête : la note et ce qu'on peut en faire. */}
      <header className="space-y-2 border-b px-4 pt-3 pb-3">
        <div className="flex items-start gap-3">
          {p.artist && <ArtistAvatar artist={p.artist} size="sm" />}
          <div className="min-w-0 flex-1">
            <p className="text-[14px] leading-snug font-semibold">
              <MentionText text={note.text} artistId={note.artistId} daOf={daOf} />
            </p>
            <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px]">
              <span className="text-foreground/85 font-semibold">{p.artist?.name ?? tf("note.noArtist")}</span>
              <span aria-hidden>·</span>
              <span>{tf("note.from", { from: note.fromName, to: toLabel(tf, note) })}</span>
              {stakeText && (
                <span className="bg-foreground/[0.06] text-foreground/85 rounded px-1.5 py-px font-medium tabular-nums">{stakeText}</span>
              )}
            </p>
          </div>
          <Button size="icon" variant="ghost" className="size-8 shrink-0" onClick={p.onClose} aria-label={tp("conv.close")} title={tp("conv.close")}>
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status={status} canAct={p.canAct} onStatus={p.onStatus} size="md" />
          {assigneeName ? (
            <span className="bg-foreground/[0.06] rounded-full px-2.5 py-1 text-[12px] font-medium">
              {tp("waiting.with", { name: assigneeName })}
              {p.waiting && <span className="text-muted-foreground"> · {tp("waiting.since", { days: p.waiting.days })}</span>}
            </span>
          ) : (
            <span className="text-muted-foreground rounded-full border border-dashed px-2.5 py-1 text-[12px]">{tp("waiting.nobody")}</span>
          )}
          {note.dueDate && (
            <span className="text-muted-foreground text-[12px] tabular-nums">
              {tf("note.due", { date: fmtDate(locale, note.dueDate, { day: "numeric", month: "long" }) })}
            </span>
          )}
          <span className="ml-auto flex flex-wrap items-center gap-1">
            {canTakeIt && (
              <Button size="sm" variant="outline" className="h-8 gap-1 text-[12px]" onClick={() => p.myPersonId && p.onAssign(p.myPersonId)}>
                <Hand className="size-3.5" aria-hidden />
                {tp("quick.mine")}
              </Button>
            )}
            {p.canAct && status !== "done" && (
              <Button size="sm" variant="outline" className="h-8 gap-1 text-[12px]" onClick={p.onDone}>
                <Check className="size-3.5" aria-hidden />
                {tf("note.markDone")}
              </Button>
            )}
            {plan && (
              <Button size="sm" className="h-8 gap-1 text-[12px]" onClick={() => p.onOpen(plan)}>
                <ArrowUpRight className="size-3.5" aria-hidden />
                {openLabel}
              </Button>
            )}
          </span>
        </div>
      </header>

      {/* La conversation, du plus ancien au plus récent. */}
      <div ref={body} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {items.map((item) => {
          if (item.kind === "event") {
            return (
              <p key={`e-${item.at}-${item.event.type}`} className="text-muted-foreground flex items-center justify-center gap-2 text-center text-[11px]">
                <span className="bg-border h-px w-6" aria-hidden />
                <span>
                  <EventLine event={item.event} /> · <span className="tabular-nums">{when(locale, item.at)}</span>
                </span>
                <span className="bg-border h-px w-6" aria-hidden />
              </p>
            );
          }
          if (item.kind === "attachment") {
            return <AttachmentCard key={`a-${item.attachment.id}`} attachment={item.attachment} role={p.myRole ?? "direction"} />;
          }
          const isNote = item.kind === "note";
          const by = isNote ? null : item.reply.by;
          const mine = by ? isMine(by, p.myRole, p.myDaId) : false;
          const id = isNote ? note.id : item.reply.id;
          const name = isNote ? note.fromName : by!.name;
          const text = isNote ? note.text : item.reply.text;
          return (
            <div key={`m-${id}`} className={cn("group/msg flex flex-col", mine ? "items-end" : "items-start")}>
              <p className="text-muted-foreground mb-0.5 px-1 text-[11px]">
                <span className="text-foreground font-semibold">{mine ? tp("conv.you") : name}</span>
                {isNote && <span> {tp("conv.note")}</span>}
                <span className="tabular-nums"> · {when(locale, item.at)}</span>
              </p>
              <div
                className={cn(
                  "max-w-[88%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug",
                  isNote
                    ? "bg-foreground/[0.05] border font-medium"
                    : mine
                      ? "bg-brand/12 rounded-br-md"
                      : "bg-muted rounded-bl-md",
                )}
              >
                <MentionText text={text} artistId={note.artistId} daOf={daOf} />
              </div>
              {!isNote && item.added.length > 0 && (
                <p className="text-brand mt-0.5 px-1 text-[11px]">
                  {tp("conv.adds", { list: item.added.map((r) => recipientLabel(tf, r)).join(", ") })}
                </p>
              )}
              {reactionsRow(id, mine)}
            </div>
          );
        })}
        <p className="text-muted-foreground flex items-center justify-end gap-1.5 text-[11px]">
          <Eye className="size-3" aria-hidden />
          {viewers.length ? tp("conv.seen", { list: viewers.map(viewerLabel).join(", ") }) : tp("conv.notSeen")}
        </p>
      </div>

      {/* Toujours là : répondre, en un clic ou en texte libre. */}
      <footer className="border-t p-3">
        {p.canAct ? (
          <FeedComposer
            note={note}
            artistName={p.artist?.name ?? null}
            daOf={daOf}
            myRole={p.myRole}
            onReply={p.onReply}
            onStatus={p.onStatus}
            onAttach={p.onAttach}
            attachCtx={p.attachCtx}
            autoFocus
            className="bg-transparent p-0"
          />
        ) : (
          <p className="text-muted-foreground text-[12px]">{tp("readOnly")}</p>
        )}
      </footer>
    </aside>
  );
}
