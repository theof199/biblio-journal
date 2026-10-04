import { describe, expect, it } from 'vitest'
import type { CinemaDuFilm, CinemaDuJour, SeanceDuJour } from '../api/seances'
import {
  cinemasDuFilmAVenir,
  dansCombien,
  distanceDuCinema,
  entreesDuTableau,
  estAVenir,
  heureAffichee,
  prochaineSeanceParFilm,
} from './seances'

/** 18:55 à Paris, le 3 octobre 2026 (CEST, +02:00) : l'heure de la maquette. */
const MAINTENANT = Date.parse('2026-10-03T18:55:00+02:00')
const heure = (hhmm: string) => `2026-10-03T${hhmm}:00+02:00`

const HALLES: CinemaDuJour = { id: 'C1', nom: 'UGC Les Halles', latitude: 48.8625, longitude: 2.3466 }
const ODEON: CinemaDuJour = { id: 'C2', nom: 'UGC Odéon', latitude: 48.8527, longitude: 2.3385 }
const CHAMPO: CinemaDuJour = { id: 'C3', nom: 'Le Champo', latitude: null, longitude: null }
/** Un point près des Halles : les Halles sont plus proches qu'Odéon. */
const POSITION = { latitude: 48.8606, longitude: 2.3376 }

function seance(debutHHMM: string, cinema: CinemaDuJour, titre: string, extra: Partial<SeanceDuJour> = {}): SeanceDuJour {
  return {
    debut: heure(debutHHMM),
    version: 'VF',
    cinema_id: cinema.id,
    film: { tmdb_id: titre.length, title: titre, year: 2026, cover_url: null },
    nouveaute: true,
    marque: null,
    ...extra,
  }
}

const titresDe = (entrees: ReturnType<typeof entreesDuTableau>) => entrees.map((entree) => entree.seance.film.title)

describe('estAVenir', () => {
  it('une séance commencée n’est plus à venir, au pas de la milliseconde', () => {
    expect(estAVenir(heure('18:55'), MAINTENANT)).toBe(false)
    expect(estAVenir(heure('18:55'), MAINTENANT - 1)).toBe(true)
    expect(estAVenir(heure('18:54'), MAINTENANT)).toBe(false)
  })

  it('une date illisible n’est jamais à venir', () => {
    expect(estAVenir('demain soir', MAINTENANT)).toBe(false)
  })
})

