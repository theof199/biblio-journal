import { describe, expect, it } from 'vitest'
import { exemple } from '../test/contrat'
import type { FilmRealisateur, Realisateur, RealisateurPage } from '../api/realisateurs'
import type { FilmSaga, FilmsSaga, Saga } from '../api/sagas'
import { filmsEnsuite, sagaALongNom, scinderNom, trousDeLaRetrospective } from './affichettes'
import type { EtatFilmographie } from './liste'
import type { FilmSuivi } from './prochain'

const NOLAN = exemple<Realisateur[]>('/me/realisateurs', 'get', 200)[0]!
const ALIEN = exemple<Saga[]>('/me/sagas', 'get', 200)[0]!
const FILM_REALISATEUR = exemple<RealisateurPage>('/me/realisateurs/{tmdbId}/page', 'get', 200).films[0]!
const FILM_SAGA = exemple<FilmsSaga>('/me/sagas/{tmdbId}/films', 'get', 200).films[0]!

const realisateur = (id: number, ajouteLe: string): Realisateur => ({ ...NOLAN, tmdb_id: id, ajoute_le: ajouteLe })
const saga = (id: number, ajouteLe: string): Saga => ({ ...ALIEN, tmdb_id: id, ajoute_le: ajouteLe })
const vu = (jour: string) => ({ entry_id: `e-${jour}`, rating: null, finished_at: jour })
const filmR = (id: number, options: { vu?: string; introuvable?: boolean } = {}): FilmRealisateur => ({
  ...FILM_REALISATEUR,
  tmdb_id: id,
  vu: options.vu ? vu(options.vu) : null,
  introuvable: options.introuvable ?? false,
})
const filmS = (id: number, options: { vu?: string; introuvable?: boolean } = {}): FilmSaga => ({
  ...FILM_SAGA,
  tmdb_id: id,
  vu: options.vu ? vu(options.vu) : null,
  introuvable: options.introuvable ?? false,
})
const pretR = (...films: FilmRealisateur[]): EtatFilmographie<FilmRealisateur> => ({ statut: 'pret', films })
const pretS = (...films: FilmSaga[]): EtatFilmographie<FilmSaga> => ({ statut: 'pret', films })

describe('scinderNom', () => {
  it('les prénoms en petit, le dernier mot en grand', () => {
    expect(scinderNom('Christopher Nolan')).toEqual({ prenoms: 'Christopher', dernier: 'Nolan', long: false })
    expect(scinderNom('Jean-Pierre Jeunet')).toEqual({ prenoms: 'Jean-Pierre', dernier: 'Jeunet', long: false })
    expect(scinderNom('Hayao Miyazaki')).toMatchObject({ prenoms: 'Hayao', dernier: 'Miyazaki' })
  })

  it('plusieurs prénoms restent ensemble', () => {
    expect(scinderNom('Carlos Saura Atarés')).toMatchObject({ prenoms: 'Carlos Saura', dernier: 'Atarés' })
  })

  it('un nom d’un seul mot n’a pas de prénoms', () => {
    expect(scinderNom('Fellini')).toEqual({ prenoms: '', dernier: 'Fellini', long: false })
  })

  it('un dernier mot de plus de neuf lettres passe au petit corps, neuf lettres non', () => {
    // Mutation : un seuil à `>=` rendrait « Tarkovsky » (neuf) long ; à `>`, « Kieslowski » (dix) court.
    expect(scinderNom('Krzysztof Kieslowski').long).toBe(true)
    expect(scinderNom('Denis Villeneuve').long).toBe(true)
    expect(scinderNom('Wes Anderson').long).toBe(false)
    expect(scinderNom('Andrei Tarkovsky').long).toBe(false)
  })

  it('les espaces en trop ne font pas de mot vide', () => {
    expect(scinderNom('  Sofia   Coppola ')).toEqual({ prenoms: 'Sofia', dernier: 'Coppola', long: false })
  })
})

describe('sagaALongNom', () => {
  it('au-delà de seize lettres', () => {
    expect(sagaALongNom('Le Seigneur des anneaux')).toBe(true)
    expect(sagaALongNom('Alien (Saga)')).toBe(false)
    expect(sagaALongNom('Pirates des Caraïbes')).toBe(true)
    // Mutation : un seuil à `>=` rendrait « Seize caractères » (seize pile) long.
    expect(sagaALongNom('Mad Max Fury Road')).toBe(true) // dix-sept
    expect(sagaALongNom('Seize caractères')).toBe(false) // 16 pile
  })
})

