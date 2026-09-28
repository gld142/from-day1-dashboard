"use client";

/**
 * Briques des registres saisis par le client (concerts, placements, sync) :
 * formulaire envoyé à la main (React 19 vide un <form action> après une erreur —
 * mesuré le 28/09 sur les contrats), suppression confirmée, champs.
 */
import { startTransition, useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RegisterFormState } from "@/lib/registers/persist";

type Action = (state: RegisterFormState, form: FormData) => Promise<RegisterFormState>;
const IDLE: RegisterFormState = { status: "idle" };

export function RegisterForm({ action, onDone, children, id }: { action: Action; onDone: () => void; children: React.ReactNode; id?: string }) {
  const [state, run, pending] = useActionState(action, IDLE);
  useEffect(() => {
    if (state.status === "ok") onDone();
  }, [state, onDone]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => run(fd));
      }}
      className="grid gap-4"
    >
      {id && <input type="hidden" name="id" value={id} />}
      {children}
      {state.status === "error" && <p className="text-destructive text-sm" role="alert">{state.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Annuler</Button>
      </div>
    </form>
  );
}

export function DeleteRow({ action, id, confirm }: { action: Action; id: string; confirm: string }) {
  const [state, run, pending] = useActionState(action, IDLE);
  return (
    <form
      action={run}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>Supprimer</Button>
      {state.status === "error" && <p className="text-destructive mt-1 text-xs" role="alert">{state.message}</p>}
    </form>
  );
}

const labelCls = "text-muted-foreground text-xs font-medium";
export const selectCls = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

export function F({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`grid gap-1.5 text-sm ${className ?? ""}`}>
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

export function TextIn(props: React.ComponentProps<typeof Input>) {
  return <Input {...props} />;
}

/** Montant ou nombre pré-rempli à la française (virgule décimale). */
export const frNum = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

export function ArtistSelect({ artists, defaultValue, label = "Artiste" }: { artists: { id: string; name: string }[]; defaultValue?: string; label?: string }) {
  return (
    <F label={label}>
      <select name="artist_id" defaultValue={defaultValue ?? artists[0]?.id} className={selectCls}>
        {artists.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
    </F>
  );
}
