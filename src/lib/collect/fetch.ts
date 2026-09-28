/**
 * Appel HTTP des collecteurs, avec réessais. Mesuré le 28/09/2026 : le flux
 * Apple Music répond 502/504 ou ne répond pas sur environ un appel sur trois,
 * puis 200 au suivant. Un 4xx (hors 429) n'est PAS réessayé : c'est une réponse
 * (ex. oEmbed TikTok : 400 = vidéo introuvable), pas une panne.
 */
export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

export type RetryOptions = {
  tries?: number;
  timeoutMs?: number;
  /** Attente avant le 2e essai ; puis ×2, ×3… */
  backoffMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

/** Qui appelle, dit franchement (pas de faux navigateur). */
export const COLLECT_UA = "Day1-collect/1.0 (+https://from-day1.com)";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchWithRetry(url: string, opts: RetryOptions = {}): Promise<Response> {
  const { tries = 4, timeoutMs = 15_000, backoffMs = 2_000, fetchImpl = fetch, sleep = wait } = opts;
  let last = "";
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": COLLECT_UA }, cache: "no-store" });
      if (res.ok) return res;
      last = `HTTP ${res.status}`;
      if (res.status >= 400 && res.status < 500 && res.status !== 429) throw new FetchError(`${url} : ${last}`, res.status);
    } catch (e) {
      if (e instanceof FetchError) throw e;
      last = e instanceof Error && e.name === "TimeoutError" ? `délai dépassé (${timeoutMs} ms)` : e instanceof Error ? e.message : String(e);
    }
    if (attempt < tries) await sleep(backoffMs * attempt);
  }
  throw new FetchError(`${url} : échec après ${tries} essais (${last})`);
}
