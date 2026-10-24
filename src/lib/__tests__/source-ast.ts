/**
 * Lecture du code SOURCE pour les tests de câblage (proxy léger, fournisseurs next-intl, imports
 * de types) : l'arbre syntaxique de TypeScript, jamais une expression régulière sur le texte — un
 * commentaire qui cite un nom n'est pas un usage, et un import réécrit sur deux lignes reste un
 * import.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/** Racine de src/ (ce fichier vit dans src/lib/__tests__) et racine du projet. */
export const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const ROOT = resolve(SRC, "..");

/** Chemin relatif au projet (« src/lib/nav.ts »), pour des messages et des listes lisibles. */
export const rel = (file: string) => relative(ROOT, file).split("\\").join("/");

const CODE = /\.(c|m)?(j|t)sx?$/;

export function parse(file: string): ts.SourceFile {
  const kind = /\.(t|j)sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, kind);
}

export type ModuleRef = { specifier: string; typeOnly: boolean; text: string };

/** Les liens d'un module vers un autre : `import`, `export … from`, `import()` dynamique. */
export function moduleRefs(sf: ts.SourceFile): ModuleRef[] {
  const refs: ModuleRef[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      refs.push({ specifier: node.moduleSpecifier.text, typeOnly: !!node.importClause?.isTypeOnly, text: node.getText(sf) });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      refs.push({ specifier: node.moduleSpecifier.text, typeOnly: node.isTypeOnly, text: node.getText(sf) });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [arg] = node.arguments;
      refs.push({ specifier: arg && ts.isStringLiteralLike(arg) ? arg.text : "<dynamique>", typeOnly: false, text: node.getText(sf) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return refs;
}

const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"];

/** Le fichier de src/ qu'un import désigne (`@/…` ou relatif) ; null pour un paquet. */
export function resolveLocal(specifier: string, from: string): string | null {
  const base = specifier.startsWith("@/")
    ? join(SRC, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(from), specifier)
      : null;
  if (base === null) return null;
  for (const ext of EXTENSIONS) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  throw new Error(`import introuvable : « ${specifier} » (depuis ${rel(from)})`);
}

const packageName = (s: string) => (s.startsWith("@") ? s.split("/").slice(0, 2) : s.split("/").slice(0, 1)).join("/");

/**
 * Ce qu'un module emporte À L'EXÉCUTION : les fichiers de src/ atteints par des imports de valeur
 * (un `import type` est effacé à la compilation), et les paquets qu'ils importent. Les paquets ne
 * sont pas parcourus : seul le code du projet l'est.
 */
export function valueImportGraph(entry: string): { modules: string[]; packages: string[] } {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!CODE.test(file)) continue; // JSON, CSS : pas d'import
    for (const ref of moduleRefs(parse(file))) {
      if (ref.typeOnly) continue;
      const local = resolveLocal(ref.specifier, file);
      if (local) stack.push(local);
      else packages.add(packageName(ref.specifier));
    }
  }
  return { modules: [...seen].map(rel).sort(), packages: [...packages].sort() };
}

/**
 * Les usages d'un nom dans le CODE : identifiants (imports, JSX, accès) et chaînes littérales.
 * Les commentaires n'en sont pas.
 */
export function codeMentions(sf: ts.SourceFile, name: string): number {
  let n = 0;
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && node.text === name) n++;
    else if (ts.isStringLiteralLike(node) && node.text.includes(name)) n++;
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return n;
}

/** Les fichiers de code de `dir`, récursivement, hors tests (`__tests__/`, `*.test.*`). */
export function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return d.name === "__tests__" || d.name === "node_modules" ? [] : sourceFiles(p);
    return CODE.test(d.name) && !/\.test\./.test(d.name) ? [p] : [];
  });
}
