import type { Trace } from '../mondes/trace'

export interface CasePlacee {
  annee: number
  /** L'indice du point de passage de la case, dans `PlanCarte.points`. */
  w: number
  /** En repère 390 (l'échelle `k` s'applique au rendu). */
  x: number
  /** Absolu, depuis le haut de la carte. */
  y: number
  section: number
}
export interface SectionPlacee {
  decennie: number
  y0: number
  hauteur: number
  porte: number
  annees: number[]
}
export interface PlanCarte {
  points: Array<readonly [number, number]>
  cases: CasePlacee[]
  sections: SectionPlacee[]
  hauteur: number
}

/**
 * Pose les années sur la carte, une section par décennie, empilées de haut en bas. Chaque
 * décennie demande son tracé à son monde (`traceDe`) : la carte ne sait rien d'un monde.
 */
export function placerCarte(annees: readonly number[], traceDe: (decennie: number, annees: readonly number[]) => Trace): PlanCarte {
  const parDecennie = new Map<number, number[]>()
  for (const a of [...annees].sort((x, y) => x - y)) {
    const d = Math.floor(a / 10) * 10
    parDecennie.set(d, [...(parDecennie.get(d) ?? []), a])
  }
  const plan: PlanCarte = { points: [], cases: [], sections: [], hauteur: 0 }
  for (const [decennie, liste] of parDecennie) {
    const trace = traceDe(decennie, liste)
    if (trace.cases.length !== liste.length) throw new Error(`le tracé de ${decennie} a ${trace.cases.length} cases pour ${liste.length} années`)
    const y0 = plan.hauteur
    const base = plan.points.length
    const section = plan.sections.length
    for (const [x, y] of trace.points) plan.points.push([x, y0 + y])
    liste.forEach((annee, i) => {
      const w = base + trace.cases[i]!
      const [x, y] = plan.points[w]!
      plan.cases.push({ annee, w, x, y, section })
    })
    plan.sections.push({ decennie, y0, hauteur: trace.hauteur, porte: base + trace.porte, annees: liste })
    plan.hauteur = y0 + trace.hauteur
  }
  return plan
}
