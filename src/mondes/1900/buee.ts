import type { Glissement, VueMonde } from '../types'
import { BUEE } from './donnees'
import { forceEnGare, rangSurLaLigne } from './habillage'
import { vitreOuverte } from './passage'
import { ANNEES, ARRETS, B1 } from './trace'

/**
 * Les règles de la buée (idée 70 ; maquette : `embuer`, `bueeIci`, `essuyer`, `finirEssuyage`,
 * l. 3650-3691, et `rendreDecor`, l. 3722-3730) : des fonctions pures, que le trait
 * (`intemperies.ts`) lit et que les tests gardent. Combien la vitre est embuée se tire d'`avance`
 * seule ; ce que le doigt a ôté est une liste de traits. Rien ici ne lit l'horloge : la buée
 * s'essuie donc aussi quand le visiteur demande moins d'animations (décision de la session
 * principale, sur la recommandation de la spec ; c'est ce que fait la maquette, l. 3370 et 3375),
 * et aucun mot d'invite ne dit qu'on peut l'essuyer (même décision).
 */

type Table = readonly number[]
type Ecran = Pick<VueMonde, 'W' | 'H' | 'avance'>

/**
 * La force de la buée, de 0 à 1 : celle de sa gare, la même règle que la pluie et la neige
 * (`forceEnGare`, `habillage.ts`). Nulle pendant tout le passage de
 * la foire au train (avant la gare de 1900), quelle que soit la table.
 */
export function forceDeLaBuee(avance: number, table: Table = BUEE): number {
  if (avance < B1) return 0
  const pg = rangSurLaLigne(avance)
  let force = 0
  for (const annee of table) {
    // Une année hors de la ligne a le rang -1, à une gare au moins du train : elle ne donne rien.
    const i = ANNEES.indexOf(annee)
    force = Math.max(force, forceEnGare(Math.abs(pg - i)))
  }
  return force
}

/** Au-dessus de cette force, un glissement horizontal est un essuyage (maquette : `bueeIci`, l. 3674). */
export const FORCE_DE_PRISE = 0.4

/**
 * À combien de pixels d'avance de l'arrêt d'une gare embuée l'essuyage se prend encore. Sans
 * limite, il se prend partout où la buée se voit assez (`FORCE_DE_PRISE`), comme dans la maquette :
 * une buée qu'on voit et qui ne s'essuie pas à trois pixels de la gare aurait l'air cassée. **Le
 * repli**, si un navigateur engage son défilement avant que le geste soit reconnu (iPhone surtout) :
 * ne le prendre qu'à l'arrêt, où rien ne défile plus. C'est cette ligne, à `2`.
 */
export const PORTEE_DE_L_ESSUYAGE: number = Infinity

/**
 * Vrai quand un glissement horizontal essuie la vitre au lieu de laisser défiler : la vitre a rempli
 * l'écran (la garde de tout ce qui se touche en 1900), la buée s'y voit assez, et le train est à
 * portée de sa gare.
 */
export function bueePrise(avance: number, table: Table = BUEE, portee: number = PORTEE_DE_L_ESSUYAGE): boolean {
  if (!vitreOuverte(avance)) return false
  if (forceDeLaBuee(avance, table) <= FORCE_DE_PRISE) return false
  return table.some((annee) => Math.abs(avance - (ARRETS[ANNEES.indexOf(annee)] ?? Infinity)) <= portee)
}

/**
 * Un trait ôté à la buée : d'un point à l'autre, en parts de l'écran. `doigt` : le passage du doigt,
 * large ; `goutte` : une coulure fine sous le passage.
 */
