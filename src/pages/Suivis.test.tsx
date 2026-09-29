import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import Suivis from './Suivis'
import { createQueryClient } from '../api/queryClient'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import type { Realisateur } from '../api/realisateurs'
import type { Saga } from '../api/sagas'

const NOLAN = exemple<Realisateur[]>('/me/realisateurs', 'get', 200)[0]!
const ALIEN = exemple<Saga[]>('/me/sagas', 'get', 200)[0]!
const RESULTATS_PERSONNES = { results: [{ tmdb_id: NOLAN.tmdb_id, name: NOLAN.name, profile_url: NOLAN.profile_url }] }

// Le débounce de la recherche (300 ms, `recherche/useValeurDebouncee.ts`) tourne en temps réel
// ici, jamais accéléré : `findBy*` l'attend simplement, avec une marge au-dessus de son délai.
const DELAI_RECHERCHE = { timeout: 2000 }

function monter() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <Suivis />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('l’onglet Suivis', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('sans aucun suivi, montre les deux listes vides', async () => {
    servir({ 'GET /api/me/realisateurs': () => json([]), 'GET /api/me/sagas': () => json([]) })
    monter()

    expect(await screen.findByText('Tu ne suis aucun réalisateur.')).toBeInTheDocument()
    expect(screen.getByText('Tu ne suis aucune saga.')).toBeInTheDocument()
  })

  it('liste les réalisateurs et sagas déjà suivis, chacun en lien vers sa page', async () => {
    servir({ 'GET /api/me/realisateurs': () => json([NOLAN]), 'GET /api/me/sagas': () => json([ALIEN]) })
    monter()

    expect(await screen.findByRole('link', { name: (n) => n.includes(NOLAN.name) })).toHaveAttribute(
      'href',
      `/suivis/realisateurs/${NOLAN.tmdb_id}`,
    )
    expect(screen.getByRole('link', { name: (n) => n.includes(ALIEN.name) })).toHaveAttribute(
      'href',
      `/suivis/sagas/${ALIEN.tmdb_id}`,
    )
  })

  it('suivre un réalisateur trouvé par la recherche invalide le cache : il rejoint la liste', async () => {
    // Le premier appel rend une liste vide, le second (après la mutation) la rend avec Nolan —
    // c'est l'invalidation de `cles.realisateurs` qui déclenche ce second appel.
    let appelsListe = 0
    const requetes = servir({
      'GET /api/me/realisateurs': () => {
        appelsListe += 1
        return json(appelsListe === 1 ? [] : [NOLAN])
      },
      'GET /api/me/sagas': () => json([]),
      'GET /api/reference/personnes?q=Nolan': () => json(RESULTATS_PERSONNES),
      'POST /api/me/realisateurs': () => json(NOLAN, 201),
    })
    monter()

    await screen.findByText('Tu ne suis aucun réalisateur.')
    fireEvent.change(screen.getByLabelText('Un nom de réalisateur'), { target: { value: 'Nolan' } })

    const bouton = await screen.findByRole('button', { name: 'Suivre' }, DELAI_RECHERCHE)
    fireEvent.click(bouton)

    // Mutation : sans `invalidateQueries` dans `onSuccess`, `GET /api/me/realisateurs` ne
    // repartirait jamais une deuxième fois, et Nolan ne rejoindrait jamais la liste ci-dessous.
    expect(await screen.findByRole('link', { name: (n) => n.includes(NOLAN.name) })).toBeInTheDocument()
    expect(requetes.filter((r) => r === 'GET /api/me/realisateurs')).toHaveLength(2)
  })

  it('affiche l’erreur de la recherche telle quelle', async () => {
    const message = 'TMDB est momentanément indisponible.'
    servir({
      'GET /api/me/realisateurs': () => json([]),
      'GET /api/me/sagas': () => json([]),
      'GET /api/reference/personnes?q=Miyazaki': () => json({ code: 'SERVICE_UNCONFIGURED', message, retryable: false }, 503),
    })
    monter()

    await screen.findByText('Tu ne suis aucun réalisateur.')
    fireEvent.change(screen.getByLabelText('Un nom de réalisateur'), { target: { value: 'Miyazaki' } })

    expect(await screen.findByText(message, {}, DELAI_RECHERCHE)).toBeInTheDocument()
  })

  it('un réalisateur déjà suivi trouvé à nouveau par la recherche est marqué « Suivi », pas « Suivre »', async () => {
    servir({
      'GET /api/me/realisateurs': () => json([NOLAN]),
      'GET /api/me/sagas': () => json([]),
      'GET /api/reference/personnes?q=Nolan': () => json(RESULTATS_PERSONNES),
    })
    monter()

    await screen.findByRole('link', { name: (n) => n.includes(NOLAN.name) })
    fireEvent.change(screen.getByLabelText('Un nom de réalisateur'), { target: { value: 'Nolan' } })

    const resultats = await screen.findAllByRole('button', { name: 'Suivi' }, DELAI_RECHERCHE)
    expect(resultats).toHaveLength(1)
    expect(resultats[0]).toBeDisabled()
  })
})
