"use client";

/**
 * Ordre du jour du comité : les notes non traitées, par urgence puis par service en charge
 * (feed-model, `committeeAgenda`), avec échéance, pastille, responsable et statut. Le contenu
 * seul : /fil l'ouvre en plein écran (`#fil-agenda`) et la feuille d'impression de globals.css
 * n'imprime que lui, en noir sur blanc.
 */
import { useLocale, useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";
import { dueState, statusOf, type AgendaGroup } from "@/lib/userdata/feed-model";
import { cn } from "@/lib/utils";
import { DUE_TONE, STATUS_TONE, URGENCY_TONE } from "./note-card";
import { personLabel, roleLabel, toLabel } from "./labels";

export function CommitteeAgenda({
  groups,
  today,
  houseName,
  artistName,
  onPrint,
}: {
  groups: AgendaGroup[];
  today: string;
  houseName: string;
  artistName: (id: string) => string;
  onPrint: () => void;
}) {
  const tf = useTranslations("fil");
  const tp = useTranslations("filpage");
  const locale = useLocale();
  const long = (iso: string) => fmtDate(locale, iso, { day: "numeric", month: "long", year: "numeric" });
  const count = groups.reduce((s, g) => s + g.services.reduce((x, sv) => x + sv.notes.length, 0), 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{houseName}</p>
          <h2 className="text-xl font-semibold">{tp("agenda.title")}</h2>
          <p className="text-[12px] text-muted-foreground">
            {tp("agenda.asOf", { date: long(today) })} · {tp("agenda.count", { count })}
          </p>
          <p className="mt-1 max-w-prose text-[12px] text-muted-foreground">{tp("agenda.subtitle")}</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={onPrint} data-print="hide">
          <Printer className="size-4" aria-hidden />
          {tp("agenda.print")}
        </Button>
      </header>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tp("agenda.empty")}</p>
      ) : (
        groups.map((g) => (
          <section key={g.urgency} className="agenda-group space-y-3" data-urgency={g.urgency}>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <span className={cn("agenda-pill rounded-full px-2 py-0.5 text-[12px]", URGENCY_TONE[g.urgency])}>
                {tf(`urgency.${g.urgency}`)}
              </span>
            </h3>
            {g.services.map((s) => (
              <div key={s.service} className="space-y-1.5" data-service={s.service}>
                <h4 className="text-[13px] font-semibold text-muted-foreground">
                  {s.service === "several" ? tp("agenda.several") : roleLabel(tf, s.service)}
                </h4>
                <ol className="space-y-2">
                  {s.notes.map((n) => {
                    const due = dueState(n, today);
                    const status = statusOf(n);
                    return (
                      <li key={n.id} className="agenda-item rounded-lg border p-2.5 text-[13px]">
                        <p className="leading-snug">{n.text}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
                          {n.artistId && <span className="font-medium text-foreground">{artistName(n.artistId)}</span>}
                          <span>{tf("note.from", { from: n.fromName, to: toLabel(tf, n) })}</span>
                          <span>{n.dueDate ? tp("agenda.due", { date: long(n.dueDate) }) : tp("agenda.noDue")}</span>
                          {due && (
                            <span className={cn("agenda-pill rounded-full px-1.5 font-medium", DUE_TONE[due])}>{tp(`due.${due}`)}</span>
                          )}
                          <span>
                            {n.assigneeId
                              ? tp("agenda.responsible", { name: personLabel(tf, tp, n.assigneeId) })
                              : tp("agenda.unassigned")}
                          </span>
                          <span className={cn("agenda-pill rounded-full border px-1.5", STATUS_TONE[status])}>{tp(`status.${status}`)}</span>
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
