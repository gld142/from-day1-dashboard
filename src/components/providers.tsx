"use client";

import { MotionConfig } from "framer-motion";
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
      {/* prefers-reduced-motion : framer-motion coupe transformations et
          animations de layout, ne garde que les fondus. */}
      <MotionConfig reducedMotion="user">
        <RoleProvider>
          <PrefsProvider>
            <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
          </PrefsProvider>
        </RoleProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
