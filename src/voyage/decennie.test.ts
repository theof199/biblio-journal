import { describe, expect, it, vi } from 'vitest'
import { anneeCivile, chevaux, decennieDeLAdresse, figureTouchee, palissade, registre } from './decennie'
import { voyage1890 } from '../test/voyage'
import { visionnage } from '../test/journal'

const V = voyage1890(1897, [
  { annee: 1895, statut: 'ouverte', recompense: 'palme', profondeur: 9, visitee: true },
  { annee: 1896, statut: 'ouverte', recompense: null, profondeur: 2, visitee: true },
  { annee: 1897, statut: 'en_cours', recompense: 'ours', profondeur: 4, visitee: true },
  { annee: 1898, statut: 'verrouillee', recompense: null, profondeur: 2, visitee: false },
  { annee: 1899, statut: 'verrouillee', recompense: 'ours', profondeur: 3, visitee: false },
  { annee: 1900, statut: 'verrouillee', recompense: null, profondeur: 0, visitee: false },
])

/** Un visionnage d'un film sorti `an`, avec sa couverture. */
const vu = (id: string, media: string, an: number, note: number | null = null) => {
  const v = visionnage({ id, media, annee: an, date: '2026-09-01', note })
  v.media.cover_url = `https://image.tmdb.org/t/p/w500/${media}.jpg`
  return v
}

