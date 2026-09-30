import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { createQueryClient } from '../api/queryClient'
import { FabriqueMoteurContexte } from '../carte/CarteCanvas'
import { json, servir } from '../test/serveur'
import { moteurFactice } from '../test/moteurFactice'
import { fichePrete, voyage1890 } from '../test/voyage'
import { exemple } from '../test/contrat'
import { cles } from '../api/cles'
import stylesDuTampon from '../voyage/passeport/Tampon.module.css'

const SESSION = exemple<{ user: { id: string; pseudo: string } }>('/auth/me', 'get', 200)
const P = { essentiels_vus: 1, essentiels_total: 3, salles_completes: 0, salles_autres: 2 }

/** 1895 Palme, 1896 Lion, 1897 Ours, 1898 en cours jamais ouverte, 1899 verrouillée. */
const VOYAGE = voyage1890(1898, [
  { annee: 1895, statut: 'ouverte', visitee: true, recompense: 'palme', progression: P },
  { annee: 1896, statut: 'ouverte', visitee: true, recompense: 'lion', progression: P },
  { annee: 1897, statut: 'ouverte', visitee: true, recompense: 'ours', progression: P, profondeur: 4 },
  { annee: 1898, statut: 'en_cours', visitee: false, recompense: null, progression: null, profondeur: 0 },
  { annee: 1899, statut: 'verrouillee', visitee: false, recompense: 'ours', progression: null },
])

function monter(voyage = VOYAGE, routes: Record<string, (init: RequestInit) => Response> = {}) {
  const f = moteurFactice()
  const client = createQueryClient()
  const requetes = servir({
    'GET /api/auth/me': () => json(SESSION),
    'GET /api/me/voyage': () => json(voyage),
    'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
    ...routes,
  })
  render(
    <QueryClientProvider client={client}>
      <FabriqueMoteurContexte.Provider value={f.fabrique}>
        <MemoryRouter initialEntries={['/voyage']}>
          <App />
        </MemoryRouter>
      </FabriqueMoteurContexte.Provider>
    </QueryClientProvider>,
  )
  return { ...f, requetes, client }
}

