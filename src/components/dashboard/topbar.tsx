"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Briefcase,
  Building2,
  Check,
  ChevronsUpDown,
  Languages,
  MicVocal,
  Moon,
  Sun,
  Sunrise,
  Users,
} from "lucide-react";
import { setLocale } from "@/i18n/actions";
import type { Locale } from "@/i18n/config";
import { ARTISTS, LABEL, getArtist } from "@/lib/demo/api";
import { DAS, getDa } from "@/lib/demo/data";
import { scopedArtists } from "@/lib/demo/scope";
import Link from "next/link";
import { useCustomer } from "@/lib/customer-mode";
import { initialsOf, rosterHue } from "@/lib/format";
import { DEMO_ARTIST_ID, useRole } from "@/lib/role";
import { JOB_ROLES, roleLanding, type JobRole } from "@/lib/roles";
import { TENANT } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArtistAvatar } from "@/components/dashboard/artist-badge";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { DailyBrief } from "@/components/dashboard/daily-brief";

const THEME_META = [
  { id: "night", icon: Moon },
  { id: "dawn", icon: Sunrise },
  { id: "day", icon: Sun },
] as const;

/** Aucune source externe à écouter : l'abonnement est un no-op stable. */
const subscribeNever = () => () => {};

export function Topbar() {
  const t = useTranslations("common");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const {
    persona,
    artistId,
    setPersona,
    focusedArtistId,
    setFocusedArtistId,
    isLabel,
    jobRole,
    daId,
    scopeDaId,
    setJobRole,
  } = useRole();
  const tr = useTranslations("roster");
  const router = useRouter();
  /* Choisir un métier : l'état de rôle change ET on part sur la page d'arrivée du rôle (le DA : son roster filtré). */
  const pickRole = (role: JobRole, nextDaId: string | null) => {
    setJobRole(role, nextDaId);
    router.push(roleLanding(role, nextDaId));
  };
  const da = daId ? getDa(daId) : null;
  const roleTitle = jobRole
    ? `${t(`roles.job.${jobRole}`)}${jobRole === "da" && da ? ` · ${da.name}` : ""}`
    : null;
  /* En vue structure, la liste d'artistes du menu suit le périmètre du rôle (le DA ne voit que les siens). */
  const menuArtists = scopeDaId ? scopedArtists({ daId: scopeDaId }) : ARTISTS;
  const [, startTransition] = useTransition();
  const customer = useCustomer();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = search ? `${pathname}?${search}` : pathname;
  const showArtistMenu = customer !== null && (customer.view === "label" || customer.artists.length > 1);
  /* « Suis-je côté client ? » — next-themes ne connaît le thème qu'après
     hydratation. `useSyncExternalStore` le dit sans setState dans un effet,
     qui forcerait un second rendu en cascade. Même solution que /settings. */
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  const focused = focusedArtistId ? getArtist(focusedArtistId) : null;
  const artist = getArtist(persona === "artist" ? artistId : DEMO_ARTIST_ID);
  /* Client réel : l'avatar vient de l'artiste OUVERT (nom, rang dans l'espace), jamais d'un artiste de démo —
     sans relevé importé, `getArtist` retombe sur le premier artiste de démo (ses initiales, sa couleur). */
  const customerAvatar = customer
    ? {
        name: customer.artistName,
        initials: initialsOf(customer.artistName),
        hue: rosterHue(customer.artists.findIndex((a) => a.id === customer.artistId)),
      }
    : null;

  return (
    <header className="hairline-b sticky top-0 z-30 flex h-14 items-center gap-2 bg-background/80 px-4 backdrop-blur-md">
      <MobileNav />
      {customer && !showArtistMenu ? (
        // Artiste invité, ou artiste seul : identité fixée.
        <div className="flex min-w-0 shrink items-center gap-2 px-2">
          <ArtistAvatar artist={customerAvatar ?? artist} size="sm" />
          <span className="truncate text-sm font-medium">{customer.artistName}</span>
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">· {customer.workspaceName}</span>
        </div>
      ) : customer ? (
        // Structure : changer d'artiste sans quitter la page (le cookie d'artiste ouvert est posé par /espace/ouvrir).
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 min-w-0 shrink gap-2 px-2">
              <span className="sr-only">Changer d&apos;artiste : </span>
              <ArtistAvatar artist={customerAvatar ?? artist} size="sm" />
              <span className="truncate text-sm font-medium">{customer.artistName}</span>
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">· {customer.workspaceName}</span>
              <ChevronsUpDown className="size-3.5 text-muted-foreground" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Artistes de {customer.workspaceName}
            </DropdownMenuLabel>
            {customer.artists.map((a) => (
              <DropdownMenuItem key={a.id} asChild className="gap-2">
                <a
                  href={`/espace/ouvrir/${a.id}?vers=${encodeURIComponent(here)}`}
                  aria-current={a.id === customer.artistId ? "true" : undefined}
                >
                  <span className="flex-1 truncate text-sm">{a.name}</span>
                  {a.id === customer.artistId && <Check className="size-4 text-brand" aria-hidden />}
                </a>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2">
              <Link href="/espace">
                <Users className="size-4 text-muted-foreground" aria-hidden />
                <span className="flex-1 text-sm">Gérer les artistes et l&apos;équipe</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        // Sélecteur d'identité : qui suis-je / qui je regarde
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {/* Seul élément compressible de la topbar : sur mobile, le nom
                (« Day 1 Dashboard Pro ») se tronque au lieu de faire déborder la page. */}
            <Button variant="ghost" className="h-9 min-w-0 shrink gap-2 px-2">
              {persona === "artist" ? (
                <>
                  <ArtistAvatar artist={artist} size="sm" />
                  <span className="truncate text-sm font-medium">{artist.name}</span>
                </>
              ) : (
                <>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand/15 text-brand">
                    <Building2 className="size-3.5" aria-hidden />
                  </span>
                  <span className="truncate text-sm font-medium">
                    {focused ? focused.name : (roleTitle ?? LABEL.name)}
                  </span>
                </>
              )}
              <ChevronsUpDown className="size-3.5 text-muted-foreground" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {TENANT.roles ? (
              /* Maison à rôles : on choisit un métier, pas une persona (la persona reste « structure »). */
              <>
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("roles.jobTitle")}
                </DropdownMenuLabel>
                {JOB_ROLES.filter((r) => r !== "da").map((r) => (
                  <DropdownMenuItem key={r} onClick={() => pickRole(r, null)} className="gap-2">
                    <Briefcase className="size-4" aria-hidden />
                    <span className="flex-1">{t(`roles.job.${r}`)}</span>
                    {jobRole === r && <Check className="size-4 text-brand" aria-hidden />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("roles.chooseDa")}
                </DropdownMenuLabel>
                {DAS.map((d) => (
                  <DropdownMenuItem key={d.id} onClick={() => pickRole("da", d.id)} className="gap-2">
                    <span className="flex size-5 items-center justify-center rounded bg-brand/15 text-[10px] font-semibold text-brand">
                      {d.name[0]}
                    </span>
                    <span className="flex-1 text-sm">
                      {d.name} <span className="text-muted-foreground">· {tr(`category.${d.category}`)}</span>
                    </span>
                    {jobRole === "da" && daId === d.id && <Check className="size-4 text-brand" aria-hidden />}
                  </DropdownMenuItem>
                ))}
              </>
            ) : (
              <>
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("roles.artist")} / {t("roles.label")}
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setPersona("artist")} className="gap-2">
                  <MicVocal className="size-4" aria-hidden />
                  <span className="flex-1">{t("roles.switchTo", { role: t("roles.artist") })}</span>
                  {persona === "artist" && <Check className="size-4 text-brand" aria-hidden />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPersona("label")} className="gap-2">
                  <Building2 className="size-4" aria-hidden />
                  <span className="flex-1">{t("roles.switchTo", { role: t("roles.label") })}</span>
                  {persona === "label" && <Check className="size-4 text-brand" aria-hidden />}
                </DropdownMenuItem>
              </>
            )}
            {isLabel && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {LABEL.name}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setFocusedArtistId(null)}
                  className="gap-2"
                >
                  <span className="flex size-5 items-center justify-center rounded bg-brand/15 text-brand">
                    <Building2 className="size-3" aria-hidden />
                  </span>
                  <span className="flex-1 text-sm">{LABEL.name}</span>
                  {!focusedArtistId && <Check className="size-4 text-brand" aria-hidden />}
                </DropdownMenuItem>
                {menuArtists.map((a) => (
                  <DropdownMenuItem
                    key={a.id}
                    onClick={() => setFocusedArtistId(a.id)}
                    className="gap-2"
                  >
                    <ArtistAvatar artist={a} size="sm" />
                    <span className="flex-1 text-sm">{a.name}</span>
                    {focusedArtistId === a.id && (
                      <Check className="size-4 text-brand" aria-hidden />
                    )}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {customer ? (
        <Link href="/espace" className="text-xs text-muted-foreground hover:text-foreground">Mon espace</Link>
      ) : (
        <Badge
          variant="outline"
          className="hidden rounded-full border-warning/50 text-[10px] uppercase tracking-wider text-warning sm:inline-flex"
        >
          {t("app.demo")}
        </Badge>
      )}

      <div className="ml-auto flex items-center gap-2">
        <CommandPalette />
        {/* Le brief du jour se lit depuis N'IMPORTE QUELLE page. Retiré le
            23/09 au motif qu'il doublait Pulse, il ne le double que si l'on
            est déjà sur Pulse : depuis /contracts ou /rights, c'est le seul
            accès à l'essentiel du jour. Pas en mode client : il raisonne en
            « hier / ce mois-ci » et renvoie vers des pages fermées — mesuré le
            28/09 sur un relevé mensuel : « Streams hier 0 », date de la démo. */}
        {!customer && <DailyBrief />}
        {/* Ambiance : nuit / aube / jour */}
        <div
          className="flex items-center rounded-full border p-0.5"
          role="radiogroup"
          aria-label={t("themes.switch")}
        >
          {THEME_META.map(({ id, icon: Icon }) => {
            const active = mounted && theme === id;
            return (
              <button
                key={id}
                role="radio"
                aria-checked={active}
                title={t(`themes.${id}`)}
                onClick={() => setTheme(id)}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full transition-colors",
                  active
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
              </button>
            );
          })}
        </div>

        {/* Langue — pas pour un client : ses pages ne sont qu'en français pour
            l'instant ; changer de langue ne traduirait que le menu. */}
        {!customer && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs font-medium uppercase"
              aria-label={t("locale.switch")}
            >
              <Languages className="size-4" aria-hidden />
              {locale}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(["fr", "en"] as Locale[]).map((l) => (
              <DropdownMenuItem
                key={l}
                onClick={() => startTransition(() => setLocale(l))}
                className="gap-2"
              >
                <span className="flex-1">{t(`locale.${l}`)}</span>
                {locale === l && <Check className="size-4 text-brand" aria-hidden />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>
    </header>
  );
}
