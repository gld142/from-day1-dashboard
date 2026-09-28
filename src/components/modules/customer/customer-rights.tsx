"use client";

/**
 * /rights en mode client — le registre des versements de droits (SACEM,
 * ADAMI, SPEDIDAM…) tel que la structure le SAISIT, et ce que Day 1 en tire :
 * totaux par organisme et par année, organismes silencieux depuis longtemps.
 *
 * Pas d'« attendu » ici : sans les relevés détaillés des organismes (pas encore
 * importés, faute d'exemple réel de leurs fichiers), Day 1 ne peut pas dire ce
 * qui aurait dû être versé. La démo, elle, reste intacte derrière le mot de passe.
 */
import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteRightsPayment, saveRightsPayment, type RightsFormState } from "@/app/(dashboard)/rights/actions";
import { useCustomer, useCustomerRights } from "@/lib/customer-mode";
import { ORGANISMS, ORGANISM_LABEL, USUAL_GAP_MONTHS, summarizePayments, type RightsPayment } from "@/lib/rights/payment";
import { SimpleTable, useFormats } from "./shared";

const IDLE: RightsFormState = { status: "idle" };
const today = () => new Date().toISOString().slice(0, 10);

export function CustomerRights() {
  const f = useFormats();
  const customer = useCustomer();
  const data = useCustomerRights();
  const canEdit = customer?.role === "owner" || customer?.role === "member";
  const [editing, setEditing] = useState<RightsPayment | "new" | null>(null);

  const payments = useMemo(() => data?.payments ?? [], [data]);
  const now = today();
  const s = useMemo(() => summarizePayments(payments, now), [payments, now]);
  const artistName = useMemo(() => new Map((data?.artists ?? []).map((a) => [a.id, a.name])), [data]);
  const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(f.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const stale = s.byOrganism.filter((o) => o.stale);

  return (
    <div className="rise-in">
      <PageHeader title="Droits" subtitle={`SACEM, ADAMI, SPEDIDAM… · ${customer?.workspaceName ?? ""}`}>
        {canEdit && editing === null && <Button onClick={() => setEditing("new")}>Ajouter un versement</Button>}
      </PageHeader>

      <div className="space-y-3">
        {editing !== null && (
          <PaymentForm
            key={editing === "new" ? "new" : editing.id}
            payment={editing === "new" ? null : editing}
            artists={data?.artists ?? []}
            defaultArtist={customer?.artistId}
            onDone={() => setEditing(null)}
          />
        )}

        <Sheet family="money">
          <SheetHeading action="12 derniers mois">Droits reçus</SheetHeading>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{f.eur(s.total12m)}</p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {payments.length === 0
              ? canEdit
                ? "Aucun versement saisi. Ajoute ce que tu reçois des organismes pour suivre tes droits à côté de tes revenus de streaming."
                : "Aucun versement partagé avec toi pour l'instant."
              : `${payments.length} versement${payments.length > 1 ? "s" : ""} saisi${payments.length > 1 ? "s" : ""} · ${f.eur(s.totalAll)} depuis le premier.`}
          </p>
          <AffiliatedPoints
            points={ORGANISMS.filter((o) => ["sacem", "adami", "spedidam", "spre"].includes(o)).map((o) => {
              const row = s.byOrganism.find((x) => x.organism === o);
              return {
                key: o,
                value: row ? f.eur(row.total12m) : "—",
                label: ORGANISM_LABEL[o],
                note: row ? `dernier : ${date(row.last.paid_on)}` : "rien saisi",
              };
            })}
          />
        </Sheet>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ProvenanceBadge provenance="declared" /> Tel que saisi dans ton espace. Les relevés détaillés des organismes ne sont pas encore importés : Day 1 ne peut donc pas dire ce qui aurait dû être versé.
        </p>

        {stale.length > 0 && (
          <Sheet family="trends">
            <SheetHeading>À vérifier</SheetHeading>
            <ul className="grid gap-2 text-sm">
              {stale.map((o) => (
                <li key={o.organism}>
                  {ORGANISM_LABEL[o.organism]} : aucun versement saisi depuis {o.stale!.monthsSince} mois (dernier le {date(o.last.paid_on)}). Un oubli de saisie, ou un versement à réclamer ?
                </li>
              ))}
            </ul>
            <p className="sheet-ink mt-2 text-[11.5px]">
              Signalé au-delà de {USUAL_GAP_MONTHS.sacem} mois pour la SACEM, {USUAL_GAP_MONTHS.adami} pour les autres : un repère de Day 1, pas le calendrier officiel des organismes.
            </p>
          </Sheet>
        )}

        {s.byYear.length > 0 && (
          <Sheet family="money">
            <SheetHeading>Par année</SheetHeading>
            <SimpleTable
              head={["Année", ...s.byOrganism.map((o) => ORGANISM_LABEL[o.organism]), "Total"]}
              rows={s.byYear.map((y) => ({
                key: String(y.year),
                cells: [String(y.year), ...s.byOrganism.map((o) => (y.byOrganism[o.organism] === undefined ? "—" : f.eurCents(y.byOrganism[o.organism]!))), f.eurCents(y.total)],
              }))}
            />
          </Sheet>
        )}

        {payments.length > 0 && (
          <Sheet family="money">
            <SheetHeading action="le plus récent d'abord">Versements</SheetHeading>
            <ul className="grid gap-2">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-current/10 pt-2 text-sm first:border-t-0 first:pt-0">
                  <span className="min-w-0">
                    <span className="font-medium">{ORGANISM_LABEL[p.organism]}</span> · {date(p.paid_on)} · {artistName.get(p.artist_id) ?? "artiste"}
                    {p.period_label ? <span className="text-muted-foreground"> · {p.period_label}</span> : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="num font-medium">{f.eurCents(p.amount_eur)}</span>
                    {canEdit && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setEditing(p)}>Modifier</Button>
                        <DeleteButton id={p.id} label={`${ORGANISM_LABEL[p.organism]} du ${date(p.paid_on)}`} />
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Sheet>
        )}
      </div>
    </div>
  );
}

function DeleteButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(deleteRightsPayment, IDLE);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Supprimer le versement ${label} ? Cette action est définitive.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>Supprimer</Button>
      {state.status === "error" && <p className="text-destructive mt-1 text-xs" role="alert">{state.message}</p>}
    </form>
  );
}

