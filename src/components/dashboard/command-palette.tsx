"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { navForPersona } from "@/lib/nav";
import { ARTISTS } from "@/lib/demo/api";
import { usePrefs } from "@/lib/prefs";
import { useRole } from "@/lib/role";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ArtistAvatar } from "@/components/dashboard/artist-badge";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const { persona, isLabel, setFocusedArtistId } = useRole();
  const { isHidden } = usePrefs();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const sections = navForPersona(persona, isHidden);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden h-8 w-52 justify-start gap-2 text-muted-foreground md:inline-flex"
      >
        <Search className="size-3.5" aria-hidden />
        <span className="text-xs">{tc("actions.search")}</span>
        <kbd className="num pointer-events-none ml-auto rounded border bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={tc("actions.search")} />
        <CommandList>
          <CommandEmpty>{tc("table.noResults")}</CommandEmpty>
          {sections.map((section) => (
            <CommandGroup key={section.labelKey} heading={t(section.labelKey)}>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    value={`${t(item.labelKey)} ${item.href}`}
                    onSelect={() => go(item.href)}
                    className="gap-2.5"
                  >
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                    {t(item.labelKey)}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
          {isLabel && (
            <>
              <CommandSeparator />
              <CommandGroup heading={tc("roles.label")}>
                {ARTISTS.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={`${a.name} ${a.genre}`}
                    onSelect={() => {
                      setFocusedArtistId(a.id);
                      setOpen(false);
                    }}
                    className="gap-2.5"
                  >
                    <ArtistAvatar artist={a} size="sm" />
                    <span className="flex-1">{a.name}</span>
                    <span className="text-xs text-muted-foreground">{a.genre}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
