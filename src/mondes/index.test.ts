import { describe, expect, it, vi } from 'vitest'
import { creerRegistre } from '.'
import type { VueMonde, VueMonument } from './types'
import { contexteFactice } from '../test/contexteFactice'

describe('le registre des mondes', () => {
  // Relecture de la tâche 5. Mutations : le cache sorti de `creerRegistre` (deux cartes montées
  // partageraient leurs mondes) ; le cache retiré (un monde neuf à chaque appel perdrait ce qu'il
  // tient d'une image à l'autre).
  it('garde un monde par décennie, et un registre par carte montée', () => {
    const une = creerRegistre()
    const autre = creerRegistre()
    expect(une(1950)).toBe(une(1950))
    expect(autre(1950)).not.toBe(une(1950))
  })

  // Relecture de la tâche 5. Mutations : `siteDuChantier` du monde « à venir » qui rend un nombre
  // (la caméra partirait en haut de sa section à chaque année) ; `dessinerSurLaBrume` qui y dessine.
  it('laisse le monde « à venir » sans chantier : rien à aller chercher, rien par-dessus la brume', () => {
    const monde = creerRegistre()(1950)
    expect(monde.aVenir).toBe(true)
    expect(monde.siteDuChantier(1955)).toBeNull()
    const { ctx, appels } = contexteFactice()
    monde.dessinerSurLaBrume({ ctx } as VueMonde)
    expect(appels).toEqual([])
  })

  // Tâche 4 du plan 2c. Mutation : un `zone(…)` ajouté au monument du monde « à venir ». Sa page
  // s'ouvre par le registre ; le monde 1890, lui, inscrit ses dix chevaux (la vue est la bonne).
  it('ne donne aucune figure à toucher au monument du monde « à venir »', () => {
    const inscrites = (decennie: number) => {
      const zone = vi.fn()
      const vue: VueMonument = {
        ctx: contexteFactice().ctx, W: 390, H: 330, t: 0, vivant: true, nuit: 0,
        annees: Array.from({ length: 10 }, (_, i) => ({ annee: decennie + i, etat: 'verrou' as const })),
        cases: [], bouclee: false, touche: -9, zone,
      }
      creerRegistre()(decennie).pages.dessinerMonument(vue)
      return zone.mock.calls.length
    }
    expect(inscrites(1890)).toBe(10)
    expect(inscrites(1950)).toBe(0)
  })
})
