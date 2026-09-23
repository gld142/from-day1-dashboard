"use client";

/**
 * Réglages : modules à la carte (afficher / masquer), apparence, compte.
 */

import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore, useTransition } from "react";
import { Building2, EyeOff, Lock, MicVocal, Moon, RotateCcw, Sun, Sunrise } from "lucide-react";
import { setLocale } from "@/i18n/actions";
import type { Locale } from "@/i18n/config";
import { LOCKED_MODULES } from "@/lib/nav";
import { useRole } from "@/lib/role";
import { useModules } from "@/lib/userdata/use-modules";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/dashboard/page-header";
import { Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { RestRow } from "@/components/modules/pilotage/pulse-blocks";

const THEME_META = [
  { id: "night", icon: Moon },
  { id: "dawn", icon: Sunrise },
  { id: "day", icon: Sun },
] as const;

/** Aucune source externe à écouter : l'abonnement est un no-op stable. */
const subscribeNever = () => () => {};

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const { persona } = useRole();
  const { catalog, isVisible, setVisible, reset, hasOverrides } = useModules();
  const hiddenCount = catalog.reduce(
    (n, s) => n + s.items.filter((i) => !isVisible(i)).length,
    0,
  );
  const [, startTransition] = useTransition();
  /* « Suis-je côté client ? » — next-themes ne connaît le thème qu'après
     hydratation. `useSyncExternalStore` le dit sans setState dans un effet,
     qui déclencherait un second rendu en cascade. */
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="space-y-3">
      {/* ─── Modules à la carte ─── */}
      <Sheet family="catalog">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <SheetHeading>{t("modules.title")}</SheetHeading>
            <p className="sheet-ink max-w-xl text-[12.5px] leading-relaxed">
              {t("modules.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="num text-xs text-muted-foreground">
              {t("modules.hiddenCount", { count: hiddenCount })}
            </span>
            {hasOverrides && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={reset}
              >
                <RotateCcw className="size-3" aria-hidden />
                {t("modules.reset")}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col">
          {catalog.map((section) => (
            <div key={section.labelKey} className="hairline-t px-5 py-4">
              <h3 className="pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                {tn(section.labelKey)}
              </h3>
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const locked = LOCKED_MODULES.has(item.href);
                  const visible = isVisible(item);
                  const key = item.labelKey.replace(/^items\./, "");
                  const Icon = item.icon;
                  return (
                    <li
                      key={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors",
                        !locked && "hover:bg-surface-2",
                        !visible && "text-muted-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          visible ? "text-muted-foreground" : "text-muted-foreground/60",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm">{tn(item.labelKey)}</span>
                          {item.internal && (
                            <Badge
                              variant="outline"
                              className="h-5 rounded-full border-warning/50 px-2 text-[10px] text-warning"
                            >
                              <EyeOff className="mr-1 size-2.5" aria-hidden />
                              {t("modules.internal")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t(`modules.desc.${key}`)}
                        </p>
                      </div>
                      {locked ? (
                        <Badge
                          variant="outline"
                          className="h-5 shrink-0 rounded-full border-brand/40 px-2 text-[10px] text-brand"
                        >
                          <Lock className="mr-1 size-2.5" aria-hidden />
                          {t("modules.coreHint")}
                        </Badge>
                      ) : (
                        <Switch
                          checked={visible}
                          onCheckedChange={(v) => setVisible(item.href, v)}
                          aria-label={tn(item.labelKey)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Sheet>

      {/* ─── Apparence ─── */}
      <Sheet family="catalog">
        <SheetHeading>{t("appearance.title")}</SheetHeading>
        <p className="sheet-ink text-[12.5px] leading-relaxed">
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
      </Sheet>

      {/* ─── Compte ─── */}
      <Sheet family="catalog">
        <SheetHeading>{t("account.title")}</SheetHeading>
        <p className="sheet-ink text-[12.5px] leading-relaxed">
          {t("account.description")}
        </p>
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-[color-mix(in_oklab,var(--sheet-line)_12%,transparent)] p-3">
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
      </Sheet>

      <RestRow
        title={tc("blocks.rest")}
        items={[
          { key: "pulse", href: "/pulse", label: t("rest.pulse") },
          { key: "team", href: "/team", label: t("rest.team") },
          { key: "import", href: "/import", label: t("rest.import") },
          { key: "revenue", href: "/revenue", label: t("rest.revenue") },
          { key: "catalog", href: "/catalog", label: t("rest.catalog") },
          { key: "copilot", href: "/copilot", label: t("rest.copilot") },
        ]}
      />
      </div>
    </div>
  );
}
