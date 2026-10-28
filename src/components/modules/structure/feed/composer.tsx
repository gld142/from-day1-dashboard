"use client";

/**
 * La zone de réponse du fil, partagée par la note (dépliée) et le panneau de conversation :
 * réponses toutes faites en un clic (Validé, Besoin d'infos, Relancé), « Transmettre à » un
 * service (une mention, rien à recopier), pièce jointe traduite par Day One, puis le texte libre
 * (⌘/Ctrl + Entrée envoie). Ce que les mentions ajouteront aux destinataires s'annonce avant l'envoi.
 */
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, CornerUpRight, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { JOB_ROLES, type JobRole } from "@/lib/roles";
import type { FeedAttachment } from "@/lib/userdata/feed-attachment";
import { FEED_TEXT_MAX, mentionEffects, statusOf, type DaOf, type FeedNote, type FeedStatus } from "@/lib/userdata/feed-model";
import { cn } from "@/lib/utils";
import { AttachmentPicker, type AttachmentCtxInput } from "./attachment-card";
import { daLabel, recipientLabel, roleLabel } from "./labels";

export type FeedComposerProps = {
  note: FeedNote;
  artistName: string | null;
  daOf: DaOf;
  /** Mon service : on ne me propose pas de me transmettre la note. */
  myRole: JobRole | null;
  onReply: (text: string) => void;
  onStatus: (s: FeedStatus) => void;
  onAttach?: (a: FeedAttachment) => void;
  attachCtx?: AttachmentCtxInput;
  /** Le panneau de conversation pose le curseur dans le texte à l'ouverture. */
  autoFocus?: boolean;
  className?: string;
};

export function FeedComposer({
  note,
  artistName,
  daOf,
  myRole,
  onReply,
  onStatus,
  onAttach,
  attachCtx,
  autoFocus = false,
  className,
}: FeedComposerProps) {
  const tf = useTranslations("fil");
  const tp = useTranslations("filpage");
  const [text, setText] = useState("");
  /* La zone de dépôt ne s'ouvre qu'à la demande : la réponse garde la place. */
  const [showAttach, setShowAttach] = useState(false);
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
    <div className={cn("bg-muted/50 rounded-lg p-2.5", className)}>
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
        {forwardTo.length > 0 && (
          <span className="text-muted-foreground ml-1.5 inline-flex items-center gap-1 text-[11.5px]">
            <CornerUpRight className="size-3" aria-hidden />
            {tp("quick.forward")}
          </span>
        )}
        {forwardTo.map((r) => (
          <QuickChip key={r} tone="brand" onClick={() => onReply(tp("quick.forwardText", { service: roleLabel(tf, r) }))}>
            {roleLabel(tf, r)}
          </QuickChip>
        ))}
        {onAttach && attachCtx && (
          <QuickChip onClick={() => setShowAttach((v) => !v)} pressed={showAttach}>
            <Paperclip className="size-3" aria-hidden />
            {tp("attach.button")}
          </QuickChip>
        )}
      </div>
      {onAttach && attachCtx && showAttach && (
        <AttachmentPicker
          onAttach={(a) => {
            onAttach(a);
            setShowAttach(false);
          }}
          ctx={attachCtx}
          artistId={note.artistId}
          artistName={artistName}
          className="mb-2"
        />
      )}
      <Textarea
        aria-label={tp("replies.label")}
        value={text}
        maxLength={FEED_TEXT_MAX}
        rows={2}
        autoFocus={autoFocus}
        placeholder={tp("replies.placeholder")}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
        }}
        className="bg-background text-[12.5px]"
      />
      <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
        {effects.added.length > 0 && (
          <span className="text-brand">{tp("replies.adds", { list: effects.added.map((r) => recipientLabel(tf, r)).join(", ") })}</span>
        )}
        {effects.outOfScope.length > 0 && (
          <span className="text-warning">
            {tp("replies.outOfScope", { names: effects.outOfScope.map((d) => daLabel(tf, d)).join(", ") })}
          </span>
        )}
        <Button size="sm" className="ml-auto gap-1.5" disabled={!text.trim()} onClick={send}>
          <Send className="size-3.5" aria-hidden />
          {tp("replies.send")}
        </Button>
      </div>
    </div>
  );
}

export function QuickChip({
  onClick,
  children,
  tone = "neutral",
  pressed,
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: "neutral" | "brand";
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors",
        tone === "brand" ? "border-brand/30 bg-brand/10 text-brand hover:bg-brand/20" : "bg-background hover:border-foreground/25",
      )}
    >
      {children}
    </button>
  );
}
