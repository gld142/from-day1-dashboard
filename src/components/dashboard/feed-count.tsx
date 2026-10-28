"use client";

import { useTranslations } from "next-intl";
import { useFeed } from "@/lib/userdata/use-feed";
import { useFeedSeen } from "@/lib/userdata/use-feed-seen";

/**
 * Barre latérale, « Fil entre services » : les notes ouvertes à traiter pour mon rôle, et en
 * rouge ce qu'un autre service a écrit depuis mon dernier passage (« +2 »). Rien tant qu'il n'y
 * a rien (et rien côté serveur).
 */
export function FeedCount() {
  const t = useTranslations("fil");
  const { notes, forMe, openForMe } = useFeed();
  const { unread } = useFeedSeen(notes);
  const fresh = forMe.reduce((s, n) => s + unread(n), 0);
  if (openForMe === 0 && fresh === 0) return null;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1">
      {fresh > 0 && (
        <span className="bg-destructive rounded-full px-1.5 text-[10px] leading-4 font-semibold text-white tabular-nums">
          +{fresh}
        </span>
      )}
      {openForMe > 0 && (
        <span
          className="num bg-brand/15 text-brand rounded-full px-1.5 text-[10px] leading-4 font-medium"
          aria-label={t("filters.count", { count: openForMe })}
        >
          {openForMe}
        </span>
      )}
    </span>
  );
}
