"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addArtist, createInvitation, type FormState } from "./actions";

const IDLE: FormState = { status: "idle" };

export function AddArtistForm({ workspaceId, full }: { workspaceId: string; full: boolean }) {
  const [state, action, pending] = useActionState(addArtist, IDLE);
  const needsConfirm = full || state.status === "upgrade";
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {needsConfirm && <input type="hidden" name="confirmExtra" value="1" />}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input name="name" placeholder="Nom de l'artiste" aria-label="Nom de l'artiste" required maxLength={120} />
        <Button type="submit" size="lg" disabled={pending}>
          {needsConfirm ? "Ajouter (+39 € / mois)" : "Ajouter"}
        </Button>
      </div>
      {needsConfirm && (
        <p className="text-xs text-muted-foreground">
          Tous les artistes payés sont utilisés : celui-ci ajoute 39 € par mois à ton abonnement (au prorata ce mois-ci).
        </p>
      )}
      {state.status === "error" && <p className="text-sm text-destructive" role="alert">{state.message}</p>}
    </form>
  );
}

export function InviteForm({ workspaceId, artists }: { workspaceId: string; artists: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createInvitation, IDLE);
  return (
    <div className="grid gap-3">
      {/* Remonté après chaque invitation créée : le formulaire repart propre (rôle compris). */}
      <form key={state.link ?? "vide"} action={action} className="grid gap-3">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <InviteFields artists={artists} />
        <Button type="submit" size="lg" variant="outline" disabled={pending}>Créer le lien d&apos;invitation</Button>
      </form>
      {state.status === "error" && <p className="text-sm text-destructive" role="alert">{state.message}</p>}
      {state.status === "ok" && state.link && <InviteLink link={state.link} email={state.message ?? ""} />}
    </div>
  );
}

function InviteFields({ artists }: { artists: { id: string; name: string }[] }) {
  const [role, setRole] = useState<"member" | "artist">("member");
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <Label htmlFor="invite-email" className="mb-2 block">Email</Label>
          <Input id="invite-email" name="email" type="email" required />
        </div>
        <div>
          <Label htmlFor="invite-role" className="mb-2 block">Accès</Label>
          <select id="invite-role" name="role" value={role} onChange={(e) => setRole(e.target.value as "member" | "artist")}
            className="h-8 rounded-lg border bg-background px-2 text-sm">
            <option value="member">Équipe (tout l&apos;espace)</option>
            <option value="artist" disabled={!artists.length}>Artiste (sa vue seulement)</option>
          </select>
        </div>
      </div>
      {role === "artist" && (
        <div>
          <Label htmlFor="invite-artist" className="mb-2 block">Quel artiste ?</Label>
          <select id="invite-artist" name="artistId" required className="h-8 w-full rounded-lg border bg-background px-2 text-sm">
            {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
    </>
  );
}

function InviteLink({ link, email }: { link: string; email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg bg-muted/60 p-3 text-sm">
      <p>Lien pour <strong>{email}</strong>, valable 7 jours et une seule fois. Envoie-le lui (email, WhatsApp…) :</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 text-xs">{link}</code>
        <Button type="button" size="sm" variant="outline"
          onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))}>
          {copied ? <Check /> : <Copy />} {copied ? "Copié" : "Copier"}
        </Button>
      </div>
    </div>
  );
}

/** Le parcours d'achat est terminé : on oublie son brouillon dans ce navigateur. */
export function ClearPurchaseDraft() {
  useEffect(() => {
    try {
      localStorage.removeItem("d1-purchase-draft");
    } catch {}
  }, []);
  return null;
}
