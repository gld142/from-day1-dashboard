"use server";

import { parsePlacement } from "@/lib/registers/placements";
import { deleteRow, formValues, saveRow, type RegisterFormState } from "@/lib/registers/persist";

export async function savePlacement(_: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  const raw = formValues(form);
  const roles = form.getAll("roles").map(String);
  return saveRow("placements", parsePlacement(raw, roles), raw.id, "/placements");
}

export async function deletePlacement(_: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  return deleteRow("placements", String(form.get("id") ?? ""), "/placements");
}
