"use client";

/**
 * Racine du shell dashboard : porte `data-skin` (structure / artiste), dérivée
 * de la persona. Les tokens de skin (globals.css) s'appliquent à tout ce qui
 * est en dessous — sidebar, topbar, pages.
 */
import { useSkin } from "@/lib/skin";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const skin = useSkin();
  return (
    <div data-skin={skin} className="flex min-h-svh w-full">
      {children}
    </div>
  );
}