describe('la carte', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('donne au moteur chaque année avec son état, l’avatar sur l’année en cours', async () => {
    const { etats } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    const etat = etats[etats.length - 1]!
    expect(etat.anneeAvatar).toBe(1898)
    expect(etat.cases.map((c) => c.etat)).toEqual(['palme', 'lion', 'ours', 'encours', 'verrou'])
  })

  // Mutations : `tampons: []` dans l'état de la carte (la foire ne serait jamais pleine, le feu
  // d'artifice jamais tiré) ; `profondeur: 0` (la foire ne monterait plus dans l'année en cours).
  it('donne au moteur ce qui remplit la foire : le tampon de la décennie et les films de chaque année', async () => {
    const tampon = { decennie: 1890, boucle_le: '2026-09-28T12:00:00.000Z' }
    const { etats } = monter({ ...VOYAGE, annees: VOYAGE.annees.map((a) => (a.annee === 1898 ? { ...a, profondeur: 2 } : a)), tampons: [tampon] })
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    const etat = etats[etats.length - 1]!
    expect(etat.tampons).toEqual([1890])
    expect(etat.cases.find((c) => c.annee === 1898)!.profondeur).toBe(2)
    expect(etat.cases.find((c) => c.annee === 1897)!.profondeur).toBe(4)
  })

  // Mutation : compter les récompenses de toutes les années (1899 porte un Ours vu en avance).
  it('le HUD compte les récompenses jusqu’à l’année en cours seulement', async () => {
    monter()
    expect(await screen.findByLabelText('1 Palmes, 1 Lions, 1 Ours')).toBeInTheDocument()
  })

  // Mutation : `prochainPas(…)[0] ?? 'Tout est vu'` sans regarder `progression` (nulle tant que
  // l'année n'est pas ouverte) : le HUD et l'aperçu diraient tout vu d'une année jamais ouverte.
  it('ne dit jamais « Tout est vu » d’une année pas encore ouverte', async () => {
    const { rappels, etats } = monter()
    expect(await screen.findByText('Touche l’année pour l’ouvrir')).toBeInTheDocument()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    act(() => rappels().apercu(1898, { x: 10, y: 10 }))
    await screen.findByText('Pas encore ouverte : touche l’année pour l’ouvrir.')
    expect(screen.queryByText('Tout est vu')).not.toBeInTheDocument()
  })

  // Mutations (coque) : le lien d'une année vers `/annee/…` (la route n'existe plus : la coque
  // renvoie ailleurs). « Retour à la carte » recule ici dans l'historique : son repli vers `/voyage`,
  // quand rien n'est derrière, est gardé par `VoyageAnnee.test.tsx`.
  it('chaque année est un lien vers sa fiche, pour qui ne voit pas le canvas, et la fiche ramène à la carte', async () => {
    monter(VOYAGE, { 'GET /api/me/voyage/annees/1897': () => json(fichePrete({ annee: 1897 })) })
    fireEvent.click(await screen.findByRole('link', { name: '1897, Ours' }))
    expect(await screen.findByRole('heading', { name: '1897' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Retour à la carte' }))
    expect(await screen.findByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
  })

  // Mutations (coque) : la route `voyage`, ou `voyage/:annee`, déclarée à côté de `<Coque />`
  // dans `App.tsx` au lieu de dedans (la barre disparaîtrait) ; la fiche en `annee/:annee` sous
  // `<Coque />` (la barre resterait, l'onglet Voyage ne serait plus marqué).
  it('garde la barre d’onglets, l’onglet Voyage marqué, sur la carte et sur la fiche d’une année', async () => {
    const { rappels, etats } = monter(VOYAGE, { 'GET /api/me/voyage/annees/1896': () => json(fichePrete({ annee: 1896 })) })
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    const voyage = () => within(screen.getByRole('navigation', { name: 'Onglets' })).getByRole('link', { name: 'Voyage' })
    expect(voyage()).toHaveAttribute('aria-current', 'page')
    act(() => rappels().toucherAnnee(1896))
    expect(await screen.findByRole('heading', { name: '1896' })).toBeInTheDocument()
    expect(voyage()).toHaveAttribute('aria-current', 'page')
  })

  // Mutation : le lien vers `PREMIERE_DECENNIE` en dur (la carte de 1903 ouvrirait les années 1890).
  it.each([
    { anneeEnCours: 1898, nom: 'Chapitre I · Les origines', decennie: 1890 },
    { anneeEnCours: 1903, nom: 'Chapitre II · Années 1900', decennie: 1900 },
  ])('le chapitre ouvre la décennie de l’année en cours ($anneeEnCours)', async ({ anneeEnCours, nom, decennie }) => {
    const annees = Array.from({ length: anneeEnCours - 1894 }, (_, i) => ({
      annee: 1895 + i,
      statut: 1895 + i === anneeEnCours ? ('en_cours' as const) : ('ouverte' as const),
      visitee: true,
      recompense: null,
      progression: P,
    }))
    monter(voyage1890(anneeEnCours, annees), {
      [`GET /api/me/journal?limit=100&sortie_min=${decennie}&sortie_max=${decennie + 9}`]: () => json({ items: [], next_cursor: null }),
    })
    const chapitre = await screen.findByRole('link', { name: nom })
    expect(chapitre).toHaveAttribute('href', `/voyage/decennies/${decennie}`)
    fireEvent.click(chapitre)
    expect(await screen.findByRole('heading', { level: 1, name: `Années ${decennie}` })).toBeInTheDocument()
  })

  it('toucher une case ouvre la fiche de son année', async () => {
    const { rappels, etats } = monter(VOYAGE, { 'GET /api/me/voyage/annees/1896': () => json(fichePrete({ annee: 1896 })) })
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    act(() => rappels().toucherAnnee(1896))
    expect(await screen.findByRole('heading', { name: '1896' })).toBeInTheDocument()
  })

  // Mutation : lire la fiche à l'aperçu sans regarder `visitee` enfile une ouverture chez le chroniqueur.
  it('l’aperçu d’une année jamais ouverte ne lit pas sa fiche', async () => {
    const { rappels, etats, requetes } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    act(() => rappels().apercu(1898, { x: 10, y: 10 }))
    expect(await screen.findByText('Pas encore ouverte : touche l’année pour l’ouvrir.')).toBeInTheDocument()
    expect(requetes).not.toContain('GET /api/me/voyage/annees/1898')
  })

  it('l’aperçu d’une année écrite montre son podium', async () => {
    const fiche = fichePrete({ annee: 1896 })
    fiche.podium = [{ ...fiche.podium[0]!, title: 'L’Arrivée d’un train' }, null, null]
    const { rappels, etats } = monter(VOYAGE, { 'GET /api/me/voyage/annees/1896': () => json(fiche) })
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    act(() => rappels().apercu(1896, { x: 10, y: 10 }))
    expect(await screen.findByText('L’Arrivée d’un train')).toBeInTheDocument()
  })

  // Mutation : ne pas relayer le réglage au moteur (`calme={false}`).
  it('dit au moteur quand le visiteur demande moins d’animations', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }))
    const { moteur, etats } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    expect(moteur.reglerCalme).toHaveBeenLastCalledWith(true)
  })

  // Mutation : `etatDeCase(a, true)` pour tout le monde ; et, relecture de la tâche 9, dans
  // l'objectif du HUD seul (`etatDeCase(enCours, true)`), qui dirait « Touche l’année pour l’ouvrir ».
  it('pour un membre hors IA, l’année que le Voyage suivi n’a pas ouverte se rattrape', async () => {
    const { rappels, etats } = monter({ ...VOYAGE, ia: false, source: { id: '22222222-2222-4222-8222-222222222222', pseudo: 'Théo', annee_en_cours: 1898 } })
    expect(await screen.findByText('Tu suis le Voyage de Théo')).toBeInTheDocument()
    expect(screen.getByText('Tu le rattrapes bientôt')).toBeInTheDocument()
    expect(screen.queryByText('Touche l’année pour l’ouvrir')).not.toBeInTheDocument()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    act(() => rappels().apercu(1898, { x: 10, y: 10 }))
    expect(await screen.findByText('Tu le rattrapes bientôt.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '1898, tu le rattrapes bientôt' })).toBeInTheDocument()
  })

  /** 1898 ouverte, en cours, sa Palme déjà là : il ne reste que le ticket. */
  const OUVERTE = {
    ...VOYAGE,
    annees: VOYAGE.annees.map((a) => (a.annee === 1898 ? { ...a, visitee: true, recompense: 'palme' as const, progression: P, profondeur: 6 } : a)),
  }

  // Relecture de la tâche 9. Mutations : `v.ia` remplacé par `true` dans l'objectif du HUD, ou
  // dans l'aperçu (un membre hors IA lirait le jury).
  it('pour un membre hors IA, l’objectif d’une année ouverte ne parle jamais du jury', async () => {
    const { rappels, etats } = monter({ ...OUVERTE, ia: false, source: { id: '22222222-2222-4222-8222-222222222222', pseudo: 'Théo', annee_en_cours: 1898 } })
    expect(await screen.findByText('Ticket : au Lion')).toBeInTheDocument()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    act(() => rappels().apercu(1898, { x: 10, y: 10 }))
    await waitFor(() => expect(screen.getAllByText('Ticket : au Lion')).toHaveLength(2))
    expect(screen.queryByText(/jury/)).not.toBeInTheDocument()
  })

  // Relecture de la tâche 9. Mutation : `ticketConnu` à `false` dans l'objectif du HUD (le
  // ticket déjà reçu, il réclamerait encore un ticket).
  it('l’objectif ne réclame plus de ticket quand celui de l’année suivante est reçu', async () => {
    monter(OUVERTE, {
      'GET /api/me/voyage/tickets': () =>
        json({ tickets: [{ annee: 1899, motif: '1898 t’a bien occupé.', emis_le: '2026-09-28T10:00:00.000Z', montre_le: null, utilise_le: null }] }),
    })
    expect(await screen.findByText('Tout est vu')).toBeInTheDocument()
  })

  // Relecture de la tâche 9. Mutations : le relais de changement de `calme` retiré de
  // `CarteCanvas` (`[]` au lieu de `[calme]`) : le réglage changé en route ne gagnerait jamais le
  // moteur, et une marche en cours ne s'achèverait pas.
  it('relaie au moteur le réglage des animations changé en cours de route', async () => {
    const ecouteurs = new Set<() => void>()
    const mq = { matches: false, addEventListener: (_: string, f: () => void) => ecouteurs.add(f), removeEventListener: (_: string, f: () => void) => ecouteurs.delete(f) }
    vi.stubGlobal('matchMedia', () => mq)
    const { moteur, etats } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    expect(moteur.reglerCalme).toHaveBeenLastCalledWith(false)
    act(() => {
      mq.matches = true
      ecouteurs.forEach((f) => f())
    })
    expect(moteur.reglerCalme).toHaveBeenLastCalledWith(true)
  })

  // Mutations : le bouton d'ensemble sans `aria-label` (une icône sans nom) ; `aria-label` qui ne
  // suit pas la vue ; `aria-pressed` retiré ; le relais `ensemble` de `CarteCanvas` retiré (le
  // bouton ne saurait jamais que la vue a changé).
  it('« Vue d’ensemble » est une icône nommée, qui commande le moteur et suit la vue qu’il annonce', async () => {
    const { moteur, rappels, etats } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    const ensemble = screen.getByRole('button', { name: 'Vue d’ensemble' })
    expect(ensemble).toHaveAttribute('aria-label', 'Vue d’ensemble')
    expect(ensemble).toHaveAttribute('title', 'Vue d’ensemble')
    expect(ensemble).toHaveTextContent('')
    fireEvent.click(ensemble)
    expect(moteur.basculerEnsemble).toHaveBeenLastCalledWith(true)
    act(() => rappels().ensemble(true))
    const revenir = screen.getByRole('button', { name: 'Revenir à la carte' })
    expect(revenir).toHaveAttribute('aria-label', 'Revenir à la carte')
    expect(revenir).toHaveAttribute('aria-pressed', 'true')
    expect(revenir).toHaveTextContent('')
    fireEvent.click(revenir)
    expect(moteur.basculerEnsemble).toHaveBeenLastCalledWith(false)
  })

  // Mutations : « Tu es ici » toujours affiché ; jamais affiché ; le relais `avatarVisible` de
  // `CarteCanvas` retiré ; le bouton qui n'appelle rien ; la garde `!ensemble` retirée (l'avatar est
  // « hors de l'écran » de la carte détaillée, que la vue d'ensemble a recouverte).
  it('« Tu es ici » est une icône nommée, offerte seulement quand l’avatar est hors de l’écran', async () => {
    const { moteur, rappels, etats } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    expect(screen.queryByRole('button', { name: 'Tu es ici' })).not.toBeInTheDocument()
    act(() => rappels().avatarVisible(false))
    const ici = screen.getByRole('button', { name: 'Tu es ici' })
    expect(ici).toHaveAttribute('aria-label', 'Tu es ici')
    expect(ici).toHaveAttribute('title', 'Tu es ici')
    expect(ici).toHaveTextContent('')
    fireEvent.click(ici)
    expect(moteur.allerIci).toHaveBeenLastCalledWith()
    act(() => rappels().ensemble(true))
    expect(screen.queryByRole('button', { name: 'Tu es ici' })).not.toBeInTheDocument()
    act(() => rappels().ensemble(false))
    expect(screen.getByRole('button', { name: 'Tu es ici' })).toBeInTheDocument()
    act(() => rappels().avatarVisible(true))
    expect(screen.queryByRole('button', { name: 'Tu es ici' })).not.toBeInTheDocument()
  })
})

describe('le ticket', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  const TICKET = { annee: 1899, motif: '1898 t’a bien occupé.', emis_le: '2026-09-28T10:00:00.000Z', montre_le: null, utilise_le: null }

  // Mutation : montrer le bouton pour un ticket déjà utilisé.
  it('ne se montre que pour un ticket non utilisé vers l’année suivante', async () => {
    const { client } = monter(VOYAGE, { 'GET /api/me/voyage/tickets': () => json({ tickets: [{ ...TICKET, utilise_le: '2026-09-28T11:00:00.000Z' }] }) })
    await screen.findByText('1898')
    // Une absence ne s'attend pas : on attend que les tickets soient lus, puis le rendu qui suit
    // (TanStack notifie par `setTimeout`), sans quoi le test passerait avant leur arrivée.
    await waitFor(() => expect(client.getQueryState(cles.tickets)?.status).toBe('success'))
    await act(() => new Promise((fin) => setTimeout(fin, 0)))
    expect(screen.queryByRole('button', { name: /Utiliser le ticket/ })).not.toBeInTheDocument()
  })

  // Mutations : ne pas relire la carte après l'encaissement ; laisser le bouton actif pendant
  // l'envoi (deux encaissements) ; oublier l'haptique au claquement.
  it('l’utiliser encaisse le ticket, relit la carte, et l’avatar marche jusqu’à la nouvelle année', async () => {
    let encaisse = false
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    const apres = voyage1890(1899, VOYAGE.annees.map((a) => (a.annee === 1898 ? { ...a, statut: 'ouverte' as const } : a.annee === 1899 ? { ...a, statut: 'en_cours' as const } : a)))
    const { moteur, requetes } = monter(VOYAGE, {
      'GET /api/me/voyage': () => json(encaisse ? apres : VOYAGE),
      'GET /api/me/voyage/tickets': () => json({ tickets: encaisse ? [{ ...TICKET, utilise_le: '2026-09-28T11:00:00.000Z' }] : [TICKET] }),
      'POST /api/me/voyage/tickets/1899/utiliser': () => {
        encaisse = true
        return json({ annee_en_cours: 1899 })
      },
    })
    const bouton = await screen.findByRole('button', { name: /Utiliser le ticket/ })
    expect(bouton).toHaveTextContent('1898 → 1899')
    fireEvent.click(bouton)
    fireEvent.click(bouton)
    await waitFor(() => expect(moteur.marcher).toHaveBeenCalledWith(1899))
    expect(requetes.filter((r) => r === 'POST /api/me/voyage/tickets/1899/utiliser')).toHaveLength(1)
    expect(moteur.passerLaPorte).not.toHaveBeenCalled()
    await waitFor(() => expect(moteur.claquer).toHaveBeenCalled())
    expect(vibrate).toHaveBeenCalled()
    delete (navigator as { vibrate?: unknown }).vibrate
  })

  it('un refus de l’API s’affiche tel qu’elle l’a écrit', async () => {
    monter(VOYAGE, {
      'GET /api/me/voyage/tickets': () => json({ tickets: [TICKET] }),
      'POST /api/me/voyage/tickets/1899/utiliser': () =>
        json({ code: 'NOT_FOUND', message: 'Ce ticket n’existe pas, ou a déjà été utilisé.', retryable: false }, 404),
    })
    fireEvent.click(await screen.findByRole('button', { name: /Utiliser le ticket/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce ticket n’existe pas, ou a déjà été utilisé.')
  })

  // Relecture de la tâche 9. Mutation : la garde du double encaissement jamais relâchée
  // (`onSettled` retiré) : après une panne, le ticket ne répondrait plus jusqu'au rechargement.
  it('après une panne, le ticket se réessaie', async () => {
    let essais = 0
    const { requetes } = monter(VOYAGE, {
      'GET /api/me/voyage/tickets': () => json({ tickets: [TICKET] }),
      'POST /api/me/voyage/tickets/1899/utiliser': () => {
        essais += 1
        return json({ code: 'INTERNAL', message: 'Une erreur est survenue. Réessaie.', retryable: true }, 500)
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: /Utiliser le ticket/ }))
    await screen.findByRole('alert')
    await waitFor(() => expect(screen.getByRole('button', { name: /Utiliser le ticket/ })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /Utiliser le ticket/ }))
    await waitFor(() => expect(essais).toBe(2))
    expect(requetes.filter((r) => r === 'POST /api/me/voyage/tickets/1899/utiliser')).toHaveLength(2)
  })

  // Mutation : relire `anneeAvatar` sans la mémoire de l'appareil (le ticket utilisé sur la fiche ne se voit jamais marcher).
  it('rejoue la marche quand le ticket a été utilisé ailleurs, jamais à la première ouverture', async () => {
    localStorage.setItem(`journal.carte.annee-vue.${SESSION.user.id}`, '1897')
    const { moteur } = monter()
    await waitFor(() => expect(moteur.marcher).toHaveBeenCalledWith(1898))
  })

  it('ne rejoue rien sur un appareil qui n’a jamais vu la carte', async () => {
    const { moteur, etats } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    expect(moteur.marcher).not.toHaveBeenCalled()
  })

  // Idée 8. Mutations : `setAnneeAvatar(apres)` dès la frontière détectée, au lieu
  // de `av.anneeQuittee` (la foire se bâtirait avant la marche) ; `setAnneeAvatar(avancee.vers)`
  // avant `jouerAvancee`.
  it('n’avance l’avatar au moteur, et n’y ouvre l’année, qu’une fois la marche finie', async () => {
    localStorage.setItem(`journal.carte.annee-vue.${SESSION.user.id}`, '1897')
    const { moteur, etats } = monter()
    let arriver: () => void = () => undefined
    vi.mocked(moteur.marcher).mockImplementationOnce(() => new Promise<void>((fin) => (arriver = fin)))
    await waitFor(() => expect(moteur.marcher).toHaveBeenCalledWith(1898))
    expect(etats.length).toBeGreaterThan(0)
    expect(etats.map((e) => e.anneeAvatar)).not.toContain(1898)
    await act(async () => arriver())
    await waitFor(() => expect(etats[etats.length - 1]!.anneeAvatar).toBe(1898))
  })

  // Idée 8. Mutation : `ecrireAnneeVue(user.id, avancee.vers)` retiré du `.then` :
  // aucun autre test ne tombe, et chaque retour sur la carte rejouerait la marche et la construction.
  it('ne rejoue ni la marche ni la construction au retour sur la carte', async () => {
    localStorage.setItem(`journal.carte.annee-vue.${SESSION.user.id}`, '1897')
    const premier = monter()
    await waitFor(() => expect(premier.etats[premier.etats.length - 1]?.anneeAvatar).toBe(1898))
    cleanup()
    const second = monter()
    await waitFor(() => expect(second.etats.length).toBeGreaterThan(0))
    expect(second.etats[0]!.anneeAvatar).toBe(1898)
    expect(second.moteur.marcher).not.toHaveBeenCalled()
  })

  /** Le départ du Voyage : 1895 en cours, le reste verrouillé. */
  const DEPART = voyage1890(1895, [1895, 1896, 1897, 1898, 1899].map((annee) => ({ annee, statut: annee === 1895 ? ('en_cours' as const) : ('verrouillee' as const) })))

  // Idée 8, relecture du 29 au soir. Mutations : l'appel à `ouvrirSousLesYeux`
  // retiré ; la condition `depuis === null` retirée (chaque visite en 1895 rebâtirait la séance).
  it('bâtit la séance de 1895 à la toute première visite d’un membre, jamais aux suivantes', async () => {
    const premier = monter(DEPART)
    await waitFor(() => expect(premier.moteur.ouvrirSousLesYeux).toHaveBeenCalledWith(1895))
    cleanup()
    const second = monter(DEPART)
    await waitFor(() => expect(second.etats.length).toBeGreaterThan(0))
    expect(second.moteur.ouvrirSousLesYeux).not.toHaveBeenCalled()
  })

  // Idée 8, relecture du 29 au soir. Mutation : la condition `apres === v.depart`
  // retirée (qui arrive en 1898 verrait bâtir son année à la première visite).
  it('pose bâtie, sans chantier, la foire d’un membre qui arrive plus loin', async () => {
    const { moteur, etats } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    expect(moteur.ouvrirSousLesYeux).not.toHaveBeenCalled()
  })

  // Idée 8. Mutation : l'année de l'avatar prise du Voyage suivi
  // (`v.source?.annee_en_cours ?? v.annee_en_cours`) : la foire du second joueur suivrait celle de Théo.
  it('pose la foire d’un membre qui suit un autre Voyage sur ses propres années', async () => {
    const source = { id: '5f0c6c1e-8d0e-4c1a-9a57-3f7c2b1d9e40', pseudo: 'theo', annee_en_cours: 1896 }
    const { etats } = monter({ ...VOYAGE, ia: false, source })
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    expect(etats.map((e) => e.anneeAvatar)).toEqual(etats.map(() => 1898))
    expect(etats[etats.length - 1]!.roulotte).toEqual({ pseudo: 'theo', annee: 1896 })
  })

  // Mutation : garer la roulotte sur l'année du membre (`v.annee_en_cours`) au lieu de celle du Voyage suivi.
  it('gare la roulotte du Voyage suivi sur l’année où il est rendu, et dit où il en est', async () => {
    const source = { id: '5f0c6c1e-8d0e-4c1a-9a57-3f7c2b1d9e40', pseudo: 'theo', annee_en_cours: 1897 }
    const { etats, rappels } = monter({ ...VOYAGE, ia: false, source })
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    expect(etats[etats.length - 1]!.roulotte).toEqual({ pseudo: 'theo', annee: 1897 })
    act(() => rappels().roulotte())
    expect(await screen.findByText('La roulotte de theo : il est rendu en 1897, ses salles t’attendent là-bas.')).toBeInTheDocument()
  })

  // Mutation : pas de roulotte (`null`) quand `source` est nulle : la foire de qui mène perdrait la sienne.
  it('laisse traverser la roulotte de qui mène son propre Voyage', async () => {
    const { etats } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    expect(etats[etats.length - 1]!.roulotte).toEqual({ pseudo: SESSION.user.pseudo, annee: null })
  })

  // Mutation : `date: () => undefined` : l'affichette touchée n'ouvrirait rien.
  it('une affichette touchée ouvre sa petite affiche, et « Refermer » la referme', async () => {
    const { etats, rappels } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    const d = { an: 1895, x: 38, y: 112, court: '22 mars', lieu: 'Paris · rue de Rennes', titre: 'La première projection', jour: 'Vendredi 22 mars 1895', texte: 'Louis Lumière projette La Sortie de l’usine Lumière à Lyon.', image: null }
    act(() => rappels().date(d))
    expect(await screen.findByRole('dialog', { name: 'La première projection' })).toHaveTextContent('Vendredi 22 mars 1895')
    fireEvent.click(screen.getByRole('button', { name: 'Refermer' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // Mutation : `passerLaPorte` sans l'adieu, ou l'adieu dit avant la porte.
  it('au changement de décennie, le monde quitté dit adieu une fois la porte passée', async () => {
    localStorage.setItem(`journal.carte.annee-vue.${SESSION.user.id}`, '1899')
    const v1900 = voyage1890(1900, [
      ...[1895, 1896, 1897, 1898, 1899].map((annee) => ({ annee, statut: 'ouverte' as const, visitee: true, recompense: 'ours' as const, progression: P })),
      { annee: 1900, statut: 'en_cours' as const, visitee: false, recompense: null, progression: null },
    ])
    const { moteur } = monter(v1900)
    await waitFor(() => expect(moteur.direAdieu).toHaveBeenCalledWith(1890))
    expect(vi.mocked(moteur.passerLaPorte).mock.invocationCallOrder[0]!).toBeLessThan(vi.mocked(moteur.direAdieu).mock.invocationCallOrder[0]!)
    // Relecture de la tâche 9. Mutation : `montrerCarton` sans son calque (le carton du monde
    // neuf ne se montrerait jamais).
    expect(await screen.findByText('Années 1900')).toBeInTheDocument()
  })

  /** Le passage à 1900 : les années 1890 toutes bouclées d'un Ours, 1900 en cours. */
  const V1900 = voyage1890(1900, [
    ...[1895, 1896, 1897, 1898, 1899].map((annee) => ({ annee, statut: 'ouverte' as const, visitee: true, recompense: 'ours' as const, progression: P })),
    { annee: 1900, statut: 'en_cours' as const, visitee: false, recompense: null, progression: null },
  ])

  // Relecture de la tâche 9. Mutations : `void moteur.passerLaPorte()` (l'adieu dit pendant que la
  // porte s'ouvre encore) ; `void moteur.direAdieu(…)` (l'avatar repart pendant l'adieu).
  it('attend la porte passée pour dire adieu, et l’adieu dit pour repartir', async () => {
    localStorage.setItem(`journal.carte.annee-vue.${SESSION.user.id}`, '1899')
    const { moteur } = monter(V1900)
    let passee: () => void = () => undefined
    let dit: () => void = () => undefined
    vi.mocked(moteur.passerLaPorte).mockImplementationOnce(() => new Promise<void>((fin) => (passee = fin)))
    vi.mocked(moteur.direAdieu).mockImplementationOnce(() => new Promise<void>((fin) => (dit = fin)))
    await waitFor(() => expect(moteur.passerLaPorte).toHaveBeenCalled())
    expect(moteur.direAdieu).not.toHaveBeenCalled()
    await act(async () => passee())
    await waitFor(() => expect(moteur.direAdieu).toHaveBeenCalledWith(1890))
    expect(moteur.marcher).not.toHaveBeenCalled()
    await act(async () => dit())
    await waitFor(() => expect(moteur.marcher).toHaveBeenCalledWith(1900))
  })

  // Relecture de la tâche 9. Mutation : `jouerAvancee(…, [], …)` (les tampons du passeport
  // retenus : la décennie bouclée ne se tamponnerait jamais).
  it('tamponne le passeport quand la décennie quittée est bouclée', async () => {
    localStorage.setItem(`journal.carte.annee-vue.${SESSION.user.id}`, '1899')
    const { moteur } = monter({ ...V1900, tampons: [{ decennie: 1890, boucle_le: '2026-09-28T12:00:00.000Z' }] })
    await waitFor(() => expect(moteur.direAdieu).toHaveBeenCalledWith(1890))
    const tampon = await screen.findByText('Années 1890')
    expect(tampon.closest('[role="status"]')).toHaveTextContent('Spectateur des origines')
    expect(moteur.marcher).not.toHaveBeenCalled()
  })

  // Relecture de la tâche 5 (plan 2c) : le calque monte le tampon du passeport, le sien. Mutations :
  // un tampon fabriqué à la place de `tamponDe` (le jour de l'appareil, pas celui du passeport) ; le
  // tampon monté sans `frappe` (la carte montre le moment où il se pose).
  it('le tampon de la carte dit le jour du passeport et frappe', async () => {
    localStorage.setItem(`journal.carte.annee-vue.${SESSION.user.id}`, '1899')
    monter({ ...V1900, tampons: [{ decennie: 1890, boucle_le: '2026-09-28T12:00:00.000Z' }] })
    const jour = await screen.findByText('28 septembre 2026')
    expect(jour.closest('[role="status"]')).toHaveTextContent('Années 1890')
    expect(jour.parentElement).toHaveClass(stylesDuTampon.frappe!)
  })

  // Mutation : la petite affiche sans son image ou sans sa légende de crédit.
  it('la petite affiche montre l’image d’époque et sa légende de crédit', async () => {
    const { etats, rappels } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    const image = { url: '/journal/assets/cinematographe.webp', legende: 'Affiche de Marcellin Auzolle, 1896. Source : Wikimedia Commons, domaine public.' }
    act(() => rappels().date({ an: 1895, x: 38, y: 222, court: '28 déc.', lieu: 'Paris', titre: 'Le Grand Café', jour: 'Samedi 28 décembre 1895', texte: 'Un texte.', image }))
    const dialogue = await screen.findByRole('dialog', { name: 'Le Grand Café' })
    expect(dialogue.querySelector('img')?.getAttribute('src')).toBe(image.url)
    expect(dialogue).toHaveTextContent(image.legende)
  })
})
