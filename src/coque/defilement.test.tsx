import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { createQueryClient } from '../api/queryClient'
import { cles } from '../api/cles'
import { exemple } from '../test/contrat'
import { json, servir } from '../test/serveur'
import { ROUTES_ACCUEIL } from '../test/routesAccueil'
import { visionnage } from '../test/journal'
import { DELAI_RESTAURATION, restaurer, sauter } from './defilement'
import { oublierLesDeplis } from '../cinema/depli'

afterEach(oublierLesDeplis)

const SESSION = exemple<{ user: { pseudo: string } }>('/auth/me', 'get', 200)
const FILMS = Array.from({ length: 20 }, (_, i) =>
  visionnage({ id: `e${i}`, titre: `Film ${i}`, date: `2026-09-${String(28 - i).padStart(2, '0')}` }),
)
const JOURNAL = 'GET /api/me/journal?limit=20'

/** Un lien de la zone compte pour cent pixels, la fenêtre en montre cinq cents. */
const PAR_LIEN = 100
const FENETRE = 500

/**
 * jsdom ne met rien en page : `scrollTop` y garde toute valeur. Ici, comme dans un navigateur, il
 * est borné par la hauteur du contenu, que les liens de la zone donnent. Une liste pas encore
 * rechargée ramène donc la position à son plus bas, ce qui est tout le problème du retour.
 */
function borner(zone: HTMLElement) {
  let haut = 0
  const plusBas = () => Math.max(0, zone.querySelectorAll('a').length * PAR_LIEN - FENETRE)
  Object.defineProperty(zone, 'scrollTop', {
    configurable: true,
    get: () => haut,
    set: (v: number) => {
      haut = Math.min(Math.max(0, v), plusBas())
    },
  })
}

/** Le membre fait défiler la zone : la position bouge, puis l'événement part. */
function defiler(zone: HTMLElement, y: number) {
  zone.scrollTop = y
  fireEvent.scroll(zone)
}

/** Le geste « retour » du téléphone, que la page ne dessine pas. */
let historique!: NavigateFunction
function Historique() {
  historique = useNavigate()
  return null
}

function monter(depart = '/') {
  const client = createQueryClient()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[depart]}>
        <Historique />
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

const ouvrirFilm = async (zone: HTMLElement, i: number) => {
  fireEvent.click(zone.querySelector(`a[href="/journal/e${i}"]`)!)
  await screen.findByRole('heading', { level: 1, name: `Film ${i}` })
}

/** L'accueil, sa grille de vingt films affichée, la zone bornée et descendue à 1 200 px. */
async function accueilDescendu(routes: Record<string, () => Response | Promise<Response>> = {}) {
  servir({
    'GET /api/auth/me': () => json(SESSION),
    ...ROUTES_ACCUEIL,
    [JOURNAL]: () => json({ items: FILMS, next_cursor: null }),
    'GET /api/reference/reactions': () => json(exemple('/reference/reactions', 'get', 200)),
    ...routes,
  })
  const client = monter()
  const zone = await screen.findByRole('main')
  await waitFor(() => expect(zone.querySelector('a[href="/journal/e19"]')).not.toBeNull())
  borner(zone)
  defiler(zone, 1200)
  return { client, zone }
}

describe('le défilement de la coque', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('un retour par l’historique retrouve la place quittée dans la liste', async () => {
    const { zone } = await accueilDescendu()
    await ouvrirFilm(zone, 14)
    expect(zone.scrollTop).toBe(0)

    act(() => historique(-1))

    await screen.findByRole('heading', { level: 1, name: /^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche) /u })
    expect(zone.scrollTop).toBe(1200)
  })

  it('« Retour » de la fiche fait de même : il recule, il ne rouvre pas la liste', async () => {
    const { zone } = await accueilDescendu()
    await ouvrirFilm(zone, 14)

    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))

    await screen.findByRole('heading', { level: 1, name: /^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche) /u })
    expect(zone.scrollTop).toBe(1200)
  })

  it('une navigation nouvelle vers la même liste part du haut', async () => {
    const { zone } = await accueilDescendu()
    await ouvrirFilm(zone, 14)

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Onglets' })).getByRole('link', { name: 'Accueil' }))

    await waitFor(() => expect(zone.querySelector('a[href="/journal/e19"]')).not.toBeNull())
    expect(zone.scrollTop).toBe(0)
  })

  it('une liste sortie du cache retrouve la place une fois ses pages revenues', async () => {
    const { client, zone } = await accueilDescendu()
    await ouvrirFilm(zone, 14)
    client.removeQueries({ queryKey: cles.journal })

    act(() => historique(-1))

    // D'abord « Chargement… » : la zone est trop courte, la position tombe à son plus bas. Lu sans
    // attendre : « Tes séances » de la section Au ciné, sous le préfixe `journal`, attend elle aussi,
    // et un `findByRole` ne rendrait la main qu'une des deux attentes partie.
    for (const statut of screen.getAllByRole('status')) expect(statut).toHaveTextContent('Chargement')
    expect(zone.scrollTop).toBe(0)
    await waitFor(() => expect(zone.scrollTop).toBe(1200))
  })

  it('un geste pendant le rechargement laisse le membre où il est', async () => {
    let liberer!: () => void
    let deja = false
    const { client, zone } = await accueilDescendu({
      // La première lecture répond tout de suite ; la seconde, au retour, attend le test.
      [JOURNAL]: () => {
        if (!deja) {
          deja = true
          return json({ items: FILMS, next_cursor: null })
        }
        return new Promise<Response>((r) => (liberer = () => r(json({ items: FILMS, next_cursor: null }))))
      },
    })
    await ouvrirFilm(zone, 14)
    client.removeQueries({ queryKey: cles.journal })
    act(() => historique(-1))
    await screen.findByRole('status')

    fireEvent.touchStart(zone)
    act(() => liberer())

    await waitFor(() => expect(zone.querySelector('a[href="/journal/e19"]')).not.toBeNull())
    expect(zone.scrollTop).toBe(0)
  })
})

