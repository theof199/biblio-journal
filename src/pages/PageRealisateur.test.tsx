import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import PageRealisateur from './PageRealisateur'
import { createQueryClient } from '../api/queryClient'
import { cles } from '../api/cles'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import type { RealisateurPage } from '../api/realisateurs'

const PAGE_SUIVI = exemple<RealisateurPage>('/me/realisateurs/{tmdbId}/page', 'get', 200)
const PAGE_NON_SUIVI: RealisateurPage = { ...PAGE_SUIVI, suivi: false }
const PERDU = { ...PAGE_SUIVI.films[0]!, tmdb_id: 999, title: 'Film perdu', year: 2001, vu: null, introuvable: true }
const PAGE_AVEC_PERDU: RealisateurPage = { ...PAGE_SUIVI, films: [PAGE_SUIVI.films[0]!, PERDU] }
const PAGE_SANS_FILMS: RealisateurPage = { ...PAGE_SUIVI, films: [] }

function monter(tmdbId = 525, client = createQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/suivis/realisateurs/${tmdbId}`]}>
        <Routes>
          <Route path="/suivis/realisateurs/:tmdbId" element={<PageRealisateur />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('la page d’un réalisateur', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('affiche la fiche et la filmographie, la série écartée', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_SUIVI) })
    monter()

    expect(await screen.findByRole('heading', { name: 'Christopher Nolan' })).toBeInTheDocument()
    expect(screen.getByText('1 vus sur 1')).toBeInTheDocument()
    expect(screen.getByText('Inception (2010)')).toBeInTheDocument()
    // Mutation : sans `filmsSansSeries`, la série de l'exemple (« Voyage à travers le cinéma
    // américain ») apparaîtrait aussi dans la liste et fausserait le compte ci-dessus (2 sur 2).
    expect(screen.queryByText(/Voyage à travers le cinéma américain/)).not.toBeInTheDocument()
  })

  it('« Masquer les introuvables » est actif par défaut, le coupe les fait revenir, le compte garde tout', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_AVEC_PERDU) })
    monter()

    const interrupteur = await screen.findByRole('switch', { name: 'Masquer les introuvables' })
    expect(interrupteur).toBeChecked()
    // Mutation : un filtre qui ignorerait l'interrupteur laisserait « Film perdu » affiché d'emblée.
    expect(screen.queryByText('Film perdu (2001)')).not.toBeInTheDocument()
    // L'en-tête compte tous les films, introuvables compris : masquer n'efface rien.
    expect(screen.getByText('1 vus sur 2')).toBeInTheDocument()

    fireEvent.click(interrupteur)

    expect(screen.getByText('Film perdu (2001)')).toBeInTheDocument()
    expect(screen.getByText('Introuvable')).toBeInTheDocument()
    expect(screen.getByText('1 vus sur 2')).toBeInTheDocument()
  })

  it('l’interrupteur d’un réalisateur ne survit pas à la page : il redevient actif', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_AVEC_PERDU) })
    const premiere = monter()
    fireEvent.click(await screen.findByRole('switch', { name: 'Masquer les introuvables' }))
    premiere.unmount()

    monter()

    // Mutation : un réglage tenu hors de la page (comme celui des sagas) resterait coupé ici.
    expect(await screen.findByRole('switch', { name: 'Masquer les introuvables' })).toBeChecked()
  })

  it('le sceau « Rétrospective complète » quand tout est vu ou introuvable, pas avant', async () => {
    const A_VOIR = { ...PAGE_SUIVI.films[0]!, tmdb_id: 998, title: 'Film à voir', year: 2002, vu: null, introuvable: false }
    servir({
      // Inception vu, et un introuvable jamais vu.
      'GET /api/me/realisateurs/525/page': () => json(PAGE_AVEC_PERDU),
      'GET /api/me/realisateurs/526/page': () => json({ ...PAGE_AVEC_PERDU, tmdb_id: 526, films: [...PAGE_AVEC_PERDU.films, A_VOIR] }),
    })
    const { unmount } = monter()

    // Mutation : exiger un visionnage de chaque film, l'introuvable compris, retirerait ce sceau.
    expect(await screen.findByRole('img', { name: 'Rétrospective complète' })).toBeInTheDocument()
    unmount()

    monter(526)
    await screen.findByText('Film à voir (2002)')
    // Mutation : un sceau posé sans condition resterait ici.
    expect(screen.queryByRole('img', { name: 'Rétrospective complète' })).not.toBeInTheDocument()
  })

  it('sans aucun film, le dit plutôt que de montrer une liste vide', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_SANS_FILMS) })
    monter()

    expect(await screen.findByText('Aucun film connu pour ce réalisateur.')).toBeInTheDocument()
  })

  it('un film ouvre la fiche du film, avec le film et le réalisateur déjà connu en état de navigation', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_SUIVI) })
    monter()

    const lien = await screen.findByRole('link', { name: (n) => n.includes('Inception') })
    expect(lien).toHaveAttribute('href', '/suivis/films/27205')
  })

  it('ne plus suivre invalide le cache : la page relue montre « Suivre »', async () => {
    let appels = 0
    const requetes = servir({
      'GET /api/me/realisateurs/525/page': () => {
        appels += 1
        return json(appels === 1 ? PAGE_SUIVI : PAGE_NON_SUIVI)
      },
      'DELETE /api/me/realisateurs/525': () => new Response(null, { status: 204 }),
    })
    const client = createQueryClient()
    client.setQueryData(cles.realisateurs, [])
    monter(525, client)

    const bouton = await screen.findByRole('button', { name: 'Suivi' })
    fireEvent.click(bouton)

    // Mutation : sans `invalidateQueries`, la page ne serait jamais relue et le bouton resterait
    // sur « Suivi » malgré le `DELETE` réussi.
    expect(await screen.findByRole('button', { name: 'Suivre' })).toBeInTheDocument()
    expect(requetes.filter((r) => r.includes('/me/realisateurs/525/page'))).toHaveLength(2)
    // Mutation : n'invalider que `cles.pageRealisateur(525)` laisserait l'onglet Suivis le lister.
    expect(client.getQueryState(cles.realisateurs)?.isInvalidated).toBe(true)
  })

  it('suivre depuis une page pas encore suivie invalide le cache : la page relue montre « Suivi »', async () => {
    let appels = 0
    servir({
      'GET /api/me/realisateurs/525/page': () => {
        appels += 1
        return json(appels === 1 ? PAGE_NON_SUIVI : PAGE_SUIVI)
      },
      'POST /api/me/realisateurs': () => json(PAGE_SUIVI, 201),
    })
    monter()

    const bouton = await screen.findByRole('button', { name: 'Suivre' })
    fireEvent.click(bouton)

    expect(await screen.findByRole('button', { name: 'Suivi' })).toBeInTheDocument()
  })

  it('affiche l’erreur de l’API telle quelle sur un échec de suivi', async () => {
    const message = 'Ce réalisateur est introuvable chez TMDB.'
    servir({
      'GET /api/me/realisateurs/525/page': () => json(PAGE_SUIVI),
      'DELETE /api/me/realisateurs/525': () => json({ code: 'NOT_FOUND', message, retryable: false }, 404),
    })
    monter()

    const bouton = await screen.findByRole('button', { name: 'Suivi' })
    fireEvent.click(bouton)

    expect(await screen.findByText(message)).toBeInTheDocument()
  })
})
