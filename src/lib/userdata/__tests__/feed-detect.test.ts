import { describe, expect, it } from "vitest";
import { ARTISTS } from "@/lib/demo/data";
import { auditFindings, streamsDelta } from "@/lib/demo/api";
import { detectSignals } from "@/lib/userdata/feed-detect";

const TODAY = "2026-10-24";
const ids = ARTISTS.map((a) => a.id);

describe("Day One a repéré : des signaux tirés des données, jamais inventés", () => {
  const signals = detectSignals(ids, TODAY, 50);

  it("chaque signal d'audit = la somme exacte des écarts ouverts de l'artiste, adressé à Finance", () => {
    for (const s of signals.filter((x) => x.kind === "audit")) {
      const gap = auditFindings(s.artistId)
        .filter((f) => f.status !== "resolved" && f.expected > f.reported)
        .reduce((t, f) => t + (f.expected - f.reported), 0);
      expect(s.amount).toBe(Math.round(gap));
      expect(s.to).toEqual(["finance"]);
    }
  });

  it("chaque chute de streams est réelle (≤ −5 % sur 30 j) et va au DA", () => {
    for (const s of signals.filter((x) => x.kind === "streams")) {
      expect(streamsDelta(s.artistId, 30)).toBeLessThanOrEqual(-5);
      expect(s.to).toEqual(["da"]);
    }
  });

  it("une échéance de contrat tombe dans les 60 jours, jamais dans le passé", () => {
    for (const s of signals.filter((x) => x.kind === "contract")) {
      const days = (Date.parse(`${s.dueDate}T00:00:00Z`) - Date.parse(`${TODAY}T00:00:00Z`)) / 86_400_000;
      expect(days).toBeGreaterThanOrEqual(0);
      expect(days).toBeLessThanOrEqual(60);
    }
  });

  it("identifiants stables, urgents d'abord, limite respectée", () => {
    expect(new Set(signals.map((s) => s.id)).size).toBe(signals.length);
    expect(detectSignals(ids, TODAY, 3).length).toBeLessThanOrEqual(3);
    const ranks = signals.map((s) => ({ urgent: 0, important: 1, info: 2 })[s.urgency]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });
});
