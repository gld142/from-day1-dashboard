/**
 * Recherche d'un nom d'artiste dans un texte, pour les tests « une maison ne nomme jamais un
 * artiste qu'elle exclut » (roster-data.test.ts, excluded-artists.test.ts). Pas un test : un outil
 * de test (vitest ne lit que `*.test.ts`).
 *
 * Pas de RegExp : le nom y entrait sans échappement (un nom est une donnée, pas un motif — « a(b »
 * lève une SyntaxError), et `\b` ne voit pas « Kiko_x » (`_` est un caractère de mot). Mesuré le
 * 24/10/2026 : `\bKiko\b` ratait « Kiko_x » et « Kikó ». Casse et accents sont repliés des DEUX
 * côtés (NFD, puis retrait des diacritiques combinants), puis `includes`.
 */
export function foldForSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** `text` nomme-t-il `name`, à la casse et aux accents près ? */
export function mentionsName(text: string, name: string): boolean {
  return foldForSearch(text).includes(foldForSearch(name));
}
