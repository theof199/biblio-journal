import type { VueMonde } from '../types'
import { clamp } from '../../carte/outils'
import { AMBIANCE, FENETRES, HEURES, LABO, LUNE, type Ambiance, type Heure } from './donnees'
import { SOUFFLE_DE_LA_LAMPE } from './durees'
import { aDevelopper, developpement, gareALEcran, LIEU, milieuDeLaGare } from './gares'
import { decalages } from './toiles'
import { ANNEES, ARRETS, E, PAS } from './trace'

/**
 * Les règles de l'habillage du monde 1900 (plan 3b, tâche 11b) : des fonctions pures, que le dessin
 * lit et que les tests gardent (décision 12). Tout s'y tire d'`avance` et de l'état des années ;
 * rien n'y lit l'heure du visiteur (`nuit`, `lum`), rien n'y garde de mémoire d'une image à l'autre.
 */

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
/** La marche lissée de la maquette (`lisse`, l. 2662) : 0 sous `a`, 1 au-dessus de `b`. */
export const lisse = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Le hasard rejouable de la maquette (`alea`, l. 3557) : le même nombre pour le même rang, de 0 à 1. */
export const alea = (k: number): number => {
  const x = Math.sin(k * 91.7) * 43758.5453
  return x - Math.floor(x)
}

/** Où le train en est sur la ligne, en gares : 0 en gare de 1900, 9 en gare de 1909 (maquette : `pg`). */
export const rangSurLaLigne = (avance: number): number => clamp(decalages(avance).gares / E, 0, 9)

/**
 * La force de ce qu'une gare porte au carreau (la pluie, la neige, la buée), de 0 à 1 : pleine en
 * gare, elle s'efface de 30 % à 56 % du chemin vers la gare voisine (maquette, l. 3722-3723).
 * `ecart` : la distance du train à la gare, en gares. La règle n'est écrite qu'ici.
 */
export const forceEnGare = (ecart: number): number => 1 - lisse(0.3, 0.56, ecart)

/**
 * La part de chaque ambiance du fond (maquette, l. 3069-3072) : une seule à l'arrêt, celle de la
 * gare ; deux qui se fondent en route, de 30 % à 70 % du chemin.
 */
export function ambiances(avance: number): Record<Ambiance, number> {
  const pg = rangSurLaLigne(avance)
  const g0 = Math.floor(pg)
  const f = lisse(0.3, 0.7, pg - g0)
  const parts: Record<Ambiance, number> = { ville: 0, campagne: 0, montagne: 0, mer: 0 }
  parts[AMBIANCE[g0]!] += 1 - f
  parts[AMBIANCE[Math.min(9, g0 + 1)]!] += f
  return parts
}

/** L'heure qu'il est sur la ligne : celle de la gare à l'arrêt, fondue entre deux gares (maquette : `rendreDecor`, l. 3695-3705). */
export function heureSurLaLigne(avance: number): Omit<Heure, 'nom'> {
  const pg = rangSurLaLigne(avance)
  const g0 = Math.min(8, Math.floor(pg))
  const f = lisse(0.12, 0.88, pg - g0)
  const h0 = HEURES[g0]!
  const h1 = HEURES[g0 + 1]!
  const teinte = (a: Heure['haut'], b: Heure['haut']): Heure['haut'] => [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)]
  const lueur: Heure['lueur'] = [lerp(h0.lueur[0], h1.lueur[0], f), lerp(h0.lueur[1], h1.lueur[1], f), lerp(h0.lueur[2], h1.lueur[2], f), lerp(h0.lueur[3], h1.lueur[3], f)]
  return { haut: teinte(h0.haut, h1.haut), bas: teinte(h0.bas, h1.bas), lueur, lx: lerp(h0.lx, h1.lx, f), ly: lerp(h0.ly, h1.ly, f), sol: lerp(h0.sol, h1.sol, f), nuit: lerp(h0.nuit, h1.nuit, f) }
}

type Etat = Pick<VueMonde, 'cases' | 'ouverte' | 't' | 'vivant'>

/**
 * La force de la lanterne rouge d'une année, de 0 à 1 : pleine tant que la plaque est à développer,
 * elle s'éteint pendant que la plaque se développe (maquette : `.eteinte`, l. 787), et n'existe pas
 * pour une année sans place dans `LABO` (1900).
 */
export function forceDeLaLanterne(v: Etat, annee: number): number {
  if (!LABO[annee]) return 0
  return aDevelopper(v, annee) ? 1 : 1 - developpement(v, annee)
}

/**
 * Le voile du laboratoire sur l'heure, de 0 à 1 : plein à l'arrêt d'une année fermée, nul à 550 px
 * de toile de toute lanterne (maquette, l. 3699).
 */
export function voileDuLaboratoire(v: Etat & Pick<VueMonde, 'avance'>): number {
  const xs = decalages(v.avance).gares
  return ANNEES.reduce((voile, annee, i) => Math.max(voile, forceDeLaLanterne(v, annee) * clamp((550 - Math.abs(i * E - xs)) / 341, 0, 1)), 0)
}

/**
 * Ce qui reste de l'heure sous la lanterne, de 1 (plein jour de la gare) à 0. **Écart à la
 * maquette**, qui en laisse 14 % (`1 - 0.86 * voile`, l. 3700) : le brief veut qu'à l'arrêt d'une
 * année fermée il ne reste ni teinte, ni fenêtre, ni étoile.
 */
export const partDeLHeure = (v: Etat & Pick<VueMonde, 'avance'>): number => 1 - voileDuLaboratoire(v)

