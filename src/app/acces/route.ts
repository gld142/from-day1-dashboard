import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, GATE_HASH, GATE_PATH, sha256 } from "@/lib/gate";

/** Seules les adresses internes sont acceptées comme retour (pas de redirection ouverte). */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const error = request.nextUrl.searchParams.has("e");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>From Day 1 — Accès</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0A12;color:#FAFAFE;font:16px/1.5 system-ui,-apple-system,sans-serif}
form{width:min(360px,calc(100% - 32px));display:flex;flex-direction:column;gap:14px}
h1{font-size:22px;margin:0 0 4px;font-weight:600}p{margin:0;color:rgba(250,250,254,.6);font-size:14px}
input{padding:14px 16px;border-radius:12px;border:1px solid rgba(250,250,254,.2);background:rgba(250,250,254,.06);color:inherit;font:inherit}
input:focus{outline:2px solid #7B5CF0;outline-offset:2px}
button{padding:14px;border:0;border-radius:999px;background:#7B5CF0;color:#fff;font:inherit;font-weight:500;cursor:pointer}
.e{color:#ff8a8a}
</style></head><body>
<form method="post" action="${GATE_PATH}">
<h1>Day 1 Pro</h1><p>Accès sur invitation pendant la phase pilote.</p>
<input type="password" name="password" placeholder="Mot de passe" autocomplete="current-password" autofocus required>
<input type="hidden" name="next" value="${esc(next)}">
${error ? '<p class="e">Mot de passe incorrect.</p>' : ""}
<button type="submit">Entrer</button>
</form></body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const next = safeNext(String(form.get("next") ?? "/"));
  if ((await sha256(String(form.get("password") ?? ""))) !== GATE_HASH) {
    return NextResponse.redirect(new URL(`${GATE_PATH}?e=1&next=${encodeURIComponent(next)}`, request.url), 303);
  }
  const res = NextResponse.redirect(new URL(next, request.url), 303);
  res.cookies.set(GATE_COOKIE, GATE_HASH, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
