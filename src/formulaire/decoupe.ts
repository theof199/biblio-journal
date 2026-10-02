/**
 * Le contour d'une coupure de presse, découpée aux ciseaux : un `clip-path` dont chaque point du
 * bord est rentré de 0 à 7 px, jamais deux fois pareil. Déterministe, tiré de la graine (l'identifiant
 * de l'entrée) : la même coupure est découpée de la même façon à chaque visite, et deux coupures
 * ne se ressemblent pas. Une fonction pure, qui ne lit ni le temps ni le hasard.
 */

const RENTREE_MAX = 7

/** Une graine entière depuis un texte : FNV-1a sur 32 bits. */
function graineDe(texte: string): number {
  let hachage = 2166136261
  for (const caractere of texte) hachage = Math.imul(hachage ^ caractere.charCodeAt(0), 16777619) >>> 0
  return hachage
}

/** Les rangs d'un bord, de 0 à 100 % en `parts` pas égaux. */
const rangs = (parts: number): string[] => Array.from({ length: parts + 1 }, (_, i) => ((i / parts) * 100).toFixed(1))

export function decoupe(graine: string): string {
  let etat = graineDe(graine) * 7919 + 104729
  // Un générateur congruentiel linéaire : de quoi varier un contour, pas de quoi tirer au sort.
  const rentree = () => {
    etat = (etat * 9301 + 49297) % 233280
    return ((etat / 233280) * RENTREE_MAX).toFixed(1)
  }

  const haut = rangs(4).map((x) => `${x}% ${rentree()}px`)
  const droite = rangs(5).slice(1).map((y) => `calc(100% - ${rentree()}px) ${y}%`)
  const bas = rangs(4).slice(0, -1).reverse().map((x) => `${x}% calc(100% - ${rentree()}px)`)
  const gauche = rangs(5).slice(0, -1).reverse().slice(0, -1).map((y) => `${rentree()}px ${y}%`)
  return `polygon(${[...haut, ...droite, ...bas, ...gauche].join(', ')})`
}
