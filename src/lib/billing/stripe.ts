import Stripe from "stripe";
import { appUrl } from "@/lib/app-url";
import { quoteFor, BASE_LAUNCH_EUR, BASE_PUBLIC_EUR, EXTRA_ARTIST_EUR } from "./pricing";

/**
 * Stripe côté serveur. Les prix sont retrouvés par leur « lookup key » et créés
 * s'ils n'existent pas encore : rien à saisir à la main dans le tableau de bord,
 * et le même code marchera en live le jour où on changera de clé.
 */
/** Cookie qui lie un paiement au navigateur qui l'a lancé (voir /inscription/succes). */
export const CHECKOUT_COOKIE = "d1_checkout";

let client: Stripe | undefined;

export function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquant dans .env.local");
  client = new Stripe(key);
  return client;
}

const PRICES = {
  baseLaunch: { lookup: "d1_pro_base_launch_eur_month", eur: BASE_LAUNCH_EUR, name: "Day 1 Pro — espace structure + 1er artiste (tarif de lancement)" },
  basePublic: { lookup: "d1_pro_base_public_eur_month", eur: BASE_PUBLIC_EUR, name: "Day 1 Pro — espace structure + 1er artiste" },
  extraArtist: { lookup: "d1_pro_extra_artist_eur_month", eur: EXTRA_ARTIST_EUR, name: "Day 1 Pro — artiste supplémentaire" },
} as const;
export type PriceKey = keyof typeof PRICES;

const cache = new Map<PriceKey, string>();

export async function priceId(key: PriceKey): Promise<string> {
  const hit = cache.get(key);
  if (hit) return hit;
  const def = PRICES[key];
  const found = await stripe().prices.list({ lookup_keys: [def.lookup], active: true, limit: 1 });
  let price =
    found.data[0] ??
    (await stripe().prices.create({
      currency: "eur",
      unit_amount: def.eur * 100,
      recurring: { interval: "month" },
      lookup_key: def.lookup,
      product_data: { name: def.name },
      tax_behavior: "exclusive",
    }));
  // Prix HT : la TVA éventuelle s'ajoute au montant. Un prix créé avant ce choix
  // (« unspecified ») se règle ici — Stripe ne l'accepte qu'une fois, puis c'est figé.
  if (price.tax_behavior !== "exclusive") {
    if (price.tax_behavior === "inclusive") {
      throw new Error(`Le prix Stripe ${def.lookup} est TTC (inclusive) : il doit être HT (exclusive).`);
    }
    price = await stripe().prices.update(price.id, { tax_behavior: "exclusive" });
  }
  cache.set(key, price.id);
  return price.id;
}

/** Lignes d'abonnement pour `artists` artistes : l'espace (1er artiste inclus) + les suivants. */
export async function lineItemsFor(artists: number, now = new Date()) {
  const quote = quoteFor(artists, now);
  if (quote.kind !== "price") return null;
  const items = [{ price: await priceId(quote.launch ? "baseLaunch" : "basePublic"), quantity: 1 }];
  if (quote.artists > 1) items.push({ price: await priceId("extraArtist"), quantity: quote.artists - 1 });
  return { quote, items };
}

/** Nombre d'artistes payés dans un abonnement : 1 (inclus) + la quantité « artiste supplémentaire ». */
export function paidArtists(sub: Stripe.Subscription): number {
  const extra = sub.items.data
    .filter((item) => item.price.lookup_key === PRICES.extraArtist.lookup)
    .reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  return 1 + extra;
}

/** Fin de la période en cours (portée par les lignes depuis les versions récentes de l'API). */
export function periodEnd(sub: Stripe.Subscription): string | null {
  const seconds = sub.items.data[0]?.current_period_end;
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

const PORTAL_TAG = "day1_pro";
let portalConfig: string | undefined;

/**
 * Configuration du portail client Stripe (carte, factures, résiliation), créée
 * au premier usage comme les prix — rien à régler à la main dans Stripe.
 * Résiliation EN FIN DE PÉRIODE : l'accès reste ouvert jusqu'à l'échéance
 * payée. Pas de changement de formule ici : le nombre d'artistes se gère dans
 * /espace (ajout / retrait).
 */
export async function portalConfigurationId(): Promise<string> {
  if (portalConfig) return portalConfig;
  const list = await stripe().billingPortal.configurations.list({ active: true, limit: 100 });
  const found = list.data.find((c) => c.metadata?.app === PORTAL_TAG);
  const config =
    found ??
    (await stripe().billingPortal.configurations.create({
      name: "Day 1 Pro",
      metadata: { app: PORTAL_TAG },
      default_return_url: appUrl("/espace/abonnement/retour"),
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        // Pas l'email : il doit rester celui de la connexion à Day 1 Pro.
        customer_update: { enabled: true, allowed_updates: ["name", "address", "tax_id"] },
        subscription_cancel: {
          enabled: true,
          mode: "at_period_end",
          proration_behavior: "none",
          cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "unused", "switched_service", "other"] },
        },
      },
    }));
  portalConfig = config.id;
  return config.id;
}
