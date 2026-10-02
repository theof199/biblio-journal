import { describe, expect, it } from 'vitest'
import { journalEnCache, numeroDeBillet, totalDuJournal } from './journalEnCache'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import { visionnage as v } from '../test/journal'
import type { Stats } from '../api/stats'

const pages = (...lots: { items: ReturnType<typeof v>[]; suite: string | null }[]) => ({
  pages: lots.map((lot) => ({ items: lot.items, next_cursor: lot.suite })),
  pageParams: lots.map(() => undefined),
})

describe('journalEnCache', () => {
  it('sans rien en cache, ne sait rien', () => {
    expect(journalEnCache(createQueryClient())).toBeNull()
  })

  it('rend les entrées des pages de l’accueil, dans leur ordre, d’une page à l’autre', () => {
    const client = createQueryClient()
    client.setQueryData(cles.journal, pages({ items: [v({ id: 'a', date: '2026-09-02' })], suite: 'c1' }, { items: [v({ id: 'b', date: '2026-08-02' })], suite: 'c2' }))

    expect(journalEnCache(client)?.items.map((i) => i.entry.id)).toEqual(['a', 'b'])
  })

  it('n’est complet que si la dernière page n’a plus de curseur', () => {
    const client = createQueryClient()
    client.setQueryData(cles.journal, pages({ items: [v({ id: 'a', date: '2026-09-02' })], suite: 'c1' }))
    expect(journalEnCache(client)?.complet).toBe(false)

    client.setQueryData(cles.journal, pages({ items: [v({ id: 'a', date: '2026-09-02' })], suite: null }))
    expect(journalEnCache(client)?.complet).toBe(true)
  })

  it('préfère le journal complet du profil, toujours complet', () => {
    const client = createQueryClient()
    client.setQueryData(cles.journal, pages({ items: [v({ id: 'a', date: '2026-09-02' })], suite: 'c1' }))
    client.setQueryData(cles.journalComplet, [v({ id: 'a', date: '2026-09-02' }), v({ id: 'z', date: '2020-01-01' })])

    expect(journalEnCache(client)).toMatchObject({ complet: true, items: [{ entry: { id: 'a' } }, { entry: { id: 'z' } }] })
  })

  it('ne lit pas un cache que l’écriture d’une création a périmé : il compterait le journal d’avant', () => {
    const client = createQueryClient()
    client.setQueryData(cles.journal, pages({ items: [v({ id: 'a', date: '2026-09-02' })], suite: null }))
    client.setQueryData(cles.journalComplet, [v({ id: 'a', date: '2026-09-02' })])
    void client.invalidateQueries({ queryKey: cles.journal })

    expect(journalEnCache(client)).toBeNull()
  })

  it('lit pourtant un cache périmé quand on le lui demande : un classement d’hier vaut mieux que pas de classement', () => {
    const client = createQueryClient()
    client.setQueryData(cles.journal, pages({ items: [v({ id: 'a', date: '2026-09-02' })], suite: null }))
    void client.invalidateQueries({ queryKey: cles.journal })

    expect(journalEnCache(client, { perime: true })?.items).toHaveLength(1)
  })

  it('une page sans entrée ni curseur est un journal vide mais complet, pas un cache absent', () => {
    const client = createQueryClient()
    client.setQueryData(cles.journal, pages({ items: [], suite: null }))

    expect(journalEnCache(client)).toEqual({ items: [], complet: true })
  })
})

const stats = (total: number) =>
  ({ dashboard: { periods: { all: { counts: { finished_by_type: { movie: total } } } } } }) as unknown as Stats

describe('totalDuJournal et numeroDeBillet', () => {
  it('lit les films du journal entier dans les stats du cache', () => {
    const client = createQueryClient()
    client.setQueryData(cles.stats, stats(412))

    expect(totalDuJournal(client)).toBe(412)
  })

  it('ne sait rien sans stats en cache', () => {
    expect(totalDuJournal(createQueryClient())).toBeNull()
  })

  it('ne lit pas des stats périmées : le numéro se répéterait d’un billet à l’autre', () => {
    const client = createQueryClient()
    client.setQueryData(cles.stats, stats(412))
    void client.invalidateQueries({ queryKey: cles.stats })

    expect(totalDuJournal(client)).toBeNull()
  })

  it('numérote le billet suivant, sur quatre chiffres', () => {
    expect(numeroDeBillet(412)).toBe('N° 0413')
    expect(numeroDeBillet(0)).toBe('N° 0001')
    expect(numeroDeBillet(12345)).toBe('N° 12346')
  })

  it('ne numérote pas sans total', () => {
    expect(numeroDeBillet(null)).toBeNull()
  })
})
