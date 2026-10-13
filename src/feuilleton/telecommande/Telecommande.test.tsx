import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRef } from 'react'
import App from '../../App'
import { createQueryClient } from '../../api/queryClient'
import { exemple } from '../../test/contrat'
import { json, servir } from '../../test/serveur'
import { HABILLAGES } from '../habillages'
import Bouton from './Bouton'
import Panneau from './Panneau'

// Les morceaux se chargent à la demande dans l'app (`paresseux`) : chargés d'avance, aucun test ne paie
// leur compilation dans le délai d'un `findByRole`.
await import('../Feuilleton')
await import('../../studio/Studio')
await import('../../maison/Maison')
await import('./Panneau')

const SESSION = exemple<{ user: { pseudo: string } }>('/auth/me', 'get', 200)
const HEURE_DE_TRAVAIL = new Date('2026-10-14T08:00:00Z')
const SOIR = new Date('2026-10-14T19:00:00Z')

/** L'adresse affichée, et le geste « retour » du téléphone, que la page ne dessine pas. */
let historique!: NavigateFunction
function Ou() {
  historique = useNavigate()
  const { pathname, search } = useLocation()
  return <output data-testid="adresse">{pathname + search}</output>
}

function monter(chemin: string) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[chemin]}>
        <App />
        <Ou />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const adresse = () => screen.getByTestId('adresse').textContent
const boutonRond = () => screen.findByRole('button', { name: 'Télécommande' })
const dialogue = () => screen.findByRole('dialog', { name: 'Télécommande' })
const pasDeDialogue = () => vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
const ouvrir = async () => {
  fireEvent.click(await boutonRond())
  return dialogue()
}

