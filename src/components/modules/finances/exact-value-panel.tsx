"use client";

/**
 * « La valeur exacte, c'est la vôtre » — vue structure uniquement.
 * Day 1 estime le back catalogue ; la structure (DAF, expert) renseigne la
 * valeur exacte, qui remplace l'estimation. Bouton pour la demander à la DAF.
 */
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { Artist } from "@/lib/demo/types";
import type { Valuation } from "@/lib/demo/api";
import { fmtDate, fmtEur } from "@/lib/format";
import {
  getDeclaredValuation,
  saveDeclaredValuation,
  useValuationsSnapshot,
} from "@/lib/userdata/valuations-store";

export function ExactValuePanel({ artist, valuation }: { artist: Artist; valuation: Valuation }) {
  const t = useTranslations("valuation.exact");
  const locale = useLocale();
  useValuationsSnapshot();
  const declared = getDeclaredValuation(artist.id);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [source, setSource] = useState("");
  const [saved, setSaved] = useState(false);

  const mid = fmtEur(locale, valuation.mid);
  const mailto = `mailto:?subject=${encodeURIComponent(t("ask.subject", { name: artist.name }))}&body=${encodeURIComponent(t("ask.body", { name: artist.name, mid }))}`;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const n = Number(value.replace(/[^0-9.,]/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return;
    saveDeclaredValuation(artist.id, n, source);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const showForm = editing || !declared;

  return (
    <section id="valeur-exacte" className="rise-in mt-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-heading text-base font-semibold tracking-tight">{t("title")}</h2>
        <ProvenanceBadge provenance={declared ? "declared" : "estimated"} />
      </div>
      <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
        {t("lead", { name: artist.name, mid, low: fmtEur(locale, valuation.low), high: fmtEur(locale, valuation.high) })}
      </p>

      {declared && !editing && (
        <p className="mt-3 text-sm">
          {t("declared", {
            value: fmtEur(locale, declared.value),
            source: declared.source || "—",
            date: fmtDate(locale, declared.updatedAt, { day: "numeric", month: "short", year: "numeric" }),
          })}{" "}
          <button type="button" className="text-brand underline-offset-2 hover:underline" onClick={() => setEditing(true)}>
            {t("edit")}
          </button>
        </p>
      )}

      {showForm && (
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="exact-value">{t("fields.value")}</Label>
            <Input id="exact-value" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} className="num" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="exact-source">{t("fields.source")}</Label>
            <Input id="exact-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder={t("fields.sourcePlaceholder")} />
          </div>
          <Button type="submit" disabled={!value.trim()}>{t("fields.save")}</Button>
        </form>
      )}

      {saved && <p className="mt-2 text-xs text-success">{t("fields.saved")}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <a href={mailto}>
            <Mail className="size-3.5" aria-hidden />
            {t("ask.cta")}
          </a>
        </Button>
        <span className="text-xs text-muted-foreground">{t("note")}</span>
      </div>
    </section>
  );
}
