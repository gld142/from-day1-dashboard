"use client";

/**
 * /contracts en mode client — les contrats que la structure SAISIT, et ce que
 * Day 1 en tire : dates limites de préavis, fins proches, reste à recouper.
 * Day 1 ne lit pas le contrat : tout vient de ce qui est déclaré ici.
 *
 * Propriétaire et équipe : ajout, modification, suppression. Artiste invité :
 * lecture de ses contrats seulement (RLS) — aucun bouton d'écriture.
 */
import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteContract, saveContract, type ContractFormState } from "@/app/(dashboard)/contracts/actions";
import { useCustomer, useCustomerContracts } from "@/lib/customer-mode";
import { CONTRACT_KINDS, KIND_LABEL, contractTimeline, type Contract, type ContractAlert } from "@/lib/contracts/contract";
import { useFormats } from "./shared";

const IDLE: ContractFormState = { status: "idle" };
const today = () => new Date().toISOString().slice(0, 10);

export function CustomerContracts() {
  const f = useFormats();
  const customer = useCustomer();
  const data = useCustomerContracts();
  const canEdit = customer?.role === "owner" || customer?.role === "member";
  const [editing, setEditing] = useState<Contract | "new" | null>(null);

  const now = today();
  const artistName = useMemo(() => new Map((data?.artists ?? []).map((a) => [a.id, a.name])), [data]);
  const rows = useMemo(
    () =>
      (data?.contracts ?? [])
        .map((c) => ({ c, t: contractTimeline(c, now) }))
        .sort((a, b) => (a.t.status === "ended" ? 1 : 0) - (b.t.status === "ended" ? 1 : 0) || (a.c.ends_on ?? "9999").localeCompare(b.c.ends_on ?? "9999")),
    [data, now],
  );
  const alerts = rows
    .flatMap(({ c, t }) => t.alerts.map((a) => ({ a, c })))
    .sort((x, y) => x.a.daysLeft - y.a.daysLeft);
  const live = rows.filter((r) => r.t.status !== "ended");
  const recoup = live.reduce((s, r) => s + (r.t.recoupRemaining ?? 0), 0);
  const hasAdvance = live.some((r) => r.t.recoupRemaining !== null);
  const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(f.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const inDays = (n: number) => (n === 0 ? "aujourd'hui" : n > 0 ? `dans ${n} jour${n > 1 ? "s" : ""}` : `il y a ${-n} jour${n < -1 ? "s" : ""}`);

  const alertText = ({ a, c }: { a: ContractAlert; c: Contract }) => {
    const who = `${c.counterparty} (${artistName.get(c.artist_id) ?? "artiste"})`;
    if (a.kind === "notice")
      return `${who} : préavis à envoyer avant le ${date(a.date)}, ${inDays(a.daysLeft)}${c.auto_renew ? " — sinon le contrat se reconduit tacitement" : ""}.`;
    if (a.kind === "notice-passed") return `${who} : la date limite de préavis était le ${date(a.date)}.`;
    return `${who} : fin du contrat le ${date(a.date)}, ${inDays(a.daysLeft)}.`;
  };

  return (
    <div className="rise-in">
      <PageHeader
        title="Contrats"
        subtitle={`${live.length} contrat${live.length > 1 ? "s" : ""} en cours · ${customer?.workspaceName ?? ""}`}
      >
        {canEdit && editing === null && <Button onClick={() => setEditing("new")}>Ajouter un contrat</Button>}
      </PageHeader>

      <div className="space-y-3">
        {editing !== null && (
          <ContractForm
            key={editing === "new" ? "new" : editing.id}
            contract={editing === "new" ? null : editing}
            artists={data?.artists ?? []}
            defaultArtist={customer?.artistId}
            onDone={() => setEditing(null)}
          />
        )}

        <Sheet family="money">
          <SheetHeading action={`au ${date(now)}`}>{alerts.length ? "À surveiller" : "Échéances"}</SheetHeading>
          {alerts.length === 0 ? (
            <p className="sheet-ink text-sm">
              {rows.length === 0
                ? canEdit
                  ? "Aucun contrat saisi. Ajoute tes contrats : Day 1 te préviendra des préavis et des fins de contrat."
                  : "Aucun contrat partagé avec toi pour l'instant."
                : `Aucun préavis dans les ${120} prochains jours, aucune fin de contrat dans les 6 mois.`}
            </p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {alerts.map((x) => (
                <li key={`${x.c.id}-${x.a.kind}`} className={x.a.kind === "notice" && x.a.daysLeft <= 30 ? "text-destructive" : undefined}>
                  {alertText(x)}
                </li>
              ))}
            </ul>
          )}
          <AffiliatedPoints
            points={[
              { key: "live", value: String(live.length), label: "Contrats en cours" },
              { key: "soon", value: String(new Set(alerts.map((x) => x.c.id)).size), label: "Avec une échéance proche" },
              { key: "recoup", value: hasAdvance ? f.eur(recoup) : "—", label: "Reste à recouper", note: hasAdvance ? "d'après le recoupé déclaré" : "aucune avance saisie" },
              { key: "open", value: String(live.filter((r) => !r.c.ends_on).length), label: "Sans date de fin" },
            ]}
          />
        </Sheet>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ProvenanceBadge provenance="declared" /> Tel que saisi dans ton espace — Day 1 ne lit pas le contrat. Préavis signalés 120 jours avant, fins 6 mois avant.
        </p>

        {rows.map(({ c, t }) => (
          <Sheet key={c.id} family="money" className={t.status === "ended" ? "opacity-60" : undefined}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="sheet-ink text-[11px] font-semibold tracking-[0.08em] uppercase">
                  {KIND_LABEL[c.kind]} · {artistName.get(c.artist_id) ?? "artiste"}
                  {t.status === "ended" ? " · terminé" : t.status === "upcoming" ? " · à venir" : ""}
                </p>
                <p className="mt-1 text-lg font-semibold">{c.counterparty}</p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {c.starts_on ? date(c.starts_on) : "début non précisé"} → {c.ends_on ? date(c.ends_on) : "sans date de fin"}
                  {t.noticeDeadline ? ` · préavis avant le ${date(t.noticeDeadline)}` : ""}
                  {c.auto_renew ? " · tacite reconduction" : ""}
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(c)}>Modifier</Button>
                  <DeleteButton id={c.id} label={c.counterparty} />
                </div>
              )}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <Fact label="Taux" value={c.royalty_rate === null ? "—" : `${c.royalty_rate.toLocaleString(f.locale)} %`} />
              <Fact label="Avance" value={c.advance_eur === null ? "—" : f.eur(c.advance_eur)} />
              <Fact
                label="Reste à recouper"
                value={t.recoupRemaining === null ? "—" : f.eur(t.recoupRemaining)}
                note={c.recouped_at ? `recoupé déclaré au ${date(c.recouped_at)}` : undefined}
              />
              <Fact label="Territoire" value={`${c.territory ?? "—"}${c.exclusive ? " · exclusif" : ""}`} />
            </dl>
            {c.advance_eur !== null && c.advance_eur > 0 && (
              <div className="mt-3 h-1.5 rounded-full bg-muted" title="Part de l'avance déjà recoupée">
                <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.min(100, ((c.recouped_eur ?? 0) / c.advance_eur) * 100)}%` }} />
              </div>
            )}
            {c.notes && <p className="text-muted-foreground mt-3 text-sm whitespace-pre-line">{c.notes}</p>}
          </Sheet>
        ))}
      </div>
    </div>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="sheet-ink text-xs">{label}</dt>
      <dd className="num">{value}</dd>
      {note && <dd className="text-muted-foreground text-[11px]">{note}</dd>}
    </div>
  );
}

function DeleteButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(deleteContract, IDLE);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Supprimer le contrat « ${label} » ? Cette action est définitive.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>Supprimer</Button>
      {state.status === "error" && <p className="text-destructive mt-1 text-xs" role="alert">{state.message}</p>}
    </form>
  );
}

const field = "grid gap-1.5 text-sm";
const labelCls = "text-muted-foreground text-xs font-medium";
const selectCls = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

function ContractForm({
  contract,
  artists,
  defaultArtist,
  onDone,
}: {
  contract: Contract | null;
  artists: { id: string; name: string }[];
  defaultArtist?: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveContract, IDLE);
  useEffect(() => {
    if (state.status === "ok") onDone();
  }, [state, onDone]);
  const c = contract;
  const num = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));

  return (
    <Sheet family="money">
      <SheetHeading>{c ? `Modifier · ${c.counterparty}` : "Nouveau contrat"}</SheetHeading>
      {/* Envoi à la main, pas <form action> : React 19 vide un formulaire après
          l'action MÊME en cas d'erreur — mesuré le 28/09, toute la saisie perdue
          sur « la fin est avant le début ». */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => action(fd));
        }}
        className="grid gap-4"
      >
        {c && <input type="hidden" name="id" value={c.id} />}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={field}>
            <span className={labelCls}>Artiste</span>
            <select name="artist_id" defaultValue={c?.artist_id ?? defaultArtist ?? artists[0]?.id} className={selectCls} required>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className={field}>
            <span className={labelCls}>Type de contrat</span>
            <select name="kind" defaultValue={c?.kind ?? "licence"} className={selectCls} required>
              {CONTRACT_KINDS.map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <label className={field}>
            <span className={labelCls}>Signé avec</span>
            <Input name="counterparty" defaultValue={c?.counterparty} placeholder="Label, éditeur, distributeur…" required maxLength={160} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <label className={field}>
            <span className={labelCls}>Signé le</span>
            <Input type="date" name="signed_on" defaultValue={c?.signed_on ?? ""} />
          </label>
          <label className={field}>
            <span className={labelCls}>Début</span>
            <Input type="date" name="starts_on" defaultValue={c?.starts_on ?? ""} />
          </label>
          <label className={field}>
            <span className={labelCls}>Fin (vide : sans date de fin)</span>
            <Input type="date" name="ends_on" defaultValue={c?.ends_on ?? ""} />
          </label>
          <label className={field}>
            <span className={labelCls}>Préavis (jours)</span>
            <Input inputMode="numeric" name="notice_days" defaultValue={c?.notice_days ?? ""} placeholder="ex. 90" />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <label className={field}>
            <span className={labelCls}>Taux artiste (%)</span>
            <Input inputMode="decimal" name="royalty_rate" defaultValue={num(c?.royalty_rate ?? null)} placeholder="ex. 18" />
          </label>
          <label className={field}>
            <span className={labelCls}>Avance (€)</span>
            <Input inputMode="decimal" name="advance_eur" defaultValue={num(c?.advance_eur ?? null)} placeholder="ex. 10000" />
          </label>
          <label className={field}>
            <span className={labelCls}>Déjà recoupé (€)</span>
            <Input inputMode="decimal" name="recouped_eur" defaultValue={num(c?.recouped_eur ?? null)} placeholder="d'après le dernier relevé" />
          </label>
          <label className={field}>
            <span className={labelCls}>Recoupé au</span>
            <Input type="date" name="recouped_at" defaultValue={c?.recouped_at ?? ""} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={field}>
            <span className={labelCls}>Territoire</span>
            <Input name="territory" defaultValue={c?.territory ?? ""} placeholder="ex. Monde, France…" maxLength={120} />
          </label>
          <label className="flex items-center gap-2 pt-5 text-sm">
            <input type="checkbox" name="auto_renew" defaultChecked={c?.auto_renew} className="size-4" /> Tacite reconduction
          </label>
          <label className="flex items-center gap-2 pt-5 text-sm">
            <input type="checkbox" name="exclusive" defaultChecked={c?.exclusive} className="size-4" /> Exclusif
          </label>
        </div>
        <label className={field}>
          <span className={labelCls}>Notes</span>
          <textarea name="notes" defaultValue={c?.notes ?? ""} maxLength={2000} rows={3} className="rounded-md border bg-transparent px-3 py-2 text-sm" placeholder="Clauses à retenir, options, contact…" />
        </label>
        {state.status === "error" && <p className="text-destructive text-sm" role="alert">{state.message}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
          <Button type="button" variant="ghost" onClick={onDone}>Annuler</Button>
        </div>
      </form>
    </Sheet>
  );
}
