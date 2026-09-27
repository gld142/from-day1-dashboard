"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendLoginLink, type LoginState } from "./actions";

export function LoginForm({ email }: { email?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendLoginLink, { status: "idle", email });
  if (state.status === "sent") {
    return (
      <p className="rounded-lg bg-muted/60 p-4 text-sm">
        Si <strong>{state.email}</strong> a un espace Day 1 Pro, un lien de connexion vient d&apos;y partir.
        Ouvre-le dans ce navigateur.
      </p>
    );
  }
  return (
    <form action={action} className="grid gap-4">
      <div>
        <Label htmlFor="email" className="mb-2 block">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} />
      </div>
      {state.status === "error" && <p className="text-sm text-destructive" role="alert">{state.message}</p>}
      <Button type="submit" size="lg" disabled={pending}>Recevoir mon lien de connexion</Button>
    </form>
  );
}
