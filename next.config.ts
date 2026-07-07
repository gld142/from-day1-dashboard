import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // distDir séparé pour la QA e2e (Playwright, port 3100) : Next 16 verrouille
  // le distDir par instance de `next dev` — sans ça, impossible de lancer le
  // serveur de test pendant qu un dev server tourne déjà sur .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default withNextIntl(nextConfig);
