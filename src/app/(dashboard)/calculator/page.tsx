import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations("nav");

  return (
    <div className="rise-in">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        {t("items.calculator")}
      </h1>
      <div className="mt-6 flex h-64 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        …
      </div>
    </div>
  );
}
