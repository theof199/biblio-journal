import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { estPrete, lireAnnee, utiliserTicket, type FicheAnnee } from './voyage'
import { exemple } from '../test/contrat'

describe('le client du Voyage', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  // Le `202` « en préparation » est une réponse, pas une panne : la fiche se relira.
  it('rend la fiche en préparation telle quelle', async () => {
    const corps = exemple('/me/voyage/annees/{annee}', 'get', 202)
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(corps), { status: 202 }))
    await expect(lireAnnee(1898)).resolves.toMatchObject({ statut: 'en_preparation' })
    expect(fetch).toHaveBeenCalledWith('/api/me/voyage/annees/1898', expect.objectContaining({ method: 'GET' }))
  })

  // Mutation : `annee + 1` ou une autre année dans le chemin encaisserait le mauvais ticket.
  it('encaisse le ticket de l’année qu’il ouvre', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{"annee_en_cours":1899}', { status: 200 }))
    await expect(utiliserTicket(1899)).resolves.toEqual({ annee_en_cours: 1899 })
    expect(fetch).toHaveBeenCalledWith('/api/me/voyage/tickets/1899/utiliser', expect.objectContaining({ method: 'POST' }))
  })

  // Mutation : `estPrete` qui ne regarde que l'existence : `{ configure: false }` et le `202`
  // passeraient pour des fiches, et la colonne Morris lirait un podium qui n'existe pas.
  it('ne prend pour une fiche prête que la forme `prete`', () => {
    expect(estPrete(exemple<FicheAnnee>('/me/voyage/annees/{annee}', 'get', 200))).toBe(true)
    expect(estPrete(exemple<FicheAnnee>('/me/voyage/annees/{annee}', 'get', 202))).toBe(false)
    expect(estPrete({ configure: false })).toBe(false)
    expect(estPrete(undefined)).toBe(false)
  })
})
