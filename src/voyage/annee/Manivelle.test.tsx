import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { cles } from '../../api/cles'
import { ApiError } from '../../api/client'
import { journalDesAnnees } from '../../api/journal'
import { lireAnnee } from '../../api/voyage'
import { PAGES_1890 } from '../../mondes/1890/pages'
import { creerRegistre } from '../../mondes'
import { monterVoyage } from '../../test/pageVoyage'
import { json } from '../../test/serveur'
import { ficheEnAttente, fichePrete, ficheVerrouillee, voyage1890 } from '../../test/voyage'
import Manivelle, { DUREE_DU_FAIT, TENUE } from './Manivelle'
import styles from './Manivelle.module.css'

const M = PAGES_1890.mots.manivelle
const MONDE = creerRegistre()(1890)

const VOYAGE = voyage1890(
  1897,
  [
    { annee: 1895, statut: 'ouverte', visitee: true, recompense: 'palme' },
    { annee: 1896, statut: 'ouverte', visitee: true, recompense: 'lion' },
    { annee: 1897, statut: 'en_cours', visitee: true, recompense: null },
    { annee: 1898, statut: 'verrouillee', visitee: false, recompense: null },
    { annee: 1899, statut: 'verrouillee', visitee: false, recompense: null },
  ],
  { ia: true, source: null, rattrape_la_source: false },
)
const FICHE = fichePrete({ annee: 1897, ticket: null, maturite: null, generique: null })
const ROUTES = {
  'GET /api/me/voyage': () => json(VOYAGE),
  'GET /api/me/voyage/annees/1897': () => json(FICHE),
}
const RELECTURE = ['GET /api/me/voyage', 'GET /api/me/voyage/annees/1897']
const BOITE = 'GET /api/me/journal?limit=100&sortie_min=1890&sortie_max=1899'

/** `matchMedia` manque à jsdom : le test pose la réponse de « moins d'animations ». */
const calme = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

/** Un geste du doigt : posé à `de`, descendu à chaque `par`, levé. Rend ce que chaque étape a laissé faire au navigateur. */
function tirer(el: Element, de: number, ...par: number[]) {
  fireEvent.touchStart(el, { touches: [{ clientY: de }] })
  const bouges = par.map((y) => fireEvent.touchMove(el, { touches: [{ clientY: y }] }))
  const fin = fireEvent.touchEnd(el, { touches: [] })
  return { bouges, fin }
}

/** La page de 1897, chargée ; `avant` garnit le cache. */
async function annee1897(routes: Record<string, () => Response | Promise<Response>> = ROUTES, entree: string | { pathname: string; search: string } = '/voyage/1897', avant?: Parameters<typeof monterVoyage>[2]) {
  const vue = monterVoyage(entree, routes, avant)
  await screen.findByRole('heading', { level: 1, name: '1897' })
  await waitFor(() => expect(vue.requetes).toEqual(expect.arrayContaining(RELECTURE)))
  const bandeau = screen.getByRole('img', { name: 'Le décor de 1897.' })
  const main = document.querySelector('main')!
  return { ...vue, bandeau, main, apres: (n: number) => vue.requetes.slice(n) }
}

/** La manivelle seule, dans la zone qui défile de la coque. */
function monterSeule(onRecharger: () => Promise<unknown>, enfants: ReactNode =<p>Le programme</p>) {
  const vue = render(
    <main>
      <Manivelle monde={MONDE} onRecharger={onRecharger}>
        {enfants}
      </Manivelle>
    </main>,
  )
  const contenu = screen.getByTestId('contenu-manivelle')
  return { ...vue, contenu, bras: () => screen.getByTestId('manivelle').querySelector('g')! }
}

