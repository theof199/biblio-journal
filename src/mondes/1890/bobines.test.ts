import { describe, expect, it, vi } from 'vitest'
import { creerMonde1890 } from '.'
import { BRUME, bobineSousLaBrume, lueurDeLaBrume } from './bobines'
import { c } from './couleur'
import { vueFactice } from '../../test/vueFactice'
import { contexteFactice } from '../../test/contexteFactice'
import { dessinerBobinePerdue } from '../../carte/dessin/bobines'
import type { VueMonde } from '../types'

/** Tous les plans du monde, dans l'ordre du moteur, et les bobines qu'ils cachent. */
function cachees(surcharge: Partial<VueMonde> = {}) {
  const m = creerMonde1890()
  const { vue } = vueFactice(surcharge)
  m.dessinerCiel(vue)
  m.dessinerLointain(vue)
  m.dessinerMoyen(vue)
  m.dessinerSol(vue, { x: 0, y: 0 })
  m.dessinerProche(vue)
  m.dessinerSurLaBrume(vue)
  return vi.mocked(vue.bobine).mock.calls
}

describe('les bobines perdues des années 1890 (plan 2d)', () => {
  // Mutations : un `v.bobine(…)` retiré du bec de gaz, de la tour ou du sol ; deux cachettes sous
  // le même rang ; une clé partagée (l'appareil confondrait deux trouvailles).
  it('cache trois films réellement perdus, chacun à sa place et sous sa clé', () => {
    const m = creerMonde1890()
    expect(m.bobines.map((b) => b.titre)).toEqual(['Les Quatre Diables', 'La Tête de Janus', 'Londres après minuit'])
    expect(new Set(m.bobines.map((b) => b.cle)).size).toBe(3)
    expect(cachees().map(([i]) => i).sort()).toEqual([0, 1, 2])
  })

  // Mutations : une dérive de la bobine de la brume qui ne regarde pas `vivant`, dans ses arguments
  // (`x + Math.sin(v.t)`) ou dans le repère où elle se pose (`translate(Math.sin(v.t), 0)`).
  it('au calme, la bobine de la brume ne bouge pas d’une image à l’autre', () => {
    const une = (t: number) => {
      const poses: unknown[] = []
      const { vue } = vueFactice({ t, vivant: false })
      vue.bobine = (...args) => void poses.push([args, vue.ctx.getTransform()])
      bobineSousLaBrume(vue)
      return poses
    }
    expect(une(0.2)).toEqual(une(5.7))
    expect(une(0.2)).toHaveLength(1)
  })

  // Mutations : `if (!vivant) return` retiré de `lueurDansLaBrume` ; la garde `bobineTrouvee`
  // retirée de `lueurDeLaBrume` (une bobine trouvée luirait encore dans la brume).
  it('la brume ne luit que d’une bobine pas encore trouvée, et seulement quand le décor vit', () => {
    // À 0,2 s, l'éclat est au plus fort de son premier passage.
    const luit = (surcharge: Partial<VueMonde>) => {
      const { vue, appels } = vueFactice({ t: 0.2, ...surcharge })
      lueurDeLaBrume(vue)
      return appels.length
    }
    expect(luit({})).toBeGreaterThan(0)
    expect(luit({ vivant: false })).toBe(0)
    expect(luit({ bobineTrouvee: (i) => i === 1 })).toBe(0)
    expect(BRUME.y).toBeGreaterThan(820)
  })

  // Mutation : `if (vivant)` retiré de `dessinerBobinePerdue` : l'éclat brillerait l'horloge figée.
  it('une bobine perdue ne scintille pas quand rien ne bouge', () => {
    const dessin = (t: number, vivant: boolean) => {
      const { ctx, appels } = contexteFactice()
      dessinerBobinePerdue(ctx, 10, 10, 8, 0, t, vivant, c)
      return appels
    }
    expect(dessin(0.1, true).some((a) => a.composite === 'lighter')).toBe(true)
    expect(dessin(0.1, false).some((a) => a.composite === 'lighter')).toBe(false)
    expect(dessin(0.1, false)).toEqual(dessin(0.9, false))
  })
})
