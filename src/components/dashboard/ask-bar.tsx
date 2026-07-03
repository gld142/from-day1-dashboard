"use client";

/**
 * Barre "pose ta question" : réponses immédiates calculées en direct
 * depuis les données du compte. Moteur à intentions (mots-clés FR/EN) —
 * en production, ces intentions seront résolues par le Copilot LLM,
 * l'UI restera identique.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, MessageSquareText, Sparkles } from "lucide-react";
import {
  catalogValuation,
  expensesByCategory,
  monthlyRevenueTotals,
  revenueBySource,
  rightsStatements,
  streamsDelta,
  sumStreams,
  tourDates,
} from "@/lib/demo/api";
import { fmtCompact, fmtDate, fmtEur, fmtMonth, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Intent =
  | "bestMonth"
  | "streams30"
  | "revenue12"
  | "sacem"
  | "nextShow"
  | "expenses"
  | "valuation";

const INTENT_PATTERNS: Array<[Intent, RegExp]> = [
  ["bestMonth", /meilleur|best/i],
  ["streams30", /stream|écoute|listen/i],
  ["sacem", /sacem|droit|right|adami/i],
  ["nextShow", /date|concert|show|tourn|gig/i],
  ["expenses", /dépense|depense|expense|coût|cout|cost|spend/i],
  ["valuation", /catalogue|catalog|vaut|worth|valorisation|valuation/i],
  ["revenue12", /revenu|revenue|gagn|earn|income|argent|money/i],
];

export function AskBar({ compact }: { compact?: boolean }) {
  const t = useTranslations("ask");
  const locale = useLocale();
  const { artistId } = useRole();
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<{ q: string; intent: Intent | null } | null>(
    null,
  );

  const answer = useMemo(() => {
    if (!asked) return null;
    const intent = asked.intent;
    if (!intent) return t("answers.fallback");

    switch (intent) {
      case "bestMonth": {
        const months = monthlyRevenueTotals(artistId, 24);
        const best = months.reduce((a, b) => (b.amount > a.amount ? b : a));
        return t("answers.bestMonth", {
          month: fmtMonth(locale, best.month),
          amount: fmtEur(locale, best.amount),
        });
      }
      case "streams30":
        return t("answers.streams30", {
          count: fmtCompact(locale, sumStreams(artistId, 30)),
          delta: fmtPct(locale, streamsDelta(artistId, 30)),
        });
      case "revenue12": {
        const bySource = revenueBySource(artistId, 12);
        const total = bySource.reduce((s, r) => s + r.amount, 0);
        return t("answers.revenue12", {
          amount: fmtEur(locale, total),
          source: bySource[0]?.source ?? "",
        });
      }
      case "sacem": {
        const sacem = rightsStatements(artistId)
          .filter((s) => s.organism === "sacem" && s.status !== "pending")
          .slice(-4);
        const received = sacem.reduce((s, x) => s + x.received, 0);
        const expected = sacem.reduce((s, x) => s + x.expected, 0);
        const hasGap = sacem.some((s) => s.status === "gap-detected");
        return t("answers.sacem", {
          received: fmtEur(locale, received),
          expected: fmtEur(locale, expected),
          gap: hasGap ? "yes" : "no",
        });
      }
      case "nextShow": {
        const next = tourDates(artistId).find((d) => d.status === "upcoming");
        if (!next) return t("answers.fallback");
        return t("answers.nextShow", {
          venue: next.venue,
          city: next.city,
          date: fmtDate(locale, next.date),
          sold: fmtCompact(locale, next.ticketsSold),
          capacity: fmtCompact(locale, next.capacity),
        });
      }
      case "expenses": {
        const cats = expensesByCategory({ artistId });
        const total = cats.reduce((s, c) => s + c.amount, 0);
        return t("answers.expenses", {
          amount: fmtEur(locale, total),
          category: cats[0]?.category ?? "",
        });
      }
      case "valuation": {
        const v = catalogValuation(artistId);
        return t("answers.valuation", {
          low: fmtEur(locale, v.low, { compact: true }),
          high: fmtEur(locale, v.high, { compact: true }),
        });
      }
    }
  }, [asked, artistId, locale, t]);

  function submit(raw?: string) {
    const q = (raw ?? question).trim();
    if (!q) return;
    const found = INTENT_PATTERNS.find(([, re]) => re.test(q));
    setAsked({ q, intent: found ? found[0] : null });
    setQuestion("");
  }

  const suggestionKeys: Intent[] = compact
    ? ["bestMonth", "streams30", "valuation"]
    : ["bestMonth", "streams30", "revenue12", "sacem", "nextShow", "valuation"];

  return (
    <div className="flex flex-col gap-2.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="relative"
      >
        <Sparkles
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand"
          aria-hidden
        />
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("placeholder")}
          className="h-10 pl-9 pr-10"
        />
        <Button
          type="submit"
          size="icon"
          variant="ghost"
          className="absolute right-1 top-1/2 size-8 -translate-y-1/2 text-muted-foreground"
          aria-label={t("placeholder")}
        >
          <CornerDownLeft className="size-4" aria-hidden />
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {suggestionKeys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => submit(t(`suggestions.${k}`))}
            className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground"
          >
            {t(`suggestions.${k}`)}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {asked && answer && (
          <motion.div
            key={asked.q}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-lg border bg-surface-2 p-3"
          >
            <p className="text-[11px] font-medium text-muted-foreground">
              {asked.q}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed">{answer}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <MessageSquareText className="size-3" aria-hidden />
                {t("sourceNote")}
              </span>
              <Link
                href="/copilot"
                className="text-[11px] font-medium text-brand hover:underline"
              >
                {t("openCopilot")}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
