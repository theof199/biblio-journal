import { afterEach, describe, expect, it, vi } from 'vitest'
import { brouillonInitial, construirePatch } from './patch'
import { exemple } from '../test/contrat'
import type { JournalItem, JournalPage } from '../api/journal'
import type { CandidatFilm } from './candidat'

const original: JournalItem = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!

describe('construirePatch', () => {
  it('ne porte que les champs qui ont changé', () => {
    const brouillon = brouillonInitial(original)
    expect(construirePatch(original, brouillon)).toEqual({})

    // Mutation : sans le test ci-dessus, un corps qui recopierait tout resterait indétecté.
    expect(construirePatch(original, { ...brouillon, date: '2020-01-01' })).toEqual({ finished_at: '2020-01-01' })
  })

  it('envoie `rating: null` pour effacer la note, jamais `undefined`', () => {
    const brouillon = brouillonInitial(original)
    const corps = construirePatch(original, { ...brouillon, note: null })
    expect(corps).toEqual({ rating: null })
    expect('rating' in corps).toBe(true)
  })

  it('compare les réactions comme un ensemble, pas comme une liste ordonnée', () => {
    const brouillon = brouillonInitial(original)
    const reordonnees = [...original.carnet.reactions].reverse()
    expect(construirePatch(original, { ...brouillon, reactions: reordonnees })).toEqual({})

    // Mutation : une vraie différence doit ressortir.
    expect(construirePatch(original, { ...brouillon, reactions: ['inconnue'] })).toEqual({ reactions: ['inconnue'] })
  })

  it('efface la remarque sur un texte vide, sans la réenvoyer si elle est inchangée', () => {
    const brouillon = brouillonInitial(original)
    expect(construirePatch(original, { ...brouillon, remarque: '   ' })).toEqual({ comment: null })
    expect(construirePatch(original, brouillon)).toEqual({})
  })
})

describe('brouillonInitial', () => {
  afterEach(() => vi.useRealTimers())

  it('part d’aujourd’hui, sans note, sans le visionnage d’une entrée', () => {
    // 0 h 30 à Paris, 22 h 30 la veille à Greenwich (fuseau figé dans `vite.config.ts`). Mutation :
    // un `toISOString()` daterait de la veille le film vu ce soir et noté après minuit.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 30, 0, 30))
    const brouillon = brouillonInitial()
    expect(brouillon.note).toBeNull()
    expect(brouillon.reactions).toEqual([])
    expect(brouillon.date).toBe('2026-09-30')
  })

  it('un candidat venu de l’import Letterboxd propose la date et la note de sa ligne', () => {
    const candidat: CandidatFilm = {
      source: 'tmdb', external_id: '348', title: 'Alien', year: 1979, cover_url: null, director: null,
      finished_at: '2026-09-01', rating: 9,
    }
    expect(brouillonInitial(undefined, candidat)).toMatchObject({ date: '2026-09-01', note: 9 })
  })

  it('un candidat sans date ni note (la recherche) garde aujourd’hui et pas de note', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 30, 12))
    const candidat: CandidatFilm = { source: 'tmdb', external_id: '348', title: 'Alien', year: 1979, cover_url: null, director: null }
    expect(brouillonInitial(undefined, candidat)).toMatchObject({ date: '2026-09-30', note: null })
  })

  it('en correction, l’entrée l’emporte sur tout candidat', () => {
    const candidat: CandidatFilm = {
      source: 'tmdb', external_id: '1', title: 'X', year: null, cover_url: null, director: null, finished_at: '2001-01-01', rating: 1,
    }
    expect(brouillonInitial(original, candidat).date).toBe(original.entry.finished_at)
  })

  it('reprend la date, la note, les réactions et la remarque de l’entrée corrigée', () => {
    const brouillon = brouillonInitial(original)
    expect(brouillon.date).toBe(original.entry.finished_at)
    expect(brouillon.note).toBe(original.entry.rating)
    expect(brouillon.reactions).toEqual(original.carnet.reactions)
    expect(brouillon.remarque).toBe(original.carnet.comment ?? '')
  })
})
