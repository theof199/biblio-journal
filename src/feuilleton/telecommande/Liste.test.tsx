import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../../App'
import type { CarteDeSerie, Confirmation, EpisodeDeCarte, Telecommande, VuADeux } from '../../api/feuilleton'
import { createQueryClient } from '../../api/queryClient'
import { exemple } from '../../test/contrat'
import { json, servir } from '../../test/serveur'

await import('../Feuilleton')
await import('../../maison/Maison')
await import('./Panneau')

const SESSION = exemple<unknown>('/auth/me', 'get', 200)
const EXEMPLE = exemple<Telecommande>('/me/feuilleton/telecommande', 'get', 200)
const CONFIRMATION = exemple<Confirmation>('/me/feuilleton/vus-a-deux/{id}/confirmer', 'post', 200)
const REFUS = exemple<VuADeux>('/me/feuilleton/vus-a-deux/{id}/refuser', 'post', 200)
const COCHE = exemple<unknown>('/episodes/{id}/watched', 'put', 200)

/** Mercredi 14 octobre 2026, 21 h à Paris. */
const SOIR = new Date('2026-10-14T19:00:00Z')

const INVITATION = EXEMPLE.a_confirmer[0]!
const DARK = EXEMPLE.series[0]!
/** En pause, à jour. */
const SEVERANCE = EXEMPLE.series[1]!
const episode = (id: string, saison: number, numero: number, titre: string): EpisodeDeCarte => ({ ...DARK.prochain!, id, saison, numero, titre })
const serie = (n: number, titre: string, le: string, autres: Partial<CarteDeSerie> = {}): CarteDeSerie => ({
  ...DARK,
  id: `d0000000-0000-4000-8000-0000000000a${n}`,
  titre,
  vignette: null,
  dernier_visionnage_le: le,
  prochain: episode(`aaaaaaaa-0000-4000-8000-0000000000${n}1`, 1, 3, `${titre}, le troisième`),
  ensuite: episode(`aaaaaaaa-0000-4000-8000-0000000000${n}2`, 1, 4, `${titre}, le quatrième`),
  ...autres,
})
const ANDOR = serie(1, 'Andor', '2026-10-10T19:00:00.000Z')
const SLOW = serie(2, 'Slow Horses', '2026-10-08T19:00:00.000Z', { prochain: null, ensuite: null, a_jour: true, prochaine_diffusion_le: '2026-10-21' })
/** Ajoutée ce matin, rien de vu : `repere: suivi`. Elle serait en tête chez l'API ; ici l'ordre reçu fait foi. */
const BEAR = serie(3, 'The Bear', '2026-10-14T08:00:00.000Z', { repere: 'suivi', prochain: episode('aaaaaaaa-0000-4000-8000-000000000031', 1, 1, 'Système') })
const LEGENDES = serie(4, 'Le Bureau des légendes', '2026-07-01T19:00:00.000Z', { en_pause: true })
/** Quatre séries en cours, deux en pause mêlées à elles, une invitation. */
const TOUT: Telecommande = { a_confirmer: [INVITATION], series: [DARK, ANDOR, LEGENDES, SLOW, SEVERANCE, BEAR] }
const SANS_INVITATION: Telecommande = { ...TOUT, a_confirmer: [] }

const LIRE = 'GET /api/me/feuilleton/telecommande'
const vuDe = (carte: CarteDeSerie) => `PUT /api/episodes/${carte.prochain!.id}/watched`
const CONFIRMER = `POST /api/me/feuilleton/vus-a-deux/${INVITATION.id}/confirmer`
const REFUSER = `POST /api/me/feuilleton/vus-a-deux/${INVITATION.id}/refuser`
const refus = (status: number, message: string) => json({ code: status === 404 ? 'NOT_FOUND' : status === 409 ? 'CONFLICT' : 'INTERNAL', message, retryable: false }, status)

/** L'adresse affichée, et le geste « retour » du téléphone, que la page ne dessine pas. */
let historique!: NavigateFunction
function Ou() {
  historique = useNavigate()
  const { pathname, search } = useLocation()
  return <span data-testid="adresse">{pathname + search}</span>
}
const adresse = () => screen.getByTestId('adresse').textContent

