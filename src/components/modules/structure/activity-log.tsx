"use client";

/**
 * Journal d'activité — entrées déterministes cohérentes avec les données
 * démo (membres TEAM, artistes du roster, titres du catalogue).
 */
import { useLocale, useTranslations } from "next-intl";
import {
  FileSignature,
  FileSearch,
  Receipt,
  Split,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { fmtDate } from "@/lib/format";
import { artistColor } from "@/lib/format";
import { hueForName } from "@/components/modules/structure/team-avatar";

type Entry = {
  key: "expense" | "export" | "split" | "contract" | "audit" | "invite";
  icon: LucideIcon;
  date: string; // ISO — cohérent avec lastActive des membres TEAM
  name: string;
  params: Record<string, string>;
};

/** Entrées fixes, alignées sur TEAM (noms, lastActive) et le roster. */
const ENTRIES: Entry[] = [
  {
    key: "expense",
    icon: Receipt,
    date: "2026-07-02",
    name: "Omar B.",
    params: { artist: "Mira Sol" },
  },
  {
    key: "split",
    icon: Split,
    date: "2026-07-01",
    name: "Lisa M.",
    params: { track: "Nova" },
  },
  {
    key: "audit",
    icon: FileSearch,
    date: "2026-06-30",
    name: "Gaël C.",
    params: { artist: "KAYRO" },
  },
  {
    key: "export",
    icon: Receipt,
    date: "2026-06-28",
    name: "Inès T.",
    params: {},
  },
  {
    key: "contract",
    icon: FileSignature,
    date: "2026-06-20",
    name: "Me Marc D.",
    params: { artist: "Sky Lune" },
  },
  {
    key: "invite",
    icon: UserPlus,
    date: "2026-06-15",
    name: "Gaël C.",
    params: { invitee: "Omar B." },
  },
];

export function ActivityLog() {
  const t = useTranslations("team");
  const locale = useLocale();

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">{t("activity.title")}</h2>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {t("activity.subtitle")}
      </p>
      <ol className="mt-4 space-y-0">
        {ENTRIES.map((e, i) => {
          const Icon = e.icon;
          const params =
            e.key === "invite"
              ? { name: e.name, ...e.params, role: t("roles.marketing") }
              : { name: e.name, ...e.params };
          return (
            <li key={`${e.key}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
              {/* Ligne de temps */}
              {i < ENTRIES.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-px bg-border"
                />
              )}
              <span
                className="mt-0.5 flex size-[27px] shrink-0 items-center justify-center rounded-full border bg-surface-2"
                style={{ color: artistColor(hueForName(e.name)) }}
              >
                <Icon className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-xs leading-relaxed">
                  {t(`activity.entries.${e.key}`, params)}
                </p>
                <p className="num mt-0.5 text-[11px] text-muted-foreground">
                  {fmtDate(locale, e.date)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
