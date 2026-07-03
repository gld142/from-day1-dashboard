"use client";

/**
 * Tableau des membres : identité, rôle, périmètre artistes (pile d'avatars),
 * modules accessibles et dernière activité. Les invitations de session
 * apparaissent en fin de liste, marquées "en attente".
 */
import { useLocale, useTranslations } from "next-intl";
import { ArtistAvatar } from "@/components/dashboard/artist-badge";
import type { PendingInvite } from "@/components/modules/structure/invite-dialog";
import { TeamAvatar } from "@/components/modules/structure/team-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getArtist } from "@/lib/demo/api";
import type { TeamMember } from "@/lib/demo/types";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const ROLE_TONE: Record<TeamMember["role"], string> = {
  owner: "bg-brand/10 text-brand",
  manager: "bg-success/10 text-success",
  marketing: "bg-warning/10 text-warning",
  comptable: "bg-muted text-muted-foreground",
  avocat: "bg-muted text-muted-foreground",
};

function ArtistStack({ ids }: { ids: string[] }) {
  return (
    <span className="flex -space-x-1.5">
      {ids.map((id) => {
        const a = getArtist(id);
        return (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <span className="rounded-full ring-2 ring-card">
                <ArtistAvatar artist={a} size="sm" />
              </span>
            </TooltipTrigger>
            <TooltipContent>{a.name}</TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}

export function TeamTable({
  members,
  pending,
  hint,
}: {
  members: TeamMember[];
  pending: PendingInvite[];
  hint?: string;
}) {
  const t = useTranslations("team");
  const tNav = useTranslations("nav");
  const locale = useLocale();

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-2 pt-5">
        <h2 className="text-sm font-semibold">{t("table.title")}</h2>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">{t("table.member")}</TableHead>
              <TableHead>{t("table.role")}</TableHead>
              <TableHead>{t("table.artists")}</TableHead>
              <TableHead>{t("table.modules")}</TableHead>
              <TableHead className="pr-5 text-right">
                {t("table.lastActive")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="pl-5">
                  <span className="flex items-center gap-2.5">
                    <TeamAvatar name={m.name} />
                    <span className="text-sm font-medium">{m.name}</span>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge className={cn("border-transparent", ROLE_TONE[m.role])}>
                    {t(`roles.${m.role}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {m.artistAccess === "all" ? (
                    <Badge variant="outline">{t("table.allArtists")}</Badge>
                  ) : (
                    <ArtistStack ids={m.artistAccess} />
                  )}
                </TableCell>
                <TableCell>
                  {m.modules === "all" ? (
                    <Badge variant="outline">{t("table.allModules")}</Badge>
                  ) : (
                    <span className="flex max-w-72 flex-wrap gap-1">
                      {m.modules.map((mod) => (
                        <Badge key={mod} variant="secondary">
                          {tNav(`items.${mod}`)}
                        </Badge>
                      ))}
                    </span>
                  )}
                </TableCell>
                <TableCell className="num pr-5 text-right text-muted-foreground">
                  {fmtDate(locale, m.lastActive)}
                </TableCell>
              </TableRow>
            ))}

            {pending.map((p, i) => (
              <TableRow key={`pending-${i}`} className="opacity-70">
                <TableCell className="pl-5">
                  <span className="flex items-center gap-2.5">
                    <TeamAvatar name={p.email} />
                    <span className="text-sm font-medium">{p.email}</span>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge className={cn("border-transparent", ROLE_TONE[p.role])}>
                    {t(`roles.${p.role}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {p.artistAccess === "all" ? (
                    <Badge variant="outline">{t("table.allArtists")}</Badge>
                  ) : (
                    <ArtistStack ids={p.artistAccess} />
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="ghost" className="text-warning">
                    {t("table.pending")}
                  </Badge>
                </TableCell>
                <TableCell className="num pr-5 text-right text-muted-foreground">
                  —
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
