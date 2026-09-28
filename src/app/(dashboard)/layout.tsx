import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/shell";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { customerContracts, customerRoster, customerSplits, customerView } from "@/lib/accounts/customer";
import { CustomerMode } from "@/lib/customer-mode";
import { GATE_COOKIE, isValidToken } from "@/lib/gate";
import { CUSTOMER_HOME, isCustomerPath, isStructurePath, needsStatement } from "@/lib/nav";

/**
 * Deux mondes derrière le même dashboard :
 *  - un client connecté → mode client, SES chiffres, pages branchées seulement
 *    (le roster, vue structure, pour le propriétaire et l'équipe) ;
 *  - sinon, la démo derrière le mot de passe (inchangée).
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const view = await customerView();
  if (view.kind === "blocked") redirect("/espace");

  if (view.kind === "customer") {
    const path = (await headers()).get("x-d1-path") ?? CUSTOMER_HOME;
    if (!isCustomerPath(path, view.info.role)) redirect(view.data ? CUSTOMER_HOME : "/import");
    // La vue structure et les contrats ne dépendent pas du relevé de l'artiste ouvert ; les autres pages, si.
    if (!view.data && needsStatement(path)) redirect("/import");
    const roster = isStructurePath(path) ? await customerRoster(view.info.workspaceId) : null;
    const on = (m: string) => path === m || path.startsWith(`${m}/`);
    const contracts = on("/contracts") ? await customerContracts(view.info.workspaceId) : null;
    const splits = on("/splits") ? await customerSplits(view.info.workspaceId) : null;
    return (
      <CustomerMode info={view.info} data={view.data} roster={roster} contracts={contracts} splits={splits}>
        <Shell>{children}</Shell>
      </CustomerMode>
    );
  }

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
