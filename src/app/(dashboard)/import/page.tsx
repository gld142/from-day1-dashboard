"use client";

/**
 * Import des données réelles — le pont entre la démo et l'usage réel.
 * Dépose ton relevé distributeur (CSV), aperçu, activation : tout le
 * dashboard bascule sur tes vrais chiffres. 100 % côté navigateur.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import NumberFlow from "@number-flow/react";
import {
  ArrowRight,
  CheckCircle2,
  FileUp,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { parseStatement, type ParsedStatement } from "@/lib/userdata/parse-csv";
import {
  buildUserData,
  clearUserData,
  getUserData,
  saveUserData,
  subscribeUserData,
} from "@/lib/userdata/store";
import { useSyncExternalStore } from "react";
import { fmtCompact, fmtDate, fmtEur, fmtMonth, fmtInt } from "@/lib/format";
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/page-header";

const DEFAULT_RATES: Record<string, number> = { USD: 0.92, GBP: 1.17, EUR: 1 };

export default function ImportPage() {
  const t = useTranslations("importer");
  const locale = useLocale();
  const router = useRouter();
  const { setPersona } = useRole();

  const userData = useSyncExternalStore(
    subscribeUserData,
    () => getUserData(),
    () => null,
  );

  const [parsed, setParsed] = useState<ParsedStatement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [artistName, setArtistName] = useState("");
  const [eurRate, setEurRate] = useState<number>(0.92);
  const [justActivated, setJustActivated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback((file: File) => {
    setParsing(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = parseStatement(String(reader.result ?? ""));
        setParsed(result);
        setEurRate(DEFAULT_RATES[result.currency] ?? 0.92);
        if (result.artistNames.length > 0) setArtistName(result.artistNames[0]);
      } catch (e) {
        const code = e instanceof Error ? e.message : "generic";
        setError(["EMPTY_FILE", "UNKNOWN_FORMAT", "NO_DATA_ROWS"].includes(code) ? code : "generic");
        setParsed(null);
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setError("generic");
      setParsing(false);
    };
    reader.readAsText(file);
  }, []);

  const topTracks = useMemo(
    () =>
      parsed
        ? Object.entries(parsed.trackStreams)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
        : [],
    [parsed],
  );

  function activate() {
    if (!parsed || !artistName.trim()) return;
    saveUserData(
      buildUserData(parsed, { artistName: artistName.trim(), eurRate }),
    );
    setPersona("artist");
    setJustActivated(true);
  }

  const skippedWarning = parsed?.warnings.find((w) => w.startsWith("SKIPPED_ROWS:"));
  const skippedCount = skippedWarning ? Number(skippedWarning.split(":")[1]) : 0;

  /* ─────────── État : données actives ─────────── */
  if (userData?.active && !parsed) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />

        <section
          className={cn(
            "rise-in rounded-2xl border bg-gradient-to-b from-card to-surface-2 p-6",
            justActivated && "brand-glow",
          )}
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="font-heading text-lg font-semibold">
                {justActivated ? t("success.title") : t("active.title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {justActivated
                  ? t("success.description")
                  : t("active.description", {
                      name: userData.artistName,
                      date: fmtDate(locale, userData.importedAt),
                      format: t(`preview.formatNames.${userData.format}`),
                    })}
              </p>
              <p className="num mt-3 text-sm font-medium">
                {t("active.stats", {
                  months: userData.months.length,
                  streams: fmtCompact(locale, userData.totalStreams),
                  revenue: fmtEur(locale, userData.totalRevenueEur, { compact: true }),
                })}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {t("active.modules")}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => router.push("/pulse")} className="gap-1.5">
              {t("actions.goToPulse")}
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setJustActivated(false);
                inputRef.current?.click();
              }}
              className="gap-1.5"
            >
              <UploadCloud className="size-3.5" aria-hidden />
              {t("active.reimport")}
            </Button>
            <Button
              variant="outline"
              onClick={() => saveUserData({ ...userData, active: false })}
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {t("active.deactivate")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm(t("active.deleteConfirm"))) clearUserData();
              }}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3.5" aria-hidden />
              {t("active.delete")}
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,.tsv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readFile(f);
              e.target.value = "";
            }}
          />
        </section>
      </div>
    );
  }

  /* ─────────── État : upload / aperçu ─────────── */
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <p className="rise-in mb-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-[12px] text-muted-foreground">
        <Lock className="size-3.5 shrink-0 text-success" aria-hidden />
        {t("privacy")}
      </p>

      {/* Données inactives mais présentes */}
      {userData && !userData.active && !parsed && (
        <div className="rise-in mb-4 flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
          <span className="text-[13px] text-muted-foreground">
            {t("active.description", {
              name: userData.artistName,
              date: fmtDate(locale, userData.importedAt),
              format: t(`preview.formatNames.${userData.format}`),
            })}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => saveUserData({ ...userData, active: true })}
          >
            {t("actions.activate")}
          </Button>
        </div>
      )}

      {!parsed ? (
        <>
          {/* Dropzone */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) readFile(f);
            }}
            className={cn(
              "rise-in flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed bg-card px-6 py-14 transition-colors",
              dragOver
                ? "border-brand bg-accent"
                : "hover:border-brand/50 hover:bg-surface-2",
            )}
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-brand/12 text-brand">
              <FileUp className="size-6" aria-hidden />
            </span>
            <span className="font-heading text-lg font-semibold">
              {parsing ? t("dropzone.parsing") : t("dropzone.title")}
            </span>
            <span className="text-sm text-muted-foreground">{t("dropzone.hint")}</span>
            <Badge variant="outline" className="rounded-full text-[11px] text-muted-foreground">
              {t("dropzone.formats")}
            </Badge>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,.tsv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readFile(f);
              e.target.value = "";
            }}
          />

          {error && (
            <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/8 px-3 py-2 text-sm text-destructive">
              {t(`errors.${error}`)}
            </p>
          )}

          {/* Où trouver son relevé */}
          <section className="rise-in mt-6 rounded-xl border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-heading text-base font-semibold">
              <Sparkles className="size-4 text-brand" aria-hidden />
              {t("howto.title")}
            </h2>
            <ul className="flex flex-col gap-2 text-[13px] text-muted-foreground">
              {(["distrokid", "tunecore", "believe"] as const).map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <span className="num flex h-5 items-center rounded bg-surface-2 px-1.5 text-[10px] font-semibold uppercase">
                    {t(`preview.formatNames.${k}`)}
                  </span>
                  {t(`howto.${k}`)}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        /* ─────────── Aperçu ─────────── */
        <section className="rise-in rounded-2xl border bg-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
              <ShieldCheck className="size-4.5 text-success" aria-hidden />
              {t("preview.title")}
            </h2>
            <div className="flex items-center gap-2">
              <Badge className="rounded-full bg-brand text-brand-foreground">
                {t(`preview.formatNames.${parsed.format}`)}
              </Badge>
              <span className="num text-[11px] text-muted-foreground">
                {t("preview.rows", { count: fmtInt(locale, parsed.rowCount) })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-surface-2 p-3">
              <p className="text-[11px] text-muted-foreground">{t("preview.period")}</p>
              <p className="num mt-0.5 text-sm font-semibold">
                {fmtMonth(locale, parsed.months[0])} —{" "}
                {fmtMonth(locale, parsed.months[parsed.months.length - 1])}
              </p>
            </div>
            <div className="rounded-lg border bg-surface-2 p-3">
              <p className="text-[11px] text-muted-foreground">
                {t("preview.totalStreams")}
              </p>
              <p className="num mt-0.5 text-sm font-semibold">
                <NumberFlow
                  value={parsed.totalStreams}
                  format={{ notation: "compact", maximumFractionDigits: 1 }}
                  locales={locale}
                />
              </p>
            </div>
            <div className="rounded-lg border bg-surface-2 p-3">
              <p className="text-[11px] text-muted-foreground">
                {t("preview.totalRevenue")}
              </p>
              <p className="num mt-0.5 text-sm font-semibold">
                <NumberFlow
                  value={Math.round(parsed.totalRevenue * (parsed.currency === "EUR" ? 1 : eurRate))}
                  format={{
                    style: "currency",
                    currency: "EUR",
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }}
                  locales={locale}
                />
              </p>
            </div>
          </div>

          {topTracks.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                {t("preview.topTracks")}
              </p>
              <ul className="flex flex-col gap-1">
                {topTracks.map(([title, streams], i) => (
                  <li key={title} className="flex items-center gap-2 text-[13px]">
                    <span className="num w-5 text-right text-muted-foreground">{i + 1}</span>
                    <span className="flex-1 truncate font-medium">{title}</span>
                    <span className="num text-muted-foreground">
                      {fmtCompact(locale, streams)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            {Object.keys(parsed.countryStreams).length > 0 && (
              <span>
                {t("preview.countries", {
                  count: Object.keys(parsed.countryStreams).length,
                })}
              </span>
            )}
            {skippedCount > 0 && (
              <span className="text-warning">
                {t("preview.warnings", { count: skippedCount })}
              </span>
            )}
          </div>

          {/* Config */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {t("config.artistName")}
              </label>
              <Input
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder={t("config.artistNamePlaceholder")}
              />
            </div>
            {parsed.currency !== "EUR" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("config.eurRate")} —{" "}
                  {t("config.currency", { currency: parsed.currency })}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="3"
                  value={eurRate}
                  onChange={(e) => setEurRate(Number(e.target.value) || 0.92)}
                />
                <p className="num mt-1 text-[10px] text-muted-foreground">
                  {t("config.eurRateHint", { currency: parsed.currency, rate: eurRate })}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              onClick={activate}
              disabled={!artistName.trim()}
              className="gap-1.5"
            >
              <Sparkles className="size-4" aria-hidden />
              {t("actions.activate")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setParsed(null);
                setError(null);
              }}
            >
              {t("actions.cancel")}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
