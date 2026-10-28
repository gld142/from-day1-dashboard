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
    <div className={cn("space-y-2", className)}>
      {onAttach && attachCtx && showAttach && (
        <AttachmentPicker
          onAttach={(a) => {
            onAttach(a);
            setShowAttach(false);
          }}
          ctx={attachCtx}
          artistId={note.artistId}
          artistName={artistName}
        />
      )}
      {/* Un seul bloc : le texte, puis sa barre d'outils (réponses en un clic, transmettre, joindre, envoyer). */}
      <div className="bg-background focus-within:border-foreground/30 rounded-lg border transition-colors">
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
          className="min-h-14 resize-none border-0 bg-transparent px-3 py-2.5 text-[13px] shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1 border-t px-1.5 py-1.5">
          <QuickChip
            onClick={() => {
              if (status !== "done") onStatus("decided");
              onReply(tp("quick.okText"));
            }}
          >
            <Check className="size-3.5" aria-hidden />
            {tp("quick.ok")}
          </QuickChip>
          <QuickChip onClick={() => onReply(tp("quick.infoText"))}>{tp("quick.info")}</QuickChip>
          <QuickChip onClick={() => onReply(tp("quick.chaseText"))}>{tp("quick.chase")}</QuickChip>
          {forwardTo.length > 0 && (
            <span className="text-muted-foreground ml-1 inline-flex items-center gap-1 border-l pl-2 text-[12px]">
              <CornerUpRight className="size-3.5" aria-hidden />
              {tp("quick.forward")}
            </span>
          )}
          {forwardTo.map((r) => (
            <QuickChip key={r} tone="link" onClick={() => onReply(tp("quick.forwardText", { service: roleLabel(tf, r) }))}>
              {roleLabel(tf, r)}
            </QuickChip>
          ))}
          <span className="ml-auto flex items-center gap-1">
            {onAttach && attachCtx && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-pressed={showAttach}
                aria-label={tp("attach.button")}
                title={tp("attach.button")}
                onClick={() => setShowAttach((v) => !v)}
                className={cn("text-muted-foreground h-7 px-2", showAttach && "bg-muted text-foreground")}
              >
                <Paperclip className="size-3.5" aria-hidden />
              </Button>
            )}
            <Button size="sm" className="h-7 gap-1.5 px-2.5 text-[12px]" disabled={!text.trim()} onClick={send}>
              <Send className="size-3.5" aria-hidden />
              {tp("replies.send")}
            </Button>
          </span>
        </div>
      </div>
      {(effects.added.length > 0 || effects.outOfScope.length > 0) && (
        <p className="text-muted-foreground flex flex-wrap gap-x-3 px-1 text-[11.5px]">
          {effects.added.length > 0 && (
            <span className="text-foreground/80">{tp("replies.adds", { list: effects.added.map((r) => recipientLabel(tf, r)).join(", ") })}</span>
          )}
          {effects.outOfScope.length > 0 && (
            <span className="text-warning">
              {tp("replies.outOfScope", { names: effects.outOfScope.map((d) => daLabel(tf, d)).join(", ") })}
            </span>
          )}
        </p>
      )}
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
  tone?: "neutral" | "link";
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        "hover:bg-muted inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium transition-colors",
        tone === "link" ? "text-foreground/80 hover:text-foreground" : "text-foreground/85",
      )}
    >
      {children}
    </button>
  );
}
