"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KIND_LABEL, WORKSPACE_KINDS, type WorkspaceKind } from "@/lib/accounts/view";
import { eurHT, EXTRA_ARTIST_EUR } from "@/lib/billing/pricing";
import {
  addArtist,
  createInvitation,
  deleteWorkspace,
  leaveWorkspace,
  removeArtist,
  removeMember,
  renameArtist,
  revokeInvitation,
  setWorkspaceKind,
  type FormState,
} from "./actions";

const IDLE: FormState = { status: "idle" };

/** Type d'espace (artiste, label…) : c'est lui qui décide de la vue du dashboard. Propriétaire seulement. */
export function WorkspaceKindForm({ workspaceId, kind }: { workspaceId: string; kind: WorkspaceKind }) {
  const [state, action, pending] = useActionState(setWorkspaceKind, IDLE);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {/* key={kind} : après l'action, React 19 réinitialise le formulaire et ramène le <select> à sa
          valeur par défaut. Mesuré le 23/10 avec un <select> contrôlé : état « publisher », DOM
          « management ». Un <select> non contrôlé, remonté avec le nouveau type, reste d'accord
          avec la base ; l'état « modifié » vit dans ce bloc et repart à zéro avec lui. */}
      <KindPicker key={kind} kind={kind} pending={pending} saved={state.status === "ok"} />
      <p className="text-xs text-muted-foreground">
        Un label, un manager, un éditeur ou un distributeur arrive sur son roster ; un artiste sur son relevé. Un artiste invité garde sa vue à lui quoi qu&apos;il arrive.
      </p>
      {state.status === "error" && <p className="text-xs text-destructive" role="alert">{state.message}</p>}
    </form>
  );
}

