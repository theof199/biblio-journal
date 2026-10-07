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
import FEUILLE_DE_LA_CARTE from '../carte/Carte.module.css?raw'
import stylesDeLaCarte from '../carte/Carte.module.css'
import stylesDeLaToile from '../carte/CarteCanvas.module.css'
import { DoublureAudio, oublierDoublures } from '../test/audioFactice'
import { Ambiance, oublierAmbianceDeLaPage } from '../carte/son'

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

function monter(voyage = VOYAGE, routes: Record<string, (init: RequestInit) => Response> = {}, f = moteurFactice()) {
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

  // Mutations : la pastille retirée, ou menant à `/voyage/:annee` ; la sacoche qui lirait la fiche de
  // l'année en cours (`lireAnnee`), même venue de la carte, où les fiches ne sont qu'en cache.
  it('la pastille « Sacoche du voyageur » ouvre la sacoche, qui ne lit aucune fiche d’année', async () => {
    const { requetes } = monter()
    fireEvent.click(await screen.findByRole('link', { name: 'Sacoche du voyageur' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'La sacoche du voyageur' })).toBeInTheDocument()
    await within(await screen.findByRole('region', { name: 'Passeport' })).findAllByRole('link')
    await within(await screen.findByRole('region', { name: 'Portefeuille' })).findByText('Aucun ticket')
    await new Promise((r) => setTimeout(r, 50))
    expect(requetes.filter((r) => r.includes('/annees'))).toEqual([])
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
    { anneeEnCours: 1903, nom: 'Chapitre II · Le voyage immobile', decennie: 1900 },
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

  // Décision du propriétaire du 1er octobre 2026 (2c-5) : l'année que le Voyage suivi n'a pas ouverte
  // dit « Théo est trop lent » (le HUD, l'aperçu avec son point, le lien du lecteur d'écran), jamais
  // plus « Tu le rattrapes bientôt ». Mutations : `etatDeCase(a, true)` pour tout le monde ; et,
  // relecture de la tâche 9, dans l'objectif du HUD seul (`etatDeCase(enCours, true)`), qui dirait
  // « Touche l’année pour l’ouvrir » ; l'ancien texte remis à l'un des trois sites ; le pseudo pris
  // ailleurs que dans `source` (le mien).
  it('pour un membre hors IA, l’année que le Voyage suivi n’a pas ouverte dit qu’il est trop lent', async () => {
    const { rappels, etats } = monter({ ...VOYAGE, ia: false, source: { id: '22222222-2222-4222-8222-222222222222', pseudo: 'Théo', annee_en_cours: 1898 } })
    expect(await screen.findByText('Tu suis le Voyage de Théo')).toBeInTheDocument()
    expect(screen.getByText('Théo est trop lent')).toBeInTheDocument()
    expect(screen.queryByText('Touche l’année pour l’ouvrir')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '1898, Théo est trop lent' })).toBeInTheDocument()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    act(() => rappels().apercu(1898, { x: 10, y: 10 }))
    expect(await screen.findByText('Théo est trop lent.')).toBeInTheDocument()
    expect(screen.queryByText(/rattrapes/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /rattrapes/i })).not.toBeInTheDocument()
  })

  // Ni le compte IA (aucune année n'y attend personne), ni un compte qui ne suit personne (`source`
  // nul) ne disent de quiconque qu'il est trop lent. Mutation : la phrase sans pseudo (« null est
  // trop lent », ou un repli sur « Tu le rattrapes bientôt »).
  it.each([
    ['le compte IA', { ia: true, source: null }],
    ['un compte qui ne suit personne', { ia: false, source: null }],
  ])('%s ne dit de personne qu’il est trop lent', async (_qui, surcharge) => {
    const { rappels, etats } = monter({ ...VOYAGE, ...surcharge })
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    act(() => rappels().apercu(1898, { x: 10, y: 10 }))
    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(screen.queryByText(/trop lent|rattrapes/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /trop lent|rattrapes/i })).not.toBeInTheDocument()
  })

  /** 1898 ouverte, en cours, sa Palme déjà là : il ne reste que le ticket. */
  const OUVERTE = {
    ...VOYAGE,
    annees: VOYAGE.annees.map((a) => (a.annee === 1898 ? { ...a, visitee: true, recompense: 'palme' as const, progression: P, profondeur: 6 } : a)),
  }

  // Décision du propriétaire du 1er octobre 2026 (2c-5, option a) : la lectrice dont l'année en cours
  // (1898, ouverte) est derrière le voyageur suivi (1899) le lit sur cette année seule, ajouté à son
  // état : le HUD, l'aperçu (sous « En cours »), le lien du lecteur d'écran (« 1898, en cours, … »).
  // Jamais sur une autre année. Mutations : la condition `>` changée en `>=` (la source à la même
  // année) ; l'année ignorée au lien ou à l'aperçu (la phrase sur 1897) ; l'état remplacé au lien.
  const SUIT = (annee: number) => ({ id: '22222222-2222-4222-8222-222222222222', pseudo: 'Théo', annee_en_cours: annee })
  it('derrière le voyageur suivi, l’année en cours dit « Tu le rattrapes bientôt », elle seule', async () => {
    const { rappels, etats } = monter({ ...OUVERTE, ia: false, source: SUIT(1899) })
    expect(await screen.findByText('Tu suis le Voyage de Théo · tu le rattrapes bientôt')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '1898, en cours, tu le rattrapes bientôt' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /rattrapes/ })).toHaveLength(1)
    expect(screen.queryByText(/trop lent/)).not.toBeInTheDocument()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    act(() => rappels().apercu(1898, { x: 10, y: 10 }))
    const apercu = await screen.findByText('Tu le rattrapes bientôt.')
    expect(apercu.closest('[role="status"]')).toHaveTextContent('En cours')
    act(() => rappels().finApercu())
    act(() => rappels().apercu(1897, { x: 10, y: 10 }))
    await waitFor(() => expect(screen.queryByText('Tu le rattrapes bientôt.')).not.toBeInTheDocument())
  })

  // La source à la même année, le compte IA, un compte sans source : rien ne se rattrape. Et une année
  // en cours que la source, pourtant devant, n'a pas encore ouverte dit « … est trop lent », jamais
  // les deux. Mutations : la garde `ia`, `source` ou `attente` retirée de `rattrapeBientot`.
  it.each([
    ['la source à la même année', { ...OUVERTE, ia: false, source: SUIT(1898) }, false],
    ['le compte IA', { ...OUVERTE, ia: true, source: SUIT(1899) }, false],
    ['un compte sans source', { ...OUVERTE, ia: false, source: null }, false],
    ['une année en attente, la source devant', { ...VOYAGE, ia: false, source: SUIT(1899) }, true],
  ] as const)('%s : jamais « Tu le rattrapes bientôt »', async (_cas, voyage, lent) => {
    const { rappels, etats } = monter(voyage)
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    act(() => rappels().apercu(1898, { x: 10, y: 10 }))
    expect(await screen.findByRole('link', { name: /^1898, / })).toBeInTheDocument()
    expect(screen.queryByText(/rattrapes/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /rattrapes/i })).not.toBeInTheDocument()
    if (lent) expect(screen.getByRole('link', { name: '1898, Théo est trop lent' })).toBeInTheDocument()
  })

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

  /** Le passage à 1900 : les années 1890 toutes bouclées d'un Ours, 1900 en cours. Le monde de 1900 a un passage d'entrée. */
  const V1900 = voyage1890(1900, [
    ...[1895, 1896, 1897, 1898, 1899].map((annee) => ({ annee, statut: 'ouverte' as const, visitee: true, recompense: 'ours' as const, progression: P })),
    { annee: 1900, statut: 'en_cours' as const, visitee: false, recompense: null, progression: null },
  ])
  /**
   * Le passage à 1910 : de 1895 à 1909 bouclées d'un Ours, 1910 en cours. Les années 1910 n'ont pas
   * de ligne au registre : le monde « à venir », sans scène ni passage, garde la marche et le carton
   * (ce que 1900 gardait avant d'avoir son monde, plan 3b).
   */
  const V1910 = voyage1890(1910, [
    ...Array.from({ length: 15 }, (_, i) => ({ annee: 1895 + i, statut: 'ouverte' as const, visitee: true, recompense: 'ours' as const, progression: P })),
    { annee: 1910, statut: 'en_cours' as const, visitee: false, recompense: null, progression: null },
  ])

  // Mutation : `passerLaPorte` sans l'adieu, ou l'adieu dit avant la porte.
  // Mutation (plan 3b) : `aUnPassage` qui rend toujours vrai (le monde sans passage se verrait dire
  // bonjour et perdrait son carton).
  it('au changement de décennie, le monde quitté dit adieu une fois la porte passée', async () => {
    localStorage.setItem(`journal.carte.annee-vue.${SESSION.user.id}`, '1909')
    const { moteur } = monter(V1910)
    await waitFor(() => expect(moteur.direAdieu).toHaveBeenCalledWith(1900))
    expect(vi.mocked(moteur.passerLaPorte).mock.invocationCallOrder[0]!).toBeLessThan(vi.mocked(moteur.direAdieu).mock.invocationCallOrder[0]!)
    // Relecture de la tâche 9. Mutation : `montrerCarton` sans son calque (le carton du monde
    // neuf ne se montrerait jamais).
    expect(await screen.findByText('Années 1910')).toBeInTheDocument()
    expect(moteur.direBonjour).not.toHaveBeenCalled()
  })

  // Relecture de la tâche 9. Mutations : `void moteur.passerLaPorte()` (l'adieu dit pendant que la
  // porte s'ouvre encore) ; `void moteur.direAdieu(…)` (l'avatar repart pendant l'adieu).
  it('attend la porte passée pour dire adieu, et l’adieu dit pour repartir', async () => {
    localStorage.setItem(`journal.carte.annee-vue.${SESSION.user.id}`, '1909')
    const { moteur } = monter(V1910)
    let passee: () => void = () => undefined
    let dit: () => void = () => undefined
    vi.mocked(moteur.passerLaPorte).mockImplementationOnce(() => new Promise<void>((fin) => (passee = fin)))
    vi.mocked(moteur.direAdieu).mockImplementationOnce(() => new Promise<void>((fin) => (dit = fin)))
    await waitFor(() => expect(moteur.passerLaPorte).toHaveBeenCalled())
    expect(moteur.direAdieu).not.toHaveBeenCalled()
    await act(async () => passee())
    await waitFor(() => expect(moteur.direAdieu).toHaveBeenCalledWith(1900))
    expect(moteur.marcher).not.toHaveBeenCalled()
    await act(async () => dit())
    await waitFor(() => expect(moteur.marcher).toHaveBeenCalledWith(1910))
    expect(moteur.direBonjour).not.toHaveBeenCalled()
  })

  // Plan 3b, tâche 13 : le jumeau, vers un monde à passage. L'ordre porte, adieu, bonjour, clap.
  // Mutations : `void moteur.direAdieu(…)` (le bonjour dit pendant l'adieu) ; l'`await` retiré devant
  // `moteur.direBonjour` dans la page, ou devant `scene.direBonjour` dans la suite (le clap pendant le
  // passage) ; `aUnPassage` qui rend toujours faux (la marche à la place du bonjour).
  it('vers un monde à passage : attend la porte pour dire adieu, l’adieu pour dire bonjour, et la fin du bonjour pour claquer', async () => {
    localStorage.setItem(`journal.carte.annee-vue.${SESSION.user.id}`, '1899')
    const { moteur } = monter(V1900)
    let passee: () => void = () => undefined
    let dit: () => void = () => undefined
    let arrive: () => void = () => undefined
    vi.mocked(moteur.passerLaPorte).mockImplementationOnce(() => new Promise<void>((fin) => (passee = fin)))
    vi.mocked(moteur.direAdieu).mockImplementationOnce(() => new Promise<void>((fin) => (dit = fin)))
    vi.mocked(moteur.direBonjour).mockImplementationOnce(() => new Promise<void>((fin) => (arrive = fin)))
    await waitFor(() => expect(moteur.passerLaPorte).toHaveBeenCalled())
    expect(moteur.direAdieu).not.toHaveBeenCalled()
    await act(async () => passee())
    await waitFor(() => expect(moteur.direAdieu).toHaveBeenCalledWith(1890))
    await new Promise((r) => setTimeout(r, 30))
    expect(moteur.direBonjour).not.toHaveBeenCalled()
    await act(async () => dit())
    await waitFor(() => expect(moteur.direBonjour).toHaveBeenCalledWith(1900, 'endroit'))
    await new Promise((r) => setTimeout(r, 30))
    expect(moteur.claquer).not.toHaveBeenCalled()
    await act(async () => arrive())
    await waitFor(() => expect(moteur.claquer).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(localStorage.getItem(`journal.carte.annee-vue.${SESSION.user.id}`)).toBe('1900'))
    // 1900 est la première année de son monde : le train y est, rien ne roule.
    expect(moteur.marcher).not.toHaveBeenCalled()
    expect(moteur.direBonjour).toHaveBeenCalledTimes(1)
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
    // Le tampon se lit avant le passage (plan 3b). Mutation : l'`await` retiré devant `montrerTampon`.
    expect(moteur.direBonjour).not.toHaveBeenCalled()
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

  /**
   * jsdom ne connaît pas `inert` : il livre le clic et le focus à un élément inerte, un navigateur non
   * (constaté dans Chromium, sur un calque `display: contents` comme `.fond`). Le geste est donc tenté
   * comme un navigateur le livrerait : rien n'atteint ce qu'un `inert` couvre.
   */
  const toucher = (e: Element) => {
    if (!e.closest('[inert]')) fireEvent.click(e)
  }
  const poserLeDoigt = (e: Element) => {
    if (!e.closest('[inert]')) fireEvent.pointerDown(e)
  }
  const prendLeFocus = (e: HTMLElement) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    if (!e.closest('[inert]')) e.focus()
    return document.activeElement === e
  }
  /** Ce qui se touche derrière le tampon : la plaque du chapitre, les pastilles, une année de la liste. */
  const derriere = () => [
    screen.getByRole('link', { name: /Chapitre/i }),
    screen.getByRole('button', { name: 'Son' }),
    screen.getByRole('link', { name: 'Sacoche du voyageur' }),
    screen.getByRole('button', { name: 'Vue d’ensemble' }),
    screen.getByRole('link', { name: /^1899, / }),
  ]

  /** La toile et ce qui l'entoure : le doigt qu'on y pose, le défilement qu'on y mène. */
  const laToile = () => document.querySelector('canvas')!
  /**
   * Tous les gestes d'un coup, au doigt puis au clavier, sur tout ce qui est derrière : rien ne doit
   * en sortir. Rejouable à chaque temps de l'avancée, puisqu'aucun n'a d'effet.
   */
  const rienNeRepond = (moteur: ReturnType<typeof monter>['moteur'], temps: string) => {
    vi.mocked(moteur.pointeur).mockClear()
    poserLeDoigt(laToile())
    for (const e of derriere()) toucher(e)
    expect(moteur.pointeur, temps).not.toHaveBeenCalled()
    expect(moteur.basculerEnsemble, temps).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Son' }), temps).toHaveAttribute('aria-pressed', 'false')
    // Aucun lien suivi : la carte est toujours là.
    expect(screen.getByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` }), temps).toBeInTheDocument()
    for (const e of derriere()) expect(prendLeFocus(e), `${temps} : ${e.getAttribute('aria-label') ?? e.textContent ?? ''}`).toBe(false)
  }
  const toutRepond = (moteur: ReturnType<typeof monter>['moteur']) => {
    for (const e of derriere()) expect(prendLeFocus(e), e.getAttribute('aria-label') ?? e.textContent ?? '').toBe(true)
    vi.mocked(moteur.pointeur).mockClear()
    poserLeDoigt(laToile())
    expect(moteur.pointeur).toHaveBeenCalled()
    toucher(screen.getByRole('button', { name: 'Vue d’ensemble' }))
    expect(moteur.basculerEnsemble).toHaveBeenCalledWith(true)
  }
  /** Un temps du moteur que le test tient ouvert : chaque appel attend qu'on le lâche (ou qu'on le fasse échouer). */
  function tenir(temps: (...a: never[]) => Promise<void>) {
    const appels: { lacher: () => void; echouer: (e: Error) => void }[] = []
    vi.mocked(temps).mockImplementation(() => new Promise<void>((lacher, echouer) => void appels.push({ lacher, echouer })))
    return appels
  }
  const AVEC_TAMPON = { ...V1900, tampons: [{ decennie: 1890, boucle_le: '2026-09-28T12:00:00.000Z' }] }
  /** Vers 1910, la décennie 1900 bouclée : la suite sans passage, avec son tampon. */
  const AVEC_TAMPON_1910 = { ...V1910, tampons: [{ decennie: 1900, boucle_le: '2026-09-28T12:00:00.000Z' }] }
  const CLE_ANNEE_VUE = `journal.carte.annee-vue.${SESSION.user.id}`

  // Mutations : `INERTE` posé au seul tampon (`calque?.type === 'tampon'` : la porte, l'adieu, la marche
  // et le carton laissent tout vivant) ; `INERTE` retiré de `.fond` ; `INERTE` posé sans condition, ou
  // `setAvancee(null)` retiré de `finir` (la carte ne rend jamais la main).
  it('pendant toute l’avancée d’une décennie à l’autre, rien derrière ne répond, ni au doigt ni au clavier ; puis la carte rend la main', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1909')
    const f = moteurFactice()
    const porte = tenir(f.moteur.passerLaPorte)
    const adieu = tenir(f.moteur.direAdieu)
    const marche = tenir(f.moteur.marcher)
    const { moteur } = monter(AVEC_TAMPON_1910, {}, f)

    await waitFor(() => expect(porte).toHaveLength(1))
    rienNeRepond(moteur, 'la porte')
    await act(async () => porte[0]!.lacher())
    await waitFor(() => expect(adieu).toHaveLength(1))
    rienNeRepond(moteur, 'l’adieu')
    await act(async () => adieu[0]!.lacher())
    const tampon = (await screen.findByText('Années 1900')).closest<HTMLElement>('[role="status"]')!
    // Le tampon, lui, se lit toujours : il n'est pas derrière.
    expect(tampon.closest('[inert]')).toBeNull()
    rienNeRepond(moteur, 'le tampon')
    await waitFor(() => expect(marche).toHaveLength(1), { timeout: 4000 })
    expect(screen.queryByText('Années 1900')).toBeNull()
    rienNeRepond(moteur, 'la marche')
    await act(async () => marche[0]!.lacher())
    const carton = (await screen.findByText('Années 1910')).closest<HTMLElement>('[role="status"]')!
    expect(carton.closest('[inert]')).toBeNull()
    rienNeRepond(moteur, 'le carton')
    expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1909')

    // Le carton parti (3,1 s), l'avancée est finie : tout répond de nouveau.
    await waitFor(() => expect(screen.queryByText('Années 1910')).toBeNull(), { timeout: 6000 })
    await waitFor(() => expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1910'))
    toutRepond(moteur)
    expect(moteur.direBonjour).not.toHaveBeenCalled()
  }, 20000)

  // La caméra reste au moteur : `inert` n'arrête que le membre. Le moteur écrit le défilement pendant
  // la marche et l'adieu (`defilerVers`), et apprend toujours celui qui en résulte (`scroll`).
  it('pendant l’avancée, le moteur mène toujours la caméra : le défilement qu’il écrit est posé et lui revient', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1897')
    const f = moteurFactice()
    const marche = tenir(f.moteur.marcher)
    const { moteur, rappels } = monter(VOYAGE, {}, f)
    await waitFor(() => expect(marche).toHaveLength(1))
    const vue = laToile().closest<HTMLElement>(`.${stylesDeLaToile.vue!}`)!
    expect(vue.closest('[inert]')).not.toBeNull()
    act(() => rappels().defilerVers(321))
    expect(vue.scrollTop).toBe(321)
    // Un navigateur émet `scroll` pour un défilement écrit par script, inerte ou non (constaté dans Chromium).
    fireEvent.scroll(vue)
    expect(moteur.defiler).toHaveBeenLastCalledWith(321)
  })

  // Les chemins de sortie : un `inert` resté collé rendrait la carte morte.

  // Mutation : `setAvancee(null)` retiré de `finir`.
  it('une marche dans la même décennie : rien ne répond tant qu’elle dure, tout répond à l’arrivée', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1897')
    const f = moteurFactice()
    const marche = tenir(f.moteur.marcher)
    const { moteur } = monter(VOYAGE, {}, f)
    await waitFor(() => expect(marche).toHaveLength(1))
    rienNeRepond(moteur, 'la marche')
    await act(async () => marche[0]!.lacher())
    await waitFor(() => expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1898'))
    toutRepond(moteur)
  })

  // Mutation : `setAvancee(null)` retiré de `finir`. Au calme, le moteur rend ses temps aussitôt ; la
  // page, elle, suit le même chemin.
  it('avec moins d’animations, l’avancée finie rend la main aussi', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
    localStorage.setItem(CLE_ANNEE_VUE, '1897')
    const { moteur } = monter()
    await waitFor(() => expect(moteur.marcher).toHaveBeenCalledWith(1898))
    await waitFor(() => expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1898'))
    expect(moteur.reglerCalme).toHaveBeenLastCalledWith(true)
    toutRepond(moteur)
  })

  // Mutations : `setAvancee(null)` retiré de `finir` ; `if (!vivant) return` retiré (l'avancée d'avant,
  // abandonnée, rendrait la main pendant que celle qui la rejoue marche encore).
  it('rejouée parce que le Voyage est relu en chemin, l’avancée ne rend la main qu’à la fin de celle qui joue', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1897')
    const f = moteurFactice()
    const marche = tenir(f.moteur.marcher)
    const { moteur, client } = monter(VOYAGE, {}, f)
    await waitFor(() => expect(marche).toHaveLength(1))
    // Le Voyage relu a changé (un film de plus en 1895) : l'effet rejoue l'avancée.
    act(() => void client.setQueryData(cles.voyage, { ...VOYAGE, annees: VOYAGE.annees.map((a) => (a.annee === 1895 ? { ...a, profondeur: a.profondeur + 1 } : a)) }))
    await waitFor(() => expect(marche).toHaveLength(2))
    await act(async () => marche[0]!.lacher())
    await new Promise((r) => setTimeout(r, 30))
    rienNeRepond(moteur, 'la marche rejouée')
    expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1897')
    await act(async () => marche[1]!.lacher())
    await waitFor(() => expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1898'))
    toutRepond(moteur)
  })

  // Mutation : `setAvancee(null)` retiré de `finir`. La page quittée en chemin n'a rien écrit : au
  // retour l'avancée se rejoue en entier, et c'est sa fin qui rend la main.
  it('quittée pendant l’avancée puis rouverte, la carte la rejoue et rend la main à sa fin', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1897')
    const f = moteurFactice()
    const marche = tenir(f.moteur.marcher)
    monter(VOYAGE, {}, f)
    await waitFor(() => expect(marche).toHaveLength(1))
    cleanup()
    await act(async () => marche[0]!.lacher())
    expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1897')

    const g = moteurFactice()
    const seconde = tenir(g.moteur.marcher)
    const { moteur } = monter(VOYAGE, {}, g)
    await waitFor(() => expect(seconde).toHaveLength(1))
    rienNeRepond(moteur, 'la marche rejouée au retour')
    await act(async () => seconde[0]!.lacher())
    await waitFor(() => expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1898'))
    toutRepond(moteur)
  })

  // Mutation : `.then(finir, finir)` réduit à `.then(finir)` : la carte reste inerte pour toujours, et
  // l'avatar en chemin.
  it('un temps de l’avancée qui échoue rend la main quand même, sans la rejouer', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1897')
    const f = moteurFactice()
    const marche = tenir(f.moteur.marcher)
    const { moteur, etats } = monter(VOYAGE, {}, f)
    await waitFor(() => expect(marche).toHaveLength(1))
    rienNeRepond(moteur, 'la marche')
    await act(async () => marche[0]!.echouer(new Error('le moteur a lâché')))
    await waitFor(() => expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1898'))
    toutRepond(moteur)
    expect(etats[etats.length - 1]!.anneeAvatar).toBe(1898)
    await new Promise((r) => setTimeout(r, 30))
    expect(marche).toHaveLength(1)
  })

  /**
   * Le moteur d'avant sa correction, pour ce qu'il faisait d'une marche remplacée : `passerLaPorte` et
   * `marcher` se partagent l'avatar, et la marche qui commence abandonne celle qui jouait, sans jamais
   * rendre sa promesse. Deux avancées qui commanderaient le moteur ensemble s'y bloquent pour toujours.
   */
  function uneSeuleMarche(moteur: ReturnType<typeof monter>['moteur']) {
    let enCours: (() => void) | null = null
    const marche = () => new Promise<void>((fin) => void (enCours = fin))
    vi.mocked(moteur.passerLaPorte).mockImplementation(marche)
    vi.mocked(moteur.marcher).mockImplementation(marche)
    return () => {
      const fin = enCours
      enCours = null
      fin?.()
    }
  }

  // Relecture de `918fac9`. Mutations : la garde `vivant` retirée de `marcher` (l'avancée abandonnée,
  // son tampon expiré, prend l'avatar à celle qui la rejoue : plus personne n'arrive, la carte reste
  // inerte), de `claquer`, de `montrerCarton`, ou du retrait du tampon (celui de l'avancée abandonnée
  // retirerait à son heure le tampon de l'autre) ; `setCalque(null)` retiré du nettoyage (le tampon de
  // l'avancée abandonnée reste affiché).
  it('rejouée pendant le tampon, l’avancée abandonnée ne commande plus rien : une seule arrive au bout, et la carte rend la main', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1909')
    const f = moteurFactice()
    const arriver = uneSeuleMarche(f.moteur)
    const { moteur, client } = monter(AVEC_TAMPON_1910, {}, f)
    await waitFor(() => expect(moteur.passerLaPorte).toHaveBeenCalledTimes(1))
    await act(async () => arriver())
    await screen.findByText('Années 1900')
    await new Promise((r) => setTimeout(r, 1000))

    // Le Voyage relu a changé pendant le tampon : l'avancée se rejoue depuis la porte, le tampon retiré.
    act(() => void client.setQueryData(cles.voyage, { ...AVEC_TAMPON_1910, annees: AVEC_TAMPON_1910.annees.map((a) => (a.annee === 1895 ? { ...a, profondeur: a.profondeur + 1 } : a)) }))
    await waitFor(() => expect(moteur.passerLaPorte).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('Années 1900')).toBeNull()
    rienNeRepond(moteur, 'la porte rejouée')
    await act(async () => arriver())
    await screen.findByText('Années 1900')
    // Le tampon de l'avancée abandonnée expire (à 1,8 s, celui de l'autre n'en est qu'à 0,8 s) : elle ne
    // marche pas, ne claque pas, ne montre pas son carton, et laisse à l'autre son tampon.
    await new Promise((r) => setTimeout(r, 1200))
    expect(moteur.marcher).not.toHaveBeenCalled()
    expect(moteur.claquer).not.toHaveBeenCalled()
    expect(screen.queryByText('Années 1910')).toBeNull()
    expect(screen.getByText('Années 1900')).toBeInTheDocument()

    await waitFor(() => expect(moteur.marcher).toHaveBeenCalledTimes(1), { timeout: 4000 })
    await act(async () => arriver())
    await screen.findByText('Années 1910')
    await waitFor(() => expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1910'), { timeout: 6000 })
    expect(screen.queryByText('Années 1910')).toBeNull()
    toutRepond(moteur)
    expect(moteur.marcher).toHaveBeenCalledTimes(1)
    expect(moteur.claquer).toHaveBeenCalledTimes(1)
  }, 25000)

  // Mutation : `vivant &&` retiré devant `direAdieu` (la porte de l'avancée abandonnée, que le moteur
  // libère quand une autre marche prend sa place, lancerait son adieu par-dessus la porte de l'autre).
  it('rejouée pendant la porte, l’avancée abandonnée ne dit pas adieu quand sa porte lui est rendue', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1899')
    const f = moteurFactice()
    const porte = tenir(f.moteur.passerLaPorte)
    const { moteur, client } = monter(AVEC_TAMPON, {}, f)
    await waitFor(() => expect(porte).toHaveLength(1))
    act(() => void client.setQueryData(cles.voyage, { ...AVEC_TAMPON, annees: AVEC_TAMPON.annees.map((a) => (a.annee === 1895 ? { ...a, profondeur: a.profondeur + 1 } : a)) }))
    await waitFor(() => expect(porte).toHaveLength(2))
    // Ce que fait le moteur d'une marche remplacée : il rend sa promesse.
    await act(async () => porte[0]!.lacher())
    await new Promise((r) => setTimeout(r, 30))
    expect(moteur.direAdieu).not.toHaveBeenCalled()
    expect(screen.queryByText('Années 1890')).toBeNull()
    await act(async () => porte[1]!.lacher())
    await waitFor(() => expect(moteur.direAdieu).toHaveBeenCalledTimes(1))
  })

  // Mutation : `setDate(null)` retiré du départ de l'avancée (la petite affiche resterait ouverte
  // derrière elle, son « Refermer » inerte jusqu'à la fin).
  it('l’avancée qui part referme la petite affiche d’une date', async () => {
    const f = moteurFactice()
    const marche = tenir(f.moteur.marcher)
    const { etats, rappels, client } = monter(VOYAGE, {}, f)
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    act(() => rappels().date({ an: 1895, x: 38, y: 112, court: '22 mars', lieu: 'Paris', titre: 'La première projection', jour: 'Vendredi 22 mars 1895', texte: 'Un texte.', image: null }))
    expect(await screen.findByRole('dialog', { name: 'La première projection' })).toBeInTheDocument()
    // Le ticket utilisé ailleurs : le Voyage relu est en 1899, l'avancée part.
    act(() => void client.setQueryData(cles.voyage, { ...VOYAGE, annee_en_cours: 1899, annees: VOYAGE.annees.map((a) => (a.annee === 1899 ? { ...a, statut: 'en_cours' as const } : a.annee === 1898 ? { ...a, statut: 'ouverte' as const } : a)) }))
    await waitFor(() => expect(marche).toHaveLength(1))
    expect(screen.queryByRole('dialog')).toBeNull()
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

  // --- Le monde 1900 au registre (plan 3b, tâche 13) : le passage d'entrée, dans l'avancée et au geste.

  const ANNONCE_1900 = 'Chapitre II · Le voyage immobile · le train'
  const leTrain = () => screen.queryByRole('button', { name: 'Prendre le train pour 1900' })
  const ouvertes = (de: number, a: number) => Array.from({ length: a - de + 1 }, (_, i) => ({ annee: de + i, statut: 'ouverte' as const, visitee: true, recompense: 'ours' as const, progression: P }))
  const verrouillees = (de: number, a: number) => Array.from({ length: a - de + 1 }, (_, i) => ({ annee: de + i, statut: 'verrouillee' as const, visitee: false, recompense: null, progression: null }))
  const enCours = (annee: number) => ({ annee, statut: 'en_cours' as const, visitee: false, recompense: null, progression: null })
  /** En 1899, les années 1900 à 1902 rendues par l'API et encore fermées : avant le déblocage. */
  const EN_1899 = voyage1890(1899, [...ouvertes(1895, 1898), enCours(1899), ...verrouillees(1900, 1902)])
  /** En 1901 : le monde 1900 débloqué, une année déjà derrière soi. */
  const EN_1901 = voyage1890(1901, [...ouvertes(1895, 1900), enCours(1901), ...verrouillees(1902, 1903)])

  // Le toucher qui pose le passage. Mutations : l'inertie rendue à la toile pour toute l'avancée
  // (`avancee ? INERTE` sur la première enveloppe : le toucher n'atteint pas le moteur pendant le
  // passage) ; la toile sortie de l'inertie pour toute l'avancée (`INERTE` retiré de la première
  // enveloppe : un doigt posé pendant la porte, l'adieu ou le tampon atteint le moteur) ; tout le fond
  // sorti de l'inertie pendant le passage (`avancee && !bonjour` sur la seconde enveloppe) ;
  // `aUnPassage` qui rend toujours faux (le carton montré, la marche à la place du passage) ; le
  // `role="status"` de l'annonce retiré.
  it('vers 1900 : rien ne répond pendant la porte, l’adieu et le tampon ; pendant le passage la toile seule répond, sans carton, ses lignes dites hors de vue ; puis la carte rend la main', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1899')
    const f = moteurFactice()
    const porte = tenir(f.moteur.passerLaPorte)
    const adieu = tenir(f.moteur.direAdieu)
    const passage = tenir(f.moteur.direBonjour)
    const { moteur } = monter(AVEC_TAMPON, {}, f)

    await waitFor(() => expect(porte).toHaveLength(1))
    rienNeRepond(moteur, 'la porte')
    await act(async () => porte[0]!.lacher())
    await waitFor(() => expect(adieu).toHaveLength(1))
    rienNeRepond(moteur, 'l’adieu')
    await act(async () => adieu[0]!.lacher())
    await screen.findByText('Années 1890')
    rienNeRepond(moteur, 'le tampon')
    expect(screen.queryByText(ANNONCE_1900)).toBeNull()

    await waitFor(() => expect(passage).toHaveLength(1), { timeout: 4000 })
    expect(moteur.direBonjour).toHaveBeenCalledWith(1900, 'endroit')
    expect(screen.queryByText('Années 1890')).toBeNull()
    // La toile répond : le doigt posé atteint le moteur, qui pose le passage à sa fin.
    await waitFor(() => expect(laToile().closest('[inert]')).toBeNull())
    vi.mocked(moteur.pointeur).mockClear()
    poserLeDoigt(laToile())
    expect(moteur.pointeur).toHaveBeenCalledTimes(1)
    expect(vi.mocked(moteur.pointeur).mock.calls[0]![0]).toBe('bas')
    // Le HUD, la liste des années et les pastilles attendent toujours.
    for (const e of derriere()) toucher(e)
    expect(moteur.basculerEnsemble).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Son' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
    for (const e of derriere()) expect(prendLeFocus(e), `le passage : ${e.getAttribute('aria-label') ?? e.textContent ?? ''}`).toBe(false)
    // Pas de carton : le passage en tient lieu. Ses lignes sont dites, hors de vue et hors de l'inertie.
    expect(screen.queryByText('Le voyage immobile')).toBeNull()
    const annonce = screen.getByText(ANNONCE_1900)
    expect(annonce).toHaveAttribute('role', 'status')
    expect(annonce).toHaveClass('sr-only')
    expect(annonce.closest('[inert]')).toBeNull()
    expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1899')
    expect(moteur.claquer).not.toHaveBeenCalled()

    await act(async () => passage[0]!.lacher())
    await waitFor(() => expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1900'))
    expect(moteur.claquer).toHaveBeenCalledTimes(1)
    expect(moteur.marcher).not.toHaveBeenCalled()
    expect(screen.queryByText('Le voyage immobile')).toBeNull()
    toutRepond(moteur)
  }, 20000)

  // Un passage qui échoue (ou que le moteur rejette) ne laisse ni la toile vivante dans une avancée
  // morte, ni la carte inerte. Mutation : `.then(finir, finir)` réduit à `.then(finir)`.
  it('un passage qui échoue rend la main quand même', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1899')
    const f = moteurFactice()
    const passage = tenir(f.moteur.direBonjour)
    const { moteur } = monter(V1900, {}, f)
    await waitFor(() => expect(passage).toHaveLength(1))
    await act(async () => passage[0]!.echouer(new Error('le moteur a lâché')))
    await waitFor(() => expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1900'))
    toutRepond(moteur)
  })

  // Vigilance 3 du plan 3b, le jumeau de « ne rejoue rien sur un appareil qui n'a jamais vu la
  // carte ». Mutation : `depuis` remplacé par 1899 quand il est nul.
  it.each([
    ['sans mémoire d’appareil', () => undefined],
    [
      'quand le stockage lève',
      () => {
        const bloque = () => {
          throw new DOMException('Le stockage est bloqué.', 'SecurityError')
        }
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(bloque)
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(bloque)
      },
    ],
  ])('une carte ouverte en 1900 %s ne joue ni la porte, ni l’adieu, ni le passage', async (_nom, preparer) => {
    preparer()
    try {
      const { moteur, etats } = monter(V1900)
      await waitFor(() => expect(etats.length).toBeGreaterThan(0))
      expect(etats[etats.length - 1]!.anneeAvatar).toBe(1900)
      await new Promise((r) => setTimeout(r, 30))
      expect(moteur.passerLaPorte).not.toHaveBeenCalled()
      expect(moteur.direAdieu).not.toHaveBeenCalled()
      expect(moteur.direBonjour).not.toHaveBeenCalled()
      expect(moteur.marcher).not.toHaveBeenCalled()
      expect(screen.queryByText(ANNONCE_1900)).toBeNull()
      // La toile n'est pas restée inerte, ni rien d'autre.
      toutRepond(moteur)
    } finally {
      vi.restoreAllMocks()
    }
  })

  // Vigilance 4 : la mémoire de l'appareil ne s'écrit qu'à la fin de l'avancée. Mutation :
  // `ecrireAnneeVue` avancé au début de la suite (dans `passerLaPorte` ou `direBonjour` de la page).
  it('rechargée en plein passage, la carte rejoue tout : la porte, l’adieu, le passage', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1899')
    const f = moteurFactice()
    const passage = tenir(f.moteur.direBonjour)
    monter(V1900, {}, f)
    await waitFor(() => expect(passage).toHaveLength(1))
    expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1899')
    cleanup()
    await act(async () => passage[0]!.lacher())
    expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1899')
    expect(f.moteur.claquer).not.toHaveBeenCalled()

    const g = moteurFactice()
    const second = tenir(g.moteur.direBonjour)
    const { moteur } = monter(V1900, {}, g)
    await waitFor(() => expect(second).toHaveLength(1))
    expect(moteur.passerLaPorte).toHaveBeenCalledTimes(1)
    expect(moteur.direAdieu).toHaveBeenCalledWith(1890)
    await act(async () => second[0]!.lacher())
    await waitFor(() => expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1900'))
    toutRepond(moteur)
  })

  // Vigilance 2 : le Voyage suivi rattrapé de 1898 à 1903, sans ticket ni tampon. Mutations :
  // `marcher` retiré de la suite d'un monde à passage ; le passage sauté quand l'année d'arrivée
  // n'est pas la première de sa décennie.
  it('un rattrapage de 1898 à 1903 ne saute aucune étape : la porte, l’adieu, le passage, le clap, puis le train roule jusqu’à 1903', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1898')
    const en1903 = voyage1890(1903, [...ouvertes(1895, 1902), enCours(1903)])
    const f = moteurFactice()
    const roulement = tenir(f.moteur.marcher)
    const { moteur, etats } = monter(en1903, {}, f)
    // Le passage fini, la toile retourne à l'inertie pour le roulement. Mutation : `setBonjour(false)`
    // retiré de la fin du passage (un doigt posé pendant le roulement atteindrait le moteur).
    await waitFor(() => expect(roulement).toHaveLength(1))
    await waitFor(() => expect(laToile().closest('[inert]')).not.toBeNull())
    rienNeRepond(moteur, 'le roulement vers 1903')
    expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1898')
    await act(async () => roulement[0]!.lacher())
    await waitFor(() => expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1903'))
    const rang = (temps: (...a: never[]) => unknown) => vi.mocked(temps).mock.invocationCallOrder
    expect(moteur.passerLaPorte).toHaveBeenCalledTimes(1)
    expect(moteur.direAdieu).toHaveBeenCalledTimes(1)
    expect(moteur.direAdieu).toHaveBeenCalledWith(1890)
    expect(moteur.direBonjour).toHaveBeenCalledTimes(1)
    expect(moteur.direBonjour).toHaveBeenCalledWith(1900, 'endroit')
    expect(moteur.claquer).toHaveBeenCalledTimes(1)
    expect(vi.mocked(moteur.marcher).mock.calls).toEqual([[1903]])
    const ordre = [rang(moteur.passerLaPorte)[0]!, rang(moteur.direAdieu)[0]!, rang(moteur.direBonjour)[0]!, rang(moteur.claquer)[0]!, rang(moteur.marcher)[0]!]
    expect(ordre).toEqual([...ordre].sort((x, y) => x - y))
    // Le moteur a les années 1900 dès le départ de l'avancée, et l'avatar n'y arrive qu'à la fin.
    expect(etats[0]!.cases.map((c) => c.annee)).toContain(1903)
    expect(etats[0]!.anneeAvatar).toBe(1898)
    expect(etats[etats.length - 1]!.anneeAvatar).toBe(1903)
    expect(screen.queryByText('Le voyage immobile')).toBeNull()
  })

  // Le jumeau, pour le monde à passage, de « rejouée pendant le tampon ». Mutation : la relecture de
  // `vivant` retirée de `direBonjour` (l'avancée abandonnée, son tampon expiré, lancerait le passage
  // par-dessus le tampon de celle qui la rejoue).
  it('rejouée pendant le tampon, l’avancée abandonnée ne dit pas bonjour : un seul passage se joue', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1899')
    const f = moteurFactice()
    const arriver = uneSeuleMarche(f.moteur)
    const { moteur, client } = monter(AVEC_TAMPON, {}, f)
    await waitFor(() => expect(moteur.passerLaPorte).toHaveBeenCalledTimes(1))
    await act(async () => arriver())
    await screen.findByText('Années 1890')
    await new Promise((r) => setTimeout(r, 1000))

    act(() => void client.setQueryData(cles.voyage, { ...AVEC_TAMPON, annees: AVEC_TAMPON.annees.map((a) => (a.annee === 1895 ? { ...a, profondeur: a.profondeur + 1 } : a)) }))
    await waitFor(() => expect(moteur.passerLaPorte).toHaveBeenCalledTimes(2))
    await act(async () => arriver())
    await screen.findByText('Années 1890')
    // Le tampon de l'avancée abandonnée expire (à 1,8 s ; celui de l'autre n'en est qu'à 0,8 s).
    await new Promise((r) => setTimeout(r, 1200))
    expect(moteur.direBonjour).not.toHaveBeenCalled()
    expect(moteur.claquer).not.toHaveBeenCalled()
    expect(screen.queryByText(ANNONCE_1900)).toBeNull()
    expect(screen.getByText('Années 1890')).toBeInTheDocument()
    expect(laToile().closest('[inert]')).not.toBeNull()

    await waitFor(() => expect(localStorage.getItem(CLE_ANNEE_VUE)).toBe('1900'), { timeout: 6000 })
    expect(moteur.direBonjour).toHaveBeenCalledTimes(1)
    expect(moteur.claquer).toHaveBeenCalledTimes(1)
    toutRepond(moteur)
  }, 20000)

  // Rejouée pendant le passage : la toile que l'avancée abandonnée avait sortie de l'inertie y
  // retourne pour la porte de celle qui la rejoue. Mutation : `setBonjour(false)` retiré du nettoyage.
  it('rejouée pendant le passage, l’avancée reprend à la porte, la toile de nouveau inerte', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1899')
    const f = moteurFactice()
    const porte = tenir(f.moteur.passerLaPorte)
    const passage = tenir(f.moteur.direBonjour)
    const { moteur, client } = monter(V1900, {}, f)
    await waitFor(() => expect(porte).toHaveLength(1))
    await act(async () => porte[0]!.lacher())
    await waitFor(() => expect(passage).toHaveLength(1))
    await waitFor(() => expect(laToile().closest('[inert]')).toBeNull())
    act(() => void client.setQueryData(cles.voyage, { ...V1900, annees: V1900.annees.map((a) => (a.annee === 1895 ? { ...a, profondeur: a.profondeur + 1 } : a)) }))
    await waitFor(() => expect(porte).toHaveLength(2))
    rienNeRepond(moteur, 'la porte rejouée')
  })

  // Ce que la tâche 10 laissait sans garde : 1900 qui apparaît à l'usage du ticket. Mutations : le
  // passage joué sans que le moteur ait reçu les années 1900 (les cases laissées cachées pendant
  // l'avancée) ; l'avatar posé en 1900 dès la relecture.
  it('le ticket de 1900 utilisé débloque le monde : le moteur reçoit ses années, puis la porte, l’adieu et le passage se jouent', async () => {
    let encaisse = false
    const TICKET_1900 = { ...TICKET, annee: 1900 }
    const apres = voyage1890(1900, [...ouvertes(1895, 1899), enCours(1900), ...verrouillees(1901, 1902)])
    const f = moteurFactice()
    const passage = tenir(f.moteur.direBonjour)
    const { moteur, etats } = monter(
      EN_1899,
      {
        'GET /api/me/voyage': () => json(encaisse ? apres : EN_1899),
        'GET /api/me/voyage/tickets': () => json({ tickets: encaisse ? [{ ...TICKET_1900, utilise_le: '2026-09-28T11:00:00.000Z' }] : [TICKET_1900] }),
        'POST /api/me/voyage/tickets/1900/utiliser': () => {
          encaisse = true
          return json({ annee_en_cours: 1900 })
        },
      },
      f,
    )
    const bouton = await screen.findByRole('button', { name: /Utiliser le ticket/ })
    // Avant le déblocage, rien ne nomme 1900 : ni le bouton, ni les années données au moteur.
    expect(bouton).toHaveTextContent('1899 → nouveau monde')
    expect(bouton).not.toHaveTextContent('1900')
    // Le bouton ne dit rien du moteur : il paraît dès que le Voyage et les tickets sont lus, alors que
    // le moteur ne reçoit son premier état que deux rendus plus tard (l'avatar posé par un effet, puis
    // la toile montée). Ce qu'on lit du moteur s'attend sur le moteur, et se juge sur chaque état reçu.
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    expect(etats.map((e) => e.cases.map((c) => c.annee))).toEqual(etats.map(() => [1895, 1896, 1897, 1898, 1899]))
    fireEvent.click(bouton)
    await waitFor(() => expect(passage).toHaveLength(1))
    expect(moteur.direBonjour).toHaveBeenCalledWith(1900, 'endroit')
    expect(moteur.passerLaPorte).toHaveBeenCalledTimes(1)
    expect(moteur.direAdieu).toHaveBeenCalledWith(1890)
    const pendant = etats[etats.length - 1]!
    expect(pendant.cases.map((c) => c.annee)).toEqual([1895, 1896, 1897, 1898, 1899, 1900, 1901, 1902])
    expect(pendant.anneeAvatar).toBe(1899)
    await act(async () => passage[0]!.lacher())
    await waitFor(() => expect(etats[etats.length - 1]!.anneeAvatar).toBe(1900))
    expect(moteur.marcher).not.toHaveBeenCalled()
  })

  // Le passage au geste. Mutations : `entreeProche` ignoré (le bouton toujours offert en 1900, ou
  // jamais) ; le bouton branché sur la suite de l'avancée (`passerLaPorte`, `direAdieu`) ; le sens
  // « envers ».
  it('« Prendre le train pour 1900 » ne s’offre que lorsque le moteur dit l’entrée proche, et ne joue que le passage', async () => {
    const { moteur, rappels, etats } = monter(EN_1901)
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    await new Promise((r) => setTimeout(r, 30))
    expect(leTrain()).toBeNull()
    act(() => rappels().entreeProche?.(1900))
    const bouton = leTrain()!
    expect(bouton).toBeInTheDocument()
    expect(bouton.closest('[inert]')).toBeNull()
    toucher(bouton)
    expect(vi.mocked(moteur.direBonjour).mock.calls).toEqual([[1900, 'endroit']])
    await new Promise((r) => setTimeout(r, 30))
    expect(moteur.passerLaPorte).not.toHaveBeenCalled()
    expect(moteur.direAdieu).not.toHaveBeenCalled()
    expect(moteur.marcher).not.toHaveBeenCalled()
    expect(moteur.claquer).not.toHaveBeenCalled()
    expect(screen.queryByText(ANNONCE_1900)).toBeNull()
    // Le passage au geste n'est pas une avancée : rien ne devient inerte.
    expect(laToile().closest('[inert]')).toBeNull()
    // Loin du bas de la foire, ou le passage lancé : le moteur le dit, le bouton s'en va.
    act(() => rappels().entreeProche?.(null))
    expect(leTrain()).toBeNull()
  })

  // La borne du déblocage : la première année du monde le débloque. Mutation : `>=` devenu `>` (le
  // bouton manquerait pendant toute l'année 1900).
  it('« Prendre le train pour 1900 » s’offre dès 1900, la première année du monde', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1900')
    const { moteur, rappels, etats } = monter(V1900)
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    expect(leTrain()).toBeNull()
    act(() => rappels().entreeProche?.(1900))
    toucher(leTrain()!)
    expect(vi.mocked(moteur.direBonjour).mock.calls).toEqual([[1900, 'endroit']])
    expect(moteur.passerLaPorte).not.toHaveBeenCalled()
  })

  // Sous la vue d'ensemble, le passage se jouerait sans être vu. Mutation : `!ensemble` retiré.
  it('« Prendre le train » se tait sous la vue d’ensemble, et revient quand elle se referme', async () => {
    const { rappels, etats } = monter(EN_1901)
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    act(() => rappels().entreeProche?.(1900))
    expect(leTrain()).not.toBeNull()
    act(() => rappels().ensemble(true))
    expect(leTrain()).toBeNull()
    act(() => rappels().ensemble(false))
    expect(leTrain()).not.toBeNull()
  })

  /** Tout ce que la page donne à lire, à l'œil comme au lecteur d'écran : son texte, et ses attributs lisibles. */
  const ATTRIBUTS_LUS = ['aria-label', 'aria-description', 'aria-valuetext', 'aria-roledescription', 'title', 'alt', 'placeholder', 'value']
  const toutCeQuiSeLit = () => [document.body.textContent ?? '', ...Array.from(document.body.querySelectorAll('*')).flatMap((e) => ATTRIBUTS_LUS.map((n) => e.getAttribute(n) ?? ''))].join('\n')
  /** La même membre, derrière un Voyage suivi déjà rendu en 1900 : son année visitée, elle « le rattrape bientôt ». */
  const DERRIERE_1900 = voyage1890(1899, [...ouvertes(1895, 1898), { ...enCours(1899), visitee: true }, ...verrouillees(1900, 1902)], {
    ia: false,
    source: { id: '22222222-2222-4222-8222-222222222222', pseudo: 'Théo', annee_en_cours: 1900 },
  })

  // Le seul garde du HUD pour « rien de 1900 avant le déblocage » (revue du lot 2, M8 de la tâche 13).
  // Mutations : la garde du déblocage retirée (`v.annee_en_cours >= proche`) ; l'année du Voyage suivi
  // ajoutée à la ligne « Tu suis le Voyage de… » ; ajoutée à un `aria-label` du HUD ; `anneesMontrees`
  // retiré des cases, donc de la liste des années.
  it.each([
    ['sans Voyage suivi', EN_1899, null],
    ['derrière un Voyage suivi déjà en 1900', DERRIERE_1900, 'tu le rattrapes bientôt'],
  ])('avant le déblocage, %s : « Prendre le train » ne s’offre pas, quoi que dise le moteur, et rien de ce qui se lit ne nomme 1900', async (_nom, voyage, suivi) => {
    const { rappels, etats } = monter(voyage)
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    act(() => rappels().entreeProche?.(1900))
    await new Promise((r) => setTimeout(r, 30))
    expect(leTrain()).toBeNull()
    // Le témoin : la page est bien là, avec ce qu'elle dit du Voyage suivi, et ses attributs sont lus.
    if (suivi) expect(toutCeQuiSeLit()).toContain(suivi)
    expect(toutCeQuiSeLit()).toContain('1899')
    expect(toutCeQuiSeLit()).toContain('Les années du Voyage')
    expect(toutCeQuiSeLit()).not.toContain('1900')
  })

  // Revue du lot 2 (M5 de la tâche 13) : l'erreur du ticket couvrait le bouton du train posé au-dessus
  // du ticket. La feuille la monte par un sélecteur de frère : il ne vaut que si l'erreur suit le bouton
  // dans le même parent. Mutations : l'erreur rendue avant le bouton du train ; la classe
  // `auDessusDuTicket` retirée du bouton ; la règle `.trainOmbre.auDessusDuTicket ~ .erreur` retirée
  // de la feuille, ou son `bottom` ramené à 84 px.
  it('l’erreur du ticket se tient au-dessus du bouton du train, lui-même au-dessus du ticket', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1901')
    const { rappels, etats } = monter(EN_1901, {
      'GET /api/me/voyage/tickets': () => json({ tickets: [{ ...TICKET, annee: 1902 }] }),
      'POST /api/me/voyage/tickets/1902/utiliser': () => json({ code: 'INTERNAL', message: 'Une erreur est survenue. Réessaie.', retryable: true }, 500),
    })
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Utiliser le ticket/ })).not.toBeNull(), { timeout: 5000 })
    act(() => rappels().entreeProche?.(1900))
    fireEvent.click(screen.getByRole('button', { name: /Utiliser le ticket/ }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeNull(), { timeout: 5000 })
    // Les trois sont là ensemble, et l'erreur est bien le frère que la feuille vise.
    expect(leTrain()).not.toBeNull()
    expect(screen.getByRole('button', { name: /Utiliser le ticket/ })).toBeInTheDocument()
    expect(document.querySelector(`.${stylesDeLaCarte.trainOmbre}.${stylesDeLaCarte.auDessusDuTicket} ~ .${stylesDeLaCarte.erreur}`)).toBe(screen.getByRole('alert'))
    // La feuille : chacun commence au-dessus du haut de celui qu'il surmonte (son `bottom` et sa hauteur minimale).
    const regle = (selecteur: string) => new RegExp(`(?:^|\\n)${selecteur.replace(/[.~]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(FEUILLE_DE_LA_CARTE)?.[1] ?? ''
    const px = (selecteur: string, propriete: string) => Number(new RegExp(`(?:^|[;\\s])${propriete}:\\s*(\\d+)px`).exec(regle(selecteur))?.[1] ?? NaN)
    const hautDuTicket = px('.ticketOmbre', 'bottom') + px('.ticket', 'min-height')
    const basDuTrain = px('.trainOmbre.auDessusDuTicket', 'bottom')
    const hautDuTrain = basDuTrain + px('.train', 'min-height')
    expect(basDuTrain).toBeGreaterThanOrEqual(hautDuTicket)
    expect(px('.trainOmbre.auDessusDuTicket ~ .erreur', 'bottom')).toBeGreaterThanOrEqual(hautDuTrain)
    // Sans bouton du train au-dessus du ticket, l'erreur reste au-dessus du ticket seul.
    expect(px('.erreur', 'bottom')).toBeGreaterThanOrEqual(hautDuTicket)
  })

  // Mutation : la garde de l'avancée retirée (`!avancee`).
  it('« Prendre le train » se tait tant qu’une avancée joue, et revient à sa fin', async () => {
    localStorage.setItem(CLE_ANNEE_VUE, '1900')
    const f = moteurFactice()
    const marche = tenir(f.moteur.marcher)
    const { rappels } = monter(EN_1901, {}, f)
    await waitFor(() => expect(marche).toHaveLength(1))
    act(() => rappels().entreeProche?.(1900))
    await new Promise((r) => setTimeout(r, 30))
    expect(leTrain()).toBeNull()
    await act(async () => marche[0]!.lacher())
    await waitFor(() => expect(leTrain()).not.toBeNull())
  })
})

describe('l’encre de la carte', () => {
  // Le HUD (le millésime en cours, les récompenses, l’objectif) n’a pas d’encre à lui : il héritait
  // `--couleur-texte` du thème général, sombre en thème clair, sur son dégradé presque noir. La
  // maquette (`carte-v2.html`) pose `var(--papier)` sur son `body`. Mutation : la couleur retirée de `.ecran`.
  it('pose le papier sur l’écran, sans rien hériter du thème général', () => {
    const regle = /(?:^|\n)\.ecran\s*\{([^}]*)\}/.exec(FEUILLE_DE_LA_CARTE)?.[1]
    expect(regle, 'la règle .ecran').toBeDefined()
    expect(/(?:^|[;\s])color:\s*([^;]+);/.exec(regle!)?.[1]?.trim()).toBe('var(--papier)')
  })
})

