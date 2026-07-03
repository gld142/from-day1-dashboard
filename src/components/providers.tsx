"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RoleProvider } from "@/lib/role";
import { PrefsProvider } from "@/lib/prefs";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      themes={["night", "dawn", "day"]}
      defaultTheme="night"
      enableSystem={false}
      disableTransitionOnChange
    >
      <RoleProvider>
        <PrefsProvider>
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        </PrefsProvider>
      </RoleProvider>
    </ThemeProvider>
  );
}
