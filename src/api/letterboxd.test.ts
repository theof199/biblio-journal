import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lancerImport, lireImport } from './letterboxd'
import type { TacheImport } from './letterboxd'
import { exemple } from '../test/contrat'

describe('l’import Letterboxd, tâche suivie', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('lance l’import en postant les CSV en JSON, `{ csv, watched_csv, ratings_csv }`, jamais en text/csv', async () => {
    const tache = exemple<TacheImport>('/me/journal/import/letterboxd', 'post', 202)
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(tache), { status: 202 }))

    const fichiers = { csv: 'Date,Name\n', watched_csv: 'Date,Name,Year\n', ratings_csv: 'Date,Name,Year,Rating\n' }
    await expect(lancerImport(fichiers)).resolves.toEqual(tache)

    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('/api/me/journal/import/letterboxd')
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify(fichiers) })
  })

  it('relit la tâche par son identifiant', async () => {
    const tache = exemple<TacheImport>('/me/journal/import/letterboxd/{id}', 'get', 200)
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(tache), { status: 200 }))

    await expect(lireImport(tache.id)).resolves.toEqual(tache)
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe(`/api/me/journal/import/letterboxd/${tache.id}`)
    expect(init).toMatchObject({ method: 'GET' })
  })
})
