"use client";

/**
 * /finances en mode client — le résultat sur 12 mois : revenus des relevés +
 * droits saisis − dépenses saisies (src/lib/finances/pnl.ts), pour la
 * structure entière ou un artiste. L'artiste invité voit SON résultat (ses
 * dépenses, pas les frais de la structure : RLS).
 *
 * Ce n'est pas une comptabilité : revenus distributeur au mois de vente,
 * droits au mois de versement, dépenses au mois de paiement — la page le dit.
 */
import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { PnlMonthlyChart } from "@/components/modules/finances/pnl-monthly-chart";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteExpense, saveExpense, type ExpenseFormState } from "@/app/(dashboard)/finances/actions";
import { useCustomer, useCustomerFinances } from "@/lib/customer-mode";
import { CATEGORY_LABEL, EXPENSE_CATEGORIES, pnl, type Expense } from "@/lib/finances/pnl";
import { SimpleTable, useFormats } from "./shared";

const IDLE: ExpenseFormState = { status: "idle" };
const today = () => new Date().toISOString().slice(0, 10);

export function CustomerFinances() {
  const f = useFormats();
  const customer = useCustomer();
  const data = useCustomerFinances();
  const canEdit = customer?.role === "owner" || customer?.role === "member";
  const [scope, setScope] = useState<string>(canEdit ? "all" : (customer?.artistId ?? "all"));
  const [editing, setEditing] = useState<Expense | "new" | null>(null);

  const now = today();
  const view = useMemo(
    () => (data ? pnl({ today: now, statements: data.statements, rights: data.rights, shows: data.shows, sync: data.sync, expenses: data.expenses, scope }) : null),
    [data, now, scope],
  );
  const artistName = useMemo(() => new Map((data?.artists ?? []).map((a) => [a.id, a.name])), [data]);
  const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(f.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const listed = (data?.expenses ?? []).filter((e) => scope === "all" || e.artist_id === scope);

  if (!data || !view) return null;
  const { totals: t } = view;

  return (
    <div className="rise-in">
      <PageHeader title="Finances" subtitle={`Résultat sur 12 mois · ${scope === "all" ? `toute la structure (${customer?.workspaceName ?? ""})` : (artistName.get(scope) ?? "artiste")}`}>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <select value={scope} onChange={(e) => setScope(e.target.value)} className="h-9 rounded-md border bg-transparent px-3 text-sm" aria-label="Périmètre">
              <option value="all">Toute la structure</option>
              {data.artists.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
          {canEdit && editing === null && <Button onClick={() => setEditing("new")}>Ajouter une dépense</Button>}
        </div>
      </PageHeader>

      <div className="space-y-3">
        {editing !== null && (
          <ExpenseForm
            key={editing === "new" ? "new" : editing.id}
            expense={editing === "new" ? null : editing}
            artists={data.artists}
            workspaceId={customer?.workspaceId ?? ""}
            defaultArtist={scope === "all" ? "" : scope}
            onDone={() => setEditing(null)}
          />
        )}

        <Sheet family="money">
          <SheetHeading action={`${f.month(view.months[0])} → ${f.month(view.months[view.months.length - 1])}`}>Résultat</SheetHeading>
          <p className={`text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl ${t.net < 0 ? "text-destructive" : ""}`}>{f.eur(t.net)}</p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {f.eur(t.revenue)} de revenus − {f.eur(t.expenses)} de dépenses
            {t.margin !== null ? ` · marge ${f.pct(t.margin)}` : ""}
          </p>
          <AffiliatedPoints
            points={[
              { key: "st", value: f.eur(t.statements), label: "Revenus des relevés", note: "distributeur" },
              { key: "rg", value: f.eur(t.rights), label: "Droits", note: "versements saisis" },
              { key: "cs", value: f.eur(t.concerts + t.sync), label: "Concerts et sync", note: "cachets, licences encaissées" },
              { key: "ex", value: f.eur(t.expenses), label: "Dépenses", note: "saisies" },
            ]}
          />
        </Sheet>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ProvenanceBadge provenance="declared" />
          {view.statementsUntil
            ? `Revenus distributeur connus jusqu'à ${f.month(view.statementsUntil)} : les mois suivants attendent le prochain relevé.`
            : "Aucun relevé importé sur ce périmètre."}{" "}
          Relevés au mois de vente, droits et sync au mois d&apos;encaissement, cachets au mois du concert, dépenses au mois de paiement : ce n&apos;est pas une comptabilité.
        </p>

        <Sheet family="money">
          <SheetHeading>Mois par mois</SheetHeading>
          <PnlMonthlyChart data={view.rows} />
        </Sheet>

        <div className="grid gap-3 xl:grid-cols-[1fr_1.4fr]">
          <Sheet family="money">
            <SheetHeading action="12 mois">Dépenses par catégorie</SheetHeading>
            {view.byCategory.length === 0 ? (
              <p className="sheet-ink text-sm">Aucune dépense saisie sur la période.</p>
            ) : (
              <SimpleTable
                head={["Catégorie", "Montant", "Part"]}
                rows={view.byCategory.map((c) => ({
                  key: c.category,
                  cells: [CATEGORY_LABEL[c.category], f.eurCents(c.amount), t.expenses > 0 ? f.pct(c.amount / t.expenses) : "—"],
                }))}
              />
            )}
          </Sheet>
          <Sheet family="money">
            <SheetHeading action="la plus récente d'abord">Dépenses</SheetHeading>
            {listed.length === 0 ? (
              <p className="sheet-ink text-sm">{canEdit ? "Ajoute tes dépenses (studio, clip, promo…) pour voir ce que tes revenus couvrent vraiment." : "Aucune dépense partagée avec toi."}</p>
            ) : (
              <ul className="grid gap-2">
                {listed.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-current/10 pt-2 text-sm first:border-t-0 first:pt-0">
                    <span className="min-w-0">
                      <span className="font-medium">{e.label}</span>{" "}
                      <span className="text-muted-foreground">
                        · {CATEGORY_LABEL[e.category]} · {date(e.spent_on)} · {e.artist_id ? (artistName.get(e.artist_id) ?? "artiste") : "structure"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="num font-medium">{f.eurCents(e.amount_eur)}</span>
                      {canEdit && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setEditing(e)}>Modifier</Button>
                          <DeleteButton id={e.id} label={e.label} />
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Sheet>
        </div>
      </div>
    </div>
  );
}

function DeleteButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(deleteExpense, IDLE);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Supprimer la dépense « ${label} » ? Cette action est définitive.`)) e.preventDefault();
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

function ExpenseForm({
  expense,
  artists,
  workspaceId,
  defaultArtist,
  onDone,
}: {
  expense: Expense | null;
  artists: { id: string; name: string }[];
  workspaceId: string;
  defaultArtist: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveExpense, IDLE);
  useEffect(() => {
    if (state.status === "ok") onDone();
  }, [state, onDone]);
  const e = expense;
  return (
    <Sheet family="money">
      <SheetHeading>{e ? `Modifier · ${e.label}` : "Nouvelle dépense"}</SheetHeading>
      {/* Envoi à la main : React 19 viderait le formulaire après une erreur (cf. contrats). */}
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          const fd = new FormData(ev.currentTarget);
          startTransition(() => action(fd));
        }}
        className="grid gap-4"
      >
        {e && <input type="hidden" name="id" value={e.id} />}
        <input type="hidden" name="workspace_id" value={workspaceId} />
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className={labelCls}>Dépense</span>
            <Input name="label" defaultValue={e?.label ?? ""} required maxLength={160} placeholder="ex. Mix et master de l'EP" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className={labelCls}>Montant (€)</span>
            <Input inputMode="decimal" name="amount_eur" defaultValue={e ? String(e.amount_eur).replace(".", ",") : ""} required placeholder="ex. 1200" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className={labelCls}>Payée le</span>
            <Input type="date" name="spent_on" defaultValue={e?.spent_on ?? ""} required />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-1.5 text-sm">
            <span className={labelCls}>Catégorie</span>
            <select name="category" defaultValue={e?.category ?? "studio"} className={selectCls}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className={labelCls}>Pour</span>
            <select name="artist_id" defaultValue={e ? (e.artist_id ?? "") : defaultArtist} className={selectCls}>
              <option value="">La structure (frais généraux)</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className={labelCls}>Notes</span>
            <Input name="notes" defaultValue={e?.notes ?? ""} maxLength={2000} />
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
