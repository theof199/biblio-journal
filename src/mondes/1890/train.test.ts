import { describe, expect, it, vi } from 'vitest'
import { creerMonde1890 } from './index'
import { imageDu1890 } from './images'
import { TRAIN, ZONE_DU_TRAIN } from './train'
import { vueFactice } from '../../test/vueFactice'
import type { VueMonde } from '../types'

/**
 * Le train au bout de la foire (demande du propriétaire, 7 octobre 2026). Ce qui est gardé ici est
 * la règle, pas le trait : quand il est posé, quand il se touche, et ce que fait son toucher.
 */
const PHOTO = { photo: 'locomotive' } as unknown as CanvasImageSource
const ADRESSE = imageDu1890('locomotive.webp')
/** Une vue où la photographie est décodée, et elle seule. */
const vue = (surcharge: Partial<VueMonde> = {}) => vueFactice({ image: (url) => (url === ADRESSE ? PHOTO : null), ...surcharge })
const monde = creerMonde1890()
/** Ce que la foire pose par-dessus la brume : le train y est-il, et se touche-t-il ? */
const poser = (surcharge: Partial<VueMonde> = {}) => {
  const banc = vue(surcharge)
  monde.dessinerSurLaBrume(banc.vue)
  return { ...banc, pose: banc.appels.some((a) => a.nom === 'drawImage' && a.args[0] === PHOTO), touchable: banc.zones.some((z) => z.id === ZONE_DU_TRAIN) }
}
const OU = { x: 90, y: 500 }

describe('le train au bout de la foire', () => {
  it('a sa photographie dans le dossier du monde', () => {
    expect(ADRESSE).not.toBeNull()
  })

  // Mutations : `if (!trainSeTouche(v)) return` remonté avant le dessin (pas de train sans 1900) ;
  // l'appel de `dessinerTrain` retiré de `dessinerSurLaBrume` ; `if (v.brume < y) return`.
  it('attend là dès la première année, 1900 fermé, sous la brume comme hors d’elle, au calme aussi', () => {
    expect(poser().pose).toBe(true)
    expect(poser({ brume: 300, ouverte: { annee: 1895, t0: -9 } }).pose).toBe(true)
    expect(poser({ vivant: false }).pose).toBe(true)
    expect(poser({ passer: vi.fn() }).pose).toBe(true)
  })

  // Mutation : un train tracé ou une zone inscrite sans la photographie (`if (!photo) return` retiré).
  it('ne pose ni train ni zone tant que la photographie charge', () => {
    const banc = vueFactice({ passer: vi.fn() })
    monde.dessinerSurLaBrume(banc.vue)
    expect(banc.appels.some((a) => a.nom === 'drawImage')).toBe(false)
    expect(banc.zones.some((z) => z.id === ZONE_DU_TRAIN)).toBe(false)
  })

  // Mutations : la zone inscrite sans regarder `passer` ; `reagir` qui marque le train comme un décor.
  it('n’est qu’un décor tant que 1900 est fermé : aucune zone, et son toucher ne fait rien', () => {
    const banc = poser()
    expect(banc.touchable).toBe(false)
    expect(() => monde.reagir(ZONE_DU_TRAIN, null, banc.vue, OU)).not.toThrow()
    expect(banc.vue.marquer).not.toHaveBeenCalled()
    expect(banc.vue.etincelles).not.toHaveBeenCalled()
  })

  // Mutations : `prendreLeTrain` vidé ; la branche du train retirée de `reagir` (il serait marqué
  // comme le manège) ; la zone jamais inscrite.
  it('1900 atteint, se touche, et son toucher lance le passage que la vue lui donne, une fois, sans rien dater', () => {
    const passer = vi.fn()
    const banc = poser({ passer })
    expect(banc.touchable).toBe(true)
    expect(passer).not.toHaveBeenCalled()
    monde.reagir(ZONE_DU_TRAIN, null, banc.vue, OU)
    expect(passer).toHaveBeenCalledTimes(1)
    expect(banc.vue.marquer).not.toHaveBeenCalled()
  })

  // Mutations : `touchesAuCalme: []` (le moteur ne livrerait pas le toucher au calme) ; une garde
  // `v.vivant` devant la zone ou devant `prendreLeTrain`.
  it('se prend aussi quand le visiteur demande moins d’animations', () => {
    expect(monde.touchesAuCalme).toContain(ZONE_DU_TRAIN)
    const passer = vi.fn()
    const banc = poser({ passer, vivant: false })
    expect(banc.touchable).toBe(true)
    monde.reagir(ZONE_DU_TRAIN, null, banc.vue, OU)
    expect(passer).toHaveBeenCalledTimes(1)
  })

  // Mutations : `v.t` ou `v.vivant` lus par le dessin (une fumée, un tremblement) ; `v.fumee` appelée.
  it('ne bouge pas : la même image à toute heure de l’horloge, vivant ou au calme, et aucune particule', () => {
    const suite = (surcharge: Partial<VueMonde>) => {
      const banc = vue(surcharge)
      const debut = banc.appels.length
      monde.dessinerSurLaBrume(banc.vue)
      const i = banc.appels.findIndex((a, rang) => rang >= debut && a.nom === 'drawImage' && a.args[0] === PHOTO)
      expect(banc.vue.fumee).not.toHaveBeenCalled()
      return JSON.stringify(banc.appels[i]!.args.slice(1))
    }
    const reference = suite({ t: 3.2 })
    expect(suite({ t: 97.7 })).toBe(reference)
    expect(suite({ t: 3.2, vivant: false })).toBe(reference)
    expect(suite({ t: 12, passer: vi.fn(), avance: 800 })).toBe(reference)
  })

  // Mutation : `TRAIN.x + TRAIN.largeur` poussé sur la pellicule (x ≥ 185), ou le train remonté sur la baraque ou la case de 1899.
  it('tient à gauche de la pellicule, sous la baraque « Prochainement » et la case de 1899, au-dessus de la bobine de la brume', () => {
    const haut = TRAIN.y - TRAIN.largeur * TRAIN.rapport
    expect(TRAIN.x).toBeGreaterThanOrEqual(0)
    expect(TRAIN.x + TRAIN.largeur).toBeLessThanOrEqual(180)
    expect(haut).toBeGreaterThan(760)
    expect(TRAIN.y).toBeLessThan(1030)
  })
})
