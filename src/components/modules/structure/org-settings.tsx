"use client";

/**
 * Réglages → « Organisation de la maison » (démo) : renommer / ajouter des personnes (DA,
 * chefs de projet, marketing, juristes), ajouter des pôles, attribuer chaque artiste (pôle,
 * catégorie, DA, équipe), réinitialiser. Tout s'applique tout de suite : le périmètre d'un DA
 * suit l'attribution réelle (scope.ts, `scopedArtists(…, org)`).
 *
 * Accessibilité : listes et champs NATIFS (`<select>`, `<input>`), chacun nommé
 * (« DA principal de Louane ») ; un tableau à en-têtes de colonne et de ligne.
 */
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetHeading } from "@/components/dashboard/sheet";
import { ARTISTS } from "@/lib/demo/data";
import {
  ASSIGNMENT_FIELDS,
  FIELD_KIND,
  ORG_KINDS,
  countBy,
  daCategories,
  isOrgChanged,
  isOrgKind,
  peopleOf,
  resolveAssignment,
  type AssignmentField,
  type OrgKind,
  type OrgPole,
  type OrgState,
} from "@/lib/demo/org";
import { ARTIST_CATEGORIES } from "@/lib/demo/types";
import { DAS } from "@/lib/demo/das";
import { useRole } from "@/lib/role";
import {
  addOrgPerson,
  addOrgPole,
  assignOrgArtist,
  renameOrgPerson,
  resetOrg,
} from "@/lib/userdata/org-store";
import { useOrg } from "@/lib/userdata/use-org";
import { cn } from "@/lib/utils";

const FIELD_CLASS =
  "border-input bg-background focus-visible:ring-ring h-8 rounded-md border px-2 text-[12.5px] outline-none focus-visible:ring-2";

function usePoleName() {
  const t = useTranslations("organisation");
  return (pole: OrgPole) => pole.name ?? (t.has(`poles.${pole.id}`) ? t(`poles.${pole.id}`) : pole.id);
}

