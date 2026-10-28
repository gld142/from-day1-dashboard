import { TRACKS } from "./data";
import { rngFor } from "./seed";
import type { Expense, ExpenseCategory } from "./types";

/**
 * Rattache les dépenses de démo au titre qu'elles poussent.
 *
 * Le générateur ne rattache une dépense à un projet que si une sortie tombe à
 * moins de 240 jours : la plupart des artistes n'en ont pas sur l'année en
 * cours, et 100 % de leur marketing finissait « hors sortie » — la vue éclatée
 * par titre était vide (mesuré le 28/10/2026 : ElGrandeToto, Louane, Zeg P…).
 * Or une campagne Meta, un pitch playlist ou des ads TikTok poussent presque
 * toujours une chanson précise.
 *
 * Étape À PART, avec son propre tirage (`<id de la dépense>:track`) : le
 * générateur consomme son RNG de façon séquentielle, y toucher déplacerait tous
 * les montants de la démo. Ici aucun montant, aucune date, aucune catégorie ne
 * bouge — seuls `trackId` / `projectId` se remplissent. Les totaux (P&L, net,
 * marge, Pulse) restent donc identiques à l'euro.
 */

/** Postes qui se dépensent pour un titre. */
const TRACK_LEVEL: ReadonlySet<ExpenseCategory> = new Set(["marketing"]);
/** Part qui reste au niveau de l'artiste (image, influence de marque). */
const STAYS_ARTIST_LEVEL = 0.2;
/** Une campagne peut démarrer avant la sortie (pré-sauvegardes, teasing). */
const PRE_RELEASE_DAYS = 42;
/** Un titre sorti dans les six derniers mois pèse plus dans les campagnes. */
const RECENT_DAYS = 180;
const RECENT_BOOST = 4;
const DAY = 86_400_000;

export function attachToTracks(artistId: string, items: Expense[]): Expense[] {
  const tracks = TRACKS.filter((t) => t.artistId === artistId);
  if (tracks.length === 0) return items;

  return items.map((e) => {
    if (e.trackId || !TRACK_LEVEL.has(e.category)) return e;
    const rand = rngFor(`${e.id}:track`);
    if (rand() < STAYS_ARTIST_LEVEL) return e;

    const at = new Date(e.date).getTime();
    const inProject = e.projectId ? tracks.filter((t) => t.projectId === e.projectId) : tracks;
    const released = inProject.filter(
      (t) => new Date(t.releaseDate).getTime() <= at + PRE_RELEASE_DAYS * DAY,
    );
    const pool = released.length ? released : inProject;
    if (pool.length === 0) return e;

    // Tirage pondéré : on pousse ce qui s'écoute, et d'abord ce qui vient de sortir.
    const weightOf = (t: (typeof pool)[number]) =>
      Math.max(t.weight, 0.001) *
      (at - new Date(t.releaseDate).getTime() <= RECENT_DAYS * DAY ? RECENT_BOOST : 1);
    const total = pool.reduce((s, t) => s + weightOf(t), 0);
    let r = rand() * total;
    const pick = pool.find((t) => (r -= weightOf(t)) <= 0) ?? pool[pool.length - 1];
    return { ...e, trackId: pick.id, projectId: pick.projectId };
  });
}
