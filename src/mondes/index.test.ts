import { describe, expect, it, vi } from 'vitest'
import { creerRegistre } from '.'
import { mondeAVenir } from './avenir'
import type { Monde, VueMonde, VueMonument } from './types'
import { contexteFactice } from '../test/contexteFactice'
import { vueFactice } from '../test/vueFactice'

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

  // Plan 2d. Mutations : une musique ou une bobine donnée au monde « à venir », ou un `v.bobine(…)`
  // dans l'un de ses plans (la porte).
  it('ne fait jouer ni ne cache rien au monde « à venir »', () => {
    const monde = creerRegistre()(1950)
    expect(monde.musique).toBeNull()
    expect(monde.bobines).toEqual([])
    const { vue } = vueFactice()
    monde.dessinerCiel(vue)
    monde.dessinerLointain(vue)
    monde.dessinerMoyen(vue)
    monde.dessinerSol(vue, { x: 195, y: 400 })
    monde.dessinerProche(vue)
    monde.dessinerSurLaBrume(vue)
    expect(vue.bobine).not.toHaveBeenCalled()
  })

  /** Les clés de bobine portées par plus d'un monde, ou deux fois par le même. */
  const clesEnDouble = (mondes: readonly Monde[]) => {
    const cles = mondes.flatMap((m) => m.bobines.map((b) => b.cle))
    return [...new Set(cles.filter((cle, i) => cles.indexOf(cle) !== i))]
  }
  /** Chaque monde du registre, une fois : les décennies sans ligne partagent le monde « à venir », qui ne cache rien. */
  const mondesDuRegistre = () => {
    const registre = creerRegistre()
    return Array.from({ length: 16 }, (_, i) => registre(1880 + 10 * i))
  }
  const mondeDEssai = (cle: string): Monde => ({ ...mondeAVenir(1900), bobines: [{ cle, titre: 'Bobine d’essai', qui: 'Personne, 1900' }] })

  // Plan 3a, tâche 7 : le compteur va par décennie, et l'appareil ne retient que la clé ; une clé
  // portée par deux mondes compterait une trouvaille dans les deux. Le registre n'a aujourd'hui qu'un
  // monde à bobines : un monde d'essai se joint à lui, comme le fera la ligne de 1900.
  // Mutations : une clé de 1890 recopiée dans le monde d'essai (la deuxième assertion) ; une clé
  // répétée dans `BOBINES` de 1890, ou une bobine de même clé donnée au monde « à venir » (la
  // première) ; `clesEnDouble` qui ne rendrait jamais rien (la troisième).
  it('ne laisse pas deux mondes porter la même clé de bobine', () => {
    expect(mondesDuRegistre().some((m) => m.bobines.length > 0)).toBe(true)
    expect(clesEnDouble(mondesDuRegistre())).toEqual([])
    expect(clesEnDouble([...mondesDuRegistre(), mondeDEssai('bobine-d-essai-1900')])).toEqual([])
    const de1890 = creerRegistre()(1890).bobines[0]!.cle
    expect(clesEnDouble([...mondesDuRegistre(), mondeDEssai(de1890)])).toEqual([de1890])
  })
})
