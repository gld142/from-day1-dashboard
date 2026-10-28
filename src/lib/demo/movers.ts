/**
 * « Qui bouge » : qui monte, qui décroche, qui ne bouge pas, sur 30 jours contre les 30 d'avant.
 *
 * Trié par streams gagnés ou perdus, pas par pourcentage : +2,6 % sur 61 M de streams, c'est
 * environ 1,5 M d'écoutes de plus ; +2,1 % sur 800 k, environ 17 k. Classés au pourcentage,
 * les deux se suivaient. Le pourcentage reste affiché à côté. Sous le seuil (±1 % par défaut),
 * un artiste est « stable » : en dessous, c'est le bruit d'un mois sur l'autre, pas un signal.
 */
export type MoverRow = { id: string; streams30d: number; delta30d: number };

export type Mover<T extends MoverRow> = T & {
  /** Streams gagnés (ou perdus, négatif) contre les 30 jours précédents. */
  gain: number;
};

export function splitMovers<T extends MoverRow>(rows: T[], threshold = 1, limit = 3) {
  const withGain: Mover<T>[] = rows.map((r) => {
    const factor = 1 + r.delta30d / 100;
    return { ...r, gain: factor > 0 ? r.streams30d - r.streams30d / factor : 0 };
  });
  const up = withGain.filter((r) => r.delta30d >= threshold).sort((a, b) => b.gain - a.gain);
  const down = withGain.filter((r) => r.delta30d <= -threshold).sort((a, b) => a.gain - b.gain);
  return {
    up: up.slice(0, limit),
    down: down.slice(0, limit),
    upCount: up.length,
    downCount: down.length,
    stableCount: withGain.length - up.length - down.length,
  };
}