type Routes = Parameters<typeof servir>[0]
/** Monte l'app sur la liste ouverte. `corps` garde ce que chaque écriture a envoyé. */
function monter(routes: Routes, vue = 'en-cours') {
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

const dialogue = () => screen.getByRole('dialog')
const section = (nom: 'En cours' | 'En pause') => screen.findByRole('list', { name: nom })
/** Les titres des cartes d'une section, dans l'ordre montré. */
const titres = (nom: 'En cours' | 'En pause') => within(screen.getByRole('list', { name: nom })).getAllByRole('heading', { level: 3 }).map((titre) => titre.textContent)
const carte = (titre: string) => screen.getByRole('heading', { level: 3, name: titre }).closest<HTMLElement>('li')!
const repli = () => screen.getByRole('button', { name: /^En pause/ })
const ecran = () => document.querySelector<HTMLElement>('[data-piece="ecran"]')!
/** Toucher ailleurs, d'un geste entier : le doigt se pose, puis se lève. */
const toucherAilleurs = () => {
  fireEvent.pointerDown(document.body)
  fireEvent.pointerUp(document.body)
}
const unInstant = () => new Promise((resolve) => setTimeout(resolve, 20))
/** Une réponse retenue : la requête est partie, rien n'est revenu. */
function retenue() {
  let rendre!: (reponse: Response) => void
  const promesse = new Promise<Response>((resolve) => (rendre = resolve))
  return { promesse, rendre }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(SOIR)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('la liste : ses sections', () => {
  // Mutations, dans `VueListe.tsx` : le bloc « À confirmer » rendu après « En cours » ; « Ajouter une série »
  // rendu en tête ; dans `vivante.ts` : `enCours.map` remplacé par `telecommande.series.map` (les séries en
  // pause seraient en cours) ; `invitations` vidé.
  it('« À confirmer », « En cours », « En pause » repliée, « Ajouter une série », dans cet ordre ; chaque section a son compte', async () => {
    monter({ [LIRE]: () => json(TOUT) })
    await section('En cours')

    expect(screen.getAllByRole('heading', { level: 2 }).map((titre) => titre.textContent)).toEqual(['À confirmer 1', 'En cours 4'])
    expect(repli()).toHaveTextContent('En pause 2')
    const texte = dialogue().textContent!
    const rangs = ['À confirmer', 'En cours', 'En pause', 'Ajouter une série'].map((mot) => texte.indexOf(mot))
    expect(rangs).toEqual([...rangs].sort((a, b) => a - b))
    expect(rangs[0]).toBeGreaterThan(-1)
    expect(titres('En cours')).toEqual(['Dark', 'Andor', 'Slow Horses', 'The Bear'])
    expect(screen.getByRole('button', { name: 'Retour : Télécommande' })).toBeInTheDocument()
  })

  // Mutations, dans `VueListe.tsx` : `invitation.de` remplacé par `invitation.serie` ; `invitation.quand` non
  // rendu ; dans `Monogramme.tsx`, `--identite` non posée.
  it('une invitation : qui, quoi, quand, son monogramme à sa couleur, « Confirmer » et « Refuser »', async () => {
    monter({ [LIRE]: () => json(TOUT) })
    await section('En cours')

    const invitation = document.querySelector<HTMLElement>('[data-etat="invitation"]')!
    expect(invitation).toHaveTextContent('bob a vu Dark S2 E5 avec toi')
    expect(invitation).toHaveTextContent('Proposé hier soir')
    const monogramme = invitation.querySelector<HTMLElement>('[data-piece="monogramme"]')!
    expect(monogramme).toHaveTextContent('B')
    expect(monogramme.style.getPropertyValue('--identite')).toBe('#3A7CA5')
    expect(within(invitation).getByRole('button', { name: 'Confirmer' })).toBeEnabled()
    expect(within(invitation).getByRole('button', { name: 'Refuser' })).toBeEnabled()
  })

  // Mutations, dans `VueListe.tsx` : `serie.nouvelle &&` ôté (toute carte dirait quand) ; dans `vivante.ts` :
  // `nouvelle` posé à `false` ; le code de l'épisode remplacé par celui d'`ensuite`.
  it('une carte : le titre, « S1 E3 · titre de l’épisode », « Vu » et « ⋯ » ; une série juste ajoutée le dit, les autres non', async () => {
    monter({ [LIRE]: () => json(SANS_INVITATION) })
    await section('En cours')

    expect(carte('Andor')).toHaveTextContent('S1 E3')
    expect(carte('Andor')).toHaveTextContent('Andor, le troisième')
    expect(carte('Andor')).not.toHaveTextContent(/Regardée|Ajoutée/)
    expect(within(carte('Andor')).getByRole('button', { name: 'Vu : Andor, S1 E3' })).toBeEnabled()
    expect(within(carte('Andor')).getByRole('button', { name: 'Régler la télécommande sur Andor' })).toBeEnabled()
    expect(carte('The Bear')).toHaveTextContent('Ajoutée aujourd’hui')
    expect(carte('The Bear')).toHaveTextContent('S1 E1')
    expect(screen.queryByRole('heading', { level: 2, name: /À confirmer/ })).toBeNull()
  })

  // Mutations, dans `VueListe.tsx` : « Vu » rendu sans regarder `serie.episode` ; la note rendue sans
  // regarder `serie.diffusion` ; dans `vivante.ts` : `diffusion` non passé.
  it('une carte à jour : pas de « Vu », « Prochain épisode le 21 octobre » si la date est connue, rien sinon, et toujours « ⋯ »', async () => {
    monter({ [LIRE]: () => json({ a_confirmer: [], series: [SLOW, { ...ANDOR, prochain: null, ensuite: null, a_jour: true, prochaine_diffusion_le: null }] }) })
    await section('En cours')

    expect(carte('Slow Horses')).toHaveTextContent('À jour')
    expect(carte('Slow Horses')).toHaveTextContent('Prochain épisode le 21 octobre')
    expect(within(carte('Slow Horses')).queryByRole('button', { name: /^Vu/ })).toBeNull()
    expect(within(carte('Slow Horses')).getByRole('button', { name: 'Régler la télécommande sur Slow Horses' })).toBeEnabled()
    expect(carte('Andor')).toHaveTextContent('À jour')
    expect(carte('Andor')).not.toHaveTextContent('Prochain épisode')
    expect(within(carte('Andor')).queryByRole('button', { name: /^Vu/ })).toBeNull()
  })

  // Mutations, dans `VueListe.tsx` : `useState(true)` pour `deplie` ; `aria-expanded` figé ; `hidden={!deplie}`
  // ôté (les cartes se verraient, repliées) ; `setDeplie(true)` (elle ne se replierait plus).
  it('« En pause » est repliée, se déplie sur les mêmes cartes, et se replie', async () => {
    monter({ [LIRE]: () => json(TOUT) })
    await section('En cours')

    expect(repli()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('heading', { level: 3, name: 'Le Bureau des légendes' })).toBeNull()

    fireEvent.click(repli())
    expect(repli()).toHaveAttribute('aria-expanded', 'true')
    expect(titres('En pause')).toEqual(['Le Bureau des légendes', 'Severance'])
    expect(document.getElementById(repli().getAttribute('aria-controls')!)).toBe(screen.getByRole('list', { name: 'En pause' }))
    expect(within(carte('Le Bureau des légendes')).getByRole('button', { name: 'Vu : Le Bureau des légendes, S1 E3' })).toBeEnabled()
    expect(within(carte('Severance')).getByRole('button', { name: 'Régler la télécommande sur Severance' })).toBeEnabled()
    expect(titres('En cours')).toEqual(['Dark', 'Andor', 'Slow Horses', 'The Bear'])

    fireEvent.click(repli())
    expect(repli()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('heading', { level: 3, name: 'Severance' })).toBeNull()
  })

  // Mutation, dans `VueListe.tsx` : « Ajouter une série » mené à `en-cours`.
  it('« Ajouter une série » mène à la vue `ajouter`', async () => {
    monter({ [LIRE]: () => json(TOUT) })
    await section('En cours')

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une série' }))
    expect(adresse()).toBe('/feuilleton/maison?telecommande=ajouter')
  })
})

describe('la liste : l’attente, la panne, le vide', () => {
  // Mutations, dans `VueListe.tsx` : la branche `attente` ôtée (la liste vide se dirait pendant la lecture) ;
  // `FANTOMES` à 0.
  it('pendant la lecture : des cartes fantômes à la forme des vraies, aucune phrase de liste vide', async () => {
    const lecture = retenue()
    monter({ [LIRE]: () => lecture.promesse })

    expect(await screen.findByText('La liste arrive…')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-piece="ecran"][data-etat="attente"]')).toHaveLength(3)
    expect(dialogue()).not.toHaveTextContent('Aucune série')
    expect(screen.queryByRole('button', { name: 'Ajouter une série' })).toBeNull()

    lecture.rendre(json(TOUT))
    await section('En cours')
    expect(screen.queryByText('La liste arrive…')).toBeNull()
  })

  // Mutations, dans `vivante.ts` : `liste.lecture` rendu `attente` sur une panne ; `onReessayer` ôté de `liste`.
  it('une lecture qui échoue : le message de l’API et « Réessayer », qui relit', async () => {
    let essais = 0
    const { requetes } = monter({ [LIRE]: () => (++essais === 1 ? refus(500, 'Le service est indisponible. Réessaie plus tard.') : json(TOUT)) })

    const panne = await screen.findByRole('alert')
    expect(panne).toHaveTextContent('Le service est indisponible. Réessaie plus tard.')
    fireEvent.click(within(panne).getByRole('button', { name: 'Réessayer' }))

    await section('En cours')
    expect(requetes.filter((requete) => requete === LIRE)).toHaveLength(2)
  })

  // Mutations, dans `VueListe.tsx` : la phrase ôtée ; « Ajouter une série » rendu seulement s'il y a des séries.
  it('aucune série : une phrase, et « Ajouter une série »', async () => {
    monter({ [LIRE]: () => json({ a_confirmer: [], series: [] }) })

    expect(await screen.findByText(/Aucune série suivie pour l’instant/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('En cours 0')
    expect(screen.queryByRole('button', { name: /^En pause/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une série' }))
    expect(adresse()).toBe('/feuilleton/maison?telecommande=ajouter')
  })
})

describe('« Vu » sur une carte de la liste', () => {
  /** Ce que l'API rend après le « Vu » d'Andor : elle a avancé, et passe en tête. */
  const ANDOR_VU: CarteDeSerie = { ...ANDOR, prochain: ANDOR.ensuite, ensuite: episode('aaaaaaaa-0000-4000-8000-000000000013', 1, 5, 'Andor, le cinquième'), dernier_visionnage_le: SOIR.toISOString() }
  const APRES: Telecommande = { a_confirmer: [], series: [ANDOR_VU, DARK, LEGENDES, SLOW, SEVERANCE, BEAR] }

  // Mutations, dans `vivante.ts` : `carteDe` rendu à la seule carte de l'écran (`enCours[rang]` : rien ne
  // partirait d'Andor) ; `ecrire(avancer…)` ôté de `onMutate` (la carte attendrait la réponse) ; dans
  // `VueListe.tsx` : `messageDe(serie.id) ??` ôté (les touches resteraient) ; le message rendu sur toutes les cartes.
  it('coche son prochain épisode, la carte avance AVANT la réponse, et le message prend la place de SES touches', async () => {
    const reponse = retenue()
    let lectures = 0
    const { corps, ecritures } = monter({ [LIRE]: () => json(++lectures === 1 ? SANS_INVITATION : APRES), [vuDe(ANDOR)]: () => reponse.promesse })
    await section('En cours')

    fireEvent.click(within(carte('Andor')).getByRole('button', { name: 'Vu : Andor, S1 E3' }))

    await vi.waitFor(() => expect(carte('Andor')).toHaveTextContent('S1 E4'))
    expect(ecritures()).toEqual([vuDe(ANDOR)])
    expect(corps).toEqual([{ watched: true }])
    expect(lectures).toBe(1)
    const message = within(carte('Andor')).getByRole('status')
    expect(message).toHaveTextContent('Épisode noté')
    expect(within(message).getByRole('button', { name: 'Annuler' })).toBeEnabled()
    expect(within(carte('Andor')).queryByRole('button', { name: /^(Vu|Régler)/ })).toBeNull()
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(within(carte('Dark')).getByRole('button', { name: 'Vu : Dark, S2 E5' })).toBeEnabled()

    reponse.rendre(json(COCHE))
    await vi.waitFor(() => expect(lectures).toBe(2))
  })

  // Mutations, dans `VueListe.tsx` : `setFige(…)` ôté de `vu` (la carte filerait en tête sous le doigt, dès
  // l'écriture d'avance) ; `rendreLOrdre()` ôté du départ du message (l'ordre ne suivrait plus jamais).
  it('la carte ne se dérobe pas : elle garde sa place tant que son message est là, relecture comprise, et ne remonte en tête qu’après', async () => {
    let lectures = 0
    monter({ [LIRE]: () => json(++lectures === 1 ? SANS_INVITATION : APRES), [vuDe(ANDOR)]: () => json(COCHE) })
    await section('En cours')

    fireEvent.click(within(carte('Andor')).getByRole('button', { name: 'Vu : Andor, S1 E3' }))
    await vi.waitFor(() => expect(lectures).toBe(2))
    await unInstant()

    expect(titres('En cours')).toEqual(['Dark', 'Andor', 'Slow Horses', 'The Bear'])
    expect(within(carte('Andor')).getByRole('status')).toHaveTextContent('Épisode noté')
    expect(carte('Andor')).toHaveTextContent('S1 E4')

    toucherAilleurs()
    await vi.waitFor(() => expect(titres('En cours')).toEqual(['Andor', 'Dark', 'Slow Horses', 'The Bear']))
    expect(screen.queryByRole('status')).toBeNull()
  })

  // Mutations, dans `VueListe.tsx` : `if (doigt.current) aRendre.current = true` ôté (l'ordre suivrait dès le
  // doigt posé : la carte visée bougerait avant son `click`) ; `if (!tenu.current)` ôté (l'ordre suivrait
  // sous le message du second « Vu »).
  it('toucher une autre carte fait partir le message sans rien déplacer sous le doigt ; son « Vu » tient l’ordre à son tour', async () => {
    const reponse = retenue()
    monter({ [LIRE]: () => json(SANS_INVITATION), [vuDe(ANDOR)]: () => reponse.promesse, [vuDe(BEAR)]: () => reponse.promesse })
    await section('En cours')
    fireEvent.click(within(carte('Andor')).getByRole('button', { name: 'Vu : Andor, S1 E3' }))
    await vi.waitFor(() => expect(carte('Andor')).toHaveTextContent('S1 E4'))

    const vuDeBear = within(carte('The Bear')).getByRole('button', { name: 'Vu : The Bear, S1 E1' })
    fireEvent.pointerDown(vuDeBear)
    await unInstant()
    expect(within(carte('Andor')).queryByRole('status')).toBeNull()
    expect(titres('En cours')).toEqual(['Dark', 'Andor', 'Slow Horses', 'The Bear'])

    fireEvent.pointerUp(vuDeBear)
    fireEvent.click(vuDeBear)
    await vi.waitFor(() => expect(within(carte('The Bear')).getByRole('status')).toHaveTextContent('Épisode noté'))
    await unInstant()
    expect(titres('En cours')).toEqual(['Dark', 'Andor', 'Slow Horses', 'The Bear'])

    toucherAilleurs()
    await vi.waitFor(() => expect(titres('En cours')).toEqual(['The Bear', 'Andor', 'Dark', 'Slow Horses']))
  })

  // Mutations, dans `vivante.ts` : `client.setQueryData(cles.telecommande, contexte.avant)` ôté d'`onError` ;
  // `{ sujet: carte.id }` ôté de son `dire` (l'échec se dirait en tête de liste, loin de la carte).
  it('sur un échec la carte revient en arrière, et le message de l’API prend la place de ses touches', async () => {
    const reponse = retenue()
    monter({ [LIRE]: () => json(SANS_INVITATION), [vuDe(ANDOR)]: () => reponse.promesse })
    await section('En cours')

    fireEvent.click(within(carte('Andor')).getByRole('button', { name: 'Vu : Andor, S1 E3' }))
    await vi.waitFor(() => expect(carte('Andor')).toHaveTextContent('S1 E4'))
    reponse.rendre(refus(500, 'Le service est indisponible. Réessaie plus tard.'))

    const alerte = await within(carte('Andor')).findByRole('alert')
    expect(alerte).toHaveTextContent('Le service est indisponible. Réessaie plus tard.')
    expect(within(alerte).queryByRole('button')).toBeNull()
    expect(carte('Andor')).toHaveTextContent('S1 E3')
    expect(screen.queryByRole('status')).toBeNull()
    expect(titres('En cours')).toEqual(['Dark', 'Andor', 'Slow Horses', 'The Bear'])
  })

  // Mutations, dans `vivante.ts` : le retour arrière de `coche` rendu à une photo du cache prise dans
  // `onMutate` (l'échec de Dark déferait Andor en vol ; celui d'Andor reposerait Dark avancée).
  it('deux « Vu » à la file, tous deux en échec, relecture en échec aussi : chaque échec ne défait que SA carte', async () => {
    const dark = retenue()
    const andor = retenue()
    let lectures = 0
    monter({ [LIRE]: () => (++lectures === 1 ? json(SANS_INVITATION) : refus(500, 'Le service est indisponible. Réessaie plus tard.')), [vuDe(DARK)]: () => dark.promesse, [vuDe(ANDOR)]: () => andor.promesse })
    await section('En cours')
    fireEvent.click(within(carte('Dark')).getByRole('button', { name: 'Vu : Dark, S2 E5' }))
    await vi.waitFor(() => expect(carte('Dark')).toHaveTextContent('S2 E6'))
    fireEvent.click(within(carte('Andor')).getByRole('button', { name: 'Vu : Andor, S1 E3' }))
    await vi.waitFor(() => expect(carte('Andor')).toHaveTextContent('S1 E4'))

    // L'échec du premier pendant que le second attend : Andor, en vol, reste avancée.
    dark.rendre(refus(500, 'Dark a échoué.'))
    expect(await within(carte('Dark')).findByRole('alert')).toHaveTextContent('Dark a échoué.')
    expect(carte('Dark')).toHaveTextContent('S2 E5')
    expect(carte('Andor')).toHaveTextContent('S1 E4')

    // L'échec du second : Dark ne repart pas en avant.
    andor.rendre(refus(500, 'Andor a échoué.'))
    expect(await within(carte('Andor')).findByRole('alert')).toHaveTextContent('Andor a échoué.')
    await vi.waitFor(() => expect(lectures).toBeGreaterThan(1))
    await unInstant()
    expect(carte('Andor')).toHaveTextContent('S1 E3')
    expect(carte('Dark')).toHaveTextContent('S2 E5')
    expect(within(carte('Dark')).getByRole('button', { name: 'Vu : Dark, S2 E5' })).toBeEnabled()
  })

  // Mutations, dans `vivante.ts` : le retour arrière de `coche` rendu à une photo (celle d'« Annuler », prise
  // carte avancée, la reposerait avancée) ; un « Annuler » raté qui ré-avance la carte.
  it('« Vu » puis « Annuler » avant la réponse, tous deux en échec, relecture en échec aussi : la carte reste à l’épisode que rien n’a coché', async () => {
    const coche = retenue()
    const decoche = retenue()
    let ecrits = 0
    let lectures = 0
    const { ecritures } = monter({ [LIRE]: () => (++lectures === 1 ? json(SANS_INVITATION) : refus(500, 'Le service est indisponible. Réessaie plus tard.')), [vuDe(ANDOR)]: () => (++ecrits === 1 ? coche.promesse : decoche.promesse) })
    await section('En cours')
    fireEvent.click(within(carte('Andor')).getByRole('button', { name: 'Vu : Andor, S1 E3' }))
    await vi.waitFor(() => expect(carte('Andor')).toHaveTextContent('S1 E4'))
    fireEvent.click(within(carte('Andor')).getByRole('button', { name: 'Annuler' }))
    await vi.waitFor(() => expect(carte('Andor')).toHaveTextContent('S1 E3'))

    coche.rendre(refus(500, 'La coche a échoué.'))
    await vi.waitFor(() => expect(ecritures()).toHaveLength(2))
    expect(carte('Andor')).toHaveTextContent('S1 E3')
    decoche.rendre(refus(500, 'La décoche a échoué.'))
    await vi.waitFor(() => expect(within(carte('Andor')).getByRole('alert')).toHaveTextContent('La décoche a échoué.'))
    await vi.waitFor(() => expect(lectures).toBeGreaterThan(1))
    await unInstant()

    expect(carte('Andor')).toHaveTextContent('S1 E3')
    expect(titres('En cours')).toEqual(['Dark', 'Andor', 'Slow Horses', 'The Bear'])
  })

  // Mutation, dans `vivante.ts` : `cancelQueries` ôté de `coche.onMutate` (la relecture en vol, partie avant
  // le geste, reposerait la carte d'avant sur l'avance).
  it('une relecture en vol au moment du « Vu » ne repasse pas sur la carte avancée', async () => {
    const relecture = retenue()
    const andor = retenue()
    let lectures = 0
    const { ecritures } = monter({ [LIRE]: () => (++lectures === 1 ? json(SANS_INVITATION) : relecture.promesse), [vuDe(DARK)]: () => json(COCHE), [vuDe(ANDOR)]: () => andor.promesse })
    await section('En cours')
    fireEvent.click(within(carte('Dark')).getByRole('button', { name: 'Vu : Dark, S2 E5' }))
    await vi.waitFor(() => expect(lectures).toBe(2))

    fireEvent.click(within(carte('Andor')).getByRole('button', { name: 'Vu : Andor, S1 E3' }))
    await vi.waitFor(() => expect(carte('Andor')).toHaveTextContent('S1 E4'))
    // La relecture d'avant le geste répond enfin, avec Andor à son épisode d'avant.
    relecture.rendre(json(SANS_INVITATION))
    await vi.waitFor(() => expect(ecritures()).toEqual([vuDe(DARK), vuDe(ANDOR)]))
    await unInstant()

    expect(carte('Andor')).toHaveTextContent('S1 E4')
  })

  // Mutation, dans `vivante.ts` : la garde `isMutating(…) === 1` ôtée d'`onSettled` de `coche` (la relecture
  // partirait entre les deux écritures, et rendrait un état que la seconde n'a pas encore changé).
  it('deux « Vu » à la file : une seule relecture, après la dernière écriture', async () => {
    const dark = retenue()
    const andor = retenue()
    let lectures = 0
    const { ecritures } = monter({ [LIRE]: () => json(++lectures === 1 ? SANS_INVITATION : APRES), [vuDe(DARK)]: () => dark.promesse, [vuDe(ANDOR)]: () => andor.promesse })
    await section('En cours')
    fireEvent.click(within(carte('Dark')).getByRole('button', { name: 'Vu : Dark, S2 E5' }))
    fireEvent.click(within(carte('Andor')).getByRole('button', { name: 'Vu : Andor, S1 E3' }))
    await vi.waitFor(() => expect(ecritures()).toEqual([vuDe(DARK)]))

    dark.rendre(json(COCHE))
    await vi.waitFor(() => expect(ecritures()).toEqual([vuDe(DARK), vuDe(ANDOR)]))
    await unInstant()
    expect(lectures).toBe(1)

    andor.rendre(json(COCHE))
    await vi.waitFor(() => expect(lectures).toBe(2))
  })

  // Mutation, dans `vivante.ts` : `verrous.current.delete(carte.id)` ôté d'`onSettled` de `coche` (la carte
  // ne se cocherait plus jamais, jusqu'à la fermeture du panneau).
  it('le verrou se rend à la fin de l’écriture : la même carte se coche de nouveau', async () => {
    let lectures = 0
    const suivant = `PUT /api/episodes/${ANDOR.ensuite!.id}/watched`
    const { ecritures } = monter({ [LIRE]: () => json(++lectures === 1 ? SANS_INVITATION : APRES), [vuDe(ANDOR)]: () => json(COCHE), [suivant]: () => json(COCHE) })
    await section('En cours')
    fireEvent.click(within(carte('Andor')).getByRole('button', { name: 'Vu : Andor, S1 E3' }))
    await vi.waitFor(() => expect(lectures).toBe(2))
    toucherAilleurs()

    fireEvent.click(await within(carte('Andor')).findByRole('button', { name: 'Vu : Andor, S1 E4' }))

    await vi.waitFor(() => expect(ecritures()).toEqual([vuDe(ANDOR), suivant]))
  })

  // Mutation, dans `VueListe.tsx` : `rendreLOrdre()` ôté du départ de l'avis seul (l'ordre resterait figé
  // jusqu'à la fermeture de la liste).
  it('un avis sans carte (« Invitation refusée ») chasse le message d’une carte : à son départ, l’ordre suit les données', async () => {
    let lectures = 0
    const apres: Telecommande = { a_confirmer: [INVITATION], series: [ANDOR_VU, DARK, LEGENDES, SLOW, SEVERANCE, BEAR] }
    monter({ [LIRE]: () => json(++lectures === 1 ? TOUT : apres), [vuDe(ANDOR)]: () => json(COCHE), [REFUSER]: () => json(REFUS) })
    await section('En cours')
    fireEvent.click(within(carte('Andor')).getByRole('button', { name: 'Vu : Andor, S1 E3' }))
    await vi.waitFor(() => expect(lectures).toBe(2))
    expect(within(carte('Andor')).getByRole('status')).toHaveTextContent('Épisode noté')

    fireEvent.click(screen.getByRole('button', { name: 'Refuser' }))
    const avis = await screen.findByText('Invitation refusée', { selector: '[aria-hidden]' })
    expect(avis.closest('li')).toBeNull()
    expect(within(carte('Andor')).queryByRole('status')).toBeNull()
    expect(titres('En cours')).toEqual(['Dark', 'Andor', 'Slow Horses', 'The Bear'])

    toucherAilleurs()
    await vi.waitFor(() => expect(titres('En cours')).toEqual(['Andor', 'Dark', 'Slow Horses', 'The Bear']))
  })

  // Mutations, dans `VueListe.tsx` : `rendreLOrdre()` ôté du départ de l'avis seul ; `deplie ?` ôté de
  // `sujets` (l'avis d'une carte repliée se poserait sur une carte qu'on ne voit pas).
  it('l’échec d’une carte de « En pause » repliée se dit en tête de liste : à son départ, l’ordre suit les données', async () => {
    const reponse = retenue()
    let lectures = 0
    monter({ [LIRE]: () => json(++lectures === 1 ? SANS_INVITATION : APRES), [vuDe(LEGENDES)]: () => reponse.promesse })
    await section('En cours')
    fireEvent.click(repli())
    fireEvent.click(within(carte('Le Bureau des légendes')).getByRole('button', { name: /^Vu : Le Bureau des légendes/ }))
    await vi.waitFor(() => expect(within(carte('Le Bureau des légendes')).getByRole('status')).toHaveTextContent('Épisode noté'))
    fireEvent.click(repli())

    reponse.rendre(refus(500, 'Le service est indisponible. Réessaie plus tard.'))
    const alerte = await screen.findByRole('alert')
    expect(alerte.closest('li')).toBeNull()
    await vi.waitFor(() => expect(lectures).toBe(2))
    await unInstant()
    expect(titres('En cours')).toEqual(['Dark', 'Andor', 'Slow Horses', 'The Bear'])

    toucherAilleurs()
    await vi.waitFor(() => expect(titres('En cours')).toEqual(['Andor', 'Dark', 'Slow Horses', 'The Bear']))
  })

  // Mutations, dans `MessageDuVu.tsx` : le `focus()` de l'apparition ôté (le focus tomberait sur `body`,
  // « Annuler » hors d'atteinte au clavier) ; le retour du focus ôté du départ.
  it('le focus suit le message d’une carte : sur « Annuler » à son apparition, rendu à « Vu » de la même carte à son départ', async () => {
    monter({ [LIRE]: () => json(SANS_INVITATION), [vuDe(ANDOR)]: () => json(COCHE) })
    await section('En cours')
    const vu = within(carte('Andor')).getByRole('button', { name: 'Vu : Andor, S1 E3' })
    vu.focus()

    fireEvent.click(vu)
    const annuler = await within(carte('Andor')).findByRole('button', { name: 'Annuler' })
    await vi.waitFor(() => expect(document.activeElement).toBe(annuler))

    fireEvent.click(annuler)
    await vi.waitFor(() => expect(document.activeElement).toBe(within(carte('Andor')).getByRole('button', { name: 'Vu : Andor, S1 E3' })))
  })

  // Mutations, dans `vivante.ts` : `prendre` qui rend toujours `true` (le second toucher d'Andor aurait son
  // message) ; un verrou commun (`prendre('tout')` : Dark serait refusée tant qu'Andor attend).
  it('le verrou est par carte : un second « Vu » de la même carte n’envoie rien avant la réponse, une autre carte se coche', async () => {
    const reponse = retenue()
    const { ecritures } = monter({ [LIRE]: () => json(SANS_INVITATION), [vuDe(ANDOR)]: () => reponse.promesse, [vuDe(DARK)]: () => json(COCHE), [`PUT /api/episodes/${ANDOR.ensuite!.id}/watched`]: () => json(COCHE) })
    await section('En cours')
    fireEvent.click(within(carte('Andor')).getByRole('button', { name: 'Vu : Andor, S1 E3' }))
    await vi.waitFor(() => expect(carte('Andor')).toHaveTextContent('S1 E4'))
    toucherAilleurs()

    fireEvent.click(await within(carte('Andor')).findByRole('button', { name: 'Vu : Andor, S1 E4' }))
    await unInstant()
    expect(screen.queryByRole('status')).toBeNull()
    expect(carte('Andor')).toHaveTextContent('S1 E4')

    fireEvent.click(within(carte('Dark')).getByRole('button', { name: 'Vu : Dark, S2 E5' }))
    await vi.waitFor(() => expect(carte('Dark')).toHaveTextContent('S2 E6'))
    expect(within(carte('Dark')).getByRole('status')).toHaveTextContent('Épisode noté')
    // Les écritures partent une à une : celle de Dark attend la réponse d'Andor.
    expect(ecritures()).toEqual([vuDe(ANDOR)])

    reponse.rendre(json(COCHE))
    await vi.waitFor(() => expect(ecritures()).toEqual([vuDe(ANDOR), vuDe(DARK)]))
  })

  // Mutations, dans `VueListe.tsx` : `props.onAnnulerLeVu?.(retour.coche)` ôté ; dans `vivante.ts` :
  // `vu: false` envoyé à `true`.
  it('« Annuler » décoche l’épisode : la carte revient à l’épisode d’avant sans attendre, à sa place, ses touches rendues', async () => {
    const decoche = retenue()
    let ecrits = 0
    let lectures = 0
    const { corps, ecritures } = monter({ [LIRE]: () => json(++lectures === 1 ? SANS_INVITATION : APRES), [vuDe(ANDOR)]: () => (++ecrits === 1 ? json(COCHE) : decoche.promesse) })
    await section('En cours')
    fireEvent.click(within(carte('Andor')).getByRole('button', { name: 'Vu : Andor, S1 E3' }))
    await vi.waitFor(() => expect(lectures).toBe(2))
    await vi.waitFor(() => expect(carte('Andor')).toHaveTextContent('S1 E4'))

    fireEvent.click(within(carte('Andor')).getByRole('button', { name: 'Annuler' }))

    await vi.waitFor(() => expect(carte('Andor')).toHaveTextContent('S1 E3'))
    expect(screen.queryByRole('status')).toBeNull()
    expect(within(carte('Andor')).getByRole('button', { name: 'Vu : Andor, S1 E3' })).toBeInTheDocument()
    expect(titres('En cours')).toEqual(['Dark', 'Andor', 'Slow Horses', 'The Bear'])
    await vi.waitFor(() => expect(ecritures()).toEqual([vuDe(ANDOR), vuDe(ANDOR)]))
    expect(corps).toEqual([{ watched: true }, { watched: false }])
    decoche.rendre(json(COCHE))
  })

  // Mutations, dans `donnees.ts` : `en_pause: false` ôté d'`avancer` (elle resterait en pause, hors du
  // parcours) ; `[avancee, ...]` remplacé par `[..., avancee]` (elle reviendrait en queue).
  it('cocher un épisode d’une série en pause la ramène dans « En cours », en tête de la liste et du parcours de la télécommande', async () => {
    const reponse = retenue()
    monter({ [LIRE]: () => json(SANS_INVITATION), [vuDe(LEGENDES)]: () => reponse.promesse })
    await section('En cours')
    fireEvent.click(repli())

    fireEvent.click(within(carte('Le Bureau des légendes')).getByRole('button', { name: 'Vu : Le Bureau des légendes, S1 E3' }))
    await vi.waitFor(() => expect(carte('Le Bureau des légendes')).toHaveTextContent('S1 E4'))
    // Tant que son message est là, elle ne quitte pas sa section.
    expect(titres('En pause')).toEqual(['Le Bureau des légendes', 'Severance'])

    toucherAilleurs()
    await vi.waitFor(() => expect(titres('En cours')).toEqual(['Le Bureau des légendes', 'Dark', 'Andor', 'Slow Horses', 'The Bear']))
    expect(titres('En pause')).toEqual(['Severance'])
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('En cours 5')
    expect(repli()).toHaveTextContent('En pause 1')

    fireEvent.click(screen.getByRole('button', { name: 'Retour : Télécommande' }))
    await vi.waitFor(() => expect(ecran()).toHaveAttribute('data-etat', 'serie'))
    expect(ecran()).toHaveTextContent('Le Bureau des légendes')
    expect(ecran()).toHaveTextContent('1 sur 5')
    expect(screen.getByRole('button', { name: 'Série précédente' })).toBeDisabled()
  })
})

describe('« ⋯ » règle la télécommande sur la série', () => {
  // Mutations, dans `VueListe.tsx` : « ⋯ » mené à `{ nom: 'telecommande' }` sans la série ; dans `vivante.ts` :
  // `useState(reglee ? …)` et le réglage au rendu ôtés (l'écran montrerait Dark) ; `&& !reglee` ôté
  // (l'invitation passerait devant la série qu'on vient de choisir) ; dans `adresse.ts` : `allerA` en `replace`.
  it('la télécommande s’ouvre sur cette série, même devant une invitation ; l’adresse le dit, et le retour du téléphone ramène à la liste', async () => {
    monter({ [LIRE]: () => json(TOUT) })
    await section('En cours')

    fireEvent.click(within(carte('Andor')).getByRole('button', { name: 'Régler la télécommande sur Andor' }))

    expect(adresse()).toBe(`/feuilleton/maison?telecommande=serie-${ANDOR.id}`)
    await vi.waitFor(() => expect(dialogue()).toHaveAttribute('data-vue', 'telecommande'))
    expect(ecran()).toHaveAttribute('data-etat', 'serie')
    expect(ecran()).toHaveTextContent('Andor')
    expect(ecran()).toHaveTextContent('2 sur 4')
    expect(screen.getByRole('button', { name: 'Vu : Andor, S1 E3' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Vu à deux' })).toBeEnabled()

    historique(-1)
    await section('En cours')
    expect(adresse()).toBe('/feuilleton/maison?telecommande=en-cours')

    // Une autre série, puis le retour dessiné : il recule, lui aussi.
    fireEvent.click(within(carte('The Bear')).getByRole('button', { name: 'Régler la télécommande sur The Bear' }))
    await vi.waitFor(() => expect(ecran()).toHaveTextContent('The Bear'))
    expect(ecran()).toHaveTextContent('4 sur 4')
    fireEvent.click(screen.getByRole('button', { name: 'Retour : En cours' }))
    await section('En cours')
    expect(adresse()).toBe('/feuilleton/maison?telecommande=en-cours')
  })

  // Mutations, dans `vivante.ts` : `horsParcours` ôté (l'écran montrerait la première série en cours) ;
  // `enPause` non passé par `aLEcran` (l'écran dirait « En cours », « 1 sur 4 »).
  it('une série en pause s’y règle aussi : l’écran la dit en pause, hors du parcours, et « suivante » y ramène', async () => {
    monter({ [LIRE]: () => json(SANS_INVITATION) })
    await section('En cours')
    fireEvent.click(repli())

    fireEvent.click(within(carte('Le Bureau des légendes')).getByRole('button', { name: 'Régler la télécommande sur Le Bureau des légendes' }))

    await vi.waitFor(() => expect(ecran()).toHaveTextContent('Le Bureau des légendes'))
    expect(ecran()).toHaveTextContent('En pause')
    expect(ecran()).not.toHaveTextContent(/\d sur \d/)
    expect(screen.getByRole('button', { name: 'Vu : Le Bureau des légendes, S1 E3' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Série précédente' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Série suivante' }))
    expect(ecran()).toHaveTextContent('Dark')
    expect(ecran()).toHaveTextContent('1 sur 4')
  })

  // Mutation, dans `vivante.ts` : l'état initial du choix sans le réglage (`useState(null)` : elle montrerait Dark).
  it('ouverte par son adresse, `?telecommande=serie-<identifiant>` montre cette série', async () => {
    monter({ [LIRE]: () => json(SANS_INVITATION) }, `serie-${SLOW.id}`)

    await vi.waitFor(() => expect(ecran()).toHaveTextContent('Slow Horses'))
    expect(ecran()).toHaveTextContent('3 sur 4')
    expect(screen.queryByRole('button', { name: /^Retour/ })).toBeNull()
  })
})

describe('réglée sur une série que la télécommande ne porte pas', () => {
  const ABSENTE = 'serie-d0000000-0000-4000-8000-0000000000ff'

  // Mutation, dans `vivante.ts` : `!regleeTrouvee` rendu à `!reglee` (l'invitation serait cachée derrière
  // une série qu'on n'a pas choisie).
  it('elle se comporte comme sans réglage : l’invitation qui attend passe d’abord', async () => {
    monter({ [LIRE]: () => json(TOUT) }, ABSENTE)

    await screen.findByText(/a vu/)
    expect(ecran()).toHaveAttribute('data-etat', 'invitation')
    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeEnabled()
  })

  it('sans invitation : la série regardée en dernier', async () => {
    monter({ [LIRE]: () => json(SANS_INVITATION) }, ABSENTE)

    expect(await screen.findByRole('heading', { level: 3, name: 'Dark' })).toBeInTheDocument()
    expect(ecran()).toHaveTextContent('1 sur 4')
  })
})

describe('confirmer et refuser depuis la liste', () => {
  const invitation = () => document.querySelector<HTMLElement>('[data-etat="invitation"]')

  // Mutations, dans `Panneau.tsx` : `onConfirmer` non passé à la liste (`vivante.liste` sans lui) ; dans
  // `vivante.ts` : `poserLaCarte(sans, carte)` ôté (la carte rendue n'entrerait pas).
  it('« Confirmer » : la route part, l’invitation quitte la liste, la carte rendue y entre, et le voyant s’éteint', async () => {
    const rendue: CarteDeSerie = { ...CONFIRMATION.serie, id: 'd0000000-0000-4000-8000-0000000000b9', titre: 'Dix pour cent', dernier_visionnage_le: '2026-10-13T20:30:00.000Z' }
    const { ecritures, requetes } = monter({ [LIRE]: () => json(TOUT), [CONFIRMER]: () => json({ ...CONFIRMATION, serie: rendue }) })
    await section('En cours')
    expect(screen.getByRole('img', { name: 'Une invitation attend' })).toBeInTheDocument()

    fireEvent.click(within(invitation()!).getByRole('button', { name: 'Confirmer' }))

    await vi.waitFor(() => expect(invitation()).toBeNull())
    expect(ecritures()).toEqual([CONFIRMER])
    expect(screen.queryByRole('heading', { level: 2, name: /À confirmer/ })).toBeNull()
    expect(titres('En cours')).toEqual(['Dix pour cent', 'Dark', 'Andor', 'Slow Horses', 'The Bear'])
    expect(await screen.findByRole('status')).toHaveTextContent('Vu à deux noté')
    expect(screen.queryByRole('img', { name: 'Une invitation attend' })).toBeNull()
    expect(requetes.filter((requete) => requete === LIRE)).toHaveLength(1)
  })

  // Mutation, dans `vivante.ts` : `confirmer ? … : …` inversé (refuser confirmerait).
  it('« Refuser » : la route part, l’invitation quitte la liste, les séries ne bougent pas', async () => {
    const { ecritures } = monter({ [LIRE]: () => json(TOUT), [REFUSER]: () => json(REFUS) })
    await section('En cours')

    fireEvent.click(within(invitation()!).getByRole('button', { name: 'Refuser' }))

    await vi.waitFor(() => expect(invitation()).toBeNull())
    expect(ecritures()).toEqual([REFUSER])
    expect(titres('En cours')).toEqual(['Dark', 'Andor', 'Slow Horses', 'The Bear'])
    expect(await screen.findByRole('status')).toHaveTextContent('Invitation refusée')
  })

  // Mutations, dans `vivante.ts` : `nEstPlus(erreur) ? {} : { sujet: id }` rendu à `{}` (le message quitterait
  // la carte) ; `if (!nEstPlus(erreur)) return` ôté (l'invitation disparaîtrait sur un `500`).
  it('sur un `500` l’invitation reste, son message à la place de ses touches, puis ses touches reviennent', async () => {
    const { requetes } = monter({ [LIRE]: () => json(TOUT), [CONFIRMER]: () => refus(500, 'Le service est indisponible. Réessaie plus tard.') })
    await section('En cours')

    fireEvent.click(within(invitation()!).getByRole('button', { name: 'Confirmer' }))

    expect(await within(invitation()!).findByRole('alert')).toHaveTextContent('Le service est indisponible. Réessaie plus tard.')
    expect(within(invitation()!).queryByRole('button')).toBeNull()
    await unInstant()
    // Elle n'a pas quitté la liste pour y revenir : rien n'a été relu.
    expect(requetes.filter((requete) => requete === LIRE)).toHaveLength(1)
    toucherAilleurs()
    expect(await within(invitation()!).findByRole('button', { name: 'Confirmer' })).toBeEnabled()
  })

  // Mutations, dans `vivante.ts` : `retirerLInvitation` ôté de l'échec ; `await relire()` ôté.
  it.each([
    [409, 'Cette invitation a déjà été traitée.'],
    [404, 'Cette invitation n’existe plus.'],
  ])('sur un `%i` l’invitation n’est plus : elle quitte la liste, le message de l’API se dit en tête, et la télécommande se relit', async (status, texte) => {
    let lectures = 0
    const relecture = retenue()
    monter({ [LIRE]: () => (++lectures === 1 ? json(TOUT) : relecture.promesse), [REFUSER]: () => refus(status, texte) })
    await section('En cours')

    fireEvent.click(within(invitation()!).getByRole('button', { name: 'Refuser' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(texte)
    // Elle sort avant que la relecture ait répondu.
    await vi.waitFor(() => expect(lectures).toBe(2))
    await vi.waitFor(() => expect(invitation()).toBeNull())
    relecture.rendre(json(SANS_INVITATION))
    await unInstant()
    expect(invitation()).toBeNull()
    expect(titres('En cours')).toEqual(['Dark', 'Andor', 'Slow Horses', 'The Bear'])
  })
})
