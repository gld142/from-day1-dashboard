"use client";

/**
 * Chat Copilot — échanges pré-écrits interpolés avec les VRAIES données démo,
 * chips de suggestions, indicateur de frappe framer-motion (délai fixe 600 ms).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { SendHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ARTISTS,
  LABEL,
  auditFindings,
  dailyTotals,
  getArtist,
  monthlyRevenueTotals,
  pnlByArtist,
  revenueBySource,
  streamsDelta,
  sumStreams,
  totalRevenue,
} from "@/lib/demo/api";
import type { RevenueSource } from "@/lib/demo/types";
import { fmtCompact, fmtEur, fmtMonth, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

type Message = { id: number; role: "user" | "assistant"; text: string };
type Exchange = { id: string; question: string; answer: string };

const TYPING_DELAY_MS = 600;

/** Construit les échanges pré-écrits à partir des vraies données. */
function useExchanges(isRoster: boolean, artistId: string) {
  const t = useTranslations("copilot");
  const locale = useLocale();

  return useMemo<Exchange[]>(() => {
    if (isRoster) {
      /* ── Vue label agrégée ── */
      const byMonth = new Map<string, number>();
      for (const a of ARTISTS) {
        for (const m of monthlyRevenueTotals(a.id, 24)) {
          byMonth.set(m.month, (byMonth.get(m.month) ?? 0) + m.amount);
        }
      }
      const months = Array.from(byMonth.entries()).sort(([a], [b]) =>
        a.localeCompare(b),
      );
      const best = months.reduce((acc, m) => (m[1] > acc[1] ? m : acc), months[0]);
      const avg = months.reduce((s, m) => s + m[1], 0) / months.length;

      let cur = 0;
      let prev = 0;
      for (const a of ARTISTS) {
        const series = dailyTotals(a.id, 60);
        prev += series.slice(0, 30).reduce((s, d) => s + d.streams, 0);
        cur += series.slice(30).reduce((s, d) => s + d.streams, 0);
      }
      const rosterDelta = prev === 0 ? 0 : ((cur - prev) / prev) * 100;

      const top = pnlByArtist(12)[0];
      const topArtist = getArtist(top.artistId);

      const allFindings = ARTISTS.flatMap((a) => auditFindings(a.id));
      const gapTotal = allFindings.reduce(
        (s, f) => s + (f.expected - f.reported),
        0,
      );
      const artistsWithGaps = new Set(allFindings.map((f) => f.artistId)).size;

      return [
        {
          id: "bestMonth",
          question: t("suggestions.bestMonthLabel"),
          answer: t("answers.bestMonthLabel", {
            month: fmtMonth(locale, best[0]),
            amount: fmtEur(locale, best[1]),
            pct: fmtPct(locale, ((best[1] - avg) / avg) * 100),
            avg: fmtEur(locale, Math.round(avg)),
          }),
        },
        {
          id: "growth",
          question: t("suggestions.growthLabel"),
          answer: t("answers.growthLabel", {
            streams: fmtCompact(locale, cur),
            delta: fmtPct(locale, rosterDelta),
          }),
        },
        {
          id: "topArtist",
          question: t("suggestions.topArtist"),
          answer: t("answers.topArtist", {
            artist: topArtist.name,
            net: fmtEur(locale, top.net),
            margin: fmtPct(locale, top.margin),
            revenue: fmtEur(locale, top.revenue),
          }),
        },
        {
          id: "audit",
          question: t("suggestions.auditLabel"),
          answer: t("answers.auditLabel", {
            count: allFindings.length,
            amount: fmtEur(locale, gapTotal),
            artists: artistsWithGaps,
          }),
        },
      ];
    }

    /* ── Vue artiste (ou label zoomé) ── */
    const artist = getArtist(artistId);
    const months = monthlyRevenueTotals(artistId, 24);
    const best = months.reduce((acc, m) => (m.amount > acc.amount ? m : acc), months[0]);
    const avg = months.reduce((s, m) => s + m.amount, 0) / months.length;

    const delta30 = streamsDelta(artistId, 30);
    const streams30 = sumStreams(artistId, 30);

    const sources = revenueBySource(artistId, 12);
    const topSource = sources[0];
    const total12 = totalRevenue(artistId, 12);

    const findings = auditFindings(artistId);
    const gapTotal = findings.reduce((s, f) => s + (f.expected - f.reported), 0);

    return [
      {
        id: "bestMonth",
        question: t("suggestions.bestMonth"),
        answer: t("answers.bestMonth", {
          month: fmtMonth(locale, best.month),
          amount: fmtEur(locale, best.amount),
          pct: fmtPct(locale, ((best.amount - avg) / avg) * 100),
          avg: fmtEur(locale, Math.round(avg)),
        }),
      },
      {
        id: "growth",
        question: t("suggestions.growth"),
        answer: t("answers.growth", {
          delta: fmtPct(locale, delta30),
          streams: fmtCompact(locale, streams30),
          listeners: fmtCompact(locale, artist.monthlyListeners),
          growthRate: fmtPct(locale, artist.growthRate * 100),
        }),
      },
      {
        id: "topSource",
        question: t("suggestions.topSource"),
        answer: t("answers.topSource", {
          source: t(`sources.${topSource.source as RevenueSource}`),
          amount: fmtEur(locale, topSource.amount),
          pct: fmtPct(locale, (topSource.amount / total12) * 100),
          total: fmtEur(locale, total12),
        }),
      },
      {
        id: "audit",
        question: t("suggestions.audit"),
        answer: t("answers.audit", {
          count: findings.length,
          amount: fmtEur(locale, gapTotal),
        }),
      },
    ];
  }, [t, locale, isRoster, artistId]);
}