/**
 * jsdom ne met rien en page : tout rectangle y est nul. Ici la section « Au ciné » se tient à `haut`
 * pixels du début du contenu, où que la zone en soit de son défilement, comme dans un navigateur.
 */
function poserLaSection(haut: { valeur: number }) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const zone = document.querySelector('main')
    const top = this.id === 'au-cine' ? haut.valeur - (zone?.scrollTop ?? 0) : 0
    return { top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) }
  })
}

describe('l’arrivée sur la section Au ciné', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const servirAccueil = () =>
    servir({
      'GET /api/auth/me': () => json(SESSION),
      ...ROUTES_ACCUEIL,
      [JOURNAL]: () => json({ items: FILMS, next_cursor: null }),
      'GET /api/reference/reactions': () => json(exemple('/reference/reactions', 'get', 200)),
    })
  const accueilArrive = (zone: HTMLElement) => waitFor(() => expect(zone.querySelector('a[href="/journal/e19"]')).not.toBeNull())

  // Mutation, dans `useDefilementMemorise` : la branche de l'ancre retirée (la page s'ouvre en haut).
  it.each(['/#au-cine', '/au-cine'])('%s ouvre l’accueil sur la section, pas en haut', async (depart) => {
    poserLaSection({ valeur: 700 })
    servirAccueil()
    monter(depart)

    const zone = await screen.findByRole('main')
    await accueilArrive(zone)
    expect(zone.scrollTop).toBe(700)
  })

  // Mutation : `sauter` appelé sans regarder l'ancre (toute arrivée sur l'accueil sauterait).
  it('sans l’ancre, l’accueil s’ouvre en haut : l’exception ne vaut que pour cette arrivée', async () => {
    poserLaSection({ valeur: 700 })
    servirAccueil()
    monter('/')

    const zone = await screen.findByRole('main')
    await accueilArrive(zone)
    expect(zone.scrollTop).toBe(0)
  })

  // Mutation : `ancre !== ''` au lieu de l'ancre d'Au ciné : n'importe quelle ancre ferait sauter.
  it('une autre ancre ne fait rien sauter', async () => {
    poserLaSection({ valeur: 700 })
    servirAccueil()
    monter('/#titre-journal')

    const zone = await screen.findByRole('main')
    await accueilArrive(zone)
    expect(zone.scrollTop).toBe(0)
  })

  // Mutation : la position mémorisée lue après l'ancre : au retour, la page resauterait à la section
  // au lieu de rendre la place quittée.
  it('au retour sur cette entrée, c’est la place quittée qui revient, pas la section', async () => {
    poserLaSection({ valeur: 700 })
    servirAccueil()
    monter('/#au-cine')
    const zone = await screen.findByRole('main')
    await accueilArrive(zone)
    fireEvent.wheel(zone)
    defiler(zone, 1500)
    await ouvrirFilm(zone, 14)
    expect(zone.scrollTop).toBe(0)

    act(() => historique(-1))

    await accueilArrive(zone)
    expect(zone.scrollTop).toBe(1500)
  })

  // Mutation, dans `useDefilementMemorise` : `if (cible)` au lieu de `cible !== undefined` : une
  // position notée `0` passerait pour absente, et le retour resauterait à la section.
  it('au retour sur cette entrée laissée tout en haut, la page reste en haut : zéro est une place quittée', async () => {
    poserLaSection({ valeur: 700 })
    servirAccueil()
    monter('/#au-cine')
    const zone = await screen.findByRole('main')
    await accueilArrive(zone)
    expect(zone.scrollTop).toBe(700)
    fireEvent.wheel(zone)
    defiler(zone, 0)
    await ouvrirFilm(zone, 3)

    act(() => historique(-1))

    await accueilArrive(zone)
    expect(zone.scrollTop).toBe(0)
  })

  const SEANCES = Array.from({ length: 6 }, (_, i) =>
    visionnage({ id: `s${i}`, titre: `Séance ${i}`, date: `2026-08-${String(20 - i).padStart(2, '0')}` }),
  )

  // Vingt films au journal : le plus bas de la zone est 1 500 px tant que « Tes séances » est repliée,
  // 2 100 px avec ses six lignes. La place quittée, 1 900 px, n'existe que la liste dépliée.
  // Mutation, dans `cinema/depli.ts` : l'état gardé dans un `useState` du composant : au retour la
  // liste est repliée, la zone trop courte, et la position reste à 1 500.
  it('« Tes séances » dépliée, une séance ouverte : le retour rend la liste dépliée et la ligne quittée', async () => {
    servir({
      'GET /api/auth/me': () => json(SESSION),
      ...ROUTES_ACCUEIL,
      [JOURNAL]: () => json({ items: FILMS, next_cursor: null }),
      'GET /api/me/journal?limit=40&reaction=en_salle': () => json({ items: SEANCES, next_cursor: null }),
      'GET /api/reference/reactions': () => json(exemple('/reference/reactions', 'get', 200)),
    })
    monter('/')
    const zone = await screen.findByRole('main')
    await accueilArrive(zone)
    borner(zone)
    fireEvent.click(await screen.findByRole('button', { name: 'Tout voir' }))
    expect(zone.querySelector('a[href="/journal/s5"]')).not.toBeNull()
    defiler(zone, 1900)
    expect(zone.scrollTop).toBe(1900)
    fireEvent.click(zone.querySelector('a[href="/journal/s5"]')!)
    await screen.findByRole('heading', { level: 1, name: 'Séance 5' })

    act(() => historique(-1))

    await accueilArrive(zone)
    expect(zone.querySelector('a[href="/journal/s5"]')).not.toBeNull()
    expect(zone.scrollTop).toBe(1900)
  })
})

