import { describe, expect, it } from 'vitest'
import {
  DECENNIES_DU_VOYAGE,
  REACTIONS_MONTREES,
  anneeDAdhesion,
  filmographieTerminee,
  filmsParDecennie,
  filmsParMois,
  heuresDeFilms,
  noteMoyenne,
  reactionsComptees,
  repartitionNotes,
} from './bilan'
import { visionnage as v } from '../test/journal'
import type { FilmSuivi } from '../suivis/prochain'

describe('noteMoyenne', () => {
  it('sur un journal sans note : nulle, jamais un zéro qui prétendrait à une moyenne', () => {
    expect(noteMoyenne([])).toBeNull()
    expect(noteMoyenne([v({ id: 'a', date: '2026-01-05' })])).toBeNull()
  })

  it('ne compte que les films notés, à une décimale, 8,25 arrondi à 8,3', () => {
    const j = [
      v({ id: 'a', date: '2026-01-01', note: 8 }),
      v({ id: 'b', date: '2026-01-02', note: 9 }),
      v({ id: 'c', date: '2026-01-03', note: 8 }),
      v({ id: 'd', date: '2026-01-04', note: 8 }),
      v({ id: 'e', date: '2026-01-05', note: null }),
    ]
    expect(noteMoyenne(j)).toBe(8.3)
  })
})

describe('heuresDeFilms', () => {
  it('arrondit les minutes à l’heure la plus proche', () => {
    expect(heuresDeFilms(12780)).toBe(213)
    expect(heuresDeFilms(12749)).toBe(212)
    expect(heuresDeFilms(0)).toBe(0)
  })
})

describe('anneeDAdhesion', () => {
  it('est l’année du visionnage le plus ancien, quel que soit l’ordre du journal', () => {
    const j = [v({ id: 'a', date: '2026-03-01' }), v({ id: 'b', date: '2019-12-31' }), v({ id: 'c', date: '2021-01-01' })]
    expect(anneeDAdhesion(j)).toBe(2019)
  })

  it('est nulle pour un journal vide', () => {
    expect(anneeDAdhesion([])).toBeNull()
  })
})

describe('filmsParMois', () => {
  it('douze comptes, janvier d’abord, ceux de l’année demandée seulement', () => {
    const j = [
      v({ id: 'a', date: '2026-09-29' }),
      v({ id: 'b', date: '2026-09-01' }),
      v({ id: 'c', date: '2026-01-15' }),
      v({ id: 'd', date: '2025-09-30' }),
      v({ id: 'e', date: '2027-09-30' }),
    ]
    expect(filmsParMois(j, 2026)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0])
  })

  it('décembre est le douzième', () => {
    expect(filmsParMois([v({ id: 'a', date: '2026-12-31' })], 2026)[11]).toBe(1)
  })

  it('chaque entrée compte, une revoyure le même mois aussi', () => {
    const j = [v({ id: 'a', media: 'm', date: '2026-09-02' }), v({ id: 'b', media: 'm', date: '2026-09-20' })]
    expect(filmsParMois(j, 2026)[8]).toBe(2)
  })

  it('un journal vide : douze zéros', () => {
    expect(filmsParMois([], 2026)).toEqual(new Array(12).fill(0))
  })
})

describe('filmsParDecennie', () => {
  it('quatorze décennies, de 1890 à 2020', () => {
    expect(DECENNIES_DU_VOYAGE).toHaveLength(14)
    expect(DECENNIES_DU_VOYAGE[0]).toBe(1890)
    expect(DECENNIES_DU_VOYAGE[13]).toBe(2020)
  })

  it('compte les films de chaque décennie, et sans année ne compte pour rien', () => {
    const j = [
      v({ id: 'a', annee: 1899, date: '2026-01-01' }),
      v({ id: 'b', annee: 2024, date: '2026-01-02' }),
      v({ id: 'c', annee: 2021, date: '2026-01-03' }),
      v({ id: 'd', annee: null, date: '2026-01-04' }),
    ]
    const comptes = filmsParDecennie(j)
    expect(comptes).toHaveLength(14)
    expect(comptes[0]).toBe(1)
    expect(comptes[13]).toBe(2)
    expect(comptes.reduce((a, b) => a + b, 0)).toBe(3)
  })

  it('une année d’avant 1890 ne tombe dans aucune décennie', () => {
    expect(filmsParDecennie([v({ id: 'a', annee: 1888, date: '2026-01-01' })]).some(Boolean)).toBe(false)
  })
})

