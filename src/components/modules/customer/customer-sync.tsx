"use client";

/**
 * /sync en mode client — les licences de synchronisation que la structure
 * SAISIT : encaissé sur 12 mois (versé dans le résultat, /finances), signé non
 * payé, et pipeline (proposé, en négociation) — dit comme tel, pas comme acquis.
 */
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Button } from "@/components/ui/button";
import { deleteSync, saveSync } from "@/app/(dashboard)/sync/actions";
import { useCustomer, useCustomerRegisters } from "@/lib/customer-mode";
import { SYNC_MEDIA, SYNC_MEDIA_LABEL, SYNC_STATUS, SYNC_STATUS_LABEL, feeOf, summarizeSync, type SyncLicense } from "@/lib/registers/sync";
import { ArtistSelect, DeleteRow, F, RegisterForm, TextIn, frNum, selectCls } from "./register-ui";
import { useFormats } from "./shared";

const today = () => new Date().toISOString().slice(0, 10);

export function CustomerSync() {
  const f = useFormats();
  const customer = useCustomer();
  const data = useCustomerRegisters().sync;
  const canEdit = customer?.role === "owner" || customer?.role === "member";
  const [editing, setEditing] = useState<SyncLicense | "new" | null>(null);
  const now = today();
  const list = useMemo(() => data?.rows ?? [], [data]);
  const s = useMemo(() => summarizeSync(list, now), [list, now]);
  const artistName = useMemo(() => new Map((data?.artists ?? []).map((a) => [a.id, a.name])), [data]);
  const date = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString(f.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");
  const order: Record<SyncLicense["status"], number> = { negotiating: 0, proposed: 1, signed: 2, paid: 3, lost: 4 };

  return (
    <div className="rise-in">
      <PageHeader title="Sync & licences" subtitle={`${s.open} licence${s.open > 1 ? "s" : ""} en cours · ${customer?.workspaceName ?? ""}`}>
        {canEdit && editing === null && <Button onClick={() => setEditing("new")}>Ajouter une licence</Button>}
      </PageHeader>
      <div className="space-y-3">
        {editing !== null && (
          <Sheet family="money">
            <SheetHeading>{editing === "new" ? "Nouvelle licence" : `Modifier · ${editing.project}`}</SheetHeading>
            <RegisterForm key={editing === "new" ? "new" : editing.id} action={saveSync} onDone={() => setEditing(null)} id={editing === "new" ? undefined : editing.id}>
              {(() => {
                const x = editing === "new" ? null : editing;
                return (
                  <>
                    <div className="grid gap-4 sm:grid-cols-4">
                      <ArtistSelect artists={data?.artists ?? []} defaultValue={x?.artist_id ?? customer?.artistId} />
                      <F label="Titre concerné"><TextIn name="track_title" defaultValue={x?.track_title ?? ""} required maxLength={300} /></F>
                      <F label="Projet"><TextIn name="project" defaultValue={x?.project ?? ""} required maxLength={200} placeholder="marque, film, série…" /></F>
                      <F label="Média">
                        <select name="media" defaultValue={x?.media ?? "pub"} className={selectCls}>
                          {SYNC_MEDIA.map((m) => (
                            <option key={m} value={m}>{SYNC_MEDIA_LABEL[m]}</option>
                          ))}
                        </select>
                      </F>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-4">
                      <F label="Client ou superviseur"><TextIn name="client" defaultValue={x?.client ?? ""} maxLength={160} /></F>
                      <F label="Territoire"><TextIn name="territory" defaultValue={x?.territory ?? ""} maxLength={120} placeholder="ex. France, monde" /></F>
                      <F label="Durée"><TextIn name="term" defaultValue={x?.term ?? ""} maxLength={120} placeholder="ex. 1 an" /></F>
                      <F label="Statut">
                        <select name="status" defaultValue={x?.status ?? "proposed"} className={selectCls}>
                          {SYNC_STATUS.map((st) => (
                            <option key={st} value={st}>{SYNC_STATUS_LABEL[st]}</option>
                          ))}
                        </select>
                      </F>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-4">
                      <F label="Montant master (€)"><TextIn inputMode="decimal" name="fee_master_eur" defaultValue={frNum(x?.fee_master_eur)} /></F>
                      <F label="Montant édition (€)"><TextIn inputMode="decimal" name="fee_publishing_eur" defaultValue={frNum(x?.fee_publishing_eur)} /></F>
                      <F label="Signée le"><TextIn type="date" name="signed_on" defaultValue={x?.signed_on ?? ""} /></F>
                      <F label="Encaissée le (si payée)"><TextIn type="date" name="paid_on" defaultValue={x?.paid_on ?? ""} /></F>
                    </div>
                    <F label="Notes"><TextIn name="notes" defaultValue={x?.notes ?? ""} maxLength={2000} /></F>
                  </>
                );
              })()}
            </RegisterForm>
          </Sheet>
        )}

        <Sheet family="money">
          <SheetHeading action="12 derniers mois">Licences encaissées</SheetHeading>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{f.eur(s.paid12)}</p>
          <p className="sheet-ink mt-1.5 text-[13px]">{list.length === 0 ? (canEdit ? "Aucune licence saisie. Ajoute tes synchros : Day 1 suit le pipeline et verse ce qui est encaissé dans ton résultat." : "Aucune licence partagée avec toi.") : "master et édition, versés dans ton résultat"}</p>
          <AffiliatedPoints
            points={[
              { key: "signed", value: f.eur(s.signedUnpaid), label: "Signé, pas encore payé" },
              { key: "pipe", value: f.eur(s.pipeline), label: "En discussion", note: "proposé ou en négociation : pas acquis" },
              { key: "open", value: String(s.open), label: "Licences en cours" },
            ]}
          />
        </Sheet>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ProvenanceBadge provenance="declared" /> Tel que saisi dans ton espace. Seules les licences payées entrent dans le résultat, au mois d&apos;encaissement.
        </p>

        {list.length > 0 && (
          <Sheet family="money">
            <SheetHeading>Licences</SheetHeading>
            <ul className="grid gap-2">
              {[...list].sort((a, b) => order[a.status] - order[b.status]).map((l) => (
                <li key={l.id} className={`flex flex-wrap items-center justify-between gap-2 border-t border-current/10 pt-2 text-sm first:border-t-0 first:pt-0 ${l.status === "lost" ? "opacity-60" : ""}`}>
                  <span className="min-w-0">
                    <span className="font-medium">{l.project}</span> · {SYNC_MEDIA_LABEL[l.media]} · « {l.track_title} »
                    <span className="text-muted-foreground"> · {artistName.get(l.artist_id) ?? "artiste"}</span>
                    <span className="text-muted-foreground block text-xs">
                      {SYNC_STATUS_LABEL[l.status]}
                      {feeOf(l) ? ` · ${f.eur(feeOf(l))}` : ""}
                      {l.client ? ` · ${l.client}` : ""}
                      {l.territory ? ` · ${l.territory}` : ""}
                      {l.term ? ` · ${l.term}` : ""}
                      {l.paid_on ? ` · encaissée le ${date(l.paid_on)}` : l.signed_on ? ` · signée le ${date(l.signed_on)}` : ""}
                    </span>
                  </span>
                  {canEdit && (
                    <span className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(l)}>Modifier</Button>
                      <DeleteRow action={deleteSync} id={l.id} confirm={`Supprimer la licence « ${l.project} » ?`} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Sheet>
        )}
      </div>
    </div>
  );
}
