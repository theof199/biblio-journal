import { describe, expect, it } from 'vitest'
import { sortieEnCoursOuvrable } from './candidat'
import type { SortieEnCoursFilm } from '../api/sorties'

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

describe('sortieEnCoursOuvrable', () => {
  it('vraie quand tmdb_id est présent', () => {
    expect(sortieEnCoursOuvrable(FILM_EN_COURS)).toBe(true)
  })

  it('fausse quand tmdb_id est nul — rien à préremplir', () => {
    expect(sortieEnCoursOuvrable({ ...FILM_EN_COURS, tmdb_id: null })).toBe(false)
  })
})
