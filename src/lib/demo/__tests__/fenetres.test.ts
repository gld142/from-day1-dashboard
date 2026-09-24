/**
 * Une même question posée sur deux pages doit donner le même nombre.
 *
 * La reconstitution d'historique dépend de la longueur de fenêtre demandée :
 * sans découpe commune, /roster sommait des fenêtres de 30 jours pendant que
 * /pulse découpait une série de 365, et les deux pages annonçaient 158,6 M et
 * 158,4 M de streams pour le même roster.
 */
import { describe, expect, it } from "vitest";
import { ARTISTS, dailyTotals, labelTotals, sumStreams } from "../api";
import { yearWindow } from "@/lib/year-window";

describe("fenêtres de calcul", () => {
  it("sumStreams(30) égale la queue de la série de référence", () => {
    for (const a of ARTISTS) {
      const queue = dailyTotals(a.id, 365)
        .slice(-30)
        .reduce((s, d) => s + d.streams, 0);
      expect(sumStreams(a.id, 30), a.id).toBe(queue);
    }
  });

  it("le total du roster est le même quel que soit le chemin de calcul", () => {
    const parArtiste = ARTISTS.reduce((s, a) => s + sumStreams(a.id, 30), 0);
    const parSerie = ARTISTS.reduce(
      (s, a) =>
        s +
        dailyTotals(a.id, 365)
          .slice(-30)
          .reduce((x, d) => x + d.streams, 0),
      0,
    );
    expect(parArtiste).toBe(parSerie);
  });

  it("une fenêtre plus longue que la référence reste servie en entier", () => {
    for (const a of ARTISTS) {
      expect(sumStreams(a.id, 730), a.id).toBeGreaterThanOrEqual(sumStreams(a.id, 365));
    }
  });

  it("« revenus 12 mois » vaut la même chose sur /roster et dans la bande année", () => {
    // /roster lit labelTotals (→ pnlByArtist), /pulse lit yearWindow : deux
    // chemins, une seule fenêtre de douze mois complets.
    const roster = labelTotals().revenue12m;
    const annee = yearWindow(ARTISTS.map((a) => a.id)).revenue;
    expect(Math.abs(roster - annee)).toBeLessThan(1);
  });
});
