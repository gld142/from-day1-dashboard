"use client";

/**
 * « Ta part, c'est ton contrat » — l'artiste renseigne ce qui lui revient.
 *
 * L'estimateur sait ce que les streams génèrent (brut master) ; il ne sait pas
 * ce que l'artiste touche : ça dépend de SON contrat, et on ne l'invente pas.
 * Tant qu'il n'a rien renseigné, la part artiste est une hypothèse « simulée »
 * (badge). Trois façons d'y remédier, en onglets :
 *   1. saisir ses pourcentages (master, droits d'auteur) ;
 *   2. importer son contrat — lu localement, jamais envoyé — puis recopier
 *      les pourcentages qu'il y lit ;
 *   3. demander son contrat au label : courrier prêt à copier / envoyer.
 *
 * `variant="compact"` (Pulse) : une phrase + un bouton vers /revenue#ma-part.
 * Les parts sont persistées par artiste (shares-store) ; à l'enregistrement,
 * les pages abonnées recalculent leurs cascades et les badges passent à
 * « renseigné ».
 */
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Check, Copy, FileText, Mail, Percent, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getArtist } from "@/lib/demo/api";
import { fmtEur } from "@/lib/format";
import { DEAL_SHARE } from "@/lib/real/params";
import { getShares, saveShares, type ArtistShares } from "@/lib/userdata/shares-store";
import { useSharesSnapshot } from "@/lib/userdata/use-shares";
import { cn } from "@/lib/utils";

/** Ancre du panneau : cible du bouton « Renseigner ma part » de Pulse. */
export const SHARES_ANCHOR = "ma-part";
export const SHARES_HREF = `/revenue#${SHARES_ANCHOR}`;

type Tab = "percent" | "upload" | "request";

/** Pourcentage saisi → nombre (ou null si vide / invalide) ; la borne est appliquée au store. */
function parsePct(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Pourcentage affiché : entier si rond, sinon une décimale. */
function fmtPctValue(locale: string, n: number): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);
}

/** Balise <num> des messages : le chiffre en mono tabulaire, la phrase en texte courant. */
const num = (chunks: ReactNode) => <span className="num">{chunks}</span>;

/** « auteur/compositeur à 50 % » / « auteur/compositeur (part à préciser) » / « pas auteur ». */
function useAuthorText() {
  const t = useTranslations("revenue.shares");
  const locale = useLocale();
  return (s: ArtistShares) =>
    !s.isAuthor
      ? t("authorNo")
      : s.authorSharePct === null
        ? t("authorUnknown")
        : t("authorYes", { apct: fmtPctValue(locale, s.authorSharePct) });
}

