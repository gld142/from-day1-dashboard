"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RoleProvider } from "@/lib/role";

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
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
      </RoleProvider>
    </ThemeProvider>
  );
}
