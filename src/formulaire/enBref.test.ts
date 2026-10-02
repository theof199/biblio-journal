import { describe, expect, it } from 'vitest'
import { ligneMois, ligneSeance, ligneSuivi, rangEnLettres, type SeanceEcrite } from './enBref'
import { visionnage as v } from '../test/journal'
import type { FilmSuivi } from '../suivis/prochain'

const SEANCE: SeanceEcrite = { entryId: 'neuve', rating: 8, finishedAt: '2026-10-02' }
const vu = (jour = '2026-01-01') => ({ entry_id: 'ancien', rating: null, finished_at: jour })
const film = (id: number, etat: 'vu' | 'a-voir' | 'introuvable' = 'a-voir'): FilmSuivi => ({
  tmdb_id: id,
  vu: etat === 'vu' ? vu() : null,
  introuvable: etat === 'introuvable',
})

describe('rangEnLettres', () => {
  it.each([
    [1, 'Premier'],
    [2, 'Deuxième'],
    [4, 'Quatrième'],
    [10, 'Dixième'],
    [11, '11ᵉ'],
    [23, '23ᵉ'],
  ])('le rang %i s’écrit « %s »', (rang, mot) => {
    expect(rangEnLettres(rang)).toBe(mot)
  })
})

describe('ligneSuivi', () => {
  it('compte la séance qu’on vient d’écrire : une de plus sur le total', () => {
    const ligne = ligneSuivi('realisateurs', 'Agnès Varda', [film(1, 'vu'), film(2), film(3)], 2, SEANCE, false)

    // Mutation : le film de la séance qui n'est pas compté vu (`apres` remplacé par `films`).
    expect(ligne).toMatchObject({ type: 'suivi', genre: 'Rétrospective', nom: 'Agnès Varda', vus: 2, total: 3, boucle: false })
  })

  it('marque le film de la séance d’un trou neuf, les vus poinçonnés, les autres vides', () => {
    const ligne = ligneSuivi('realisateurs', 'Agnès Varda', [film(1, 'vu'), film(2), film(3)], 2, SEANCE, false)

    // Mutation : le trou neuf posé sur le mauvais rang, ou le « prochain » laissé cerclé.
    expect(ligne?.trous).toEqual(['vu', 'neuf', 'pas-encore'])
  })

  it('boucle le suivi quand c’était le dernier film à voir', () => {
    const ligne = ligneSuivi('realisateurs', 'Agnès Varda', [film(1, 'vu'), film(2)], 2, SEANCE, false)

    expect(ligne).toMatchObject({ vus: 2, total: 2, boucle: true })
  })

  it('boucle aussi quand les autres films restants sont introuvables', () => {
    const ligne = ligneSuivi('realisateurs', 'Agnès Varda', [film(1, 'introuvable'), film(2)], 2, SEANCE, false)

    expect(ligne?.boucle).toBe(true)
    expect(ligne?.trous).toEqual(['introuvable', 'neuf'])
  })

  it('ne boucle pas tant qu’un film reste à voir', () => {
    expect(ligneSuivi('realisateurs', 'Agnès Varda', [film(1), film(2), film(3, 'vu')], 2, SEANCE, false)?.boucle).toBe(false)
  })

  it('une revoyure ne fait pas avancer le compte et ne boucle rien, même sur un suivi déjà bouclé', () => {
    const ligne = ligneSuivi('realisateurs', 'Agnès Varda', [film(1, 'vu'), film(2, 'vu')], 2, SEANCE, false)

    // Mutation : le film déjà vu compté une seconde fois, ou « boucle » lu sur l'état d'après seul.
    expect(ligne).toMatchObject({ vus: 2, total: 2, boucle: false })
    expect(ligne?.trous).toEqual(['vu', 'vu'])
  })

  it('un cycle s’écrit « Cycle », et son compte suit « Masquer les introuvables » comme sa planche', () => {
    const films = [film(1, 'vu'), film(2, 'introuvable'), film(3), film(4)]

    expect(ligneSuivi('sagas', 'Mad Max', films, 3, SEANCE, true)).toMatchObject({ genre: 'Cycle', vus: 2, total: 3 })
    expect(ligneSuivi('sagas', 'Mad Max', films, 3, SEANCE, false)).toMatchObject({ vus: 2, total: 4 })
  })

  it('n’a pas de ligne pour un film qui n’est pas dans la filmographie', () => {
    expect(ligneSuivi('realisateurs', 'Agnès Varda', [film(1), film(2)], 99, SEANCE, false)).toBeNull()
  })
})

