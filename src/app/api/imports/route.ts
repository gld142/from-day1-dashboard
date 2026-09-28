import { NextResponse, type NextRequest } from "next/server";
import { customerView } from "@/lib/accounts/customer";
import { adminDb } from "@/lib/supabase/admin";
import { validateUserData } from "@/lib/userdata/validate";

/**
 * Enregistre le relevé importé par un client, pour l'artiste ouvert dans son
 * dashboard. L'artiste et l'espace viennent de la session (RLS), jamais du corps
 * de la requête : on ne peut écrire que chez un artiste qu'on a le droit de voir.
 */
export async function POST(request: NextRequest) {
  const view = await customerView();
  if (view.kind !== "customer") return NextResponse.json({ error: "session" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { data?: unknown; fileName?: unknown } | null;
  const data = validateUserData(body?.data);
  if (!data) return NextResponse.json({ error: "format" }, { status: 400 });
  const fileName = typeof body?.fileName === "string" ? body.fileName.slice(0, 200) : null;

  const { error } = await adminDb().from("artist_imports").insert({
    workspace_id: view.info.workspaceId,
    artist_id: view.info.artistId,
    created_by: view.info.userId,
    file_name: fileName,
    data: { ...data, artistName: view.info.artistName },
  });
  if (error) {
    console.error("[api/imports]", error);
    return NextResponse.json({ error: "store" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