export function OrgSettings() {
  const t = useTranslations("organisation");
  const tr = useTranslations("roster");
  const org = useOrg();
  const poleName = usePoleName();
  const { jobRole, daId, setJobRole } = useRole();

  const reset = () => {
    /* Un rôle DA sur un DA ajouté ne survivrait pas : on retire le rôle plutôt que de le laisser
       pointer vers une personne qui n'existe plus (périmètre vide). */
    if (jobRole === "da" && daId && !DAS.some((d) => d.id === daId)) setJobRole(null);
    resetOrg();
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <SheetHeading>{t("settings.title")}</SheetHeading>
          <p className="sheet-ink max-w-xl text-[12.5px] leading-relaxed">{t("settings.subtitle")}</p>
        </div>
        {isOrgChanged(org) && (
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={reset}>
            <RotateCcw className="size-3" aria-hidden />
            {t("settings.reset")}
          </Button>
        )}
      </div>

      <PeopleSection org={org} />
      <PolesSection org={org} poleName={poleName} />

      {/* ─── Attribution des artistes ─── */}
      <section className="hairline-t mt-4 pt-4" aria-labelledby="org-assignments-title">
        <h3 id="org-assignments-title" className="text-sm font-semibold">
          {t("settings.assignments.title")}
        </h3>
        <p className="text-muted-foreground mb-2 text-xs">{t("settings.assignments.hint")}</p>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="text-muted-foreground text-[11px]">
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  {t("settings.assignments.artist")}
                </th>
                {ASSIGNMENT_FIELDS.map((f) => (
                  <th key={f} scope="col" className="px-1 py-1.5 font-medium">
                    {t(`fields.${f}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ARTISTS.map((a) => {
                const r = resolveAssignment(a, org);
                return (
                  <tr key={a.id} className="hairline-t">
                    <th scope="row" className="py-1.5 pr-2 font-medium whitespace-nowrap">
                      {a.name}
                    </th>
                    {ASSIGNMENT_FIELDS.map((f) => (
                      <td key={f} className="px-1 py-1.5">
                        <select
                          className={cn(FIELD_CLASS, "w-full min-w-[110px]")}
                          aria-label={t("settings.assignments.select", { field: t(`fields.${f}`), artist: a.name })}
                          value={r[f]}
                          onChange={(e) => assignOrgArtist(a, f, e.target.value)}
                        >
                          {optionsFor(org, f).map((o) => (
                            <option key={o.id} value={o.id}>
                              {f === "category" ? tr(`category.${o.id}`) : f === "poleId" ? poleName(o as OrgPole) : o.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** Les choix d'un champ d'attribution : pôles, catégories, ou les personnes du bon métier. */
function optionsFor(org: OrgState, field: AssignmentField): { id: string; name: string | null }[] {
  if (field === "poleId") return org.poles;
  if (field === "category") return ARTIST_CATEGORIES.map((c) => ({ id: c, name: null }));
  return peopleOf(org, FIELD_KIND[field]);
}

function PeopleSection({ org }: { org: OrgState }) {
  const t = useTranslations("organisation");
  const tr = useTranslations("roster");
  const [kind, setKind] = useState<OrgKind>("da");
  const [name, setName] = useState("");
  /* Artistes portés par chaque personne, tous métiers confondus. */
  const counts = {
    ...countBy(org, ARTISTS, "daId"),
    ...countBy(org, ARTISTS, "projectLeadId"),
    ...countBy(org, ARTISTS, "marketingId"),
    ...countBy(org, ARTISTS, "legalId"),
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (addOrgPerson(kind, name)) setName("");
  };

  return (
    <section className="hairline-t mt-4 pt-4" aria-labelledby="org-people-title">
      <h3 id="org-people-title" className="mb-2 text-sm font-semibold">
        {t("settings.people.title")}
      </h3>
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="text-muted-foreground text-[11px]">
              <th scope="col" className="py-1.5 pr-2 font-medium">{t("settings.people.name")}</th>
              <th scope="col" className="px-2 py-1.5 font-medium">{t("settings.people.kind")}</th>
              <th scope="col" className="px-2 py-1.5 font-medium">{t("settings.people.categories")}</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">{t("settings.people.artists")}</th>
            </tr>
          </thead>
          <tbody>
            {ORG_KINDS.flatMap((k) =>
              peopleOf(org, k).map((p) => {
                const cats = k === "da" ? daCategories(org, ARTISTS, p.id) : [];
                return (
                  <tr key={p.id} className="hairline-t">
                    <td className="py-1.5 pr-2">
                      {/* Validé à la sortie du champ ou par Entrée ; un nom vide reprend l'ancien. */}
                      <input
                        key={`${p.id}-${p.name}`}
                        defaultValue={p.name}
                        maxLength={40}
                        aria-label={t("settings.people.rename", { name: p.name })}
                        className={cn(FIELD_CLASS, "w-44")}
                        onBlur={(e) => {
                          renameOrgPerson(p.id, e.currentTarget.value);
                          if (!e.currentTarget.value.trim()) e.currentTarget.value = p.name;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                      />
                    </td>
                    <td className="text-muted-foreground px-2 py-1.5">{t(`kinds.${k}`)}</td>
                    <td className="text-muted-foreground px-2 py-1.5">
                      {cats.length > 0 ? cats.map((c) => tr(`category.${c}`)).join(", ") : t("settings.people.none")}
                    </td>
                    <td className="num px-2 py-1.5 text-right">
                      {t("settings.people.count", { count: counts[p.id] ?? 0 })}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={submit} className="mt-2 flex flex-wrap items-center gap-2" aria-label={t("settings.addPerson.title")}>
        <select
          className={FIELD_CLASS}
          aria-label={t("settings.addPerson.kind")}
          value={kind}
          onChange={(e) => {
            if (isOrgKind(e.target.value)) setKind(e.target.value);
          }}
        >
          {ORG_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`kinds.${k}`)}
            </option>
          ))}
        </select>
        <input
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("settings.addPerson.placeholder")}
          aria-label={t("settings.addPerson.name")}
          className={cn(FIELD_CLASS, "w-56")}
        />
        <Button type="submit" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={!name.trim()}>
          <Plus className="size-3" aria-hidden />
          {t("settings.addPerson.submit")}
        </Button>
      </form>
    </section>
  );
}

function PolesSection({ org, poleName }: { org: OrgState; poleName: (p: OrgPole) => string }) {
  const t = useTranslations("organisation");
  const [name, setName] = useState("");
  const counts = countBy(org, ARTISTS, "poleId");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (addOrgPole(name)) setName("");
  };
  return (
    <section className="hairline-t mt-4 pt-4" aria-labelledby="org-poles-title">
      <h3 id="org-poles-title" className="mb-2 text-sm font-semibold">
        {t("settings.poles.title")}
      </h3>
      <ul className="flex flex-col gap-1 text-[12.5px]">
        {org.poles.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3">
            <span>{poleName(p)}</span>
            <span className="num text-muted-foreground">{t("settings.people.count", { count: counts[p.id] ?? 0 })}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="mt-2 flex flex-wrap items-center gap-2" aria-label={t("settings.addPole.title")}>
        <input
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("settings.addPole.placeholder")}
          aria-label={t("settings.addPole.name")}
          className={cn(FIELD_CLASS, "w-64")}
        />
        <Button type="submit" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={!name.trim()}>
          <Plus className="size-3" aria-hidden />
          {t("settings.addPole.submit")}
        </Button>
      </form>
    </section>
  );
}
