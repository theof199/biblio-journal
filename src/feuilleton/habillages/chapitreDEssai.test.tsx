import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../../App'
import { createQueryClient } from '../../api/queryClient'
import { exemple } from '../../test/contrat'
import { json, servir } from '../../test/serveur'

/**
 * Un chapitre d'essai, déclaré ici et nulle part ailleurs : une ligne de plus dans la table, et la
 * fonction qui le choisit. Aucun composant n'est touché ; s'il fallait en toucher un pour qu'il
 * s'applique, ce test tomberait.
 */
vi.mock('./index', async (importerLeVrai) => {
  const vrai = await importerLeVrai<typeof import('./index')>()
  return {
    ...vrai,
    HABILLAGES: { ...vrai.HABILLAGES, 'chapitre-d-essai': { classe: 'habillage-d-essai', marque: 'Radiola', modele: 'modèle d’essai' } },
    habillageActif: () => 'chapitre-d-essai',
  }
})

await import('../Feuilleton')
await import('../../maison/Maison')
await import('../telecommande/Panneau')

const SESSION = exemple<{ user: { pseudo: string } }>('/auth/me', 'get', 200)

describe('un chapitre d’essai', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    servir({ 'GET /api/auth/me': () => json(SESSION) })
  })
  afterEach(() => vi.unstubAllGlobals())

  // Mutations : `habillage.classe` ôtée du bouton (`Bouton.tsx`) ou du panneau (`Panneau.tsx`) ; la marque
  // ou le modèle écrits en dur dans `Panneau.tsx` ; un second habillage choisi ailleurs que dans `Feuilleton.tsx`.
  it('s’applique au bouton et au panneau sans toucher à un composant : sa classe, sa marque, son modèle', async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/feuilleton/maison?telecommande=telecommande']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    const panneau = await screen.findByRole('dialog', { name: 'Télécommande' })
    const bouton = screen.getByRole('button', { name: 'Télécommande' })

    for (const piece of [panneau, bouton]) {
      const habille = piece.closest('[data-chapitre]')!
      expect(habille).toHaveAttribute('data-chapitre', 'chapitre-d-essai')
      expect(habille).toHaveClass('habillage-d-essai')
    }
    // Un seul habillage à la fois : rien d'autre ne porte un chapitre.
    expect([...document.querySelectorAll('[data-chapitre]')].map((e) => e.getAttribute('data-chapitre'))).toEqual(['chapitre-d-essai', 'chapitre-d-essai'])

    const pied = panneau.querySelector<HTMLElement>('[data-piece="pied"]')!
    expect(pied).toHaveTextContent('Radiola')
    expect(pied).toHaveTextContent('modèle d’essai')
    expect(pied).toHaveAttribute('aria-hidden', 'true')
    // Les libellés d'action, eux, ne sont pas de l'habillage.
    expect(within(panneau).getByRole('button', { name: 'Fermer la télécommande' })).toBeInTheDocument()
    expect(within(panneau).getByRole('group', { name: 'Cet épisode' })).toBeInTheDocument()
  })
})
