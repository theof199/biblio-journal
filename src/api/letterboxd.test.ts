import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DELAI_IMPORT, importerLetterboxd } from './letterboxd'
import type { RapportImport } from './letterboxd'
import { exemple } from '../test/contrat'

describe('importerLetterboxd', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('poste le CSV en JSON, `{ csv }`, jamais en text/csv', async () => {
    const rapport = exemple<RapportImport>('/me/journal/import/letterboxd', 'post', 200)
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(rapport), { status: 200 }))

    await expect(importerLetterboxd('Date,Name\n')).resolves.toEqual(rapport)

    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('/api/me/journal/import/letterboxd')
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ csv: 'Date,Name\n' }) })
  })

  it('attend cinq minutes, pas les 45 s d’une écriture ordinaire', async () => {
    expect(DELAI_IMPORT).toBe(300_000)
    vi.useFakeTimers()
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')))
        }),
    )
    const issue = importerLetterboxd('x').catch((e: unknown) => e)

    await vi.advanceTimersByTimeAsync(299_000)
    const temoin = Symbol('en cours')
    expect(await Promise.race([issue, Promise.resolve(temoin)])).toBe(temoin)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(await issue).toMatchObject({ code: 'TIMEOUT' })
  })
})
