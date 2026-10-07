import { vi } from 'vitest'
import type { CaseVue, VueMonde } from '../mondes/types'
import { contexteFactice } from './contexteFactice'

/** La vue qu'un moteur passerait à un monde, au milieu de sa section, en plein jour, le décor vivant. */
export function vueFactice(surcharge: Partial<VueMonde> = {}) {
  const { ctx, appels } = contexteFactice()
  const zones: Array<{ id: string; data: number | undefined }> = []
  const vue: VueMonde = {
    ctx,
    W: 390,
    H: 700,
    k: 1,
    t: 3.2,
    vivant: true,
    presence: 1,
    lum: 1,
    nuit: 0.5,
    ecranY: (y, f) => 350 + (y - 700) * f,
    zone: (id, _x, _y, _r, data) => void zones.push({ id, data }),
    feu: vi.fn(),
    age: () => 99,
    marquer: vi.fn(),
    etincelles: vi.fn(),
    confettis: vi.fn(),
    fumee: vi.fn(),
    image: () => null,
    cases: [] as CaseVue[],
    bati: { n: 3, nouvelle: null, t0: -9 },
    bouclee: false,
    roulotte: null,
    adieu: -1,
    // Idée 8 : toute la foire ouverte et déjà bâtie, la brume sous la section.
    ouverte: { annee: 1899, t0: -9 },
    brume: 1240,
    bobine: vi.fn(),
    bobineTrouvee: () => false,
    objet: vi.fn(),
    objetRamasse: () => false,
    // Plan 3a : la caméra au haut de la section, hors de tout passage d'entrée.
    avance: 0,
    entree: -1,
    ...surcharge,
  }
  return { vue, appels, zones }
}
