import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { userDb } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Day 1 Pro — Connexion", robots: { index: false } };

const NOTES: Record<string, string> = {
  paye: "Paiement reçu, merci ! Ton email avait déjà un compte : connecte-toi pour retrouver ton nouvel espace.",
  invitation: "Invitation acceptée. Connecte-toi pour rejoindre l'espace.",
  invalide: "Ce lien n'est plus valable (déjà utilisé ou expiré). Demande-en un nouveau.",
  expire: "Ce lien de connexion a expiré. Demande-en un nouveau.",
};

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { data } = await (await userDb()).auth.getUser();
  if (data.user) redirect("/espace");
  const q = await searchParams;
  const note = q.paye ? NOTES.paye : q.invitation === "ok" ? NOTES.invitation : q.invitation ? NOTES.invalide : q.lien ? NOTES.expire : null;
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">Day 1 Pro</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Connexion</h1>
      <p className="mt-2 text-sm text-muted-foreground">Pas de mot de passe : on t&apos;envoie un lien par email.</p>
      {note && <p className="mt-6 rounded-lg border bg-card p-4 text-sm">{note}</p>}
      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <LoginForm email={q.email} />
      </div>
    </div>
  );
}