export function CopilotChat({
  isRoster,
  artistId,
}: {
  isRoster: boolean;
  artistId: string;
}) {
  const t = useTranslations("copilot");
  const exchanges = useExchanges(isRoster, artistId);

  const greeting = isRoster
    ? t("greeting.label", { count: ARTISTS.length, label: LABEL.name })
    : t("greeting.artist", { name: getArtist(artistId).name });

  /* Thread initial : accueil + 2 échanges pré-joués (vraies données). */
  const initialMessages = useMemo<Message[]>(() => {
    const preplayed = exchanges.slice(0, 2);
    let id = 0;
    return [
      { id: id++, role: "assistant" as const, text: greeting },
      ...preplayed.flatMap((e) => [
        { id: id++, role: "user" as const, text: e.question },
        { id: id++, role: "assistant" as const, text: e.answer },
      ]),
    ];
  }, [exchanges, greeting]);

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [usedChips, setUsedChips] = useState<Set<string>>(
    () => new Set(exchanges.slice(0, 2).map((e) => e.id)),
  );
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const nextId = useRef(initialMessages.length);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const push = (role: Message["role"], text: string) => {
    setMessages((m) => [...m, { id: nextId.current++, role, text }]);
  };

  const reply = (answer: string) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      push("assistant", answer);
    }, TYPING_DELAY_MS);
  };

  const onChip = (exchange: Exchange) => {
    if (typing) return;
    setUsedChips((s) => new Set(s).add(exchange.id));
    push("user", exchange.question);
    reply(exchange.answer);
  };

  const onSend = () => {
    const text = draft.trim();
    if (!text || typing) return;
    setDraft("");
    push("user", text);
    reply(t("chat.generic"));
  };

  const remainingChips = exchanges.filter((e) => !usedChips.has(e.id));

  return (
    <div className="flex h-[600px] flex-col rounded-xl border bg-card">
      {/* En-tête du chat */}
      <div className="flex items-center gap-3 border-b px-5 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Sparkles className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t("chat.assistantName")}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" aria-hidden />
            {t("chat.status")}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "rounded-br-md bg-brand/10 text-foreground"
                    : "rounded-bl-md border bg-surface-2/60",
                )}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
          {typing && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-start"
            >
              <div
                className="flex items-center gap-1 rounded-2xl rounded-bl-md border bg-surface-2/60 px-4 py-3"
                aria-label={t("chat.typing")}
              >
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="size-1.5 rounded-full bg-muted-foreground"
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{
                      duration: 0.9,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chips de suggestions */}
      {remainingChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
          <span className="text-[11px] font-medium text-muted-foreground">
            {t("chat.suggestionsLabel")}
          </span>
          {remainingChips.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onChip(e)}
              className="rounded-full border bg-surface-2/50 px-3 py-1 text-xs transition-colors hover:border-brand/40 hover:text-brand"
            >
              {e.question}
            </button>
          ))}
        </div>
      )}

      {/* Saisie */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={t("chat.placeholder")}
            rows={1}
            className="min-h-10 resize-none"
          />
          <Button
            size="icon"
            onClick={onSend}
            disabled={!draft.trim() || typing}
            aria-label={t("chat.send")}
          >
            <SendHorizontal className="size-4" aria-hidden />
          </Button>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          {t("chat.disclaimer")}
        </p>
      </div>
    </div>
  );
}
