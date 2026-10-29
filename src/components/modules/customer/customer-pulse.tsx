"use client";

/**
 * /pulse en mode client — « ce qui a bougé », uniquement sur des données réelles :
 * le roster dans les classements Apple Music du jour (et ce qui y entre), TikTok
 * (vidéos collées, chiffres TikTok for Artists saisis), le dernier relevé
 * distributeur, et l'état de CHAQUE source : relevée automatiquement, importée,
 * saisie, ou encore à brancher. Aucun « hier » inventé à partir d'un relevé mensuel.
 */
import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { APPLE_COUNTRY_LABEL, type AppleCountry } from "@/lib/collect/apple-music";
import { useCustomer, useCustomerSignals } from "@/lib/customer-mode";
import { chartMovements, rosterInCharts } from "@/lib/market/charts";
import { statDelta, statPairs } from "@/lib/tiktok/forms";
import { getUserData, subscribeUserData } from "@/lib/userdata/store";
import { SourceLine, longDate } from "./signals-ui";
import { setArtistWiki } from "@/app/(dashboard)/audience/actions";
import { WikiAttention } from "./attention-ui";
import { FORMAT_LABEL, useFormats } from "./shared";

const sumDsp = (o: Record<string, number | undefined> | undefined) => Object.values(o ?? {}).reduce<number>((t, v) => t + (v ?? 0), 0);

