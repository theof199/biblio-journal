import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import Fiche from './Fiche'
import { createQueryClient } from '../api/queryClient'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import type { JournalPage } from '../api/journal'
import type { ReactionsCatalogue } from '../api/reactions'

const CATALOGUE = exemple<ReactionsCatalogue>('/reference/reactions', 'get', 200)
const ITEM = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!

function monter(item = ITEM) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: `/journal/${item.entry.id}`, state: { item } }]}>
        <Routes>
          <Route path="/journal/:id" element={<Fiche />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('la fiche d’un visionnage', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('ne montre jamais la remarque privée du carnet', async () => {
    servir({ 'GET /api/reference/reactions': () => json(CATALOGUE) })
    expect(ITEM.carnet.comment).toBeTruthy()
    monter()

    await screen.findByRole('heading', { name: ITEM.media.title })
    // Mutation : sans cette omission volontaire, la remarque — qui n'appartient qu'à son auteur —
    // apparaîtrait sur un écran que rien n'empêche d'être atteint depuis une source publique demain.
    expect(screen.queryByText(ITEM.carnet.comment!)).not.toBeInTheDocument()
  })

  it('montre l’affiche, la note et les réactions, avec un lien vers la correction', async () => {
    servir({ 'GET /api/reference/reactions': () => json(CATALOGUE) })
    monter()

    await screen.findByRole('heading', { name: ITEM.media.title })
    expect(screen.getByText(`Noté ${ITEM.entry.rating} / 10`)).toBeInTheDocument()
    for (const cle of ITEM.carnet.reactions) {
      const reaction = CATALOGUE.reactions.find((r) => r.cle === cle)!
      expect(await screen.findByText(`${reaction.emoji} ${reaction.phrase}`)).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: 'Corriger' })).toHaveAttribute(
      'href',
      `/journal/${ITEM.entry.id}/corriger`,
    )
  })

  it('sans historique de l’app derrière elle, « Retour » mène à la page qui l’a ouverte (`depuis`)', async () => {
    servir({ 'GET /api/reference/reactions': () => json(CATALOGUE) })
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[{ pathname: `/journal/${ITEM.entry.id}`, state: { item: ITEM, depuis: '/profil/mes-films' } }]}>
          <Routes>
            <Route path="/journal/:id" element={<Fiche />} />
            <Route path="/profil/mes-films" element={<h1>Mes films</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await screen.findByRole('heading', { name: ITEM.media.title })

    // Mutation : `vers="/"` en dur dans la fiche ramènerait à l'accueil. Avec l'historique derrière
    // elle, le retour recule (`ui/BoutonRetour.tsx`) ; `depuis` est le repli sans lui.
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))

    expect(await screen.findByRole('heading', { name: 'Mes films' })).toBeInTheDocument()
  })

  it('sans état de navigation (rechargement direct), renvoie vers l’accueil plutôt que de planter', () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[`/journal/${ITEM.entry.id}`]}>
          <Routes>
            <Route path="/journal/:id" element={<Fiche />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByText('Ce visionnage n’est plus disponible. Repars de l’accueil.')).toBeInTheDocument()
  })
})
