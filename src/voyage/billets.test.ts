import { describe, expect, it } from 'vitest'
import { billetsDeLaDecennie, casier, intercalaires, numeroDe, numeroLisible } from './billets'
import { visionnage } from '../test/journal'

/** Un visionnage d'un film sorti `an`, vu le `date`, créé à `cree`. */
const vu = (id: string, an: number, date: string, cree = `${date}T20:00:00.000Z`) => {
  const v = visionnage({ id, media: `m-${id}`, annee: an, date })
  v.entry.created_at = cree
  return v
}

describe('les billets d’une décennie', () => {
  // L'API rend le journal du plus récent au plus ancien : la boîte le remet dans l'ordre des visionnages.
  const journal = [
    vu('e5', 1896, '2026-09-20'),
    vu('e4', 1905, '2026-09-19'),
    // Le même jour : e3, créé le matin, passe avant e2, créé le soir — l'identifiant dirait l'inverse.
    vu('e3', 1897, '2026-09-12', '2026-09-12T08:00:00.000Z'),
    vu('e2', 1895, '2026-09-12', '2026-09-12T21:00:00.000Z'),
    vu('e1', 1889, '2026-09-01'),
  ]

  // Mutations : le tri retiré (l'ordre de l'API, décroissant) ; la date de création ignorée (deux
  // visionnages du même jour dans l'ordre de leur identifiant) ; une année hors de la décennie gardée.
  it('se numérotent dans l’ordre des visionnages, la création départageant un même jour', () => {
    const billets = billetsDeLaDecennie(journal, 1890)
    expect(billets.map((b) => [b.numero, b.item.entry.id])).toEqual([
      [1, 'e3'],
      [2, 'e2'],
      [3, 'e5'],
    ])
  })

  // Mutation : l'identifiant ne départage plus : deux entrées créées à la même milliseconde (l'import)
  // changeraient de rang d'une lecture à l'autre.
  it('gardent le même rang d’une lecture à l’autre, même créés à la même milliseconde', () => {
    const a = vu('b', 1895, '2026-09-12', '2026-09-12T08:00:00.000Z')
    const b = vu('a', 1895, '2026-09-12', '2026-09-12T08:00:00.000Z')
    expect(billetsDeLaDecennie([a, b], 1890).map((x) => x.item.entry.id)).toEqual(['a', 'b'])
    expect(billetsDeLaDecennie([b, a], 1890).map((x) => x.item.entry.id)).toEqual(['a', 'b'])
  })

  // Mutations : un film revu n'a qu'un billet ; une série a le sien ; un film sans année compte.
  it('donnent un billet par visionnage, jamais à une série ni à un film sans année', () => {
    const revu = vu('e6', 1896, '2026-09-25')
    revu.media.id = 'm-e5'
    const serie = vu('e7', 1896, '2026-09-26')
    serie.media.type = 'tv'
    const sansAnnee = vu('e8', 1896, '2026-09-27')
    sansAnnee.media.year = null
    expect(billetsDeLaDecennie([...journal, revu, serie, sansAnnee], 1890).map((b) => b.item.entry.id)).toEqual(['e3', 'e2', 'e5', 'e6'])
  })

  it('ne laissent pas la boîte d’une décennie à l’autre', () => {
    expect(billetsDeLaDecennie(journal, 1900).map((b) => [b.numero, b.item.entry.id])).toEqual([[1, 'e4']])
  })
})

describe('le numéroteur', () => {
  it('imprime quatre chiffres au moins', () => {
    expect(numeroLisible(7)).toBe('N° 0007')
    expect(numeroLisible(413)).toBe('N° 0413')
    expect(numeroLisible(12345)).toBe('N° 12345')
  })

  // Mutation : le numéro d'un autre billet (le premier).
  it('retrouve le numéro d’un visionnage, et rien hors de la boîte', () => {
    const billets = billetsDeLaDecennie([vu('e2', 1895, '2026-09-12'), vu('e3', 1897, '2026-09-13')], 1890)
    expect(numeroDe(billets, 'e3')).toBe(2)
    expect(numeroDe(billets, 'inconnu')).toBeNull()
  })
})

describe('la boîte', () => {
  const billets = billetsDeLaDecennie([vu('e1', 1895, '2026-09-01'), vu('e2', 1897, '2026-09-02'), vu('e3', 1895, '2026-09-03')], 1890)

  // Mutations : un intercalaire avant le départ du Voyage ; un compte sur toute la boîte.
  it('a un intercalaire par année du Voyage, avec son compte', () => {
    expect(intercalaires(billets, 1890, 1895)).toEqual([
      { annee: 1895, compte: 2 },
      { annee: 1896, compte: 0 },
      { annee: 1897, compte: 1 },
      { annee: 1898, compte: 0 },
      { annee: 1899, compte: 0 },
    ])
  })

  // Mutations : le casier dans l'ordre de la boîte (le premier devant) ; le filtre d'année retiré.
  it('ouvre le casier le dernier billet devant, tout ou une année', () => {
    expect(casier(billets, null).map((b) => b.numero)).toEqual([3, 2, 1])
    expect(casier(billets, 1895).map((b) => b.numero)).toEqual([3, 1])
    expect(billets.map((b) => b.numero)).toEqual([1, 2, 3])
  })
})