describe('repartitionNotes', () => {
  it('dix comptes, de 1 à 10, et un film sans note n’entre dans aucune case', () => {
    const j = [
      v({ id: 'a', date: '2026-01-01', note: 1 }),
      v({ id: 'b', date: '2026-01-02', note: 10 }),
      v({ id: 'c', date: '2026-01-03', note: 10 }),
      v({ id: 'd', date: '2026-01-04', note: null }),
    ]
    expect(repartitionNotes(j)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 2])
  })

  it('un journal sans aucune note : dix zéros', () => {
    expect(repartitionNotes([v({ id: 'a', date: '2026-01-01' })])).toEqual(new Array(10).fill(0))
  })
})

describe('reactionsComptees', () => {
  const catalogue = [
    { cle: 'adore', emoji: '😍', phrase: 'Coup de cœur' },
    { cle: 'en_salle', emoji: '🍿', phrase: 'Vu en salle' },
    { cle: 'claque', emoji: '🤯', phrase: 'Claque' },
  ]

  it('la plus posée d’abord, avec son emoji, sa phrase et son compte', () => {
    const j = [
      v({ id: 'a', date: '2026-01-01', reactions: ['adore', 'en_salle'] }),
      v({ id: 'b', date: '2026-01-02', reactions: ['en_salle'] }),
    ]
    expect(reactionsComptees(j, catalogue)).toEqual([
      { cle: 'en_salle', emoji: '🍿', phrase: 'Vu en salle', nombre: 2 },
      { cle: 'adore', emoji: '😍', phrase: 'Coup de cœur', nombre: 1 },
    ])
  })

  it('ignore une clé que le catalogue ne connaît pas, et une réaction jamais posée', () => {
    const j = [v({ id: 'a', date: '2026-01-01', reactions: ['inconnue', 'adore'] })]
    expect(reactionsComptees(j, catalogue).map((r) => r.cle)).toEqual(['adore'])
  })

  it('à égalité, garde l’ordre du catalogue', () => {
    const j = [v({ id: 'a', date: '2026-01-01', reactions: ['claque', 'adore'] })]
    expect(reactionsComptees(j, catalogue).map((r) => r.cle)).toEqual(['adore', 'claque'])
  })

  it('n’en garde que six', () => {
    const large = Array.from({ length: 8 }, (_, i) => ({ cle: `r${i}`, emoji: '🎬', phrase: `R${i}` }))
    const j = [v({ id: 'a', date: '2026-01-01', reactions: large.map((r) => r.cle) })]
    expect(reactionsComptees(j, large)).toHaveLength(REACTIONS_MONTREES)
  })
})

describe('filmographieTerminee', () => {
  const vu = { entry_id: 'e', rating: null, finished_at: '2026-01-01' }
  const film = (tmdb_id: number, etat: 'vu' | 'a-voir' | 'introuvable'): FilmSuivi => ({
    tmdb_id,
    vu: etat === 'vu' ? vu : null,
    introuvable: etat === 'introuvable',
  })

  it('est terminée quand tout ce qui se trouve est vu : un introuvable ne compte pas contre', () => {
    expect(filmographieTerminee([film(10, 'vu'), film(11, 'introuvable')])).toBe(true)
    expect(filmographieTerminee([film(20, 'vu'), film(21, 'a-voir')])).toBe(false)
  })

  it('une filmographie vide est terminée : rien n’y reste à voir', () => {
    expect(filmographieTerminee([])).toBe(true)
  })
})