export function CustomerPulse() {
  const f = useFormats();
  const customer = useCustomer();
  const signals = useCustomerSignals();
  const data = useSyncExternalStore(subscribeUserData, getUserData, () => null);
  const charts = signals?.charts ?? null;
  const artistId = customer?.artistId ?? "";

  const chartView = useMemo(() => {
    if (!charts?.latestDate) return null;
    const roster = rosterInCharts(charts.latest, signals?.artists ?? []);
    // Entrées du jour : titres du roster absents du classement de la veille (même pays).
    const newIds = new Set<string>();
    if (charts.previous.length) {
      for (const c of new Set(charts.latest.map((r) => r.country))) {
        const moves = chartMovements(
          charts.latest.filter((r) => r.country === c),
          charts.previous.filter((r) => r.country === c),
        );
        for (const [id, m] of moves) if (m.kind === "new") newIds.add(`${c}:${id}`);
      }
    }
    return roster.map((a) => {
      const best = a.entries[0];
      const fresh = a.entries.filter((e) => newIds.has(`${e.country}:${e.item_id}`));
      // Un même titre classé dans 3 pays = 1 titre, 3 places.
      return { ...a, best, fresh, titles: new Set(a.entries.map((e) => e.item_id)).size, countries: new Set(a.entries.map((e) => e.country)).size };
    });
  }, [charts, signals?.artists]);

  const tiktok = useMemo(() => {
    const videos = (signals?.videos ?? []).filter((v) => v.artist_id === artistId);
    const pairs = statPairs((signals?.stats ?? []).filter((s) => s.artist_id === artistId));
    const top = [...videos].filter((v) => v.views !== null).sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0] ?? null;
    return { videos, pairs, top, gone: videos.filter((v) => v.status === "gone").length };
  }, [signals?.videos, signals?.stats, artistId]);

  const statement = useMemo(() => {
    if (!data) return null;
    const months = [...data.months].sort();
    const last = months[months.length - 1];
    const prev = months[months.length - 2];
    return {
      last,
      prev,
      streams: sumDsp(data.streamsByMonth[last]),
      prevStreams: prev ? sumDsp(data.streamsByMonth[prev]) : null,
      revenue: data.revenueByMonth[last] ?? 0,
    };
  }, [data]);

  const acc = tiktok.pairs.account;
  const followersDelta = acc ? statDelta(acc.latest, acc.previous, "followers") : null;
  const lastStat = acc?.latest.as_of ?? tiktok.pairs.tracks.map((t) => t.latest.as_of).sort().pop() ?? null;
  const runs = signals?.runs ?? [];

  return (
    <div className="rise-in">
      <PageHeader title="Pulse" subtitle={`Ce qui a bougé · ${customer?.workspaceName ?? ""}`} />
      <div className="space-y-3">
        <Sheet family="trends">
          <SheetHeading action={<Link href="/market" className="underline">tous les classements →</Link>}>
            Classements Apple Music {charts?.latestDate ? `· ${longDate(charts.latestDate, f.locale)}` : ""}
          </SheetHeading>
          {!chartView ? (
            <p className="text-sm">Pas encore de classement relevé : la collecte tourne chaque nuit.</p>
          ) : chartView.length === 0 ? (
            <p className="text-sm">Aucun artiste de ton roster dans les 100 titres les plus écoutés sur Apple Music aujourd&apos;hui (10 pays suivis).</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {chartView.map((a) => (
                <li key={a.artistId}>
                  <span className="font-medium">{a.artistName}</span> · {a.titles} titre{a.titles > 1 ? "s" : ""} classé{a.titles > 1 ? "s" : ""}, {a.entries.length} place{a.entries.length > 1 ? "s" : ""} dans {a.countries} pays · meilleure place n° {a.best.position} ({APPLE_COUNTRY_LABEL[a.best.country as AppleCountry] ?? a.best.country}, « {a.best.title} »)
                  {charts?.previousDate ? (
                    a.fresh.length ? (
                      <span className="block text-xs text-emerald-600 dark:text-emerald-400">
                        {a.fresh.length} entrée{a.fresh.length > 1 ? "s" : ""} depuis le {longDate(charts.previousDate, f.locale)} : {[...new Set(a.fresh.map((e) => e.title))].slice(0, 4).join(", ")}
                      </span>
                    ) : null
                  ) : (
                    <span className="text-muted-foreground block text-xs">Entrées et sorties visibles dès le 2e jour de collecte.</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Sheet>

        <Sheet family="audience">
          <SheetHeading action={<Link href="/audience" className="underline">audience →</Link>}>TikTok · {customer?.artistName ?? ""}</SheetHeading>
          {!acc && tiktok.videos.length === 0 ? (
            <p className="text-sm">Rien de suivi pour l&apos;instant : colle les vidéos qui utilisent ton son et recopie tes chiffres TikTok for Artists dans Audience.</p>
          ) : (
            <>
              <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{acc?.latest.followers != null ? f.int(acc.latest.followers) : "—"}</p>
              <p className="sheet-ink mt-1.5 text-[13px]">
                {acc?.latest.followers != null ? `abonnés au ${longDate(acc.latest.as_of, f.locale)}` : "abonnés : à recopier depuis TikTok for Artists"}
                {followersDelta !== null && acc?.previous ? ` · ${followersDelta >= 0 ? "+" : "−"}${f.int(Math.abs(followersDelta))} depuis le ${longDate(acc.previous.as_of, f.locale)}` : ""}
              </p>
              <AffiliatedPoints
                points={[
                  { key: "videos", value: String(tiktok.videos.length), label: "Vidéos suivies", note: tiktok.gone ? `${tiktok.gone} introuvable${tiktok.gone > 1 ? "s" : ""}` : undefined },
                  { key: "top", value: tiktok.top?.views != null ? f.int(tiktok.top.views) : "—", label: "Vues de la plus vue", note: tiktok.top ? (tiktok.top.author_name ?? tiktok.top.author_handle ?? undefined) : undefined },
                  { key: "last", value: lastStat ? longDate(lastStat, f.locale) : "—", label: "Dernier relevé TikTok for Artists" },
                ]}
              />
            </>
          )}
        </Sheet>

        <WikiAttention
          name={customer?.artistName ?? "cet artiste"}
          link={signals?.wiki?.links.find((l) => l.artist_id === artistId)}
          wiki={signals?.wiki}
          canEdit={false}
          hidden={{ artist_id: artistId }}
          action={setArtistWiki}
        />

        <Sheet family="money">
          <SheetHeading action={<Link href="/mon-releve" className="underline">mon relevé →</Link>}>Dernier relevé distributeur</SheetHeading>
          {statement ? (
            <>
              <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{f.int(statement.streams)}</p>
              <p className="sheet-ink mt-1.5 text-[13px]">
                streams en {f.monthLong(statement.last)}
                {statement.prevStreams ? ` · ${f.pct(statement.streams / statement.prevStreams - 1, true)} sur ${f.monthLong(statement.prev)}` : ""}
              </p>
              <AffiliatedPoints
                points={[
                  { key: "rev", value: f.eur(statement.revenue), label: `Revenus de ${f.monthLong(statement.last)}` },
                  { key: "src", value: FORMAT_LABEL[data!.format] ?? data!.format, label: "Distributeur" },
                  { key: "imp", value: new Date(data!.importedAt).toLocaleDateString(f.locale), label: "Importé le" },
                ]}
              />
            </>
          ) : (
            <p className="text-sm">
              Aucun relevé importé pour {customer?.artistName ?? "cet artiste"}.{" "}
              <Link href="/import" className="underline">Importer un relevé</Link>
            </p>
          )}
        </Sheet>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ProvenanceBadge provenance="measured" /> Classements relevés, relevé importé ; TikTok recopié par ton équipe.
        </p>

        <Sheet family="catalog">
          <SheetHeading>Tes sources</SheetHeading>
          <ul className="grid gap-2 text-sm">
            <li>
              <b>Classements Apple Music</b>{" "}: automatique, chaque nuit
              <SourceLine source="apple_music" runs={runs} locale={f.locale} />
            </li>
            <li>
              <b>Vidéos TikTok collées</b>{" "}: fiches relues chaque nuit
              <SourceLine source="tiktok_oembed" runs={runs} locale={f.locale} />
            </li>
            <li>
              <b>Relevé distributeur</b> :{" "}
              {data ? `importé le ${new Date(data.importedAt).toLocaleDateString(f.locale)} (${FORMAT_LABEL[data.format] ?? data.format})` : <span className="text-muted-foreground">à importer</span>}
            </li>
            <li>
              <b>TikTok for Artists</b> : {lastStat ? `dernier relevé saisi le ${longDate(lastStat, f.locale)}` : <span className="text-muted-foreground">rien de saisi</span>}
            </li>
            <li>
              <b>Wikipédia (vues de la page)</b> : automatique, chaque nuit
              <SourceLine source="wikipedia" runs={runs} locale={f.locale} />
            </li>
            <li className="text-muted-foreground">
              <b className="text-foreground">Spotify for Artists</b> : à brancher (export CSV) · <b className="text-foreground">YouTube</b>{" "}: à brancher (connexion de la chaîne)
            </li>
          </ul>
        </Sheet>
      </div>
    </div>
  );
}
