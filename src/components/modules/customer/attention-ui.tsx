"use client";

/**
 * Attention Wikipédia d'un artiste : vues de sa page sur 30 jours, évolution, pic,
 * 90 jours en barres — et la correction du lien par l'équipe (mauvais article, ou
 * « aucune page »). Indicateur d'attention mesuré, HORS Day 1 Index.
 */
import { useActionState, useState } from "react";
import { Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Button } from "@/components/ui/button";
import type { CustomerWiki, WikiLink } from "@/lib/accounts/customer";
import { attention } from "@/lib/attention/wikipedia";
import { parisDate } from "@/lib/collect/dates";
import type { RegisterFormState } from "@/lib/registers/persist";
import { F, RegisterForm, TextIn } from "./register-ui";
import { longDate } from "./signals-ui";
import { useFormats } from "./shared";

type Action = (s: RegisterFormState, f: FormData) => Promise<RegisterFormState>;

export const wikiUrl = (l: Pick<WikiLink, "project" | "article">) => `https://${l.project}.org/wiki/${encodeURIComponent(l.article ?? "")}`;
export const seriesOf = (wiki: CustomerWiki | null | undefined, l: WikiLink | undefined) => (l?.article && wiki ? (wiki.views[`${l.project}|${l.article}`] ?? []) : []);

/** Rapport → « +35 % » / « −20 % ». */
export const ratioPct = (r: number, locale: string) => `${r >= 1 ? "+" : "−"}${Math.abs(Math.round((r - 1) * 1000) / 10).toLocaleString(locale)} %`;

export function WikiAttention({
  name,
  link,
  wiki,
  canEdit,
  hidden,
  action,
}: {
  name: string;
  link: WikiLink | undefined;
  wiki: CustomerWiki | null | undefined;
  canEdit: boolean;
  /** Champ caché qui désigne le sujet : { artist_id } ou { watch_id }. */
  hidden: Record<string, string>;
  action: Action;
}) {
  const f = useFormats();
  const today = parisDate(new Date());
  const series = seriesOf(wiki, link);
  const a = attention(series, today);
  const last90 = series.slice(-90);
  const max = Math.max(1, ...last90.map((s) => s.views));

  return (
    <>
      <Sheet family="audience">
        <SheetHeading action={link?.article ? <a href={wikiUrl(link)} target="_blank" rel="noreferrer" className="underline">page Wikipédia →</a> : undefined}>
          Attention · Wikipédia
        </SheetHeading>
        {!link ? (
          <p className="text-sm">Day 1 cherche la page Wikipédia de {name} à la prochaine collecte (chaque nuit).</p>
        ) : link.method === "none" ? (
          <p className="text-sm">Aucune page Wikipédia {link.checked_at ? "trouvée" : ""} pour {name}.</p>
        ) : !a || a.last30 === 0 ? (
          <p className="text-sm">Page reliée ({link.article?.replace(/_/g, " ")}) : les vues arrivent à la prochaine collecte.</p>
        ) : (
          <>
            <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{f.int(a.last30)}</p>
            <p className="sheet-ink mt-1.5 text-[13px]">
              vues de la page sur 30 jours (du {longDate(a.from, f.locale)} au {longDate(a.to, f.locale)})
              {a.change !== null ? ` · ${ratioPct(a.change, f.locale)} sur les 30 jours d'avant` : ""}
              {a.peak ? ` · pic le ${longDate(a.peak.day, f.locale)} (${f.int(a.peak.views)})` : ""}
            </p>
            {last90.length > 1 && (
              <div className="mt-3 flex h-14 items-end gap-px" aria-label="Vues par jour, 90 derniers jours">
                {last90.map((s) => (
                  <div key={s.day} title={`${longDate(s.day, f.locale)} : ${f.int(s.views)}`} className="bg-current/40 min-w-0 flex-1 rounded-t-[1px]" style={{ height: `${Math.max(2, (s.views / max) * 100)}%` }} />
                ))}
              </div>
            )}
          </>
        )}
        {canEdit && <WikiLinkEditor action={action} hidden={hidden} hasArticle={Boolean(link?.article)} className="mt-3" />}
      </Sheet>
      <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        <ProvenanceBadge provenance="measured" /> Vues humaines de la page (robots exclus), API Pageviews de Wikimedia, données CC0.
        {link?.method === "auto" ? " Page trouvée automatiquement par Wikidata." : link?.method === "manual" ? " Page choisie par ton équipe." : ""}{" "}Indicateur d&apos;attention : il n&apos;entre pas dans le Day 1 Index.
      </p>
    </>
  );
}

/** « Pas le bon article ? » : coller le lien de la bonne page, ou dire qu'il n'y en a pas. */
export function WikiLinkEditor({ action, hidden, hasArticle, className }: { action: Action; hidden: Record<string, string>; hasArticle: boolean; className?: string }) {
  const [editing, setEditing] = useState(false);
  if (!editing)
    return (
      <button type="button" className={`text-muted-foreground text-xs underline ${className ?? ""}`} onClick={() => setEditing(true)}>
        {hasArticle ? "Pas le bon article ?" : "Indiquer la page Wikipédia"}
      </button>
    );
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <RegisterForm action={action} onDone={() => setEditing(false)}>
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <F label="Lien de la page Wikipédia (fr ou en)">
          <TextIn name="url" required placeholder="https://fr.wikipedia.org/wiki/…" />
        </F>
      </RegisterForm>
      <NoPage action={action} hidden={hidden} onDone={() => setEditing(false)} />
    </div>
  );
}

function NoPage({ action, hidden, onDone }: { action: Action; hidden: Record<string, string>; onDone: () => void }) {
  const [state, run, pending] = useActionState(async (s: RegisterFormState, fd: FormData) => {
    const r = await action(s, fd);
    if (r.status === "ok") onDone();
    return r;
  }, { status: "idle" } as RegisterFormState);
  return (
    <form action={run}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="none" value="1" />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>Cet artiste n&apos;a pas de page Wikipédia</Button>
      {state.status === "error" && <p className="text-destructive text-xs" role="alert">{state.message}</p>}
    </form>
  );
}
