/**
 * Écart d'audit estimé / déclaré (spec §5.4).
 * Compare l'estimation € par période/DSP au relevé déclaré ; au-delà des deux
 * seuils (relatif et absolu), produit un signalement — TOUJOURS attribué au
 * DSP, jamais au distributeur ni au label (contrainte commerciale).
 */
import type { AuditFinding, DSP } from "@/lib/demo/types";
import { rngFor } from "@/lib/demo/seed";
import { AUDIT_GAP_ABS_EUR, AUDIT_GAP_REL } from "./params";

export type EstimatedLine = { period: string; dsp: DSP; mid: number };
export type ReportedLine = { period: string; dsp: DSP; amount: number };

/**
 * Nom de la plateforme mise en cause — et rien d'autre.
 *
 * Le `source` d'un signalement est affiché tel quel (carte /audit, tuile du
 * plus gros écart, en-tête de la lettre) : toute phrase ajoutée ici se fige
 * dans une langue. Le qualificatif « écart estimé/déclaré » que portait ce
 * champ restait donc en français au milieu d'une interface anglaise — et il
 * était de toute façon redondant, la carte affichant déjà attendu, déclaré et
 * écart. Ne restent que des noms commerciaux, identiques dans les deux
 * langues ; le panier agrégé emprunte le même registre neutre.
 */
const DSP_LABEL: Record<DSP, string> = {
  spotify: "Spotify",
  deezer: "Deezer",
  apple: "Apple Music",
  amazon: "Amazon Music",
  youtube: "YouTube",
  tiktok: "TikTok",
  other: "Multi-DSP",
};

/**
 * Marqueur porté par l'identifiant des écarts DSP.
 *
 * Il a fallu un vrai bug pour en arriver là : /welcome triait les signalements
 * sur `source.includes("écart")`, ce qui marchait tant que `source` valait
 * « Spotify · écart estimé/déclaré ». Le jour où ce libellé est devenu
 * traduisible, `source` est passé à « Spotify » et l'écran d'acquisition a
 * affiché 0 € — la première phrase que lit un prospect. Reconnaître une nature
 * de donnée à la typographie de son libellé ne tient jamais ; elle vit
 * désormais dans l'identifiant, que rien ne traduit.
 */
const DSP_GAP_MARKER = "gap";

/** Vrai si ce signalement oppose l'estimation à ce qu'une plateforme a déclaré. */
export function isDspGap(finding: { id: string }): boolean {
  return finding.id.includes(`-${DSP_GAP_MARKER}-`);
}

export function auditGap(
  artistId: string,
  estimated: EstimatedLine[],
  reported: ReportedLine[],
): AuditFinding[] {
  const reportedByKey = new Map<string, ReportedLine>();
  for (const r of reported) {
    reportedByKey.set(`${r.period}:${r.dsp}`, r);
  }

  const candidates: Array<{ finding: Omit<AuditFinding, "status">; gap: number }> = [];

  for (const e of estimated) {
    const r = reportedByKey.get(`${e.period}:${e.dsp}`);
    if (!r) continue;
    const gap = e.mid - r.amount;
    if (gap < AUDIT_GAP_ABS_EUR) continue;
    if (gap / Math.max(1, e.mid) < AUDIT_GAP_REL) continue;

    candidates.push({
      gap,
      finding: {
        id: `${artistId}-${DSP_GAP_MARKER}-${e.dsp}-${e.period}`,
        artistId,
        source: DSP_LABEL[e.dsp],
        period: e.period,
        expected: Math.round(e.mid),
        reported: Math.round(r.amount),
        confidence: Math.min(0.92, 0.6 + gap / e.mid),
      },
    });
  }

  candidates.sort((a, b) => b.gap - a.gap);

  return candidates.map((c, i) => ({
    ...c.finding,
    status: i === 0 ? "letter-generated" : "open",
  }));
}

/**
 * Relevé simulé et déterministe pour les artistes sans relevé réel
 * (Dadju, Nono) : proche de l'estimé partout, sauf Spotify sur la
 * période la plus récente (sous-payé de 18 %).
 */
export function simulatedStatement(artistId: string, estimated: EstimatedLine[]): ReportedLine[] {
  const rand = rngFor(`${artistId}:statement`);
  const last = estimated.reduce(
    (m, e) => (e.period > m ? e.period : m),
    estimated[0]?.period ?? "",
  );

  return estimated.map((e) => {
    const underpaid = e.dsp === "spotify" && e.period === last;
    const factor = underpaid ? 0.82 : 0.96 + rand() * 0.07;
    return { period: e.period, dsp: e.dsp, amount: Math.round(e.mid * factor) };
  });
}