const labelCls = "text-muted-foreground text-xs font-medium";
const selectCls = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

function PaymentForm({
  payment,
  artists,
  defaultArtist,
  onDone,
}: {
  payment: RightsPayment | null;
  artists: { id: string; name: string }[];
  defaultArtist?: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveRightsPayment, IDLE);
  useEffect(() => {
    if (state.status === "ok") onDone();
  }, [state, onDone]);
  const p = payment;
  return (
    <Sheet family="money">
      <SheetHeading>{p ? "Modifier le versement" : "Nouveau versement"}</SheetHeading>
      {/* Envoi à la main : React 19 viderait le formulaire après une erreur (cf. contrats). */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => action(fd));
        }}
        className="grid gap-4"
      >
        {p && <input type="hidden" name="id" value={p.id} />}
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="grid gap-1.5 text-sm">
            <span className={labelCls}>Artiste</span>
            <select name="artist_id" defaultValue={p?.artist_id ?? defaultArtist ?? artists[0]?.id} className={selectCls}>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className={labelCls}>Organisme</span>
            <select name="organism" defaultValue={p?.organism ?? "sacem"} className={selectCls}>
              {ORGANISMS.map((o) => (
                <option key={o} value={o}>{ORGANISM_LABEL[o]}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className={labelCls}>Versé le</span>
            <Input type="date" name="paid_on" defaultValue={p?.paid_on ?? ""} required />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className={labelCls}>Montant reçu (€)</span>
            <Input inputMode="decimal" name="amount_eur" defaultValue={p ? String(p.amount_eur).replace(".", ",") : ""} placeholder="ex. 1234,56" required />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className={labelCls}>Période ou libellé (facultatif)</span>
            <Input name="period_label" defaultValue={p?.period_label ?? ""} maxLength={120} placeholder="ex. Répartition juillet 2026" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className={labelCls}>Notes</span>
            <Input name="notes" defaultValue={p?.notes ?? ""} maxLength={2000} />
          </label>
        </div>
        {state.status === "error" && <p className="text-destructive text-sm" role="alert">{state.message}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
          <Button type="button" variant="ghost" onClick={onDone}>Annuler</Button>
        </div>
      </form>
    </Sheet>
  );
}
