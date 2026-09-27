import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { quoteFor } from "@/lib/billing/pricing";
import { userDb } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { AddArtistForm, ClearPurchaseDraft, InviteForm } from "./forms";

export const metadata: Metadata = { title: "Day 1 Pro — Mon espace", robots: { index: false } };

const ROLE_LABEL: Record<string, string> = { owner: "Propriétaire", member: "Équipe", artist: "Artiste" };
const STATUS_LABEL: Record<string, string> = {
  active: "Actif", trialing: "Essai", past_due: "Paiement en retard", canceled: "Résilié", incomplete: "En attente de paiement", unpaid: "Impayé",
};
const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`;

/** Tout est lu avec la session de la personne : la RLS ne lui montre que ce qui la regarde. */
export default async function EspacePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const db = await userDb();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) redirect("/connexion");
  const welcome = !!(await searchParams).bienvenue;

  const { data: memberships } = await db
    .from("workspace_members")
    .select("workspace_id, role, artist_id")
    .eq("user_id", auth.user.id)
    .order("created_at");
  const me = memberships?.[0];
  if (!me) {
    return (
      <Shell email={auth.user.email ?? ""}>
        <p className="text-sm text-muted-foreground">Aucun espace n&apos;est rattaché à ce compte.</p>
        <Link href="/inscription" className="mt-4 inline-block text-sm text-primary underline">Ouvrir un espace Day 1 Pro</Link>
      </Shell>
    );
  }

  const [{ data: ws }, { data: artists }, { data: team }, { data: invites }] = await Promise.all([
    db.from("workspaces").select("id, name, subscription_status, artist_quantity, current_period_end").eq("id", me.workspace_id).single(),
    db.from("artists").select("id, name").eq("workspace_id", me.workspace_id).order("created_at"),
    db.from("workspace_members").select("user_id, email, role, artist_id").eq("workspace_id", me.workspace_id).order("created_at"),
    db.from("invitations").select("id, email, role, expires_at").eq("workspace_id", me.workspace_id).is("accepted_at", null).order("created_at", { ascending: false }),
  ]);
  if (!ws) redirect("/connexion");
  const owner = me.role === "owner";
  const artistList = artists ?? [];
  const quote = quoteFor(ws.artist_quantity);
  const artistName = (id: string | null) => artistList.find((a) => a.id === id)?.name;

  return (
    <Shell email={auth.user.email ?? ""}>
      {welcome && <ClearPurchaseDraft />}
      {welcome && (
        <p className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          Bienvenue dans ton espace. {owner && artistList.length === 0 ? "Commence par ajouter ton premier artiste." : ""}
        </p>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{ws.name}</h1>
        <span className="text-sm text-muted-foreground">{ROLE_LABEL[me.role]}</span>
      </div>

      {owner && (
        <Card title="Abonnement">
          <dl className="grid gap-2 text-sm">
            <Row label="Statut" value={STATUS_LABEL[ws.subscription_status] ?? ws.subscription_status} />
            <Row label="Artistes inclus" value={`${artistList.length} utilisé${artistList.length > 1 ? "s" : ""} sur ${ws.artist_quantity}`} />
            {quote.kind === "price" && <Row label="Par mois" value={eur(quote.monthly)} />}
            {ws.current_period_end && <Row label="Prochaine échéance" value={new Date(ws.current_period_end).toLocaleDateString("fr-FR")} />}
          </dl>
        </Card>
      )}

      <Card title={me.role === "artist" ? "Ton artiste" : "Artistes"}>
        {artistList.length ? (
          <ul className="grid gap-2">
            {artistList.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                {a.name}
                <span className="text-xs text-muted-foreground">Dashboard : import du premier relevé à venir</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun artiste pour l&apos;instant.</p>
        )}
        {owner && (
          <div className="mt-4">
            <AddArtistForm workspaceId={ws.id} full={artistList.length >= ws.artist_quantity} />
          </div>
        )}
      </Card>

      {me.role !== "artist" && (
        <Card title="Équipe">
          <ul className="grid gap-2 text-sm">
            {(team ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <span className="min-w-0 truncate">{m.email}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {ROLE_LABEL[m.role]}{m.role === "artist" && artistName(m.artist_id) ? ` · ${artistName(m.artist_id)}` : ""}
                </span>
              </li>
            ))}
            {owner && (invites ?? []).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2 text-muted-foreground">
                <span className="min-w-0 truncate">{i.email}</span>
                <span className="shrink-0 text-xs">invité·e, jusqu&apos;au {new Date(i.expires_at).toLocaleDateString("fr-FR")}</span>
              </li>
            ))}
          </ul>
          {owner && (
            <div className="mt-4">
              <p className="mb-3 text-xs text-muted-foreground">Inviter est gratuit : toute l&apos;équipe de chaque artiste est incluse.</p>
              <InviteForm workspaceId={ws.id} artists={artistList} />
            </div>
          )}
        </Card>
      )}
    </Shell>
  );
}

function Shell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 md:py-14">
      <div className="mb-8 flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">Day 1 Pro</p>
        <form action={signOut} className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
          <Button type="submit" size="sm" variant="ghost"><LogOut /> Déconnexion</Button>
        </form>
      </div>
      {children}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}
