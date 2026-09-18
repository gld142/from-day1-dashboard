/* Généré par scripts/snapshot.mjs — ne pas éditer à la main. */
import type { MarketSnapshot, Snapshot } from "../types";
import dadju_2026_09_15 from "./dadju/2026-09-15.json";
import dadju_2026_09_16 from "./dadju/2026-09-16.json";
import dadju_2026_09_17 from "./dadju/2026-09-17.json";
import dadju_2026_09_18 from "./dadju/2026-09-18.json";
import kiko_2026_09_15 from "./kiko/2026-09-15.json";
import kiko_2026_09_16 from "./kiko/2026-09-16.json";
import kiko_2026_09_17 from "./kiko/2026-09-17.json";
import kiko_2026_09_18 from "./kiko/2026-09-18.json";
import nono_la_grinta_2026_09_15 from "./nono-la-grinta/2026-09-15.json";
import nono_la_grinta_2026_09_16 from "./nono-la-grinta/2026-09-16.json";
import nono_la_grinta_2026_09_17 from "./nono-la-grinta/2026-09-17.json";
import nono_la_grinta_2026_09_18 from "./nono-la-grinta/2026-09-18.json";
import market_2026_09_17 from "./market/2026-09-17.json";
import market_2026_09_18 from "./market/2026-09-18.json";

/** Relevés par artiste, triés par date croissante. */
export const SNAPSHOTS: Record<string, Snapshot[]> = {
  "dadju": [dadju_2026_09_15, dadju_2026_09_16, dadju_2026_09_17, dadju_2026_09_18] as Snapshot[],
  "kiko": [kiko_2026_09_15, kiko_2026_09_16, kiko_2026_09_17, kiko_2026_09_18] as Snapshot[],
  "nono-la-grinta": [nono_la_grinta_2026_09_15, nono_la_grinta_2026_09_16, nono_la_grinta_2026_09_17, nono_la_grinta_2026_09_18] as Snapshot[],
};

export const LATEST_DATE = "2026-09-18";

/** Relevés du Top 200 Spotify France, par date de relevé. */
export const MARKET: Record<string, MarketSnapshot> = {
  "2026-09-17": market_2026_09_17 as MarketSnapshot,
  "2026-09-18": market_2026_09_18 as MarketSnapshot,
};

/** Dates des relevés marché, croissantes. */
export const MARKET_DATES: string[] = ["2026-09-17", "2026-09-18"];
