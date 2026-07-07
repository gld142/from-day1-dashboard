"use client";

/**
 * CTA "Uploader une démo" — Dialog de démo : dropzone factice + titre,
 * ajoute un inédit "en analyse…" au state local de la page.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AudioLines, Sparkles, UploadCloud } from "lucide-react";
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

export function UploadDemoDialog({ onAdd }: { onAdd: (title: string) => void }) {
  const t = useTranslations("discovery");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const submit = () => {
    onAdd(name.trim() || t("upload.defaultName"));
    setName("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UploadCloud className="size-4" aria-hidden />
          {t("upload.cta")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">{t("upload.title")}</DialogTitle>
          <DialogDescription>{t("upload.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-surface-2/50 px-6 py-10 text-center transition-colors hover:border-brand/50">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand">
            <AudioLines className="size-5" aria-hidden />
          </span>
          <p className="text-sm font-medium">{t("upload.dropzone")}</p>
          <p className="text-[11px] text-muted-foreground">{t("upload.formats")}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="demo-title">{t("upload.nameLabel")}</Label>
          <Input
            id="demo-title"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("upload.namePlaceholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {tc("actions.cancel")}
          </Button>
          <Button onClick={submit} className="gap-1.5">
            <Sparkles className="size-4" aria-hidden />
            {t("upload.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
