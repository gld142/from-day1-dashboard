"use client";

/**
 * Menu d'export standard des pages : CSV comptable + rapport imprimable.
 * Les libellés arrivent déjà traduits depuis le namespace de la page
 * (ex. finances.export.csv) — aucun texte en dur ici.
 */
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { printReport } from "@/lib/export";

/** Laisse le menu se refermer avant d'ouvrir le dialogue d'impression. */
const PRINT_DELAY_MS = 150;

export function ExportMenu({
  label,
  csvLabel,
  printLabel,
  onExportCsv,
}: {
  /** Libellé du bouton déclencheur (ex. t("export.button")). */
  label: string;
  /** Libellé de l'item CSV (ex. t("export.csv")). */
  csvLabel: string;
  /** Libellé de l'item impression (ex. t("export.print")). */
  printLabel: string;
  /** Construit et télécharge le CSV — fourni par la page. */
  onExportCsv: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download aria-hidden />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => onExportCsv()}>
          <FileSpreadsheet aria-hidden />
          {csvLabel}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            window.setTimeout(printReport, PRINT_DELAY_MS);
          }}
        >
          <Printer aria-hidden />
          {printLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
