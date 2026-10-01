import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { createQueryClient } from '../api/queryClient'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import { visionnage as v } from '../test/journal'
import type { ReactionsCatalogue } from '../api/reactions'

const SESSION = exemple<{ user: { pseudo: string; identity_color: string } }>('/auth/me', 'get', 200)
const PSEUDO = SESSION.user.pseudo
const REACTIONS = exemple<ReactionsCatalogue>('/reference/reactions', 'get', 200)
const JOURNAL = 'GET /api/me/journal?limit=100'
const CATALOGUE = 'GET /api/reference/reactions'

const duree = (minutes: number, manquantes: number) => ({
  value: minutes,
  unit: 'minutes',
  basis: 'measured',
  coverage: { counted: 0, missing: manquantes },
  note: null,
})
const periode = (film: number, minutes = 0, manquantes = 0) => ({
  from: null,
  to: '2026-09-29',
  counts: { finished_by_type: { movie: film } },
  quantities: { movie_minutes: duree(minutes, manquantes) },
})
/** 412 films dont 8 cette année, 213 heures de films, 12 sans durée. */
const stats = (total = 412, cetteAnnee = 8, minutes = 12780, manquantes = 12) => ({
  dashboard: {
    scope: { user: {}, timezone: 'Europe/Paris', week_starts_on: 'monday', generated_at: '2026-09-29T00:00:00.000Z' },
    periods: { week: periode(0), month: periode(0), year: periode(cetteAnnee), all: periode(total, minutes, manquantes) },
    highlights: {},
  },
  comparison: null,
})

const JOURNAL_DE_TEST = [
  v({ id: 'a', titre: 'Alien', annee: 1979, date: '2026-09-20', note: 9, reactions: ['en_salle', 'adore'] }),
  v({ id: 'b', titre: 'Metropolis', annee: 1927, date: '2019-08-02', note: 7, reactions: ['adore'] }),
  v({ id: 'c', titre: 'Heat', annee: 1995, date: '2026-01-10', reactions: ['inconnue'] }),
]

const erreurApi = (message: string, status = 400) => json({ code: 'VALIDATION_ERROR', message, retryable: false }, status)

