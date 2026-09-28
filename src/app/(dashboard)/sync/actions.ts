"use server";

import { deleteRow, formValues, saveRow, type RegisterFormState } from "@/lib/registers/persist";
import { parseSync } from "@/lib/registers/sync";

export async function saveSync(_: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  const raw = formValues(form);
  return saveRow("sync_licenses", parseSync(raw, new Date().toISOString().slice(0, 10)), raw.id, "/sync");
}

export async function deleteSync(_: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  return deleteRow("sync_licenses", String(form.get("id") ?? ""), "/sync");
}