describe('la télécommande du Feuilleton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(SOIR)
    servir({ 'GET /api/auth/me': () => json(SESSION) })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Mutations, dans `Feuilleton.tsx` : `<Bouton>` ôté ; `<Bouton>` monté dans la `nav` des espaces ;
  // dans `Bouton.tsx` : le nom « Télécommande » ôté.
  it.each([
    ['/feuilleton/studio', 'Travail'],
    ['/feuilleton/maison', 'Maison'],
  ])('sur %s, un vrai bouton nommé « Télécommande », hors de la navigation des espaces', async (chemin, titre) => {
    monter(chemin)
    await screen.findByRole('heading', { level: 1, name: titre })

    const bouton = await boutonRond()
    expect(bouton.tagName).toBe('BUTTON')
    expect(bouton).toHaveAttribute('aria-haspopup', 'dialog')
    expect(bouton).toHaveAttribute('aria-expanded', 'false')
    expect(within(screen.getByRole('navigation', { name: 'Espaces du Feuilleton' })).queryByRole('button')).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Espaces du Feuilleton' }).contains(bouton)).toBe(false)
    expect(screen.getByRole('navigation', { name: 'Onglets' }).contains(bouton)).toBe(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // Mutations, dans `adresse.ts` : `ouvrir` qui ne navigue pas ; dans `Feuilleton.tsx` : `ouvert` forcé à
  // faux (le dialogue ne monterait pas), l'effet `inert` ôté.
  it('le bouton pose `?telecommande=` sur l’adresse de l’espace et monte le dialogue ; la page dessous devient inerte', async () => {
    monter('/feuilleton/maison')
    const titre = await screen.findByRole('heading', { level: 1, name: 'Maison' })
    const bouton = await boutonRond()

    fireEvent.click(bouton)

    const panneau = await dialogue()
    expect(adresse()).toBe('/feuilleton/maison?telecommande=telecommande')
    expect(panneau).toHaveAttribute('aria-modal', 'true')
    expect(panneau).toHaveAttribute('data-vue', 'telecommande')
    expect(bouton).toHaveAttribute('aria-expanded', 'true')
    expect(titre.closest('[inert]')).not.toBeNull()
    expect(panneau.closest('[inert]')).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Onglets' }).closest('[inert]')).toBeNull()
    // La page n'a pas été remontée : `<Filet key={pathname}>` ne voit pas la recherche changer
    // (mutation, dans `Coque.tsx` : `<Filet key={key}>`).
    expect(titre.isConnected).toBe(true)
    expect(bouton.isConnected).toBe(true)
  })

  // Mutations, dans `dialogue.ts` : le `focus()` de l'ouverture ôté ; le retour du focus ôté.
  it('le focus entre dans le dialogue à l’ouverture, et revient au bouton à la fermeture', async () => {
    monter('/feuilleton/maison')
    const bouton = await boutonRond()
    bouton.focus()

    const panneau = await ouvrir()
    await vi.waitFor(() => expect(panneau.contains(document.activeElement)).toBe(true))

    fireEvent.click(within(panneau).getByRole('button', { name: 'Fermer la télécommande' }))

    await pasDeDialogue()
    expect(adresse()).toBe('/feuilleton/maison')
    expect(document.activeElement).toBe(bouton)
    expect(screen.getByRole('heading', { level: 1, name: 'Maison' }).closest('[inert]')).toBeNull()
  })

  // Mutation, dans `dialogue.ts` : la branche `Tab` ôtée (le focus sortirait vers la barre d'onglets).
  it('le focus est tenu dedans : Tab tourne de la dernière touche à la première, et Maj+Tab à l’envers', async () => {
    monter('/feuilleton/maison')
    const panneau = await ouvrir()
    const touches = within(panneau).getAllByRole('button').filter((b) => !(b as HTMLButtonElement).disabled)
    const premiere = touches[0]!
    const derniere = touches[touches.length - 1]!

    derniere.focus()
    expect(fireEvent.keyDown(derniere, { key: 'Tab' })).toBe(false)
    expect(document.activeElement).toBe(premiere)

    expect(fireEvent.keyDown(premiere, { key: 'Tab', shiftKey: true })).toBe(false)
    expect(document.activeElement).toBe(derniere)

    // Parti ailleurs (un toucher sur la barre d'onglets, restée touchable), Tab l'y ramène.
    const onglet = within(screen.getByRole('navigation', { name: 'Onglets' })).getByRole('link', { name: 'Profil' })
    onglet.focus()
    fireEvent.keyDown(onglet, { key: 'Tab' })
    expect(document.activeElement).toBe(premiere)
  })

  // Mutation, dans `dialogue.ts` : la branche `Escape` ôtée.
  it('Échap le ferme', async () => {
    monter('/feuilleton/studio')
    const panneau = await ouvrir()

    fireEvent.keyDown(panneau, { key: 'Escape' })

    await pasDeDialogue()
    expect(adresse()).toBe('/feuilleton/studio')
    expect(document.activeElement).toBe(await boutonRond())
  })

  // Mutation, dans `adresse.ts` : `ouvrir` en `replace: true` (le retour quitterait le Feuilleton).
  it('ouvrir pousse une entrée : le retour du téléphone ferme, et reste sur l’espace', async () => {
    monter('/feuilleton/studio')
    await ouvrir()

    act(() => historique(-1))

    await pasDeDialogue()
    expect(adresse()).toBe('/feuilleton/studio')
    expect(screen.getByRole('heading', { level: 1, name: 'Travail' })).toBeInTheDocument()
  })

  // Mutations, dans `Panneau.tsx` : `onClick={fermer}` ôté du voile ; dans `adresse.ts` : `fermer` qui
  // recule d'une seule entrée quelle que soit la vue (la fermeture depuis une vue rendrait la télécommande).
  it('toucher le voile ferme, depuis une vue aussi, d’un seul geste', async () => {
    monter('/feuilleton/maison')
    const panneau = await ouvrir()
    fireEvent.click(within(panneau).getByRole('button', { name: /^En cours/ }))
    await vi.waitFor(() => expect(adresse()).toBe('/feuilleton/maison?telecommande=en-cours'))

    fireEvent.click(document.querySelector('[data-piece="voile"]')!)

    await pasDeDialogue()
    expect(adresse()).toBe('/feuilleton/maison')
  })

  // Mutations, dans `VueTelecommande.tsx` : une touche « Aller à » menée à une autre vue ; dans
  // `adresse.ts` : `allerA` en `replace` (le retour du téléphone fermerait au lieu de revenir).
  it.each([
    [/^En cours/, 'en-cours', 'En cours'],
    ['Ajouter', 'ajouter', 'Ajouter une série'],
  ] as [string | RegExp, string, string][])('« Aller à » %s ouvre la vue `%s` dans le même boîtier ; le retour du téléphone revient à la télécommande', async (touche, vue, titre) => {
    monter('/feuilleton/maison')
    const panneau = await ouvrir()

    fireEvent.click(within(panneau).getByRole('button', { name: touche }))

    expect(await within(panneau).findByRole('heading', { level: 2, name: titre })).toBeInTheDocument()
    expect(adresse()).toBe(`/feuilleton/maison?telecommande=${vue}`)
    expect(panneau.isConnected).toBe(true)
    expect(panneau).toHaveAttribute('data-vue', vue)
    await vi.waitFor(() => expect(document.activeElement).toBe(panneau))

    act(() => historique(-1))

    await vi.waitFor(() => expect(adresse()).toBe('/feuilleton/maison?telecommande=telecommande'))
    expect(within(panneau).getByRole('group', { name: 'Aller à' })).toBeInTheDocument()
  })

  // Mutation, dans `adresse.ts` : `revenir` qui pousse la vue parente au lieu de reculer (le retour du
  // téléphone rouvrirait alors la vue qu'on vient de quitter).
  it('le retour dessiné d’une vue recule : après lui, le retour du téléphone ferme', async () => {
    monter('/feuilleton/maison')
    const panneau = await ouvrir()
    fireEvent.click(within(panneau).getByRole('button', { name: 'Ajouter' }))
    await within(panneau).findByRole('heading', { level: 2, name: 'Ajouter une série' })

    fireEvent.click(within(panneau).getByRole('button', { name: 'Retour : Télécommande' }))
    await vi.waitFor(() => expect(adresse()).toBe('/feuilleton/maison?telecommande=telecommande'))

    act(() => historique(-1))
    await pasDeDialogue()
    expect(adresse()).toBe('/feuilleton/maison')
  })

  // Mutations : dans `Feuilleton.tsx`, `ouvert` forcé à faux ; dans `vues.ts`, la fiche lue comme la vue d'ouverture.
  it.each([
    ['telecommande', 'telecommande'],
    ['en-cours', 'en-cours'],
    ['ajouter', 'ajouter'],
    ['a-deux', 'a-deux'],
    ['fiche-m42', 'fiche'],
  ])('l’adresse directe `?telecommande=%s` ouvre le panneau sur sa vue', async (valeur, vue) => {
    monter(`/feuilleton/studio?telecommande=${valeur}`)

    const panneau = await dialogue()
    expect(panneau).toHaveAttribute('data-vue', vue)
    expect(screen.getByRole('heading', { level: 1, name: 'Travail' })).toBeInTheDocument()
  })

  // Mutations, dans `adresse.ts` : `fermer` qui recule toujours (une adresse ouverte telle quelle n'a
  // rien derrière : on quitterait l'app) ; `revenir` de même.
  it('ouvert par son adresse, sans rien derrière : le retour dessiné mène à la vue parente, la fermeture ôte le paramètre', async () => {
    monter('/feuilleton/studio?telecommande=fiche-m42')
    const panneau = await dialogue()

    fireEvent.click(within(panneau).getByRole('button', { name: 'Retour : En cours' }))
    await vi.waitFor(() => expect(adresse()).toBe('/feuilleton/studio?telecommande=en-cours'))

    fireEvent.click(within(panneau).getByRole('button', { name: 'Fermer la télécommande' }))
    await pasDeDialogue()
    expect(adresse()).toBe('/feuilleton/studio')
    expect(screen.getByRole('heading', { level: 1, name: 'Travail' })).toBeInTheDocument()
  })

  // Mutation, dans `Feuilleton.tsx` : la redirection sans `search` (`to={ESPACES[…].chemin}`).
  it.each([
    { quand: 'en journée', instant: HEURE_DE_TRAVAIL, arrivee: '/feuilleton/studio?telecommande=en-cours' },
    { quand: 'le soir', instant: SOIR, arrivee: '/feuilleton/maison?telecommande=en-cours' },
  ])('$quand, `/feuilleton?telecommande=en-cours` choisit l’espace de l’heure et garde le paramètre', async ({ instant, arrivee }) => {
    vi.setSystemTime(instant)
    monter('/feuilleton?telecommande=en-cours')

    expect(await dialogue()).toHaveAttribute('data-vue', 'en-cours')
    expect(adresse()).toBe(arrivee)
  })
})

describe('ce qui attend : le point du bouton, le voyant du panneau', () => {
  const HABILLAGE = HABILLAGES['chapitre-1']
  const bouton = (invitation: boolean) => render(<Bouton habillage={HABILLAGE} chapitre="chapitre-1" invitation={invitation} ouvert={false} onOuvrir={() => {}} />)
  const panneau = (invitation: boolean) =>
    render(
      <MemoryRouter initialEntries={['/feuilleton/maison?telecommande=telecommande']}>
        <Panneau habillage={HABILLAGE} chapitre="chapitre-1" boutonRond={createRef()} invitation={invitation} />
      </MemoryRouter>,
    )

  // Mutation, dans `Bouton.tsx` : le point rendu sans condition.
  it('sans invitation, le bouton n’a pas de point', () => {
    bouton(false)
    expect(document.querySelector('[data-piece="point"]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Télécommande' })).not.toHaveAccessibleDescription()
  })

  // Mutation, dans `Bouton.tsx` : le point jamais rendu.
  it('une invitation qui attend y pose le point, et le dit', () => {
    bouton(true)
    expect(document.querySelector('[data-piece="point"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Télécommande' })).toHaveAccessibleDescription('Une invitation attend')
  })

  // Mutation, dans `Panneau.tsx` : le voyant rendu éteint quand rien n'attend (il se lisait comme une case à cocher).
  it('sans invitation, aucun voyant dans le bandeau : rien entre le titre et la fermeture', () => {
    panneau(false)
    const bandeau = screen.getByRole('dialog').querySelector('header')!
    expect(document.querySelector('[data-piece="voyant"]')).toBeNull()
    expect(within(bandeau).queryByRole('img')).toBeNull()
    expect(bandeau.children).toHaveLength(2)
  })

  // Mutation, dans `Panneau.tsx` : le voyant jamais rendu.
  it('une invitation qui attend allume le voyant', () => {
    panneau(true)
    expect(within(screen.getByRole('dialog')).getByRole('img', { name: 'Une invitation attend' })).toHaveAttribute('data-piece', 'voyant')
  })
})

describe('le bouton et le panneau, par défaut', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    servir({ 'GET /api/auth/me': () => json(SESSION) })
  })
  afterEach(() => vi.unstubAllGlobals())

  // Mutation, dans `donnees.ts` : `useInvitationEnAttente` qui rend vrai.
  it('tant que rien n’est lu de l’API, ni point ni voyant', async () => {
    monter('/feuilleton/maison?telecommande=telecommande')
    await dialogue()
    expect(document.querySelector('[data-piece="point"]')).toBeNull()
    expect(document.querySelector('[data-piece="voyant"]')).toBeNull()
  })
})
