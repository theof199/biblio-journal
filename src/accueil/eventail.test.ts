import { describe, expect, it } from 'vitest'
import { cartesEventail, placesEventail } from './eventail'
import type { CarteEnsuite } from './ensuite'
import type { PlexFilm } from '../api/plex'
import type { FilmRealisateur } from '../api/realisateurs'
import type { FilmSaga } from '../api/sagas'
import type { SeancePrise } from '../api/voyage'

const SEANCE: SeancePrise = {
  id: 'a0000000-0000-4000-8000-000000000001',
  annee: 1927,
  long: { title: 'Metropolis', cover_url: 'https://exemple.test/metropolis.jpg' },
  court: null,
}

const PLEX: CarteEnsuite = {
  source: 'plex',
  film: { tmdb_id: 3, title: 'Casablanca', year: 1942, cover_url: 'https://exemple.test/casablanca.jpg' } as PlexFilm,
}

const REALISATEUR: CarteEnsuite = {
  source: 'realisateur',
  encours: {
    entite: { tmdb_id: 1, name: 'Buster Keaton', profile_url: null, ajoute_le: '2026-09-01T00:00:00.000Z' },
    prochain: { tmdb_id: 2, title: 'Le Mécano de la « General »', year: 1926, cover_url: null } as FilmRealisateur,
  },
}

const SAGA: CarteEnsuite = {
  source: 'saga',
  encours: {
    entite: { tmdb_id: 8, name: 'Saga King Kong', cover_url: null, ajoute_le: '2026-09-01T00:00:00.000Z' },
    prochain: { tmdb_id: 4, title: 'King Kong', year: 1933, cover_url: null } as FilmSaga,
  },
}

describe('cartesEventail', () => {
  it('rend un éventail vide sans séance ni carte', () => {
    expect(cartesEventail(null, [])).toEqual([])
    expect(cartesEventail(undefined, [])).toEqual([])
  })

  it('met la séance d’abord, puis les cartes « Ensuite » dans leur ordre', () => {
    const cartes = cartesEventail(SEANCE, [PLEX, REALISATEUR])
    expect(cartes.map((carte) => carte.titre)).toEqual(['Metropolis', 'Casablanca', 'Le Mécano de la « General »'])
  })

  it('n’en garde que quatre, la séance comprise', () => {
    const cartes = cartesEventail(SEANCE, [PLEX, REALISATEUR, SAGA, PLEX])
    expect(cartes.map((carte) => carte.titre)).toEqual(['Metropolis', 'Casablanca', 'Le Mécano de la « General »', 'King Kong'])
  })

  it('décrit la séance : pastille « Ce soir », année du Voyage, affiche, lien vers le Voyage', () => {
    expect(cartesEventail(SEANCE, [])[0]).toEqual({
      cle: 'seance-a0000000-0000-4000-8000-000000000001',
      etiquette: 'Ce soir',
      titre: 'Metropolis',
      meta: 'Voyage 1927',
      afficheUrl: 'https://exemple.test/metropolis.jpg',
      ceSoir: true,
      cible: { to: '/voyage' },
    })
  })

  it('étiquette la carte Plex « Sur Plex », avec l’année seule sous le titre', () => {
    const [carte] = cartesEventail(null, [PLEX])
    expect(carte).toMatchObject({ etiquette: 'Sur Plex', meta: '1942', ceSoir: false, afficheUrl: 'https://exemple.test/casablanca.jpg' })
  })

  it('étiquette la carte d’un réalisateur de son nom, avec son nom et l’année sous le titre', () => {
    const [carte] = cartesEventail(null, [REALISATEUR])
    expect(carte).toMatchObject({ etiquette: 'Buster Keaton', meta: 'Buster Keaton · 1926', afficheUrl: null })
  })

  it('étiquette la carte d’une saga de son nom quand il dit déjà « saga », sans réalisateur sous le titre', () => {
    const [carte] = cartesEventail(null, [SAGA])
    expect(carte).toMatchObject({ etiquette: 'Saga King Kong', meta: '1933' })
  })

  it('préfixe « Saga » au nom d’une saga qui ne le porte pas', () => {
    const sansPrefixe: CarteEnsuite = { ...SAGA, encours: { ...SAGA.encours, entite: { ...SAGA.encours.entite, name: 'Alien' } } }
    expect(cartesEventail(null, [sansPrefixe])[0]?.etiquette).toBe('Saga Alien')
  })

  it('reconnaît « saga » sans tenir compte de la casse', () => {
    const enMajuscules: CarteEnsuite = { ...SAGA, encours: { ...SAGA.encours, entite: { ...SAGA.encours.entite, name: 'ALIEN (SAGA)' } } }
    expect(cartesEventail(null, [enMajuscules])[0]?.etiquette).toBe('ALIEN (SAGA)')
  })

  it('mène une carte « Ensuite » au formulaire, avec le candidat', () => {
    const [carte] = cartesEventail(null, [REALISATEUR])
    expect(carte?.cible).toEqual({
      to: '/journal/nouveau',
      state: {
        candidat: {
          source: 'tmdb',
          external_id: '2',
          title: 'Le Mécano de la « General »',
          year: 1926,
          cover_url: null,
          director: 'Buster Keaton',
        },
      },
    })
  })

  it('donne à chaque carte une clé distincte', () => {
    const cles = cartesEventail(SEANCE, [PLEX, REALISATEUR, SAGA]).map((carte) => carte.cle)
    expect(new Set(cles).size).toBe(4)
  })
})

describe('placesEventail', () => {
  it('met l’unique carte de face', () => {
    expect(placesEventail(1, 0)).toEqual(['avant'])
  })

  it('met la seconde carte à droite', () => {
    expect(placesEventail(2, 0)).toEqual(['avant', 'droite'])
  })

  it('met la troisième carte à gauche', () => {
    expect(placesEventail(3, 0)).toEqual(['avant', 'droite', 'gauche'])
  })

  it('met la quatrième carte derrière', () => {
    expect(placesEventail(4, 0)).toEqual(['avant', 'droite', 'gauche', 'derriere'])
  })

  it('tourne depuis la carte amenée devant, en reprenant au début après la dernière', () => {
    expect(placesEventail(4, 2)).toEqual(['gauche', 'derriere', 'avant', 'droite'])
  })

  it('range les cartes dans le sens de l’ordre autour de celle amenée devant, avec trois cartes', () => {
    expect(placesEventail(3, 1)).toEqual(['gauche', 'avant', 'droite'])
  })

  it('échange les deux cartes quand la seconde passe devant', () => {
    expect(placesEventail(2, 1)).toEqual(['droite', 'avant'])
  })

  it('ne rend aucune place pour zéro carte', () => {
    expect(placesEventail(0, 0)).toEqual([])
  })

  it('refuse plus de quatre cartes plutôt que d’inventer une place', () => {
    expect(() => placesEventail(5, 0)).toThrow(RangeError)
  })
})
