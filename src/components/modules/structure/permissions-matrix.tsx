"use client";

/**
 * Matrice permissions : modules × rôles, dérivée des données TEAM.
 * Check = accès, Minus = pas d'accès. Libellés modules via nav (lecture seule).
 */
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Check, Minus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TEAM } from "@/lib/demo/api";
import type { TeamMember } from "@/lib/demo/types";

/** Modules affichés dans la matrice (clés = items de nav). */
const MATRIX_MODULES = [
  "streams",
  "audience",
  "fans",
  "finances",
  "revenue",
  "urssaf",
  "rights",
  "contracts",
  "splits",
  "audit",
] as const;

const ROLES: TeamMember["role"][] = [
  "owner",
  "manager",
  "marketing",
  "comptable",
  "avocat",
];

export function PermissionsMatrix() {
  const t = useTranslations("team");
  const tNav = useTranslations("nav");

  /** role → ensemble des modules accessibles ("all" = tout). */
  const access = useMemo(() => {
    const map = new Map<TeamMember["role"], "all" | Set<string>>();
    for (const role of ROLES) {
      const member = TEAM.find((m) => m.role === role);
      if (!member) continue;
      map.set(
        role,
        member.modules === "all" ? "all" : new Set(member.modules),
      );
    }
    return map;
  }, []);

  function hasAccess(role: TeamMember["role"], module: string): boolean {
    const a = access.get(role);
    if (!a) return false;
    return a === "all" || a.has(module);
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="px-5 pb-2 pt-5">
        <h2 className="text-sm font-semibold">{t("matrix.title")}</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {t("matrix.subtitle")}
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">{t("matrix.module")}</TableHead>
              {ROLES.map((role) => (
                <TableHead key={role} className="text-center">
                  {t(`roles.${role}`)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {MATRIX_MODULES.map((module) => (
              <TableRow key={module}>
                <TableCell className="pl-5 font-medium">
                  {tNav(`items.${module}`)}
                </TableCell>
                {ROLES.map((role) => (
                  <TableCell key={role} className="text-center">
                    {hasAccess(role, module) ? (
                      <Check className="mx-auto size-4 text-success" aria-hidden />
                    ) : (
                      <Minus
                        className="mx-auto size-4 text-muted-foreground/40"
                        aria-hidden
                      />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
