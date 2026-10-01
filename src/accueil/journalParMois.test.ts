import { afterEach, describe, expect, it, vi } from 'vitest'
import { exemple } from '../test/contrat'
import { journalParMois } from './journalParMois'
import type { JournalItem, JournalPage } from '../api/journal'

const BASE = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!

function entree(id: string, finishedAt: string): JournalItem {
  return { ...BASE, entry: { ...BASE.entry, id, finished_at: finishedAt } }
}

const ids = (items: JournalItem[]) => items.map((item) => item.entry.id)

describe('journalParMois', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('ne rend aucun mois pour un journal vide', () => {
    expect(journalParMois([])).toEqual([])
  })

  it('garde la plus récente entrée dans son mois, comme les autres', () => {
    const mois = journalParMois([entree('a', '2026-09-26'), entree('b', '2026-09-20')])
    expect(mois.map((groupe) => ids(groupe.items))).toEqual([['a', 'b']])
  })

  it('groupe par mois civil de la date de visionnage, dans l’ordre reçu', () => {
    const mois = journalParMois([entree('a', '2026-09-26'), entree('b', '2026-09-20'), entree('c', '2026-08-31'), entree('d', '2026-08-02')])
    expect(mois.map((groupe) => [groupe.cle, ids(groupe.items)])).toEqual([
      ['2026-09', ['a', 'b']],
      ['2026-08', ['c', 'd']],
    ])
  })

  it('lit le mois dans la date elle-même, quel que soit le fuseau du téléphone', () => {
    // Le fuseau épinglé (Paris) est à l'est de Greenwich : une date lue à minuit UTC y garderait son
    // jour. À l'ouest, elle reculerait d'un jour, et le 1er août tomberait en juillet.
    vi.stubEnv('TZ', 'America/Los_Angeles')
    const mois = journalParMois([entree('a', '2026-09-26'), entree('b', '2026-08-01'), entree('c', '2026-07-31')])
    expect(mois.map((groupe) => groupe.cle)).toEqual(['2026-09', '2026-08', '2026-07'])
  })

  it('nomme le mois en toutes lettres, capitalisé, avec son année', () => {
    const mois = journalParMois([entree('a', '2026-08-15'), entree('b', '2025-12-31')])
    expect(mois.map((groupe) => groupe.libelle)).toEqual(['Août 2026', 'Décembre 2025'])
  })

  it('distingue le même mois de deux années', () => {
    const mois = journalParMois([entree('a', '2026-05-01'), entree('b', '2025-05-01')])
    expect(mois.map((groupe) => groupe.libelle)).toEqual(['Mai 2026', 'Mai 2025'])
  })

  it('complète un mois déjà ouvert quand une page suivante arrive, sans le dédoubler', () => {
    const premierePage = [entree('a', '2026-09-26'), entree('b', '2026-08-20')]
    const accumule = [...premierePage, entree('c', '2026-08-05'), entree('d', '2026-07-30')]
    expect(journalParMois(accumule).map((groupe) => [groupe.cle, ids(groupe.items)])).toEqual([
      ['2026-09', ['a']],
      ['2026-08', ['b', 'c']],
      ['2026-07', ['d']],
    ])
  })
})
