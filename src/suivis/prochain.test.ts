import { describe, expect, it } from 'vitest'
import { entiteEnCours, filmsSansSeries, filmsVus, prochainAVoir } from './prochain'
import type { FilmSuivi } from './prochain'

const vu = (id: string): FilmSuivi['vu'] => ({ entry_id: id, rating: 8, finished_at: '2026-01-01' })

const film = (tmdbId: number, overrides: Partial<FilmSuivi> = {}): FilmSuivi => ({
  tmdb_id: tmdbId,
  vu: null,
  introuvable: false,
  ...overrides,
})

describe('filmsVus', () => {
  it('compte les films dont `vu` est non nul', () => {
    const films = [film(1, { vu: vu('e1') }), film(2), film(3, { vu: vu('e3') })]
    expect(filmsVus(films)).toBe(2)
    // Mutation : un film à voir en plus ne doit rien changer au compte.
    expect(filmsVus([...films, film(4)])).toBe(2)
  })
})

describe('prochainAVoir', () => {
  it('rend le premier film ni vu ni introuvable, dans l’ordre de la liste', () => {
    const films = [film(1, { vu: vu('e1') }), film(2, { introuvable: true }), film(3), film(4)]
    expect(prochainAVoir(films)?.tmdb_id).toBe(3)
  })

  it('ignore les films marqués introuvables même non vus', () => {
    const films = [film(1, { introuvable: true }), film(2, { introuvable: true })]
    expect(prochainAVoir(films)).toBeUndefined()
  })

  it('rend `undefined` quand il n’y a plus rien à voir', () => {
    const films = [film(1, { vu: vu('e1') }), film(2, { introuvable: true })]
    expect(prochainAVoir(films)).toBeUndefined()
  })
})

describe('filmsSansSeries', () => {
  it('écarte les séries, garde les films', () => {
    const items = [
      { type: 'movie' as const, tmdb_id: 1 },
      { type: 'tv' as const, tmdb_id: 2 },
      { type: 'movie' as const, tmdb_id: 3 },
    ]
    expect(filmsSansSeries(items).map((i) => i.tmdb_id)).toEqual([1, 3])
  })
})

describe('entiteEnCours', () => {
  const entiteA = { tmdb_id: 10, nom: 'A' }
  const entiteB = { tmdb_id: 20, nom: 'B' }
  const entiteC = { tmdb_id: 30, nom: 'C' }

  it('choisit l’entité qui a le plus de films vus, parmi celles qui ont encore un film à voir', () => {
    const filmographies = new Map([
      [10, [film(1, { vu: vu('e1') }), film(2)]], // 1 vu, 1 à voir
      [20, [film(3, { vu: vu('e3') }), film(4, { vu: vu('e4') }), film(5)]], // 2 vus, 1 à voir
    ])
    const gagnant = entiteEnCours([entiteA, entiteB], filmographies)
    expect(gagnant?.entite).toBe(entiteB)
    expect(gagnant?.prochain.tmdb_id).toBe(5)
  })

  it('écarte une entité entièrement vue : rien à proposer, elle ne peut pas gagner', () => {
    const filmographies = new Map([
      [10, [film(1, { vu: vu('e1') })]], // tout vu : ne participe pas
      [20, [film(2)]], // 0 vu, 1 à voir : seule candidate
    ])
    const gagnant = entiteEnCours([entiteA, entiteB], filmographies)
    expect(gagnant?.entite).toBe(entiteB)
  })

  it('à égalité de films vus, la première entité de la liste l’emporte', () => {
    const filmographies = new Map([
      [10, [film(1, { vu: vu('e1') }), film(2)]],
      [20, [film(3, { vu: vu('e3') }), film(4)]],
    ])
    const gagnant = entiteEnCours([entiteA, entiteB], filmographies)
    expect(gagnant?.entite).toBe(entiteA)
  })

  it('rend `null` si aucune filmographie connue n’a de film à voir', () => {
    const filmographies = new Map([[10, [film(1, { vu: vu('e1') })]]])
    expect(entiteEnCours([entiteA], filmographies)).toBeNull()
  })

  it('ignore une entité dont la filmographie n’est pas encore connue', () => {
    const filmographies = new Map([[20, [film(1)]]])
    const gagnant = entiteEnCours([entiteA, entiteB, entiteC], filmographies)
    expect(gagnant?.entite).toBe(entiteB)
  })
})
