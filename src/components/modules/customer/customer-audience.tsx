"use client";

/**
 * /audience en mode client — ce qui est MESURÉ sur l'audience de l'artiste ouvert :
 *  - où on l'écoute : pays de son relevé distributeur ;
 *  - qui pousse son son sur TikTok : vidéos COLLÉES par l'équipe (jamais cherchées
 *    par un robot), fiche officielle relue chaque nuit, vues recopiées à la main ;
 *  - ses chiffres TikTok for Artists, recopiés : réservés à cet espace.
 * Âge, sexe, villes, auditeurs : attendent l'export Spotify for Artists et YouTube.
 */
import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Button } from "@/components/ui/button";
import { addTikTokVideo, deleteTikTokStats, deleteTikTokVideo, saveTikTokStats, updateTikTokViews } from "@/app/(dashboard)/audience/actions";
import { useCustomer, useCustomerSignals } from "@/lib/customer-mode";
import { TIKTOK_PERIODS, statDelta, statPairs, type StatKey, type TikTokStat } from "@/lib/tiktok/forms";
import type { TikTokVideo } from "@/lib/tiktok/video";
import { countryRows } from "@/lib/userdata/statement-insights";
import { geography } from "@/lib/kpi/statement";
import { getUserData, subscribeUserData } from "@/lib/userdata/store";
import { DeleteRow, F, RegisterForm, TextIn, selectCls } from "./register-ui";
import { Needs, SourceLine, longDate } from "./signals-ui";
import { SimpleTable, statementLine, useFormats } from "./shared";

const byWeight = (a: TikTokVideo, b: TikTokVideo) => (b.views ?? -1) - (a.views ?? -1) || b.created_at.localeCompare(a.created_at);