describe('la manivelle', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // Mutations : `exact` retiré (le préfixe `voyage` relit la fiche de 1896 laissée en cache) ; le
  // journal relu avec elles.
  it('tirer au-delà du seuil recharge la fiche et la carte, et elles seules', async () => {
    const { bandeau, requetes, apres } = await annee1897(
      { ...ROUTES, 'GET /api/me/voyage/annees/1896': () => json(fichePrete({ annee: 1896 })), [BOITE]: () => json({ items: [], next_cursor: null }) },
      '/voyage/1897',
      (c) => {
        // Une année visitée avant, et la boîte à billets : en cache, relisibles, hors de la page.
        c.setQueryDefaults(cles.annee(1896), { queryFn: ({ signal }) => lireAnnee(1896, signal) })
        c.setQueryData(cles.annee(1896), fichePrete({ annee: 1896 }))
        c.setQueryDefaults(cles.journalDesAnnees(1890, 1899), { queryFn: ({ signal }) => journalDesAnnees(1890, 1899, signal) })
        c.setQueryData(cles.journalDesAnnees(1890, 1899), [])
      },
    )
    const n = requetes.length
    tirer(bandeau, 10, 60, 200)
    expect(await screen.findByText(M.fait)).toBeInTheDocument()
    expect(screen.getByText(M.fait).closest('[role="status"]')).not.toBeNull()
    expect([...apres(n)].sort()).toEqual(RELECTURE)
  })

  // Autour de toute fiche, tirée de son corps. Mutations : la manivelle autour du seul bandeau ;
  // autour de la seule fiche prête ; le journal relu (ici, la page le lit : il repartirait).
  it.each([
    { cas: 'fermée', fiche: ficheVerrouillee(1898) },
    { cas: 'en attente', fiche: ficheEnAttente(1898) },
  ])('se tire aussi sur une année $cas, de n’importe où dans la fiche', async ({ fiche }) => {
    const relecture = ['GET /api/me/voyage', 'GET /api/me/voyage/annees/1898']
    const { requetes } = monterVoyage('/voyage/1898', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1898': () => json(fiche),
      'GET /api/me/journal?limit=100': () => json({ items: [], next_cursor: null }),
    })
    const titre = await screen.findByRole('heading', { level: 1, name: '1898' })
    await waitFor(() => expect(requetes).toContain('GET /api/me/journal?limit=100'))
    const n = requetes.length
    tirer(titre, 10, 200)
    expect(await screen.findByText(M.fait)).toBeInTheDocument()
    expect([...requetes.slice(n)].sort()).toEqual(relecture)
  })

  // Mutation : `aLaLachee` contourné (tout lâcher recharge).
  it('en deçà du seuil, rien ne part', async () => {
    const { bandeau, requetes, apres } = await annee1897()
    const n = requetes.length
    // 140 px de doigt : 70 de course, le seuil tout juste, pas au-delà.
    tirer(bandeau, 10, 150)
    await act(async () => undefined)
    expect(apres(n)).toEqual([])
    expect(screen.queryByText(M.charge)).toBeNull()
  })

  // Mutation : `peutTirer` sans `scrollTop` (un défilement ordinaire deviendrait un rechargement).
  it('pas au milieu de la page', async () => {
    const { bandeau, main, requetes, apres } = await annee1897()
    main.scrollTop = 120
    const n = requetes.length
    const { bouges } = tirer(bandeau, 10, 200)
    await act(async () => undefined)
    expect(bouges[0]).toBe(true)
    expect(apres(n)).toEqual([])
  })

  // Mutation : la garde des calques retirée.
  it('pas depuis la feuille du chroniqueur', async () => {
    const { requetes, apres } = await annee1897(ROUTES, { pathname: '/voyage/1897', search: '?feuille=ouverture' })
    const feuille = screen.getByRole('dialog')
    const n = requetes.length
    const { bouges } = tirer(feuille, 10, 200)
    await act(async () => undefined)
    expect(bouges[0]).toBe(true)
    expect(apres(n)).toEqual([])
  })

  // Un feuillet porte son voile hors du dialogue : un geste sur le voile tirerait la page sous le
  // calque. Mutation : la garde réduite à la cible (`cible.closest('[role="dialog"]')`).
  it('pas sous un calque ouvert, même depuis son voile', () => {
    const recharger = vi.fn(async () => undefined)
    monterSeule(
      recharger,
      <div>
        <div data-testid="voile" />
        <div role="dialog" aria-label="Choisir une marche">
          Les marches
        </div>
      </div>,
    )
    const { bouges } = tirer(screen.getByTestId('voile'), 10, 200)
    expect(bouges[0]).toBe(true)
    expect(recharger).not.toHaveBeenCalled()
  })

  // Mutation : la garde de la saisie retirée.
  it('pas pendant une saisie : le clavier ouvert, le doigt déplace le texte', () => {
    const recharger = vi.fn(async () => undefined)
    monterSeule(
      recharger,
      <div>
        <p>Le programme</p>
        <input aria-label="Chercher" />
      </div>,
    )
    // Depuis le champ, puis depuis le reste de la page tant que le champ a le focus.
    expect(tirer(screen.getByRole('textbox'), 10, 200).bouges[0]).toBe(true)
    screen.getByRole('textbox').focus()
    expect(tirer(screen.getByText('Le programme'), 10, 200).bouges[0]).toBe(true)
    expect(recharger).not.toHaveBeenCalled()
  })

  // Mutations : `enCours` ignoré par `peutTirer` (un second tirage pendant le rechargement fait
  // descendre la page et retient le défilement) ; la garde relâchée jamais (le tirage suivant ne
  // recharge plus).
  it('un seul rechargement à la fois, puis la manivelle se retire', async () => {
    let finir: () => void = () => undefined
    const recharger = vi.fn(() => new Promise<void>((r) => (finir = r)))
    const { contenu } = monterSeule(recharger)
    tirer(contenu, 10, 200)
    const second = tirer(contenu, 10, 200)
    expect(second.bouges[0]).toBe(true)
    expect(recharger).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: M.bouton })).toBeDisabled()
    await act(async () => finir())
    expect(screen.getByRole('button', { name: M.bouton })).toBeEnabled()
    tirer(contenu, 10, 200)
    expect(recharger).toHaveBeenCalledTimes(2)
  })

  // Mutation : la garde de `recharger` retirée (deux touchers avant le rendu suivant relisent deux fois).
  it('deux touchers rapides sur le bouton ne rechargent qu’une fois', async () => {
    const recharger = vi.fn(() => new Promise<void>(() => undefined))
    monterSeule(recharger)
    const bouton = screen.getByRole('button', { name: M.bouton })
    act(() => {
      bouton.click()
      bouton.click()
    })
    expect(recharger).toHaveBeenCalledTimes(1)
  })

  // Mutations : l'écouteur posé en passif, ou par `onTouchMove` de React (passif lui aussi) : la page
  // défilerait sous le doigt.
  it('le tirage empêche le défilement natif', async () => {
    const { bandeau } = await annee1897()
    const { bouges } = tirer(bandeau, 10, 40)
    expect(bouges[0]).toBe(false)
  })

  // En haut de la page, le doigt qui remonte la fait défiler comme d'habitude. Mutation : le
  // `preventDefault` posé aussi quand l'écart n'est pas positif (la page ne défilerait plus vers le bas).
  it('le doigt qui remonte fait défiler la page, il ne tire qu’au-dessous du départ', () => {
    const { contenu } = monterSeule(async () => undefined)
    fireEvent.touchStart(contenu, { touches: [{ clientY: 300 }] })
    expect(fireEvent.touchMove(contenu, { touches: [{ clientY: 250 }] })).toBe(true)
    expect(contenu.style.transform).toBe('')
    expect(fireEvent.touchMove(contenu, { touches: [{ clientY: 400 }] })).toBe(false)
    expect(contenu.style.transform).toBe('translateY(50px)')
  })

  // Mutations : le bouton sans effet ; le statut tu.
  it('le bouton recharge aussi, et dit que c’est fait', async () => {
    const { requetes, apres } = await annee1897()
    const n = requetes.length
    fireEvent.click(screen.getByRole('button', { name: M.bouton }))
    expect(await screen.findByText(M.fait)).toBeInTheDocument()
    expect(screen.getByText(M.fait).closest('[role="status"]')).not.toBeNull()
    expect([...apres(n)].sort()).toEqual(RELECTURE)
  })

  // Mutation : `throwOnError` retiré (la carte en panne, la manivelle dirait « à jour »).
  it('un refus de l’API s’affiche tel qu’elle l’a écrit', async () => {
    let lectures = 0
    const message = 'Le Voyage est en travaux, reviens dans un instant.'
    await annee1897({
      ...ROUTES,
      'GET /api/me/voyage': () => (++lectures > 1 ? json({ code: 'SERVICE_UNCONFIGURED', message, retryable: false }, 503) : json(VOYAGE)),
    })
    fireEvent.click(screen.getByRole('button', { name: M.bouton }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByText(message).closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByText(M.fait)).toBeNull()
  })

  // Mutations : un message générique à la place de celui de l'API ; la garde jamais relâchée après un refus.
  it('après un refus, se retente', async () => {
    const recharger = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError({ code: 'INTERNAL', message: 'La carte n’a pas pu être lue.', retryable: false }, 500))
      .mockResolvedValueOnce(undefined)
    const { contenu } = monterSeule(recharger)
    tirer(contenu, 10, 200)
    expect(await screen.findByText('La carte n’a pas pu être lue.')).toBeInTheDocument()
    tirer(contenu, 10, 200)
    expect(await screen.findByText(M.fait)).toBeInTheDocument()
    expect(recharger).toHaveBeenCalledTimes(2)
  })

  // Mutation : le lâcher d'un `touchcancel` traité comme un lâcher (le navigateur a repris le geste).
  it('un geste repris par le navigateur ne recharge rien', () => {
    const recharger = vi.fn(async () => undefined)
    const { contenu } = monterSeule(recharger)
    fireEvent.touchStart(contenu, { touches: [{ clientY: 10 }] })
    fireEvent.touchMove(contenu, { touches: [{ clientY: 200 }] })
    fireEvent.touchCancel(contenu, { touches: [] })
    expect(recharger).not.toHaveBeenCalled()
    expect(contenu.style.transform).toBe('')
  })

  // Mutations : le contenu immobile (le `transform` retiré) ; le bras qui ne tourne pas ; « Relâchez »
  // jamais dit ; la transformation gardée au repos (elle ferait du contenu le repère des calques fixes).
  it('suit le doigt à mi-course, tourne le bras, et revient sans transformation', async () => {
    let finir: () => void = () => undefined
    const { contenu, bras } = monterSeule(() => new Promise<void>((r) => (finir = r)))
    const manivelle = screen.getByTestId('manivelle')
    fireEvent.touchStart(contenu, { touches: [{ clientY: 10 }] })
    fireEvent.touchMove(contenu, { touches: [{ clientY: 100 }] })
    expect(contenu.style.transform).toBe('translateY(45px)')
    expect(bras().style.transform).toBe('rotate(180deg)')
    expect(manivelle).toHaveTextContent(M.tirer)
    fireEvent.touchMove(contenu, { touches: [{ clientY: 200 }] })
    expect(manivelle).toHaveTextContent(M.relacher)
    fireEvent.touchEnd(contenu, { touches: [] })
    // La bobine se recharge : la manivelle en vue, qui tourne.
    expect(contenu.style.transform).toBe(`translateY(${TENUE}px)`)
    expect(manivelle).toHaveClass(styles.tourne!)
    expect(manivelle).toHaveTextContent(M.charge)
    await act(async () => finir())
    expect(contenu.style.transform).toBe('')
    expect(manivelle).not.toHaveClass(styles.tourne!)
  })

  // Mutations : la garde du calme retirée du `transform` ; du bras ; de la rotation ; au calme, le
  // seuil franchi ne recharge plus.
  it('au calme, le contenu ne suit pas le doigt, rien ne tourne, et le seuil recharge quand même', async () => {
    calme()
    let finir: () => void = () => undefined
    const recharger = vi.fn(() => new Promise<void>((r) => (finir = r)))
    const { contenu, bras } = monterSeule(recharger)
    fireEvent.touchStart(contenu, { touches: [{ clientY: 10 }] })
    expect(fireEvent.touchMove(contenu, { touches: [{ clientY: 200 }] })).toBe(false)
    expect(contenu.style.transform).toBe('')
    expect(bras().style.transform).toBe('')
    fireEvent.touchEnd(contenu, { touches: [] })
    expect(recharger).toHaveBeenCalledTimes(1)
    expect(contenu.style.transform).toBe('')
    expect(screen.getByTestId('manivelle')).not.toHaveClass(styles.tourne!)
    expect(screen.getByRole('status')).toHaveTextContent(M.charge)
    await act(async () => finir())
    expect(screen.getByRole('status')).toHaveTextContent(M.fait)
  })

  // Mutations : le `click` qui suit un tirage laissé passer (la plaque ouvrirait la décennie sous le
  // doigt) ; le `touchend` du tirage laissé au navigateur ; tout `click` avalé (un toucher bref ne
  // s'ouvrirait plus).
  it('le doigt qui a tiré n’ouvre rien, un toucher bref ouvre toujours', async () => {
    const { requetes } = await annee1897({ ...ROUTES, 'GET /api/me/voyage/tickets': () => json({ tickets: [] }), 'GET /api/me/journal?limit=100&sortie_min=1890&sortie_max=1899': () => json({ items: [], next_cursor: null }) })
    const plaque = screen.getByRole('link', { name: 'Chapitre I' })
    // Un tirage en deçà du seuil, commencé sur la plaque.
    const { fin } = tirer(plaque, 10, 60)
    expect(fin).toBe(false)
    fireEvent.click(plaque)
    await act(async () => undefined)
    expect(screen.getByRole('heading', { level: 1, name: '1897' })).toBeInTheDocument()
    // Un toucher bref.
    expect(tirer(plaque, 10).fin).toBe(true)
    fireEvent.click(plaque)
    await waitFor(() => expect(screen.queryByRole('heading', { level: 1, name: '1897' })).toBeNull())
    expect(requetes).toContain('GET /api/me/voyage/tickets')
  })

  // La position retenue par la coque n'est pas la sienne. Mutation : la page ramenée en haut au
  // rechargement (la maquette le fait).
  it('recharger ne touche pas à la position de la page', async () => {
    const { main } = await annee1897()
    main.scrollTop = 300
    fireEvent.click(screen.getByRole('button', { name: M.bouton }))
    expect(await screen.findByText(M.fait)).toBeInTheDocument()
    expect(main.scrollTop).toBe(300)
  })

  // Mutation : « la bobine est rechargée » jamais retirée.
  it('dit que c’est fait, puis se tait', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    monterSeule(async () => undefined)
    fireEvent.click(screen.getByRole('button', { name: M.bouton }))
    expect(await screen.findByText(M.fait)).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DUREE_DU_FAIT)
    })
    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(screen.queryByText(M.fait)).toBeNull()
  })
})