describe('sauter', () => {
  let zone: HTMLElement
  const haut = { valeur: 400 }
  const pousser = async (de: number) => {
    haut.valeur += de
    await act(async () => {
      zone.append(document.createElement('p'))
      await Promise.resolve()
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    haut.valeur = 400
    zone = document.createElement('main')
    const section = document.createElement('section')
    section.id = 'au-cine'
    zone.append(section)
    document.body.append(zone)
    poserLaSection(haut)
  })
  afterEach(() => {
    zone.remove()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // Mutation : l'observateur retiré de `sauter` : la section poussée par ce qui arrive au-dessus d'elle
  // sortirait de l'écran.
  it('la section poussée par ce qui arrive au-dessus d’elle est reprise', async () => {
    sauter(zone, 'au-cine')
    expect(zone.scrollTop).toBe(400)

    await pousser(250)

    expect(zone.scrollTop).toBe(650)
  })

  // Mutation : les gestes non écoutés : la page reprendrait la main au membre qui défile.
  it('un geste du membre y met fin', async () => {
    sauter(zone, 'au-cine')
    fireEvent.touchStart(zone)

    await pousser(250)

    expect(zone.scrollTop).toBe(400)
  })

  // Mutation : la minuterie retirée : une donnée tardive ferait sauter la page des secondes après.
  it('passé le délai, un contenu qui arrive ne fait plus sauter la page', async () => {
    sauter(zone, 'au-cine')
    vi.advanceTimersByTime(DELAI_RESTAURATION)

    await pousser(250)

    expect(zone.scrollTop).toBe(400)
  })

  // Mutation : sans élément, la zone remise en haut (`zone.scrollTop = element ? hautDe(zone, element) : 0`).
  it('sans la section dans la page, rien ne bouge', () => {
    zone.querySelector('section')!.remove()
    zone.scrollTop = 120

    sauter(zone, 'au-cine')

    expect(zone.scrollTop).toBe(120)
  })
})

describe('restaurer', () => {
  /** Une zone bornée qui reçoit ses liens après coup, comme une page rechargée. */
  function zoneVide() {
    const zone = document.createElement('div')
    document.body.append(zone)
    borner(zone)
    return zone
  }
  const remplir = (zone: HTMLElement) => zone.append(...Array.from({ length: 20 }, () => document.createElement('a')))

  afterEach(() => {
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  it('la position est reposée quand le contenu arrive dans le délai', async () => {
    vi.useFakeTimers()
    const zone = zoneVide()
    restaurer(zone, 1200)

    vi.advanceTimersByTime(DELAI_RESTAURATION - 1)
    remplir(zone)
    await Promise.resolve()

    expect(zone.scrollTop).toBe(1200)
  })

  it('passé le délai, un contenu qui arrive ne fait plus sauter la page', async () => {
    vi.useFakeTimers()
    const zone = zoneVide()
    restaurer(zone, 1200)

    vi.advanceTimersByTime(DELAI_RESTAURATION)
    remplir(zone)
    await Promise.resolve()

    expect(zone.scrollTop).toBe(0)
  })

  it('une fois la position atteinte, un contenu qui change encore ne la reprend plus', async () => {
    const zone = zoneVide()
    restaurer(zone, 1200)
    remplir(zone)
    await Promise.resolve()
    expect(zone.scrollTop).toBe(1200)

    zone.scrollTop = 300
    zone.append(document.createElement('a'))
    await Promise.resolve()

    expect(zone.scrollTop).toBe(300)
  })
})