describe('le son et les bobines perdues (plan 2d)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('AudioContext', DoublureAudio)
    oublierDoublures()
    localStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const son = () => screen.getByRole('button', { name: 'Son' })
  const compteur = () => screen.getByText(/^Bobines retrouvées/)
  /** Un rechargement : la page démontée, l'ambiance de la page oubliée, aucun contexte construit. */
  const recharger = () => {
    cleanup()
    oublierAmbianceDeLaPage()
    oublierDoublures()
  }
  const CLE_SON = `journal.carte.son.${SESSION.user.id}`
  const CLE_BOBINES = `journal.carte.bobines.${SESSION.user.id}`

  // Mutations : l'ambiance qui construit son contexte au montage, au clap, aux présences ou au
  // carillon d'une bobine ; le bouton qui ne l'allume pas.
  it('ne construit aucun contexte audio tant que « Son » n’a pas été touché', async () => {
    const { rappels, etats } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    act(() => {
      rappels().clap()
      rappels().presences([{ musique: { battue: 0.36, temps: 24, volume: 0.5, filtre: 2300, jouer: () => undefined }, poids: 1 }], 1890)
      rappels().bobine('les-quatre-diables')
      rappels().bobineArrivee('les-quatre-diables')
    })
    expect(DoublureAudio.crees).toHaveLength(0)
    expect(son()).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(son())
    expect(DoublureAudio.crees).toHaveLength(1)
    expect(son()).toHaveAttribute('aria-pressed', 'true')
    expect(son()).toHaveAttribute('title', 'Son : allumé')
  })

  // Plan 3a, tâche 7 : le rappel porte aussi la décennie à l'écran, pour le compteur. Mutations :
  // `ambiance.presences(liste)` retiré du rappel de la page (plus aucune musique), ou la décennie
  // passée à l'ambiance avec la liste.
  it('donne toujours à l’ambiance les présences que le moteur dit, sans la décennie', async () => {
    const recues = vi.spyOn(Ambiance.prototype, 'presences')
    const { rappels, etats } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    const liste = [{ musique: null, poids: 0.25 }, { musique: null, poids: 0.75 }]
    recues.mockClear()
    act(() => rappels().presences(liste, 1890))
    expect(recues.mock.calls).toEqual([[liste]])
  })

  // Mutations : `lireSon` remplacé par `false` (le choix oublié) ; `ecrireSon` retiré du bouton ;
  // le réglage retenu qui rallume le son de lui-même au rechargement (un contexte sans geste).
  it('est coupé par défaut, et son choix se relit au rechargement sans rien rallumer', async () => {
    monter()
    expect(await screen.findByRole('button', { name: 'Son' })).toHaveAttribute('title', 'Son : coupé')
    fireEvent.click(son())
    expect(localStorage.getItem(CLE_SON)).toBe('allume')
    recharger()
    monter()
    expect(await screen.findByRole('button', { name: 'Son' })).toHaveAttribute('title', 'Son : touche pour le reprendre')
    expect(son()).toHaveAttribute('aria-pressed', 'false')
    expect(DoublureAudio.crees).toHaveLength(0)
    fireEvent.click(son())
    expect(DoublureAudio.crees).toHaveLength(1)
    fireEvent.click(son())
    expect(son()).toHaveAttribute('aria-pressed', 'false')
    recharger()
    monter()
    expect(await screen.findByRole('button', { name: 'Son' })).toHaveAttribute('title', 'Son : coupé')
  })

  // Mutation : l'écouteur `visibilitychange` retiré de la page : l'orgue jouerait l'app en arrière-plan.
  it('se tait quand la page passe en arrière-plan', async () => {
    monter()
    fireEvent.click(await screen.findByRole('button', { name: 'Son' }))
    const ctx = DoublureAudio.crees[0]!
    const cache = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    expect(ctx.state).toBe('suspended')
    cache.mockReturnValue(false)
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    expect(ctx.state).toBe('running')
  })

  // Mutation : `ambiance.taire(true)` retiré du démontage : l'orgue suivrait le membre sur la fiche
  // d'une année ou dans un autre onglet.
  it('se tait quand la carte est quittée, et reprend sans nouveau contexte à son retour', async () => {
    monter()
    fireEvent.click(await screen.findByRole('button', { name: 'Son' }))
    const ctx = DoublureAudio.crees[0]!
    cleanup()
    expect(ctx.state).toBe('suspended')
    monter()
    expect(await screen.findByRole('button', { name: 'Son' })).toHaveAttribute('aria-pressed', 'true')
    expect(ctx.state).toBe('running')
    expect(DoublureAudio.crees).toHaveLength(1)
  })

  // Mutation : l'ambiance de la page rendue sans regarder le membre : déconnecté puis reconnecté
  // sous un autre pseudo dans le même onglet, le suivant entendrait le son du précédent sans avoir
  // touché « Son », contre son propre réglage.
  it('ne passe pas le son d’un membre au suivant, dans le même onglet', async () => {
    monter()
    fireEvent.click(await screen.findByRole('button', { name: 'Son' }))
    const ctx = DoublureAudio.crees[0]!
    cleanup()
    const autre = { ...SESSION, user: { ...SESSION.user, id: `${SESSION.user.id}-autre`, pseudo: 'autre' } }
    monter(VOYAGE, { 'GET /api/auth/me': () => json(autre) })
    expect(await screen.findByRole('button', { name: 'Son' })).toHaveAttribute('aria-pressed', 'false')
    expect(son()).toHaveAttribute('title', 'Son : coupé')
    expect(ctx.state).toBe('suspended')
  })

  // Mutations : le compteur montré sans trouvaille (`hidden` retiré) ; compté dès le toucher (sans
  // attendre l'arrivée) ; la trouvaille ni retenue sur l'appareil ni rendue au moteur.
  it('ne montre le compteur qu’à la première trouvaille, et la compte à son arrivée', async () => {
    const { rappels, etats, moteur } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    expect(compteur()).not.toBeVisible()
    act(() => rappels().bobine('les-quatre-diables'))
    expect(compteur()).toBeVisible()
    expect(compteur()).toHaveTextContent('Bobines retrouvées 0/3')
    expect(JSON.parse(localStorage.getItem(CLE_BOBINES)!)).toEqual(['les-quatre-diables'])
    expect(moteur.reglerBobines).toHaveBeenLastCalledWith(['les-quatre-diables'])
    act(() => rappels().bobineArrivee('les-quatre-diables'))
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/3')
    expect(screen.getByRole('status')).toHaveTextContent('Bobine retrouvée 1/3« Les Quatre Diables », F. W. Murnau, 1928 : un film perdu.')
  })

  // Mutation : `lireBobines` remplacé par `[]` : les bobines trouvées la veille reviendraient.
  it('relit les bobines déjà trouvées sur l’appareil', async () => {
    localStorage.setItem(CLE_BOBINES, JSON.stringify(['les-quatre-diables', 'la-tete-de-janus']))
    const { etats, moteur } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    expect(moteur.reglerBobines).toHaveBeenLastCalledWith(['les-quatre-diables', 'la-tete-de-janus'])
    expect(compteur()).toBeVisible()
    expect(compteur()).toHaveTextContent('Bobines retrouvées 2/3')
  })

  // Mutations : le message des trois jamais programmé, ou programmé avant la troisième.
  it('dit, après la troisième, que les trois bobines perdues sont retrouvées', async () => {
    localStorage.setItem(CLE_BOBINES, JSON.stringify(['les-quatre-diables']))
    const { rappels, etats } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    act(() => {
      rappels().bobine('la-tete-de-janus')
      rappels().bobineArrivee('la-tete-de-janus')
    })
    await new Promise((fin) => setTimeout(fin, 3500))
    expect(screen.queryByText('Les trois bobines perdues sont retrouvées.')).not.toBeInTheDocument()
    act(() => {
      rappels().bobine('londres-apres-minuit')
      rappels().bobineArrivee('londres-apres-minuit')
    })
    expect(screen.getByRole('status')).toHaveTextContent('Bobine retrouvée 3/3')
    expect(await screen.findByText('Les trois bobines perdues sont retrouvées.', {}, { timeout: 4500 })).toBeInTheDocument()
  }, 15000)

  // Mutations : un `try` retiré de `carte/memoire.ts` (son ou bobines) : un stockage bloqué
  // (navigation privée) ferait tomber la carte, le bouton ou la trouvaille.
  it('un stockage qui lève ne casse ni la carte, ni le son, ni les bobines', async () => {
    const bloque = () => {
      throw new DOMException('Le stockage est bloqué.', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(bloque)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(bloque)
    const { rappels, etats } = monter()
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    expect(son()).toHaveAttribute('title', 'Son : coupé')
    fireEvent.click(son())
    expect(son()).toHaveAttribute('aria-pressed', 'true')
    act(() => {
      rappels().bobine('les-quatre-diables')
      rappels().bobineArrivee('les-quatre-diables')
    })
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/3')
  })
})

describe('le rattrapage de l’année bouclée', () => {
  const TICKET = { annee: 1899, motif: 'Tu as fait le tour de 1898.', emis_le: '2026-09-21T21:00:00.000Z' }
  const A_MONTRER = { ...VOYAGE, ticket_a_montrer: TICKET }
  const MONTRE = 'POST /api/me/voyage/tickets/1899/montre'
  const UTILISER = 'POST /api/me/voyage/tickets/1899/utiliser'
  const montre = () => new Response(null, { status: 204 })
  /** Des touchers dans le même instant, avant que React n'ait retiré les boutons de la scène. */
  const toucher = (...boutons: HTMLElement[]) => act(() => boutons.forEach((b) => b.click()))

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Au calme, la scène est posée d'un coup : le choix s'offre sans attendre ses pas.
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  // Mutations : le rattrapage retiré de la carte ; « Le garder » sans `/montre` ; la garde du ticket
  // déjà fêté retirée (un `/montre` qui n'a pas pris — la carte relue le rend encore — rejouerait la
  // scène en boucle).
  it('un ticket à montrer joue l’année bouclée une fois, et « Le garder » le marque montré, une seule fois', async () => {
    // La carte relue après `/montre` rend encore le ticket, et une Palme de plus en 1897 : le HUD qui
    // la compte dit que cette relecture est rendue.
    let lectures = 0
    const relu = { ...A_MONTRER, annees: A_MONTRER.annees.map((a) => (a.annee === 1897 ? { ...a, recompense: 'palme' as const } : a)) }
    const { requetes } = monter(A_MONTRER, { 'GET /api/me/voyage': () => ((lectures += 1), json(lectures === 1 ? A_MONTRER : relu)), [MONTRE]: montre })
    expect(await screen.findByRole('dialog', { name: '1898 est bouclée' })).toBeInTheDocument()
    expect(screen.getByLabelText('Bon pour 1899')).toBeInTheDocument()
    const garder = screen.getByRole('button', { name: 'Le garder' })
    toucher(garder, garder)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByLabelText('2 Palmes, 1 Lions, 0 Ours')).toBeInTheDocument()
    await act(async () => undefined)
    expect(lectures).toBeGreaterThanOrEqual(2)
    expect(requetes.filter((r) => r === MONTRE)).toHaveLength(1)
    expect(requetes.filter((r) => r === UTILISER)).toEqual([])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // Mutations : `/montre` oublié de « L’utiliser » ; l'encaissement non branché sur la carte.
  it('« L’utiliser » le marque montré une seule fois, et l’encaisse', async () => {
    const { requetes, client } = monter(A_MONTRER, { [MONTRE]: montre, [UTILISER]: () => json({ annee_en_cours: 1899 }) })
    const utiliser = await screen.findByRole('button', { name: 'L’utiliser' })
    toucher(utiliser, utiliser, screen.getByRole('button', { name: 'Le garder' }))
    await waitFor(() => expect(requetes).toContain(UTILISER))
    // Les touchers sont du même instant : ce qu'ils envoient part ensemble. Plus rien n'est en vol.
    await waitFor(() => expect(client.isMutating() + client.isFetching()).toBe(0))
    expect(requetes.filter((r) => r === MONTRE)).toHaveLength(1)
    expect(requetes.filter((r) => r === UTILISER)).toHaveLength(1)
  })

  // Mutation : « L’utiliser » offert pour un ticket qui n'ouvre pas l'année suivante (`ticketOffert`).
  it('un ticket qui n’ouvre pas l’année suivante ne s’offre qu’à garder', async () => {
    monter({ ...VOYAGE, annee_en_cours: 1897, ticket_a_montrer: TICKET }, { [MONTRE]: montre })
    expect(await screen.findByRole('button', { name: 'Le garder' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'L’utiliser' })).toBeNull()
  })

  // Mutation : la scène jouée sans ticket à montrer.
  it('sans ticket à montrer, rien ne se joue', async () => {
    const { etats } = monter()
    // L'état donné au moteur dit l'avatar posé : c'est le rendu où le rattrapage se décide.
    await waitFor(() => expect(etats.length).toBeGreaterThan(0))
    await act(async () => undefined)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // La fête ne couvre pas la marche : l'appareil a montré 1897, mon année en cours est 1898, et le
  // ticket de 1899 attend. Mutation : `anneeAvatar !== v.annee_en_cours` retiré de la garde
  // (`avancee` seule est encore nulle dans le rendu où la frontière la pose).
  it('pendant une avancée, la fête attend la fin de la marche', async () => {
    localStorage.setItem(`journal.carte.annee-vue.${SESSION.user.id}`, '1897')
    let arriver: () => void = () => undefined
    const f = moteurFactice()
    vi.mocked(f.moteur.marcher).mockImplementation(() => new Promise<void>((fin) => void (arriver = () => fin())))
    servir({ 'GET /api/auth/me': () => json(SESSION), 'GET /api/me/voyage': () => json(A_MONTRER), 'GET /api/me/voyage/tickets': () => json({ tickets: [] }), [MONTRE]: montre })
    render(
      <QueryClientProvider client={createQueryClient()}>
        <FabriqueMoteurContexte.Provider value={f.fabrique}>
          <MemoryRouter initialEntries={['/voyage']}>
            <App />
          </MemoryRouter>
        </FabriqueMoteurContexte.Provider>
      </QueryClientProvider>,
    )
    await waitFor(() => expect(f.moteur.marcher).toHaveBeenCalledWith(1898))
    await act(async () => undefined)
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => arriver())
    expect(await screen.findByRole('dialog', { name: '1898 est bouclée' })).toBeInTheDocument()
  })
})
