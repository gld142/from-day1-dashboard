/**
 * xlsx-lite : un .xlsx fabriqué en mémoire (zip écrit à la main, xlsx-fixture.ts) puis relu.
 * Couvre : la feuille désignée par workbook.xml (pas forcément sheet1.xml, et jamais une feuille
 * masquée), chaînes partagées riches et entités, chaînes en ligne, nombres à 15 chiffres, cases et
 * lignes vides par leur référence, dates par leur style, booléens, entrée stockée sans compression,
 * préfixes d'espace de noms, et le repli sur sheet1.xml sans workbook.xml.
 */
import { describe, expect, it } from "vitest";
import { excelSerialToIso, readXlsx, rowsToCsv, XlsxError } from "../xlsx-lite";
import { buildZip, xlsxFromRows } from "./xlsx-fixture";

const NS = `xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`;

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook ${NS}><workbookPr/><sheets>
  <sheet name="Brouillon" sheetId="1" state="hidden" r:id="rId1"/>
  <sheet name="Relevé" sheetId="2" r:id="rId2"/>
</sheets></workbook>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet2.xml"/>
</Relationships>`;

const SHARED = `<?xml version="1.0" encoding="UTF-8"?>
<sst ${NS} count="4" uniqueCount="4">
  <si><t>Titre</t></si>
  <si><r><rPr><b/></rPr><t>GHAL</t></r><r><t xml:space="preserve">AT &amp; co</t></r><rPh sb="0" eb="1"><t>ゴ</t></rPh></si>
  <si><t>Mois</t></si>
  <si><t>Montant_x000D_ net</t></si>
</sst>`;

/* Style 0 : standard ; 1 : date intégrée (14) ; 2 : date personnalisée « mmm yyyy » ; 3 : pourcentage. */
const STYLES = `<?xml version="1.0" encoding="UTF-8"?>
<styleSheet ${NS}>
  <numFmts count="2"><numFmt numFmtId="164" formatCode="mmm\\ yyyy"/><numFmt numFmtId="165" formatCode="#,##0.00\\ &quot;€&quot;"/></numFmts>
  <cellXfs count="5"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="10"/><xf numFmtId="165"/></cellXfs>
</styleSheet>`;

const SHEET2 = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet ${NS}><sheetData>
  <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>
  <row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="inlineStr"><is><t>en ligne</t></is></c><c r="C2" s="1"><v>46204</v></c><c r="D2" s="4"><v>45.689999999999998</v></c></row>
  <row r="4" spans="1:4"><c r="A4" t="b"><v>1</v></c><c r="C4" s="2"><v>46235</v></c><c r="D4" s="3"><v>0.125</v></c><c r="E4"/></row>
</sheetData></worksheet>`;

const SHEET1_DECOY = `<?xml version="1.0" encoding="UTF-8"?><worksheet ${NS}><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>BROUILLON</t></is></c></row></sheetData></worksheet>`;

describe("readXlsx", () => {
  it("lit la première feuille VISIBLE de workbook.xml, cellule par cellule", async () => {
    const bytes = await buildZip([
      { name: "[Content_Types].xml", text: "<Types/>" },
      { name: "xl/workbook.xml", text: WORKBOOK },
      { name: "xl/_rels/workbook.xml.rels", text: RELS },
      { name: "xl/sharedStrings.xml", text: SHARED, store: true }, // entrée stockée, sans compression
      { name: "xl/styles.xml", text: STYLES },
      { name: "xl/worksheets/sheet1.xml", text: SHEET1_DECOY },
      { name: "xl/worksheets/sheet2.xml", text: SHEET2 },
    ]);
    const rows = await readXlsx(bytes);
    expect(rows).toEqual([
      ["Titre", "", "Mois", "Montant\r net"],
      ["GHALAT & co", "en ligne", "2026-07-01", "45.69"],
      [],
      ["TRUE", "", "2026-08-01", "0.125"],
    ]);
  });

  it("préfixes d'espace de noms (OpenXML SDK) et repli sur sheet1.xml sans workbook.xml", async () => {
    const sheet = `<?xml version="1.0"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData>
      <x:row><x:c t="inlineStr"><x:is><x:t>a</x:t></x:is></x:c><x:c><x:v>2</x:v></x:c></x:row>
      <x:row><x:c t="str"><x:v>formule</x:v></x:c></x:row>
    </x:sheetData></x:worksheet>`;
    const rows = await readXlsx(await buildZip([{ name: "xl/worksheets/sheet1.xml", text: sheet }]));
    expect(rows).toEqual([["a", "2"], ["formule"]]);
  });

  it("aller-retour avec la fabrique de lignes (cases vides comprises)", async () => {
    const rows = await readXlsx(await xlsxFromRows([["Plateforme", "Montant"], ["Deezer", 1234.5], [null, 7]]));
    expect(rows).toEqual([["Plateforme", "Montant"], ["Deezer", "1234.5"], ["", "7"]]);
  });

  it("refuse ce qui n'est pas un zip, avec un code stable", async () => {
    await expect(readXlsx(new TextEncoder().encode("Titre;Montant\nA;1"))).rejects.toMatchObject({ code: "NOT_ZIP" });
    await expect(readXlsx(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]))).rejects.toBeInstanceOf(XlsxError);
  });

  it("numéros de série Excel → dates (1900 et 1904)", () => {
    expect(excelSerialToIso(46204)).toBe("2026-07-01");
    expect(excelSerialToIso(61)).toBe("1900-03-01");
    expect(excelSerialToIso(46204 - 1462, true)).toBe("2026-07-01");
  });
});

describe("rowsToCsv", () => {
  it("met entre guillemets ce qui contient une virgule, un guillemet ou un retour à la ligne", () => {
    expect(rowsToCsv([["a", "b,c", 'd"e'], ["x\ny"], []])).toBe('a,"b,c","d""e"\n"x\ny"\n');
  });
});