describe('l’adresse d’une décennie', () => {
  // Mutations : accepter une année qui n'est pas un multiple de dix ; accepter une décennie à venir ; accepter 1880.
  it('n’ouvre qu’une décennie du Voyage, de 1890 à la décennie en cours', () => {
    expect(decennieDeLAdresse('1890', 2026)).toBe(1890)
    expect(decennieDeLAdresse('2020', 2026)).toBe(2020)
    expect(decennieDeLAdresse('1897', 2026)).toBeNull()
    expect(decennieDeLAdresse('2030', 2026)).toBeNull()
    expect(decennieDeLAdresse('1880', 2026)).toBeNull()
    expect(decennieDeLAdresse('années', 2026)).toBeNull()
    expect(decennieDeLAdresse(undefined, 2026)).toBeNull()
  })

  // Mutation : `maintenant.getFullYear()` (l'année de l'appareil) : sous UTC, 23 h 30 le 31 décembre
  // 2029 serait encore 2029, alors qu'à Paris la décennie 2030 est ouverte ; sous Honolulu, de même.
  it.each(['UTC', 'Pacific/Honolulu'])('lit l’année civile à Paris, pas dans le fuseau de l’appareil (%s)', (fuseau) => {
    vi.stubEnv('TZ', fuseau)
    try {
      expect(anneeCivile(new Date('2029-12-31T23:30:00.000Z'))).toBe(2030)
      expect(anneeCivile(new Date('2029-12-31T22:30:00.000Z'))).toBe(2029)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('le manège', () => {
  // Mutations : un cheval « avant » compté pour une année absente d'après 1895 ; l'avance sans films ; la
  // médaille d'une année en cours (l'état de la case prime).
  it('a un cheval par année : brut avant le départ, l’état de sa case ensuite, bâché verrouillé', () => {
    expect(chevaux(V, 1890)).toEqual([
      { annee: 1890, etat: 'avant' },
      { annee: 1891, etat: 'avant' },
      { annee: 1892, etat: 'avant' },
      { annee: 1893, etat: 'avant' },
      { annee: 1894, etat: 'avant' },
      { annee: 1895, etat: 'palme' },
      { annee: 1896, etat: 'passee' },
      { annee: 1897, etat: 'encours' },
      { annee: 1898, etat: 'avance' },
      { annee: 1899, etat: 'avance' },
    ])
    expect(chevaux(V, 1900)[0]).toEqual({ annee: 1900, etat: 'verrou' })
    // Une année après l'année civile n'est pas encore sur la carte : bâchée, jamais « avant ».
    expect(chevaux(V, 1900)[5]).toEqual({ annee: 1905, etat: 'verrou' })
  })
})

describe('le toucher du monument', () => {
  const figures = [
    { annee: 1895, x: 100, y: 200, r: 30 },
    { annee: 1896, x: 140, y: 200, r: 30 },
  ]

  // Mutations : la première figure qui contient le toucher plutôt que la plus proche ; le rayon ignoré
  // (un toucher dans le ciel ouvrirait une année au lieu d'emballer le manège).
  it('ouvre la figure la plus proche sous le doigt, rien à côté', () => {
    expect(figureTouchee(figures, { x: 128, y: 200 })).toBe(1896)
    expect(figureTouchee(figures, { x: 112, y: 200 })).toBe(1895)
    expect(figureTouchee(figures, { x: 100, y: 20 })).toBeNull()
    expect(figureTouchee([], { x: 100, y: 200 })).toBeNull()
  })
})

describe('le registre des recettes', () => {
  const items = [
    vu('e5', 'm3', 1897, 6),
    vu('e4', 'm2', 1897, 9),
    vu('e3', 'm1', 1897, null),
    vu('e2', 'm9', 1898, 8),
    vu('e1', 'm8', 1895, 7),
  ]

  // Mutations : la meilleure note prise sur une autre année ; la note nulle comptée comme zéro (-Infinity) ;
  // `vus` compté sur le journal plutôt que sur la carte.
  it('dit pour chaque année les films vus de la carte, sa récompense et ma meilleure note', () => {
    const lignes = registre(V, items, 1890)
    expect(lignes).toHaveLength(10)
    expect(lignes[7]).toEqual({ annee: 1897, vus: 4, recompense: 'ours', meilleureNote: 9, enCours: true, enAvance: false, ouvrable: true })
    expect(lignes[6]).toEqual({ annee: 1896, vus: 2, recompense: null, meilleureNote: null, enCours: false, enAvance: false, ouvrable: true })
  })

  // Mutations : la récompense tue pour une année verrouillée (le tampon, lui, la compte) ; « en avance »
  // dit d'une année verrouillée sans aucun film vu.
  it('garde la récompense d’une année vue en avance, et ne dit « en avance » qu’avec des films', () => {
    expect(registre(V, items, 1890)[9]).toMatchObject({ annee: 1899, recompense: 'ours', enAvance: true })
    expect(registre(V, items, 1890)[8]).toMatchObject({ annee: 1898, meilleureNote: 8, enAvance: true })
    expect(registre(V, items, 1900)[0]).toMatchObject({ annee: 1900, vus: 0, enAvance: false })
  })

  // Mutation : une série comptée dans la meilleure note.
  it('ne lit que des films', () => {
    const serie = vu('e6', 'm7', 1897, 10)
    serie.media.type = 'tv'
    expect(registre(V, [...items, serie], 1890)[7]!.meilleureNote).toBe(9)
  })

  // Mutation : une année avant le départ, ou absente de la carte, rendue ouvrable.
  it('n’ouvre que les années du Voyage que la carte porte', () => {
    expect(registre(V, items, 1890).map((l) => l.ouvrable)).toEqual([false, false, false, false, false, true, true, true, true, true])
    expect(registre(V, items, 1900).map((l) => l.ouvrable)).toEqual([true, false, false, false, false, false, false, false, false, false])
  })
})

describe('la palissade', () => {
  // Mutations : un film vu deux fois collé deux fois ; plus de quatre affiches ; « +N » compté sur les
  // affiches et non sur la carte ; une année d'une autre décennie.
  it('colle quatre affiches au plus par année, un film une fois, le reste en « +N »', () => {
    const items = [
      vu('e7', 'm1', 1895),
      vu('e6', 'm1', 1895),
      vu('e5', 'm2', 1895),
      vu('e4', 'm3', 1895),
      vu('e3', 'm4', 1895),
      vu('e2', 'm5', 1895),
    ]
    const [p1895] = palissade(V, items, 1890)
    expect(p1895).toEqual({
      annee: 1895,
      affiches: ['m1', 'm2', 'm3', 'm4'].map((m) => `https://image.tmdb.org/t/p/w500/${m}.jpg`),
      plus: 5,
      enAvance: false,
    })
    expect(palissade(V, items, 1890).map((p) => p.annee)).toEqual([1895, 1896, 1897, 1898, 1899])
  })

  // Mutation : une affiche nulle collée (une image cassée).
  it('ne colle pas un film sans affiche, mais le compte', () => {
    const sans = vu('e1', 'm6', 1896)
    sans.media.cover_url = null
    expect(palissade(V, [sans], 1890)[1]).toEqual({ annee: 1896, affiches: [], plus: 2, enAvance: false })
  })

  // Mutation : « en avance » sans regarder les films vus.
  it('dit une année verrouillée vue en avance, jamais une verrouillée sans film', () => {
    expect(palissade(V, [], 1890)[3]).toMatchObject({ annee: 1898, enAvance: true })
    expect(palissade(V, [], 1900)).toEqual([{ annee: 1900, affiches: [], plus: 0, enAvance: false }])
  })
})
