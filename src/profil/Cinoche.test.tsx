import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { EtatCinoche } from '../api/cinoche'
import { createQueryClient } from '../api/queryClient'
import { exemple } from '../test/contrat'
import { json, servir } from '../test/serveur'
import Cinoche from './Cinoche'

const ETAT = 'GET /api/me/cinoche'
const RELIER = 'POST /api/me/cinoche/connexion'
const DELIER = 'DELETE /api/me/cinoche'

/** Relié (un envoi en attente), jamais relié, et relié dont Cinoche a refusé la session. */
const RELIE = exemple<EtatCinoche>('/me/cinoche', 'get', 200)
const DELIE = exemple<EtatCinoche>('/me/cinoche', 'delete', 200)
const EXPIREE: EtatCinoche = { ...RELIE, connecte: false, session_expiree: true, expire_le: null, envois_en_attente: 0 }

const EMAIL = 'moi@exemple.fr'
const MOT_DE_PASSE = 'un-secret-de-cinoche'

const refus = (code: string, message: string, status: number, entetes: Record<string, string> = {}, retryable = false) =>
  new Response(JSON.stringify({ code, message, retryable }), { status, headers: entetes })

function monter() {
  const client = createQueryClient()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Cinoche />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

/** Ouvre le formulaire, le remplit et l'envoie. */
async function relier() {
  fireEvent.click(await screen.findByRole('button', { name: /Relier mon compte/ }))
  fireEvent.change(screen.getByLabelText('E-mail du compte Cinoche'), { target: { value: EMAIL } })
  fireEvent.change(screen.getByLabelText('Mot de passe Cinoche'), { target: { value: MOT_DE_PASSE } })
  fireEvent.click(screen.getByRole('button', { name: 'Relier' }))
}

describe('la liaison Cinoche, à la caisse', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // Mutation : rendre le titre avant le garde `!etat.data` (une section vide resterait à la caisse).
  it('sans clé sur le serveur (503), toute la section est masquée, titre compris', async () => {
    servir({ [ETAT]: () => refus('SERVICE_UNCONFIGURED', 'Cinoche n’est pas configuré sur ce serveur.', 503) })
    const client = monter()
    // Aucune pause : on attend que la requête ait fini en erreur, puis on constate l'absence.
    await waitFor(() => expect(client.getQueryState(['cinoche'])?.status).toBe('error'))
    expect(screen.queryByRole('heading', { name: 'Cinoche' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  // Mutation : envoyer `{ email: motDePasse, mot_de_passe: email }` ; invalider la clé au lieu d'y
  // poser la réponse (le `GET` serait compté deux fois) ; lancer la liaison dès l'ouverture.
  it('relier envoie l’e-mail et le mot de passe, puis montre le compte sans relire l’état', async () => {
    const envoye: unknown[] = []
    const requetes = servir({
      [ETAT]: () => json(envoye.length > 0 ? RELIE : DELIE),
      [RELIER]: (init) => {
        envoye.push(JSON.parse(String(init.body)))
        return json(RELIE)
      },
    })
    monter()
    expect(await screen.findByRole('heading', { name: 'Cinoche' })).toBeInTheDocument()
    // Rien ne part à l'ouverture du formulaire.
    fireEvent.click(screen.getByRole('button', { name: /Relier mon compte/ }))
    expect(requetes).toEqual([ETAT])

    fireEvent.change(screen.getByLabelText('E-mail du compte Cinoche'), { target: { value: EMAIL } })
    fireEvent.change(screen.getByLabelText('Mot de passe Cinoche'), { target: { value: MOT_DE_PASSE } })
    fireEvent.click(screen.getByRole('button', { name: 'Relier' }))

    expect(await screen.findByText(RELIE.email!)).toBeInTheDocument()
    expect(screen.getByText('Compte relié')).toBeInTheDocument()
    expect(screen.getByText('1 note en attente d’envoi')).toBeInTheDocument()
    expect(envoye).toEqual([{ email: EMAIL, mot_de_passe: MOT_DE_PASSE }])
    expect(requetes).toEqual([ETAT, RELIER])
  })

  // Mutation : retirer la phrase du formulaire.
  it('le formulaire prévient qu’un compte créé avec Google doit d’abord poser un mot de passe', async () => {
    servir({ [ETAT]: () => json(DELIE) })
    monter()
    fireEvent.click(await screen.findByRole('button', { name: /Relier mon compte/ }))

    expect(screen.getByText(/créé avec Google.*pose-en d’abord un dans ton profil Cinoche/)).toBeInTheDocument()
  })

  // Mutation : retirer `gcTime: 0` (les variables de la mutation gardent le mot de passe cinq minutes) ;
  // l'écrire dans le stockage local ou de session ; le journaliser ; ne pas vider le champ à « Annuler ».
  it('le mot de passe ne reste nulle part : ni stockage, ni cache, ni journal de la console', async () => {
    const consoles = (['log', 'info', 'warn', 'error', 'debug'] as const).map((niveau) =>
      vi.spyOn(console, niveau).mockImplementation(() => {}),
    )
    servir({ [ETAT]: () => json(DELIE), [RELIER]: () => json(RELIE) })
    const client = monter()
    await relier()
    await screen.findByText(RELIE.email!)

    expect(JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })).not.toContain(MOT_DE_PASSE)
    expect(JSON.stringify(client.getQueryCache().getAll().map((requete) => requete.state.data))).not.toContain(MOT_DE_PASSE)
    await waitFor(() =>
      expect(JSON.stringify(client.getMutationCache().getAll().map((mutation) => mutation.state.variables))).not.toContain(
        MOT_DE_PASSE,
      ),
    )
    expect(JSON.stringify(consoles.flatMap((espion) => espion.mock.calls))).not.toContain(MOT_DE_PASSE)
  })

  // Mutation : ne plus vider le mot de passe dans `fermer`.
  it('« Annuler » oublie le mot de passe saisi : le formulaire rouvert est vide', async () => {
    servir({ [ETAT]: () => json(DELIE) })
    monter()
    fireEvent.click(await screen.findByRole('button', { name: /Relier mon compte/ }))
    fireEvent.change(screen.getByLabelText('Mot de passe Cinoche'), { target: { value: MOT_DE_PASSE } })
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    fireEvent.click(screen.getByRole('button', { name: /Relier mon compte/ }))

    expect(screen.getByLabelText('Mot de passe Cinoche')).toHaveValue('')
  })

  // Mutation : ne pas rendre `liaison.error` ; fermer le formulaire sur une erreur.
  it('identifiants refusés (422) : le message de l’API, et le formulaire reste ouvert pour corriger', async () => {
    const message = exempleDeRefus
    servir({ [ETAT]: () => json(DELIE), [RELIER]: () => refus('CINOCHE_IDENTIFIANTS_REFUSES', message, 422) })
    monter()
    await relier()

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText('E-mail du compte Cinoche')).toHaveValue(EMAIL)
    expect(screen.getByRole('button', { name: 'Relier' })).toBeEnabled()
  })

  // Mutation : remplacer le message de l'API par une phrase de refus écrite ici, quel que soit le code.
  it.each([
    { cas: 'Cinoche ne répond pas', retryable: true, message: 'Cinoche ne répond pas pour le moment. Réessaie dans quelques instants.' },
    {
      cas: 'Cinoche a répondu d’une façon inattendue',
      retryable: false,
      message:
        'Cinoche a répondu d’une façon inattendue : tes identifiants ne sont pas en cause. Réessaie plus tard ; si cela dure, la liaison avec Cinoche est à revoir.',
    },
  ])('service indisponible (503, $cas) : son message, et rien qui parle d’un refus d’identifiants', async ({ message, retryable }) => {
    const requetes = servir({
      [ETAT]: () => json(DELIE),
      [RELIER]: () => refus('UPSTREAM_UNAVAILABLE', message, 503, {}, retryable),
    })
    monter()
    await relier()

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent(message)
    expect(alerte).not.toHaveTextContent(/refusé/)
    // Une écriture ne se retente pas toute seule, même `retryable` : chaque essai compte chez l'API.
    expect(requetes.filter((r) => r === RELIER)).toHaveLength(1)
    // Le membre peut réessayer sans rien retaper.
    expect(screen.getByLabelText('E-mail du compte Cinoche')).toHaveValue(EMAIL)
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

  // Mutation : afficher la ligne sans regarder son compteur ; écrire le pluriel, ou le singulier, partout.
  it.each([
    { envois: 0, present: null },
    { envois: 1, present: '1 note en attente d’envoi' },
    { envois: 3, present: '3 notes en attente d’envoi' },
  ])('relié, $envois envoi(s) en attente : le compteur ne se dit que non nul, accordé', async ({ envois, present }) => {
    servir({ [ETAT]: () => json({ ...RELIE, envois_en_attente: envois }) })
    monter()

    expect(await screen.findByText(RELIE.email!)).toBeInTheDocument()
    if (present) expect(screen.getByText(present)).toBeInTheDocument()
    else expect(screen.queryByText(/en attente d’envoi/)).not.toBeInTheDocument()
    // Relié : ni session expirée, ni offre de reconnexion.
    expect(screen.queryByText(/a expiré/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Me reconnecter/ })).not.toBeInTheDocument()
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
    expect(screen.queryByText(RELIE.email!)).not.toBeInTheDocument()
    expect(requetes).toEqual([ETAT, DELIER])
  })

  // Mutation : avaler l'erreur du retrait au lieu de l'afficher.
  it('un retrait refusé se dit', async () => {
    const message = 'Cinoche n’est pas configuré sur ce serveur.'
    servir({ [ETAT]: () => json(RELIE), [DELIER]: () => refus('SERVICE_UNCONFIGURED', message, 503) })
    monter()
    fireEvent.click(await screen.findByRole('button', { name: 'Délier mon compte' }))
    fireEvent.click(screen.getByRole('button', { name: 'Délier' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  // Mutation : ne plus lire `session_expiree` (l'écran dirait « Relier mon compte », comme à un inconnu).
  it('session expirée : l’écran le dit, garde l’e-mail, annonce la file et offre de se reconnecter', async () => {
    servir({ [ETAT]: () => json({ ...EXPIREE, envois_en_attente: 2 }) })
    monter()

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Ta session Cinoche a expiré. Tes visionnages attendent en file : ils partiront à la reconnexion. 2 notes en attente d’envoi.',
    )
    expect(screen.getByText('Session expirée')).toBeInTheDocument()
    expect(screen.getByText(EXPIREE.email!)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Me reconnecter/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Relier mon compte/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Compte relié')).not.toBeInTheDocument()
  })

  // Mutation : ne pas préremplir l'e-mail ; ne pas poser la réponse de la reconnexion dans le cache.
  it('session expirée : se reconnecter reprend l’e-mail gardé, envoie, et rend le compte relié', async () => {
    const envoye: unknown[] = []
    const requetes = servir({
      [ETAT]: () => json(EXPIREE),
      [RELIER]: (init) => {
        envoye.push(JSON.parse(String(init.body)))
        return json(RELIE)
      },
    })
    monter()
    fireEvent.click(await screen.findByRole('button', { name: /Me reconnecter/ }))
    // Le message reste sous les yeux pendant la saisie.
    expect(screen.getByRole('status')).toHaveTextContent(/Ta session Cinoche a expiré/)
    expect(screen.getByLabelText('E-mail du compte Cinoche')).toHaveValue(EXPIREE.email)
    fireEvent.change(screen.getByLabelText('Mot de passe Cinoche'), { target: { value: MOT_DE_PASSE } })
    fireEvent.click(screen.getByRole('button', { name: 'Reconnecter' }))

    expect(await screen.findByText('Compte relié')).toBeInTheDocument()
    expect(screen.queryByText(/a expiré/)).not.toBeInTheDocument()
    expect(envoye).toEqual([{ email: EXPIREE.email, mot_de_passe: MOT_DE_PASSE }])
    expect(requetes).toEqual([ETAT, RELIER])
  })

  // Mutation : dire « session expirée » dès que `connecte` est faux, sans lire `session_expiree`.
  it('jamais relié (`session_expiree` faux) : ni message d’expiration, ni offre de reconnexion', async () => {
    servir({ [ETAT]: () => json({ ...DELIE, envois_en_attente: 2 }) })
    monter()

    expect(await screen.findByRole('button', { name: /Relier mon compte/ })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('2 notes en attente d’envoi : elles partiront une fois ton compte relié.')
    expect(screen.queryByText(/a expiré/)).not.toBeInTheDocument()
    expect(screen.queryByText('Session expirée')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Me reconnecter/ })).not.toBeInTheDocument()
  })
})

/** Le message de `CINOCHE_IDENTIFIANTS_REFUSES` (`ERROR_DEFAULTS` du back) : le contrat ne porte pas d'exemple d'erreur. */
const exempleDeRefus =
  'Cinoche a refusé ces identifiants. Vérifie ton e-mail et ton mot de passe ; si ton compte Cinoche a été créé avec Google, pose d’abord un mot de passe dans ton profil Cinoche.'
