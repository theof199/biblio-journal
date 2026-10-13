import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../../App'
import type { CarteDeSerie, Membre, Telecommande, VuADeux } from '../../api/feuilleton'
import { createQueryClient } from '../../api/queryClient'
import { exemple } from '../../test/contrat'
import { json, servir } from '../../test/serveur'

await import('../Feuilleton')
await import('../../maison/Maison')
await import('./Panneau')

const SESSION = exemple<{ user: Membre }>('/auth/me', 'get', 200)
const EXEMPLE = exemple<Telecommande>('/me/feuilleton/telecommande', 'get', 200)
const INVITATION_FAITE = exemple<VuADeux>('/me/feuilleton/vus-a-deux', 'post', 201)
const COCHE = exemple<unknown>('/episodes/{id}/watched', 'put', 200)

/** Mercredi 14 octobre 2026, 21 h à Paris. */
const SOIR = new Date('2026-10-14T19:00:00Z')

/** Dark : S2 E5 à voir, S2 E6 ensuite. */
const DARK = EXEMPLE.series[0]!
const ANDOR: CarteDeSerie = { ...DARK, id: 'd0000000-0000-4000-8000-0000000000a1', titre: 'Andor', vignette: null, dernier_visionnage_le: '2026-10-10T19:00:00.000Z' }
const DEUX: Telecommande = { a_confirmer: [], series: [DARK, ANDOR] }
/** Ce que l'API rend après la coche : Dark a avancé. */
const APRES: Telecommande = { a_confirmer: [], series: [{ ...DARK, prochain: DARK.ensuite, ensuite: null, dernier_visionnage_le: SOIR.toISOString() }, ANDOR] }

const MOI = SESSION.user
const membre = (n: number, pseudo: string, autres: Partial<Membre> = {}): Membre => ({ ...MOI, id: `${n}${n}${n}${n}${n}${n}${n}${n}-0000-4000-8000-000000000000`, pseudo, identity_color: `#${n}0${n}0${n}0`, role: 'user', ...autres })
const BOB = membre(2, 'bob')
const CAMILLE = membre(3, 'camille')
const DENIS = membre(4, 'denis', { deactivated: true })
const HUGO = membre(5, 'hugo')
const page = (membres: Membre[], next_cursor: string | null = null) => json({ items: membres.map((user) => ({ user, following_count: 0, followers_count: 0, tracked_count: 0, followed_by_me: false, joined_at: '2026-01-12T09:00:00.000Z' })), next_cursor })

const LIRE = 'GET /api/me/feuilleton/telecommande'
const MEMBRES = 'GET /api/users?limit=100'
const VU = `PUT /api/episodes/${DARK.prochain!.id}/watched`
const INVITER = 'POST /api/me/feuilleton/vus-a-deux'
const CLE = `journal.feuilleton.vu-a-deux.dernier.${MOI.id}`
const refus = (status: number, message: string) => json({ code: status === 404 ? 'NOT_FOUND' : status === 409 ? 'CONFLICT' : 'INTERNAL', message, retryable: false }, status)

function Ou() {
  const { pathname, search } = useLocation()
  return <span data-testid="adresse">{pathname + search}</span>
}
const adresse = () => screen.getByTestId('adresse').textContent

type Routes = Parameters<typeof servir>[0]
/** Monte l'app sur la télécommande ouverte. `corps` garde ce que chaque écriture a envoyé. */
function monter(routes: Routes, vue = 'telecommande') {
  const corps: unknown[] = []
  const noter: Routes = Object.fromEntries(
    Object.entries(routes).map(([cle, route]) => [
      cle,
      (init: RequestInit) => {
        if (init.body) corps.push(JSON.parse(String(init.body)))
        return route(init)
      },
    ]),
  )
  const requetes = servir({ 'GET /api/auth/me': () => json(SESSION), ...noter })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[`/feuilleton/maison?telecommande=${vue}`]}>
        <App />
        <Ou />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { requetes, corps, ecritures: () => requetes.filter((requete) => !requete.startsWith('GET ')) }
}