describe('ligneSeance', () => {
  /** Une entrée du journal pour le film `externalId` (celui que `media.external_id` désigne). */
  const seance = (id: string, externalId: string, date: string, titre = 'Rashōmon') => {
    const base = v({ id, titre, date })
    return { ...base, media: { ...base.media, external_id: externalId } }
  }
  const ecrite = seance('neuve', 'm1', '2026-10-02')

  it('dit la deuxième séance quand le film est déjà au journal sous une autre entrée', () => {
    expect(ligneSeance([seance('ancienne', 'm1', '2024-03-14')], ecrite)).toEqual({ type: 'seance', titre: 'Rashōmon', rang: 2 })
  })

  it('compte les séances d’avant : la troisième après deux', () => {
    expect(ligneSeance([seance('a', 'm1', '2024-03-14'), seance('b', 'm1', '2023-01-01')], ecrite)?.rang).toBe(3)
  })

  it('ne compte pas l’entrée qu’on vient d’écrire contre elle-même', () => {
    // Le cache la connaît parfois déjà : l'API corrige l'entrée du même jour au lieu d'en créer une seconde.
    expect(ligneSeance([ecrite], ecrite)).toBeNull()
  })

  it('n’a pas de ligne pour un film que le journal ne connaît pas', () => {
    expect(ligneSeance([seance('x', 'autre', '2024-03-14')], ecrite)).toBeNull()
  })
})

describe('ligneMois', () => {
  const ecrite = v({ id: 'neuve', date: '2026-10-02' })
  const octobre = (...ids: string[]) => ids.map((id, rang) => v({ id, date: `2026-10-0${rang + 1}` }))

  it('compte le film dans son mois quand le cache va plus loin que lui', () => {
    const journal = { items: [...octobre('a', 'b', 'c'), v({ id: 'z', date: '2026-09-30' })], complet: false }

    // Mutation : le mois dont on ne prouve pas le début compté quand même, ou le film oublié (`+ 1`).
    expect(ligneMois(journal, ecrite)).toEqual({ type: 'mois', mois: 'Octobre 2026', rang: 4 })
  })

  it('compte dans un journal complet, même quand aucune entrée n’est d’avant le mois', () => {
    expect(ligneMois({ items: octobre('a', 'b', 'c'), complet: true }, ecrite)?.rang).toBe(4)
  })

  it('ne dit rien quand le cache ne prouve pas qu’il tient tout le mois', () => {
    // Que des entrées d'octobre, et une suite à charger : septembre n'est jamais atteint.
    expect(ligneMois({ items: octobre('a', 'b', 'c'), complet: false }, ecrite)).toBeNull()
  })

  it('ne dit rien d’un journal en cache vide et partiel', () => {
    expect(ligneMois({ items: [], complet: false }, ecrite)).toBeNull()
  })

  it('un journal vide mais complet fait de ce film le premier du mois', () => {
    expect(ligneMois({ items: [], complet: true }, ecrite)?.rang).toBe(1)
  })

  it('ne compte que les entrées du même mois, pas celles d’un autre mois de la même année', () => {
    const journal = { items: [...octobre('a'), v({ id: 'y', date: '2026-08-15' }), v({ id: 'z', date: '2025-10-10' })], complet: true }

    expect(ligneMois(journal, ecrite)?.rang).toBe(2)
  })

  it('ne compte pas l’entrée qu’on vient d’écrire contre elle-même', () => {
    expect(ligneMois({ items: [ecrite, v({ id: 'z', date: '2026-09-30' })], complet: false }, ecrite)?.rang).toBe(1)
  })

  it('un film d’un mois passé se compte dans son mois : celui de sa date, pas celui d’aujourd’hui', () => {
    const passe = v({ id: 'neuve', date: '2026-08-20' })
    const journal = { items: [v({ id: 'a', date: '2026-08-05' }), v({ id: 'z', date: '2026-07-31' })], complet: false }

    expect(ligneMois(journal, passe)).toEqual({ type: 'mois', mois: 'Août 2026', rang: 2 })
  })
})
