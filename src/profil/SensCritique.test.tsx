import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import type { EtatSensCritique } from '../api/senscritique'
import { exemple } from '../test/contrat'
import { json, servir } from '../test/serveur'
import SensCritique from './SensCritique'

const ETAT = 'GET /api/me/senscritique'
const RELIER = 'POST /api/me/senscritique/connexion'
const DELIER = 'DELETE /api/me/senscritique'

/** Relié (un envoi en attente, un film à apparier), et jamais relié. */
const RELIE = exemple<EtatSensCritique>('/me/senscritique', 'get', 200)
const DELIE = exemple<EtatSensCritique>('/me/senscritique', 'delete', 200)

const IDENTIFIANT = 'moi@exemple.fr'
const MOT_DE_PASSE = 'un-secret-de-sc'

const refus = (code: string, message: string, status: number, entetes: Record<string, string> = {}) =>
  new Response(JSON.stringify({ code, message, retryable: false }), { status, headers: entetes })

function monter() {
  const client = createQueryClient()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SensCritique />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

/** Ouvre le formulaire, le remplit et l'envoie. */
async function relier() {
  fireEvent.click(await screen.findByRole('button', { name: /Relier mon compte/ }))
  fireEvent.change(screen.getByLabelText(/Identifiant SensCritique/), { target: { value: IDENTIFIANT } })
  fireEvent.change(screen.getByLabelText('Mot de passe SensCritique'), { target: { value: MOT_DE_PASSE } })
  fireEvent.click(screen.getByRole('button', { name: 'Relier' }))
}

describe('la liaison SensCritique, à la caisse', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Mutation : rendre le titre avant le garde `!etat.data` (une section vide resterait à la caisse).
  it('sans clé sur le serveur (503), toute la section est masquée, titre compris', async () => {
    const requetes = servir({
      [ETAT]: () => refus('SERVICE_UNCONFIGURED', 'SensCritique n’est pas configuré sur ce serveur.', 503),
    })
    monter()
    await waitFor(() => expect(requetes).toContain(ETAT))
    // Le témoin : la même section, avec un état, affiche son titre (tests suivants) ; ici on laisse
    // la réponse s'installer avant de constater l'absence.
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByRole('heading', { name: 'SensCritique' })).not.toBeInTheDocument()
  })

  // Mutation : envoyer `{ identifiant: motDePasse, mot_de_passe: identifiant }` ; invalider la clé
  // au lieu d'y poser la réponse (l'état serait relu, et le `GET` compté deux fois) ; lancer la
  // liaison dès l'ouverture du formulaire.
  it('relier envoie l’identifiant et le mot de passe, puis montre le compte sans relire l’état', async () => {
    const envoye: unknown[] = []
    const requetes = servir({
      [ETAT]: () => json(envoye.length > 0 ? RELIE : DELIE),
      [RELIER]: (init) => {
        envoye.push(JSON.parse(String(init.body)))
        return json(RELIE)
      },
    })
    monter()
    expect(await screen.findByRole('heading', { name: 'SensCritique' })).toBeInTheDocument()
    // Rien ne part à l'ouverture du formulaire.
    fireEvent.click(screen.getByRole('button', { name: /Relier mon compte/ }))
    expect(requetes).toEqual([ETAT])

    fireEvent.change(screen.getByLabelText(/Identifiant SensCritique/), { target: { value: IDENTIFIANT } })
    fireEvent.change(screen.getByLabelText('Mot de passe SensCritique'), { target: { value: MOT_DE_PASSE } })
    fireEvent.click(screen.getByRole('button', { name: 'Relier' }))

    expect(await screen.findByText(RELIE.pseudo!)).toBeInTheDocument()
    expect(envoye).toEqual([{ identifiant: IDENTIFIANT, mot_de_passe: MOT_DE_PASSE }])
    expect(requetes).toEqual([ETAT, RELIER])
  })

  // Mutation : retirer `gcTime: 0` (les variables de la mutation gardent le mot de passe cinq minutes) ;
  // l'écrire dans le stockage local ; le poser dans le cache avec l'état.
  it('une fois relié, le mot de passe ne reste nulle part : ni stockage, ni cache', async () => {
    servir({ [ETAT]: () => json(DELIE), [RELIER]: () => json(RELIE) })
    const client = monter()
    await relier()
    await screen.findByText(RELIE.pseudo!)

    expect(JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })).not.toContain(MOT_DE_PASSE)
    expect(JSON.stringify(client.getQueryCache().getAll().map((requete) => requete.state.data))).not.toContain(MOT_DE_PASSE)
    await waitFor(() =>
      expect(JSON.stringify(client.getMutationCache().getAll().map((mutation) => mutation.state.variables))).not.toContain(
        MOT_DE_PASSE,
      ),
    )
  })

  // Mutation : ne pas rendre `liaison.error` ; fermer le formulaire sur une erreur.
  it('identifiants refusés (422) : le message de l’API, et le formulaire reste ouvert pour corriger', async () => {
    const message = 'SensCritique a refusé cet identifiant ou ce mot de passe.'
    servir({
      [ETAT]: () => json(DELIE),
      [RELIER]: () => refus('SENSCRITIQUE_IDENTIFIANTS_REFUSES', message, 422),
    })
    monter()
    await relier()

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText(/Identifiant SensCritique/)).toHaveValue(IDENTIFIANT)
    expect(screen.getByRole('button', { name: 'Relier' })).toBeEnabled()
  })

  // Mutation : ne pas lire `retryAfterSeconds` (le bouton resterait actif, et chaque essai compterait
  // chez l'API) ; ne jamais rendre le bouton.
  it('trop de tentatives (429) : le bouton attend le Retry-After, puis se rend', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const message = 'Trop de tentatives. Réessaie dans un quart d’heure.'
    const requetes = servir({
      [ETAT]: () => json(DELIE),
      [RELIER]: () => refus('RATE_LIMITED', message, 429, { 'Retry-After': '90' }),
    })
    monter()
    await relier()

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    const bouton = screen.getByRole('button', { name: 'Relier' })
    expect(bouton).toBeDisabled()
    // Un envoi au clavier ne part pas non plus.
    fireEvent.submit(bouton.closest('form')!)
    await act(() => vi.advanceTimersByTimeAsync(89_000))
    expect(bouton).toBeDisabled()
    expect(requetes.filter((r) => r === RELIER)).toHaveLength(1)

    await act(() => vi.advanceTimersByTimeAsync(1_000))
    expect(bouton).toBeEnabled()
  })

  // Mutation : afficher une ligne sans regarder son compteur ; écrire le pluriel, ou le singulier, partout.
  it.each([
    { cas: 'un envoi, un film', envois: 1, films: 1, presents: ['1 note en attente d’envoi', '1 film à apparier'], absent: null },
    { cas: 'aucun envoi, trois films', envois: 0, films: 3, presents: ['3 films à apparier'], absent: /en attente d’envoi/ },
    { cas: 'deux envois, aucun film', envois: 2, films: 0, presents: ['2 notes en attente d’envoi'], absent: /à apparier/ },
  ])('relié, $cas : seuls les compteurs non nuls se disent, accordés', async ({ envois, films, presents, absent }) => {
    servir({ [ETAT]: () => json({ ...RELIE, envois_en_attente: envois, a_apparier: films }) })
    monter()

    expect(await screen.findByText(RELIE.pseudo!)).toBeInTheDocument()
    for (const texte of presents) expect(screen.getByText(texte)).toBeInTheDocument()
    if (absent) expect(screen.queryByText(absent)).not.toBeInTheDocument()
  })

  // Mutation : rendre le compteur en simple texte ; viser une autre page.
  it('relié, les films à apparier mènent à leur page', async () => {
    servir({ [ETAT]: () => json(RELIE) })
    monter()

    expect(await screen.findByRole('link', { name: '1 film à apparier' })).toHaveAttribute('href', '/profil/senscritique')
  })

  // Mutation : ne plus retirer la liste du cache après le `DELETE` (la page des films à apparier
  // la remontrerait, alors que l'API l'a effacée).
  it('délier oublie aussi la liste des films à apparier gardée en cache', async () => {
    servir({ [ETAT]: () => json(RELIE), [DELIER]: () => json(DELIE) })
    const client = monter()
    client.setQueryData(cles.senscritiqueAApparier, { items: [] })

    fireEvent.click(await screen.findByRole('button', { name: 'Délier mon compte' }))
    fireEvent.click(screen.getByRole('button', { name: 'Délier' }))
    await screen.findByRole('button', { name: /Relier mon compte/ })
    expect(client.getQueryData(cles.senscritiqueAApparier)).toBeUndefined()
  })

  // Mutation : lancer le `DELETE` dès « Délier mon compte » ; relire l'état au lieu de poser la réponse.
  it('délier demande une confirmation dans la page, puis efface et rend « Relier mon compte »', async () => {
    const requetes = servir({ [ETAT]: () => json(RELIE), [DELIER]: () => json(DELIE) })
    monter()

    fireEvent.click(await screen.findByRole('button', { name: 'Délier mon compte' }))
    expect(screen.getByText(/Les notes en attente ne partiront plus/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(requetes).toEqual([ETAT])

    fireEvent.click(screen.getByRole('button', { name: 'Délier mon compte' }))
    fireEvent.click(screen.getByRole('button', { name: 'Délier' }))
    expect(await screen.findByRole('button', { name: /Relier mon compte/ })).toBeInTheDocument()
    expect(screen.queryByText(RELIE.pseudo!)).not.toBeInTheDocument()
    expect(requetes).toEqual([ETAT, DELIER])
  })

  // Mutation : avaler l'erreur du retrait au lieu de l'afficher.
  it('un retrait refusé se dit', async () => {
    const message = 'SensCritique n’est pas configuré sur ce serveur.'
    servir({ [ETAT]: () => json(RELIE), [DELIER]: () => refus('SERVICE_UNCONFIGURED', message, 503) })
    monter()
    fireEvent.click(await screen.findByRole('button', { name: 'Délier mon compte' }))
    fireEvent.click(screen.getByRole('button', { name: 'Délier' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  // Mutation : ne plus rendre la ligne des envois quand le compte n'est pas relié.
  it('session refusée par SensCritique : les notes qui attendent se disent', async () => {
    servir({ [ETAT]: () => json({ ...DELIE, envois_en_attente: 2 }) })
    monter()

    expect(await screen.findByRole('status')).toHaveTextContent('2 notes en attente d’envoi : elles partiront une fois ton compte relié.')
  })
})