const ecran = () => document.querySelector<HTMLElement>('[data-piece="ecran"]')!
const message = () => document.querySelector<HTMLElement>('[data-piece="message"]')
const choix = () => screen.findByRole('list', { name: 'À qui le proposer' })
/** Ce que dit chaque touche, sans son monogramme : le pseudo, puis sa marque s'il en a une. */
const pseudos = async () =>
  within(await choix())
    .getAllByRole('button')
    .map((bouton) => [...bouton.querySelectorAll(':scope > span:not([data-piece])')].map((texte) => texte.textContent).join(' · '))
/** De la télécommande à la vue « vu à deux », pour la série à l'écran. */
async function ouvrirLeVuADeux() {
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Vu à deux' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Vu à deux' }))
  return screen.findByRole('heading', { level: 2, name: 'Vu à deux' })
}
const choisir = async (pseudo: string) => fireEvent.click(within(await choix()).getByRole('button', { name: new RegExp(`^${pseudo}`) }))
/** Une réponse retenue : la requête est partie, rien n'est revenu. */
function retenue() {
  let rendre!: (reponse: Response) => void
  const promesse = new Promise<Response>((resolve) => (rendre = resolve))
  return { promesse, rendre }
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn())
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(SOIR)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('le vu à deux : le choix du membre', () => {
  // Mutations, dans `donnees.ts` : `useLesMembres()` appelé par `useLaTelecommande` ; dans `Panneau.tsx` :
  // `<VueADeux>` monté sur toute vue (les membres se liraient à l'ouverture du panneau).
  it('les membres ne se lisent qu’à l’ouverture de la vue : aucune lecture de plus au montage du Feuilleton, ni à l’ouverture du panneau', async () => {
    const { requetes } = monter({ [LIRE]: () => json(DEUX), [MEMBRES]: () => page([MOI, BOB]) })
    await screen.findByRole('heading', { level: 3, name: 'Dark' })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(requetes).toEqual(['GET /api/auth/me', LIRE])

    await ouvrirLeVuADeux()
    await choix()
    expect(requetes).toEqual(['GET /api/auth/me', LIRE, MEMBRES])
  })

  // Mutations, dans `VueADeux.tsx` : le filtre `membre.id !== user.id` ôté ; dans `api/feuilleton.ts` : le
  // filtre `!membre.deactivated` ôté ; la boucle arrêtée à la première page (`while (false)`) ; le curseur non renvoyé.
  it('l’épisode à l’écran, et tous les membres, pages suivies par leur curseur : sans moi, sans les comptes désactivés, chacun son monogramme à sa couleur', async () => {
    const { requetes } = monter({ [LIRE]: () => json(DEUX), [MEMBRES]: () => page([MOI, BOB, DENIS], 'c1'), [`${MEMBRES}&cursor=c1`]: () => page([CAMILLE]) })
    await ouvrirLeVuADeux()

    expect(await pseudos()).toEqual(['bob', 'camille'])
    expect(requetes.slice(2)).toEqual([MEMBRES, `${MEMBRES}&cursor=c1`])
    expect(adresse()).toBe(`/feuilleton/maison?telecommande=a-deux-${DARK.id}`)
    expect(ecran()).toHaveTextContent('Tu l’as vu avec qui ?')
    expect(ecran()).toHaveTextContent('Dark')
    expect(ecran()).toHaveTextContent('S2 E5')
    const monogramme = within(await choix()).getByRole('button', { name: /^camille/ }).querySelector<HTMLElement>('[data-piece="monogramme"]')!
    expect(monogramme).toHaveTextContent('C')
    expect(monogramme.style.getPropertyValue('--identite')).toBe(CAMILLE.identity_color)
    expect(document.querySelector('[data-dernier]')).toBeNull()
    expect(screen.queryByText('La dernière fois')).toBeNull()
  })

  // Mutations, dans `VueADeux.tsx` : `ranges` rendu à `autres` (l'ordre servi) ; la marque rendue sur tous ;
  // dans `memoire.ts` : la clé lue sans le membre connecté (`cle('')`).
  it('le dernier choisi sur cet appareil vient en premier, et lui seul est marqué', async () => {
    localStorage.setItem(CLE, HUGO.id)
    localStorage.setItem('journal.feuilleton.vu-a-deux.dernier.un-autre-compte', CAMILLE.id)
    monter({ [LIRE]: () => json(DEUX), [MEMBRES]: () => page([MOI, BOB, CAMILLE, HUGO]) })
    await ouvrirLeVuADeux()

    expect(await pseudos()).toEqual(['hugo · La dernière fois', 'bob', 'camille'])
    expect(document.querySelectorAll('[data-dernier]')).toHaveLength(1)
  })

  // Mutations, dans `VueADeux.tsx` : la phrase ôtée (une liste vide, sans un mot) ; le filtre de soi ôté
  // (on se proposerait à soi-même).
  it('aucun autre membre : une phrase, aucune touche à choisir', async () => {
    monter({ [LIRE]: () => json(DEUX), [MEMBRES]: () => page([MOI, DENIS]) })
    await ouvrirLeVuADeux()

    expect(await screen.findByText(/Personne d’autre ici pour l’instant/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'À qui le proposer' })).toBeNull()
  })

  // Mutation, dans `VueADeux.tsx` : `ranges.length === 0` remplacé par `ranges.length <= 1`.
  it('un seul autre membre : il se propose, seul', async () => {
    monter({ [LIRE]: () => json(DEUX), [MEMBRES]: () => page([MOI, BOB]) })
    await ouvrirLeVuADeux()

    expect(await pseudos()).toEqual(['bob'])
  })

  // Mutations, dans `VueADeux.tsx` : la branche `membres.isError` ôtée ; « Réessayer » sans `refetch`.
  it('la lecture des membres échoue : le message de l’API et « Réessayer », qui relit', async () => {
    let essais = 0
    monter({ [LIRE]: () => json(DEUX), [MEMBRES]: () => (++essais === 1 ? refus(500, 'Le service est indisponible. Réessaie plus tard.') : page([MOI, BOB])) })
    await ouvrirLeVuADeux()

    const panne = await screen.findByRole('alert')
    expect(panne).toHaveTextContent('Le service est indisponible. Réessaie plus tard.')
    fireEvent.click(within(panne).getByRole('button', { name: 'Réessayer' }))
    expect(await pseudos()).toEqual(['bob'])
  })

  // Mutation, dans `VueADeux.tsx` : la condition `serie && episode` ôtée des membres (on proposerait un épisode qui n'existe pas).
  it('ouverte par son adresse sur une série à jour : une phrase, et personne à choisir', async () => {
    const { requetes } = monter({ [LIRE]: () => json({ a_confirmer: [], series: [{ ...DARK, prochain: null, ensuite: null, a_jour: true }] }), [MEMBRES]: () => page([MOI, BOB]) }, `a-deux-${DARK.id}`)

    expect(await screen.findByText('Dark est à jour : aucun épisode à proposer.')).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByRole('list', { name: 'À qui le proposer' })).toBeNull()
    expect(requetes.filter((requete) => !requete.startsWith('GET '))).toEqual([])
  })
})

