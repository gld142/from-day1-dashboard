/**
 * La vue du dashboard d'un client : « artist » (un artiste, son relevé) ou
 * « label » (une structure : roster en accueil, totaux, menu d'artistes).
 *
 * Décidé avec Gaël le 22/10/2026 : c'est le TYPE DÉCLARÉ À L'ACHAT qui tranche
 * (`workspaces.kind`), pas le nombre d'artistes. Un artiste invité (rôle
 * « artist ») reste toujours en vue artiste.
 */
export const WORKSPACE_KINDS = ["artist", "label", "management", "publisher", "distributor", "other"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];
export type DashboardView = "artist" | "label";
export type MemberRole = "owner" | "member" | "artist";

export const KIND_LABEL: Record<WorkspaceKind, string> = {
  artist: "Artiste",
  label: "Label",
  management: "Management",
  publisher: "Éditeur",
  distributor: "Distributeur",
  other: "Autre",
};

export function isWorkspaceKind(v: string): v is WorkspaceKind {
  return (WORKSPACE_KINDS as readonly string[]).includes(v);
}

export function viewFor(kind: WorkspaceKind, role: MemberRole): DashboardView {
  if (role === "artist") return "artist";
  return kind === "artist" ? "artist" : "label";
}
