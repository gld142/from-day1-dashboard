import { describe, expect, it } from "vitest";
import { eurHT, quoteFor } from "../pricing";

const during = new Date("2026-10-01T12:00:00+02:00");
const after = new Date("2027-02-01T00:00:01+01:00");

describe("quoteFor", () => {
  it("1 artiste pendant le lancement : 99 €", () => {
    expect(quoteFor(1, during)).toMatchObject({ kind: "price", monthly: 99, launch: true });
  });
  it("chaque artiste de plus : 39 €", () => {
    expect(quoteFor(3, during)).toMatchObject({ monthly: 177 });
    expect(quoteFor(10, during)).toMatchObject({ monthly: 450 });
  });
  it("après le 31/01/2027 : base à 149 €", () => {
    expect(quoteFor(1, after)).toMatchObject({ monthly: 149, launch: false });
    expect(quoteFor(3, after)).toMatchObject({ monthly: 227 });
  });
  it("15 artistes : prix ; 16 : sur devis", () => {
    expect(quoteFor(15, during)).toMatchObject({ kind: "price", monthly: 99 + 14 * 39 });
    expect(quoteFor(16, during)).toEqual({ kind: "quote", artists: 16 });
  });
  it("0 ou négatif compte comme 1 artiste", () => {
    expect(quoteFor(0, during)).toMatchObject({ artists: 1, monthly: 99 });
  });
});

describe("eurHT", () => {
  it("affiche les montants de la grille hors taxes", () => {
    expect(eurHT(99)).toBe("99\u00a0€\u00a0HT");
    expect(eurHT(39)).toBe("39\u00a0€\u00a0HT");
  });
});
