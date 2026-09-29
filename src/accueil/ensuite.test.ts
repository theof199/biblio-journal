import { describe, expect, it } from 'vitest'
import { cartesEnsuite } from './ensuite'
import type { PlexFilm } from '../api/plex'
import type { Realisateur, FilmRealisateur } from '../api/realisateurs'
import type { Saga, FilmSaga } from '../api/sagas'
import type { EntiteEnCours } from '../suivis/prochain'

const PLEX_FILM = { tmdb_id: 1, title: 'Un film Plex', year: 2020, cover_url: null } as PlexFilm

const ENCOURS_REALISATEUR: EntiteEnCours<Realisateur, FilmRealisateur> = {
  entite: { tmdb_id: 525, name: 'Christopher Nolan', profile_url: null, ajoute_le: '2026-09-01T00:00:00.000Z' },
  prochain: { tmdb_id: 2, title: 'Un film à voir', year: 2015 } as FilmRealisateur,
}

const ENCOURS_SAGA: EntiteEnCours<Saga, FilmSaga> = {
  entite: { tmdb_id: 8091, name: 'Alien (Saga)', cover_url: null, ajoute_le: '2026-09-01T00:00:00.000Z' },
  prochain: { tmdb_id: 3, title: 'Un film de saga', year: 1979 } as FilmSaga,
}

describe('cartesEnsuite', () => {
  it('rend les trois cartes, dans l’ordre Plex puis réalisateur puis saga', () => {
    const cartes = cartesEnsuite(PLEX_FILM, ENCOURS_REALISATEUR, ENCOURS_SAGA)
    expect(cartes.map((c) => c.source)).toEqual(['plex', 'realisateur', 'saga'])
  })

  it('une source absente n’ajoute aucune carte plutôt que d’en afficher une vide', () => {
    // Mutation : sans le `if`, une carte « plex » nulle apparaîtrait quand même dans la liste.
    expect(cartesEnsuite(null, ENCOURS_REALISATEUR, null).map((c) => c.source)).toEqual(['realisateur'])
    expect(cartesEnsuite(undefined, null, undefined)).toEqual([])
  })

  it('ne mélange jamais les sources entre elles', () => {
    const cartes = cartesEnsuite(PLEX_FILM, null, ENCOURS_SAGA)
    expect(cartes).toEqual([
      { source: 'plex', film: PLEX_FILM },
      { source: 'saga', encours: ENCOURS_SAGA },
    ])
  })
})