export function SharesPanel({
  artistId,
  gross,
  variant = "full",
  className,
}: {
  artistId: string;
  /** Brut master d'hier (mid), pour la phrase d'accroche. */
  gross: number;
  variant?: "full" | "compact";
  className?: string;
}) {
  const t = useTranslations("revenue.shares");
  const locale = useLocale();
  const authorText = useAuthorText();
  // Abonnement au store : re-rendu à chaque enregistrement et après hydratation.
  const snapshot = useSharesSnapshot();
  const artist = getArtist(artistId);
  const stored = getShares(artistId);
  const declared = stored !== null && stored.masterSharePct !== null;
  const simulatedPct = Math.round(DEAL_SHARE[artist.dealType].mid * 100);

  // Renseigné : on montre l'état et « Modifier » ; simulé : l'éditeur est ouvert d'emblée.
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(id);
  }, [saved]);

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border bg-card px-5 py-3",
          className,
        )}
      >
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <ProvenanceBadge provenance={declared ? "declared" : "simulated"} />
          <span>
            {declared && stored
              ? t.rich("compact.textDeclared", {
                  pct: fmtPctValue(locale, stored.masterSharePct ?? 0),
                  author: authorText(stored),
                  num,
                })
              : t.rich("compact.text", { pct: simulatedPct, num })}
          </span>
        </p>
        <Button asChild variant={declared ? "outline" : "default"} size="sm">
          <Link href={SHARES_HREF}>
            {declared ? t("compact.ctaEdit") : t("compact.cta")}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    );
  }

  const showEditor = !declared || editing;

  return (
    <section
      id={SHARES_ANCHOR}
      className={cn("scroll-mt-20 rounded-xl border bg-card p-5", className)}
      aria-labelledby={`${SHARES_ANCHOR}-title`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 id={`${SHARES_ANCHOR}-title`} className="font-heading text-base font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="mt-1 max-w-[64ch] text-sm text-muted-foreground">
            {t("lead", { gross: fmtEur(locale, Math.round(gross)) })}
          </p>
        </div>
        <ProvenanceBadge provenance={declared ? "declared" : "simulated"} />
      </div>

      {/* Ligne d'état — lisible en une seconde, mise à jour à l'enregistrement. */}
      <p data-testid="shares-status" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span>
          {declared && stored
            ? t.rich("statusDeclared", {
                pct: fmtPctValue(locale, stored.masterSharePct ?? 0),
                author: authorText(stored),
                num,
              })
            : t.rich("statusSimulated", {
                pct: simulatedPct,
                b: (chunks) => <strong className="font-semibold text-foreground">{chunks}</strong>,
                num,
              })}
        </span>
        {declared && !editing && (
          <Button type="button" variant="outline" size="xs" onClick={() => setEditing(true)}>
            {t("edit")}
          </Button>
        )}
        <span role="status" className="text-xs text-muted-foreground">
          {saved && t("fields.saved")}
        </span>
      </p>

      {showEditor && (
        <SharesEditor
          // Remonté à chaque enregistrement / hydratation : le formulaire repart des valeurs stockées.
          key={`${artistId}:${snapshot}`}
          artistId={artistId}
          artistName={artist.name}
          stored={stored}
          cancellable={declared}
          onSaved={() => {
            setEditing(false);
            setSaved(true);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </section>
  );
}

/* ─────────────────────────── Éditeur (3 onglets) ─────────────────────────── */

function SharesEditor({
  artistId,
  artistName,
  stored,
  cancellable,
  onSaved,
  onCancel,
}: {
  artistId: string;
  artistName: string;
  stored: ArtistShares | null;
  cancellable: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("revenue.shares");
  const ids = useId();
  const [tab, setTab] = useState<Tab>(stored?.contractFileName ? "upload" : "percent");
  const [master, setMaster] = useState(stored?.masterSharePct == null ? "" : String(stored.masterSharePct));
  const [isAuthor, setIsAuthor] = useState(stored?.isAuthor ?? false);
  const [author, setAuthor] = useState(stored?.authorSharePct == null ? "" : String(stored.authorSharePct));
  const [fileName, setFileName] = useState<string | null>(stored?.contractFileName ?? null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const letterRef = useRef<HTMLTextAreaElement>(null);

  const masterPct = parsePct(master);
  const canSave = masterPct !== null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    saveShares({
      artistId,
      masterSharePct: masterPct,
      isAuthor,
      authorSharePct: isAuthor ? parsePct(author) : null,
      contractFileName: fileName,
    });
    onSaved();
  };

  /* Import du contrat : seul le nom est retenu, le fichier n'est jamais lu ni envoyé.
   * Persisté tout de suite avec les parts déjà enregistrées (un brouillon non
   * enregistré n'est pas écrasé : le parent remonte l'éditeur avec ce nom). */
  const onFileChosen = (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    saveShares({
      artistId,
      masterSharePct: stored?.masterSharePct ?? null,
      isAuthor: stored?.isAuthor ?? false,
      authorSharePct: stored?.authorSharePct ?? null,
      contractFileName: file.name,
    });
  };

  /* Courrier au label */
  const subject = t("request.subject");
  const body = t("request.body", { artistName });
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const copyLetter = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Presse-papiers indisponible : on sélectionne le texte, Cmd/Ctrl+C fera le reste.
      letterRef.current?.focus();
      letterRef.current?.select();
    }
  };

  const percentFields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${ids}-master`}>{t("fields.master")}</Label>
        <Input
          id={`${ids}-master`}
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step={0.5}
          value={master}
          onChange={(e) => setMaster(e.target.value)}
          aria-describedby={`${ids}-master-help`}
          className="num max-w-40"
          required
        />
        <p id={`${ids}-master-help`} className="text-xs text-muted-foreground">
          {t("fields.masterHelp")}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex h-8 items-center gap-2">
          <Switch id={`${ids}-author`} checked={isAuthor} onCheckedChange={setIsAuthor} />
          <Label htmlFor={`${ids}-author`}>{t("fields.isAuthor")}</Label>
        </div>
        {isAuthor && (
          <>
            <Label htmlFor={`${ids}-apct`} className="mt-1">
              {t("fields.author")}
            </Label>
            <Input
              id={`${ids}-apct`}
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={0.5}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              aria-describedby={`${ids}-apct-help`}
              className="num max-w-40"
            />
            <p id={`${ids}-apct-help`} className="text-xs text-muted-foreground">
              {t("fields.authorHelp")}
            </p>
          </>
        )}
      </div>
    </div>
  );

  const saveRow = (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Button type="submit" size="sm" disabled={!canSave}>
        <Check aria-hidden />
        {t("fields.save")}
      </Button>
      {cancellable && (
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("cancel")}
        </Button>
      )}
    </div>
  );

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-4">
      <TabsList aria-label={t("tabs.label")} className="h-auto flex-wrap">
        <TabsTrigger value="percent" className="text-xs">
          <Percent aria-hidden />
          {t("tabs.percent")}
        </TabsTrigger>
        <TabsTrigger value="upload" className="text-xs">
          <Upload aria-hidden />
          {t("tabs.upload")}
        </TabsTrigger>
        <TabsTrigger value="request" className="text-xs">
          <Mail aria-hidden />
          {t("tabs.request")}
        </TabsTrigger>
      </TabsList>

      {/* 1 — Pourcentages */}
      <TabsContent value="percent" className="pt-3">
        <form onSubmit={submit} noValidate>
          {percentFields}
          {saveRow}
        </form>
      </TabsContent>

      {/* 2 — Contrat importé : nom retenu, puis les mêmes champs */}
      <TabsContent value="upload" className="pt-3">
        <form onSubmit={submit} noValidate>
          <input
            ref={fileInputRef}
            id={`${ids}-file`}
            type="file"
            accept=".pdf,.docx"
            className="sr-only"
            aria-label={t("upload.label")}
            onChange={(e) => {
              onFileChosen(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FileText aria-hidden />
              {t("upload.label")}
            </Button>
            {!fileName && <p className="text-xs text-muted-foreground">{t("upload.hint")}</p>}
          </div>
          {fileName && (
            <>
              <p className="mt-3 text-sm font-medium">{t("upload.imported", { name: fileName })}</p>
              <div className="mt-3">{percentFields}</div>
              {saveRow}
            </>
          )}
        </form>
      </TabsContent>

      {/* 3 — Courrier au label */}
      <TabsContent value="request" className="pt-3">
        <p className="max-w-[64ch] text-sm text-muted-foreground">{t("request.lead")}</p>
        <Label htmlFor={`${ids}-letter`} className="sr-only">
          {t("request.letterLabel")}
        </Label>
        <Textarea
          ref={letterRef}
          id={`${ids}-letter`}
          readOnly
          value={body}
          rows={12}
          className="mt-3 max-w-[72ch] resize-none text-sm leading-relaxed"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyLetter}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? t("request.copied") : t("request.copy")}
          </Button>
          <Button asChild size="sm">
            <a href={mailto}>
              <Mail aria-hidden />
              {t("request.open")}
            </a>
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
