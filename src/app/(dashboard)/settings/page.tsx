"use client";

/**
 * Réglages : modules à la carte (afficher / masquer), apparence, compte.
 */

import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState, useTransition } from "react";
import { Building2, Lock, MicVocal, Moon, RotateCcw, Sun, Sunrise } from "lucide-react";
import { setLocale } from "@/i18n/actions";
import type { Locale } from "@/i18n/config";
import { NAV_SECTIONS } from "@/lib/nav";
import { CORE_MODULES, usePrefs } from "@/lib/prefs";
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/dashboard/page-header";

const THEME_META = [
  { id: "night", icon: Moon },
  { id: "dawn", icon: Sunrise },
  { id: "day", icon: Sun },
] as const;

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const { persona, isLabel } = useRole();
  const { hiddenModules, isHidden, toggleModule } = usePrefs();
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();
  useEffect(() => setMounted(true), []);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* ─── Modules à la carte ─── */}
      <section className="rise-in mb-6 rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
          <div>
            <h2 className="font-heading text-base font-semibold">
              {t("modules.title")}
            </h2>
            <p className="mt-1 max-w-xl text-[13px] text-muted-foreground">
              {t("modules.description")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="num text-xs text-muted-foreground">
              {t("modules.hiddenCount", { count: hiddenModules.length })}
            </span>
            {hiddenModules.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => hiddenModules.forEach((h) => toggleModule(h))}
              >
                <RotateCcw className="size-3" aria-hidden />
                {t("modules.resetAll")}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col">
          {NAV_SECTIONS.filter((s) => s.labelKey !== "sections.account").map(
            (section) => (
              <div key={section.labelKey} className="hairline-t px-5 py-4">
                <h3 className="pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                  {tn(section.labelKey)}
                </h3>
                <ul className="flex flex-col gap-1">
                  {section.items.map((item) => {
                    const core = CORE_MODULES.has(item.href);
                    const labelOnly = item.personas?.includes("label");
                    const disabled = core || (labelOnly && !isLabel);
                    const Icon = item.icon;
                    return (
                      <li
                        key={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors",
                          !disabled && "hover:bg-surface-2",
                        )}
                      >
                        <Icon
                          className="size-4 text-muted-foreground"
                          aria-hidden
                        />
                        <span className="flex-1 text-sm">{tn(item.labelKey)}</span>
                        {labelOnly && (
                          <Badge
                            variant="outline"
                            className="h-5 rounded-full px-2 text-[10px] text-muted-foreground"
                          >
                            <Building2 className="mr-1 size-2.5" aria-hidden />
                            {t("modules.labelOnly")}
                          </Badge>
                        )}
                        {core ? (
                          <Badge
                            variant="outline"
                            className="h-5 rounded-full border-brand/40 px-2 text-[10px] text-brand"
                          >
                            <Lock className="mr-1 size-2.5" aria-hidden />
                            {t("modules.coreHint")}
                          </Badge>
                        ) : (
                          <Switch
                            checked={!isHidden(item.href)}
                            onCheckedChange={() => toggleModule(item.href)}
                            disabled={disabled}
                            aria-label={tn(item.labelKey)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ),
          )}
        </div>
      </section>

      {/* ─── Apparence ─── */}
      <section className="rise-in mb-6 rounded-xl border bg-card p-5">
        <h2 className="font-heading text-base font-semibold">
          {t("appearance.title")}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {t("appearance.description")}
        </p>
        <div className="mt-4 flex flex-wrap gap-6">
          <div>
            <p className="pb-2 text-xs font-medium text-muted-foreground">
              {t("appearance.theme")}
            </p>
            <div className="flex gap-2">
              {THEME_META.map(({ id, icon: Icon }) => {
                const active = mounted && theme === id;
                return (
                  <button
                    key={id}
                    onClick={() => setTheme(id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      active
                        ? "border-brand bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {tc(`themes.${id}`)}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="pb-2 text-xs font-medium text-muted-foreground">
              {t("appearance.language")}
            </p>
            <div className="flex gap-2">
              {(["fr", "en"] as Locale[]).map((l) => (
                <button
                  key={l}
                  onClick={() => startTransition(() => setLocale(l))}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm transition-colors",
                    locale === l
                      ? "border-brand bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tc(`locale.${l}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Compte ─── */}
      <section className="rise-in rounded-xl border bg-card p-5">
        <h2 className="font-heading text-base font-semibold">
          {t("account.title")}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {t("account.description")}
        </p>
        <div className="mt-4 flex items-center gap-3 rounded-lg border bg-surface-2 p-3">
          {persona === "artist" ? (
            <MicVocal className="size-4 text-brand" aria-hidden />
          ) : (
            <Building2 className="size-4 text-brand" aria-hidden />
          )}
          <span className="text-sm">
            {t("account.currentRole")} :{" "}
            <span className="font-medium">
              {tc(persona === "artist" ? "roles.artist" : "roles.label")}
            </span>
          </span>
        </div>
      </section>
    </div>
  );
}