function KindPicker({ kind, pending, saved }: { kind: WorkspaceKind; pending: boolean; saved: boolean }) {
  const [dirty, setDirty] = useState(false);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <Label htmlFor="ws-kind" className="mb-2 block">Type d&apos;espace</Label>
        <select id="ws-kind" name="kind" defaultValue={kind} onChange={(e) => setDirty(e.target.value !== kind)} className="h-9 min-w-48 rounded-lg border bg-background px-2 text-sm">
          {WORKSPACE_KINDS.map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending || !dirty}>Enregistrer</Button>
      {saved && !dirty && <span className="text-xs text-muted-foreground">Enregistré.</span>}
    </div>
  );
}

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
          {needsConfirm ? `Ajouter (+${eurHT(EXTRA_ARTIST_EUR)} / mois)` : "Ajouter"}
        </Button>
      </div>
      {needsConfirm && (
        <p className="text-xs text-muted-foreground">
          Tous les artistes payés sont utilisés : celui-ci ajoute {eurHT(EXTRA_ARTIST_EUR)} par mois à ton abonnement (au prorata ce mois-ci).
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
      {state.status === "ok" && state.link && <InviteLink link={state.link} email={state.message ?? ""} emailed={!!state.emailed} />}
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

function InviteLink({ link, email, emailed }: { link: string; email: string; emailed: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg bg-muted/60 p-3 text-sm">
      <p>
        {emailed ? <>Invitation envoyée par email à <strong>{email}</strong>.</> : <>L&apos;email n&apos;a pas pu partir pour <strong>{email}</strong>.</>}
        {" "}Le lien marche 7 jours, une seule fois{emailed ? " ; tu peux aussi le lui envoyer toi-même" : " : envoie-le lui (email, WhatsApp…)"} :
      </p>
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

/* ─────────── Gestion : artistes, équipe, espace ─────────── */

/** Renommer (en place) ou retirer (en retapant son nom) un artiste — propriétaire seulement. */
export function ArtistActions({ artistId, name, freesPaidSlot }: { artistId: string; name: string; freesPaidSlot: boolean }) {
  const [mode, setMode] = useState<"idle" | "rename" | "remove">("idle");
  const [renameState, renameAction, renaming] = useActionState(renameArtist, IDLE);
  const [removeState, removeAction, removing] = useActionState(removeArtist, IDLE);
  useEffect(() => {
    if (renameState.status === "ok") setMode("idle"); // eslint-disable-line react-hooks/set-state-in-effect
  }, [renameState]);

  if (mode === "rename")
    return (
      <form action={renameAction} className="mt-2 flex w-full flex-wrap gap-2">
        <input type="hidden" name="artistId" value={artistId} />
        <Input name="name" defaultValue={name} required maxLength={120} aria-label="Nouveau nom" className="max-w-xs" />
        <Button type="submit" size="sm" disabled={renaming}>Renommer</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setMode("idle")}>Annuler</Button>
        {renameState.status === "error" && <p className="w-full text-xs text-destructive" role="alert">{renameState.message}</p>}
      </form>
    );
  if (mode === "remove")
    return (
      <form action={removeAction} className="mt-2 grid w-full gap-2 rounded-lg border border-destructive/40 p-3">
        <input type="hidden" name="artistId" value={artistId} />
        <p className="text-xs">
          Retirer <strong>{name}</strong>{" "}efface aussi ses relevés, contrats, splits, droits et dépenses, et l&apos;accès de son
          artiste invité. {freesPaidSlot ? "Ton abonnement baisse d'une place (39 € HT / mois, au prorata)." : ""} Pour confirmer, retape son nom :
        </p>
        <div className="flex flex-wrap gap-2">
          <Input name="confirm" autoComplete="off" aria-label={`Retape ${name}`} placeholder={name} className="max-w-xs" />
          <Button type="submit" size="sm" variant="destructive" disabled={removing}>Retirer définitivement</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setMode("idle")}>Annuler</Button>
        </div>
        {removeState.status === "error" && <p className="text-xs text-destructive" role="alert">{removeState.message}</p>}
      </form>
    );
  return (
    <span className="flex gap-1">
      <Button type="button" size="sm" variant="ghost" onClick={() => setMode("rename")}>Renommer</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setMode("remove")}>Retirer</Button>
    </span>
  );
}

function ConfirmButton({
  action,
  fields,
  label,
  confirm,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  label: string;
  confirm: string;
}) {
  const [state, run, pending] = useActionState(action, IDLE);
  return (
    <form
      action={run}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>{label}</Button>
      {state.status === "error" && <p className="text-xs text-destructive" role="alert">{state.message}</p>}
    </form>
  );
}

export function RemoveMemberButton({ workspaceId, userId, email }: { workspaceId: string; userId: string; email: string }) {
  return <ConfirmButton action={removeMember} fields={{ workspaceId, userId }} label="Retirer" confirm={`Retirer ${email} de l'espace ? Son accès est coupé tout de suite.`} />;
}

export function RevokeInvitationButton({ workspaceId, invitationId, email }: { workspaceId: string; invitationId: string; email: string }) {
  return <ConfirmButton action={revokeInvitation} fields={{ workspaceId, invitationId }} label="Annuler" confirm={`Annuler l'invitation de ${email} ? Le lien ne marchera plus.`} />;
}

/** Propriétaire : supprimer l'espace et tout ce qu'il contient. Autres : quitter l'espace. */
export function DangerZone({ workspaceId, workspaceName, owner }: { workspaceId: string; workspaceName: string; owner: boolean }) {
  const [open, setOpen] = useState(false);
  const [delState, delAction, deleting] = useActionState(deleteWorkspace, IDLE);
  const [leaveState, leaveAction, leaving] = useActionState(leaveWorkspace, IDLE);
  if (!owner)
    return (
      <form
        action={leaveAction}
        onSubmit={(e) => {
          if (!window.confirm("Quitter cet espace ? Tu perds l'accès à ses données.")) e.preventDefault();
        }}
      >
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <p className="mb-3 text-xs text-muted-foreground">Ton compte est supprimé si tu n&apos;es membre d&apos;aucun autre espace.</p>
        <Button type="submit" size="sm" variant="outline" disabled={leaving}>Quitter l&apos;espace</Button>
        {leaveState.status === "error" && <p className="mt-2 text-xs text-destructive" role="alert">{leaveState.message}</p>}
      </form>
    );
  if (!open)
    return (
      <div>
        <p className="mb-3 text-xs text-muted-foreground">
          Arrête l&apos;abonnement tout de suite et efface toutes les données de l&apos;espace. Tes factures restent disponibles chez Stripe.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>Supprimer l&apos;espace et mon compte</Button>
      </div>
    );
  return (
    <form action={delAction} className="grid gap-2 rounded-lg border border-destructive/40 p-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <p className="text-xs">
        Tout sera effacé : artistes, relevés, contrats, splits, droits, dépenses, équipe. L&apos;abonnement s&apos;arrête sans
        nouvelle échéance. C&apos;est définitif. Pour confirmer, retape <strong>{workspaceName}</strong> :
      </p>
      <div className="flex flex-wrap gap-2">
        <Input name="confirm" autoComplete="off" aria-label={`Retape ${workspaceName}`} placeholder={workspaceName} className="max-w-xs" />
        <Button type="submit" size="sm" variant="destructive" disabled={deleting}>Supprimer définitivement</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
      </div>
      {delState.status === "error" && <p className="text-xs text-destructive" role="alert">{delState.message}</p>}
    </form>
  );
}
