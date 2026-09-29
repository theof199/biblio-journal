import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import PageSaga from './PageSaga'
import { createQueryClient } from '../api/queryClient'
import { cles } from '../api/cles'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import { reinitialiserMasquerIntrouvables } from '../suivis/masquer'
import type { Saga, FilmsSaga } from '../api/sagas'
import type { SearchPage } from '../api/recherche'

const ALIEN = exemple<Saga[]>('/me/sagas', 'get', 200)[0]!
const FILMS = exemple<FilmsSaga>('/me/sagas/{tmdbId}/films', 'get', 200)
const RECHERCHE = exemple<SearchPage>('/search', 'get', 200)
const INCEPTION = RECHERCHE.items.find((r) => r.type === 'movie')!
const SANS_CONTENU = () => new Response(null, { status: 204 })

/** Le chemin courant, pour constater une redirection après « ne plus suivre ». */
function Ou() {
  return <output data-testid="chemin">{useLocation().pathname}</output>
}

function monter(tmdbId = 8091, client = createQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
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
  afterEach(() => {
    vi.unstubAllGlobals()
    reinitialiserMasquerIntrouvables()
  })

  it('affiche le nom, l’affiche et les films avec leur état', async () => {
    servir({
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/sagas/8091/films': () => json(FILMS),
    })
    monter()

    expect(await screen.findByRole('heading', { name: 'Alien (Saga)' })).toBeInTheDocument()
    expect(screen.getByText('1 vus sur 4')).toBeInTheDocument()
    expect(screen.getByText('Vu · 10/10')).toBeInTheDocument()
    // Mutation : sans le repli sur « À voir », un film non vu et non introuvable (« Prometheus »)
    // n'afficherait aucun état.
    expect(screen.getAllByText('À voir')).toHaveLength(2)
    // « Alien 3 » est introuvable : masqué par défaut.
    expect(screen.queryByText('Introuvable')).not.toBeInTheDocument()
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

  it('ne plus suivre demande d’abord confirmation dans la page, sans rien envoyer', async () => {
    const requetes = servir({
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/sagas/8091/films': () => json(FILMS),
    })
    const confirm = vi.fn(() => true)
    vi.stubGlobal('confirm', confirm)
    monter()

    fireEvent.click(await screen.findByRole('button', { name: 'Ne plus suivre' }))

    // Mutation : un bouton qui lancerait la suppression sans détour ferait partir le DELETE (et la
    // redirection) ici ; `requete inattendue` le ferait aussi tomber, la table ne le servant pas.
    const dialogue = screen.getByRole('alertdialog', { name: 'Ne plus suivre Alien (Saga) ?' })
    expect(dialogue).toHaveTextContent('Tes films vus, eux, restent au journal.')
    expect(requetes.some((r) => r.startsWith('DELETE'))).toBe(false)
    expect(screen.getByTestId('chemin').textContent).toBe('/suivis/sagas/8091')
    expect(confirm).not.toHaveBeenCalled()

    // « Annuler » referme sans rien envoyer, et rend le bouton d'origine.
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ne plus suivre' })).toBeInTheDocument()
    expect(requetes.some((r) => r.startsWith('DELETE'))).toBe(false)
  })

  it('confirmer invalide le cache et repart vers les Suivis', async () => {
    const requetes = servir({
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/sagas/8091/films': () => json(FILMS),
      'DELETE /api/me/sagas/8091': SANS_CONTENU,
    })
    const client = createQueryClient()
    monter(8091, client)

    fireEvent.click(await screen.findByRole('button', { name: 'Ne plus suivre' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Ne plus suivre' }))

    // Mutation : sans la navigation après succès, la page resterait affichée alors que la saga
    // n'est plus suivie — et sans `invalidateQueries`, l'onglet Suivis la montrerait encore.
    // Comparaison exacte : `toHaveTextContent` fait une recherche de sous-chaîne, et
    // `/suivis/sagas/8091` (la page de départ) contient déjà « /suivis ».
    await vi.waitFor(() => expect(screen.getByTestId('chemin').textContent).toBe('/suivis'))
    expect(requetes).toContain('DELETE /api/me/sagas/8091')
    // La liste n'a plus d'observateur une fois la page quittée : c'est sa marque qui compte.
    expect(client.getQueryState(cles.sagas)?.isInvalidated).toBe(true)
  })

  it('« Masquer les introuvables » est actif par défaut, et le couper fait revenir Alien 3', async () => {
    servir({
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/sagas/8091/films': () => json(FILMS),
    })
    monter()

    const interrupteur = await screen.findByRole('switch', { name: 'Masquer les introuvables' })
    expect(interrupteur).toBeChecked()
    expect(screen.queryByRole('link', { name: (n) => n.includes('Alien 3') })).not.toBeInTheDocument()
    // Le compte de l'en-tête garde tous les films : masquer n'efface pas de la saga.
    expect(screen.getByText('1 vus sur 4')).toBeInTheDocument()

    fireEvent.click(interrupteur)

    // Mutation : un filtre qui ignorerait l'interrupteur laisserait « Alien 3 » absent ici.
    expect(screen.getByRole('link', { name: (n) => n.includes('Alien 3') })).toBeInTheDocument()
    expect(screen.getByText('Introuvable')).toBeInTheDocument()
  })

  it('l’interrupteur d’une saga survit à une sortie de la page, tant que l’app tourne', async () => {
    servir({
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/sagas/8091/films': () => json(FILMS),
    })
    const premiere = monter()
    fireEvent.click(await screen.findByRole('switch', { name: 'Masquer les introuvables' }))
    premiere.unmount()

    monter()

    // Mutation : un réglage local à la page (comme celui d'un réalisateur) redeviendrait actif ici.
    expect(await screen.findByRole('switch', { name: 'Masquer les introuvables' })).not.toBeChecked()
  })

  it('un film ajouté à la main dit « ajouté » et se retire ; ceux de la collection n’ont pas ce bouton', async () => {
    let appels = 0
    const requetes = servir({
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/sagas/8091/films': () => {
        appels += 1
        return json(appels === 1 ? FILMS : { films: FILMS.films.filter((f) => f.tmdb_id !== 70981) })
      },
      'DELETE /api/me/sagas/8091/films/70981': SANS_CONTENU,
    })
    monter()

    // Prometheus est le seul film ajouté (`ajoute: true`) de l'exemple.
    const retirer = await screen.findByRole('button', { name: 'Retirer Prometheus de la saga' })
    // Mutation : un bouton posé sur chaque ligne en montrerait aussi sur Aliens, qui vient de la collection.
    expect(screen.getAllByRole('button', { name: /^Retirer .* de la saga$/ })).toHaveLength(1)
    expect(screen.getByText('ajouté')).toBeInTheDocument()

    fireEvent.click(retirer)

    expect(await screen.findByText('Retiré de la saga')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('link', { name: (n) => n.includes('Prometheus') })).not.toBeInTheDocument())
    expect(requetes).toContain('DELETE /api/me/sagas/8091/films/70981')
  })

  it('un film ajouté et déjà vu reste retirable', async () => {
    const films = { films: FILMS.films.map((f) => (f.tmdb_id === 70981 ? { ...f, vu: { entry_id: 'e-1', rating: 7, finished_at: '2026-09-01' } } : f)) }
    servir({ 'GET /api/me/sagas': () => json([ALIEN]), 'GET /api/me/sagas/8091/films': () => json(films) })
    monter()

    expect(await screen.findByRole('button', { name: 'Retirer Prometheus de la saga' })).toBeInTheDocument()
  })

  it('ajouter un film : la recherche, puis PUT, puis les films se rechargent', async () => {
    let appels = 0
    const requetes = servir({
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/sagas/8091/films': () => {
        appels += 1
        return json(FILMS)
      },
      'GET /api/search?type=movie&q=inception': () => json(RECHERCHE),
      'PUT /api/me/sagas/8091/films/27205': SANS_CONTENU,
    })
    monter()

    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un film' }))
    fireEvent.change(screen.getByLabelText('Chercher un film à ajouter'), { target: { value: 'inception' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter Inception à la saga' }, { timeout: 2000 }))

    // Mutation : le `filmId` du PUT est celui du film (27205), jamais celui de la saga (8091).
    expect(await screen.findByText('Ajouté à la saga')).toBeInTheDocument()
    expect(requetes).toContain('PUT /api/me/sagas/8091/films/27205')
    // Le panneau se referme, et la liste des films est redemandée.
    expect(screen.queryByLabelText('Chercher un film à ajouter')).not.toBeInTheDocument()
    await waitFor(() => expect(appels).toBe(2))
    expect(INCEPTION.external_id).toBe('27205')
  })

  it('un ajout qui échoue le dit sans détail, et garde le panneau ouvert', async () => {
    servir({
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/sagas/8091/films': () => json(FILMS),
      'GET /api/search?type=movie&q=inception': () => json(RECHERCHE),
      'PUT /api/me/sagas/8091/films/27205': () => json({ code: 'NOT_FOUND', message: 'Cette saga n’est pas suivie.', retryable: false }, 404),
    })
    monter()

    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un film' }))
    fireEvent.change(screen.getByLabelText('Chercher un film à ajouter'), { target: { value: 'inception' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter Inception à la saga' }, { timeout: 2000 }))

    expect(await screen.findByText('Impossible pour l’instant')).toBeInTheDocument()
    expect(screen.getByLabelText('Chercher un film à ajouter')).toBeInTheDocument()
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
