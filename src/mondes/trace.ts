/**
 * Le tracé d'un monde, dans son propre repère : 390 de large (l'échelle `k` s'applique au
 * rendu), `y` depuis le haut de sa section. `cases[i]` est l'indice, dans `points`, de la case de
 * la i-ième année de la décennie ; `porte` celui de la porte de fin de monde. Le point 0 est
 * l'entrée de la section : la roulotte suivie en descend (`MoteurCarte`).
 */
export interface Trace {
  points: ReadonlyArray<readonly [number, number]>
  cases: readonly number[]
  porte: number
  hauteur: number
}

/** La hauteur sous laquelle une section ne descend jamais : les fondus de 500 px entre deux mondes ne se chevauchent pas. */
export const HAUTEUR_MIN_SECTION = 600

/**
 * Le tracé des années 1890, recopié de la maquette du 29 septembre 2026 (`WAY`, sept points) :
 * l'entrée au-dessus de la carte, les cases de 1895 à 1899 (points 1 à 5), la sortie vers 1900
 * (la porte). Le Voyage part de 1895 : une année antérieure n'a pas de place. 1240 de haut : la
 * vue d'ensemble garde trente pixels par année aux années 1890 (il en faut 1212 au moins avec
 * `POIDS_REPLIEE` = 220), et le fondu vers 1900 ne commence qu'à 990, sous 1899 (695).
 */
export function trace1890(annees: readonly number[]): Trace {
  const cases = annees.map((a) => a - 1894)
  if (cases.some((i) => i < 1 || i > 5)) throw new Error(`les années 1890 du Voyage vont de 1895 à 1899, reçu ${annees.join(', ')}`)
  return {
    points: [[200, -40], [105, 150], [290, 285], [120, 420], [280, 560], [130, 695], [210, 820]],
    cases,
    porte: 6,
    hauteur: 1240,
  }
}

/** Le tracé d'une décennie sans monde propre : un lacet régulier, une case tous les 170 px. */
export function traceAVenir(annees: readonly number[]): Trace {
  const points: Array<readonly [number, number]> = [[195, 40]]
  const cases: number[] = []
  annees.forEach((_, i) => {
    cases.push(points.length)
    points.push([i % 2 === 0 ? 110 : 280, 170 + i * 170])
  })
  const yPorte = 170 + annees.length * 170 + 40
  points.push([195, yPorte])
  return { points, cases, porte: points.length - 1, hauteur: Math.max(HAUTEUR_MIN_SECTION, yPorte + 110) }
}
