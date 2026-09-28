"use client";

/**
 * /tour en mode client — les concerts que la structure SAISIT : prochaines
 * dates, bilan des 12 derniers mois (remplissage, billetterie, cachets). Les
 * cachets entrent dans le résultat (/finances) ; la billetterie brute est une
 * information, pas un revenu de la structure.
 */
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Button } from "@/components/ui/button";
import { deleteShow, saveShow } from "@/app/(dashboard)/tour/actions";
import { useCustomer, useCustomerRegisters } from "@/lib/customer-mode";
import { summarizeShows, type Show } from "@/lib/registers/shows";
import { ArtistSelect, DeleteRow, F, RegisterForm, TextIn, frNum } from "./register-ui";
import { useFormats } from "./shared";

const today = () => new Date().toISOString().slice(0, 10);

export function CustomerTour() {
  const f = useFormats();
  const customer = useCustomer();
  const data = useCustomerRegisters().shows;
  const canEdit = customer?.role === "owner" || customer?.role === "member";
  const [editing, setEditing] = useState<Show | "new" | null>(null);
  const now = today();
  const shows = useMemo(() => data?.rows ?? [], [data]);
  const s = useMemo(() => summarizeShows(shows, now), [shows, now]);
  const artistName = useMemo(() => new Map((data?.artists ?? []).map((a) => [a.id, a.name])), [data]);
  const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(f.locale, { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const place = (x: Show) => [x.venue, x.city, x.country].filter(Boolean).join(" · ");

  const row = (x: Show) => (
    <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-current/10 pt-2 text-sm first:border-t-0 first:pt-0">
      <span className="min-w-0">
        <span className="font-medium">{date(x.show_date)}</span> · {place(x)}
        <span className="text-muted-foreground"> · {artistName.get(x.artist_id) ?? "artiste"}</span>
        <span className="text-muted-foreground block text-xs">
          {x.capacity !== null ? `${x.tickets_sold !== null ? `${f.int(x.tickets_sold)} / ` : ""}${f.int(x.capacity)} places` : ""}
          {x.capacity && x.tickets_sold !== null ? ` (${f.pct(x.tickets_sold / x.capacity)})` : ""}
          {x.gross_eur !== null ? ` · billetterie ${f.eur(x.gross_eur)}` : ""}
          {x.fee_eur !== null ? ` · cachet ${f.eur(x.fee_eur)}` : ""}
        </span>
      </span>
      {canEdit && (
        <span className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(x)}>Modifier</Button>
          <DeleteRow action={deleteShow} id={x.id} confirm={`Supprimer le concert du ${x.show_date} à ${x.city} ?`} />
        </span>
      )}
    </li>
  );

  return (
    <div className="rise-in">
      <PageHeader title="Tournée" subtitle={`${s.upcoming.length} date${s.upcoming.length > 1 ? "s" : ""} à venir · ${customer?.workspaceName ?? ""}`}>
        {canEdit && editing === null && <Button onClick={() => setEditing("new")}>Ajouter un concert</Button>}
      </PageHeader>
      <div className="space-y-3">
        {editing !== null && (
          <Sheet family="audience">
            <SheetHeading>{editing === "new" ? "Nouveau concert" : `Modifier · ${editing.city}`}</SheetHeading>
            <RegisterForm key={editing === "new" ? "new" : editing.id} action={saveShow} onDone={() => setEditing(null)} id={editing === "new" ? undefined : editing.id}>
              {(() => {
                const x = editing === "new" ? null : editing;
                return (
                  <>
                    <div className="grid gap-4 sm:grid-cols-4">
                      <ArtistSelect artists={data?.artists ?? []} defaultValue={x?.artist_id ?? customer?.artistId} />
                      <F label="Date"><TextIn type="date" name="show_date" defaultValue={x?.show_date ?? ""} required /></F>
                      <F label="Ville"><TextIn name="city" defaultValue={x?.city ?? ""} required maxLength={80} /></F>
                      <F label="Pays (2 lettres)"><TextIn name="country" defaultValue={x?.country ?? "FR"} maxLength={2} /></F>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-5">
                      <F label="Salle" className="sm:col-span-2"><TextIn name="venue" defaultValue={x?.venue ?? ""} maxLength={120} /></F>
                      <F label="Jauge (places)"><TextIn inputMode="numeric" name="capacity" defaultValue={x?.capacity ?? ""} /></F>
                      <F label="Billets vendus"><TextIn inputMode="numeric" name="tickets_sold" defaultValue={x?.tickets_sold ?? ""} /></F>
                      <F label="Billetterie brute (€)"><TextIn inputMode="decimal" name="gross_eur" defaultValue={frNum(x?.gross_eur)} /></F>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <F label="Cachet reçu (€)"><TextIn inputMode="decimal" name="fee_eur" defaultValue={frNum(x?.fee_eur)} placeholder="ce que l'artiste ou la structure touche" /></F>
                      <F label="Notes" className="sm:col-span-2"><TextIn name="notes" defaultValue={x?.notes ?? ""} maxLength={2000} /></F>
                    </div>
                  </>
                );
              })()}
            </RegisterForm>
          </Sheet>
        )}

        <Sheet family="audience">
          <SheetHeading action="12 derniers mois">Bilan des concerts</SheetHeading>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{s.count12}</p>
          <p className="sheet-ink mt-1.5 text-[13px]">{shows.length === 0 ? (canEdit ? "Aucun concert saisi. Ajoute tes dates : Day 1 suit le remplissage et verse les cachets dans ton résultat." : "Aucun concert partagé avec toi.") : "concerts joués sur les 12 derniers mois"}</p>
          <AffiliatedPoints
            points={[
              { key: "fill", value: s.fill === null ? "—" : f.pct(s.fill), label: "Remplissage", note: s.fillBase ? `sur ${s.fillBase} date${s.fillBase > 1 ? "s" : ""} (jauge et ventes connues)` : "jauge et ventes à saisir" },
              { key: "fees", value: f.eur(s.fees12), label: "Cachets", note: "dans ton résultat" },
              { key: "gross", value: f.eur(s.gross12), label: "Billetterie brute" },
              { key: "next", value: String(s.upcoming.length), label: "Dates à venir" },
            ]}
          />
        </Sheet>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ProvenanceBadge provenance="declared" /> Tel que saisi dans ton espace. Seuls les cachets entrent dans le résultat (/finances), au mois du concert.
        </p>

        {s.upcoming.length > 0 && (
          <Sheet family="audience">
            <SheetHeading>À venir</SheetHeading>
            <ul className="grid gap-2">{s.upcoming.map(row)}</ul>
          </Sheet>
        )}
        {s.past.length > 0 && (
          <Sheet family="audience">
            <SheetHeading action="le plus récent d'abord">Déjà joués</SheetHeading>
            <ul className="grid gap-2">{s.past.map(row)}</ul>
          </Sheet>
        )}
      </div>
    </div>
  );
}