describe('entreesDuTableau', () => {
  const cinemas = [HALLES, ODEON, CHAMPO]

  it('ordonne par début, quel que soit l’ordre où l’API les donne', () => {
    const seances = [seance('21:00', HALLES, 'Tard'), seance('19:00', HALLES, 'Tôt'), seance('20:00', HALLES, 'Milieu')]
    expect(titresDe(entreesDuTableau({ cinemas, seances }, null, MAINTENANT))).toEqual(['Tôt', 'Milieu', 'Tard'])
  })

  it('à début égal, le cinéma le plus proche d’abord, ceux sans coordonnées après', () => {
    const seances = [
      seance('19:15', CHAMPO, 'Au Champo'),
      seance('19:15', ODEON, 'A Odéon'),
      seance('19:15', HALLES, 'Aux Halles'),
    ]
    const entrees = entreesDuTableau({ cinemas, seances }, POSITION, MAINTENANT)
    expect(titresDe(entrees)).toEqual(['Aux Halles', 'A Odéon', 'Au Champo'])
    expect(entrees.map((entree) => entree.distance === null)).toEqual([false, false, true])
    expect(entrees[0]!.distance!).toBeLessThan(entrees[1]!.distance!)
  })

  it('sans la position du membre : à début égal, par nom de cinéma, jamais par distance', () => {
    // Les titres vont à l'envers des noms : seul le nom du cinéma peut produire cet ordre.
    const seances = [seance('19:15', ODEON, 'A'), seance('19:15', HALLES, 'B'), seance('19:15', CHAMPO, 'C')]
    const entrees = entreesDuTableau({ cinemas, seances }, null, MAINTENANT)
    expect(titresDe(entrees)).toEqual(['C', 'B', 'A'])
    expect(entrees.every((entree) => entree.distance === null)).toBe(true)
  })

  it('à début égal et sans coordonnées, par nom ; deux films dans la même salle à la même heure, par titre', () => {
    const autre: CinemaDuJour = { id: 'C4', nom: 'Accattone', latitude: null, longitude: null }
    const seances = [
      seance('19:15', CHAMPO, 'Z'),
      seance('19:15', autre, 'Y'),
      seance('19:15', HALLES, 'B'),
      seance('19:15', HALLES, 'A'),
    ]
    expect(titresDe(entreesDuTableau({ cinemas: [...cinemas, autre], seances }, POSITION, MAINTENANT))).toEqual(['A', 'B', 'Y', 'Z'])
  })

  it('l’heure l’emporte sur la distance : un cinéma lointain à 19:00 passe avant un proche à 19:10', () => {
    const seances = [seance('19:10', HALLES, 'Proche'), seance('19:00', CHAMPO, 'Lointain')]
    expect(titresDe(entreesDuTableau({ cinemas, seances }, POSITION, MAINTENANT))).toEqual(['Lointain', 'Proche'])
  })

  it('écarte les séances commencées, et une séance dont le cinéma manque garde sa place, sans distance', () => {
    const seances = [seance('18:30', HALLES, 'Commencée'), seance('19:00', { ...HALLES, id: 'C9' }, 'Sans cinéma')]
    const entrees = entreesDuTableau({ cinemas, seances }, POSITION, MAINTENANT)
    expect(titresDe(entrees)).toEqual(['Sans cinéma'])
    expect(entrees[0]!.cinema).toBeUndefined()
    expect(entrees[0]!.distance).toBeNull()
  })

  it('rien sans réponse de l’API', () => {
    expect(entreesDuTableau(undefined, POSITION, MAINTENANT)).toEqual([])
  })
})

describe('distanceDuCinema', () => {
  it('nulle sans position, sans cinéma ou sans l’une des deux coordonnées', () => {
    expect(distanceDuCinema(HALLES, null)).toBeNull()
    expect(distanceDuCinema(undefined, POSITION)).toBeNull()
    expect(distanceDuCinema(CHAMPO, POSITION)).toBeNull()
    expect(distanceDuCinema({ ...HALLES, longitude: null }, POSITION)).toBeNull()
    expect(distanceDuCinema({ ...HALLES, latitude: null }, POSITION)).toBeNull()
  })

  it('en kilomètres quand tout y est', () => {
    expect(distanceDuCinema(HALLES, POSITION)).toBeCloseTo(0.7, 1)
  })
})

describe('prochaineSeanceParFilm', () => {
  it('garde, par film, le début le plus tôt parmi les séances à venir', () => {
    const seances = [
      seance('21:00', HALLES, 'AAA'),
      seance('19:20', ODEON, 'AAA'),
      seance('20:00', HALLES, 'AAA'),
      seance('18:00', HALLES, 'AAA'),
      seance('22:00', HALLES, 'BBBBB'),
    ]
    expect(prochaineSeanceParFilm(seances, MAINTENANT)).toEqual(
      new Map([
        [3, heure('19:20')],
        [5, heure('22:00')],
      ]),
    )
  })

  it('un film dont toutes les séances ont commencé n’a plus de repère, et sans réponse il n’y en a aucun', () => {
    expect(prochaineSeanceParFilm([seance('18:00', HALLES, 'AAA')], MAINTENANT).size).toBe(0)
    expect(prochaineSeanceParFilm(undefined, MAINTENANT).size).toBe(0)
  })
})

