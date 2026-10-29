"use client";

/**
 * Parcours d'achat Day 1 Pro (local, 27/09/2026).
 * 1 profil → 2 identité (la lead naît ici) → 3 structure → 4 besoins → 5 offre → 6 paiement.
 * Chaque étape franchie complète la lead côté serveur : si la personne s'arrête,
 * on garde ses réponses pour la rappeler. Le paiement est SIMULÉ tant que Stripe
 * n'est pas branché.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quoteFor, eurHT as eur, EXTRA_ARTIST_EUR, BASE_PUBLIC_EUR, QUOTE_ABOVE } from "@/lib/billing/pricing";
import { isSiret, isEmail, type Lead } from "@/lib/onboarding/lead";
import { cn } from "@/lib/utils";

const PROFILE_OPTIONS: { id: NonNullable<Lead["profile"]>; label: string; hint: string }[] = [
  { id: "artist", label: "Je suis artiste", hint: "Je suis mes propres chiffres, avec mon équipe" },
  { id: "management", label: "Management", hint: "Je gère un ou plusieurs artistes" },
  { id: "label", label: "Label", hint: "Je signe et je développe des artistes" },
  { id: "publisher", label: "Éditeur", hint: "Je gère des droits d'auteur" },
  { id: "distributor", label: "Distributeur", hint: "Je distribue des catalogues" },
  { id: "other", label: "Autre", hint: "Avocat, comptable, agence…" },
];
const TEAM_OPTIONS: { id: NonNullable<Lead["teamSize"]>; label: string }[] = [
  { id: "solo", label: "Seul·e" },
  { id: "2-5", label: "2 à 5" },
  { id: "6-20", label: "6 à 20" },
  { id: "21-50", label: "21 à 50" },
  { id: "50+", label: "Plus de 50" },
];
const ROLE_OPTIONS: { id: NonNullable<Lead["roles"]>[number]; label: string }[] = [
  { id: "artist", label: "Artiste" },
  { id: "manager", label: "Manager" },
  { id: "ar", label: "A&R" },
  { id: "label-head", label: "Direction label" },
  { id: "accountant", label: "Comptable" },
  { id: "lawyer", label: "Juriste / avocat" },
  { id: "other", label: "Autre" },
];
const NEED_OPTIONS: { id: NonNullable<Lead["needs"]>[number]; label: string; hint: string }[] = [
  { id: "streams", label: "Streams", hint: "Toutes plateformes, mois par mois" },
  { id: "revenue", label: "Revenus", hint: "Ce que ça rapporte vraiment" },
  { id: "rights", label: "Droits", hint: "SACEM, ADAMI, SPEDIDAM" },
  { id: "audit", label: "Audit royalties", hint: "Les écarts à vérifier" },
  { id: "splits", label: "Splits", hint: "Qui touche quoi, en euros" },
  { id: "roster", label: "Roster", hint: "Tous les artistes côte à côte" },
  { id: "contracts", label: "Contrats", hint: "Échéances, préavis, avances" },
];

const STEP_TITLES = ["Profil", "Toi", "Structure", "Besoins", "Offre", "Paiement"] as const;

type Draft = Partial<Lead> & { id?: string };
const STORAGE = "d1-purchase-draft";

function loadDraft(): { draft: Draft; step: number } | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) ?? "null") as { draft: Draft; step: number } | null;
    return saved?.draft ? saved : null;
  } catch {
    return null;
  }
}

async function saveLead(patch: Draft): Promise<string | undefined> {
  const res = await fetch("/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(String(res.status));
  return ((await res.json()) as { id: string }).id;
}

export function PurchaseFlow() {
  // Reprise : un brouillon interrompu revient au rechargement (dans ce navigateur).
  // Rendu client seulement (voir page.tsx) : localStorage est lisible dès le premier rendu.
  const [saved] = useState(loadDraft);
  const [step, setStep] = useState(saved ? Math.min(saved.step, 4) : 0);
  const [draft, setDraft] = useState<Draft>(saved?.draft ?? { artistCount: 1, roles: [], needs: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteSent, setQuoteSent] = useState(false);
  // Retour de Stripe sans paiement (annulé) ou paiement non vérifiable.
  const [notice] = useState(() => {
    const p = new URLSearchParams(window.location.search).get("paiement");
    return p === "annule" ? "Paiement annulé : rien n'a été débité. Tu peux reprendre quand tu veux." : p ? "Le paiement n'a pas pu être vérifié. Réessaie, rien n'a été débité deux fois." : null;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ draft, step }));
    } catch {}
  }, [draft, step]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const toggle = (k: "roles" | "needs", v: string) =>
    setDraft((d) => {
      const cur = (d[k] ?? []) as string[];
      return { ...d, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });

  const isArtist = draft.profile === "artist";
  const quote = useMemo(() => quoteFor(draft.artistCount ?? 1), [draft.artistCount]);

  const valid = [
    !!draft.profile,
    !!draft.firstName && !!draft.lastName && !!draft.email && isEmail(draft.email) && !!draft.consent,
    (isArtist || !!draft.company) && !!draft.teamSize && (draft.artistCount ?? 0) >= 1 && (!draft.siret?.trim() || isSiret(draft.siret)),
    (draft.needs?.length ?? 0) > 0,
    true,
    true,
  ][step];

  // Étapes serveur : ce que la lead devient quand on quitte l'étape `step`. Seul un paiement
  // confirmé par Stripe la passera à « paid » (côté serveur, jamais depuis le navigateur).
  const STAGE_AFTER = ["identity", "structure", "needs", "offer", "checkout", "checkout"] as const;

  async function next() {
    setError(null);
    let leadId = draft.id;
    if (step >= 1) {
      setSaving(true);
      try {
        leadId = await saveLead({ ...draft, stage: STAGE_AFTER[step] });
        if (leadId && leadId !== draft.id) set("id", leadId);
      } catch {
        setError("Impossible d'enregistrer pour l'instant. Réessaie dans un instant.");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    // Au-delà de 15 artistes : pas de paiement en ligne, on rappelle avec un devis.
    if (step === 4 && quote.kind === "quote") {
      setQuoteSent(true);
      try {
        localStorage.removeItem(STORAGE);
      } catch {}
      return;
    }
    if (step === 5) {
      // Le serveur recalcule le montant depuis la lead, puis on part sur la page sécurisée de Stripe.
      setSaving(true);
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ leadId }),
        });
        if (!res.ok) throw new Error(String(res.status));
        window.location.assign(((await res.json()) as { url: string }).url);
      } catch {
        setError("Le paiement n'a pas pu démarrer. Réessaie dans un instant : rien n'a été débité.");
        setSaving(false);
      }
      return;
    }
    setStep((s) => s + 1);
  }

  if (quoteSent) return <Done draft={draft} />;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 md:py-16">
      <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">Day 1 Pro</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Ouvre ton espace</h1>
      {notice && <p className="mt-4 rounded-lg border bg-card px-4 py-3 text-sm">{notice}</p>}

      <ol className="mt-6 flex gap-1.5" aria-label="Étapes">
        {STEP_TITLES.map((t, i) => (
          <li key={t} className="flex-1">
            <div className={cn("h-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
            <span className={cn("mt-1.5 hidden text-[11px] sm:block", i === step ? "text-foreground" : "text-muted-foreground")}>
              {t}
            </span>
          </li>
        ))}
      </ol>

      <section className="mt-8 rounded-xl border bg-card p-5 shadow-sm md:p-7">
        {step === 0 && (
          <Step title="Tu es…" hint="Pour adapter ton espace. Le prix est le même pour tous.">
            <div className="grid gap-2 sm:grid-cols-2">
              {PROFILE_OPTIONS.map((o) => (
                <Choice key={o.id} active={draft.profile === o.id} onClick={() => set("profile", o.id)} label={o.label} hint={o.hint} />
              ))}
            </div>
          </Step>
        )}

        {step === 1 && (
          <Step title="Faisons connaissance" hint="On te recontacte si tu as une question. Jamais de spam.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="firstName" label="Prénom" value={draft.firstName} onChange={(v) => set("firstName", v)} autoComplete="given-name" />
              <Field id="lastName" label="Nom" value={draft.lastName} onChange={(v) => set("lastName", v)} autoComplete="family-name" />
              <Field id="email" label="Email" type="email" value={draft.email} onChange={(v) => set("email", v)} autoComplete="email"
                invalid={!!draft.email && !isEmail(draft.email)} />
              <Field id="phone" label="Téléphone (optionnel)" type="tel" value={draft.phone} onChange={(v) => set("phone", v)} autoComplete="tel" />
            </div>
            <label className="mt-5 flex items-start gap-2.5 text-sm text-muted-foreground">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={!!draft.consent}
                onChange={(e) => set("consent", e.target.checked)} />
              J&apos;accepte que Day 1 conserve ces informations pour me recontacter au sujet de Day 1 Pro.
            </label>
          </Step>
        )}

        {step === 2 && (
          <Step title={isArtist ? "Ton équipe" : "Ta structure"} hint="Combien d'artistes veux-tu suivre ?">
            <div className="grid gap-4">
              {!isArtist && (
                <Field id="company" label="Nom de la structure" value={draft.company} onChange={(v) => set("company", v)} autoComplete="organization" />
              )}
              <div>
                <Field id="siret" label="SIRET (facultatif, entreprise française)" value={draft.siret} onChange={(v) => set("siret", v)}
                  invalid={!!draft.siret?.trim() && !isSiret(draft.siret)} />
                <p className={cn("mt-1 text-xs", draft.siret?.trim() && !isSiret(draft.siret) ? "text-destructive" : "text-muted-foreground")}>
                  {draft.siret?.trim() && !isSiret(draft.siret)
                    ? "Ce SIRET n'est pas valide : vérifie les 14 chiffres."
                    : "Il figurera sur tes factures. La raison sociale et l'adresse sont demandées au paiement."}
                </p>
              </div>
              <div>
                <Label className="mb-2 block">Taille de l&apos;équipe</Label>
                <div className="flex flex-wrap gap-2">
                  {TEAM_OPTIONS.map((o) => (
                    <Pill key={o.id} active={draft.teamSize === o.id} onClick={() => set("teamSize", o.id)}>{o.label}</Pill>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="artistCount" className="mb-2 block">Nombre d&apos;artistes à suivre</Label>
                <Input id="artistCount" type="number" min={1} max={500} className="w-28"
                  value={draft.artistCount ?? 1} onChange={(e) => set("artistCount", Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <div>
                <Label className="mb-2 block">Qui utilisera l&apos;espace ?</Label>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map((o) => (
                    <Pill key={o.id} active={!!draft.roles?.includes(o.id)} onClick={() => toggle("roles", o.id)}>{o.label}</Pill>
                  ))}
                </div>
              </div>
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step title="Ce qui compte pour toi" hint="Plusieurs choix possibles.">
            <div className="grid gap-2 sm:grid-cols-2">
              {NEED_OPTIONS.map((o) => (
                <Choice key={o.id} active={!!draft.needs?.includes(o.id)} onClick={() => toggle("needs", o.id)} label={o.label} hint={o.hint} />
              ))}
            </div>
          </Step>
        )}

        {step === 4 && (
          <Step title="Ton offre" hint="Toute l'équipe de chaque artiste est incluse, sans surcoût.">
            {quote.kind === "quote" ? (
              <p className="text-sm">
                Au-delà de {QUOTE_ABOVE} artistes, on construit l&apos;offre avec toi. Continue : on te rappelle sous 24 h avec un devis.
              </p>
            ) : (
              <div className="grid gap-3 text-sm">
                <Line label="Espace structure + 1er artiste" value={eur(quote.base)} />
                {quote.artists > 1 && (
                  <Line label={`${quote.artists - 1} artiste${quote.artists > 2 ? "s" : ""} de plus × ${eur(EXTRA_ARTIST_EUR)}`} value={eur(quote.extras)} />
                )}
                <div className="my-1 border-t" />
                <Line strong label="Par mois" value={eur(quote.monthly)} />
                <p className="text-xs text-muted-foreground">Prix hors taxes. Si la TVA s&apos;applique, elle s&apos;ajoute au paiement.</p>
                {quote.launch && (
                  <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                    Tarif de lancement jusqu&apos;au 31 janvier 2027. Ensuite, l&apos;espace passe à {eur(BASE_PUBLIC_EUR)} par mois.
                  </p>
                )}
              </div>
            )}
          </Step>
        )}

        {step === 5 && (
          <Step title="Paiement" hint="Sans engagement, résiliable à tout moment.">
            <p className="text-sm text-muted-foreground">
              Tu vas passer sur la page de paiement sécurisée de Stripe.
              {quote.kind === "price" && <> Montant : <span className="text-foreground">{eur(quote.monthly)} par mois</span>.</>}
              {" "}Ton espace s&apos;ouvre dès le paiement validé.
            </p>
          </Step>
        )}

        {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button variant="ghost" size="lg" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || saving}>
            <ArrowLeft /> Retour
          </Button>
          <Button size="lg" onClick={next} disabled={!valid || saving}>
            {step === 5 ? (quote.kind === "price" ? `Payer ${eur(quote.monthly)} / mois` : "Continuer") : step === 4 && quote.kind === "quote" ? "Demander mon devis" : "Continuer"}
            <ArrowRight />
          </Button>
        </div>
      </section>
    </div>
  );
}

function Step({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Choice({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("rounded-lg border p-3 text-left transition-colors hover:bg-muted/60",
        active && "border-primary bg-primary/5 ring-1 ring-primary")}>
      <span className="flex items-center justify-between text-sm font-medium">
        {label}
        {active && <Check className="size-4 text-primary" />}
      </span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-muted/60",
        active && "border-primary bg-primary/5 text-primary")}>
      {children}
    </button>
  );
}

function Field({ id, label, value, onChange, type = "text", autoComplete, invalid }: {
  id: string; label: string; value?: string; onChange: (v: string) => void; type?: string; autoComplete?: string; invalid?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-2 block">{label}</Label>
      <Input id={id} type={type} value={value ?? ""} autoComplete={autoComplete} aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", strong && "text-base font-semibold")}>
      <span className={cn(!strong && "text-muted-foreground")}>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}

function Done({ draft }: { draft: Draft }) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Check />
      </div>
      <h1 className="mt-5 text-2xl font-semibold">Merci, {draft.firstName}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Demande de devis envoyée. On te rappelle sous 24 h pour construire l&apos;offre avec toi.
      </p>
    </div>
  );
}
