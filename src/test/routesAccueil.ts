import { json } from './serveur'

/**
 * Depuis la reprise de l'accueil (lot 2 des onglets), `/` appelle aussi le journal, les
 * statistiques, le Voyage et le Plex — en plus de `/auth/me`. Un test qui monte `/` doit tous les
 * servir, sous peine de voir la page réessayer une route « inattendue » plutôt que de se stabiliser.
 * Toutes vides ou non configurées : de quoi n'afficher que la vitrine vide, sans « Ce soir » ni
 * « Ensuite », qui ont leurs propres tests.
 */
const COMPTES_VIDES = {
  finished: 0,
  finished_by_type: { book: 0, comic_series: 0, movie: 0, tv: 0, game: 0, music: 0 },
  rereads: 0,
  episodes_watched: 0,
  volumes_read: 0,
  volumes_with_estimated_date: 0,
  albums_listened: 0,
}
const grandeurVide = (unit: string, basis: string) => ({
  value: 0,
  unit,
  basis,
  coverage: { counted: 0, missing: 0 },
  note: null,
})
const GRANDEURS_VIDES = {
  pages_read: grandeurVide('pages', 'measured'),
  movie_minutes: grandeurVide('minutes', 'measured'),
  tv_minutes: grandeurVide('minutes', 'measured'),
  album_minutes: grandeurVide('minutes', 'measured'),
  game_hours: grandeurVide('hours', 'estimated'),
}
const PERIODE_VIDE = { from: null, to: '2026-09-29', counts: COMPTES_VIDES, quantities: GRANDEURS_VIDES }
const UTILISATEUR_STATS = {
  id: '11111111-1111-4111-8111-111111111111',
  pseudo: 'alice',
  avatar_url: null,
  identity_color: '#E4572E',
  role: 'admin',
  deactivated: false,
}

export const ROUTES_ACCUEIL: Record<string, () => Response> = {
  'GET /api/me/journal?limit=20': () => json({ items: [], next_cursor: null }),
  'GET /api/stats': () =>
    json({
      dashboard: {
        scope: {
          user: UTILISATEUR_STATS,
          timezone: 'Europe/Paris',
          week_starts_on: 'monday',
          generated_at: '2026-09-29T00:00:00.000Z',
        },
        periods: { week: PERIODE_VIDE, month: PERIODE_VIDE, year: PERIODE_VIDE, all: PERIODE_VIDE },
        highlights: {
          top_authors: [],
          top_directors: [],
          top_creators: [],
          top_genres: [],
          busiest_month: null,
          ratings: { distribution: [], average: null, coverage: { counted: 0, missing: 0 } },
        },
      },
      comparison: null,
    }),
  'GET /api/me/voyage': () =>
    json({
      configure: false,
      depart: 1895,
      annee_en_cours: 1895,
      annees: [],
      ticket_a_montrer: null,
      tampons: [],
      seance_prise: null,
      ia: false,
      source: null,
    }),
  'GET /api/reference/plex': () => json({ configure: false, calcule_le: null, films: [], demandes: [] }),
}
