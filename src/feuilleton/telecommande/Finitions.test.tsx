import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import type { ReponseDePortee } from '../../api/feuilleton'
import { exemple } from '../../test/contrat'
import { json } from '../../test/serveur'
import { adresse, ANDOR, DARK, DEUX, ecran, EXEMPLE, historique, LIRE, message, monter, refus, retenue, SESSION, SOIR, touche } from '../../test/telecommande'
import theme from '../../ui/theme.css?raw'
import feuille from './Panneau.module.css?raw'
import styles from './Panneau.module.css'

await import('../Feuilleton')
await import('../../maison/Maison')
await import('./Panneau')

const PORTEE = exemple<ReponseDePortee>('/me/feuilleton/episodes', 'put', 200)
const COCHE = exemple<unknown>('/episodes/{id}/watched', 'put', 200)
const INVITATION = EXEMPLE.a_confirmer[0]!
const LOT = 'PUT /api/me/feuilleton/episodes'
const VU = (episodeId: string) => `PUT /api/episodes/${episodeId}/watched`
const INVITER = 'POST /api/me/feuilleton/vus-a-deux'
const MEMBRES = 'GET /api/users?limit=100'
const BOB = { ...SESSION.user, id: '22222222-0000-4000-8000-000000000000', pseudo: 'bob' }
const membres = () => json({ items: [SESSION.user, BOB].map((user) => ({ user, following_count: 0, followers_count: 0, tracked_count: 0, followed_by_me: false, joined_at: '2026-01-12T09:00:00.000Z' })), next_cursor: null })
const pasDeDialogue = () => vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
const unInstant = () => new Promise((resolve) => setTimeout(resolve, 60))
/** Le bloc d'une règle de la feuille, par son sélecteur exact. */
const regle = (css: string, selecteur: string) => css.match(new RegExp(`(?:^|\\n)${selecteur.replace(/[.[\]()]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? null

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(SOIR)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('les finitions de la télécommande', () => {
  // Mutation, dans `adresse.ts` : la branche `else if (trace.pas > 0)` de `fermer` ôtée (le paramètre
  // n'était ôté que de la vue poussée : l'entrée de l'adresse, dessous, rouvrait le panneau).
  it.each([
    ['une vue', async () => fireEvent.click(touche(/^En cours/))],
    [
      'deux vues',
      async () => {
        fireEvent.click(touche(/^En cours/))
        fireEvent.click(await screen.findByRole('button', { name: 'Régler la télécommande sur Andor' }))
        await vi.waitFor(() => expect(adresse()).toBe(`/feuilleton/maison?telecommande=serie-${ANDOR.id}`))
      },
    ],
  ])('1. ouvert par son adresse, %s poussée(s), fermé par le bouton : le retour du téléphone ne le rouvre pas', async (_cas, pousser) => {
    monter({ [LIRE]: () => json(DEUX) })
    await screen.findByRole('heading', { level: 3, name: 'Dark' })
    await pousser()

    fireEvent.click(touche('Fermer la télécommande'))
    await pasDeDialogue()
    expect(adresse()).toBe('/feuilleton/maison')

    act(() => historique(-1))
    await unInstant()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(adresse()).toBe('/feuilleton/maison')
  })

  // Mutations : dans `VueTelecommande.tsx`, `styles.petit` ôté de l'écran d'une invitation (ou d'une série) ;
  // dans `Panneau.module.css`, la règle `.ecran.petit .sujet` ôtée ; dans `theme.css`, le jeton ramené à une
  // autre mesure que l'affiche. La hauteur elle-même se mesure dans un navigateur (154 px dans les deux états).
  it('2. le petit écran a la même hauteur pour une invitation et pour une série : le même sujet, haut comme une affiche', async () => {
    let lectures = 0
    monter({ [LIRE]: () => json(++lectures === 1 ? { ...DEUX, a_confirmer: [INVITATION] } : DEUX), [`POST /api/me/feuilleton/vus-a-deux/${INVITATION.id}/refuser`]: () => json(exemple('/me/feuilleton/vus-a-deux/{id}/refuser', 'post', 200)) })
    await screen.findByText(/a vu/)
    expect(ecran()).toHaveAttribute('data-etat', 'invitation')
    expect(ecran().classList.contains(styles.petit!)).toBe(true)

    fireEvent.click(touche('Refuser'))
    await screen.findByRole('heading', { level: 3, name: 'Dark' })
    expect(ecran()).toHaveAttribute('data-etat', 'serie')
    expect(ecran().classList.contains(styles.petit!)).toBe(true)

    expect(styles.petit).toBeTruthy()
    expect(regle(feuille, '.ecran.petit .sujet')).toContain('min-height: var(--telecommande-sujet-hauteur);')
    expect(theme).toContain('--telecommande-sujet-hauteur: calc(var(--largeur-affiche-ligne) * 3 / 2);')
  })

  // Mutation, dans `vivante.ts` : `setAvis(null)` ôté du changement de vue (« 2 épisodes notés » reparaîtrait en tête de la liste).
  it('3. un avis part avec sa vue : il ne reparaît pas dans la vue suivante', async () => {
    monter({ [LIRE]: () => json(DEUX), [LOT]: () => json(PORTEE) })
    await screen.findByRole('heading', { level: 3, name: 'Dark' })
    fireEvent.click(touche('Tout jusqu’ici'))
    await vi.waitFor(() => expect(message()).toHaveTextContent('2 épisodes notés'))

    fireEvent.click(touche(/^En cours/))

    await screen.findByRole('list', { name: 'En cours' })
    expect(message()).toBeNull()
    expect(screen.queryByText('2 épisodes notés')).toBeNull()
  })

  // Mutation, dans `vivante.ts` : `annulerLeVu(true)` donné à la liste (la télécommande s'ouvrirait sur Andor).
  it('4. « Annuler » dans la liste ne fait que décocher : la télécommande reste réglée comme avant, sur la série regardée en dernier', async () => {
    const vu = VU(ANDOR.prochain!.id)
    const { corps, ecritures } = monter({ [LIRE]: () => json(DEUX), [vu]: () => json(COCHE) }, 'en-cours')
    fireEvent.click(await screen.findByRole('button', { name: 'Vu : Andor, S1 E3' }))
    await vi.waitFor(() => expect(message()).not.toBeNull())

    fireEvent.click(within(message()!).getByRole('button', { name: 'Annuler' }))
    await vi.waitFor(() => expect(ecritures()).toEqual([vu, vu]))
    expect(corps).toEqual([{ watched: true }, { watched: false }])

    fireEvent.click(touche('Retour : Télécommande'))
    await screen.findByRole('group', { name: 'Aller à' })
    expect(ecran()).toHaveTextContent('Dark')
    expect(ecran()).not.toHaveTextContent('Andor')
  })

  // Mutation, dans `vivante.ts` : `!annules.current.has(episodeId)` ôté (« Épisode noté, mais bob l'a déjà
  // reçu » s'afficherait, alors que l'épisode vient d'être décoché).
  it('5. « Annuler » touché, puis l’invitation du vu à deux échoue : l’échec ne se dit pas', async () => {
    const vu = VU(DARK.prochain!.id)
    const coche = retenue()
    let coches = 0
    const { ecritures } = monter({ [LIRE]: () => json(DEUX), [MEMBRES]: membres, [vu]: () => (++coches === 1 ? coche.promesse : json(COCHE)), [INVITER]: () => refus(409, 'Tu as déjà proposé cet épisode à ce membre.') })
    await screen.findByRole('heading', { level: 3, name: 'Dark' })
    fireEvent.click(touche('Vu à deux'))
    fireEvent.click(await screen.findByRole('button', { name: /bob/ }))
    await vi.waitFor(() => expect(message()).toHaveTextContent('Proposé à bob'))

    fireEvent.click(within(message()!).getByRole('button', { name: 'Annuler' }))
    coche.rendre(json(COCHE))

    await vi.waitFor(() => expect(ecritures()).toEqual([vu, INVITER, vu]))
    await unInstant()
    expect(screen.queryByText(/déjà reçu/)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  // Mutations, dans `Panneau.module.css` : `max-width` ôté du boîtier ; `margin: 0 auto` ; une règle par
  // vue (`[data-vue=…]`) qui change sa largeur. Le rendu se vérifie sur capture (1280 px : 480 px, centré).
  it('6. sur grand écran le boîtier est centré et de largeur bornée, d’une seule règle pour toutes les vues', () => {
    const boitier = regle(feuille, '.boitier')!
    expect(boitier).toContain('max-width: var(--telecommande-largeur);')
    expect(boitier).toContain('margin: 0 auto;')
    expect(boitier).toMatch(/left: 0;\s+right: 0;/)
    expect(feuille).not.toMatch(/data-vue/)
  })

  // Mutation, dans `Panneau.module.css` : le bloc `@media (max-height: 40rem)` ôté, ou son `gap` remis à
  // `--espace-3`. Mesuré dans un navigateur à 320 × 568 : le bas d'« Aller à » passe de 519 à 495 px, pour un bord à 508.
  it('7. sur un écran bas, les espacements du boîtier et de sa vue se resserrent d’un cran', () => {
    const bas = feuille.match(/@media \(max-height: 40rem\) \{\s*\.boitier,\s*\.vue \{([^}]*)\}/)?.[1]
    expect(bas).toContain('gap: var(--espace-2);')
    expect(regle(feuille, '.boitier')).toContain('gap: var(--espace-3);')
    expect(regle(feuille, '.vue')).toContain('gap: var(--espace-3);')
  })
})