describe('trousDeLaRetrospective', () => {
  const films: FilmSuivi[] = [
    filmR(1, { vu: '2026-09-01' }),
    filmR(2, { introuvable: true }),
    filmR(3),
    filmR(4),
    filmR(5, { vu: '2026-09-02', introuvable: true }),
  ]

  it('vu, introuvable, le prochain, puis les autres, dans l’ordre du back', () => {
    expect(trousDeLaRetrospective(films)).toEqual(['vu', 'introuvable', 'prochain', 'pas-encore', 'introuvable'])
  })

  it('un film vu puis marqué introuvable reste un trou en pointillés : la marque prime', () => {
    expect(trousDeLaRetrospective([filmR(1, { vu: '2026-09-01', introuvable: true })])).toEqual(['introuvable'])
  })

  it('les introuvables ne sont jamais masqués', () => {
    expect(trousDeLaRetrospective([filmR(1, { introuvable: true })])).toHaveLength(1)
  })

  it('aucun prochain quand tout est vu, aucun trou sans film', () => {
    expect(trousDeLaRetrospective([filmR(1, { vu: '2026-09-01' })])).toEqual(['vu'])
    expect(trousDeLaRetrospective([])).toEqual([])
  })
})

describe('filmsEnsuite', () => {
  const ids = (liste: ReturnType<typeof filmsEnsuite>) => liste.map(({ source, entite }) => `${source}:${entite.tmdb_id}`)

  it('le prochain film de chaque suivi en cours, réalisateurs et sagas mêlés, du plus récemment actif au plus ancien', () => {
    const realisateurs = [realisateur(1, '2026-09-01T00:00:00.000Z'), realisateur(2, '2026-09-02T00:00:00.000Z')]
    const sagas = [saga(10, '2026-09-03T00:00:00.000Z')]
    const films = filmsEnsuite(
      realisateurs,
      new Map([
        [1, pretR(filmR(11, { vu: '2026-09-20' }), filmR(12))], // actif le 20
        [2, pretR(filmR(21))], // sur son ajout, le 2
      ]),
      sagas,
      new Map([[10, pretS(filmS(101, { vu: '2026-09-10' }), filmS(102))]]), // actif le 10
    )
    expect(ids(films)).toEqual(['realisateurs:1', 'sagas:10', 'realisateurs:2'])
    expect(films.map(({ film }) => film.tmdb_id)).toEqual([12, 102, 21])
  })

  it('le premier film ni vu ni introuvable', () => {
    const [premier] = filmsEnsuite([realisateur(1, '2026-09-01T00:00:00.000Z')], new Map([[1, pretR(filmR(11, { vu: '2026-09-02' }), filmR(12, { introuvable: true }), filmR(13), filmR(14))]]), [], new Map())
    expect(premier?.film.tmdb_id).toBe(13)
  })

  it('écarte les bouclés, les filmographies en attente ou en panne et les listes vides', () => {
    const films = filmsEnsuite(
      [realisateur(1, '2026-09-01T00:00:00.000Z'), realisateur(2, '2026-09-01T00:00:00.000Z'), realisateur(3, '2026-09-01T00:00:00.000Z'), realisateur(4, '2026-09-01T00:00:00.000Z')],
      new Map<number, EtatFilmographie<FilmRealisateur>>([
        [1, pretR(filmR(11, { vu: '2026-09-02' }), filmR(12, { introuvable: true }))], // bouclée
        [2, { statut: 'attente' }],
        [3, { statut: 'indisponible' }],
        [4, pretR()], // vide
      ]),
      [saga(10, '2026-09-01T00:00:00.000Z')],
      new Map(), // pas même une entrée
    )
    expect(films).toEqual([])
  })

  it('à égalité d’activité, les réalisateurs passent avant les sagas, chacun dans l’ordre du back', () => {
    const jour = '2026-09-05T00:00:00.000Z'
    const films = filmsEnsuite(
      [realisateur(2, jour), realisateur(1, jour)],
      new Map([[1, pretR(filmR(11))], [2, pretR(filmR(21))]]),
      [saga(20, jour), saga(10, jour)],
      new Map([[10, pretS(filmS(101))], [20, pretS(filmS(201))]]),
    )
    expect(ids(films)).toEqual(['realisateurs:2', 'realisateurs:1', 'sagas:20', 'sagas:10'])
  })

  it('un identifiant de personne et un de saga qui se ressemblent ne se confondent pas', () => {
    const films = filmsEnsuite(
      [realisateur(7, '2026-09-01T00:00:00.000Z')],
      new Map([[7, pretR(filmR(71))]]),
      [saga(7, '2026-09-02T00:00:00.000Z')],
      new Map([[7, pretS(filmS(701))]]),
    )
    expect(films.map(({ source, film }) => [source, film.tmdb_id])).toEqual([['sagas', 701], ['realisateurs', 71]])
  })
})
