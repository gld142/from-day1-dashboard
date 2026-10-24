"use client";

import { useTranslations } from "next-intl";
import { useFeed } from "@/lib/userdata/use-feed";

/** Notes ouvertes à traiter pour mon rôle — rien tant qu'il n'y en a pas (et rien côté serveur). */
export function FeedCount() {
  const t = useTranslations("fil");
  const { openForMe } = useFeed();
  if (openForMe === 0) return null;
  return (
    <span
      className="num ml-auto shrink-0 rounded-full bg-brand/15 px-1.5 text-[10px] font-medium leading-4 text-brand"
      aria-label={t("filters.count", { count: openForMe })}
    >
      {openForMe}
    </span>
  );
}
