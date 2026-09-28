"use client";

/**
 * /placements en mode client — les œuvres écrites ou produites pour d'autres
 * interprètes, telles que la structure les SAISIT : carnet de commandes (signées,
 * pas encore sorties), et surtout les œuvres SORTIES pas déclarées à la SACEM,
 * dont les droits d'auteur ne seront pas versés tant que ce n'est pas fait.
 */
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Button } from "@/components/ui/button";
import { deletePlacement, savePlacement } from "@/app/(dashboard)/placements/actions";
import { useCustomer, useCustomerRegisters } from "@/lib/customer-mode";
import { PLACEMENT_ROLES, PLACEMENT_STATUS, PLACEMENT_STATUS_LABEL, summarizePlacements, type Placement } from "@/lib/registers/placements";
import { ArtistSelect, DeleteRow, F, RegisterForm, TextIn, frNum, selectCls } from "./register-ui";
import { useFormats } from "./shared";

export function CustomerPlacements() {
  const f = useFormats();
  const customer = useCustomer();
  const data = useCustomerRegisters().placements;
  const canEdit = customer?.role === "owner" || customer?.role === "member";
  const [editing, setEditing] = useState<Placement | "new" | null>(null);
  const list = useMemo(() => data?.rows ?? [], [data]);
  const s = useMemo(() => summarizePlacements(list), [list]);
  const artistName = useMemo(() => new Map((data?.artists ?? []).map((a) => [a.id, a.name])), [data]);
  const date = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString(f.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "date non précisée");
  const order = { released: 0, signed: 1, pitched: 2 } as const;

  return (
    <div className="rise-in">
      <PageHeader title="Œuvres & placements" subtitle={`${list.length} œuvre${list.length > 1 ? "s" : ""} écrite${list.length > 1 ? "s" : ""} ou produite${list.length > 1 ? "s" : ""} pour d'autres · ${customer?.workspaceName ?? ""}`}>
        {canEdit && editing === null && <Button onClick={() => setEditing("new")}>Ajouter une œuvre</Button>}
      </PageHeader>
      <div className="space-y-3">
        {editing !== null && (
          <Sheet family="catalog">
            <SheetHeading>{editing === "new" ? "Nouvelle œuvre" : `Modifier · ${editing.title}`}</SheetHeading>
            <RegisterForm key={editing === "new" ? "new" : editing.id} action={savePlacement} onDone={() => setEditing(null)} id={editing === "new" ? undefined : editing.id}>
              {(() => {
                const x = editing === "new" ? null : editing;
                return (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <ArtistSelect artists={data?.artists ?? []} defaultValue={x?.artist_id ?? customer?.artistId} label="Auteur-compositeur" />
                      <F label="Titre de l'œuvre"><TextIn name="title" defaultValue={x?.title ?? ""} required maxLength={300} /></F>
                      <F label="Interprète"><TextIn name="performer" defaultValue={x?.performer ?? ""} required maxLength={160} /></F>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-4">
                      <fieldset className="grid gap-1.5 text-sm">
                        <legend className="text-muted-foreground mb-1.5 text-xs font-medium">Rôles</legend>
                        {PLACEMENT_ROLES.map((r) => (
                          <label key={r} className="flex items-center gap-2">
                            <input type="checkbox" name="roles" value={r} defaultChecked={x ? x.roles.includes(r) : r === "auteur"} className="size-4" /> {r}
                          </label>
                        ))}
                      </fieldset>
                      <F label="Part d'écriture (%)"><TextIn inputMode="decimal" name="writer_share" defaultValue={frNum(x?.writer_share)} placeholder="ex. 25" /></F>
                      <F label="Points de production (%)"><TextIn inputMode="decimal" name="producer_points" defaultValue={frNum(x?.producer_points)} placeholder="0 si pas produit" /></F>
                      <F label="Où en est l'œuvre">
                        <select name="status" defaultValue={x?.status ?? "signed"} className={selectCls}>
                          {PLACEMENT_STATUS.map((st) => (
                            <option key={st} value={st}>{PLACEMENT_STATUS_LABEL[st]}</option>
                          ))}
                        </select>
                      </F>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <F label="Date de sortie (ou visée)"><TextIn type="date" name="release_date" defaultValue={x?.release_date ?? ""} /></F>
                      <label className="flex items-center gap-2 pt-5 text-sm">
                        <input type="checkbox" name="sacem_declared" defaultChecked={x?.sacem_declared} className="size-4" /> Déclarée à la SACEM
                      </label>
                      <F label="Notes"><TextIn name="notes" defaultValue={x?.notes ?? ""} maxLength={2000} /></F>
                    </div>
                  </>
                );
              })()}
            </RegisterForm>
          </Sheet>
        )}

        <Sheet family="catalog">
          <SheetHeading>Œuvres pour d&apos;autres</SheetHeading>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{s.released}</p>
          <p className="sheet-ink mt-1.5 text-[13px]">{list.length === 0 ? (canEdit ? "Aucune œuvre saisie. Ajoute ce que tu écris ou produis pour d'autres : Day 1 surveille les déclarations SACEM." : "Aucune œuvre partagée avec toi.") : "œuvres sorties"}</p>
          <AffiliatedPoints
            points={[
              { key: "signed", value: String(s.signed.length), label: "Signées, pas encore sorties", note: "le carnet de commandes" },
              { key: "pitched", value: String(s.pitched), label: "Proposées" },
              { key: "undeclared", value: String(s.undeclared.length), label: "Sorties non déclarées SACEM" },
              { key: "share", value: s.avgWriterShare === null ? "—" : `${(Math.round(s.avgWriterShare * 10) / 10).toLocaleString(f.locale)} %`, label: "Part d'écriture moyenne" },
            ]}
          />
        </Sheet>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ProvenanceBadge provenance="declared" /> Tel que saisi dans ton espace.
        </p>

        {s.undeclared.length > 0 && (
          <Sheet family="trends">
            <SheetHeading>À déclarer à la SACEM</SheetHeading>
            <ul className="grid gap-1.5 text-sm">
              {s.undeclared.map((p) => (
                <li key={p.id} className="text-destructive">
                  « {p.title} » ({p.performer}), sortie le {date(p.release_date)}{" "}: pas déclarée — les droits d&apos;auteur ne seront pas versés tant qu&apos;elle ne l&apos;est pas.
                </li>
              ))}
            </ul>
          </Sheet>
        )}

        {list.length > 0 && (
          <Sheet family="catalog">
            <SheetHeading>Œuvres</SheetHeading>
            <ul className="grid gap-2">
              {[...list].sort((a, b) => order[a.status] - order[b.status] || (b.release_date ?? "").localeCompare(a.release_date ?? "")).map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-current/10 pt-2 text-sm first:border-t-0 first:pt-0">
                  <span className="min-w-0">
                    <span className="font-medium">{p.title}</span> · {p.performer}
                    <span className="text-muted-foreground"> · {artistName.get(p.artist_id) ?? "artiste"}</span>
                    <span className="text-muted-foreground block text-xs">
                      {PLACEMENT_STATUS_LABEL[p.status]} · {date(p.release_date)} · {p.roles.join(", ")}
                      {p.writer_share !== null ? ` · écriture ${p.writer_share.toLocaleString(f.locale)} %` : ""}
                      {p.producer_points ? ` · production ${p.producer_points.toLocaleString(f.locale)} pts` : ""}
                      {p.sacem_declared ? " · déclarée SACEM" : ""}
                    </span>
                  </span>
                  {canEdit && (
                    <span className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(p)}>Modifier</Button>
                      <DeleteRow action={deletePlacement} id={p.id} confirm={`Supprimer « ${p.title} » ?`} />
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
