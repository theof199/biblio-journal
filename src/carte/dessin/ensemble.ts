import type { PlanCarte } from '../placement'
import type { EtatCarte } from '../moteur'
import type { Monde } from '../../mondes/types'
import type { geoEnsemble } from '../ensemble'

/** Maquette : `dessinerEnsemble`, `marquise` ; une bande par section, une marquise par décennie repliée. */
export function dessinerEnsemble(g: CanvasRenderingContext2D, W: number, H: number, e: number, geo: ReturnType<typeof geoEnsemble>, plan: PlanCarte, etat: EtatCarte, mondeDe: (d: number) => Monde): void {
  void plan
  void etat
  void mondeDe
  void geo
  g.globalAlpha = e
  g.fillStyle = '#0b0806'
  g.fillRect(0, 0, W, H)
  g.globalAlpha = 1
}
