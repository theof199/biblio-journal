import { describe, expect, it, vi } from 'vitest'
import { creerMonde1890 } from './index'
import { BRUME } from './bobines'
import { ELEMENTS } from './chantier'
import { departDe, HALTE, ZONE_DE_LA_HALTE } from './halte'
import { trace1890 } from '../trace'
import { vueFactice } from '../../test/vueFactice'
import type { VueMonde } from '../types'

/**
 * La halte au bout de la foire. Ce qui est gardé ici est la règle, pas le trait (décision du
 * propriétaire, 6 octobre 2026 : pas de test sur le rendu d'un décor) : quand le train est à quai,
 * quand la halte se touche, où, ce que fait son toucher, et que rien ne bouge au calme. Le dessin
 * n'est lu que par ce que la vue en reçoit (ses zones, ses feux) ou comparé à lui-même.
 */
const monde = creerMonde1890()
type Rond = { x: number; y: number; r: number }

/** Ce que la foire pose par-dessus la brume : les ronds où la halte se touche, les feux qu'elle allume. */
const poser = (surcharge: Partial<VueMonde> = {}) => {
  const ronds: Rond[] = []
  const banc = vueFactice({ zone: (id, x, y, r) => void (id === ZONE_DE_LA_HALTE && ronds.push({ x, y, r })), ...surcharge })
  monde.dessinerSurLaBrume(banc.vue)
  const touche = (x: number, y: number) => ronds.some((z) => Math.hypot(x - z.x, y - z.y) <= z.r)
  return { ...banc, ronds, touche, feux: vi.mocked(banc.vue.feu).mock.calls.length }
}
/** Le toucher d'une zone de la halte, tel que le moteur le livre au monde. */
const toucher = (vue: VueMonde) => monde.reagir(ZONE_DE_LA_HALTE, null, vue, { x: 200, y: 400 })

/** La lanterne du sémaphore seule ; le fanal de la machine en plus quand le train est à quai. */
const FEUX_SANS_TRAIN = 1
const FEUX_AVEC_TRAIN = 2
/** Des points du dessin, dans le repère de la section : la porte, le bout de chaque aile, le pignon ; la machine, la voiture. */
const SUR_LA_GARE = [[HALTE.cx, HALTE.sol - 10], [HALTE.cx - HALTE.demi + 4, HALTE.sol - 15], [HALTE.cx + HALTE.demi - 4, HALTE.sol - 15], [HALTE.cx, HALTE.sol - HALTE.haut + 6]] as const
const SUR_LE_TRAIN = [[HALTE.nez - 30, HALTE.rail - 15], [HALTE.nez - 150, HALTE.rail - 15]] as const

