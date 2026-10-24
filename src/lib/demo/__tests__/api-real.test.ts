import { afterEach, describe, expect, it } from "vitest";
import {
  ARTISTS,
  auditFindings,
  countryBreakdown,
  dailyEstimates,
  dspEstimates,
  estimateSummaries,
  estimateSummary,
  expensesFor,
  hasReal,
  listenersProvenance,
  provenanceByDsp,
  provenanceOfToday,
  revenueSeries,
  rosterDspEstimates,
  rosterEstimateSummary,
  rosterListenersProvenance,
  rosterTodayProvenance,
  streamSeries,
  sumStreams,
  todayProvenance,
  topTracks,
} from "@/lib/demo/api";
import { ALL_ARTISTS } from "@/lib/demo/data";
import { hasKworbDailyRate, latestSnapshot, playcountRate, realStreamSeries } from "@/lib/real";
import { SNAPSHOTS } from "@/lib/real/snapshots";
import { clearShares, saveShares } from "@/lib/userdata/shares-store";
import { USER_ARTIST_ID, clearCustomerData, setCustomerDataSilently, userArtist, userMonthlyListeners, type UserData } from "@/lib/userdata/store";

/* La façade ne dépend pas de la maison pour servir la série réelle : roster COMPLET, pour qu'un
   exclu ne sorte pas de la couverture en silence. Seuls les artistes qui ont un relevé : un
   arrivant n'en a pas avant son premier passage du script (la façade retombe alors sur les
   générateurs, `hasReal` = false). */
const REAL_IDS = ALL_ARTISTS.map((a) => a.id).filter((id) => hasReal(id));

