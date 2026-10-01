import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  corrigerVisionnage,
  creerVisionnage,
  curseurSuivant,
  dejaAuJournal,
  journalComplet,
  journalDesAnnees,
  lireJournal,
  supprimerVisionnage,
} from './journal'
import { cles } from './cles'
import { exemple } from '../test/contrat'
import brut from '../../contract/openapi.json?raw'
import type { AddMediaResponse, JournalItem, JournalPage } from './journal'

describe('curseurSuivant', () => {
  it('rend le curseur de la page suivante', () => {
    expect(curseurSuivant({ items: [], next_cursor: 'abc' })).toBe('abc')
  })

  it('rend `undefined` sur la dernière page, le type que déclare `getNextPageParam`', () => {
    // React Query v5 s’arrête aussi sur `null` (`!= null`) : ce test garde le type, pas l’arrêt,
    // que garde `pages/Accueil.test.tsx`.
    expect(curseurSuivant({ items: [], next_cursor: null })).toBeUndefined()
  })
})

describe('dejaAuJournal', () => {
  it('associe le tmdb_id de chaque film déjà vu à sa note', () => {
    const page = exemple<JournalPage>('/me/journal', 'get', 200)
    const table = dejaAuJournal([page])
    const item = page.items[0]!
    expect(table.get(item.media.external_id)).toBe(item.entry.rating)
  })

  it('garde la première rencontre — la plus récente, l’ordre du journal — plutôt que la dernière', () => {
    const item = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!
    const ancien = { ...item, entry: { ...item.entry, id: 'autre', rating: 3 } }
    expect(dejaAuJournal([{ items: [item, ancien], next_cursor: null }]).get(item.media.external_id)).toBe(
      item.entry.rating,
    )
  })

  it('ne connaît pas un film jamais vu', () => {
    expect(dejaAuJournal([{ items: [], next_cursor: null }]).has('27205')).toBe(false)
  })
})

describe('le client du journal', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('lit une page de mon journal', async () => {
    const page = exemple<JournalPage>('/me/journal', 'get', 200)
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(page), { status: 200 }))
    await expect(lireJournal({ limit: 20 })).resolves.toEqual(page)
    expect(fetch).toHaveBeenCalledWith('/api/me/journal?limit=20', expect.objectContaining({ method: 'GET' }))
  })

  it('crée un visionnage en deux appels, dans l’ordre : le média puis le journal', async () => {
    const media = exemple<AddMediaResponse>('/media', 'post', 201)
    const entree = exemple<JournalItem>('/me/journal', 'post', 201)
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(media), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(entree), { status: 201 }))

    await creerVisionnage(
      { source: 'tmdb', external_id: '27205', type: 'movie' },
      { finished_at: '2026-09-29' },
    )

    const appels = vi.mocked(fetch).mock.calls.map(([url, init]) => `${(init as RequestInit).method} ${String(url)}`)
    expect(appels).toEqual(['POST /api/media', 'POST /api/me/journal'])

    // Mutation : le second corps doit porter l'identifiant du média que le premier appel a rendu.
    const [, secondInit] = vi.mocked(fetch).mock.calls[1]!
    const corps = JSON.parse(String((secondInit as RequestInit).body)) as { media_id: string }
    expect(corps.media_id).toBe(media.media.id)
  })

  it('corrige un visionnage par son identifiant', async () => {
    const entree = exemple<JournalItem>('/me/journal/{id}', 'patch', 200)
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(entree), { status: 200 }))
    await corrigerVisionnage('e0000000-0000-4000-8000-000000000002', { rating: 8 })
    expect(fetch).toHaveBeenCalledWith(
      '/api/me/journal/e0000000-0000-4000-8000-000000000002',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('supprime un visionnage par son identifiant', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))
    await supprimerVisionnage('e0000000-0000-4000-8000-000000000002')
    expect(fetch).toHaveBeenCalledWith(
      '/api/me/journal/e0000000-0000-4000-8000-000000000002',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})