export interface Trait {
  genre: 'doigt' | 'goutte'
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * Ce que le doigt a ôté à la buée. `traits` ne fait que grandir, jusqu'à l'oubli : la toile du trait
 * n'en est que le cache. `doigt` : le passage en cours, où il en est, son point le plus bas, et s'il
 * a ôté quelque chose ; nul entre deux passages.
 */
export interface Essuyage {
  traits: readonly Trait[]
  doigt: { x: number; y: number; bas: readonly [number, number]; essuie: boolean } | null
}

export const VITRE_EMBUEE: Essuyage = { traits: [], doigt: null }

/**
 * La borne de la mémoire. Atteinte, le doigt n'ôte plus rien jusqu'à l'oubli : à dix pixels le
 * trait, c'est une vingtaine de largeurs d'écran, plus qu'il n'en faut pour tout essuyer.
 */
export const PLAFOND_DES_TRAITS = 800
/** En dessous de ce chemin, en pixels, le doigt n'ajoute pas de trait : le pinceau en fait 54 de large. */
export const PAS_DU_DOIGT = 10
/** Les deux gouttes qui coulent du bas d'un passage, en pixels : l'écart au point le plus bas, d'où elle part dessous, sa longueur (maquette, l. 3689). */
export const COULURES: ReadonlyArray<{ dx: number; dy: number; l: number }> = [{ dx: -14, dy: 20, l: 46 }, { dx: 9, dy: 20, l: 88 }]

/**
 * Un glissement sur la vitre embuée (le contrat : `Monde.glisser`, `../types`). Le `debut` ouvre un
 * passage, du poser au doigt : il n'arrive qu'à plus de dix pixels du poser. Chaque `suite` ajoute
 * un trait, sauf sur place. La `fin` ferme le passage par ses deux gouttes, sous son point le plus
 * bas.
 *
 * **La `fin` n'est pas un lever** (un `pointercancel`, un second doigt, un passage, la vue
 * d'ensemble) : les gouttes coulent quand même. Elles disent que le passage est fini, pas que le
 * doigt s'est levé, et le monde ne sait pas faire la différence ; un passage sans gouttes selon la
 * façon dont il a fini serait un hasard. Elles sont deux traits posés, pas une animation.
 *
 * Hors d'un passage, une `suite` ou une `fin` ne fait rien : la vitre s'est réembuée sous le doigt.
 */
export function essuyer(e: Essuyage, g: Glissement, ecran: Pick<Ecran, 'W' | 'H'>): Essuyage {
  const { W, H } = ecran
  let doigt = g.phase === 'debut' ? { x: g.x0 / W, y: g.y0 / H, bas: [g.x0 / W, g.y0 / H] as const, essuie: false } : e.doigt
  if (!doigt) return e
  let traits = e.traits
  const x = g.x / W
  const y = g.y / H
  const loin = Math.hypot((x - doigt.x) * W, (y - doigt.y) * H) >= PAS_DU_DOIGT
  // La place des deux gouttes est gardée : un passage qui a essuyé peut toujours couler.
  if (loin && traits.length + 1 + COULURES.length <= PLAFOND_DES_TRAITS) {
    traits = [...traits, { genre: 'doigt', x0: doigt.x, y0: doigt.y, x1: x, y1: y }]
    doigt = { x, y, bas: y > doigt.bas[1] ? [x, y] : doigt.bas, essuie: true }
  }
  if (g.phase !== 'fin') return traits === e.traits && doigt === e.doigt ? e : { traits, doigt }
  if (doigt.essuie) {
    const [bx, by] = doigt.bas
    traits = [...traits, ...COULURES.map((c): Trait => ({ genre: 'goutte', x0: bx + c.dx / W, y0: by + c.dy / H, x1: bx + (c.dx + 2) / W, y1: by + (c.dy + c.l) / H }))]
  }
  return { traits, doigt: null }
}

/**
 * La vitre d'un monde : la seule mémoire du monde 1900 qui ne se tire pas d'`avance`. Elle vit dans
 * la fermeture de `creerMonde1900`, donc avec le `Monde` que le moteur dessine, pas celui qu'une
 * page tient. **Elle ne survit pas à la carte** : le moteur et son registre naissent à chaque montage
 * (`fabriqueReelle`, `carte/CarteCanvas.tsx`), et la carte est une route. Essuyer à Creil, ouvrir
 * l'année 1901, revenir : la vitre est réembuée, comme après un rechargement.
 *
 * **L'oubli** : dès que la buée n'a plus de force (le train est à plus de 56 % du chemin d'une gare
 * embuée), la vitre se réembue, comme dans la maquette (l. 3728) : revenir à Creil la retrouve
 * entière. L'oubli se constate quand le monde dessine ou reçoit un glissement : une caméra posée
 * d'un coup hors de la décennie puis reposée d'un coup à Creil, sans une image du train entre les
 * deux, retrouve la vitre comme elle l'a laissée.
 */
export interface Vitre {
  /**
   * `Monde.glisser` : faux au `debut` hors de `bueePrise`, et le doigt défile comme toujours. Au calme
   * aussi : `v.vivant` n'est pas lu. **La prise ne se relit pas en route** : une `suite` ou une `fin`
   * reçue là où la buée ne se prend plus mais a encore de la force essuie et coule ; seul l'oubli (la
   * force à zéro) ferme le passage.
   */
  glisser: (g: Glissement, v: Ecran) => boolean
  /** Ce qui est essuyé là où en est le train ; c'est ici que la vitre oublie. */
  essuyage: (avance: number) => Essuyage
}

export function creerVitre(table: Table = BUEE, portee: number = PORTEE_DE_L_ESSUYAGE): Vitre {
  let e = VITRE_EMBUEE
  const essuyage = (avance: number): Essuyage => {
    if (forceDeLaBuee(avance, table) <= 0) e = VITRE_EMBUEE
    return e
  }
  return {
    essuyage,
    glisser: (g, v) => {
      essuyage(v.avance)
      if (g.phase === 'debut' && !bueePrise(v.avance, table, portee)) return false
      e = essuyer(e, g, v)
      return true
    },
  }
}
