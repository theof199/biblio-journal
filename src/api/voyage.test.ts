import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DELAI_CHRONIQUEUR_MS,
  composerUneSeance,
  estPrete,
  ignorerLaSeance,
  lireAnnee,
  lireCarton,
  lireContexte,
  lireGenerique,
  ouvrirUneSalle,
  poserSurLePodium,
  prendreLaSeance,
  refusVu,
  remplacerDansLaSeance,
  renouvelerLesPistes,
  utiliserTicket,
  viderLaMarche,
  voirPlus,
  type FicheAnnee,
} from './voyage'
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

describe('le client de la fiche d’une année', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 }))))
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const parti = () => {
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    return { url, methode: init?.method, corps: init?.body === undefined ? undefined : JSON.parse(String(init.body)) }
  }

  // Mutations : une autre méthode, ou la place prise dans le corps plutôt que dans le chemin.
  it('pose sur une marche par `PUT`, la place dans le chemin, le film dans le corps', async () => {
    await poserSurLePodium(1897, 2, { tmdb_id: 12 })
    expect(parti()).toEqual({ url: '/api/me/voyage/annees/1897/podium/2', methode: 'PUT', corps: { tmdb_id: 12 } })
  })

  it('vide une marche par `DELETE`', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))
    await expect(viderLaMarche(1897, 3)).resolves.toBeUndefined()
    expect(parti()).toMatchObject({ url: '/api/me/voyage/annees/1897/podium/3', methode: 'DELETE' })
  })

  it('demande une fournée, une salle, les pistes, le refus vu, par leurs chemins', async () => {
    await voirPlus('s1')
    await ouvrirUneSalle(1897, { demande: 'Les fantômes', piste: 'Les fantômes' })
    await renouvelerLesPistes(1897)
    await refusVu('d1')
    const appels = vi.mocked(fetch).mock.calls.map(([url, init]) => `${init?.method} ${String(url)}`)
    expect(appels).toEqual([
      'POST /api/me/voyage/salles/s1/plus',
      'POST /api/me/voyage/annees/1897/salles',
      'POST /api/me/voyage/annees/1897/pistes',
      'POST /api/me/voyage/demandes-salles/d1/vue',
    ])
  })

  it('compose, prend, ignore et remplace une séance par leurs chemins', async () => {
    await composerUneSeance(1897)
    await prendreLaSeance('x')
    await ignorerLaSeance('x')
    await remplacerDansLaSeance('x', { morceau: 'court', film_id: 'f', bobine_tmdb_id: 3 })
    const appels = vi.mocked(fetch).mock.calls.map(([url, init]) => `${init?.method} ${String(url)}`)
    expect(appels).toEqual([
      'POST /api/me/voyage/annees/1897/seances',
      'POST /api/me/voyage/seances/x/prendre',
      'POST /api/me/voyage/seances/x/ignorer',
      'POST /api/me/voyage/seances/x/remplacer',
    ])
  })

  // Mutation : le délai d'écriture par défaut (45 s) sur un appel synchrone au chroniqueur.
  it('laisse 80 s aux trois appels synchrones au chroniqueur', async () => {
    const delai = vi.spyOn(AbortSignal, 'timeout')
    await lireContexte(1897, 's1')
    await renouvelerLesPistes(1897)
    await lireGenerique(1897)
    expect(delai.mock.calls.map(([ms]) => ms)).toEqual([DELAI_CHRONIQUEUR_MS, DELAI_CHRONIQUEUR_MS, DELAI_CHRONIQUEUR_MS])
    expect(DELAI_CHRONIQUEUR_MS).toBe(80_000)
  })

  it('lit le carton d’un film par `GET`, sans corps', async () => {
    await lireCarton(15)
    expect(parti()).toEqual({ url: '/api/reference/chroniques/films/15', methode: 'GET', corps: undefined })
  })

  // Les jumeaux des deux tests d'en haut : le test des délais ne lit pas les chemins, celui des
  // chemins ne lit pas les corps. Mutations : `…/plus` pour le contexte, `…/pistes` pour le
  // générique, un corps réécrit pour la salle nouvelle ou pour le remplacement.
  it('lit le contexte et le générique par leurs chemins, et envoie tels quels les corps d’une salle et d’un remplacement', async () => {
    await lireContexte(1897, 's1')
    await lireGenerique(1897)
    await ouvrirUneSalle(1897, { demande: 'Les fantômes', piste: 'Les fantômes' })
    await remplacerDansLaSeance('x', { morceau: 'court', film_id: 'f', bobine_tmdb_id: 3 })
    const partis = vi.mocked(fetch).mock.calls.map(([url, init]) => ({
      url,
      corps: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    }))
    expect(partis).toEqual([
      { url: '/api/me/voyage/annees/1897/salles/s1/contexte', corps: undefined },
      { url: '/api/me/voyage/annees/1897/generique', corps: undefined },
      { url: '/api/me/voyage/annees/1897/salles', corps: { demande: 'Les fantômes', piste: 'Les fantômes' } },
      { url: '/api/me/voyage/seances/x/remplacer', corps: { morceau: 'court', film_id: 'f', bobine_tmdb_id: 3 } },
    ])
  })

  // Mutation : le signal de l'appelant perdu en route : quitter la fiche n'annulerait plus la lecture.
  it('annule la lecture du carton avec l’appelant', async () => {
    const appelant = new AbortController()
    appelant.abort()
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      if (init?.signal?.aborted) throw new DOMException('annulée', 'AbortError')
      return new Response('{}', { status: 200 })
    })
    await expect(lireCarton(15, appelant.signal)).rejects.toThrow()
  })
})
