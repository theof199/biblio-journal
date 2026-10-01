import type { BobinePerdue, VueMonde } from '../types'
import { c } from './couleur'
import { cercle, poly } from './moyen'
import { lueurDansLaBrume } from '../../carte/dessin/bobines'

/**
 * Les bobines perdues des années 1890 (plan 2d ; maquette carte v2 : `BOBINES`, `becDeGaz`,
 * `tourEiffel`, `bobinePerdue`, `bobineBrume`, `lueurBrume`) : trois films réellement perdus,
 * cachés derrière le pied d'un bec de gaz, dans la brume et au pied de la tour Eiffel. Le rang
 * dans `BOBINES` est celui que le monde passe à `VueMonde.bobine` ; la clé, ce que l'appareil
 * retient.
 */
export const BOBINES: readonly BobinePerdue[] = [
  { cle: 'les-quatre-diables', titre: 'Les Quatre Diables', qui: 'F. W. Murnau, 1928' },
  { cle: 'la-tete-de-janus', titre: 'La Tête de Janus', qui: 'F. W. Murnau, 1920' },
  { cle: 'londres-apres-minuit', titre: 'Londres après minuit', qui: 'Tod Browning, 1927' },
]
const DERRIERE_LE_BEC = 0
const DANS_LA_BRUME = 1
const AU_PIED_DE_LA_TOUR = 2

/**
 * Le bec de gaz, au plan proche (parallaxe 1,2 de la maquette), au bord droit, sous la grande
 * baraque de 1899 ; et la brume, au bas de la section, que seule une décennie bouclée dissipe.
 */
export const BEC = { x: 376, y: 930 }
export const BRUME = { x: 96, y: 1060 }
/** La tour, au plan lointain (parallaxe 0,45), à gauche, à la hauteur de 1897 (maquette : `tourEiffel(52, 560, .82)`). */
export const TOUR = { x: 52, y: 560 }

/**
 * La tour Eiffel au loin, sa lanterne qui respire (maquette : `tourEiffel`), et la bobine posée à
 * son pied, derrière les gravats.
 */
export function dessinerLointain(v: VueMonde): void {
  if (v.presence <= 0.01) return
  const g = v.ctx
  const s = 0.82
  g.save()
  g.globalAlpha = v.presence
  g.translate(TOUR.x * v.k, v.ecranY(TOUR.y, 0.45))
  g.scale(s, s)
  g.fillStyle = c('#3d3023')
  g.beginPath()
  g.moveTo(-34, 0); g.quadraticCurveTo(-16, -44, -7, -100); g.lineTo(-3, -146); g.lineTo(0, -168); g.lineTo(3, -146); g.lineTo(7, -100); g.quadraticCurveTo(16, -44, 34, 0)
  g.lineTo(21, 0); g.quadraticCurveTo(0, -30, -21, 0)
  g.closePath()
  g.fill()
  g.fillRect(-19, -47, 38, 4)
  g.fillRect(-9, -103, 18, 3)
  const b = (v.vivant ? 0.5 + 0.5 * Math.sin(v.t * 1.3) : 0.7) * v.lum
  g.globalCompositeOperation = 'lighter'
  g.fillStyle = c('#F2DCAA', Math.min(1, 0.35 * b)); cercle(g, 0, -168, 6)
  g.fillStyle = c('#FFF0D2', Math.min(1, 0.8 * b)); cercle(g, 0, -168, 1.6)
  g.globalCompositeOperation = 'source-over'
  v.feu(0, -168, 20, 'or', v.presence * b * 0.6)
  // Maquette : `bobinePerdue(2, 46, -7, 7.5)`, puis les gravats qui la cachent à moitié.
  v.bobine(AU_PIED_DE_LA_TOUR, 40, -7, 7.5)
  g.fillStyle = c('#2a2119')
  poly(g, [[30, 0], [35, -5], [39, -2], [43, -4], [49, 0]])
  g.fill()
  g.restore()
}

/** Le bec de gaz qui s'embrase au toucher (maquette : `becDeGaz`, l'indice 1, `vers` −1), la bobine derrière son pied. */
export function becDeGaz(v: VueMonde): void {
  if (v.presence <= 0.01) return
  const g = v.ctx
  const s = 1.1
  const vers = -1
  const age = v.age('bec')
  const flare = age < 0.9 ? 1 - age / 0.9 : 0
  const b = (v.vivant ? 0.8 + 0.2 * Math.sin(v.t * 5.3) * Math.sin(v.t * 2.2) : 0.9) * Math.min(1.25, v.lum) + flare
  g.save()
  g.globalAlpha = v.presence
  g.translate(BEC.x * v.k, v.ecranY(BEC.y, 1.2))
  g.scale(s, s)
  g.globalCompositeOperation = 'lighter'
  const R = 46 + flare * 26
  const h = g.createRadialGradient(0, -128, 2, 0, -128, R)
  h.addColorStop(0, c('#F2CD8C', Math.min(1, 0.38 * b)))
  h.addColorStop(1, c('#F2CD8C', 0))
  g.fillStyle = h
  cercle(g, 0, -128, R)
  g.globalCompositeOperation = 'source-over'
  // Une bobine perdue, à moitié cachée derrière le pied du bec.
  v.bobine(DERRIERE_LE_BEC, -10, -6, 7)
  g.fillStyle = c('#0b0806')
  g.fillRect(-2.5, -120, 5, 120)
  g.fillRect(-7, -8, 14, 8)
  g.fillRect(-12 * vers, -108, 14 * vers, 3)
  poly(g, [[-7, -122], [7, -122], [9, -136], [-9, -136]]); g.fill()
  poly(g, [[-10, -136], [10, -136], [0, -146]]); g.fill()
  g.fillStyle = c('#FCE2AA', Math.min(1, b))
  g.fillRect(-4.5, -134, 9, 10)
  v.feu(0, -129, 74, 'or', v.presence * Math.min(1, b))
  v.zone('bec', 0, -128, 20)
  g.restore()
}

/** La bobine de la brume, au sol, sous elle (maquette : `bobineBrume`) : immobile, rien d'elle ne bouge. */
export function bobineSousLaBrume(v: VueMonde): void {
  if (v.presence <= 0.01) return
  v.ctx.save()
  v.ctx.translate(BRUME.x * v.k, v.ecranY(BRUME.y, 1))
  v.bobine(DANS_LA_BRUME, 0, 0, 8)
  v.ctx.restore()
}

/** Ce qui la trahit, par-dessus la brume : un éclat de temps en temps, tant qu'elle n'est pas trouvée (maquette : `lueurBrume`). */
export function lueurDeLaBrume(v: VueMonde): void {
  if (v.presence <= 0.01 || v.bobineTrouvee(DANS_LA_BRUME)) return
  lueurDansLaBrume(v.ctx, BRUME.x * v.k, v.ecranY(BRUME.y, 1), v.t, v.vivant, c)
}
