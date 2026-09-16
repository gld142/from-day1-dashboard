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

const DSP_LABEL: Record<DSP, string> = {
  spotify: "Spotify",
  deezer: "Deezer",
  apple: "Apple Music",
  amazon: "Amazon Music",
  youtube: "YouTube",
  tiktok: "TikTok",
  other: "Autres DSP",
};

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
        id: `${artistId}-gap-${e.dsp}-${e.period}`,
        artistId,
        source: `${DSP_LABEL[e.dsp]} · écart estimé/déclaré`,
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
