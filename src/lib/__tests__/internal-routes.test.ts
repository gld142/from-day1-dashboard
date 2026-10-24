/**
 * Proxy léger. src/proxy.ts tourne avant CHAQUE requête, et son bundle embarque tout ce qu'il
 * importe. Mesuré le 24/10/2026 (build day1 de acf3754, `.next-e2e/server/chunks`) : sa liste des
 * pages internes était dérivée de nav.ts, qui importe les icônes lucide-react —
 * `lucide-react/dist/esm/Icon.mjs` se lisait dans le chunk du proxy (435 938 octets). La liste vit
 * désormais dans internal-routes.ts, sans import de valeur ; internal-pages.test.ts garantit
 * qu'elle est exactement celle des items `internal` de nav.ts, dans les deux sens.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SRC, moduleRefs, parse, valueImportGraph } from "./source-ast";

describe("proxy léger : ni nav.ts ni lucide-react derrière src/proxy.ts", () => {
  it("témoin : le parcours trouve bien lucide-react derrière nav.ts", () => {
    const nav = valueImportGraph(join(SRC, "lib/nav.ts"));
    expect(nav.modules).toContain("src/lib/nav.ts");
    expect(nav.packages).toContain("lucide-react");
  });

  it("le proxy n'importe ni nav.ts ni lucide-react, même indirectement ; il lit internal-routes.ts", () => {
    const proxy = valueImportGraph(join(SRC, "proxy.ts"));
    expect(proxy.modules).toContain("src/lib/tenant.ts"); // témoin : le parcours suit les imports « @/ »
    expect(proxy.modules).toContain("src/lib/internal-routes.ts");
    expect(proxy.modules).not.toContain("src/lib/nav.ts");
    expect(proxy.packages).not.toContain("lucide-react");
    // Photo : un nouveau paquet dans le proxy (bundle de chaque requête) se décide ici.
    expect(proxy.packages).toEqual(["@supabase/ssr", "next"]);
  });

  it("internal-routes.ts n'a aucun import de valeur (types seulement)", () => {
    const refs = moduleRefs(parse(join(SRC, "lib/internal-routes.ts")));
    expect(refs.filter((r) => !r.typeOnly).map((r) => r.text)).toEqual([]);
  });
});
