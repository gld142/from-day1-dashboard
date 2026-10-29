/**
 * La marque Day 1 (les sillons et le « 1 »), le même tracé que le site from-day1.com
 * (public/images/logos/day1-mark.svg, vectorisé depuis le fichier de Gaël). Rendue en masque CSS
 * sur `currentColor` : elle prend la couleur du texte. Rapport hauteur/largeur du tracé : 1,23.
 */
const MASK = "url(/images/logos/day1-mark.svg)";

export function LogoMark({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: Math.round(size * 1.23),
        backgroundColor: "currentColor",
        WebkitMaskImage: MASK,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",
        maskImage: MASK,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
      }}
    />
  );
}
