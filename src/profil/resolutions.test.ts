import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ecrireResolutions, lireResolutions, type Resolution } from './resolutions'
import type { JournalItem } from '../api/journal'

const RESOLUTION: Resolution = {
  tmdb_id: '603',
  titre: 'Matrix',
  annee: 1999,
  item: { entry: { id: 'e1' } } as unknown as JournalItem,
}

describe('les lignes tranchées du rapport d’import, gardées dans ce navigateur', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('se relisent sous la clé de leur tâche, jamais sous celle d’une autre', () => {
    ecrireResolutions('t1', { 'diary:2': RESOLUTION })
    expect(lireResolutions('t1')).toEqual({ 'diary:2': RESOLUTION })
    expect(lireResolutions('t2')).toEqual({})
  })

  it('un localStorage qui lève (navigation privée, quota) ne casse ni la lecture ni l’écriture', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('refusé', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('plein', 'QuotaExceededError')
    })
    expect(lireResolutions('t1')).toEqual({})
    expect(() => ecrireResolutions('t1', { 'diary:2': RESOLUTION })).not.toThrow()
  })

  it('une valeur illisible ou d’une autre forme se lit comme un rapport sans ligne tranchée', () => {
    for (const brut of ['{pas du json', '[1,2]', '"texte"', 'null']) {
      localStorage.setItem('journal.import-letterboxd.t1', brut)
      expect(lireResolutions('t1')).toEqual({})
    }
  })
})
