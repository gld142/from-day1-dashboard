"use client";

/**
 * /ar-watch en mode client (propriétaire et équipe) — le radar A&R sur des
 * positions MESURÉES : les artistes hors roster qui entrent ou montent dans les
 * classements Apple Music des 10 pays suivis, et la liste que la structure suit
 * (avec leur présence du jour dans ces classements). Aucun artiste fictif,
 * aucune projection d'investissement tant qu'elle ne repose pas sur tes hypothèses.
 */
import { useActionState, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Button } from "@/components/ui/button";
import { addWatch, removeWatch, setWatchWiki } from "@/app/(dashboard)/ar-watch/actions";
import { attention } from "@/lib/attention/wikipedia";
import { parisDate } from "@/lib/collect/dates";
import { WikiLinkEditor, ratioPct, seriesOf, wikiUrl } from "./attention-ui";
import { APPLE_COUNTRY_LABEL, type AppleCountry } from "@/lib/collect/apple-music";
import { useCustomer, useCustomerSignals } from "@/lib/customer-mode";
import { normArtist, risers, rosterInCharts, type Riser } from "@/lib/market/charts";
import type { RegisterFormState } from "@/lib/registers/persist";
import { DeleteRow, F, RegisterForm, TextIn } from "./register-ui";
import { Needs, SourceLine, longDate } from "./signals-ui";
import { SimpleTable, useFormats } from "./shared";