function monter() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={['/profil']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Le profil complet : un journal de trois films, le catalogue des réactions, les chiffres de la carte. */
const servirProfil = (extra: Record<string, () => Response | Promise<Response>> = {}) =>
  servir({
    'GET /api/auth/me': () => json(SESSION),
    'GET /api/stats': () => json(stats()),
    [JOURNAL]: () => json({ items: JOURNAL_DE_TEST, next_cursor: null }),
    [CATALOGUE]: () => json(REACTIONS),
    ...extra,
  })

/** La carte une fois ses chiffres arrivés : son nom les porte. */
const carte = () => screen.findByRole('link', { name: `Mes films, carte de ${PSEUDO} : 412 films · 213 h` })

describe('le profil', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Le jour du test est fixé : le mois courant et « cette année » en dépendent.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('la carte d’adhérent', () => {
    it('mène à Mes films, et son nom dit le pseudo, les films et les heures', async () => {
      servirProfil()
      monter()

      const lien = await carte()
      expect(lien).toHaveAttribute('href', '/profil/mes-films')
    })

    it('imprime le pseudo, les films, les heures et ceux de cette année', async () => {
      servirProfil()
      monter()

      const lien = await carte()
      expect(within(lien).getByText(PSEUDO)).toBeInTheDocument()
      expect(within(lien).getByText('412 films · 213 h')).toBeInTheDocument()
      expect(within(lien).getByText('8 films cette année')).toBeInTheDocument()
    })

    it('dit combien de films n’ont pas de durée, comme le contrat l’exige', async () => {
      servirProfil()
      monter()

      expect(await screen.findByText('12 films sans durée')).toBeInTheDocument()
    })

    it('ne dit rien des durées quand aucune ne manque', async () => {
      servirProfil({ 'GET /api/stats': () => json(stats(412, 8, 12780, 0)) })
      monter()

      await carte()
      expect(screen.queryByText(/sans durée/)).not.toBeInTheDocument()
    })

    it('est « membre depuis » l’année du plus ancien visionnage', async () => {
      servirProfil()
      monter()

      expect(await screen.findByText('Membre depuis 2019')).toBeInTheDocument()
    })

    it('ne dit pas « membre depuis » tant que le journal n’est pas là', async () => {
      servirProfil({ [JOURNAL]: () => new Promise<Response>(() => undefined) })
      monter()

      await carte()
      expect(screen.queryByText(/Membre depuis/)).not.toBeInTheDocument()
    })

    it('ne dit pas « membre depuis » sur un journal vide', async () => {
      servirProfil({ [JOURNAL]: () => json({ items: [], next_cursor: null }) })
      monter()

      await carte()
      await vi.waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url) === '/api/me/journal?limit=100')).toBe(true))
      await new Promise((r) => setTimeout(r, 50))
      expect(screen.queryByText(/Membre depuis/)).not.toBeInTheDocument()
    })

    it('ne montre pas les chiffres tant que /stats n’a pas répondu', async () => {
      servirProfil({ 'GET /api/stats': () => new Promise<Response>(() => undefined) })
      monter()

      const lien = await screen.findByRole('link', { name: `Mes films, carte de ${PSEUDO}` })
      expect(within(lien).queryByText(/films ·/)).not.toBeInTheDocument()
    })

    it('porte la couleur du membre, que la bande et les mois lisent', async () => {
      servirProfil()
      monter()

      const lien = await carte()
      expect(lien.parentElement?.style.getPropertyValue('--identite')).toBe(SESSION.user.identity_color)
    })
  })

  describe('les notes', () => {
    it('la jauge dit la note moyenne', async () => {
      servirProfil()
      monter()

      expect(await screen.findByRole('img', { name: 'Note moyenne 8 sur 10' })).toBeInTheDocument()
    })

    it('la jauge dit qu’aucun film n’est noté quand aucun ne l’est', async () => {
      servirProfil({ [JOURNAL]: () => json({ items: [v({ id: 'a', date: '2026-09-01' })], next_cursor: null }) })
      monter()

      expect(await screen.findByRole('img', { name: 'Aucun film noté' })).toBeInTheDocument()
    })

    it('le vumètre liste le compte de chaque note, de 1 à 10', async () => {
      servirProfil()
      monter()

      expect(await screen.findByRole('img', { name: 'Films par note, de 1 à 10 : 0, 0, 0, 0, 0, 0, 1, 0, 1, 0' })).toBeInTheDocument()
    })
  })

  describe('les réactions', () => {
    it('les billets suivent l’ordre des plus posées, avec leur compte', async () => {
      servirProfil()
      monter()

      const section = await screen.findByRole('region', { name: 'Réactions' })
      const billets = within(section).getAllByRole('listitem')
      expect(billets.map((billet) => billet.textContent)).toEqual(['❤️J’ai adoré2fois', '🎬En salle1fois'])
    })

    it('une réaction que le catalogue ignore n’a pas de billet', async () => {
      servirProfil()
      monter()

      const section = await screen.findByRole('region', { name: 'Réactions' })
      expect(within(section).queryByText('inconnue')).not.toBeInTheDocument()
      expect(within(section).getAllByRole('listitem')).toHaveLength(2)
    })

    it('un catalogue qui échoue ne cache que cette section', async () => {
      servirProfil({ [CATALOGUE]: () => erreurApi('Le catalogue est en panne.', 500) })
      monter()

      await screen.findByRole('img', { name: /^Films par note/ })
      expect(screen.queryByRole('region', { name: 'Réactions' })).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('les décennies', () => {
    it('le titre dit combien sur quatorze, la pellicule le compte de chacune', async () => {
      servirProfil()
      monter()

      const section = await screen.findByRole('region', { name: 'Décennies · 3 sur 14' })
      expect(
        within(section).getByRole('img', {
          name: 'Films par décennie : 1890 : 0, 1900 : 0, 1910 : 0, 1920 : 1, 1930 : 0, 1940 : 0, 1950 : 0, 1960 : 0, 1970 : 1, 1980 : 0, 1990 : 1, 2000 : 0, 2010 : 0, 2020 : 0',
        }),
      ).toBeInTheDocument()
    })
  })

  describe('les mois', () => {
    it('douze mois de l’année en cours, une entrée par ampoule', async () => {
      servirProfil()
      monter()

      const section = await screen.findByRole('region', { name: 'Mois · 2026' })
      expect(
        within(section).getByRole('img', {
          name: 'Films par mois en 2026 : janvier 1, février 0, mars 0, avril 0, mai 0, juin 0, juillet 0, août 0, septembre 1, octobre 0, novembre 0, décembre 0',
        }),
      ).toBeInTheDocument()
    })
  })

  describe('quand le journal manque', () => {
    it('un journal vide ne montre aucun graphique', async () => {
      servirProfil({ [JOURNAL]: () => json({ items: [], next_cursor: null }) })
      monter()

      await carte()
      expect(screen.queryByRole('region')).not.toBeInTheDocument()
      expect(screen.queryByRole('img', { name: /^Films par/ })).not.toBeInTheDocument()
    })

    it('un journal qui échoue se tait : ni alerte ni graphique, la carte reste', async () => {
      servirProfil({ [JOURNAL]: () => erreurApi('Le journal n’a pas pu être lu.', 500) })
      monter()

      expect(await screen.findByText('412 films · 213 h')).toBeInTheDocument()
      await new Promise((r) => setTimeout(r, 50))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })

    it('tant que le journal n’est pas là, aucun graphique : jamais un zéro', async () => {
      servirProfil({ [JOURNAL]: () => new Promise<Response>(() => undefined) })
      monter()

      await carte()
      expect(screen.queryByRole('img', { name: /^Films par/ })).not.toBeInTheDocument()
    })
  })

  it('une panne de /stats s’affiche par son message, tel quel, et « Réessayer » relit', async () => {
    let enPanne = true
    servirProfil({ 'GET /api/stats': () => (enPanne ? erreurApi('Les statistiques sont en panne.', 503) : json(stats(5, 1, 600, 0))) })
    monter()

    expect(await screen.findByRole('alert')).toHaveTextContent('Les statistiques sont en panne.')
    enPanne = false
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('5 films · 10 h')).toBeInTheDocument()
  })

  it('le ticket de caisse en bas mène aux réglages', async () => {
    servirProfil()
    monter()

    const ticket = await screen.findByRole('link', { name: /^Journal, la caisse/ })
    expect(ticket).toHaveAttribute('href', '/profil/reglages')
    expect(ticket).toHaveTextContent('Jour ou nuit · Letterboxd · doublons · se déconnecter')
  })

  it('n’a plus ni bilan en salle ni bilan des suivis', async () => {
    servirProfil()
    monter()

    await carte()
    expect(screen.queryByText(/séances en salle/)).not.toBeInTheDocument()
    expect(screen.queryByText(/suivis?, dont/)).not.toBeInTheDocument()
  })
})