/** Ce que l'heure montre, chaque part de 0 à 1 (maquette, l. 3713-3718) : rien ne lit l'heure du visiteur. */
export function partsDeLHeure(v: Etat & Pick<VueMonde, 'avance'>): { teinte: number; soleil: number; lune: number; etoiles: number; fenetres: number } {
  const jour = partDeLHeure(v)
  const h = heureSurLaLigne(v.avance)
  return { teinte: jour, soleil: h.sol * jour, lune: lisse(0.8, 1, h.nuit) * jour, etoiles: h.nuit * h.nuit * jour, fenetres: lisse(0.2, 0.9, h.nuit) * jour }
}

/** La lune à l'écran (maquette : `LUNE`). */
export const luneALEcran = (v: Pick<VueMonde, 'W' | 'H'>): { x: number; y: number } => ({ x: (v.W * LUNE[0]) / 100, y: (v.H * LUNE[1]) / 100 })

/** Les fenêtres allumées de la gare de rang `i`, à l'écran, posées sur sa photographie. */
export function fenetresALEcran(v: Pick<VueMonde, 'W' | 'H' | 'avance'>, i: number): Array<{ x: number; y: number; w: number; h: number; halo: boolean }> {
  const p = gareALEcran(v, i)
  return (FENETRES[i] ?? []).map((f) => ({ x: p.x + f[0]! * p.w, y: p.y + f[1]! * p.h, w: f[2]! * p.w, h: f[3]! * p.h, halo: f[4] === 1 }))
}

/**
 * Vrai pour une année qui a son chef de gare sur le quai (idée 73 ; maquette : `construireDecor`,
 * l. 3539-3547) : une année quittée, jamais l'année en cours ni une année fermée.
 */
export function aUnChef(v: Pick<VueMonde, 'cases' | 'ouverte'>, annee: number): boolean {
  const etat = v.cases.find((k) => k.annee === annee)?.etat ?? 'verrou'
  return etat !== 'verrou' && etat !== 'encours' && !aDevelopper(v, annee)
}

/** Les deux seuils du guidon, en pixels de geste depuis l'arrêt de la gare (maquette, l. 3746). */
export const GUIDON = { pres: 5, loin: PAS * 0.8 } as const
/** Sur combien de pixels de geste le bras monte et redescend : choisi ici, la maquette le joue en 0,6 s d'horloge. */
const COURSE_DU_BRAS = 40

/**
 * De combien le chef de gare lève son guidon, de 0 (baissé) à 1 (levé). Décision 5 : d'après la
 * seule distance du train à l'arrêt de la gare, d'un côté comme de l'autre ; baissé à l'arrêt, au-delà
 * de 0,8 pas, et toujours quand le visiteur demande moins d'animations. Ni horloge, ni mémoire du
 * dernier arrêt : le bras monte et descend avec le geste.
 */
export function leveeDuGuidon(v: Pick<VueMonde, 'avance' | 'vivant'>, annee: number): number {
  const i = ANNEES.indexOf(annee)
  if (i < 0 || !v.vivant) return 0
  const d = Math.abs(v.avance - ARRETS[i]!)
  return lisse(GUIDON.pres, GUIDON.pres + COURSE_DU_BRAS, d) * (1 - lisse(GUIDON.loin - COURSE_DU_BRAS, GUIDON.loin, d))
}

/** Le chef de gare à l'écran (maquette : `.chef`, l. 1119) : 58 px à gauche du milieu de sa gare, les pieds à 8,5 % du bas de la photographie. */
export function chefALEcran(v: Pick<VueMonde, 'W' | 'H' | 'avance'>, i: number): { x: number; y: number; w: number; h: number } {
  const p = gareALEcran(v, i)
  return { x: milieuDeLaGare(v, i) - 58 - 23, y: p.y + p.h * (1 - 0.085) - 105, w: 46, h: 105 }
}

/**
 * La lanterne d'une année à l'écran (maquette : `.chambre`, `.lampe-labo`, `.porte-etiquette`,
 * l. 559-566 et 3073-3077) : le milieu de sa chambre (1100 px de large), sa lampe, son étiquette.
 * Nulle sans place dans `LABO`, ou quand la chambre est hors de l'écran.
 */
export function lanterneALEcran(v: Pick<VueMonde, 'W' | 'H' | 'avance'>, annee: number): { milieu: number; lampe: { x: number; y: number }; etiquette: { x: number; y: number; penche: number } } | null {
  const place = LABO[annee]
  if (!place) return null
  const milieu = milieuDeLaGare(v, annee - 1900)
  if (Math.abs(milieu - v.W / 2) >= v.W / 2 + 560) return null
  const [lx, ly, ex, ey, penche] = place
  return { milieu, lampe: { x: milieu + lx, y: (v.H * ly) / 100 }, etiquette: { x: milieu + ex, y: v.H * 0.525 + ey, penche } }
}

/** Ce que dit l'étiquette d'une plaque (maquette : `etiqueter`, l. 2843-2850) : le lieu, et ce qui la sépare de l'année en cours. */
export function motsDeLEtiquette(v: Pick<VueMonde, 'cases'>, annee: number): { lieu: string; sous: string } {
  const enCours = Math.max(1899, ...v.cases.filter((k) => k.etat !== 'verrou').map((k) => k.annee))
  const n = annee - enCours
  return { lieu: LIEU[annee] ?? '', sous: n > 0 ? `à ${n} ticket${n > 1 ? 's' : ''} de ${enCours}` : '' }
}

/**
 * Le souffle de la lampe du laboratoire, de 0,66 à 1 (maquette : `lampe-labo`, l. 494). Au calme,
 * elle ne respire pas : pleine, à tout instant.
 */
export function souffleDeLaLampe(v: Pick<VueMonde, 't' | 'vivant'>): number {
  if (!v.vivant) return 1
  return 0.83 - 0.17 * Math.cos((Math.PI * v.t * 1000) / SOUFFLE_DE_LA_LAMPE)
}