describe('le vu à deux : proposer', () => {
  // Mutations, dans `vivante.ts` : l'ordre des deux appels de `aDeux` inversé ; `pour: pour.id` remplacé par
  // `pour: pour.pseudo` ; `ecrire(avancer…)` ôté de son `onMutate` (la carte attendrait la réponse) ; les deux
  // appels lancés ensemble (`Promise.all` : l'invitation partirait avant que la coche soit rendue) ; dans
  // `VueADeux.tsx` : `onFait()` ôté (on resterait sur le choix) ; `noterLeDernierChoisi` ôté.
  it('choisir un membre coche l’épisode PUIS l’invite ; la carte avance et « Proposé à bob » se dit AVANT toute réponse ; le choix est retenu, lui seul', async () => {
    const coche = retenue()
    let lectures = 0
    const { corps, ecritures } = monter({ [LIRE]: () => json(++lectures === 1 ? DEUX : APRES), [MEMBRES]: () => page([MOI, BOB, CAMILLE]), [VU]: () => coche.promesse, [INVITER]: () => json(INVITATION_FAITE, 201) })
    await ouvrirLeVuADeux()

    await choisir('bob')

    await vi.waitFor(() => expect(adresse()).toBe('/feuilleton/maison?telecommande=telecommande'))
    await vi.waitFor(() => expect(ecran()).toHaveTextContent('S2 E6'))
    expect(ecran()).toHaveTextContent('Dark')
    expect(ecran()).toHaveTextContent('1 sur 2')
    expect(message()).toHaveTextContent('Proposé à bob · S2 E5')
    expect(message()).toHaveAttribute('role', 'status')
    expect(within(message()!).getByRole('button', { name: 'Annuler' })).toBeEnabled()
    // La coche est partie, seule : l'invitation attend sa réponse.
    expect(ecritures()).toEqual([VU])
    expect(lectures).toBe(1)
    expect(localStorage.getItem(CLE)).toBe(BOB.id)
    expect(localStorage).toHaveLength(1)

    coche.rendre(json(COCHE))
    await vi.waitFor(() => expect(ecritures()).toEqual([VU, INVITER]))
    expect(corps).toEqual([{ watched: true }, { episode_id: DARK.prochain!.id, pour: BOB.id }])
    await vi.waitFor(() => expect(lectures).toBe(2))
    expect(message()).toHaveTextContent('Proposé à bob · S2 E5')
    expect(ecran()).toHaveTextContent('S2 E6')
  })

  // Mutations, dans `VueTelecommande.tsx` : `onAnnuler={annulerLAvis(…)}` ôté de l'avis (« Proposé » serait
  // sans « Annuler ») ; dans `vivante.ts` : `annuler: vu` ôté de son `dire` ; `dernierVu.current = …` ôté de
  // `onProposer` (« Annuler » ne déferait rien).
  it('« Annuler » après « Proposé à bob » décoche l’épisode, après les deux écritures : l’écran revient à l’épisode d’avant', async () => {
    const coche = retenue()
    let ecrits = 0
    const { corps, ecritures } = monter({ [LIRE]: () => json(DEUX), [MEMBRES]: () => page([MOI, BOB]), [VU]: () => (++ecrits === 1 ? coche.promesse : json(COCHE)), [INVITER]: () => json(INVITATION_FAITE, 201) })
    await ouvrirLeVuADeux()
    await choisir('bob')
    await vi.waitFor(() => expect(ecran()).toHaveTextContent('S2 E6'))
    expect(message()).toHaveTextContent('Proposé à bob')

    fireEvent.click(within(message()!).getByRole('button', { name: 'Annuler' }))

    await vi.waitFor(() => expect(ecran()).toHaveTextContent('S2 E5'))
    expect(message()).toBeNull()
    // « Annuler » est dans la file : il part après la coche ET l'invitation, que décocher retire côté API.
    expect(ecritures()).toEqual([VU])
    coche.rendre(json(COCHE))
    await vi.waitFor(() => expect(ecritures()).toEqual([VU, INVITER, VU]))
    expect(corps).toEqual([{ watched: true }, { episode_id: DARK.prochain!.id, pour: BOB.id }, { watched: false }])
  })

  // Mutations, dans `vivante.ts` : le `try` de l'invitation étendu à la coche (son échec passerait pour un
  // refus : rien ne reviendrait en arrière, et l'invitation partirait) ; la photo non reposée dans `onError` de `aDeux`.
  it('la coche échoue : rien n’est proposé, l’écran revient en arrière, et le message de l’API remplace « Proposé »', async () => {
    const coche = retenue()
    const relecture = retenue()
    let lectures = 0
    const { ecritures } = monter({ [LIRE]: () => (++lectures === 1 ? json(DEUX) : relecture.promesse), [MEMBRES]: () => page([MOI, BOB]), [VU]: () => coche.promesse, [INVITER]: () => json(INVITATION_FAITE, 201) })
    await ouvrirLeVuADeux()
    await choisir('bob')
    await vi.waitFor(() => expect(ecran()).toHaveTextContent('S2 E6'))

    coche.rendre(refus(500, 'Le service est indisponible. Réessaie plus tard.'))

    await vi.waitFor(() => expect(message()).toHaveTextContent('Le service est indisponible. Réessaie plus tard.'))
    expect(message()).toHaveAttribute('role', 'alert')
    expect(within(message()!).queryByRole('button')).toBeNull()
    // Le retour arrière n'attend pas la relecture, qui n'a pas encore répondu.
    await vi.waitFor(() => expect(lectures).toBe(2))
    expect(ecran()).toHaveTextContent('S2 E5')
    expect(ecritures()).toEqual([VU])
    relecture.rendre(json(DEUX))
  })

  // Mutations, dans `vivante.ts` : `return refus` remplacé par `throw refus` (la coche serait défaite à
  // l'écran alors qu'elle est faite) ; `dejaRecu(refus) ? … :` ôté (le `409` dirait le message de l'API) ;
  // `if (refus) dire(…)` ôté (« Proposé à bob » resterait, faux).
  it('la coche passe, l’invitation répond `409` : l’épisode reste coché, « Épisode noté, mais bob l’a déjà reçu »', async () => {
    let lectures = 0
    const { ecritures } = monter({ [LIRE]: () => json(++lectures === 1 ? DEUX : APRES), [MEMBRES]: () => page([MOI, BOB]), [VU]: () => json(COCHE), [INVITER]: () => refus(409, 'Tu as déjà proposé cet épisode à ce membre.') })
    await ouvrirLeVuADeux()
    await choisir('bob')

    await vi.waitFor(() => expect(message()).toHaveTextContent('Épisode noté, mais bob l’a déjà reçu'))
    expect(message()).toHaveAttribute('role', 'alert')
    expect(within(message()!).queryByRole('button')).toBeNull()
    await vi.waitFor(() => expect(lectures).toBe(2))
    expect(ecran()).toHaveTextContent('S2 E6')
    expect(ecritures()).toEqual([VU, INVITER])
  })

  // Mutation, dans `vivante.ts` : `dejaRecu` étendu à toute `ApiError` (un `404` dirait « l'a déjà reçu »).
  it.each([
    ['un `404`', () => refus(404, 'Ce membre est introuvable.'), 'Ce membre est introuvable.'],
    ['une panne de réseau', () => Promise.reject(new TypeError('Failed to fetch')), /.+/],
  ] as [string, () => Response | Promise<Response>, string | RegExp][])('la coche passe, l’invitation tombe sur %s : l’épisode reste coché, et le message de l’erreur le remplace', async (_cas, invitation, texte) => {
    let lectures = 0
    const { ecritures } = monter({ [LIRE]: () => json(++lectures === 1 ? DEUX : APRES), [MEMBRES]: () => page([MOI, BOB]), [VU]: () => json(COCHE), [INVITER]: invitation })
    await ouvrirLeVuADeux()
    await choisir('bob')

    await vi.waitFor(() => expect(message()).toHaveAttribute('role', 'alert'))
    expect(message()).toHaveTextContent(texte)
    expect(message()).not.toHaveTextContent(/Proposé|déjà reçu/)
    await vi.waitFor(() => expect(lectures).toBe(2))
    expect(ecran()).toHaveTextContent('S2 E6')
    expect(ecritures()).toEqual([VU, INVITER])
  })

  // Mutation, dans `Panneau.tsx` : `onVuADeux` sans la série de l'écran (`{ nom: 'a-deux' }` : on proposerait Dark).
  it('depuis une autre série du parcours, c’est son épisode qui se propose, et elle qui reste à l’écran', async () => {
    const vuDAndor = `PUT /api/episodes/aaaaaaaa-0000-4000-8000-0000000000f1/watched`
    const andor: CarteDeSerie = { ...ANDOR, prochain: { ...DARK.prochain!, id: 'aaaaaaaa-0000-4000-8000-0000000000f1', saison: 1, numero: 9 }, ensuite: { ...DARK.ensuite!, id: 'aaaaaaaa-0000-4000-8000-0000000000f2', saison: 1, numero: 10 } }
    const reponse = retenue()
    const { corps, ecritures } = monter({ [LIRE]: () => json({ a_confirmer: [], series: [DARK, andor] }), [MEMBRES]: () => page([MOI, BOB]), [vuDAndor]: () => json(COCHE), [INVITER]: () => reponse.promesse })
    await screen.findByRole('heading', { level: 3, name: 'Dark' })
    fireEvent.click(screen.getByRole('button', { name: 'Série suivante' }))
    await ouvrirLeVuADeux()
    expect(ecran()).toHaveTextContent('Andor')
    expect(ecran()).toHaveTextContent('S1 E9')

    await choisir('bob')

    await vi.waitFor(() => expect(ecritures()).toEqual([vuDAndor, INVITER]))
    expect(corps[1]).toEqual({ episode_id: 'aaaaaaaa-0000-4000-8000-0000000000f1', pour: BOB.id })
    expect(ecran()).toHaveTextContent('Andor')
    expect(ecran()).toHaveTextContent('S1 E10')
    expect(message()).toHaveTextContent('Proposé à bob · S1 E9')
  })
})
