"use client";

/**
 * Un texte du fil avec ses mentions en pastilles. Une mention de DA qui ne suit pas l'artiste de
 * la note s'affiche grisée : elle n'a rien envoyé (feed-model, `mentionEffects`).
 */
import { useTranslations } from "next-intl";
import { inPerimeter, splitMentions, type DaOf } from "@/lib/userdata/feed-model";
import { cn } from "@/lib/utils";
import { daLabel, roleLabel } from "./labels";

export function MentionText({ text, artistId, daOf }: { text: string; artistId: string | null; daOf: DaOf }) {
  const tf = useTranslations("fil");
  const tp = useTranslations("filpage");
  return (
    <>
      {splitMentions(text).map((seg, i) => {
        if (seg.type === "text") return <span key={i}>{seg.text}</span>;
        const m = seg.mention;
        const name = m.kind === "role" ? roleLabel(tf, m.role) : daLabel(tf, m.daId);
        const off = m.kind === "da" && !inPerimeter({ artistId }, m.daId, daOf);
        return (
          <span
            key={i}
            data-mention={off ? "out-of-scope" : "on"}
            title={off ? tp("mention.outOfScope", { name }) : tp("mention.title", { name })}
            className={cn(
              "mx-px inline-flex items-center rounded-full px-1.5 text-[0.92em] font-medium",
              off ? "bg-muted text-muted-foreground line-through" : "bg-brand/12 text-brand",
            )}
          >
            {seg.text}
          </span>
        );
      })}
    </>
  );
}
