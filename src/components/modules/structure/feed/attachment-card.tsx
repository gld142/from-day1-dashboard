"use client";

/**
 * Pièce jointe d'une note du fil, « traduite par Day One » : un relevé, un tableau Excel ou un
 * contrat, résumé pour les services qui ne l'ont pas produit (lib/userdata/feed-attachment.ts).
 *
 * - `AttachmentCard` : la carte, sur un fond teinté de la marque (jamais blanc sur blanc), badge
 *   « Traduit par Day One », titre, chiffres clés en grand, points, puis la ligne du service
 *   courant MISE EN AVANT ; les autres services se déplient sous « Pour les autres services »
 *   (<details> natif : clavier, lecteur d'écran et rendu serveur testé sans état).
 * - `AttachmentPicker` : bouton + zone de dépôt pour un CSV / XLSX, et « Traduire le contrat de … »
 *   quand la note a un artiste. Le fichier est lu dans le navigateur, rien n'est envoyé.
 *
 * Textes : namespace de page `filattach` (envoyé avec `filpage`, messages/index.ts).
 */
import { useId, useRef, useState, type DragEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronDown,
  CircleAlert,
  FileSpreadsheet,
  LoaderCircle,
  Paperclip,
  Receipt,
  ScrollText,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { JOB_ROLES, type JobRole } from "@/lib/roles";
import {
  ATTACHMENT_ACCEPT,
  isAttachmentError,
  readAttachment,
  translateContract,
  type AttachmentCtx,
  type AttachmentResult,
  type AttachT,
  type FeedAttachment,
  type FeedAttachmentKind,
} from "@/lib/userdata/feed-attachment";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<FeedAttachmentKind, LucideIcon> = {
  statement: Receipt,
  sheet: FileSpreadsheet,
  contract: ScrollText,
};

/* ─────────── Carte ─────────── */

export type AttachmentCardProps = {
  attachment: FeedAttachment;
  /** Le service de celui qui lit : sa ligne passe devant. null = vue d'ensemble (tout déplié). */
  role: JobRole | null;
  className?: string;
};

export function AttachmentCard({ attachment: a, role, className }: AttachmentCardProps) {
  const t = useTranslations("filattach");
  const Icon = KIND_ICON[a.kind];
  const mine = role ? (a.forRoles[role] ?? null) : null;
  const others = JOB_ROLES.filter((r) => r !== role && a.forRoles[r]);

  return (
    <section
      data-attachment={a.id}
      aria-label={t("card.label", { name: a.name })}
      className={cn(
        "border-brand/25 bg-brand/[0.06] dark:bg-brand/[0.1] rounded-xl border p-3.5 text-sm shadow-xs",
        className,
      )}
    >
      {/* En-tête : qui a traduit, quoi, joint par qui. */}
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="bg-brand text-brand-foreground inline-flex h-5 items-center gap-1 rounded-full px-2 font-medium">
          <Sparkles aria-hidden className="size-3" />
          {t("badge")}
        </span>
        <span className="text-foreground/80 inline-flex min-w-0 items-center gap-1">
          <Icon aria-hidden className="size-3.5 shrink-0" />
          <span className="sr-only">{t(`kinds.${a.kind}`)}</span>
          <span className="truncate">{a.name}</span>
        </span>
        <span aria-hidden className="bg-muted-foreground/50 size-1 rounded-full" />
        <span>{t("card.by", { name: a.addedBy.name })}</span>
      </div>

      <p className="text-foreground mt-2 text-[0.95rem] leading-snug font-semibold text-pretty">{a.headline}</p>

      {/* Chiffres clés : la valeur en grand, le libellé dessous. */}
      <dl aria-label={t("card.figures")} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {a.figures.map((f) => (
          <div key={f.label} className="bg-background/70 dark:bg-background/40 flex min-w-0 flex-col-reverse rounded-lg px-2.5 py-2">
            <dt className="text-muted-foreground mt-0.5 truncate text-xs">{f.label}</dt>
            <dd className="text-foreground truncate text-lg leading-tight font-semibold tabular-nums" title={f.value}>
              {f.value}
            </dd>
          </div>
        ))}
      </dl>

      <ul className="text-foreground/90 mt-3 space-y-1">
        {a.points.map((p) => (
          <li key={p} className="flex gap-2 leading-snug">
            <span aria-hidden className="bg-brand/60 mt-[0.45em] size-1.5 shrink-0 rounded-full" />
            <span className="text-pretty">{p}</span>
          </li>
        ))}
      </ul>

      {/* Ma ligne, mise en avant. */}
      {role && (
        <div
          className={cn(
            "mt-3 rounded-lg border-l-[3px] px-3 py-2",
            mine ? "border-brand bg-background/90 dark:bg-background/60" : "border-border bg-background/50",
          )}
        >
          <p className={cn("leading-snug", mine ? "text-foreground" : "text-muted-foreground")}>
            <span className="font-semibold">{t("card.forMe", { role: t(`roles.${role}`) })}</span>{" "}
            {mine ?? t("card.nothingForYou")}
          </p>
        </div>
      )}

      {/* Les autres services, repliés (dépliés en vue d'ensemble). */}
      {others.length > 0 && (
        <details className="group/others mt-2" open={role === null}>
          <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs font-medium outline-none select-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
            <ChevronDown aria-hidden className="size-3.5 transition-transform group-open/others:rotate-180" />
            {role ? t("card.others") : t("card.byService")}
          </summary>
          <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 pl-4.5 leading-snug">
            {others.map((r) => (
              <div key={r} className="contents">
                <dt className="text-foreground font-medium">{t(`roles.${r}`)}</dt>
                <dd className="text-muted-foreground text-pretty">{a.forRoles[r]}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}

/* ─────────── Contexte côté client ─────────── */

/** Ce que l'appelant fournit ; la langue, le traducteur et l'heure sont pris au moment de l'action. */
export type AttachmentCtxInput = Omit<AttachmentCtx, "t" | "locale" | "now"> & { now?: Date };

/** Le contexte complet pour `readAttachment` / `translateContract`, depuis un composant client. */
export function useAttachmentCtx(input: AttachmentCtxInput): () => AttachmentCtx {
  const t: AttachT = useTranslations("filattach");
  const locale = useLocale();
  return () => ({ ...input, t, locale, now: input.now ?? new Date() });
}

/* ─────────── Sélecteur ─────────── */

export type AttachmentPickerProps = {
  onAttach: (a: FeedAttachment) => void;
  /** Auteur (`by`), artiste de la note, jour de la démo, taux BCE éventuels. */
  ctx: AttachmentCtxInput;
  /** L'artiste de la note : propose « Traduire le contrat de … » (par défaut `ctx.artistId`). */
  artistId?: string | null;
  artistName?: string | null;
  disabled?: boolean;
  className?: string;
};

type Busy = "file" | "contract" | null;

export function AttachmentPicker({ onAttach, ctx, artistId, artistName, disabled = false, className }: AttachmentPickerProps) {
  const t = useTranslations("filattach");
  const noteArtistId = artistId ?? ctx.artistId ?? null;
  const noteArtistName = artistName ?? ctx.artistName ?? null;
  const makeCtx = useAttachmentCtx({ ...ctx, artistId: noteArtistId, artistName: noteArtistName });
  const input = useRef<HTMLInputElement>(null);
  const statusId = useId();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const off = disabled || busy !== null;

  const settle = (r: AttachmentResult) => {
    if (isAttachmentError(r)) setError(r.error);
    else {
      setError(null);
      onAttach(r);
    }
  };

  const readFile = async (file: File | undefined) => {
    if (!file || off) return;
    setBusy("file");
    setError(null);
    try {
      settle(await readAttachment(file, makeCtx()));
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  };

  const onContract = () => {
    if (off || !noteArtistId) return;
    setBusy("contract");
    setError(null);
    // Calcul synchrone : on laisse le navigateur peindre l'état de chargement d'abord.
    setTimeout(() => {
      try {
        settle(translateContract(noteArtistId, makeCtx()));
      } finally {
        setBusy(null);
      }
    }, 0);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    void readFile(e.dataTransfer.files[0]);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!off) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed px-3 py-2.5 transition-colors",
          over ? "border-brand bg-brand/10" : "border-border bg-muted/40 dark:bg-muted/20",
          off && "opacity-70",
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={off}
          aria-describedby={statusId}
          onClick={() => input.current?.click()}
        >
          {busy === "file" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Paperclip aria-hidden />}
          {t("picker.attach")}
        </Button>
        <span className="text-muted-foreground text-xs">{over ? t("picker.dropActive") : t("picker.drop")}</span>
        {noteArtistId && noteArtistName && (
          <Button type="button" variant="ghost" size="sm" disabled={off} onClick={onContract} className="sm:ml-auto">
            {busy === "contract" ? <LoaderCircle aria-hidden className="animate-spin" /> : <ScrollText aria-hidden />}
            {t("picker.contract", { artist: noteArtistName })}
          </Button>
        )}
        <input
          ref={input}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void readFile(e.target.files?.[0])}
        />
      </div>

      <div id={statusId} aria-live="polite" className="text-xs">
        {busy ? (
          <p className="text-muted-foreground inline-flex items-center gap-1.5">
            <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
            {busy === "file" ? t("picker.reading") : t("picker.translating")}
          </p>
        ) : error ? (
          <p role="alert" className="text-destructive inline-flex items-start gap-1.5">
            <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            {error}
          </p>
        ) : (
          <p className="text-muted-foreground">{t("picker.hint")}</p>
        )}
      </div>
    </div>
  );
}