describe('cinemasDuFilmAVenir', () => {
  const duFilm = (cinema: CinemaDuJour, heures: string[]): CinemaDuFilm => ({
    ...cinema,
    seances: heures.map((hhmm) => ({ debut: heure(hhmm), version: 'VF' as const })),
  })

  it('avec la position : le plus proche d’abord, ceux sans coordonnées en dernier', () => {
    const cinemas = [duFilm(CHAMPO, ['19:00']), duFilm(ODEON, ['19:10']), duFilm(HALLES, ['21:00'])]
    expect(cinemasDuFilmAVenir(cinemas, POSITION, MAINTENANT).map(({ cinema }) => cinema.nom)).toEqual([
      'UGC Les Halles',
      'UGC Odéon',
      'Le Champo',
    ])
  })

  it('sans la position : celui de la prochaine séance d’abord, sans distance', () => {
    const cinemas = [duFilm(HALLES, ['21:00']), duFilm(ODEON, ['19:10']), duFilm(CHAMPO, ['20:00'])]
    const ordonnes = cinemasDuFilmAVenir(cinemas, null, MAINTENANT)
    expect(ordonnes.map(({ cinema }) => cinema.nom)).toEqual(['UGC Odéon', 'Le Champo', 'UGC Les Halles'])
    expect(ordonnes.every(({ distance }) => distance === null)).toBe(true)
  })

  it('à séance égale, par nom', () => {
    const cinemas = [duFilm(ODEON, ['19:10']), duFilm(HALLES, ['19:10'])]
    expect(cinemasDuFilmAVenir(cinemas, null, MAINTENANT).map(({ cinema }) => cinema.nom)).toEqual(['UGC Les Halles', 'UGC Odéon'])
  })

  it('retire les séances commencées, trie les heures, et un cinéma qui n’en a plus s’en va', () => {
    const cinemas = [duFilm(HALLES, ['21:00', '18:00', '19:20']), duFilm(ODEON, ['17:00', '18:30'])]
    const ordonnes = cinemasDuFilmAVenir(cinemas, null, MAINTENANT)
    expect(ordonnes).toHaveLength(1)
    expect(ordonnes[0]!.cinema.seances.map((s) => s.debut)).toEqual([heure('19:20'), heure('21:00')])
  })

  it('rien sans réponse', () => {
    expect(cinemasDuFilmAVenir(undefined, POSITION, MAINTENANT)).toEqual([])
  })
})

describe('heureAffichee', () => {
  it('lit l’heure de Paris sur deux chiffres, à l’heure d’été comme à l’heure d’hiver', () => {
    expect(heureAffichee('2026-10-03T09:05:00+02:00')).toBe('09:05')
    expect(heureAffichee('2026-12-03T19:00:00+01:00')).toBe('19:00')
  })

  it('lit l’heure de Paris même quand le début arrive en UTC, et passe minuit à 00:xx', () => {
    expect(heureAffichee('2026-10-03T17:30:00Z')).toBe('19:30')
    expect(heureAffichee('2026-10-03T22:10:00Z')).toBe('00:10')
  })
})

describe('dansCombien', () => {
  const dans = (secondes: number) => dansCombien(new Date(MAINTENANT + secondes * 1000).toISOString(), MAINTENANT)

  it.each([
    [300, 'dans 5 min'],
    [3540, 'dans 59 min'],
    [3600, 'dans 1 h 00'],
    [3900, 'dans 1 h 05'],
    [7500, 'dans 2 h 05'],
  ])('%s secondes s’annoncent « %s »', (secondes, attendu) => {
    expect(dans(secondes)).toBe(attendu)
  })

  it('arrondit au-dessus : quatre minutes dix, c’est « dans 5 min », et la dernière seconde reste « dans 1 min »', () => {
    expect(dans(250)).toBe('dans 5 min')
    expect(dans(1)).toBe('dans 1 min')
    expect(dans(61)).toBe('dans 2 min')
  })
})
