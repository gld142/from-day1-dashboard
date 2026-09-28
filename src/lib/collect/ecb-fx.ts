/**
 * Taux de change de référence de la BCE, moyenne mensuelle (flux EXR, API officielle,
 * sans clé). Réutilisation autorisée à condition de citer la BCE, de dire qu'on
 * transforme la donnée (on l'inverse : euros pour 1 dollar) et que l'information
 * est gratuite sur le site de la BCE (ecb.europa.eu/services/disclaimer, lu le 29/09/2026).
 */
import { fetchWithRetry } from "./fetch";
import type { Collector } from "./run";

export const FX_CURRENCIES = ["USD", "GBP"] as const;
export type FxCurrency = (typeof FX_CURRENCIES)[number];
export type FxRow = { currency: FxCurrency; month: string; units_per_eur: number };

export const ecbUrl = (currency: FxCurrency) =>
  `https://data-api.ecb.europa.eu/service/data/EXR/M.${currency}.EUR.SP00.A?startPeriod=2015-01&format=csvdata`;

/** Euros pour 1 unité de la devise (la BCE publie l'inverse : unités pour 1 euro). */
export const eurPerUnit = (unitsPerEur: number) => 1 / unitsPerEur;

export function parseEcbCsv(csv: string, currency: FxCurrency): FxRow[] {
  const lines = csv.trim().split(/\r?\n/);
  const head = lines[0]?.split(",") ?? [];
  const cur = head.indexOf("CURRENCY");
  const t = head.indexOf("TIME_PERIOD");
  const v = head.indexOf("OBS_VALUE");
  if (cur < 0 || t < 0 || v < 0) throw new Error("BCE : format de réponse inattendu");
  const rows: FxRow[] = [];
  for (const line of lines.slice(1)) {
    // Les colonnes lues sont avant tout champ entre guillemets (titres) : un découpage simple suffit.
    const cells = line.split(",");
    if (cells[cur] !== currency) throw new Error(`BCE : devise « ${cells[cur]} » reçue au lieu de « ${currency} »`);
    const value = Number(cells[v]);
    if (/^\d{4}-\d{2}$/.test(cells[t]) && Number.isFinite(value) && value > 0) rows.push({ currency, month: cells[t], units_per_eur: value });
  }
  if (!rows.length) throw new Error("BCE : aucun taux dans la réponse");
  return rows;
}

export function ecbFxCollector(deps: { fetchCsv?: (c: FxCurrency) => Promise<string>; save: (rows: FxRow[]) => Promise<void> }): Collector {
  const fetchCsv = deps.fetchCsv ?? (async (c: FxCurrency) => (await fetchWithRetry(ecbUrl(c))).text());
  return {
    source: "ecb_fx",
    run: async () => {
      const results = await Promise.allSettled(
        FX_CURRENCIES.map(async (c) => {
          const rows = parseEcbCsv(await fetchCsv(c), c);
          await deps.save(rows);
          return rows.length;
        }),
      );
      const failed = results.flatMap((r, i) => (r.status === "rejected" ? [`${FX_CURRENCIES[i]} : ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`] : []));
      const rows = results.reduce((n, r) => n + (r.status === "fulfilled" ? r.value : 0), 0);
      if (failed.length === FX_CURRENCIES.length) throw new Error(`BCE : aucune devise relevée — ${failed.join(" ; ")}`);
      return failed.length ? { rows, partial: true, detail: failed.join(" ; ") } : { rows };
    },
  };
}
