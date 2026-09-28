const PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

/** « AAAA-MM-JJ » du jour à Paris (un passage à 01h30 appartient au jour qui commence). */
export const parisDate = (d: Date): string => PARIS.format(d);