export function CustomerAr() {
  const f = useFormats();
  const customer = useCustomer();
  const signals = useCustomerSignals();
  const charts = signals?.charts ?? null;
  const watchlist = useMemo(() => signals?.watchlist ?? [], [signals?.watchlist]);
  const canEdit = customer?.role === "owner" || customer?.role === "member";
  const [adding, setAdding] = useState(false);

  const radar = useMemo(() => {
    if (!charts?.latestDate || !charts.previous.length) return [];
    const roster = (signals?.artists ?? []).map((a) => a.name);
    const best = new Map<string, Riser>();
    for (const c of new Set(charts.latest.map((r) => r.country))) {
      const list = risers(
        charts.latest.filter((r) => r.country === c),
        charts.previous.filter((r) => r.country === c),
        roster,
        100,
      );
      for (const r of list) {
        const k = normArtist(r.artist);
        if ((best.get(k)?.score ?? -1) < r.score) best.set(k, r);
      }
    }
    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, 20);
  }, [charts, signals?.artists]);

  const watched = useMemo(() => {
    const presence = rosterInCharts(charts?.latest ?? [], watchlist.map((w) => ({ id: w.id, name: w.artist_name })));
    return watchlist.map((w) => ({ ...w, entries: presence.find((p) => p.artistId === w.id)?.entries ?? [] }));
  }, [charts?.latest, watchlist]);
  const isWatched = (name: string) => watchlist.some((w) => normArtist(w.artist_name) === normArtist(name));

  return (
    <div className="rise-in">
      <PageHeader title="A&R Watch" subtitle={`Les artistes qui montent, hors de ton roster · ${customer?.workspaceName ?? ""}`}>
        {canEdit && !adding && <Button onClick={() => setAdding(true)}>Suivre un artiste</Button>}
      </PageHeader>
      <div className="space-y-3">
        {adding && (
          <Sheet family="catalog">
            <SheetHeading>Suivre un artiste</SheetHeading>
            <RegisterForm action={addWatch} onDone={() => setAdding(false)}>
              <input type="hidden" name="workspace_id" value={customer?.workspaceId ?? ""} />
              <div className="grid gap-4 sm:grid-cols-2">
                <F label="Nom d'artiste (tel qu'il est crédité)"><TextIn name="artist_name" required maxLength={160} /></F>
                <F label="Notes"><TextIn name="notes" maxLength={2000} /></F>
              </div>
            </RegisterForm>
          </Sheet>
        )}

        <Sheet family="trends">
          <SheetHeading action={charts?.previousDate ? `du ${longDate(charts.previousDate, f.locale)} au ${longDate(charts.latestDate!, f.locale)}` : undefined}>Ça monte</SheetHeading>
          {!charts?.latestDate ? (
            <p className="text-sm">Pas encore de classement relevé : la collecte tourne chaque nuit.</p>
          ) : !charts.previousDate ? (
            <p className="text-sm">Premier classement relevé le {longDate(charts.latestDate, f.locale)} : les entrées et les montées apparaissent dès le 2e jour de collecte. Rien n&apos;est deviné d&apos;ici là.</p>
          ) : radar.length === 0 ? (
            <p className="text-sm">Aucune entrée ni montée hors de ton roster depuis le dernier relevé.</p>
          ) : (
            <SimpleTable
              head={["Artiste", "Titre", "Où", "Mouvement", ""]}
              rows={radar.map((r) => ({
                key: `${r.artist}-${r.country}`,
                cells: [
                  <span key="a" className="font-medium">{r.artist}</span>,
                  r.url ? <a key="t" href={r.url} target="_blank" rel="noreferrer" className="hover:underline">{r.title}</a> : r.title,
                  `n° ${r.position} · ${APPLE_COUNTRY_LABEL[r.country as AppleCountry] ?? r.country}`,
                  r.kind === "new" ? "entrée" : `+${r.by} places`,
                  canEdit && !isWatched(r.artist) ? <FollowButton key="w" workspaceId={customer?.workspaceId ?? ""} name={r.artist} /> : isWatched(r.artist) ? <span key="w" className="text-muted-foreground text-xs">suivi</span> : "",
                ],
              }))}
            />
          )}
        </Sheet>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <ProvenanceBadge provenance="measured" /> Entrées et montées dans les classements Apple Music (10 pays), d&apos;un relevé au suivant. Une entrée compte 101 − sa place ; une montée, les places gagnées.
          <SourceLine source="apple_music" runs={signals?.runs ?? []} locale={f.locale} className="basis-full" />
        </div>

        <Sheet family="catalog">
          <SheetHeading>Ta liste à suivre</SheetHeading>
          {watched.length === 0 ? (
            <p className="text-sm">{canEdit ? "Personne pour l'instant. Ajoute un artiste : Day 1 te dit chaque jour s'il est dans les classements." : "Liste vide."}</p>
          ) : (
            <ul className="grid gap-2">
              {watched.map((w) => {
                const best = w.entries[0];
                return (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-current/10 pt-2 text-sm first:border-t-0 first:pt-0">
                    <span className="min-w-0">
                      <span className="font-medium">{w.artist_name}</span>
                      <span className="text-muted-foreground block text-xs">
                        {best
                          ? `${w.entries.length} titre${w.entries.length > 1 ? "s" : ""} classé${w.entries.length > 1 ? "s" : ""} aujourd'hui · meilleure place n° ${best.position} (${APPLE_COUNTRY_LABEL[best.country as AppleCountry] ?? best.country}, « ${best.title} »)`
                          : "absent des classements suivis aujourd'hui"}
                        {w.notes ? ` · ${w.notes}` : ""}
                      </span>
                      {(() => {
                        const link = signals?.wiki?.links.find((l) => l.watch_id === w.id);
                        const a = attention(seriesOf(signals?.wiki, link), parisDate(new Date()));
                        return (
                          <span className="text-muted-foreground block text-xs">
                            Wikipédia :{" "}
                            {!link ? (
                              "page recherchée à la prochaine collecte"
                            ) : link.method === "none" ? (
                              "pas de page"
                            ) : a && a.last30 > 0 ? (
                              <a href={wikiUrl(link)} target="_blank" rel="noreferrer" className="underline">
                                {f.int(a.last30)} vues sur 30 jours{a.change !== null ? ` (${ratioPct(a.change, f.locale)})` : ""}
                              </a>
                            ) : (
                              "vues à la prochaine collecte"
                            )}
                            {canEdit && <WikiLinkEditor action={setWatchWiki} hidden={{ watch_id: w.id }} hasArticle={Boolean(link?.article)} className="ml-2" />}
                          </span>
                        );
                      })()}
                    </span>
                    {canEdit && <WatchRemove id={w.id} workspaceId={customer?.workspaceId ?? ""} name={w.artist_name} />}
                  </li>
                );
              })}
            </ul>
          )}
        </Sheet>

        <Needs family="catalog" title="Pour aller plus loin">
          <p>
            <b>Croissance YouTube des artistes suivis</b>{" "}(abonnés, vues sur 30 jours) : dès que la clé YouTube de Day 1 sera créée.
          </p>
          <p>
            <b>Streams, playlists et TikTok de n&apos;importe quel artiste</b>{" "}: uniquement avec un fournisseur de données sous licence (Soundcharts, Songstats, Chartmetric) — en discussion.
          </p>
        </Needs>
      </div>
    </div>
  );
}

/** « Suivre » en un clic depuis le radar (même action que le formulaire, sans notes). */
function FollowButton({ workspaceId, name }: { workspaceId: string; name: string }) {
  const [state, run, pending] = useActionState(addWatch, { status: "idle" } as RegisterFormState);
  return (
    <form action={run} className="text-right">
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <input type="hidden" name="artist_name" value={name} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>Suivre</Button>
      {state.status === "error" && <p className="text-destructive mt-1 text-xs" role="alert">{state.message}</p>}
    </form>
  );
}

function WatchRemove({ id, workspaceId, name }: { id: string; workspaceId: string; name: string }) {
  return (
    <DeleteRowWithWorkspace id={id} workspaceId={workspaceId} confirm={`Ne plus suivre ${name} ?`} />
  );
}

/** DeleteRow n'envoie que l'id ; la liste A&R a aussi besoin de l'espace (donnée de structure). */
function DeleteRowWithWorkspace({ id, workspaceId, confirm }: { id: string; workspaceId: string; confirm: string }) {
  const action = async (state: Parameters<typeof removeWatch>[0], form: FormData) => {
    form.set("workspace_id", workspaceId);
    return removeWatch(state, form);
  };
  return <DeleteRow action={action} id={id} confirm={confirm} />;
}