export function CustomerAudience() {
  const f = useFormats();
  const customer = useCustomer();
  const signals = useCustomerSignals();
  const data = useSyncExternalStore(subscribeUserData, getUserData, () => null);
  const canEdit = customer?.role === "owner" || customer?.role === "member";
  const artistId = customer?.artistId ?? "";
  const [adding, setAdding] = useState<"video" | "stats" | null>(null);
  const [viewsFor, setViewsFor] = useState<string | null>(null);

  const videos = useMemo(() => (signals?.videos ?? []).filter((v) => v.artist_id === artistId).sort(byWeight), [signals?.videos, artistId]);
  const stats = useMemo(() => (signals?.stats ?? []).filter((s) => s.artist_id === artistId), [signals?.stats, artistId]);
  const pairs = useMemo(() => statPairs(stats), [stats]);
  const countries = useMemo(() => (data ? countryRows(data, 10) : []), [data]);
  const geo = useMemo(() => (data ? geography(data) : null), [data]);
  const rateOf = useMemo(() => new Map((geo?.rates ?? []).map((r) => [r.country, r])), [geo]);
  const totalStreams = data?.totalStreams ?? 0;
  const [now] = useState(() => Date.now()); // une fois au montage : miniatures expirées ou non

  const delta = (latest: TikTokStat, previous: TikTokStat | null, key: StatKey) => {
    const d = statDelta(latest, previous, key);
    return d === null || !previous ? undefined : `${d >= 0 ? "+" : "−"}${f.int(Math.abs(d))} depuis le ${longDate(previous.as_of, f.locale)}`;
  };
  const acc = pairs.account;

  return (
    <div className="rise-in">
      <PageHeader title="Audience" subtitle={`${customer?.artistName ?? ""} · ce qui est mesuré, source par source`} />
      <div className="space-y-3">
        {/* Où on t'écoute — relevé distributeur */}
        <Sheet family="audience">
          <SheetHeading action={data ? statementLine(data, f.month, f.locale) : undefined}>Où on t&apos;écoute</SheetHeading>
          {countries.length ? (
            <>
              <SimpleTable
                head={["Pays", "Streams", "Part", "Pour 1 000 streams", "Évolution du taux"]}
                rows={countries.map((c) => {
                  const r = rateOf.get(c.key);
                  return {
                    key: c.key,
                    cells: [
                      f.country(c.key),
                      f.int(c.streams),
                      totalStreams ? f.pct(c.streams / totalStreams) : "—",
                      r?.per1000 != null && c.streams >= 1000 ? f.eurCents(r.per1000) : "—",
                      r?.trend != null ? f.pct(r.trend, true) : "—",
                    ],
                  };
                })}
              />
              {geo && (
                <p className="sheet-ink mt-2 text-[11px]">
                  {f.pct(geo.outsideTopShare)} de tes écoutes hors de {f.country(geo.top)} · équivalent de {geo.equivalent.toLocaleString(f.locale, { maximumFractionDigits: 1 })}{" "}pays (1 ÷ Herfindahl des parts d&apos;écoute). Évolution du taux : dernier mois contre premier mois du détail par pays
                  {data?.countryMonthStreams === undefined ? " (réimporte ton relevé pour la voir)" : ""}.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm">
              {data ? "Ton relevé ne détaille pas les pays." : "Aucun relevé importé pour cet artiste."}{" "}
              <Link href="/import" className="underline">
                Importer un relevé
              </Link>
            </p>
          )}
        </Sheet>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ProvenanceBadge provenance="measured" /> Streams par pays du relevé de ton distributeur (mensuel).
        </p>

        {/* Qui pousse ton son sur TikTok — liens collés */}
        <Sheet family="trends">
          <SheetHeading action={canEdit && adding !== "video" ? <button type="button" className="underline" onClick={() => setAdding("video")}>Coller un lien</button> : undefined}>
            Qui pousse ton son sur TikTok
          </SheetHeading>
          {adding === "video" && (
            <div className="mb-4">
              <RegisterForm action={addTikTokVideo} onDone={() => setAdding(null)}>
                <input type="hidden" name="artist_id" value={artistId} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <F label="Lien de la vidéo TikTok" className="sm:col-span-3">
                    <TextIn name="video_url" required placeholder="https://www.tiktok.com/@pseudo/video/…" />
                  </F>
                  <F label="Vues (facultatif)"><TextIn name="views" inputMode="numeric" placeholder="ex. 1 250 000" /></F>
                  <F label="Vues relevées le"><TextIn type="date" name="views_on" /></F>
                  <F label="Notes"><TextIn name="notes" maxLength={2000} /></F>
                </div>
                <p className="text-muted-foreground text-xs">
                  Repère les vidéos sur la page du son dans TikTok, copie leur lien. Day 1 lit la fiche officielle de la vidéo (créateur, son) ; TikTok ne publie pas les vues : recopie-les.
                </p>
              </RegisterForm>
            </div>
          )}
          {videos.length === 0 ? (
            <p className="text-sm">{canEdit ? "Aucune vidéo pour l'instant. Colle le lien des vidéos qui utilisent ton son : Day 1 les suit et les classe par vues." : "Aucune vidéo partagée avec toi."}</p>
          ) : (
            <ul className="grid gap-3">
              {videos.map((v, i) => {
                const thumb = v.thumbnail_url && v.thumbnail_expires_at && new Date(v.thumbnail_expires_at).getTime() > now ? v.thumbnail_url : null;
                return (
                  <li key={v.id} className="flex gap-3 border-t border-current/10 pt-3 text-sm first:border-t-0 first:pt-0">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- miniature signée de TikTok, qui expire : pas d'optimisation Next
                      <img src={thumb} alt="" referrerPolicy="no-referrer" className="h-20 w-[45px] shrink-0 rounded object-cover" />
                    ) : (
                      <div className="bg-muted h-20 w-[45px] shrink-0 rounded" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p>
                        {i < 3 && v.views !== null ? <span className="sheet-ink mr-1 font-semibold">#{i + 1}</span> : null}
                        <a href={v.video_url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                          {v.author_name ?? v.author_handle ?? "Vidéo TikTok"}
                        </a>
                        {v.author_handle ? <span className="text-muted-foreground"> @{v.author_handle}</span> : null}
                      </p>
                      {v.title ? <p className="text-muted-foreground line-clamp-2 text-xs">{v.title}</p> : null}
                      <p className="text-xs">
                        {v.sound_title ? <>Son : {v.sound_url ? <a href={v.sound_url} target="_blank" rel="noreferrer" className="underline">{v.sound_title}</a> : v.sound_title} · </> : null}
                        {v.views !== null && v.views_on ? (
                          <span className="font-medium">
                            {f.int(v.views)} vues <span className="text-muted-foreground font-normal">au {longDate(v.views_on, f.locale)}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">vues à recopier</span>
                        )}
                      </p>
                      {v.status === "gone" ? (
                        <p className="text-destructive text-xs">Introuvable sur TikTok (supprimée ou privée) · vérifié le {longDate(v.checked_at.slice(0, 10), f.locale)}</p>
                      ) : null}
                      {viewsFor === v.id && (
                        <div className="mt-2">
                          <RegisterForm action={updateTikTokViews} onDone={() => setViewsFor(null)} id={v.id}>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <F label="Vues"><TextIn name="views" inputMode="numeric" defaultValue={v.views ?? ""} /></F>
                              <F label="Relevées le"><TextIn type="date" name="views_on" /></F>
                            </div>
                          </RegisterForm>
                        </div>
                      )}
                    </div>
                    {canEdit && viewsFor !== v.id && (
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => setViewsFor(v.id)}>Vues</Button>
                        <DeleteRow action={deleteTikTokVideo} id={v.id} confirm={`Retirer la vidéo de ${v.author_name ?? "ce créateur"} ?`} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Sheet>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <ProvenanceBadge provenance="declared" /> Liens et vues collés par ton équipe ; créateur et son lus sur la fiche officielle TikTok.
          <SourceLine source="tiktok_oembed" runs={signals?.runs ?? []} locale={f.locale} className="basis-full" />
        </div>

        {/* TikTok for Artists — saisi */}
        <Sheet family="audience">
          <SheetHeading action={canEdit && adding !== "stats" ? <button type="button" className="underline" onClick={() => setAdding("stats")}>Saisir un relevé</button> : undefined}>
            TikTok for Artists
          </SheetHeading>
          {adding === "stats" && (
            <div className="mb-4">
              <RegisterForm action={saveTikTokStats} onDone={() => setAdding(null)}>
                <input type="hidden" name="artist_id" value={artistId} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <F label="Date du relevé"><TextIn type="date" name="as_of" required /></F>
                  <F label="Période affichée">
                    <select name="period_days" defaultValue="28" className={selectCls}>
                      {TIKTOK_PERIODS.map((p) => (
                        <option key={p} value={p}>{p} derniers jours</option>
                      ))}
                    </select>
                  </F>
                  <F label="Titre (vide = tout le compte)"><TextIn name="track_title" maxLength={300} /></F>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <F label="Abonnés"><TextIn name="followers" inputMode="numeric" /></F>
                  <F label="Vues des vidéos"><TextIn name="video_views" inputMode="numeric" /></F>
                  <F label="Vues du profil"><TextIn name="profile_views" inputMode="numeric" /></F>
                  <F label="Titre : vidéos créées avec le son"><TextIn name="track_videos" inputMode="numeric" /></F>
                  <F label="Titre : vues"><TextIn name="track_views" inputMode="numeric" /></F>
                  <F label="J'aime (total)"><TextIn name="likes" inputMode="numeric" /></F>
                </div>
                <p className="text-muted-foreground text-xs">Recopie les chiffres affichés dans TikTok for Artists. Avec un titre, seuls les deux champs « Titre » comptent ; sans titre, ceux du compte.</p>
              </RegisterForm>
            </div>
          )}
          {!acc && pairs.tracks.length === 0 ? (
            <p className="text-sm">{canEdit ? "Rien de saisi. Recopie ici les chiffres de TikTok for Artists : Day 1 suit leur évolution d'un relevé à l'autre." : "Rien de partagé avec toi."}</p>
          ) : (
            <>
              {acc && (
                <>
                  <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{acc.latest.followers !== null ? f.int(acc.latest.followers) : "—"}</p>
                  <p className="sheet-ink mt-1.5 text-[13px]">
                    abonnés au {longDate(acc.latest.as_of, f.locale)}
                    {delta(acc.latest, acc.previous, "followers") ? ` · ${delta(acc.latest, acc.previous, "followers")}` : ""}
                  </p>
                  <AffiliatedPoints
                    points={[
                      { key: "views", value: acc.latest.video_views !== null ? f.int(acc.latest.video_views) : "—", label: `Vues des vidéos${acc.latest.period_days ? ` (${acc.latest.period_days} j)` : ""}`, note: delta(acc.latest, acc.previous, "video_views") },
                      { key: "profile", value: acc.latest.profile_views !== null ? f.int(acc.latest.profile_views) : "—", label: `Vues du profil${acc.latest.period_days ? ` (${acc.latest.period_days} j)` : ""}`, note: delta(acc.latest, acc.previous, "profile_views") },
                      { key: "likes", value: acc.latest.likes !== null ? f.int(acc.latest.likes) : "—", label: "J'aime", note: delta(acc.latest, acc.previous, "likes") },
                    ]}
                  />
                </>
              )}
              {pairs.tracks.length > 0 && (
                <div className="mt-4">
                  <SimpleTable
                    head={["Titre", "Vidéos créées avec le son", "Vues", "Relevé"]}
                    rows={pairs.tracks.map((t) => ({
                      key: t.latest.id,
                      cells: [
                        t.latest.track_title,
                        <span key="v">
                          {t.latest.track_videos !== null ? f.int(t.latest.track_videos) : "—"}
                          {delta(t.latest, t.previous, "track_videos") ? <small className="text-muted-foreground block">{delta(t.latest, t.previous, "track_videos")}</small> : null}
                        </span>,
                        t.latest.track_views !== null ? f.int(t.latest.track_views) : "—",
                        `${longDate(t.latest.as_of, f.locale)}${t.latest.period_days ? ` · ${t.latest.period_days} j` : ""}`,
                      ],
                    }))}
                  />
                </div>
              )}
              {canEdit && (
                <details className="mt-3 text-xs">
                  <summary className="text-muted-foreground cursor-pointer">Tous les relevés saisis ({stats.length})</summary>
                  <ul className="mt-2 grid gap-1.5">
                    {[...stats].sort((a, b) => b.as_of.localeCompare(a.as_of)).map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-2">
                        <span>
                          {longDate(s.as_of, f.locale)} · {s.track_title ? `« ${s.track_title} »` : "compte"}
                          {s.period_days ? ` · ${s.period_days} j` : ""}
                        </span>
                        <DeleteRow action={deleteTikTokStats} id={s.id} confirm="Supprimer ce relevé ?" />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </Sheet>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ProvenanceBadge provenance="declared" /> Recopié depuis TikTok for Artists par ton équipe. Réservé à ton espace : jamais comparé à d&apos;autres clients.
        </p>

        <Needs family="catalog" title="À brancher">
          <p>
            <b>Âge, sexe, villes, auditeurs mensuels, abonnés Spotify</b>{" "}: viendront de ton export Spotify for Artists (onglet Audience, fichier CSV).
          </p>
          <p>
            <b>Audience YouTube</b> : viendra de la connexion de ta chaîne YouTube. <b>TikTok automatique</b>{" "}: de la connexion de ton compte TikTok, après validation de Day 1 par TikTok.
          </p>
        </Needs>
      </div>
    </div>
  );
}
