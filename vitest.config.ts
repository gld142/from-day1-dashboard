import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    // La couche réelle reconstruit 239 titres × 730 jours pour Dadju (~1 s isolé) ;
    // sous forte charge machine, le premier appel a été mesuré à 7,5 s.
    testTimeout: 20_000,
  },
});
