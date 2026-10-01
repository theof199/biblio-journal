import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import type { ChoixSensCritique, EtatSensCritique, FilmsAApparier } from '../api/senscritique'
import { exemple } from '../test/contrat'
import { json, servir } from '../test/serveur'

const SESSION = exemple<{ user: { pseudo: string } }>('/auth/me', 'get', 200)
/** Un film, « Le Voyage dans la Lune », et ses deux candidats de même titre. */
const LISTE = exemple<FilmsAApparier>('/me/senscritique/a-apparier', 'get', 200)
const FILM = LISTE.items[0]!
const [MELIES, AUTRE] = FILM.candidates as [(typeof FILM.candidates)[number], (typeof FILM.candidates)[number]]
const CHOIX = exemple<ChoixSensCritique>('/me/senscritique/appariements/{mediaId}', 'put', 200)
const RELIE = exemple<EtatSensCritique>('/me/senscritique', 'get', 200)

const A_APPARIER = 'GET /api/me/senscritique/a-apparier'
const CHOISIR = `PUT /api/me/senscritique/appariements/${FILM.media_id}`

const NOM_MELIES = 'Le Voyage dans la Lune (1902), Georges Méliès'
const NOM_AUTRE = 'Le Voyage dans la Lune (1902), A Trip to the Moon'

