/**
 * Licences de synchronisation saisies par le client : validation et bilan.
 * Les licences PAYÉES (date d'encaissement) entrent dans le résultat
 * (/finances) ; le reste est un pipeline, dit comme tel.
 */
import { UUID, date, fail, guard, money, round2, text, yearBefore } from "./common";

export const SYNC_MEDIA = ["pub", "film", "serie", "jeu", "tv", "web", "autre"] as const;
export type SyncMedia = (typeof SYNC_MEDIA)[number];
export const SYNC_MEDIA_LABEL: Record<SyncMedia, string> = { pub: "Publicité", film: "Film", serie: "Série", jeu: "Jeu vidéo", tv: "Télévision", web: "Web", autre: "Autre" };
export const SYNC_STATUS = ["proposed", "negotiating", "signed", "paid", "lost"] as const;
export type SyncStatus = (typeof SYNC_STATUS)[number];
export const SYNC_STATUS_LABEL: Record<SyncStatus, string> = { proposed: "proposée", negotiating: "en négociation", signed: "signée", paid: "payée", lost: "perdue" };

export type SyncInput = {
  artist_id: string;
  track_title: string;
  project: string;
  media: SyncMedia;
  client: string | null;
  territory: string | null;
  term: string | null;
  fee_master_eur: number | null;
  fee_publishing_eur: number | null;
  status: SyncStatus;
  signed_on: string | null;
  paid_on: string | null;
  notes: string | null;
};
export type SyncLicense = SyncInput & { id: string; updated_at: string };

export function parseSync(raw: Record<string, string | undefined>, today: string) {
  return guard((): SyncInput => {
    if (!UUID.test(raw.artist_id ?? "")) fail("Choisis l'artiste concerné.");
    if (!SYNC_MEDIA.includes(raw.media as SyncMedia)) fail("Choisis le type de média.");
    if (!SYNC_STATUS.includes(raw.status as SyncStatus)) fail("Choisis où en est la licence.");
    const status = raw.status as SyncStatus;
    const paid_on = date(raw.paid_on);
    if (status === "paid" && !paid_on) fail("Indique la date d'encaissement.");
    if (paid_on && paid_on > today) fail("La date d'encaissement est dans le futur.");
    return {
      artist_id: raw.artist_id!,
      track_title: text(raw.track_title, 300, "Indique le titre concerné.")!,
      project: text(raw.project, 200, "Indique le projet (marque, film, série…).")!,
      media: raw.media as SyncMedia,
      client: text(raw.client, 160),
      territory: text(raw.territory, 120),
      term: text(raw.term, 120),
      fee_master_eur: money(raw.fee_master_eur),
      fee_publishing_eur: money(raw.fee_publishing_eur),
      status,
      signed_on: date(raw.signed_on),
      paid_on: status === "paid" ? paid_on : null,
      notes: text(raw.notes, 2000),
    };
  });
}

export const feeOf = (l: SyncLicense) => round2((l.fee_master_eur ?? 0) + (l.fee_publishing_eur ?? 0));

export function summarizeSync(list: SyncLicense[], today: string) {
  const since = yearBefore(today);
  const sum = (xs: SyncLicense[]) => round2(xs.reduce((s, l) => s + feeOf(l), 0));
  return {
    paid12: sum(list.filter((l) => l.status === "paid" && l.paid_on && l.paid_on > since && l.paid_on <= today)),
    signedUnpaid: sum(list.filter((l) => l.status === "signed")),
    pipeline: sum(list.filter((l) => l.status === "proposed" || l.status === "negotiating")),
    open: list.filter((l) => l.status === "proposed" || l.status === "negotiating" || l.status === "signed").length,
  };
}
