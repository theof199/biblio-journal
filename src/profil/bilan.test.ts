import { describe, expect, it } from 'vitest'
import {
  DECENNIES_DU_VOYAGE,
  bilanJournal,
  decenniesCouvertes,
  decenniesCouvertesGrille,
  filmsParMois,
  repartitionNotes,
} from './bilan'
import { visionnage as v } from '../test/journal'

describe('bilanJournal', () => {
  it('sur un journal vide : rien, jamais un zéro qui prétendrait à une moyenne', () => {
    expect(bilanJournal([], 2026)).toEqual({
      seancesEnSalle: 0,
      seancesEnSalleCetteAnnee: 0,
      noteMoyenne: null,
      decennies: null,
      plusAncien: null,
    })
  })

  it('un seul film, sans note : pas de moyenne, une décennie sur une', () => {
    const b = bilanJournal([v({ id: 'a', titre: 'Alien', annee: 1979, date: '2026-01-05' })], 2026)
    expect(b.noteMoyenne).toBeNull()
    expect(b.decennies).toEqual({ premiere: 1970, derniere: 1970, couvertes: 1, total: 1 })
    expect(b.plusAncien).toEqual({ titre: 'Alien', annee: 1979 })
  })

  it('la moyenne ne compte que les films notés, à une décimale, 8,25 arrondi à 8,3', () => {
    const j = [
      v({ id: 'a', date: '2026-01-01', note: 8 }),
      v({ id: 'b', date: '2026-01-02', note: 9 }),
      v({ id: 'c', date: '2026-01-03', note: 8 }),
      v({ id: 'd', date: '2026-01-04', note: 8 }),
      v({ id: 'e', date: '2026-01-05', note: null }),
    ]
    expect(bilanJournal(j, 2026).noteMoyenne).toBe(8.3)
  })

  it('les séances en salle : la réaction en_salle, revoyures comprises, dont celles de l’année donnée', () => {
    const j = [
      v({ id: 'a', media: 'm1', date: '2026-03-01', reactions: ['en_salle'] }),
      v({ id: 'b', media: 'm1', date: '2025-12-31', reactions: ['adore', 'en_salle'] }),
      v({ id: 'c', media: 'm2', date: '2026-01-01', reactions: ['adore'] }),
    ]
    const b = bilanJournal(j, 2026)
    expect(b.seancesEnSalle).toBe(2)
    expect(b.seancesEnSalleCetteAnnee).toBe(1)
  })

  it('une année sans séance : zéro cette année, sans toucher au total', () => {
    const j = [v({ id: 'a', date: '2025-06-01', reactions: ['en_salle'] })]
    expect(bilanJournal(j, 2026)).toMatchObject({ seancesEnSalle: 1, seancesEnSalleCetteAnnee: 0 })
  })

  it('le plus ancien ignore les films sans année, et garde le premier rencontré à année égale', () => {
    const j = [
      v({ id: 'a', titre: 'Sans année', annee: null, date: '2026-01-01' }),
      v({ id: 'b', titre: 'Récent', annee: 2010, date: '2026-01-02' }),
      v({ id: 'c', titre: 'Premier', annee: 1931, date: '2026-01-03' }),
      v({ id: 'd', titre: 'Second', annee: 1931, date: '2026-01-04' }),
    ]
    expect(bilanJournal(j, 2026).plusAncien).toEqual({ titre: 'Premier', annee: 1931 })
  })

  it('aucune année connue : pas de décennies', () => {
    expect(bilanJournal([v({ id: 'a', annee: null, date: '2026-01-01' })], 2026).decennies).toBeNull()
  })
})

describe('decenniesCouvertes', () => {
  it('« 1920 → 2020, 9 décennies sur 11 » : les vides de la fourchette ne comptent pas', () => {
    const annees = [1920, 1935, 1945, 1950, 1960, 1975, 1980, 1995, 2020]
    expect(decenniesCouvertes(annees)).toEqual({ premiere: 1920, derniere: 2020, couvertes: 9, total: 11 })
  })

  it('plusieurs films d’une même décennie ne la comptent qu’une fois', () => {
    expect(decenniesCouvertes([1980, 1981, 1989])).toEqual({ premiere: 1980, derniere: 1980, couvertes: 1, total: 1 })
  })

  it('refuse une liste vide plutôt que d’inventer une fourchette', () => {
    expect(() => decenniesCouvertes([])).toThrow()
  })
})

describe('filmsParMois', () => {
  it('douze mois glissants, le plus ancien d’abord, le mois courant en dernier', () => {
    const j = [
      v({ id: 'a', date: '2026-09-29' }),
      v({ id: 'b', date: '2026-09-01' }),
      v({ id: 'c', date: '2025-10-15' }),
      v({ id: 'd', date: '2025-09-30' }), // hors fenêtre : treize mois avant
    ]
    expect(filmsParMois(j, '2026-09')).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2])
  })

  it('la fenêtre franchit le changement d’année', () => {
    const j = [v({ id: 'a', date: '2025-12-24' }), v({ id: 'b', date: '2026-01-02' })]
    const mois = filmsParMois(j, '2026-02')
    // 2025-03 … 2026-02 : décembre est en 10e position (index 9), janvier en 11e.
    expect(mois).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0])
  })

  it('chaque entrée compte, une revoyure le même mois aussi', () => {
    const j = [v({ id: 'a', media: 'm', date: '2026-09-02' }), v({ id: 'b', media: 'm', date: '2026-09-20' })]
    expect(filmsParMois(j, '2026-09')[11]).toBe(2)
  })

  it('un journal vide : douze zéros', () => {
    expect(filmsParMois([], '2026-09')).toEqual(new Array(12).fill(0))
  })
})

describe('decenniesCouvertesGrille', () => {
  it('quatorze cases, de 1890 à 2020', () => {
    expect(DECENNIES_DU_VOYAGE).toHaveLength(14)
    expect(DECENNIES_DU_VOYAGE[0]).toBe(1890)
    expect(DECENNIES_DU_VOYAGE[13]).toBe(2020)
  })

  it('pleine là où un film est sorti, vide ailleurs, et sans année ne compte pour rien', () => {
    const j = [
      v({ id: 'a', annee: 1899, date: '2026-01-01' }),
      v({ id: 'b', annee: 2024, date: '2026-01-02' }),
      v({ id: 'c', annee: null, date: '2026-01-03' }),
    ]
    const g = decenniesCouvertesGrille(j)
    expect(g).toHaveLength(14)
    expect(g.filter(Boolean)).toHaveLength(2)
    expect(g[0]).toBe(true) // 1890
    expect(g[13]).toBe(true) // 2020
  })

  it('une année d’avant 1890 ne tombe dans aucune case', () => {
    expect(decenniesCouvertesGrille([v({ id: 'a', annee: 1888, date: '2026-01-01' })]).some(Boolean)).toBe(false)
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