function monter() {
  const client = createQueryClient()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/profil/senscritique']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

describe('les films à apparier chez SensCritique', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  const base = (extra: Record<string, (init: RequestInit) => Response | Promise<Response>> = {}) =>
    servir({ 'GET /api/auth/me': () => json(SESSION), [A_APPARIER]: () => json(LISTE), ...extra })

  // Mutation : retirer la route de `App.tsx` ; taire la date ou la note qui attendent ; ne plus
  // dire ce qui distingue deux candidats de même titre (le réalisateur, le titre original).
  it('s’ouvre sur /profil/senscritique : chaque film avec la note et la date qui attendent, et ses candidats', async () => {
    base()
    monter()

    expect(await screen.findByRole('heading', { level: 1, name: 'Films à apparier' })).toBeInTheDocument()
    expect(await screen.findByText('Vu le 27 septembre 2026 · 9/10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: NOM_MELIES })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: NOM_AUTRE })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: MELIES.title })).toHaveAttribute('src', MELIES.picture_url)
  })

  // Mutation : envoyer un autre `product_id` que celui du candidat touché ; relire la liste après le
  // choix (le film en sortirait, et ce que le choix a donné avec lui) ; ne pas poser l'état rendu.
  it('toucher un candidat envoie son product_id, dit ce que le choix a donné et pose l’état sans rien relire', async () => {
    const envoye: unknown[] = []
    let choisi = false
    const requetes = base({
      [A_APPARIER]: () => json(choisi ? { items: [] } : LISTE),
      [CHOISIR]: (init) => {
        choisi = true
        envoye.push(JSON.parse(String(init.body)))
        return json(CHOIX)
      },
    })
    const client = monter()
    fireEvent.click(await screen.findByRole('button', { name: NOM_AUTRE }))

    expect(await screen.findByRole('status')).toHaveTextContent('La note est partie chez SensCritique.')
    expect(envoye).toEqual([{ product_id: AUTRE.product_id }])
    expect(client.getQueryData(cles.senscritique)).toEqual(CHOIX.etat)
    expect(requetes.filter((r) => r !== 'GET /api/auth/me')).toEqual([A_APPARIER, CHOISIR])
    // Le film tranché ne se choisit plus.
    expect(screen.queryByRole('button', { name: NOM_MELIES })).not.toBeInTheDocument()
  })

  // Mutation : ne pas périmer la liste (la prochaine visite remontrerait le film déjà tranché).
  it('après un choix, la liste est périmée pour la prochaine visite', async () => {
    base({ [CHOISIR]: () => json(CHOIX) })
    const client = monter()
    fireEvent.click(await screen.findByRole('button', { name: NOM_MELIES }))

    await screen.findByRole('status')
    expect(client.getQueryState(cles.senscritiqueAApparier)?.isInvalidated).toBe(true)
  })

  // Mutation : confondre deux résultats (dire « partie » d'un envoi qui attend) ; envoyer un
  // `product_id` pour « Aucun de ceux-là ».
  it.each([
    { resultat: 'en_attente', message: 'Choix retenu. L’envoi n’est pas passé : il sera rejoué.' },
    { resultat: 'memorise', message: 'Choix retenu.' },
  ] as const)('un choix « $resultat » se dit tel quel', async ({ resultat, message }) => {
    base({ [CHOISIR]: () => json({ ...CHOIX, resultat }) })
    monter()
    fireEvent.click(await screen.findByRole('button', { name: NOM_MELIES }))

    expect(await screen.findByRole('status')).toHaveTextContent(new RegExp(`^${message}$`))
  })

  it('« Aucun de ceux-là » envoie product_id nul : le film ne partira pas', async () => {
    const envoye: unknown[] = []
    base({
      [CHOISIR]: (init) => {
        envoye.push(JSON.parse(String(init.body)))
        return json({ ...CHOIX, product_id: null, resultat: 'ignore' })
      },
    })
    monter()
    fireEvent.click(await screen.findByRole('button', { name: 'Aucun de ceux-là' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Ce film ne partira pas chez SensCritique.')
    expect(envoye).toEqual([{ product_id: null }])
  })

  // Mutation : ne plus offrir « Aucun de ceux-là » quand la recherche n'a rien rendu (le film
  // resterait à apparier pour toujours).
  it('sans candidat : il le dit, et « Aucun de ceux-là » reste la seule réponse', async () => {
    base({ [A_APPARIER]: () => json({ items: [{ ...FILM, candidates: [] }] }) })
    monter()

    expect(await screen.findByText('SensCritique n’a rendu aucun film pour celui-ci.')).toBeInTheDocument()
    expect(screen.getAllByRole('button').map((bouton) => bouton.textContent)).toContain('Aucun de ceux-là')
    expect(screen.queryByRole('button', { name: /\(1902\)/ })).not.toBeInTheDocument()
  })

  // Mutation : avaler l'erreur ; tenir le film pour tranché ; ne pas périmer l'état (la caisse
  // dirait encore « relié ») ; ne pas mener à la caisse ; retirer `exact: true` de l'invalidation
  // (la liste, sous la même clé, serait relue elle aussi).
  it('session refusée (409) : le message de l’API, le choix reste à faire, et la caisse offre de relier', async () => {
    const message = 'Ta session SensCritique a expiré : reconnecte-toi, tes envois attendent.'
    const requetes = base({ [CHOISIR]: () => json({ code: 'SENSCRITIQUE_SESSION_EXPIREE', message, retryable: false }, 409) })
    const client = monter()
    client.setQueryData(cles.senscritique, RELIE)
    fireEvent.click(await screen.findByRole('button', { name: NOM_MELIES }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByRole('button', { name: NOM_MELIES })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Relier mon compte à la caisse' })).toHaveAttribute('href', '/profil/reglages')
    await waitFor(() => expect(client.getQueryState(cles.senscritique)?.isInvalidated).toBe(true))
    expect(requetes.filter((r) => r === A_APPARIER)).toHaveLength(1)
  })

  // Mutation : offrir la caisse sur n'importe quelle erreur.
  it('une autre erreur du choix se dit, sans renvoyer à la caisse', async () => {
    const message = 'SensCritique ne répond pas. Réessaie dans un instant.'
    base({ [CHOISIR]: () => json({ code: 'UPSTREAM_UNAVAILABLE', message, retryable: true }, 503) })
    monter()
    fireEvent.click(await screen.findByRole('button', { name: NOM_MELIES }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByRole('link', { name: /caisse/ })).not.toBeInTheDocument()
  })

  // Mutation : rendre une liste vide sans rien dire.
  it('rien à apparier : il le dit', async () => {
    base({ [A_APPARIER]: () => json({ items: [] }) })
    monter()

    expect(await screen.findByText('Aucun film à apparier.')).toBeInTheDocument()
  })

  // Mutation : rester sur « Chargement… » quand la liste échoue.
  it('la liste refusée : le message de l’API', async () => {
    const message = 'SensCritique n’est pas configuré sur ce serveur.'
    base({ [A_APPARIER]: () => json({ code: 'SERVICE_UNCONFIGURED', message, retryable: false }, 503) })
    monter()

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })
})
