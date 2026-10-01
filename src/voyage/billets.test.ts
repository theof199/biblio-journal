import { describe, expect, it } from 'vitest'
import { NUMERO_EN_ATTENTE, billetsDeLaDecennie, casier, intercalaires, numeroDe, numeroLisible, tirerLeNumero } from './billets'
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
    const billets = billetsDeLaDecennie(journal, 1890, 1895)
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
    expect(billetsDeLaDecennie([a, b], 1890, 1895).map((x) => x.item.entry.id)).toEqual(['a', 'b'])
    expect(billetsDeLaDecennie([b, a], 1890, 1895).map((x) => x.item.entry.id)).toEqual(['a', 'b'])
  })

  // Mutations : un film revu n'a qu'un billet ; une série a le sien ; un film sans année compte.
  it('donnent un billet par visionnage, jamais à une série ni à un film sans année', () => {
    const revu = vu('e6', 1896, '2026-09-25')
    revu.media.id = 'm-e5'
    const serie = vu('e7', 1896, '2026-09-26')
    serie.media.type = 'tv'
    const sansAnnee = vu('e8', 1896, '2026-09-27')
    sansAnnee.media.year = null
    expect(billetsDeLaDecennie([...journal, revu, serie, sansAnnee], 1890, 1895).map((b) => b.item.entry.id)).toEqual(['e3', 'e2', 'e5', 'e6'])
  })

  it('ne laissent pas la boîte d’une décennie à l’autre', () => {
    expect(billetsDeLaDecennie(journal, 1900, 1895).map((b) => [b.numero, b.item.entry.id])).toEqual([[1, 'e4']])
  })

  // Mutations : une borne stricte (`> debut` perd la première année, 1895 ou 1900 ; `< decennie + 9`
  // perd la dernière, 1899, celle qui manque au tampon) ; une borne élargie.
  it('comptent la première et la dernière année de la décennie, et rien au-delà', () => {
    const bords = [
      vu('b1', 1894, '2026-09-01'),
      vu('b2', 1895, '2026-09-02'),
      vu('b3', 1899, '2026-09-03'),
      vu('b4', 1900, '2026-09-04'),
      vu('b5', 1909, '2026-09-05'),
      vu('b6', 1910, '2026-09-06'),
    ]
    expect(billetsDeLaDecennie(bords, 1890, 1895).map((b) => b.item.entry.id)).toEqual(['b2', 'b3'])
    expect(billetsDeLaDecennie(bords, 1900, 1895).map((b) => b.item.entry.id)).toEqual(['b4', 'b5'])
  })

  // La boîte commence au départ du Voyage (décision du propriétaire du 1er octobre 2026) : un film de
  // 1892, vu le premier, n'a pas de billet et ne décale pas les numéros. Mutation : la borne prise à
  // la décennie (`decennie`) au lieu de `Math.max(depart, decennie)`.
  it('commencent au départ du Voyage : un film d’avant n’a ni billet ni numéro', () => {
    const avant = vu('p1', 1892, '2026-08-01')
    const apres = vu('p2', 1895, '2026-08-02')
    expect(billetsDeLaDecennie([apres, avant], 1890, 1895).map((b) => [b.numero, b.item.entry.id])).toEqual([[1, 'p2']])
  })

  // Mutation : la création avant la date du visionnage (D3 : la date d'abord). Un visionnage ancien
  // ajouté après coup (un import Letterboxd) prend son rang à sa date, et décale ceux qui le suivent.
  it('rangent un visionnage ancien ajouté après coup à sa date, pas à sa création', () => {
    const recent = vu('r1', 1896, '2026-09-20', '2026-09-20T21:00:00.000Z')
    const importe = vu('r2', 1897, '2019-03-02', '2026-09-28T10:00:00.000Z')
    expect(billetsDeLaDecennie([recent, importe], 1890, 1895).map((b) => [b.numero, b.item.entry.id])).toEqual([
      [1, 'r2'],
      [2, 'r1'],
    ])
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
    const billets = billetsDeLaDecennie([vu('e2', 1895, '2026-09-12'), vu('e3', 1897, '2026-09-13')], 1890, 1895)
    expect(numeroDe(billets, 'e3')).toBe(2)
    expect(numeroDe(billets, 'inconnu')).toBeNull()
  })
})

describe('la boîte', () => {
  const billets = billetsDeLaDecennie([vu('e1', 1895, '2026-09-01'), vu('e2', 1897, '2026-09-02'), vu('e3', 1895, '2026-09-03')], 1890, 1895)

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

describe('le numéroteur', () => {
  // Un hasard qui tire toujours 9 : un chiffre tiré se distingue des chiffres de 0413.
  const neuf = () => 0.95

  // Mutations : le seuil d'un chiffre décalé (`k > 7 + i / 2`, ou `k > 6 + i`) ; le numéro posé d'emblée.
  it('roule, puis pose le numéro chiffre après chiffre, de gauche à droite', () => {
    expect(tirerLeNumero(413, 0, neuf)).toBe('N° 9999')
    expect(tirerLeNumero(413, 6, neuf)).toBe('N° 9999')
    expect(tirerLeNumero(413, 7, neuf)).toBe('N° 0499')
    expect(tirerLeNumero(413, 8, neuf)).toBe('N° 0413')
    expect(tirerLeNumero(413, 9, neuf)).toBe('N° 0413')
  })

  // Mutation : un numéro inconnu qui se pose quand même (« N° 0000 »).
  it('sans numéro lu, roule jusqu’au bout', () => {
    expect(tirerLeNumero(null, 9, neuf)).toBe('N° 9999')
    expect(NUMERO_EN_ATTENTE).toBe('N° ····')
  })
})