describe('journalComplet', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  const item = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!
  const page = (id: string, next: string | null): Response =>
    new Response(JSON.stringify({ items: [{ ...item, entry: { ...item.entry, id } }], next_cursor: next }), { status: 200 })

  it('suit les curseurs jusqu’au bout, par pages de 100, dans l’ordre', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(page('a', 'c2'))
      .mockResolvedValueOnce(page('b', 'c3'))
      .mockResolvedValueOnce(page('c', null))
    const tout = await journalComplet()
    expect(tout.map((i) => i.entry.id)).toEqual(['a', 'b', 'c'])
    expect(vi.mocked(fetch).mock.calls.map((c) => c[0])).toEqual([
      '/api/me/journal?limit=100',
      '/api/me/journal?limit=100&cursor=c2',
      '/api/me/journal?limit=100&cursor=c3',
    ])
  })

  it('une page en échec fait échouer le tout : un bilan sur un journal tronqué mentirait', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(page('a', 'c2'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'INTERNAL', message: 'Le journal n’a pas pu être lu.', retryable: false }), { status: 500 }),
      )
    await expect(journalComplet()).rejects.toMatchObject({ message: 'Le journal n’a pas pu être lu.' })
  })
})

describe('mes visionnages d’une fourchette d’années de sortie', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  const item = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!
  const page = (id: string, next: string | null): Response =>
    new Response(JSON.stringify({ items: [{ ...item, entry: { ...item.entry, id } }], next_cursor: next }), { status: 200 })

  // Mutations : une borne oubliée, ou les deux inversées ; le curseur perdu d'une page à l'autre.
  it('demande les deux bornes à chaque page, et suit les curseurs jusqu’au bout', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(page('a', 'c2')).mockResolvedValueOnce(page('b', null))
    const tout = await journalDesAnnees(1890, 1899)
    expect(tout.map((i) => i.entry.id)).toEqual(['a', 'b'])
    expect(vi.mocked(fetch).mock.calls.map((c) => c[0])).toEqual([
      '/api/me/journal?limit=100&sortie_min=1890&sortie_max=1899',
      '/api/me/journal?limit=100&cursor=c2&sortie_min=1890&sortie_max=1899',
    ])
  })

  // Mutation : une page en échec ignorée : la boîte numéroterait sur un journal tronqué.
  it('échoue tout entier quand une page échoue', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(page('a', 'c2'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'INTERNAL', message: 'Le journal n’a pas pu être lu.', retryable: false }), { status: 500 }))
    await expect(journalDesAnnees(1890, 1899)).rejects.toMatchObject({ message: 'Le journal n’a pas pu être lu.' })
  })

  // Le client écrit les noms des paramètres à la main (la requête n'est pas typée) : le contrat doit
  // les porter, sinon l'API les ignorerait et rendrait tout le journal. Mutation : `sortie_de` au lieu
  // de `sortie_min` dans le client (le premier test tombe) ; un contrat sans les paramètres (celui-ci).
  it('ne demande que des paramètres que le contrat déclare', () => {
    const contrat = JSON.parse(brut) as { paths: Record<string, { get: { parameters: { name: string; in: string }[] } }> }
    const noms = contrat.paths['/me/journal']!.get.parameters.filter((p) => p.in === 'query').map((p) => p.name)
    expect(noms).toEqual(expect.arrayContaining(['sortie_min', 'sortie_max']))
  })

  // Mutation : une clé hors du préfixe `journal` : un visionnage écrit ne périmerait pas la boîte.
  it('se range sous le préfixe du journal, que toute écriture périme', () => {
    expect(cles.journalDesAnnees(1890, 1899).slice(0, cles.journal.length)).toEqual([...cles.journal])
    expect(cles.journalDesAnnees(1890, 1899)).not.toEqual(cles.journalDesAnnees(1900, 1909))
  })

  // Mutation : la clé sans sa borne haute. L'année fermée de 1900 (`journalDesAnnees(1900, 1900)`,
  // plan 2c, tâche 11) et la décennie 1900 (`(1900, 1909)`) partageraient alors leur cache.
  it('distingue deux fourchettes qui partent de la même année', () => {
    expect(cles.journalDesAnnees(1900, 1900)).not.toEqual(cles.journalDesAnnees(1900, 1909))
  })
})
