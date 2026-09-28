"use server";

import { deleteRow, formValues, saveRow, type RegisterFormState } from "@/lib/registers/persist";
import { parseShow } from "@/lib/registers/shows";

export async function saveShow(_: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  const raw = formValues(form);
  return saveRow("shows", parseShow(raw), raw.id, "/tour");
}

export async function deleteShow(_: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  return deleteRow("shows", String(form.get("id") ?? ""), "/tour");
}
