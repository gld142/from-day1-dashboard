"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
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
import { ARTISTS, PROJECTS, TRACKS } from "@/lib/demo/api";
import { EXPENSE_CATEGORIES } from "@/lib/demo/types";
import type { Expense, ExpenseCategory } from "@/lib/demo/types";

const NONE = "__none__";
/** Date du jour de la démo (jamais Date.now — hydration). */
const TODAY_ISO = "2026-07-02";

/**
 * Dialog "Ajouter une dépense" : formulaire complet en état local,
 * la dépense créée est préfixée au registre par le parent.
 */
export function AddExpenseDialog({
  isLabel,
  defaultArtistId,
  onAdd,
}: {
  isLabel: boolean;
  defaultArtistId: string;
  onAdd: (expense: Expense) => void;
}) {
  const t = useTranslations("finances.add");
  const tCat = useTranslations("finances.categories");

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(TODAY_ISO);
  const [category, setCategory] = useState<ExpenseCategory>("marketing");
  const [artistId, setArtistId] = useState(defaultArtistId);
  const [projectId, setProjectId] = useState<string>(NONE);
  const [trackId, setTrackId] = useState<string>(NONE);
  const counter = useRef(0);

  const projects = useMemo(
    () => PROJECTS.filter((p) => p.artistId === artistId),
    [artistId],
  );
  const tracks = useMemo(
    () =>
      projectId === NONE
        ? TRACKS.filter((tr) => tr.artistId === artistId)
        : TRACKS.filter((tr) => tr.projectId === projectId),
    [artistId, projectId],
  );

  const parsedAmount = Number(amount);
  const valid = label.trim().length > 0 && parsedAmount > 0 && date.length === 10;

  function reset() {
    setLabel("");
    setAmount("");
    setDate(TODAY_ISO);
    setCategory("marketing");
    setProjectId(NONE);
    setTrackId(NONE);
  }

  function submit() {
    if (!valid) return;
    counter.current += 1;
    onAdd({
      id: `manual-${artistId}-${counter.current}-${label.trim().length}`,
      artistId,
      projectId: projectId === NONE ? undefined : projectId,
      trackId: trackId === NONE ? undefined : trackId,
      category,
      label: label.trim(),
      amount: Math.round(parsedAmount),
      date,
      addedBy: "gael",
      source: "manual",
    });
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden />
          {t("cta")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <Label htmlFor="exp-label">{t("label")}</Label>
            <Input
              id="exp-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("labelPlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="exp-amount">{t("amount")}</Label>
              <Input
                id="exp-amount"
                type="number"
                min={0}
                inputMode="decimal"
                className="num"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exp-date">{t("date")}</Label>
              <Input
                id="exp-date"
                type="date"
                className="num"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>{t("category")}</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ExpenseCategory)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {tCat(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isLabel && (
              <div className="grid gap-2">
                <Label>{t("artist")}</Label>
                <Select
                  value={artistId}
                  onValueChange={(v) => {
                    setArtistId(v);
                    setProjectId(NONE);
                    setTrackId(NONE);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ARTISTS.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label className="gap-1">
                {t("project")}
                <span className="text-[11px] font-normal text-muted-foreground">
                  ({t("optional")})
                </span>
              </Label>
              <Select
                value={projectId}
                onValueChange={(v) => {
                  setProjectId(v);
                  setTrackId(NONE);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("none")}</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="gap-1">
                {t("track")}
                <span className="text-[11px] font-normal text-muted-foreground">
                  ({t("optional")})
                </span>
              </Label>
              <Select value={trackId} onValueChange={setTrackId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("none")}</SelectItem>
                  {tracks.map((tr) => (
                    <SelectItem key={tr.id} value={tr.id}>
                      {tr.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={!valid}>
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
