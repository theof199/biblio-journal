import { describe, expect, it } from 'vitest'
import { exemple } from '../test/contrat'
import type { RealisateurPage } from '../api/realisateurs'
import type { FilmsSaga } from '../api/sagas'
import { destinationFilmRealisateur, destinationFilmSaga } from './destination'

const FILM = exemple<RealisateurPage>('/me/realisateurs/{tmdbId}/page', 'get', 200).films[0]!
const FILM_SAGA = exemple<FilmsSaga>('/me/sagas/{tmdbId}/films', 'get', 200).films[0]!
const NOLAN = { tmdb_id: 525, name: 'Christopher Nolan' }

describe('destinationFilmRealisateur', () => {
  it('un film d’une salle du Voyage mène à sa fiche du Voyage, sans état de navigation', () => {
    const film = { ...FILM, voyage: { annee: 1896, salle_id: 'salle-1', film_id: 'voyage-film-1' } }
    expect(destinationFilmRealisateur(film, NOLAN)).toEqual({ to: '/voyage/1896/films/voyage-film-1' })
  })

  it('sinon à sa fiche des Suivis, avec le film et le réalisateur', () => {
    const film = { ...FILM, tmdb_id: 27205, voyage: null }
    expect(destinationFilmRealisateur(film, NOLAN)).toEqual({ to: '/suivis/films/27205', state: { film, realisateur: NOLAN } })
  })

  it('ne confie à la fiche que l’identifiant et le nom du réalisateur, même d’une ligne de liste plus riche', () => {
    const film = { ...FILM, voyage: null }
    const ligne = { ...NOLAN, profile_url: 'https://image.tmdb.org/t/p/w185/nolan.jpg', ajoute_le: '2026-09-15T18:22:41.000Z' }
    // Mutation : passer la ligne telle quelle glisserait `profile_url` et `ajoute_le` dans l'état.
    expect(destinationFilmRealisateur(film, ligne).state?.realisateur).toEqual(NOLAN)
  })
})

describe('destinationFilmSaga', () => {
  it('toujours sa fiche des Suivis, sans réalisateur', () => {
    expect(destinationFilmSaga(FILM_SAGA)).toEqual({
      to: `/suivis/films/${FILM_SAGA.tmdb_id}`,
      state: { film: FILM_SAGA, realisateur: null },
    })
  })
})
