import { describe, expect, it } from 'vitest'
import { candidatDepuisImport, candidatDepuisSortieEnCours, candidatDepuisSortieProchaine, sortieEnCoursOuvrable } from './candidat'
import type { SortieEnCoursFilm, SortieProchaineFilm } from '../api/sorties'

const FILM_EN_COURS: SortieEnCoursFilm = {
  tmdb_id: 912649,
  allocine_id: 306319,
  title: 'Les Gardiens de la nuit',
  original_title: 'Les Gardiens de la nuit',
  year: 2026,
  release_date: '2026-09-16',
  cover_url: 'https://fr.web.img6.acsta.net/pictures/gardiens-de-la-nuit.jpg',
  directors: ['Alix Delaporte'],
  cinemas: ['UGC Ciné Cité Les Halles'],
}

const FILM_PROCHAINE: SortieProchaineFilm = {
  tmdb_id: 1022789,
  title: 'Marée basse',
  original_title: 'Marée basse',
  year: 2026,
  release_date: '2026-09-23',
  cover_url: null,
}

describe('sortieEnCoursOuvrable', () => {
  it('vraie quand tmdb_id est présent', () => {
    expect(sortieEnCoursOuvrable(FILM_EN_COURS)).toBe(true)
  })

  it('fausse quand tmdb_id est nul — rien à préremplir', () => {
    expect(sortieEnCoursOuvrable({ ...FILM_EN_COURS, tmdb_id: null })).toBe(false)
  })
})

describe('candidatDepuisSortieEnCours', () => {
  it('vise le même film, source tmdb et external_id le tmdb_id, sans réalisateur', () => {
    const candidat = candidatDepuisSortieEnCours(FILM_EN_COURS as SortieEnCoursFilm & { tmdb_id: number })

    expect(candidat).toEqual({
      source: 'tmdb',
      external_id: '912649',
      title: 'Les Gardiens de la nuit',
      year: 2026,
      cover_url: 'https://fr.web.img6.acsta.net/pictures/gardiens-de-la-nuit.jpg',
      // Mutation : préremplir avec `directors[0]` casserait cette assertion — même geste, même
      // formulaire que les autres provenances, jamais de réalisateur préchargé ici.
      director: null,
    })
  })
})

describe('candidatDepuisSortieProchaine', () => {
  it('vise le même film, source tmdb et external_id le tmdb_id, sans réalisateur', () => {
    expect(candidatDepuisSortieProchaine(FILM_PROCHAINE)).toEqual({
      source: 'tmdb',
      external_id: '1022789',
      title: 'Marée basse',
      year: 2026,
      cover_url: null,
      director: null,
    })
  })
})

describe('candidatDepuisImport', () => {
  const candidat = { tmdb_id: '348', title: 'Alien, le huitième passager', year: 1979 }

  it('reprend le film du rapport, sans jaquette ni réalisateur, avec la date et la note de sa ligne', () => {
    expect(candidatDepuisImport(candidat, { date: '2026-09-01', rating: 9 })).toEqual({
      source: 'tmdb',
      external_id: '348',
      title: 'Alien, le huitième passager',
      year: 1979,
      cover_url: null,
      director: null,
      finished_at: '2026-09-01',
      rating: 9,
    })
  })

  it('une ligne sans date ni note (ou introuvable) ne pose ni l’une ni l’autre', () => {
    const sans = candidatDepuisImport(candidat, { date: null, rating: null })
    expect('finished_at' in sans).toBe(false)
    expect('rating' in sans).toBe(false)
    expect('finished_at' in candidatDepuisImport(candidat, undefined)).toBe(false)
  })
})
