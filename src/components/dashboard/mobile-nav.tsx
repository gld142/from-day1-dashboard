"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, Menu, Sunrise } from "lucide-react";
import { useModules } from "@/lib/userdata/use-modules";
import { useNavCollapse } from "@/lib/nav-collapse";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const { sections } = useModules();
  // Même choix qu'en barre latérale : ce que l'utilisateur replie d'un côté
  // reste replié de l'autre (même clé de stockage).
  const { collapsed, toggle } = useNavCollapse();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={tc("app.name")}
        >
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="hairline-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-left font-heading text-base">
            <span className="flex size-6 items-center justify-center rounded-md bg-brand text-brand-foreground">
              <Sunrise className="size-3.5" aria-hidden />
            </span>
            {tc("app.name")}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100svh-3.5rem)] px-2 py-3">
          <nav className="flex flex-col gap-4">
            {sections.map((section) => {
              const isCollapsed = collapsed.has(section.labelKey);
              const domId = `m-nav-${section.labelKey.replace(/[^a-zA-Z0-9]+/g, "-")}`;
              const holdsActive = section.items.some((i) => i.href === pathname);
              return (
              <div key={section.labelKey}>
                <button
                  type="button"
                  onClick={() => toggle(section.labelKey)}
                  aria-expanded={!isCollapsed}
                  aria-controls={domId}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                  <ChevronDown
                    className={cn(
                      "size-3 shrink-0 transition-transform duration-200",
                      isCollapsed && "-rotate-90",
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{t(section.labelKey)}</span>
                  {isCollapsed && holdsActive && (
                    <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  )}
                  {isCollapsed && (
                    <span className="num ml-auto shrink-0 opacity-60">{section.items.length}</span>
                  )}
                </button>
                <ul id={domId} className="flex flex-col gap-px" hidden={isCollapsed}>
                  {section.items.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                            active
                              ? "bg-accent font-medium text-foreground"
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
                          {t(item.labelKey)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
              );
            })}
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
