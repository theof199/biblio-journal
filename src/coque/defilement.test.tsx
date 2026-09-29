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
import { DELAI_RESTAURATION, restaurer } from './defilement'

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

function monter() {
  const client = createQueryClient()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
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

    // D'abord « Chargement… » : la zone est trop courte, la position tombe à son plus bas.
    expect(await screen.findByRole('status')).toHaveTextContent('Chargement')
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
