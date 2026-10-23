import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/shell";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import {
  customerContracts,
  customerFinances,
  customerLabelStatement,
  customerPlacements,
  customerRights,
  customerRoster,
  customerShows,
  customerSignals,
  customerSplits,
  customerSync,
  customerView,
} from "@/lib/accounts/customer";
import { CustomerMode } from "@/lib/customer-mode";
import { demoEnabled } from "@/lib/demo-mode";
import { GATE_COOKIE, isValidToken } from "@/lib/gate";
import { customerHome, isCustomerPath, isStructurePath, needsStatement } from "@/lib/nav";

/**
 * Deux mondes derrière le même dashboard :
 *  - un client connecté → mode client, SES chiffres, pages branchées seulement
 *    (le roster, vue structure, pour le propriétaire et l'équipe) ;
 *  - sinon, la démo derrière le mot de passe — SEULEMENT si DEMO_MODE=on
 *    (éteinte par défaut dans le produit : sinon, la connexion client).
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const view = await customerView();
  if (view.kind === "blocked") redirect("/espace");

  if (view.kind === "customer") {
    const home = customerHome(view.info.view);
    const path = (await headers()).get("x-d1-path") ?? home;
    if (!isCustomerPath(path, view.info.role)) redirect(view.data ? home : "/import");
    // La vue structure et les contrats ne dépendent pas du relevé de l'artiste ouvert ; les autres pages, si.
    if (!view.data && needsStatement(path)) redirect("/import");
    const on = (m: string) => path === m || path.startsWith(`${m}/`);
    // Le Day 1 Index compare les artistes du roster : leurs relevés et leurs revenus saisis.
    // Les contrats croisent aussi les relevés (recoupement calculé, revenus exposés à une fin de contrat).
    const roster = isStructurePath(path) || on("/day1-index") || on("/contracts") ? await customerRoster(view.info.workspaceId) : null;
    const contracts = on("/contracts") ? await customerContracts(view.info.workspaceId) : null;
    const splits = on("/splits") || on("/catalog") ? await customerSplits(view.info.workspaceId) : null;
    const rights = on("/rights") ? await customerRights(view.info.workspaceId) : null;
    // Dépenses aussi sur /tour : la marge de tournée retranche les frais « tournée ».
    const finances = on("/finances") || on("/day1-index") || on("/tour") ? await customerFinances(view.info.workspaceId) : null;
    // Marché & signaux : seulement ce que la page lit.
    const signalsNeeds = on("/pulse")
      ? { charts: true, tiktok: true, wiki: true }
      : on("/market")
        ? { charts: true }
        : on("/audience")
          ? { tiktok: true, wiki: true }
          : on("/ar-watch")
            ? { charts: true, watchlist: true, wiki: true }
            : on("/algo-position") || on("/discovery") || on("/day1-index")
              ? {}
              : null;
    const signals = signalsNeeds ? await customerSignals(view.info.workspaceId, signalsNeeds) : null;
    const ws = view.info.workspaceId;
    // Vue label : le relevé virtuel de l'espace pour « Tout le label » (Revenus, Streams).
    const label = view.info.view === "label" && (on("/revenue") || on("/streams")) ? await customerLabelStatement(ws, view.info.workspaceName) : null;
    const registers = {
      ...(on("/tour") ? { shows: await customerShows(ws) } : {}),
      ...(on("/placements") ? { placements: await customerPlacements(ws) } : {}),
      ...(on("/sync") ? { sync: await customerSync(ws) } : {}),
    };
    return (
      <CustomerMode info={view.info} data={view.data} roster={roster} contracts={contracts} splits={splits} rights={rights} finances={finances} registers={registers} signals={signals} label={label}>
        <Shell>{children}</Shell>
      </CustomerMode>
    );
  }

  if (!demoEnabled()) redirect("/connexion");
  if (!(await isValidToken((await cookies()).get(GATE_COOKIE)?.value))) redirect("/acces");
  return <Shell>{children}</Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </DashboardShell>
  );
}
