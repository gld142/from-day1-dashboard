import { describe, expect, it } from "vitest";
import { escapeCsvValue, round2, toCsv } from "@/lib/export";

type Row = { label: string; amount: number | null };

const COLUMNS = [
  { header: "Libellé", cell: (r: Row) => r.label },
  { header: "Montant", cell: (r: Row) => r.amount },
];

describe("escapeCsvValue", () => {
  it("renvoie une chaîne vide pour null/undefined", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
  });

  it("formate les nombres avec virgule décimale (Excel FR)", () => {
    expect(escapeCsvValue(1234.56)).toBe("1234,56");
    expect(escapeCsvValue(42)).toBe("42");
    expect(escapeCsvValue(-3.5)).toBe("-3,5");
  });

  it("échappe séparateur, guillemets et retours ligne", () => {
    expect(escapeCsvValue("mix ; mastering")).toBe('"mix ; mastering"');
    expect(escapeCsvValue('clip "Nuit"')).toBe('"clip ""Nuit"""');
    expect(escapeCsvValue("ligne 1\nligne 2")).toBe('"ligne 1\nligne 2"');
    expect(escapeCsvValue(" bord ")).toBe('" bord "');
  });

  it("laisse intactes les valeurs simples", () => {
    expect(escapeCsvValue("Studio")).toBe("Studio");
  });
});

describe("toCsv", () => {
  const rows: Row[] = [
    { label: "Mix EP", amount: 1200.5 },
    { label: "Clip ; tournage", amount: null },
  ];

  it("préfixe un BOM UTF-8 pour Excel", () => {
    expect(toCsv(rows, COLUMNS).charCodeAt(0)).toBe(0xfeff);
  });

  it("joint en-têtes et lignes avec ; et CRLF", () => {
    const csv = toCsv(rows, COLUMNS).slice(1); // sans BOM
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Libellé;Montant");
    expect(lines[1]).toBe("Mix EP;1200,5");
    expect(lines[2]).toBe('"Clip ; tournage";');
    expect(lines[3]).toBe(""); // fin de fichier = CRLF final
  });

  it("gère un tableau vide (en-têtes seuls)", () => {
    const csv = toCsv([] as Row[], COLUMNS).slice(1);
    expect(csv).toBe("Libellé;Montant\r\n");
  });
});

describe("round2", () => {
  it("arrondit au centime", () => {
    expect(round2(1234.5678)).toBe(1234.57);
    expect(round2(16.3 * 3)).toBe(48.9);
    expect(round2(100)).toBe(100);
  });
});
