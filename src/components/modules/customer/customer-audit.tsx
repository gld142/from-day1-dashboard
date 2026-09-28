"use client";

/**
 * /audit en mode client — ce qui mérite d'être vérifié dans le relevé de
 * l'artiste ouvert, comparé à SON propre historique (src/lib/userdata/audit.ts).
 *
 * Un écart n'est pas une créance : la page le dit sous le chiffre, affiche ses
 * seuils, et prépare un message au distributeur que la personne envoie ELLE-MÊME
 * (rien n'est envoyé d'ici).
 */
import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { useCustomer } from "@/lib/customer-mode";
import { MIN_HISTORY, MIN_STREAMS, RATE_DROP, auditStatement, type AuditFinding } from "@/lib/userdata/audit";
import { getUserData, subscribeUserData } from "@/lib/userdata/store";
import { DSP_LABEL, FORMAT_LABEL, statementLine, useFormats } from "./shared";

type Fmt = ReturnType<typeof useFormats>;

/** Une ligne du message au distributeur : mois en toutes lettres, nombres exacts. */
function findingLine(f: AuditFinding, fmt: Fmt): string {
  switch (f.kind) {
    case "rate-drop":
      return `${fmt.monthLong(f.month)} · ${DSP_LABEL[f.dsp] ?? f.dsp} : ${fmt.eurCents(f.revenue)} pour ${fmt.int(f.streams)} streams, soit ${fmt.eurCents(f.rate)} pour 1 000 streams, contre ${fmt.eurCents(f.usualRate ?? 0)} d'habitude sur cette plateforme.`;
    case "unpaid-streams":
      return `${fmt.monthLong(f.month)} · ${DSP_LABEL[f.dsp] ?? f.dsp} : ${fmt.int(f.streams)} streams déclarés sans aucun revenu.`;
    case "missing-month":
      return `${fmt.monthLong(f.month)} : aucune ligne dans le relevé.`;
    case "unpaid-track":
      return `Le titre « ${f.title} » : ${fmt.int(f.streams)} streams sans aucun revenu sur la période.`;
  }
}

function message(findings: AuditFinding[], distributor: string, artist: string, fmt: Fmt): string {
  return [
    "Bonjour,",
    "",
    `Sur mon relevé ${distributor} (${artist}), je relève les points suivants :`,
    ...findings.map((f) => `- ${findingLine(f, fmt)}`),
    "",
    "Pouvez-vous vérifier ces lignes et me dire s'il manque un versement ou une régularisation ?",
    "",
    "Merci,",
  ].join("\n");
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs whitespace-nowrap hover:bg-muted"
    >
      {done ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {done ? "Copié" : label}
    </button>
  );
}

