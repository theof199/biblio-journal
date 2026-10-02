import { describe, expect, it } from 'vitest'
import { enBrefEnCache } from './enBrefEnCache'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import { exemple } from '../test/contrat'
import { visionnage as v } from '../test/journal'
import type { JournalItem } from '../api/journal'
import type { Realisateur, RealisateurPage } from '../api/realisateurs'
import type { FilmsSaga, Saga } from '../api/sagas'

const VARDA = { ...exemple<Realisateur[]>('/me/realisateurs', 'get', 200)[0]!, tmdb_id: 7, name: 'Agnès Varda' }
const MAD_MAX = { ...exemple<Saga[]>('/me/sagas', 'get', 200)[0]!, tmdb_id: 8, name: 'Mad Max' }
const PAGE = exemple<RealisateurPage>('/me/realisateurs/{tmdbId}/page', 'get', 200)
const FILM_REALISATEUR = PAGE.films[0]!
const FILM_SAGA = exemple<FilmsSaga>('/me/sagas/{tmdbId}/films', 'get', 200).films[0]!

const vu = { entry_id: 'ancien', rating: null, finished_at: '2026-01-01' }
const filmDeVarda = (id: number, vus = false, type: 'movie' | 'tv' = 'movie') => ({ ...FILM_REALISATEUR, tmdb_id: id, type, vu: vus ? vu : null, introuvable: false })
const filmDeSaga = (id: number, vus = false) => ({ ...FILM_SAGA, tmdb_id: id, vu: vus ? vu : null, introuvable: false })

/** Le film 2 de la rétrospective et du cycle, écrit au journal le 2 octobre 2026 : l'entrée que le formulaire vient de recevoir. */
const ECRITE: JournalItem = (() => {
  const base = v({ id: 'neuve', titre: 'Le Bonheur', date: '2026-10-02', note: 8 })
  return { ...base, media: { ...base.media, external_id: '2' } }
})()

const pages = (items: JournalItem[], suite: string | null = null) => ({ pages: [{ items, next_cursor: suite }], pageParams: [undefined] })

/** Un cache comme celui qu'une visite des Suivis laisse : les deux listes et les deux filmographies. */
function cacheDesSuivis() {
  const client = createQueryClient()
  client.setQueryData(cles.realisateurs, [VARDA])
  client.setQueryData(cles.pageRealisateur(7), { ...PAGE, tmdb_id: 7, films: [filmDeVarda(1, true), filmDeVarda(2), filmDeVarda(3)] })
  client.setQueryData(cles.sagas, [MAD_MAX])
  client.setQueryData(cles.filmsSaga(8), { films: [filmDeSaga(2), filmDeSaga(9, true)] })
  return client
}

describe('enBrefEnCache', () => {
  it('sans rien en cache, n’a aucune ligne', () => {
    expect(enBrefEnCache(createQueryClient(), ECRITE, true)).toEqual([])
  })

  it('dit la rétrospective et le cycle dont la filmographie en cache contient le film, avec leur compte', () => {
    const lignes = enBrefEnCache(cacheDesSuivis(), ECRITE, true)

    // Mutation : une liste de suivis qui n'est plus lue (réalisateurs ou sagas), ou un compte sans la séance.
    expect(lignes).toMatchObject([
      { type: 'suivi', genre: 'Rétrospective', nom: 'Agnès Varda', vus: 2, total: 3, boucle: false },
      { type: 'suivi', genre: 'Cycle', nom: 'Mad Max', vus: 2, total: 2, boucle: true },
    ])
  })

  it('ne lit que les films d’un réalisateur, pas ses séries', () => {
    const client = cacheDesSuivis()
    client.setQueryData(cles.pageRealisateur(7), { ...PAGE, tmdb_id: 7, films: [filmDeVarda(1, true), filmDeVarda(2), filmDeVarda(3), filmDeVarda(4, false, 'tv')] })

    expect(enBrefEnCache(client, ECRITE, true)[0]).toMatchObject({ total: 3 })
  })

  it('n’a pas de ligne pour un suivi qui ne contient pas le film', () => {
    const client = cacheDesSuivis()
    client.setQueryData(cles.pageRealisateur(7), { ...PAGE, tmdb_id: 7, films: [filmDeVarda(1, true), filmDeVarda(5)] })

    expect(enBrefEnCache(client, ECRITE, true).filter((ligne) => ligne.type === 'suivi')).toHaveLength(1)
  })

  it('n’a pas de ligne pour un suivi dont la filmographie n’est pas en cache', () => {
    const client = createQueryClient()
    client.setQueryData(cles.realisateurs, [VARDA])
    client.setQueryData(cles.sagas, [MAD_MAX])

    expect(enBrefEnCache(client, ECRITE, true)).toEqual([])
  })

  it('ne lit pas une filmographie que l’écriture d’un visionnage a déjà périmée : son « vu » est celui d’avant', () => {
    const client = cacheDesSuivis()
    void client.invalidateQueries({ queryKey: cles.realisateurs })
    void client.invalidateQueries({ queryKey: cles.sagas })

    // Mutation : `fraiche` retiré de la lecture d'une filmographie.
    expect(enBrefEnCache(client, ECRITE, true)).toEqual([])
  })

  it('dit la deuxième séance d’un film déjà au journal, et le mois quand le cache le contient tout entier', () => {
    const client = createQueryClient()
    const avant = { ...v({ id: 'ancienne', date: '2026-09-20' }), media: { ...v({ id: 'x', date: '2026-09-20' }).media, external_id: '2' } }
    client.setQueryData(cles.journal, pages([v({ id: 'o1', date: '2026-10-01' }), avant]))

    expect(enBrefEnCache(client, ECRITE, true)).toEqual([
      { type: 'seance', titre: 'Le Bonheur', rang: 2 },
      { type: 'mois', mois: 'Octobre 2026', rang: 2 },
    ])
  })

  it('ne dit pas le mois quand le cache ne prouve pas qu’il le tient tout entier', () => {
    const client = createQueryClient()
    client.setQueryData(cles.journal, pages([v({ id: 'o1', date: '2026-10-01' })], 'suite'))

    // Mutation : le mois compté sans la preuve (`toutLeMois` toujours vrai).
    expect(enBrefEnCache(client, ECRITE, true)).toEqual([])
  })

  it('ne lit pas un journal périmé : il compterait les films d’avant la séance qui vient de s’écrire', () => {
    const client = createQueryClient()
    client.setQueryData(cles.journal, pages([v({ id: 'o1', date: '2026-10-01' })]))
    void client.invalidateQueries({ queryKey: cles.journal })

    expect(enBrefEnCache(client, ECRITE, true)).toEqual([])
  })
})