describe("api.ts sur les artistes réels", () => {
  it("la liste des artistes réels n'est pas vide — un it.each([]) n'enregistrerait aucun test", () => {
    expect(REAL_IDS.length).toBeGreaterThan(0);
  });

  it.each(REAL_IDS)("%s : la façade sert la série réelle", (id) => {
    expect(hasReal(id)).toBe(true);
    expect(JSON.stringify(streamSeries(id, 7))).toBe(JSON.stringify(realStreamSeries(id, 7)));
    const today = streamSeries(id, 1).find((p) => p.dsp === "spotify")!;
    expect(today.provenance).toBeDefined();
    /* Ce que ce test veut prouver : le chiffre servi vient du relevé Kworb,
       pas du générateur. Un seuil fixe ne le prouve pas — il ne faisait que
       trier les gros artistes des petits, et November Ultra (47 230
       streams/jour, mesurés) l'a mis en échec en entrant au roster.
       On compare donc au relevé lui-même. */
    const kworb = latestSnapshot(id).kworb;
    /* Kworb peut lister un artiste sans lui calculer de débit (Dakeez le 24/10/2026 :
       dailyStreams 0) : il n'y a alors rien à comparer, la couche réelle reconstitue
       depuis les auditeurs (voir hasKworbDailyRate). */
    if (hasKworbDailyRate(kworb)) {
      expect(today.streams).toBeGreaterThan(0);
      /* Règle documentée (real-source.ts) : pour un titre public, le delta de play count
         Spotify entre les deux derniers relevés, moyenné sur les rafraîchissements qu'il
         couvre, PRIME sur le daily Kworb ; les autres titres gardent leur daily Kworb.
         Aujourd'hui peut donc dépasser `dailyStreams` d'exactement Σ max(0, delta/jours −
         daily Kworb) sur les titres publics — MESURÉ au relevé du 24/10/2026, 29 jours
         après celui du 25/09 : nono-la-grinta 951 961 pour un daily Kworb de 938 810
         (+13 151 : TERRAIN et J'tavais dit ont streamé plus en moyenne sur le mois
         qu'aujourd'hui), elgrandetoto 1 290 596 pour 1 289 141 (+1 455). */
      const snaps = SNAPSHOTS[id];
      const prev = snaps.length >= 2 ? snaps[snaps.length - 2] : null;
      const last = snaps[snaps.length - 1];
      const byName = new Map(kworb.tracks.map((t) => [t.name, t.daily]));
      let excess = 0;
      for (const t of last.spotify.topTracks) {
        const rate = prev ? playcountRate(prev, last, t.name) : null;
        const daily = byName.get(t.name);
        if (rate && daily !== undefined && daily !== null) excess += Math.max(0, rate.perDay - daily);
      }
      expect(today.streams).toBeLessThanOrEqual(kworb.dailyStreams + excess);
      expect(today.streams / kworb.dailyStreams).toBeGreaterThan(0.5);
    }
  });

  it("dadju : le streaming des revenus mensuels vient de l'estimateur", () => {
    const rev = revenueSeries("dadju", 24).filter((p) => p.source === "streaming");
    const est = dailyEstimates("dadju", 730);
    const lastMonth = rev[rev.length - 1];
    const fromEstimator = est.filter((d) => d.date.startsWith(lastMonth.month)).reduce((s, d) => s + d.grossMaster.mid, 0);
    expect(lastMonth.amount).toBe(Math.round(fromEstimator));
    expect(lastMonth.amount).toBeGreaterThan(100_000);
  });

  it("estimateSummary : jour ≤ semaine ≤ mois ≤ année, en fourchette, part artiste < brut", () => {
    const d = estimateSummary("dadju", "day");
    const w = estimateSummary("dadju", "week");
    const m = estimateSummary("dadju", "month");
    const y = estimateSummary("dadju", "year");
    expect(d.grossMaster.mid).toBeLessThan(w.grossMaster.mid);
    expect(w.grossMaster.mid).toBeLessThan(m.grossMaster.mid);
    expect(m.grossMaster.mid).toBeLessThan(y.grossMaster.mid);
    expect(d.grossMaster.low).toBeLessThan(d.grossMaster.high);
    expect(d.artistShare.mid).toBeLessThan(d.grossMaster.mid);
    expect(d.calibrated).toBe(false);
    // 90 jours : entre le mois et l'année, sur exactement 90 jours.
    const q = estimateSummary("dadju", "quarter");
    expect(q.grossMaster.mid).toBeGreaterThan(m.grossMaster.mid);
    expect(q.grossMaster.mid).toBeLessThan(y.grossMaster.mid);
    expect(q.period).toBe("quarter");
    expect(dailyEstimates("dadju", 365).slice(-90)[0].date).toBe(q.from);
  });

  it("estimateSummaries sert les cinq périodes, identiques aux résumés unitaires", () => {
    const all = estimateSummaries("dadju");
    expect(Object.keys(all).sort()).toEqual(["day", "month", "quarter", "week", "year"]);
    expect(all.quarter.grossMaster.mid).toBe(estimateSummary("dadju", "quarter").grossMaster.mid);
  });

  it("dspEstimates : la somme des plateformes retombe sur le brut master de la période", () => {
    for (const period of ["day", "week", "month", "quarter", "year"] as const) {
      const rows = dspEstimates("dadju", period);
      expect(rows.length).toBeGreaterThan(0);
      const sum = rows.reduce((s, r) => s + r.gross, 0);
      expect(sum).toBeCloseTo(estimateSummary("dadju", period).grossMaster.mid, 6);
      // Trié par brut décroissant, taux effectif cohérent.
      for (let i = 1; i < rows.length; i++) expect(rows[i - 1].gross).toBeGreaterThanOrEqual(rows[i].gross);
      for (const r of rows) if (r.streams > 0) expect(r.rate).toBeCloseTo(r.gross / r.streams, 12);
    }
  });

  it("rosterDspEstimates : somme des artistes réels, égale au résumé roster", () => {
    const rows = rosterDspEstimates("week");
    const sum = rows.reduce((s, r) => s + r.gross, 0);
    expect(sum).toBeCloseTo(rosterEstimateSummary("week").grossMaster.mid, 6);
    const spotify = rows.find((r) => r.dsp === "spotify")!;
    const perArtist = ARTISTS.reduce(
      (s, a) => s + (dspEstimates(a.id, "week").find((r) => r.dsp === "spotify")?.streams ?? 0),
      0,
    );
    expect(spotify.streams).toBe(perArtist);
  });

  it("rosterEstimateSummary agrège les trois artistes", () => {
    const r = rosterEstimateSummary("month");
    const sum = ARTISTS.reduce((s, a) => s + estimateSummary(a.id, "month").grossMaster.mid, 0);
    expect(r.grossMaster.mid).toBeCloseTo(sum, 6);
    expect(r.streams).toBeGreaterThan(0);
  });

  it("parts renseignées : le memo des résumés s'invalide, la cascade suit le pourcentage, le roster reste « simulé » tant qu'un artiste ne l'est pas", () => {
    const before = estimateSummary("dadju", "day");
    expect(before.sharesProvenance).toBe("simulated");
    expect(before.artistShare.mid).toBeCloseTo(before.grossMaster.mid * 0.2, 6);
    try {
      saveShares({ artistId: "dadju", masterSharePct: 18, isAuthor: true, authorSharePct: 50, contractFileName: null });
      const after = estimateSummary("dadju", "day");
      expect(after.sharesProvenance).toBe("declared");
      expect(after.publishingProvenance).toBe("declared");
      expect(after.artistShare.mid).toBeCloseTo(after.grossMaster.mid * 0.18, 6);
      expect(after.publishing.mid).toBeCloseTo(after.grossMaster.mid * (15 / 55) * 0.5, 6); // GESAC : 15 pour 55 au master
      // Les autres artistes n'ont rien renseigné : le roster reste simulé.
      expect(rosterEstimateSummary("day").sharesProvenance).toBe("simulated");
    } finally {
      clearShares("dadju");
    }
    expect(estimateSummary("dadju", "day").sharesProvenance).toBe("simulated");
  });

  it("auditFindings des artistes réels : au moins un écart attribué à un DSP, aucun au label", () => {
    const f = auditFindings("dadju");
    expect(f.length).toBeGreaterThan(0);
    expect(f.some((x) => x.source.includes("Spotify"))).toBe(true);
    expect(f.every((x) => !/label|distrib/i.test(x.source))).toBe(true);
  });

  it("topTracks de Dadju commence par un titre relevé", () => {
    const t = topTracks("dadju", 30, 3);
    const names = latestSnapshot("dadju").kworb!.tracks.map((x) => x.name);
    expect(names).toContain(t[0].title);
  });

  /* Pulse affichait « mesuré » en dur sur le chiffre du jour : faux pour un Kworb sans débit,
     reconstitué depuis les auditeurs (real-source.ts depuis 92c2932). Mesuré le 24/10/2026. */
  it("provenanceOfToday : celle du point Spotify du jour, « simulated » sans provenance", () => {
    expect(provenanceOfToday([{ date: "2026-10-24", dsp: "spotify", streams: 10, provenance: "measured" }])).toBe("measured");
    expect(provenanceOfToday([{ date: "2026-10-24", dsp: "spotify", streams: 10, provenance: "reconstructed" }])).toBe("reconstructed");
    expect(provenanceOfToday([{ date: "2026-10-24", dsp: "deezer", streams: 10, provenance: "measured" }])).toBe("simulated");
    expect(provenanceOfToday([{ date: "2026-10-24", dsp: "spotify", streams: 10 }])).toBe("simulated");
    expect(provenanceOfToday([])).toBe("simulated");
  });
  it("provenanceOfToday : sur plusieurs jours, c'est le point Spotify le PLUS RÉCENT qui compte, quel que soit l'ordre", () => {
    /* Mesuré le 24/10/2026 : `find` prenait le PREMIER point Spotify de la liste — « measured » ici. */
    const asc = [
      { date: "2026-01-01", dsp: "spotify", streams: 10, provenance: "measured" },
      { date: "2026-10-24", dsp: "spotify", streams: 10, provenance: "reconstructed" },
    ] as const;
    expect(provenanceOfToday([...asc])).toBe("reconstructed");
    expect(provenanceOfToday([...asc].reverse())).toBe("reconstructed");
    expect(provenanceOfToday([asc[1], { date: "2026-10-24", dsp: "deezer", streams: 3, provenance: "measured" }])).toBe("reconstructed");
  });
  it("todayProvenance : Leto (Kworb avec débit) mesuré, Dakeez (Kworb sans débit) reconstitué ; auditeurs mesurés pour les deux", () => {
    expect(todayProvenance("leto")).toBe("measured");
    expect(todayProvenance("dakeez")).toBe("reconstructed");
    expect(listenersProvenance("leto")).toBe("measured");
    expect(listenersProvenance("dakeez")).toBe("measured");
    expect(listenersProvenance("artiste-inconnu")).toBe("simulated");
  });

  /* Le profil importé : ses TOTAUX mensuels viennent du relevé importé, mais ce que Pulse montre
     n'est pas le relevé tel quel (mesuré le 24/10/2026) : le chiffre du jour est le total
     mensuel lissé par un coefficient hebdomadaire → « reconstitué » ; les auditeurs mensuels
     valent `round(streams du dernier mois / 2,6)` → « estimé », et 1 000 de secours quand le
     dernier mois ne porte aucun stream → « simulé ». Avant : « mesuré » en dur sur les deux
     (régression inverse mesurée le même jour : depuis 7f3bacc, « simulé » partout). */
  describe("provenance du profil importé", () => {
    const IMPORT: UserData = {
      version: 1,
      artistName: "Mon Projet",
      importedAt: "2026-10-24T00:00:00Z",
      format: "generic",
      eurRate: 1,
      sourceCurrency: "EUR",
      months: ["2026-08", "2026-09"],
      streamsByMonth: { "2026-08": { spotify: 12_000 }, "2026-09": { spotify: 15_000 } },
      revenueByMonth: { "2026-08": 40, "2026-09": 50 },
      trackStreams: {},
      countryStreams: {},
      totalStreams: 27_000,
      totalRevenueEur: 90,
      active: true,
    };
    afterEach(() => clearCustomerData());
    it("import actif : le jour est reconstitué (mensuel lissé), les auditeurs estimés (streams / 2,6)", () => {
      setCustomerDataSilently(IMPORT);
      expect(todayProvenance(USER_ARTIST_ID)).toBe("reconstructed");
      expect(listenersProvenance(USER_ARTIST_ID)).toBe("estimated");
    });
    it("dernier mois sans stream : les auditeurs valent la valeur de secours (1 000) — simulés", () => {
      setCustomerDataSilently({
        ...IMPORT,
        months: ["2026-08", "2026-09"],
        streamsByMonth: { "2026-08": { spotify: 12_000 }, "2026-09": {} },
      });
      expect(listenersProvenance(USER_ARTIST_ID)).toBe("simulated");
      expect(todayProvenance(USER_ARTIST_ID)).toBe("reconstructed");
    });
    it("le seuil est celui du store : round(streams / 2,6) = 0 → secours (simulé), 1 → estimé", () => {
      /* 1 stream : round(1 / 2,6) = 0 → `|| 1000` dans store.ts → simulé. 2 streams : round(0,77) = 1 → estimé.
         Avant (relecture du 24/10/2026) : `streams > 0` disait « estimé » pour 1 stream alors que Pulse
         affichait la valeur de secours. */
      setCustomerDataSilently({ ...IMPORT, streamsByMonth: { "2026-08": { spotify: 12_000 }, "2026-09": { spotify: 1 } } });
      expect(listenersProvenance(USER_ARTIST_ID)).toBe("simulated");
      setCustomerDataSilently({ ...IMPORT, streamsByMonth: { "2026-08": { spotify: 12_000 }, "2026-09": { spotify: 2 } } });
      expect(listenersProvenance(USER_ARTIST_ID)).toBe("estimated");
    });
    it("source unique : userMonthlyListeners() = les auditeurs de la fiche, et son drapeau = la provenance", () => {
      for (const streams of [0, 1, 2, 12_000]) {
        setCustomerDataSilently({ ...IMPORT, streamsByMonth: { "2026-08": { spotify: 12_000 }, "2026-09": { spotify: streams } } });
        const { value, derivedFromStreams } = userMonthlyListeners();
        expect(value).toBe(userArtist()!.monthlyListeners);
        expect(listenersProvenance(USER_ARTIST_ID)).toBe(derivedFromStreams ? "estimated" : "simulated");
      }
      setCustomerDataSilently({ ...IMPORT, streamsByMonth: { "2026-08": { spotify: 1 }, "2026-09": { spotify: 26_000 } } });
      expect(userMonthlyListeners()).toEqual({ value: 10_000, derivedFromStreams: true });
    });
    it("sans import actif, « my-project » n'est personne : simulé", () => {
      expect(todayProvenance(USER_ARTIST_ID)).toBe("simulated");
      expect(listenersProvenance(USER_ARTIST_ID)).toBe("simulated");
    });
  });

  /* Pulse en vue structure : le total du jour du roster portait « mesuré » en dur. Le badge
     de la somme est la provenance la plus FAIBLE de ses parties — un DA dont tous les
     artistes sont mesurés voit « Mesuré », le roster entier (avec Dakeez) « Reconstitué ». */
  describe("provenance d'un agrégat roster : la plus faible des parties", () => {
    const measured = ALL_ARTISTS.filter((a) => todayProvenance(a.id) === "measured");
    it("un roster d'artistes tous mesurés est mesuré", () => {
      expect(measured.length).toBeGreaterThan(0);
      expect(rosterTodayProvenance(measured)).toBe("measured");
    });
    it("un roster qui contient Dakeez est reconstitué", () => {
      const dakeez = ALL_ARTISTS.find((a) => a.id === "dakeez")!;
      expect(rosterTodayProvenance([...measured, dakeez])).toBe("reconstructed");
      expect(rosterTodayProvenance(ARTISTS)).toBe("reconstructed");
    });
    it("un roster vide est simulé (rien de mesuré)", () => {
      expect(rosterTodayProvenance([])).toBe("simulated");
    });
    it("auditeurs : mesurés sur le roster entier (chaque artiste a un relevé), simulés dès qu'un artiste n'en a pas", () => {
      expect(rosterListenersProvenance(ARTISTS)).toBe("measured");
      expect(rosterListenersProvenance([...ARTISTS, { ...ARTISTS[0], id: "artiste-inconnu" }])).toBe("simulated");
    });
  });

  it("countryBreakdown et provenanceByDsp répondent", () => {
    expect(countryBreakdown("dadju", 30).length).toBeGreaterThan(0);
    expect(provenanceByDsp("dadju", 30).spotify).toBeDefined();
    expect(sumStreams("dakeez", 30)).toBeGreaterThan(0);
  });

  it("les dépenses sont dimensionnées à la taille réelle de l'artiste", () => {
    const dakeez = expensesFor("dakeez", 12).reduce((s, e) => s + e.amount, 0);
    const dadju = expensesFor("dadju", 12).reduce((s, e) => s + e.amount, 0);
    // Dakeez (~150 k auditeurs, émergent) contre Dadju (~6,5 M, établi) : le rapport de taille
    // (sizeFactor, generators.ts) est d'au moins 1 à 5. Seuil MESURÉ au premier passage : si le
    // test échoue, lire les deux montants qu'il affiche et poser le rapport observé, arrondi vers le bas.
    expect(dakeez).toBeLessThan(80_000);
    expect(dadju).toBeGreaterThan(dakeez * 5);
  });
});
