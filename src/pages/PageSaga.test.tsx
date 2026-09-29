import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import PageSaga from './PageSaga'
import { createQueryClient } from '../api/queryClient'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import type { Saga, FilmsSaga } from '../api/sagas'

const ALIEN = exemple<Saga[]>('/me/sagas', 'get', 200)[0]!
const FILMS = exemple<FilmsSaga>('/me/sagas/{tmdbId}/films', 'get', 200)

/** Le chemin courant, pour constater une redirection après « ne plus suivre ». */
function Ou() {
  return <output data-testid="chemin">{useLocation().pathname}</output>
}

function monter(tmdbId = 8091) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[`/suivis/sagas/${tmdbId}`]}>
        <Routes>
          <Route path="/suivis/sagas/:tmdbId" element={<PageSaga />} />
          <Route path="/suivis" element={<output>Suivis</output>} />
        </Routes>
        <Ou />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('la page d’une saga', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('affiche le nom, l’affiche et les films avec leur état', async () => {
    servir({
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/sagas/8091/films': () => json(FILMS),
    })
    monter()

    expect(await screen.findByRole('heading', { name: 'Alien (Saga)' })).toBeInTheDocument()
    expect(screen.getByText('1 vus sur 4')).toBeInTheDocument()
    expect(screen.getByText('Vu · 10/10')).toBeInTheDocument()
    expect(screen.getByText('Introuvable')).toBeInTheDocument()
    // Mutation : sans le repli sur « À voir », un film non vu et non introuvable (« Prometheus »)
    // n'afficherait aucun état.
    expect(screen.getAllByText('À voir')).toHaveLength(2)
  })

  it('sans aucun film, le dit plutôt que de montrer une liste vide', async () => {
    servir({
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/sagas/8091/films': () => json({ films: [] }),
    })
    monter()

    expect(await screen.findByText('Aucun film connu pour cette saga.')).toBeInTheDocument()
  })

  it('un film ouvre sa fiche', async () => {
    servir({
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/sagas/8091/films': () => json(FILMS),
    })
    monter()

    const lien = await screen.findByRole('link', { name: (n) => n.includes('Prometheus') })
    expect(lien).toHaveAttribute('href', '/suivis/films/70981')
  })

  it('ne plus suivre invalide le cache et repart vers les Suivis', async () => {
    const requetes = servir({
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/sagas/8091/films': () => json(FILMS),
      'DELETE /api/me/sagas/8091': () => new Response(null, { status: 204 }),
    })
    monter()

    const bouton = await screen.findByRole('button', { name: 'Ne plus suivre' })
    fireEvent.click(bouton)

    // Mutation : sans la navigation après succès, la page resterait affichée alors que la saga
    // n'est plus suivie — et sans `invalidateQueries`, l'onglet Suivis la montrerait encore.
    // Comparaison exacte : `toHaveTextContent` fait une recherche de sous-chaîne, et
    // `/suivis/sagas/8091` (la page de départ) contient déjà « /suivis ».
    await vi.waitFor(() => expect(screen.getByTestId('chemin').textContent).toBe('/suivis'))
    expect(requetes).toContain('DELETE /api/me/sagas/8091')
  })

  it('une panne sur ses films affiche l’erreur de l’API telle quelle', async () => {
    const message = 'TMDB est momentanément indisponible.'
    servir({
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/sagas/8091/films': () => json({ code: 'SERVICE_UNCONFIGURED', message, retryable: false }, 503),
    })
    monter()

    expect(await screen.findByText(message)).toBeInTheDocument()
  })

  it('une saga que je ne suis plus dit qu’elle n’est plus suivie, sans planter sur ses films', async () => {
    servir({
      'GET /api/me/sagas': () => json([]),
      'GET /api/me/sagas/8091/films': () => json({ code: 'NOT_FOUND', message: 'introuvable', retryable: false }, 404),
    })
    monter()

    expect(await screen.findByText('Tu ne suis plus cette saga.')).toBeInTheDocument()
  })
})
