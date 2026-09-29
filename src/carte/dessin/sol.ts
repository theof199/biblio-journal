import type { Route } from '../route'
import type { PlanCarte } from '../placement'
import type { EtatCarte } from '../moteur'
import type { Monde } from '../../mondes/types'

export const TUILE = 512

/** Maquette : `dessinerSol` (la pellicule, les photogrammes allumés), une couleur de route par monde. */
export function dessinerSol(x: CanvasRenderingContext2D, chemin: Path2D, route: Route, plan: PlanCarte, etat: EtatCarte, mondeDe: (d: number) => Monde): void {
  void route
  void etat
  x.strokeStyle = mondeDe(plan.sections[0]?.decennie ?? 1890).palette.route.fond
  x.lineWidth = 45
  x.stroke(chemin)
}