export function CustomerAudit() {
  const fmt = useFormats();
  const customer = useCustomer();
  const data = useSyncExternalStore(subscribeUserData, getUserData, () => null);
  const audit = useMemo(() => (data ? auditStatement(data) : null), [data]);

  if (!data || !audit) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Audit royalties" subtitle="Aucun relevé importé pour cet artiste." />
        <Link href="/import" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Importer un relevé</Link>
      </div>
    );
  }

  const artist = customer?.artistName ?? data.artistName;
  const distributor = FORMAT_LABEL[data.format] ?? data.format;
  const { findings, totalGap, checked } = audit;
  const money = findings.filter((f): f is Extract<AuditFinding, { kind: "rate-drop" | "unpaid-streams" }> => f.kind === "rate-drop" || f.kind === "unpaid-streams");
  const others = findings.filter((f) => f.kind === "missing-month" || f.kind === "unpaid-track");

  return (
    <div className="rise-in">
      <PageHeader title="Audit royalties" subtitle={`${artist} · ${statementLine(data, fmt.month, fmt.locale)}`}>
        {findings.length > 0 && <CopyButton text={message(findings, distributor, artist, fmt)} label="Copier le message au distributeur" />}
      </PageHeader>

      {!audit.available ? (
        <Sheet family="trends">
          <SheetHeading>Audit indisponible pour ce relevé</SheetHeading>
          <p className="sheet-ink text-sm">
            Ce relevé a été importé avant le détail des revenus par plateforme, sans lequel on ne peut rien vérifier.{" "}
            <Link href="/import" className="underline">Réimporte-le</Link> pour lancer l&apos;audit.
          </p>
        </Sheet>
      ) : (
        <div className="space-y-3">
          <Sheet family="trends">
            <SheetHeading action={`${checked.platformMonths} mois × plateformes vérifiés`}>Écarts à vérifier</SheetHeading>
            <p className={`text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl ${totalGap > 0 ? "text-destructive" : ""}`}>
              {findings.length === 0 ? "Rien à signaler" : totalGap > 0 ? fmt.eurCents(totalGap) : `${findings.length} point${findings.length > 1 ? "s" : ""}`}
            </p>
            <p className="sheet-ink mt-1.5 text-[13px]">
              {findings.length === 0
                ? `Sur ${checked.months} mois de relevé, chaque plateforme t'a payé dans ses taux habituels.`
                : totalGap > 0
                  ? "Estimé au taux habituel de chaque plateforme : un écart à vérifier auprès de ton distributeur, pas une somme due."
                  : "Des points à vérifier, sans montant estimable (pas assez d'historique sur la plateforme)."}
            </p>
            <AffiliatedPoints
              points={[
                { key: "drops", value: String(money.filter((f) => f.kind === "rate-drop").length), label: "Mois payés sous le taux habituel" },
                { key: "unpaid", value: String(money.filter((f) => f.kind === "unpaid-streams").length), label: "Mois de streams sans revenu" },
                { key: "missing", value: String(others.filter((f) => f.kind === "missing-month").length), label: "Mois absents du relevé" },
                { key: "tracks", value: data.trackRevenue ? String(others.filter((f) => f.kind === "unpaid-track").length) : "—", label: "Titres sans revenu" },
              ]}
            />
          </Sheet>
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <ProvenanceBadge provenance="declared" /> Calculé sur ton relevé {distributor}, comparé à ton propre historique — pas à un modèle de marché.
          </p>

          {money.length > 0 && (
            <Sheet family="trends">
              <SheetHeading action="le plus gros écart d'abord">Paiements à vérifier</SheetHeading>
              <ul className="grid gap-3">
                {money.map((f) => (
                  <li key={`${f.kind}-${f.month}-${f.dsp}`} className="flex flex-wrap items-start justify-between gap-2 border-t border-current/10 pt-3 text-sm first:border-t-0 first:pt-0">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {fmt.month(f.month)} · {DSP_LABEL[f.dsp] ?? f.dsp}
                        {f.gap !== null && <span className="text-destructive ml-2">{fmt.eurCents(f.gap)} d&apos;écart estimé</span>}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {f.kind === "unpaid-streams"
                          ? `${fmt.compact(f.streams)} streams déclarés, aucun revenu.`
                          : `${fmt.eurCents(f.revenue)} pour ${fmt.compact(f.streams)} streams : ${fmt.eurCents(f.rate)} pour 1 000, contre ${fmt.eurCents(f.usualRate ?? 0)} d'habitude.`}
                        {f.expected !== null && ` Au taux habituel : ${fmt.eurCents(f.expected)}.`}
                        {f.lastMonth && " Dernier mois du relevé : il est souvent incomplet, revérifie au prochain relevé."}
                      </p>
                    </div>
                    <CopyButton text={message([f], distributor, artist, fmt)} label="Copier" />
                  </li>
                ))}
              </ul>
            </Sheet>
          )}

          {others.length > 0 && (
            <Sheet family="trends">
              <SheetHeading>Trous dans le relevé</SheetHeading>
              <ul className="grid gap-2 text-sm">
                {others.map((f) => (
                  <li key={f.kind === "missing-month" ? f.month : f.title} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{findingLine(f, fmt)}</span>
                    <CopyButton text={message([f], distributor, artist, fmt)} label="Copier" />
                  </li>
                ))}
              </ul>
            </Sheet>
          )}

          <Sheet family="trends">
            <SheetHeading>Comment c&apos;est calculé</SheetHeading>
            <ul className="sheet-ink grid gap-1.5 text-[12.5px] leading-relaxed">
              <li>• Taux habituel d&apos;une plateforme : la médiane de ce qu&apos;elle t&apos;a payé pour 1 000 streams, sur les mois payés (il en faut au moins {MIN_HISTORY}).</li>
              <li>• Signalé : un mois payé sous {fmt.pct(RATE_DROP)} de ce taux, ou des streams sans aucun revenu — à partir de {fmt.compact(MIN_STREAMS)} streams, en dessous un taux ne veut rien dire.</li>
              <li>• Ces seuils sont des choix de Day 1, pas une règle des plateformes : les taux varient selon les pays et la part d&apos;abonnés gratuits.</li>
            </ul>
          </Sheet>
        </div>
      )}
    </div>
  );
}
