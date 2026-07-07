"use client";

/**
 * Styles d'impression "rapport comptable" injectés à la volée :
 * - masque sidebar, topbar et chrome interactif ;
 * - force fond blanc / texte noir, cartes en bordure fine ;
 * - pied de page fixe avec l'URL et la date du rapport,
 *   rempli au moment de l'impression (événement beforeprint —
 *   jamais de Date.now() au rendu).
 *
 * Monté dans chaque page qui propose un export imprimable.
 */
import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";

const PRINT_CSS = `
@page {
  margin: 14mm 12mm 18mm;
}
html, body {
  background: #fff !important;
}
body {
  color: #000 !important;
}
/* Chrome applicatif : sidebar, topbar, menus flottants. */
aside,
header,
[class*="sidebar"],
[data-slot="dropdown-menu-content"],
[data-slot="dropdown-menu-trigger"] {
  display: none !important;
}
/* … mais on garde les en-têtes de page (titre du rapport). */
main header {
  display: flex !important;
}
/* Les actions d'en-tête (boutons, dialogues) n'ont pas leur place sur papier. */
main header button {
  display: none !important;
}
main {
  max-width: none !important;
  margin: 0 !important;
  padding: 0 0 32px !important;
}
main * {
  color: #000 !important;
  box-shadow: none !important;
  text-shadow: none !important;
}
/* Neutralise les animations d'entrée (sinon opacité figée à 0). */
main .rise-in {
  animation: none !important;
  opacity: 1 !important;
  transform: none !important;
}
/* Cartes : fond blanc, bordure fine, pas de coupure en milieu de page. */
main .bg-card,
main .bg-surface-2,
main .bg-background,
main .bg-popover,
main .bg-muted {
  background: #fff !important;
}
main .border,
main .rounded-xl {
  border-color: #d1d5db !important;
}
main section,
main .rounded-xl {
  break-inside: avoid;
}
/* Pied de page du rapport : URL + date, répété sur chaque page. */
.print-report-footer {
  display: block !important;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding-top: 4px;
  border-top: 1px solid #d1d5db;
  font-size: 9px;
  line-height: 1.4;
  color: #525252 !important;
  background: #fff !important;
}
`;

export function PrintStyles() {
  const locale = useLocale();
  const footerRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const fillFooter = () => {
      if (!footerRef.current) return;
      const stamp = new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date());
      footerRef.current.textContent = `${window.location.href} — ${stamp}`;
    };
    window.addEventListener("beforeprint", fillFooter);
    return () => window.removeEventListener("beforeprint", fillFooter);
  }, [locale]);

  return (
    <>
      <style media="print">{PRINT_CSS}</style>
      <p ref={footerRef} aria-hidden="true" className="hidden print-report-footer" />
    </>
  );
}
