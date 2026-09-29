import { describe, expect, it } from 'vitest'
import { creerRegistre } from '.'
import type { VueMonde } from './types'
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
})
