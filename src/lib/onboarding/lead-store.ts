import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Lead } from "./lead";

/**
 * Stockage PROVISOIRE, local : un fichier JSON hors git (.data/leads.json).
 * Même interface que la future table Supabase `leads` — seul ce fichier changera.
 */
const FILE = path.join(process.cwd(), ".data", "leads.json");

async function readAll(): Promise<Lead[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Lead[];
  } catch {
    return [];
  }
}
async function writeAll(leads: Lead[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(leads, null, 2));
}

export async function upsertLead(id: string | undefined, patch: Partial<Lead>): Promise<Lead> {
  const leads = await readAll();
  const now = new Date().toISOString();
  const i = id ? leads.findIndex((l) => l.id === id) : -1;
  const lead: Lead =
    i >= 0
      ? { ...leads[i], ...patch, id: leads[i].id, createdAt: leads[i].createdAt, updatedAt: now }
      : { stage: "identity", ...patch, id: randomUUID(), createdAt: now, updatedAt: now };
  if (i >= 0) leads[i] = lead;
  else leads.push(lead);
  await writeAll(leads);
  return lead;
}

export async function listLeads(): Promise<Lead[]> {
  return readAll();
}
