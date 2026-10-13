import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../../App'
import type { CarteDeSerie, Confirmation, ReponseDePortee, Telecommande, VuADeux } from '../../api/feuilleton'
import { createQueryClient } from '../../api/queryClient'
import { exemple } from '../../test/contrat'
import { json, servir } from '../../test/serveur'

await import('../Feuilleton')
await import('../../maison/Maison')
await import('./Panneau')

const SESSION = exemple<{ user: { pseudo: string } }>('/auth/me', 'get', 200)
const EXEMPLE = exemple<Telecommande>('/me/feuilleton/telecommande', 'get', 200)
const PORTEE = exemple<ReponseDePortee>('/me/feuilleton/episodes', 'put', 200)
const CONFIRMATION = exemple<Confirmation>('/me/feuilleton/vus-a-deux/{id}/confirmer', 'post', 200)
const REFUS = exemple<VuADeux>('/me/feuilleton/vus-a-deux/{id}/refuser', 'post', 200)
const COCHE = exemple<unknown>('/episodes/{id}/watched', 'put', 200)

/** Mercredi 14 octobre 2026, 21 h à Paris. */
const SOIR = new Date('2026-10-14T19:00:00Z')

const INVITATION = EXEMPLE.a_confirmer[0]!
/** Dark : S2 E5 à voir, S2 E6 ensuite, regardée le 12 au soir. Severance : en pause, à jour. */
const DARK = EXEMPLE.series[0]!
const SEVERANCE = EXEMPLE.series[1]!
const serie = (id: string, titre: string, le: string, autres: Partial<CarteDeSerie> = {}): CarteDeSerie => ({ ...DARK, id, titre, vignette: null, dernier_visionnage_le: le, ...autres })
const ANDOR = serie('d0000000-0000-4000-8000-0000000000a1', 'Andor', '2026-10-10T19:00:00.000Z')
const SLOW = serie('d0000000-0000-4000-8000-0000000000a2', 'Slow Horses', '2026-10-08T19:00:00.000Z', { prochain: null, ensuite: null, a_jour: true, prochaine_diffusion_le: '2026-10-21' })
/** Trois séries en cours (Dark, Andor, Slow Horses), une en pause entre elles, aucune invitation. */
const TROIS: Telecommande = { a_confirmer: [], series: [DARK, SEVERANCE, ANDOR, SLOW] }

const LIRE = 'GET /api/me/feuilleton/telecommande'
const VU = `PUT /api/episodes/${DARK.prochain!.id}/watched`
const LOT = 'PUT /api/me/feuilleton/episodes'
const CONFIRMER = `POST /api/me/feuilleton/vus-a-deux/${INVITATION.id}/confirmer`
const REFUSER = `POST /api/me/feuilleton/vus-a-deux/${INVITATION.id}/refuser`
const refus = (status: number, message: string) => json({ code: status === 404 ? 'NOT_FOUND' : status === 409 ? 'CONFLICT' : 'INTERNAL', message, retryable: false }, status)

function Ou() {
  const { pathname, search } = useLocation()
  return <output data-testid="adresse">{pathname + search}</output>
}

type Routes = Parameters<typeof servir>[0]
/** Monte l'app sur la télécommande ouverte. `corps` garde ce que chaque écriture a envoyé. */
function monter(routes: Routes) {
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
      <MemoryRouter initialEntries={['/feuilleton/maison?telecommande=telecommande']}>
        <App />
        <Ou />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { requetes, corps, ecritures: () => requetes.filter((requete) => !requete.startsWith('GET ')) }
}

const ecran = () => document.querySelector<HTMLElement>('[data-piece="ecran"]')!
const enSerie = (titre: string) => screen.findByRole('heading', { level: 3, name: titre })
const touche = (name: string | RegExp) => screen.getByRole('button', { name })
const message = () => document.querySelector<HTMLElement>('[data-piece="message"]')
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

