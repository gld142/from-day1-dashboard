"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, Sunrise } from "lucide-react";
import { navForPersona } from "@/lib/nav";
import { usePrefs } from "@/lib/prefs";
import { useRole } from "@/lib/role";
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
  const { persona } = useRole();
  const { isHidden } = usePrefs();
  const sections = navForPersona(persona, isHidden);

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
            ))}
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
