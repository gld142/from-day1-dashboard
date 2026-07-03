"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PROJECTS, TEAM, TRACKS } from "@/lib/demo/api";
import type { Expense } from "@/lib/demo/types";
import { fmtDate, fmtEur } from "@/lib/format";
import { CategoryBadge } from "./category-badge";

const PAGE_SIZE = 20;

/** Registre des dépenses : recherche plein-texte + tableau riche + badge Wavely. */
export function ExpenseRegister({ items }: { items: Expense[] }) {
  const locale = useLocale();
  const t = useTranslations("finances.register");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const projectTitle = useMemo(
    () => new Map(PROJECTS.map((p) => [p.id, p.title])),
    [],
  );
  const trackTitle = useMemo(() => new Map(TRACKS.map((t) => [t.id, t.title])), []);
  const memberName = useMemo(() => new Map(TEAM.map((m) => [m.id, m.name])), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((e) => {
      const haystack = [
        e.label,
        e.projectId ? projectTitle.get(e.projectId) : "",
        e.trackId ? trackTitle.get(e.trackId) : "",
        memberName.get(e.addedBy) ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query, projectTitle, trackTitle, memberName]);

  const visible = filtered.slice(0, limit);

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5 pb-4">
        <div>
          <h2 className="text-sm font-semibold">{t("title")}</h2>
          <p className="num mt-0.5 text-xs text-muted-foreground">
            {t("count", { count: filtered.length })}
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder={t("searchPlaceholder")}
            className="pl-8"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">{t("date")}</TableHead>
              <TableHead>{t("label")}</TableHead>
              <TableHead>{t("category")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("project")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("track")}</TableHead>
              <TableHead className="text-right">{t("amount")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("addedBy")}</TableHead>
              <TableHead className="pr-5">{t("source")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {t("noResults")}
                </TableCell>
              </TableRow>
            )}
            {visible.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="num whitespace-nowrap pl-5 text-xs text-muted-foreground">
                  {fmtDate(locale, e.date, { day: "2-digit", month: "short", year: "2-digit" })}
                </TableCell>
                <TableCell className="max-w-56 truncate font-medium">
                  {e.label}
                </TableCell>
                <TableCell>
                  <CategoryBadge category={e.category} />
                </TableCell>
                <TableCell className="hidden max-w-40 truncate text-muted-foreground md:table-cell">
                  {e.projectId ? (projectTitle.get(e.projectId) ?? "—") : "—"}
                </TableCell>
                <TableCell className="hidden max-w-40 truncate text-muted-foreground lg:table-cell">
                  {e.trackId ? (trackTitle.get(e.trackId) ?? "—") : "—"}
                </TableCell>
                <TableCell className="num whitespace-nowrap text-right font-medium">
                  {fmtEur(locale, e.amount)}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">
                  {memberName.get(e.addedBy) ?? e.addedBy}
                </TableCell>
                <TableCell className="pr-5">
                  {e.source === "wavely" ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
                            <Waves className="size-3" aria-hidden />
                            {t("wavely")}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{t("wavelyTooltip")}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {t("manual")}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filtered.length > limit && (
        <div className="flex items-center justify-between border-t p-3 px-5">
          <span className="num text-xs text-muted-foreground">
            {t("shown", { shown: visible.length, total: filtered.length })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
          >
            {t("showMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