describe('le petit écran à l’ouverture', () => {
  // Mutations, dans `vivante.ts` : `enCours[rang]` remplacé par la dernière série ; `rang + 1` par `rang` ;
  // `enCours.length` par `telecommande.series.length` (la série en pause compterait : « 1 sur 4 », « En cours 4 »).
  it('sans invitation : la série regardée en dernier, son rang parmi les séries en cours, quand elle l’a été', async () => {
    monter({ [LIRE]: () => json(TROIS) })

    await enSerie('Dark')
    expect(ecran()).toHaveAttribute('data-etat', 'serie')
    expect(ecran()).toHaveTextContent('S2 E5')
    expect(ecran()).toHaveTextContent('1 sur 3')
    expect(ecran()).toHaveTextContent('Regardée il y a 2 jours')
    expect(touche('Vu : Dark, S2 E5')).toBeEnabled()
    expect(touche(/^En cours/)).toHaveTextContent('En cours 3')
  })

  // Mutations : la branche `invitation` passée après `carte` dans `vivante.ts` ; `invitation.de.pseudo`
  // remplacé par le titre ; dans `Monogramme.tsx`, `--identite` non posée.
  it('une invitation passe EN PREMIER : qui, quoi, son monogramme à sa couleur d’identité, « Confirmer » et « Refuser »', async () => {
    monter({ [LIRE]: () => json({ ...TROIS, a_confirmer: [INVITATION] }) })

    await screen.findByText(/a vu/)
    expect(ecran()).toHaveAttribute('data-etat', 'invitation')
    expect(ecran()).toHaveTextContent('bob a vu Dark S2 E5 avec toi')
    expect(ecran()).toHaveTextContent('Avant tes 3 séries')
    expect(ecran()).toHaveTextContent('Proposé hier soir')
    const monogramme = ecran().querySelector<HTMLElement>('[data-piece="monogramme"]')!
    expect(monogramme).toHaveTextContent('B')
    expect(monogramme.style.getPropertyValue('--identite')).toBe('#3A7CA5')
    expect(touche('Confirmer')).toBeEnabled()
    expect(touche('Refuser')).toBeEnabled()
    expect(screen.queryByRole('button', { name: /^Vu($| :)/ })).toBeNull()
  })

  // Mutations, dans `vivante.ts` : `allerAuRang(rang + 1)` posé sur les deux flèches ; la borne ôtée
  // (`setChoix` sans regarder `enCours[suivant]`) ; `seriesEnCours` remplacé par `telecommande.series`.
  it('précédente / suivante parcourent les séries en cours dans l’ordre reçu, sans celles en pause, et s’arrêtent aux deux bouts', async () => {
    monter({ [LIRE]: () => json(TROIS) })
    await enSerie('Dark')
    expect(touche('Série précédente')).toBeDisabled()

    fireEvent.click(touche('Série suivante'))
    expect(ecran()).toHaveTextContent('Andor')
    expect(ecran()).toHaveTextContent('2 sur 3')

    fireEvent.click(touche('Série suivante'))
    expect(ecran()).toHaveTextContent('Slow Horses')
    expect(ecran()).toHaveTextContent('3 sur 3')
    expect(touche('Série suivante')).toBeDisabled()

    fireEvent.click(touche('Série précédente'))
    expect(ecran()).toHaveTextContent('Andor')
    fireEvent.click(touche('Série précédente'))
    expect(ecran()).toHaveTextContent('Dark')
    expect(ecran()).not.toHaveTextContent('Severance')
  })

  // Mutations : `diffusion` non passé par `aLEcran` ; « Vu » laissé allumé sans `prochain` (`VueTelecommande.tsx`).
  it('une série à jour : pas de « Vu », « Prochain épisode le 21 octobre » quand la date est connue, rien sinon', async () => {
    monter({ [LIRE]: () => json({ a_confirmer: [], series: [SLOW, { ...ANDOR, prochain: null, ensuite: null, a_jour: true, prochaine_diffusion_le: null }] }) })
    await enSerie('Slow Horses')

    expect(ecran()).toHaveTextContent('À jour')
    expect(ecran()).toHaveTextContent('Prochain épisode le 21 octobre')
    expect(touche('Vu')).toBeDisabled()
    for (const b of within(screen.getByRole('group', { name: 'Cet épisode' })).getAllByRole('button')) expect(b).toBeDisabled()

    fireEvent.click(touche('Série suivante'))
    expect(ecran()).toHaveTextContent('Andor')
    expect(ecran()).toHaveTextContent('À jour')
    expect(ecran()).not.toHaveTextContent('Prochain épisode')
  })

  // Mutations : l'état `vide` rendu pour `telecommande.series` vide seulement (une série en pause
  // s'afficherait) ; « Ajouter » qui ne mène nulle part.
  it('aucune série en cours (une seule, en pause) : l’état vide, qui mène à « Ajouter »', async () => {
    monter({ [LIRE]: () => json({ a_confirmer: [], series: [SEVERANCE] }) })

    expect(await screen.findByRole('heading', { level: 3, name: 'Aucune série en cours' })).toBeInTheDocument()
    expect(ecran()).toHaveAttribute('data-etat', 'vide')
    expect(touche(/^En cours/)).toHaveTextContent('En cours 0')
    expect(touche('Vu')).toBeDisabled()

    fireEvent.click(touche('Ajouter'))
    expect(await screen.findByRole('heading', { level: 2, name: 'Ajouter une série' })).toBeInTheDocument()
    expect(screen.getByTestId('adresse')).toHaveTextContent('/feuilleton/maison?telecommande=ajouter')
  })

  // Mutations, dans `Panneau.tsx` : `onVuADeux` mené à `en-cours`, ou sans la série de l'écran ; dans la vue, « Fiche » sans identifiant.
  it('« Vu à deux » mène à la vue `a-deux` de la série à l’écran, « Fiche » à sa fiche', async () => {
    monter({ [LIRE]: () => json(TROIS), 'GET /api/users?limit=100': () => json({ items: [], next_cursor: null }) })
    await enSerie('Dark')
    fireEvent.click(touche('Série suivante'))

    fireEvent.click(touche('Fiche'))
    expect(screen.getByTestId('adresse')).toHaveTextContent(`/feuilleton/maison?telecommande=fiche-${ANDOR.id}`)
    fireEvent.click(await screen.findByRole('button', { name: /^Retour/ }))

    fireEvent.click(await screen.findByRole('button', { name: 'Vu à deux' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Vu à deux' })).toBeInTheDocument()
    expect(screen.getByTestId('adresse').textContent).toBe(`/feuilleton/maison?telecommande=a-deux-${ANDOR.id}`)
  })
})

describe('l’attente et la panne de la lecture', () => {
  // Mutation, dans `vivante.ts` : l'état `vide` rendu tant que rien n'est lu.
  it('pendant la première lecture : la carte fantôme, tout éteint sauf « Aller à »', async () => {
    const lecture = retenue()
    monter({ [LIRE]: () => lecture.promesse })

    const panneau = await screen.findByRole('dialog', { name: 'Télécommande' })
    expect(within(panneau).getByRole('status')).toHaveTextContent('La télécommande s’allume…')
    expect(ecran()).toHaveAttribute('data-etat', 'attente')
    expect(touche('Vu')).toBeDisabled()

    lecture.rendre(json(TROIS))
    await enSerie('Dark')
  })

  // Mutations : la branche `panne` ôtée (l'écran attendrait pour toujours) ; `onReessayer` non branché ;
  // le message remplacé par un texte de l'app.
  it('une lecture qui échoue : le message de l’API dans le boîtier, « Réessayer » relit, et la série vient', async () => {
    let essais = 0
    const { requetes } = monter({ [LIRE]: () => (++essais === 1 ? refus(500, 'La télécommande ne répond pas.') : json(TROIS)) })

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveAttribute('data-etat', 'panne')
    expect(alerte).toHaveTextContent('La télécommande ne répond pas.')
    // Le boîtier tient : le dialogue, ses rangées, l'habillage.
    expect(screen.getByRole('dialog', { name: 'Télécommande' }).contains(alerte)).toBe(true)
    expect(alerte.closest('[data-chapitre]')).toHaveAttribute('data-chapitre', 'chapitre-1')
    expect(touche('Ajouter')).toBeEnabled()

    fireEvent.click(within(alerte).getByRole('button', { name: 'Réessayer' }))

    await enSerie('Dark')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(requetes.filter((requete) => requete === LIRE)).toHaveLength(2)
  })
})

describe('« Vu »', () => {
  const APRES: Telecommande = { ...TROIS, series: [{ ...DARK, prochain: DARK.ensuite, ensuite: PORTEE.serie.prochain, dernier_visionnage_le: SOIR.toISOString() }, SEVERANCE, ANDOR, SLOW] }

  // Mutations, dans `vivante.ts` : l'écriture d'avance ôtée de `onMutate` (l'écran resterait à S2 E5
  // jusqu'à la relecture) ; `relire()` ôté de `onSettled` (S2 E7, « ensuite », ne viendrait jamais) ;
  // `vu` envoyé à faux.
  it('coche le prochain épisode, la carte avance AVANT la réponse, puis la télécommande se relit', async () => {
    const reponse = retenue()
    let lectures = 0
    const { requetes, corps } = monter({ [LIRE]: () => json(++lectures === 1 ? TROIS : APRES), [VU]: () => reponse.promesse })
    await enSerie('Dark')

    fireEvent.click(touche('Vu : Dark, S2 E5'))

    await vi.waitFor(() => expect(ecran()).toHaveTextContent('S2 E6'))
    expect(ecran()).toHaveTextContent('Un cycle sans fin')
    expect(ecran()).toHaveTextContent('Regardée à l’instant')
    expect(ecran()).toHaveTextContent('1 sur 3')
    expect(message()).toHaveTextContent('Épisode noté')
    // Rien n'est revenu : une seule écriture est partie, et aucune relecture.
    expect(requetes).toEqual(['GET /api/auth/me', LIRE, VU])
    expect(corps).toEqual([{ watched: true }])

    reponse.rendre(json(COCHE))

    await vi.waitFor(() => expect(requetes).toEqual(['GET /api/auth/me', LIRE, VU, LIRE]))
    expect(ecran()).toHaveTextContent('S2 E6')
    // La relecture a rendu l'épisode d'après : « Vu » le proposera.
    fireEvent.pointerDown(touche('Ajouter'))
    await vi.waitFor(() => expect(touche('Vu : Dark, S2 E6')).toBeEnabled())
  })

  // Mutation : la série choisie suivie par son rang et non par son identifiant (`trouve = choix.rang`) :
  // cochée depuis le rang 2, elle passe en tête et l'écran resterait sur le rang 2, une autre série.
  it('la série cochée reste à l’écran, même cochée depuis le milieu du parcours', async () => {
    const reponse = retenue()
    monter({ [LIRE]: () => json(TROIS), [`PUT /api/episodes/${ANDOR.prochain!.id}/watched`]: () => reponse.promesse })
    await enSerie('Dark')
    fireEvent.click(touche('Série suivante'))
    expect(ecran()).toHaveTextContent('2 sur 3')

    fireEvent.click(touche('Vu : Andor, S2 E5'))

    await vi.waitFor(() => expect(ecran()).toHaveTextContent('S2 E6'))
    expect(ecran()).toHaveTextContent('Andor')
    expect(ecran()).toHaveTextContent('1 sur 3')
  })

  // Mutations, dans `onError` : la photo non reposée (l'écran resterait à S2 E6) ; `dire(...)` ôté
  // (« Épisode noté » resterait, sur un échec) ; le message remplacé par un texte de l'app.
  it.each([
    ['un `500`', () => refus(500, 'La coche a échoué. Réessaie.'), 'La coche a échoué. Réessaie.'],
    [
      'une panne de réseau',
      () => {
        throw new TypeError('Failed to fetch')
      },
      'L’API est injoignable. Vérifie ta connexion, puis réessaie.',
    ],
  ] as [string, () => Response, string][])('sur %s : la carte revient en arrière, et le message de l’erreur prend la place de « Épisode noté »', async (_quoi, echec, attendu) => {
    const { requetes } = monter({ [LIRE]: () => json(TROIS), [VU]: echec })
    await enSerie('Dark')

    fireEvent.click(touche('Vu : Dark, S2 E5'))

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent(attendu)
    expect(alerte).toHaveAttribute('data-piece', 'message')
    expect(within(alerte).queryByRole('button', { name: 'Annuler' })).toBeNull()
    expect(screen.queryByText('Épisode noté')).toBeNull()
    expect(ecran()).toHaveTextContent('S2 E5')
    expect(ecran()).toHaveTextContent('Regardée il y a 2 jours')
    expect(ecran()).not.toHaveTextContent('S2 E6')
    // Le serveur a le dernier mot : la télécommande se relit aussi après un échec.
    await vi.waitFor(() => expect(requetes.filter((requete) => requete === LIRE)).toHaveLength(2))
    fireEvent.pointerDown(touche('Ajouter'))
    await vi.waitFor(() => expect(touche('Vu : Dark, S2 E5')).toBeEnabled())
  })

  // Mutation : le verrou ôté d'`onVu` (`prendre()` qui rend toujours vrai) : le second toucher cocherait S2 E6.
  it('un second toucher avant la réponse n’envoie rien de plus', async () => {
    const reponse = retenue()
    const { ecritures } = monter({ [LIRE]: () => json(TROIS), [VU]: () => reponse.promesse })
    await enSerie('Dark')

    fireEvent.click(touche('Vu : Dark, S2 E5'))
    await vi.waitFor(() => expect(ecran()).toHaveTextContent('S2 E6'))
    // Le message parti, « Vu » est de nouveau sous le doigt, sur l'épisode d'après.
    fireEvent.pointerDown(touche('Ajouter'))
    fireEvent.click(touche('Vu : Dark, S2 E6'))
    fireEvent.click(touche('Vu : Dark, S2 E6'))

    expect(message()).toBeNull()
    await new Promise((fait) => setTimeout(fait, 30))
    expect(ecritures()).toEqual([VU])
    reponse.rendre(json(COCHE))
  })

  // Mutations, dans `vivante.ts` : `onAnnulerLeVu` qui ne part pas ; la décoche envoyée à vrai ; la carte
  // d'avant non reposée dans `onMutate` (l'écran resterait à S2 E6 jusqu'à la relecture).
  it('« Épisode noté », puis « Annuler » décoche l’épisode et ramène l’écran à l’épisode d’avant, sans attendre', async () => {
    const decoche = retenue()
    let coches = 0
    // Le serveur doublé tient l'état : coché après le « Vu », décoché après « Annuler ».
    let etat = TROIS
    const { requetes, corps } = monter({
      [LIRE]: () => json(etat),
      [VU]: () => {
        if (++coches === 1) {
          etat = APRES
          return json(COCHE)
        }
        etat = TROIS
        return decoche.promesse
      },
    })
    await enSerie('Dark')
    fireEvent.click(touche('Vu : Dark, S2 E5'))
    await vi.waitFor(() => expect(requetes).toEqual(['GET /api/auth/me', LIRE, VU, LIRE]))
    await vi.waitFor(() => expect(ecran()).toHaveTextContent('S2 E6'))
    expect(message()).toHaveTextContent('Épisode noté')

    fireEvent.click(within(message()!).getByRole('button', { name: 'Annuler' }))

    await vi.waitFor(() => expect(ecran()).toHaveTextContent('S2 E5'))
    expect(ecran()).toHaveTextContent('Dark')
    expect(ecran()).toHaveTextContent('Regardée il y a 2 jours')
    await vi.waitFor(() => expect(requetes.filter((requete) => requete === VU)).toHaveLength(2))
    expect(corps).toEqual([{ watched: true }, { watched: false }])
    expect(message()).toBeNull()

    decoche.rendre(json(COCHE))
    await vi.waitFor(() => expect(requetes).toEqual(['GET /api/auth/me', LIRE, VU, LIRE, VU, LIRE]))
    expect(ecran()).toHaveTextContent('S2 E5')
  })
})

describe('« Tout jusqu’ici » et « Toute la saison »', () => {
  // Mutations, dans `vivante.ts` : `episode_id` pris sur `ensuite` ; la carte de la réponse non posée
  // (`poser` ôté d'`onSuccess`) ; `dire(direLeLot(…))` ôté ; `relire()` ajouté (une requête de trop).
  it('« Tout jusqu’ici » envoie la portée sur l’épisode affiché ; la carte de la réponse remplace celle du cache, sans relecture, et le compte se dit sans « Annuler »', async () => {
    const { requetes, corps } = monter({ [LIRE]: () => json(TROIS), [LOT]: () => json(PORTEE) })
    await enSerie('Dark')

    fireEvent.click(touche('Tout jusqu’ici'))

    await vi.waitFor(() => expect(ecran()).toHaveTextContent('S2 E7'))
    expect(corps).toEqual([{ portee: 'jusqu_ici', episode_id: DARK.prochain!.id }])
    expect(ecran()).toHaveTextContent('Le diable blanc')
    expect(ecran()).toHaveTextContent('1 sur 3')
    expect(message()).toHaveTextContent('2 épisodes notés')
    expect(message()).toHaveAttribute('role', 'status')
    expect(within(message()!).queryByRole('button')).toBeNull()
    expect(requetes).toEqual(['GET /api/auth/me', LIRE, LOT])
  })

  // Mutations, dans `vivante.ts` : `season_id: episode.id` ; une lecture de la fiche remise avant la portée.
  it('« Toute la saison » envoie `saison_id` de l’épisode de la carte, sans lire la fiche', async () => {
    const { requetes, corps } = monter({ [LIRE]: () => json(TROIS), [LOT]: () => json(PORTEE) })
    await enSerie('Dark')

    fireEvent.click(touche('Toute la saison'))

    await vi.waitFor(() => expect(ecran()).toHaveTextContent('S2 E7'))
    expect(corps).toEqual([{ portee: 'saison', season_id: DARK.prochain!.saison_id }])
    expect(DARK.prochain!.saison_id).not.toBe(DARK.prochain!.id)
    expect(requetes).toEqual(['GET /api/auth/me', LIRE, LOT])
  })

  // Mutations : `finie` ignoré par `poserLaCarte` ; le rang d'alors oublié (`trouve === -1 ? 0`) : l'écran reviendrait à la première.
  it('une série que le lot finit quitte l’écran : le parcours passe à la suivante, et « En cours » en compte une de moins', async () => {
    const finie: ReponseDePortee = { ...PORTEE, serie: { ...ANDOR, prochain: null, ensuite: null, a_jour: true, finie: true } }
    monter({ [LIRE]: () => json(TROIS), [LOT]: () => json(finie) })
    await enSerie('Dark')
    fireEvent.click(touche('Série suivante'))
    expect(ecran()).toHaveTextContent('Andor')

    fireEvent.click(touche('Tout jusqu’ici'))

    await enSerie('Slow Horses')
    expect(ecran()).toHaveTextContent('2 sur 2')
    expect(touche(/^En cours/)).toHaveTextContent('En cours 2')
    expect(screen.queryByRole('heading', { level: 3, name: 'Andor' })).toBeNull()
  })

  // Mutation : le verrou ôté de `cocherUnLot`.
  it('deux touchers d’un même geste n’envoient qu’un lot ; un échec se dit, la carte ne bouge pas', async () => {
    const { ecritures } = monter({ [LIRE]: () => json(TROIS), [LOT]: () => refus(404, 'Cet épisode est introuvable.') })
    await enSerie('Dark')
    const jusquIci = touche('Tout jusqu’ici')

    fireEvent.click(jusquIci)
    fireEvent.click(jusquIci)

    expect(await screen.findByRole('alert')).toHaveTextContent('Cet épisode est introuvable.')
    expect(ecritures()).toEqual([LOT])
    expect(ecran()).toHaveTextContent('S2 E5')
  })
})

describe('les verrous se rendent', () => {
  // Mutation, dans `vivante.ts` : `verrous.current.delete(carte.id)` ôté d'`onSettled` du lot.
  it('un lot en échec rend la carte : « Tout jusqu’ici » repart', async () => {
    let essais = 0
    const { ecritures } = monter({ [LIRE]: () => json(TROIS), [LOT]: () => (++essais === 1 ? refus(500, 'Le service est indisponible.') : json(PORTEE)) })
    await enSerie('Dark')
    fireEvent.click(touche('Tout jusqu’ici'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Le service est indisponible.')
    fireEvent.pointerDown(document.body)

    fireEvent.click(await screen.findByRole('button', { name: 'Tout jusqu’ici' }))

    await vi.waitFor(() => expect(ecritures()).toEqual([LOT, LOT]))
  })

  // Mutation, dans `vivante.ts` : `verrous.current.delete(id)` ôté d'`onSettled` de la réponse à une invitation.
  it('une confirmation en échec rend l’invitation : « Confirmer » repart', async () => {
    let essais = 0
    const { ecritures } = monter({ [LIRE]: () => json({ ...TROIS, a_confirmer: [INVITATION] }), [CONFIRMER]: () => (++essais === 1 ? refus(500, 'La confirmation a échoué.') : json(CONFIRMATION)) })
    await screen.findByText(/a vu/)
    fireEvent.click(touche('Confirmer'))
    expect(await screen.findByRole('alert')).toHaveTextContent('La confirmation a échoué.')
    fireEvent.pointerDown(document.body)

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer' }))

    await vi.waitFor(() => expect(ecritures()).toEqual([CONFIRMER, CONFIRMER]))
  })
})

describe('le focus suit le message du « Vu »', () => {
  const annuler = () => screen.findByRole('button', { name: 'Annuler' })

  // Mutations, dans `MessageDuVu.tsx` : le `focus()` de l'apparition ôté ; le retour du focus ôté du départ.
  it('sur « Annuler » à l’apparition du message, rendu à « Vu » à son départ', async () => {
    monter({ [LIRE]: () => json(TROIS), [VU]: () => retenue().promesse })
    await enSerie('Dark')
    const vu = touche('Vu : Dark, S2 E5')
    vu.focus()

    fireEvent.click(vu)
    await vi.waitFor(async () => expect(document.activeElement).toBe(await annuler()))

    fireEvent.pointerDown(document.body)
    await vi.waitFor(() => expect(document.activeElement).toBe(touche('Vu : Dark, S2 E6')))
  })

  // Mutation, dans `MessageDuVu.tsx` : `?? boite.current` ôté (l'échec, sans « Annuler », laisserait le
  // focus sur `body`, et rien ne le rendrait à « Vu »).
  it('l’échec qui remplace « Épisode noté » garde le focus dans la rangée, et le rend à « Vu » à son départ', async () => {
    const reponse = retenue()
    monter({ [LIRE]: () => json(TROIS), [VU]: () => reponse.promesse })
    await enSerie('Dark')
    const vu = touche('Vu : Dark, S2 E5')
    vu.focus()
    fireEvent.click(vu)
    await vi.waitFor(async () => expect(document.activeElement).toBe(await annuler()))

    reponse.rendre(refus(500, 'Le service est indisponible.'))
    const alerte = await screen.findByRole('alert')
    await vi.waitFor(() => expect(document.activeElement).toBe(alerte))

    fireEvent.pointerDown(document.body)
    await vi.waitFor(() => expect(document.activeElement).toBe(touche('Vu : Dark, S2 E5')))
  })

  // Mutations, dans `MessageDuVu.tsx` : `focusPerdu()` ôté de l'apparition (le focus serait pris à qui est
  // ailleurs) ; `message.contains(document.activeElement)` ôté du départ (de même).
  it('sans voler le focus : ni à l’apparition si le focus est ailleurs, ni au départ si l’on a quitté « Annuler »', async () => {
    monter({ [LIRE]: () => json(TROIS), [VU]: () => retenue().promesse })
    await enSerie('Dark')
    const enCours = touche(/^En cours/)
    enCours.focus()

    fireEvent.click(touche('Vu : Dark, S2 E5'))
    await annuler()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(document.activeElement).toBe(enCours)

    ;(await annuler()).focus()
    enCours.focus()
    fireEvent.pointerDown(document.body)
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(document.activeElement).toBe(enCours)
  })
})

describe('confirmer et refuser une invitation depuis l’écran', () => {
  const AVEC: Telecommande = { ...TROIS, a_confirmer: [INVITATION] }
  const point = () => document.querySelector('[data-piece="point"]')

  // Mutations, dans `vivante.ts` : `retirerLInvitation` ôté d'`onSuccess` (l'invitation resterait, le
  // point aussi) ; la carte de la confirmation non posée (Dark resterait à S2 E5).
  it('« Confirmer » : la route part, l’invitation quitte l’écran, la carte rendue entre au cache, le point du bouton s’éteint', async () => {
    const { requetes } = monter({ [LIRE]: () => json(AVEC), [CONFIRMER]: () => json(CONFIRMATION) })
    await screen.findByText(/a vu/)
    expect(point()).not.toBeNull()
    expect(document.querySelector('[data-piece="voyant"]')).not.toBeNull()

    fireEvent.click(touche('Confirmer'))

    await enSerie('Dark')
    expect(ecran()).toHaveAttribute('data-etat', 'serie')
    // La carte de la confirmation : Dark en est à S2 E6, regardée à l'heure de l'invitation.
    expect(ecran()).toHaveTextContent('S2 E6')
    expect(ecran()).toHaveTextContent('Regardée hier soir')
    expect(message()).toHaveTextContent('Vu à deux noté')
    expect(point()).toBeNull()
    expect(document.querySelector('[data-piece="voyant"]')).toBeNull()
    expect(requetes).toEqual(['GET /api/auth/me', LIRE, CONFIRMER])
  })

  // Mutations : `refuserLeVuADeux` remplacé par la confirmation ; la seconde invitation sautée
  // (`a_confirmer` vidé d'un coup).
  it('« Refuser » : l’invitation part sans toucher aux séries ; s’il y en a une autre, elle vient ensuite, et le point reste', async () => {
    const seconde = { ...INVITATION, id: 'eeeeeeee-0000-4000-8000-000000000002', serie: { id: ANDOR.id, titre: 'Andor' } }
    const { requetes } = monter({ [LIRE]: () => json({ ...TROIS, a_confirmer: [INVITATION, seconde] }), [REFUSER]: () => json(REFUS) })
    await screen.findByText(/a vu/)
    expect(ecran()).toHaveTextContent('bob a vu Dark S2 E5 avec toi')

    fireEvent.click(touche('Refuser'))

    await vi.waitFor(() => expect(ecran()).toHaveTextContent('bob a vu Andor S2 E5 avec toi'))
    expect(message()).toHaveTextContent('Invitation refusée')
    expect(point()).not.toBeNull()
    expect(requetes).toEqual(['GET /api/auth/me', LIRE, REFUSER])
  })

  // Mutations : `nEstPlus` qui rend faux (l'invitation resterait à l'écran, à jamais refusée) ; `dire` ôté
  // d'`onError` ; `relire()` ôté.
  it.each([
    ['confirmée', 409, 'Cette invitation a expiré.', CONFIRMER, 'Confirmer'],
    ['confirmée', 404, 'Cette invitation n’existe plus.', CONFIRMER, 'Confirmer'],
    ['refusée', 409, 'Cette invitation a déjà été traitée.', REFUSER, 'Refuser'],
    ['refusée', 404, 'Cette invitation n’existe plus.', REFUSER, 'Refuser'],
  ] as [string, number, string, string, string][])('%s sur un `%i` : l’invitation disparaît avec le message de l’API, la vue tient et se relit', async (_geste, status, texte, route, nom) => {
    let lectures = 0
    const { requetes } = monter({ [LIRE]: () => json(++lectures === 1 ? AVEC : TROIS), [route]: () => refus(status, texte) })
    await screen.findByText(/a vu/)

    fireEvent.click(touche(nom))

    expect(await screen.findByRole('alert')).toHaveTextContent(texte)
    await enSerie('Dark')
    expect(ecran()).toHaveTextContent('S2 E5')
    expect(screen.queryByText(/a vu/)).toBeNull()
    await vi.waitFor(() => expect(point()).toBeNull())
    await vi.waitFor(() => expect(requetes).toEqual(['GET /api/auth/me', LIRE, route, LIRE]))
    expect(screen.getByRole('dialog', { name: 'Télécommande' })).toBeInTheDocument()
  })

  // Mutation : toute erreur traitée comme une invitation disparue (`nEstPlus` qui rend vrai).
  it('sur un `500`, l’invitation reste : on peut réessayer', async () => {
    const { requetes } = monter({ [LIRE]: () => json(AVEC), [CONFIRMER]: () => refus(500, 'La confirmation a échoué.') })
    await screen.findByText(/a vu/)

    fireEvent.click(touche('Confirmer'))

    expect(await screen.findByRole('alert')).toHaveTextContent('La confirmation a échoué.')
    expect(ecran()).toHaveTextContent('bob a vu Dark S2 E5 avec toi')
    expect(point()).not.toBeNull()
    expect(requetes).toEqual(['GET /api/auth/me', LIRE, CONFIRMER])
  })
})
