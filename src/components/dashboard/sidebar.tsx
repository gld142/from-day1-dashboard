"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Sunrise } from "lucide-react";
import { navForPersona } from "@/lib/nav";
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const { persona } = useRole();
  const sections = navForPersona(persona);

  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
      {/* Marque */}
      <div className="flex h-14 items-center gap-2.5 px-4">
        <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-brand-foreground">
          <Sunrise className="size-4" aria-hidden />
        </span>
        <div className="leading-none">
          <div className="font-heading text-[15px] font-semibold tracking-tight">
            {tc("app.name")}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {tc("app.tagline")}
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2 pb-4">
        <nav className="flex flex-col gap-4 pt-2">
          {sections.map((section) => (
            <div key={section.labelKey}>
              <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                {t(section.labelKey)}
              </div>
              <ul className="flex flex-col gap-px">
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <li key={item.href} className="relative">
                      {active && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-0 rounded-md bg-sidebar-accent"
                          transition={{ type: "spring", stiffness: 400, damping: 34 }}
                        />
                      )}
                      <Link
                        href={item.href}
                        className={cn(
                          "relative z-10 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                          active
                            ? "font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4",
                            active ? "text-brand" : "text-muted-foreground/70",
                          )}
                          aria-hidden
                        />
                        <span className="truncate">{t(item.labelKey)}</span>
                        {item.badgeKey && (
                          <Badge
                            variant="outline"
                            className="ml-auto h-4 rounded-full border-brand/40 px-1.5 text-[9px] uppercase tracking-wide text-brand"
                          >
                            {tc(`actions.${item.badgeKey}`)}
                          </Badge>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="hairline-t px-4 py-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden />
          {tc("states.upToDate")}
        </span>
      </div>
    </aside>
  );
}
