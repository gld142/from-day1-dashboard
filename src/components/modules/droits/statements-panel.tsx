"use client";

/**
 * « Vos relevés, c'est vous » — le reçu affiché sur /rights est un relevé
 * simulé pour la démo. Ce bloc dit comment passer au vrai, en trois gestes :
 *   1. importer son relevé de répartition SACEM (PDF ou CSV) — pour l'instant
 *      seul le nom du fichier est retenu, localement (rights-store) ; le
 *      rapprochement œuvre par œuvre viendra ensuite ;
 *   2. demander son relevé à l'organisme : courrier prêt, signé de l'artiste ;
 *   3. ouvrir l'audit, où les écarts sont détaillés.
 *
 * En vue structure, les mêmes textes à la troisième personne — « Les relevés
 * de Dadju » (artiste zoomé) ou « Les relevés du roster » (vue agrégée) —
 * namespace `rights.import.label`, miroir de `rights.import`, avec un
 * paramètre ICU `scope` (artist | roster). Le courrier est alors signé par la
 * structure.
 */
import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, FileText, Mail, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { useRole } from "@/lib/role";
import { getRightsImport, saveRightsImport } from "@/lib/userdata/rights-store";
import { useRightsImportsSnapshot } from "@/lib/userdata/use-rights";
import { cn } from "@/lib/utils";

/** Ancre du panneau. */
export const STATEMENTS_ANCHOR = "mes-releves";

export type StatementsScope = "artist" | "roster";

export function StatementsPanel({
  scopeId,
  scope,
  name,
  signer,
  className,
}: {
  /** Clé du store : artistId, ou ROSTER_SCOPE en vue agrégée. */
  scopeId: string;
  scope: StatementsScope;
  /** Nom de l'artiste (vue structure zoomée : « le relevé de {name} »). */
  name: string;
  /** Signataire du courrier : l'artiste, ou la structure en vue label. */
  signer: string;
  className?: string;
}) {
  const { persona } = useRole();
  const t = useTranslations(persona === "label" ? "rights.import.label" : "rights.import");
  const ids = useId();
  // Abonnement au store : re-rendu à chaque import et après hydratation.
  useRightsImportsSnapshot();
  const imported = getRightsImport(scopeId);

  const [open, setOpen] = useState(false);
  const [justImported, setJustImported] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Import : seul le nom est retenu, le fichier n'est jamais lu ni envoyé. */
  const onFileChosen = (file: File | null) => {
    if (!file) return;
    saveRightsImport({ scopeId, fileName: file.name });
    setJustImported(file.name);
  };

  /* Courrier à l'organisme — sans destinataire : l'artiste choisit son contact SACEM / ADAMI. */
  const subject = t("request.subject");
  const body = t("request.body", { scope, name, signer });
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const params = { scope, name };

  return (
    <section
      id={STATEMENTS_ANCHOR}
      className={cn("scroll-mt-20 rounded-xl border bg-card p-5", className)}
      aria-labelledby={`${STATEMENTS_ANCHOR}-title`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 id={`${STATEMENTS_ANCHOR}-title`} className="font-heading text-base font-semibold tracking-tight">
            {t("title", params)}
          </h2>
          <p className="mt-1 max-w-[64ch] text-sm text-muted-foreground">{t("lead", params)}</p>
        </div>
        {/* Le reçu affiché reste simulé même après import : le rapprochement n'existe pas encore. */}
        <ProvenanceBadge provenance="simulated" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={imported ? "outline" : "default"}
          onClick={() => {
            setJustImported(null);
            setOpen(true);
          }}
          data-testid="rights-import-cta"
        >
          {imported ? <Check aria-hidden /> : <Upload aria-hidden />}
          {imported ? t("cta.imported", { file: imported.fileName }) : t("cta.import", params)}
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={mailto}>
            <Mail aria-hidden />
            {t("cta.request", params)}
          </a>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/audit">
            {t("cta.audit")}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dialog.title")}</DialogTitle>
            <DialogDescription>{t("dialog.lead")}</DialogDescription>
          </DialogHeader>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("dialog.formatTitle")}
            </p>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {(["kind", "period", "perWork"] as const).map((k) => (
                <li key={k} className="flex gap-2">
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>{t(`dialog.format.${k}`)}</span>
                </li>
              ))}
            </ul>
          </div>

          <input
            ref={fileInputRef}
            id={`${ids}-file`}
            type="file"
            accept=".pdf,.csv"
            className="sr-only"
            aria-label={t("dialog.fileLabel")}
            onChange={(e) => {
              onFileChosen(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload aria-hidden />
              {t("dialog.fileLabel")}
            </Button>
            {!justImported && <p className="text-xs text-muted-foreground">{t("dialog.hint")}</p>}
          </div>
          {justImported && (
            <p role="status" className="flex items-center gap-2 text-sm font-medium">
              <Check className="size-4 text-success" aria-hidden />
              {t("dialog.done", { file: justImported })}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant={justImported ? "default" : "ghost"} size="sm" onClick={() => setOpen(false)}>
              {t("dialog.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
