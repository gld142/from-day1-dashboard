"use client";

/**
 * /splits en mode client — qui touche quoi sur chaque titre, tel que la
 * structure le DÉCLARE, et ce que ça représente en euros sur les revenus
 * MASTER du dernier relevé importé (src/lib/splits/split.ts).
 *
 * Les droits d'auteur (SACEM) ne sont pas dans un relevé de distributeur : leurs
 * parts sont affichées, sans montant. « Accord confirmé » = déclaré par la
 * structure, pas une signature électronique — la page le dit.
 */
import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteSplit, saveSplit, type SplitFormState } from "@/app/(dashboard)/splits/actions";
import { useCustomer, useCustomerSplits } from "@/lib/customer-mode";
import { SPLIT_ROLES, normTitle, splitPayouts, type Split, type SplitRole } from "@/lib/splits/split";
import { payoutsByPerson, splitCoverage } from "@/lib/kpi/business";
import { SimpleTable, useFormats } from "./shared";

const IDLE: SplitFormState = { status: "idle" };
type Draft = { title: string; artistId: string } | Split | "new" | null;

export function CustomerSplits() {
  const f = useFormats();
  const customer = useCustomer();
  const data = useCustomerSplits();
  const canEdit = customer?.role === "owner" || customer?.role === "member";
  const [editing, setEditing] = useState<Draft>(null);

  const artistName = useMemo(() => new Map((data?.artists ?? []).map((a) => [a.id, a.name])), [data]);
  const splits = data?.splits ?? [];
  const titles = data?.titles ?? {};
  const covered = useMemo(() => new Set(splits.map((s) => `${s.artist_id}:${normTitle(s.title)}`)), [splits]);
  // Titres des relevés sans split, les plus écoutés d'abord.
  const uncovered = useMemo(
    () =>
      Object.entries(titles)
        .flatMap(([artistId, t]) => t.titles.map((title) => ({ artistId, title, streams: t.streams[normTitle(title)] ?? 0 })))
        .filter((x) => !covered.has(`${x.artistId}:${normTitle(x.title)}`))
        .sort((a, b) => b.streams - a.streams),
    [titles, covered],
  );
  const agreed = splits.filter((s) => s.status === "agreed").length;
  const shared = splits.reduce((sum, s) => sum + (splitPayouts(s, titles[s.artist_id]?.revenue ?? {}).revenue ?? 0), 0);
  // Par personne, sur tout le catalogue : chaque artiste avec ses propres relevés, puis fusion par nom.
  const people = useMemo(() => {
    const merged = new Map<string, { name: string; agreed: number; draft: number; titles: number }>();
    for (const artistId of new Set(splits.map((s) => s.artist_id))) {
      for (const p of payoutsByPerson(splits.filter((s) => s.artist_id === artistId), titles[artistId]?.revenue ?? {})) {
        const k = p.name.toLowerCase();
        const m = merged.get(k) ?? { name: p.name, agreed: 0, draft: 0, titles: 0 };
        merged.set(k, { name: m.name, agreed: Math.round((m.agreed + p.agreed) * 100) / 100, draft: Math.round((m.draft + p.draft) * 100) / 100, titles: m.titles + p.titles });
      }
    }
    return [...merged.values()].sort((a, b) => b.agreed + b.draft - (a.agreed + a.draft));
  }, [splits, titles]);
  const coverage = useMemo(() => {
    let agreedRev = 0;
    let draftRev = 0;
    let total = 0;
    for (const [artistId, t] of Object.entries(titles)) {
      const c = splitCoverage(splits.filter((s) => s.artist_id === artistId), t.revenue);
      const sum = Object.values(t.revenue).reduce((x, v) => x + Math.max(0, v), 0);
      if (!c || !sum) continue;
      agreedRev += c.agreed * sum;
      draftRev += c.draft * sum;
      total += sum;
    }
    return total ? { agreed: agreedRev / total, draft: draftRev / total, none: 1 - (agreedRev + draftRev) / total } : null;
  }, [splits, titles]);
  const period = (artistId: string) => {
    const p = titles[artistId]?.period;
    return p ? `${f.month(p.from)} → ${f.month(p.to)}` : null;
  };

  return (
    <div className="rise-in">
      <PageHeader title="Splits" subtitle={`${splits.length} titre${splits.length > 1 ? "s" : ""} avec un partage · ${customer?.workspaceName ?? ""}`}>
        {canEdit && editing === null && <Button onClick={() => setEditing("new")}>Ajouter un split</Button>}
      </PageHeader>

      <div className="space-y-3">
        {editing !== null && (
          <SplitForm
            key={editing === "new" ? "new" : "id" in editing ? editing.id : `${editing.artistId}:${editing.title}`}
            draft={editing}
            artists={data?.artists ?? []}
            titles={titles}
            defaultArtist={customer?.artistId}
            onDone={() => setEditing(null)}
          />
        )}

        <Sheet family="catalog">
          <SheetHeading>Qui touche quoi</SheetHeading>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
            {agreed}/{splits.length}
          </p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {splits.length === 0 ? "Aucun split saisi pour l'instant." : "titres dont le partage est confirmé par tous (déclaré, pas une signature électronique)"}
          </p>
          <AffiliatedPoints
            points={[
              { key: "agreed", value: String(agreed), label: "Accords confirmés" },
              { key: "draft", value: String(splits.length - agreed), label: "En cours" },
              { key: "uncovered", value: String(uncovered.length), label: "Titres des relevés sans split" },
              { key: "shared", value: f.eur(shared), label: "Revenus master répartis", note: "sur les relevés importés" },
            ]}
          />
          {coverage && (
            <p className="sheet-ink mt-3 text-[13px]">
              Revenus des relevés couverts par un split validé : <b>{f.pct(coverage.agreed)}</b> · en brouillon : {f.pct(coverage.draft)} · sans split : {f.pct(coverage.none)}.
            </p>
          )}
        </Sheet>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ProvenanceBadge provenance="declared" /> Parts telles que saisies ici ; montants = revenus master du relevé × part. Les droits d&apos;auteur (SACEM) ne sont pas dans ce relevé.
        </p>

        {people.length > 0 && (
          <Sheet family="catalog">
            <SheetHeading action="revenus master du relevé × part">Ce que touche chaque personne</SheetHeading>
            <SimpleTable
              head={["Personne", "Splits validés", "En brouillon", "Titres"]}
              rows={people.map((p) => ({ key: p.name, cells: [p.name, f.eur(p.agreed), p.draft ? f.eur(p.draft) : "—", String(p.titles)] }))}
            />
            <p className="sheet-ink mt-2 text-[11px]">Somme, titre par titre, des revenus master du dernier relevé de chaque artiste multipliés par la part master de la personne. Un titre absent du relevé ne compte pas.</p>
          </Sheet>
        )}

        {uncovered.length > 0 && (
          <Sheet family="catalog">
            <SheetHeading action="les plus écoutés d'abord">Titres des relevés sans split</SheetHeading>
            <ul className="grid gap-2 text-sm">
              {uncovered.slice(0, 8).map((u) => (
                <li key={`${u.artistId}:${u.title}`} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {u.title} <span className="text-muted-foreground">· {artistName.get(u.artistId)} · {f.compact(u.streams)} streams</span>
                  </span>
                  {canEdit && (
                    <Button variant="outline" size="sm" onClick={() => setEditing({ title: u.title, artistId: u.artistId })}>
                      Créer le split
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Sheet>
        )}

        {splits.map((s) => {
          const pay = splitPayouts(s, titles[s.artist_id]?.revenue ?? {});
          const hasPublishing = s.shares.some((x) => x.publishing > 0);
          const hasMaster = s.shares.some((x) => x.master > 0);
          return (
            <Sheet key={s.id} family="catalog">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="sheet-ink text-[11px] font-semibold tracking-[0.08em] uppercase">
                    {artistName.get(s.artist_id) ?? "artiste"}
                    {s.isrc ? ` · ISRC ${s.isrc}` : ""} · {s.status === "agreed" ? "accord confirmé" : "en cours"}
                  </p>
                  <p className="mt-1 text-lg font-semibold">{s.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    {pay.revenue === null
                      ? titles[s.artist_id]?.hasRevenue === false
                        ? "Relevé importé avant le détail par titre : réimporte-le pour voir les montants."
                        : "Titre absent du dernier relevé : pas de montant à répartir."
                      : `Revenus master du titre (${period(s.artist_id)}) : ${f.eurCents(pay.revenue)}`}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(s)}>Modifier</Button>
                    <DeleteButton id={s.id} label={s.title} />
                  </div>
                )}
              </div>
              <div className="-mx-1 mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sheet-ink text-left text-xs">
                    <tr>
                      <th className="px-1 py-1.5 font-medium">Participant</th>
                      <th className="px-1 py-1.5 font-medium">Rôle</th>
                      {hasMaster && <th className="px-1 py-1.5 text-right font-medium">Master</th>}
                      {hasPublishing && <th className="px-1 py-1.5 text-right font-medium">Auteur</th>}
                      {hasMaster && <th className="px-1 py-1.5 text-right font-medium">Lui revient</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {s.shares.map((x, i) => (
                      <tr key={i} className="border-t border-current/10">
                        <td className="px-1 py-1.5">{x.name}</td>
                        <td className="px-1 py-1.5 text-muted-foreground">{x.role}</td>
                        {hasMaster && <td className="num px-1 py-1.5 text-right">{x.master ? `${x.master.toLocaleString(f.locale)} %` : "—"}</td>}
                        {hasPublishing && <td className="num px-1 py-1.5 text-right">{x.publishing ? `${x.publishing.toLocaleString(f.locale)} %` : "—"}</td>}
                        {hasMaster && (
                          <td className="num px-1 py-1.5 text-right">
                            {/* Sans part master, il ne touche rien SUR CE RELEVÉ — pas « 0 € » en tout :
                                ses droits d'auteur passent par la SACEM. */}
                            {x.master === 0 ? (
                              <span className="text-muted-foreground font-sans text-xs">{x.publishing > 0 ? "via la SACEM" : "—"}</span>
                            ) : pay.amounts[i] === null ? (
                              "—"
                            ) : (
                              f.eurCents(pay.amounts[i]!)
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {s.notes && <p className="text-muted-foreground mt-3 text-sm whitespace-pre-line">{s.notes}</p>}
            </Sheet>
          );
        })}
      </div>
    </div>
  );
}

function DeleteButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(deleteSplit, IDLE);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Supprimer le split de « ${label} » ? Cette action est définitive.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>Supprimer</Button>
      {state.status === "error" && <p className="text-destructive mt-1 text-xs" role="alert">{state.message}</p>}
    </form>
  );
}

type Row = { name: string; role: SplitRole; email: string; master: string; publishing: string };
const emptyRow = (role: SplitRole = "interprète"): Row => ({ name: "", role, email: "", master: "", publishing: "" });
const pctNum = (v: string) => {
  const n = Number(v.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const labelCls = "text-muted-foreground text-xs font-medium";
const selectCls = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

function SplitForm({
  draft,
  artists,
  titles,
  defaultArtist,
  onDone,
}: {
  draft: Exclude<Draft, null>;
  artists: { id: string; name: string }[];
  titles: Record<string, { titles: string[] }>;
  defaultArtist?: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveSplit, IDLE);
  useEffect(() => {
    if (state.status === "ok") onDone();
  }, [state, onDone]);
  const existing = draft !== "new" && "id" in draft ? draft : null;
  const prefill = draft !== "new" && !("id" in draft) ? draft : null;
  const [artistId, setArtistId] = useState(existing?.artist_id ?? prefill?.artistId ?? defaultArtist ?? artists[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>(
    existing
      ? existing.shares.map((s) => ({ name: s.name, role: s.role, email: s.email ?? "", master: s.master ? String(s.master).replace(".", ",") : "", publishing: s.publishing ? String(s.publishing).replace(".", ",") : "" }))
      : [emptyRow("interprète"), emptyRow("producteur")],
  );
  const sum = (k: "master" | "publishing") => Math.round(rows.reduce((s, r) => s + pctNum(r[k]), 0) * 100) / 100;
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const listId = "split-titles";

  return (
    <Sheet family="catalog">
      <SheetHeading>{existing ? `Modifier · ${existing.title}` : "Nouveau split"}</SheetHeading>
      {/* Envoi à la main : React 19 viderait le formulaire après une erreur (cf. contrats). */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("shares", JSON.stringify(rows));
          startTransition(() => action(fd));
        }}
        className="grid gap-4"
      >
        {existing && <input type="hidden" name="id" value={existing.id} />}
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="grid gap-1.5 text-sm">
            <span className={labelCls}>Artiste</span>
            <select name="artist_id" value={artistId} onChange={(e) => setArtistId(e.target.value)} className={selectCls}>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className={labelCls}>Titre (tel qu&apos;il apparaît dans le relevé)</span>
            <Input name="title" list={listId} defaultValue={existing?.title ?? prefill?.title ?? ""} required maxLength={300} />
            <datalist id={listId}>
              {(titles[artistId]?.titles ?? []).map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className={labelCls}>ISRC (facultatif)</span>
            <Input name="isrc" defaultValue={existing?.isrc ?? ""} placeholder="FR-Z03-26-00001" />
          </label>
        </div>

        <div className="grid gap-2">
          <div className="text-muted-foreground hidden grid-cols-[2fr_1.2fr_2fr_0.8fr_0.8fr_auto] gap-2 text-xs sm:grid">
            <span>Participant</span><span>Rôle</span><span>Email (facultatif)</span><span>Master %</span><span>Auteur %</span><span />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1.2fr_2fr_0.8fr_0.8fr_auto]">
              <Input aria-label="Participant" value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Nom" maxLength={120} />
              <select aria-label="Rôle" value={r.role} onChange={(e) => set(i, { role: e.target.value as SplitRole })} className={selectCls}>
                {SPLIT_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <Input aria-label="Email" value={r.email} onChange={(e) => set(i, { email: e.target.value })} placeholder="email@exemple.com" />
              <Input aria-label="Master %" inputMode="decimal" value={r.master} onChange={(e) => set(i, { master: e.target.value })} placeholder="0" />
              <Input aria-label="Auteur %" inputMode="decimal" value={r.publishing} onChange={(e) => set(i, { publishing: e.target.value })} placeholder="0" />
              <Button type="button" variant="ghost" size="sm" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} disabled={rows.length <= 1}>
                Retirer
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, emptyRow("autre")])} disabled={rows.length >= 20}>
              Ajouter un participant
            </Button>
            <p className="text-xs">
              <Total label="Master" value={sum("master")} /> · <Total label="Auteur" value={sum("publishing")} />
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-1.5 text-sm">
            <span className={labelCls}>Statut</span>
            <select name="status" defaultValue={existing?.status ?? "draft"} className={selectCls}>
              <option value="draft">En cours</option>
              <option value="agreed">Accord confirmé par tous</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className={labelCls}>Notes</span>
            <Input name="notes" defaultValue={existing?.notes ?? ""} maxLength={2000} placeholder="Ex. accord par email du 12/09, contrat de coproduction…" />
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

/** « Master 100 % » en vert, « 90 % » en rouge ; 0 % = couche non renseignée. */
function Total({ label, value }: { label: string; value: number }) {
  const ok = value === 100;
  const unused = value === 0;
  return (
    <span className={ok ? "text-success" : unused ? "text-muted-foreground" : "text-destructive"}>
      {label} : {value.toLocaleString("fr-FR")} %{unused ? " (non renseigné)" : ok ? " ✓" : " (il faut 100 %)"}
    </span>
  );
}
