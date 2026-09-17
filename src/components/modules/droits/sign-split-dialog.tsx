"use client";

/**
 * Dialog « Signer le partage » : pad de signature (souris / doigt) ou nom
 * tapé (clavier), puis confirmation. La signature est enregistrée dans le
 * store local (localStorage) — rien ne quitte l'appareil.
 */
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Eraser, PenLine } from "lucide-react";
import type { Track } from "@/lib/demo/types";
import { saveSignature } from "@/lib/userdata/signatures-store";
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
import { SignaturePad, type SignaturePadHandle } from "@/components/ui/signature-pad";

export function SignSplitDialog({ track }: { track: Track }) {
  const t = useTranslations("splits.sign");
  const pad = useRef<SignaturePadHandle>(null);
  const [open, setOpen] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [typed, setTyped] = useState("");

  const reset = () => {
    setHasInk(false);
    setTyped("");
  };

  const confirm = () => {
    const dataUrl = pad.current?.toDataUrl();
    if (!dataUrl) return;
    saveSignature({ trackId: track.id, dataUrl });
    setOpen(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <PenLine aria-hidden />
          {t("cta")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { track: track.title })}</DialogTitle>
          <DialogDescription>{t("hint")}</DialogDescription>
        </DialogHeader>

        {/* Le pad : encre à la couleur de la marque, ligne de base en pointillés. */}
        <div className="relative h-40 rounded-lg border border-dashed bg-surface-2/40 text-brand">
          <SignaturePad
            ref={pad}
            aria-label={t("pad")}
            onInkChange={setHasInk}
            onDrawStart={() => setTyped("")}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-6 bottom-8 border-t border-dashed border-foreground/15"
          />
        </div>

        {/* Alternative clavier : le nom tapé est rendu en cursive sur le pad. */}
        <Input
          value={typed}
          placeholder={t("typed")}
          aria-label={t("typed")}
          autoComplete="off"
          onChange={(e) => {
            setTyped(e.target.value);
            pad.current?.setText(e.target.value);
          }}
        />

        <DialogFooter>
          <Button
            variant="ghost"
            disabled={!hasInk}
            onClick={() => {
              pad.current?.clear();
              setTyped("");
            }}
          >
            <Eraser aria-hidden />
            {t("clear")}
          </Button>
          <Button disabled={!hasInk} onClick={confirm}>
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
