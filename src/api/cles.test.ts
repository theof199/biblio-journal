import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryObserver } from '@tanstack/react-query'
import { cles } from './cles'
import { createQueryClient } from './queryClient'
import { lireCourrier, lireMalle, lireVoyageur, type Courrier, type Malle, type Voyageur } from './voyage'
import { exemple } from '../test/contrat'
import { json, servir } from '../test/serveur'

/**
 * L'état du voyageur et la malle vivent sous le préfixe `voyage` (plan des écrans des lots, brief 0) :
 * une écriture au journal périme ce préfixe (`pages/Formulaire.tsx`, `pages/VoyageBillet.tsx`), et
 * une requête montée sous l'une de ces clés est alors relue, sans qu'aucune page hors Voyage les
 * connaisse. `pages/VoyageBillet.test.tsx` tient l'autre bout : le billet périme bien ces deux clés.
 * Le courrier les y rejoint (brief 13) : `en_attente` liste mes gares bouclées sans carte, et c'est un
 * billet composté qui boucle une gare.
 */
const VOYAGEUR = 'GET /api/me/voyage/voyageur'
const MALLE = 'GET /api/me/voyage/decennies/1900/etiquettes'
const COURRIER = 'GET /api/me/voyage/cartes-postales'

describe('les clés de l’état du voyageur et de la malle', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  // Mutations, dans `cles.ts` : `voyageur` sorti du préfixe (`['voyageur']`) ; `malle` sortie du
  // préfixe (`['malle', decennie]`) ; `courrier` sorti du préfixe (`['courrier']`). Dans chaque cas la
  // requête garde ce qu'elle a lu avant le billet.
  it('une requête montée sous chacune est relue quand le préfixe `voyage` est périmé', async () => {
    const requetes = servir({
      [VOYAGEUR]: () => json(exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)),
      [MALLE]: () => json(exemple<Malle>('/me/voyage/decennies/{decennie}/etiquettes', 'get', 200)),
      [COURRIER]: () => json(exemple<Courrier>('/me/voyage/cartes-postales', 'get', 200)),
    })
    const client = createQueryClient()
    const montees = [
      new QueryObserver(client, { queryKey: cles.voyageur, queryFn: ({ signal }) => lireVoyageur(signal) }),
      new QueryObserver(client, { queryKey: cles.malle(1900), queryFn: ({ signal }) => lireMalle(1900, signal) }),
      new QueryObserver(client, { queryKey: cles.courrier, queryFn: ({ signal }) => lireCourrier(signal) }),
    ]
    const demonter = montees.map((o) => o.subscribe(() => {}))
    await vi.waitFor(() => expect([...requetes].sort()).toEqual([COURRIER, MALLE, VOYAGEUR]))
    await vi.waitFor(() => expect(client.isFetching()).toBe(0))

    // Ce que fait toute écriture au journal, mot pour mot.
    await client.invalidateQueries({ queryKey: cles.voyage })

    expect([...requetes].sort()).toEqual([COURRIER, COURRIER, MALLE, MALLE, VOYAGEUR, VOYAGEUR])
    for (const d of demonter) d()
  })

  // Deux décennies, deux malles : la malle de 1900 ne se sert pas à qui demande celle de 1910.
  // Mutation : la décennie retirée de la clé (`['voyage', 'malle']`).
  it('la malle se range par décennie, et ne se confond ni avec la carte ni avec l’état du voyageur', () => {
    expect(cles.malle(1900)).not.toEqual(cles.malle(1910))
    const toutes = [cles.voyage, cles.tickets, cles.depenses, cles.annee(1900), cles.voyageur, cles.malle(1900), cles.courrier].map((c) => JSON.stringify(c))
    expect(new Set(toutes).size).toBe(toutes.length)
  })
})