describe('la halte au bout de la foire', () => {
  // Mutations : l'appel de `dessinerHalte` retiré de `dessinerSurLaBrume` ; `if (v.brume < HALTE.sol) return`
  // en tête de `dessinerHalte` (pas de halte sous la brume) ; `train: true` dans `departDe` ; la zone
  // inscrite sans regarder `ouvert` ; la branche de la halte retirée de `reagir`.
  it('sans ticket, la halte est là dès 1895, sous la brume comme hors d’elle : sans train, et muette', () => {
    for (const surcharge of [{}, { brume: 300, ouverte: { annee: 1895, t0: -9 } }, { vivant: false }] satisfies Array<Partial<VueMonde>>) {
      const banc = poser(surcharge)
      expect(departDe(banc.vue)).toEqual({ train: false, ouvert: false })
      expect(banc.feux).toBe(FEUX_SANS_TRAIN)
      expect(banc.ronds).toEqual([])
      expect(() => toucher(banc.vue)).not.toThrow()
      expect(banc.vue.marquer).not.toHaveBeenCalled()
      expect(banc.vue.etincelles).not.toHaveBeenCalled()
    }
  })

  // Mutations : `train: v.passer !== null` (le train attendrait que 1900 soit ouvert) ;
  // `if (depart.train)` remplacé par `if (depart.ouvert)` devant `trainAQuai` ; `ouvert: d.train`
  // (le train se toucherait, 1900 fermé, pour un passage qui n'existe pas).
  it('le ticket du monde d’après en main, 1900 encore fermé : le train est à quai, et rien ne se touche encore', () => {
    const banc = poser({ ticketDApres: true })
    expect(departDe(banc.vue)).toEqual({ train: true, ouvert: false })
    expect(banc.feux).toBe(FEUX_AVEC_TRAIN)
    expect(banc.ronds).toEqual([])
    expect(() => toucher(banc.vue)).not.toThrow()
    expect(banc.vue.marquer).not.toHaveBeenCalled()
  })

  // Mutations : `prendreLeTrain` vidé ; la branche de la halte retirée de `reagir` (elle serait
  // marquée comme le manège) ; `zonesDeLaHalte` qui rend toujours `[]` ; les ronds du train ôtés de
  // `RONDS` ; ceux du bâtiment ôtés.
  it('1900 ouvert, la gare et le train se touchent, et le toucher lance le passage que la vue donne, une fois, sans rien dater', () => {
    const passer = vi.fn()
    const banc = poser({ ticketDApres: true, passer })
    expect(departDe(banc.vue)).toEqual({ train: true, ouvert: true })
    for (const [x, y] of [...SUR_LA_GARE, ...SUR_LE_TRAIN]) expect(banc.touche(x, y), `(${x}, ${y})`).toBe(true)
    expect(passer).not.toHaveBeenCalled()
    toucher(banc.vue)
    expect(passer).toHaveBeenCalledTimes(1)
    expect(banc.vue.marquer).not.toHaveBeenCalled()
  })

  // Mutations : `train: v.ticketDApres && v.passer === null` (le train repartirait au compostage) ;
  // `train: v.ticketDApres && !v.bouclee` (il repartirait la décennie bouclée) ; `train: v.ticketDApres`
  // seul (pas de train si les tickets ne sont pas lus, 1900 pourtant ouvert).
  it('le ticket utilisé, 1900 ouvert et dépassé, la décennie bouclée : le train est toujours là, et se prend encore', () => {
    const depasse = { ticketDApres: true, passer: vi.fn(), bouclee: true, ouverte: { annee: 1899, t0: -9 }, avance: 900 } satisfies Partial<VueMonde>
    const banc = poser(depasse)
    expect(departDe(banc.vue).train).toBe(true)
    expect(banc.feux).toBe(FEUX_AVEC_TRAIN)
    for (const [x, y] of SUR_LE_TRAIN) expect(banc.touche(x, y)).toBe(true)
    toucher(banc.vue)
    expect(depasse.passer).toHaveBeenCalledTimes(1)
    // Les tickets pas encore lus, ou leur lecture en échec : 1900 ouvert vaut ticket émis.
    const sansLecture = poser({ ticketDApres: false, passer: vi.fn() })
    expect(departDe(sansLecture.vue).train).toBe(true)
    expect(sansLecture.feux).toBe(FEUX_AVEC_TRAIN)
  })

  // Mutations : `touchesAuCalme: []` (le moteur ne livrerait pas le toucher au calme) ; une garde
  // `v.vivant` devant les zones ou devant `prendreLeTrain`.
  it('se prend aussi quand le visiteur demande moins d’animations', () => {
    expect(monde.touchesAuCalme).toContain(ZONE_DE_LA_HALTE)
    const passer = vi.fn()
    const banc = poser({ ticketDApres: true, passer, vivant: false })
    for (const [x, y] of [...SUR_LA_GARE, ...SUR_LE_TRAIN]) expect(banc.touche(x, y)).toBe(true)
    toucher(banc.vue)
    expect(passer).toHaveBeenCalledTimes(1)
  })

  // Mutations : `v.vivant ?` retiré de la fumée (elle monterait au calme) ; retiré de `flamme` (les
  // lampes trembleraient) ; `v.fumee` appelée. Le témoin : vivante, la même halte change bien d'une
  // heure à l'autre, sans quoi ce test ne verrait rien.
  it('au calme rien ne bouge : la même image à toute heure, sans train, le train à quai et 1900 ouvert ; ni fumée ni lampe qui tremble', () => {
    const image = (surcharge: Partial<VueMonde>) => {
      const banc = poser(surcharge)
      expect(banc.vue.fumee).not.toHaveBeenCalled()
      return JSON.stringify([banc.appels, vi.mocked(banc.vue.feu).mock.calls])
    }
    for (const etat of [{}, { ticketDApres: true }, { ticketDApres: true, passer: vi.fn() }] satisfies Array<Partial<VueMonde>>) {
      const reference = image({ ...etat, vivant: false, t: 3.2 })
      expect(image({ ...etat, vivant: false, t: 97.7 })).toBe(reference)
      expect(image({ ...etat, vivant: false, t: 12.05, avance: 800 })).toBe(reference)
      expect(image({ ...etat, vivant: true, t: 97.7 })).not.toBe(image({ ...etat, vivant: true, t: 3.2 }))
    }
  })

  // Mutations : un rond du bâtiment remonté de 100 px (il prendrait la case de 1899) ; poussé sur la
  // baraque ; un rayon de 44 passé à 20 ; un rond du train descendu sur la bobine de la brume.
  it('ne se touche ni sur la case de 1899, ni sur la baraque « Prochainement », ni sur la bobine de la brume, et chaque rond est large au doigt', () => {
    const banc = poser({ ticketDApres: true, passer: vi.fn() })
    expect(banc.ronds.length).toBeGreaterThan(0)
    const [caseX, caseY] = trace1890([1899]).points[5]!
    const baraque = ELEMENTS.find((e) => e.annee === 1899)!.site
    // Quarante-quatre pixels de marge autour de chaque voisin : ce que prend un doigt.
    const MARGE = 44
    for (const [x, y] of [[caseX, caseY], [baraque[0], baraque[1]], [baraque[0], 751], [BRUME.x, BRUME.y]] as const) {
      for (const z of banc.ronds) expect(Math.hypot(x - z.x, y - z.y) - z.r, `(${x}, ${y})`).toBeGreaterThanOrEqual(MARGE)
    }
    // Soixante-quatre pixels de diamètre au moins : en dessous, un rond ne se touche pas du doigt sans viser.
    for (const z of banc.ronds) expect(z.r * 2).toBeGreaterThanOrEqual(64)
  })
})
