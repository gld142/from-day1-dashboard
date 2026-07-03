"use client";

/**
 * Invitation d'un membre — flux 100 % local (state de session) :
 * email + rôle + périmètre artistes, puis confirmation et remontée
 * d'une "invitation en attente" à la page parente.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { MailPlus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ARTISTS } from "@/lib/demo/api";
import type { TeamMember } from "@/lib/demo/types";

const ALL = "__all__";

export type PendingInvite = {
  email: string;
  role: TeamMember["role"];
  artistAccess: string[] | "all";
};

const INVITABLE_ROLES: TeamMember["role"][] = [
  "manager",
  "marketing",
  "comptable",
  "avocat",
];

export function InviteDialog({
  onInvite,
}: {
  onInvite: (invite: PendingInvite) => void;
}) {
  const t = useTranslations("team");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamMember["role"]>("manager");
  const [access, setAccess] = useState<string>(ALL);

  function submit() {
    if (!email.trim()) return;
    onInvite({
      email: email.trim(),
      role,
      artistAccess: access === ALL ? "all" : [access],
    });
    setEmail("");
    setRole("manager");
    setAccess(ALL);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <MailPlus aria-hidden />
          {t("invite.cta")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("invite.title")}</DialogTitle>
          <DialogDescription>{t("invite.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">{t("invite.email")}</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("invite.emailPlaceholder")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("invite.role")}</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as TeamMember["role"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`roles.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("invite.access")}</Label>
              <Select value={access} onValueChange={setAccess}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("invite.allArtists")}</SelectItem>
                  {ARTISTS.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={!email.trim()} className="gap-1.5">
            <Send aria-hidden />
            {t("invite.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
