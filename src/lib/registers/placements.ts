/**
 * Œuvres écrites ou produites pour d'autres interprètes (le métier
 * d'auteur-compositeur) : validation et bilan — dont les œuvres SORTIES mais
 * pas déclarées à la SACEM, l'argent qui ne sera pas versé sans déclaration.
 */
import { UUID, checked, date, fail, guard, percentOrNull, text } from "./common";

export const PLACEMENT_ROLES = ["auteur", "compositeur", "producteur"] as const;
export type PlacementRole = (typeof PLACEMENT_ROLES)[number];
export const PLACEMENT_STATUS = ["pitched", "signed", "released"] as const;
export type PlacementStatus = (typeof PLACEMENT_STATUS)[number];
export const PLACEMENT_STATUS_LABEL: Record<PlacementStatus, string> = { pitched: "proposée", signed: "signée, pas encore sortie", released: "sortie" };

export type PlacementInput = {
  artist_id: string;
  title: string;
  performer: string;
  roles: PlacementRole[];
  writer_share: number | null;
  producer_points: number | null;
  status: PlacementStatus;
  release_date: string | null;
  sacem_declared: boolean;
  notes: string | null;
};
export type Placement = PlacementInput & { id: string; updated_at: string };

export function parsePlacement(raw: Record<string, string | undefined>, roles: string[]) {
  return guard((): PlacementInput => {
    if (!UUID.test(raw.artist_id ?? "")) fail("Choisis l'auteur-compositeur concerné.");
    if (!PLACEMENT_STATUS.includes(raw.status as PlacementStatus)) fail("Choisis où en est l'œuvre.");
    const r = [...new Set(roles)].filter((x): x is PlacementRole => PLACEMENT_ROLES.includes(x as PlacementRole));
    if (!r.length) fail("Coche au moins un rôle (auteur, compositeur, producteur).");
    const status = raw.status as PlacementStatus;
    const release_date = date(raw.release_date);
    if (status === "released" && !release_date) fail("Indique la date de sortie.");
    return {
      artist_id: raw.artist_id!,
      title: text(raw.title, 300, "Indique le titre de l'œuvre.")!,
      performer: text(raw.performer, 160, "Indique l'interprète.")!,
      roles: r,
      writer_share: percentOrNull(raw.writer_share),
      producer_points: percentOrNull(raw.producer_points),
      status,
      release_date,
      sacem_declared: checked(raw.sacem_declared),
      notes: text(raw.notes, 2000),
    };
  });
}

export function summarizePlacements(list: Placement[]) {
  const by = (s: PlacementStatus) => list.filter((p) => p.status === s);
  const writing = list.filter((p) => p.writer_share !== null && (p.roles.includes("auteur") || p.roles.includes("compositeur")));
  return {
    released: by("released").length,
    signed: by("signed"),
    pitched: by("pitched").length,
    /** Sorties sans déclaration SACEM : pas de droits d'auteur versés tant que ce n'est pas fait. */
    undeclared: by("released").filter((p) => !p.sacem_declared && (p.roles.includes("auteur") || p.roles.includes("compositeur"))),
    avgWriterShare: writing.length ? writing.reduce((s, p) => s + (p.writer_share ?? 0), 0) / writing.length : null,
  };
}
