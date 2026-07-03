import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Sunrise } from "lucide-react";

export default async function NotFound() {
  const t = await getTranslations("common");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background text-foreground">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand/15 text-brand">
        <Sunrise className="size-6" aria-hidden />
      </span>
      <p className="num text-5xl font-semibold tracking-tight">404</p>
      <p className="text-sm text-muted-foreground">{t("states.empty")}</p>
      <Link
        href="/pulse"
        className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        {t("app.name")} — {t("app.tagline")}
      </Link>
    </div>
  );
}
