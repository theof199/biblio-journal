import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { createQueryClient } from '../api/queryClient'
import type { AnneeCarte } from '../api/voyage'
import { PAGES_1890 } from '../mondes/1890/pages'
import { PAGES_1900 } from '../mondes/1900/pages'
import { PAGES_A_VENIR } from '../mondes/avenir/pages'
import type { VueGuichet } from '../mondes/types'
import { contexteFactice } from '../test/contexteFactice'
import { SESSION } from '../test/pageVoyage'
import { json, servir } from '../test/serveur'
import { ficheEnAttente, fichePrete, ficheVerrouillee, filmDeSalle, salle, voyage1890 } from '../test/voyage'
import { anneeCivile } from '../voyage/decennie'
import type { PropsCatalogueDuGuichet } from '../voyage/recherche/Catalogue'
import type { PropsTeteDuGuichet } from '../voyage/recherche/Tete'
import { noterLeGuichet } from '../voyage/recherche/memoire'
import { decennieDe } from '../voyage/regles'
import styles from './VoyageRecherche.module.css'
import FEUILLE from './VoyageRecherche.module.css?raw'

/** `catalogue`, le vrai, compté : la page ne le refait pas à chaque lettre tapée. */
const compte = vi.hoisted(() => ({ catalogue: 0 }))
vi.mock('../voyage/catalogue', async (original) => {
  const vrai = await original<typeof import('../voyage/catalogue')>()
  return {
    ...vrai,
    catalogue: (...args: Parameters<typeof vrai.catalogue>) => {
      compte.catalogue += 1
      return vrai.catalogue(...args)
    },
  }
})

/**
 * La carte : 1895 et 1896 écrites et ouvertes, 1897 en cours (écrite), 1898 et 1899 verrouillées.
 * Le catalogue se lit donc sur 1895, 1896 et 1897.
 */
const ANNEES: Partial<AnneeCarte>[] = [
  { annee: 1895, statut: 'ouverte', visitee: true, recompense: 'ours', profondeur: 3 },
  { annee: 1896, statut: 'ouverte', visitee: true, recompense: null, profondeur: 1 },
  { annee: 1897, statut: 'en_cours', visitee: true, recompense: null, profondeur: 0 },
  { annee: 1898, statut: 'verrouillee', visitee: false, recompense: null, profondeur: 0 },
  { annee: 1899, statut: 'verrouillee', visitee: false, recompense: null, profondeur: 0 },
]
const VOYAGE = voyage1890(1897, ANNEES, { ia: true, source: null, rattrape_la_source: false, depart: 1895 })

const PROGRAMME = filmDeSalle({
  id: 'f-prog',
  tmdb_id: 4,
  title: 'Programme Lumière',
  realisateur: 'Louis Lumière',
  etat: 'sur_le_plex',
  programme: {
    duree_min: 2,
    bobines: [
      { tmdb_id: 5, title: 'L’Arroseur arrosé', duree_min: 1, cover_url: null, plex_url: null, etat: 'vu' },
      { tmdb_id: 6, title: 'Le Repas de bébé', duree_min: 1, cover_url: null, plex_url: null, etat: 'a_demander' },
    ],
  },
})
const TRAIN = filmDeSalle({ id: 'f-train', tmdb_id: 1, title: 'L’Arrivée d’un train en gare de La Ciotat', realisateur: 'Louis Lumière', etat: 'sur_le_plex' })
const FEE = filmDeSalle({ id: 'f-fee', tmdb_id: 2, title: 'La Fée aux choux', realisateur: 'Alice Guy', etat: 'vu', note: 8 })
const MANOIR = filmDeSalle({ id: 'f-manoir', tmdb_id: 3, title: 'Le Manoir du diable', realisateur: 'Georges Méliès', etat: 'a_demander' })
const CENDRILLON = filmDeSalle({ id: 'f-cendr', tmdb_id: 7, title: 'Cendrillon', realisateur: 'Georges Méliès', etat: 'introuvable' })

const FICHES: Record<number, ReturnType<typeof fichePrete>> = {
  1895: fichePrete({ annee: 1895, salles: [salle({ id: 's-95', cle: 'essentiels', films: [PROGRAMME] })] }),
  1896: fichePrete({
    annee: 1896,
    salles: [salle({ id: 's-96', cle: 'essentiels', films: [TRAIN, FEE] }), salle({ id: 's-96b', cle: 'ailleurs', films: [MANOIR] })],
  }),
  1897: fichePrete({ annee: 1897, salles: [salle({ id: 's-97', cle: 'essentiels', films: [CENDRILLON] })] }),
}
const FICHE = (a: number) => `GET /api/me/voyage/annees/${a}`
const refus = (message: string) => () => json({ code: 'VALIDATION', message, retryable: false }, 400)

type Routes = Record<string, (init: RequestInit) => Response | Promise<Response>>
const ROUTES: Routes = {
  'GET /api/me/voyage': () => json(VOYAGE),
  ...Object.fromEntries(Object.entries(FICHES).map(([a, f]) => [FICHE(Number(a)), () => json(f)])),
}

/** L'adresse que l'app affiche. */
function Adresse() {
  const { pathname, search } = useLocation()
  return <output data-testid="adresse">{`${pathname}${search}`}</output>
}
const adresse = () => screen.getByTestId('adresse').textContent

/** Le geste « retour » du téléphone, que la page ne dessine pas. */
let historique!: NavigateFunction
function Historique() {
  historique = useNavigate()
  return null
}

/** Le guichet dans l'app entière, sous la coque ; plusieurs entrées posent un historique. */
function monter(entree: string | string[], routes: Routes = ROUTES) {
  const client = createQueryClient()
  const requetes = servir({ 'GET /api/auth/me': () => json(SESSION), ...routes })
  const entrees = Array.isArray(entree) ? entree : [entree]
  const vue = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={entrees} initialIndex={entrees.length - 1}>
        <Historique />
        <App />
        <Adresse />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...vue, client, requetes }
}

const PAGE = '/voyage/decennies/1890/recherche'
const champ = () => screen.getByRole('searchbox', { name: PAGES_1890.mots.recherche.champ })
const taper = (texte: string) => fireEvent.change(champ(), { target: { value: texte } })
/** Les lignes du catalogue, une fois les fiches lues. */
const lignes = async () => within(await screen.findByRole('list', { name: 'Les films du catalogue' })).getAllByRole('link')
const titres = async () => (await lignes()).map((l) => l.querySelector(`.${styles.ti!}`)!.textContent)
const annee = (a: number) => within(screen.getByRole('group', { name: 'Années' })).getByRole('button', { name: String(a) })
/** Attend que toutes les fiches du catalogue soient lues (plus de « se charge »). */
const lu = async () => {
  await screen.findByRole('heading', { level: 1, name: 'Catalogue des vues' })
  await waitFor(() => expect(screen.queryByText('Le catalogue se charge…')).not.toBeInTheDocument())
}

/** `matchMedia` manque à jsdom : le test pose la réponse de « moins d'animations ». */
const calme = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

/**
 * jsdom ne met rien en page : `scrollTop` y garde toute valeur. Comme dans un navigateur, il est
 * borné ici par la hauteur du contenu, cent pixels par lien de la zone, cinq cents de fenêtre : un
 * catalogue plus court que celui qu'on a quitté ramène la position plus haut.
 */
function borner(zone: HTMLElement) {
  let haut = 0
  const plusBas = () => Math.max(0, zone.querySelectorAll('a').length * 100 - 500)
  Object.defineProperty(zone, 'scrollTop', {
    configurable: true,
    get: () => haut,
    set: (v: number) => {
      haut = Math.min(Math.max(0, v), plusBas())
    },
  })
}

describe('le guichet, la recherche du Voyage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // On cherche, on ouvre un film, on revient : le guichet est celui qu'on a quitté, à sa place. La
  // saisie ne vit pas dans l'adresse (une lettre ferait sauter la page) mais sous l'entrée
  // d'historique. Mutations : la saisie, ou les années, qui repartent vides ; la position perdue
  // (le catalogue de l'affiche, plus court, la ramène plus haut).
  it('retrouve la saisie, les années cochées et la position au retour d’une fiche', async () => {
    monter(PAGE, { ...ROUTES, 'GET /api/reference/films/4/realisateurs': () => json({ realisateurs: [] }) })
    await lu()
    const zone = screen.getByRole('main')
    borner(zone)
    taper('l')
    fireEvent.click(annee(1895))
    fireEvent.click(annee(1896))
    const avant = await titres()
    expect(avant).toEqual(['Programme Lumière', 'L’Arroseur arrosé', 'Le Repas de bébé', 'L’Arrivée d’un train en gare de La Ciotat', 'La Fée aux choux', 'Le Manoir du diable'])
    zone.scrollTop = 300
    fireEvent.scroll(zone)
    expect(zone.scrollTop).toBe(300)

    fireEvent.click((await lignes())[0]!)
    expect(await screen.findByRole('region', { name: 'Programme Lumière' })).toBeInTheDocument()
    expect(zone.scrollTop).toBe(0)

    act(() => historique(-1))
    expect(await titres()).toEqual(avant)
    expect(champ()).toHaveValue('l')
    expect(annee(1895)).toHaveAttribute('aria-pressed', 'true')
    expect(annee(1896)).toHaveAttribute('aria-pressed', 'true')
    expect(annee(1897)).toHaveAttribute('aria-pressed', 'false')
    await waitFor(() => expect(zone.scrollTop).toBe(300))
  })

  // Le guichet retenu est celui de l'entrée, pas de l'adresse : y revenir par un lien neuf (l'onglet,
  // la décennie) l'ouvre vide. Mutation : le guichet retenu sous l'adresse au lieu de l'entrée.
  it('s’ouvre vide par une navigation nouvelle', async () => {
    monter(PAGE)
    await lu()
    taper('melies')
    fireEvent.click(annee(1897))
    expect(await titres()).toEqual(['Cendrillon'])
    act(() => historique(PAGE))
    await waitFor(() => expect(champ()).toHaveValue(''))
    expect(annee(1897)).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(PAGES_1890.mots.recherche.affiche)).toBeInTheDocument()
  })

  // Lire une année non visitée enfilerait son ouverture chez le chroniqueur (le compte IA), ou
  // ouvrirait au second joueur une année que le Voyage suivi n'a pas faite (option A) ; une année
  // verrouillée n'a pas de salles. Mutation : `anneesDuCatalogue` contourné (toutes les années de la carte).
  it.each([
    ['le compte IA', true],
    ['le second joueur', false],
  ])('ne lit que les fiches déjà écrites et ouvertes de la décennie (%s)', async (_qui, ia) => {
    const carte = voyage1890(
      1896,
      [
        { annee: 1895, statut: 'ouverte', visitee: true },
        { annee: 1896, statut: 'en_cours', visitee: false },
        { annee: 1897, statut: 'verrouillee', visitee: false },
      ],
      { ia, depart: 1895 },
    )
    const { requetes } = monter(PAGE, { 'GET /api/me/voyage': () => json(carte), [FICHE(1895)]: () => json(FICHES[1895]) })
    await lu()
    // Sans saisie, l'affiche ; la saisie montre que les vues de 1895 sont bien lues.
    taper('repas')
    expect(await titres()).toEqual(['Le Repas de bébé'])
    expect(requetes.filter((r) => r !== 'GET /api/auth/me').sort()).toEqual(['GET /api/me/voyage', FICHE(1895)].sort())
    // Seule l'année lue se coche : 1896 reste fermée au guichet.
    expect(within(screen.getByRole('group', { name: 'Années' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['1895'])
  })

  // Le second joueur visite une année que le compte IA n'a pas encore ouverte : l'API la dit en
  // attente, et verrouillée une année hors de ses années lisibles, quoi que dise sa carte. Le guichet
  // ne propose pas ces années : une année cochée qui ne trouve rien, faute de salles, n'en est pas
  // une, ni comme bouton, ni comme filtre retenu d'une visite précédente (sans bouton pour la
  // décocher). Mutations : les boutons, ou le filtre, tirés des années lues (`anneesDuCatalogue`) au
  // lieu des fiches prêtes.
  it('ne propose au second joueur que les années que le compte IA a ouvertes', async () => {
    // La première entrée d'un `MemoryRouter` porte la clé `default` : 1897 était cochée.
    noterLeGuichet('default', 1890, { saisie: '', annees: [1897] })
    const carte = voyage1890(
      1897,
      [
        { annee: 1895, statut: 'ouverte', visitee: true },
        { annee: 1896, statut: 'ouverte', visitee: true },
        { annee: 1897, statut: 'en_cours', visitee: true },
      ],
      { ia: false, depart: 1895 },
    )
    monter(PAGE, {
      'GET /api/me/voyage': () => json(carte),
      [FICHE(1895)]: () => json(FICHES[1895]),
      [FICHE(1896)]: () => json(ficheVerrouillee(1896)),
      [FICHE(1897)]: () => json(ficheEnAttente(1897)),
    })
    await lu()
    expect(within(screen.getByRole('group', { name: 'Années' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['1895'])
    expect(screen.queryByText(/pas pu être lue/)).not.toBeInTheDocument()
    expect(screen.getByText(PAGES_1890.mots.recherche.affiche)).toBeInTheDocument()
    taper('e')
    expect(await titres()).toEqual(['Programme Lumière', 'L’Arroseur arrosé', 'Le Repas de bébé'])
  })

  // L'API rend toujours les années du départ à l'année civile : un joueur en 1903 a une carte qui
  // déborde la décennie de la page. Mutation : le catalogue lu sur la décennie de l'année en cours.
  it('lit la décennie de la page, pas celle de l’année en cours', async () => {
    const carte = voyage1890(1903, [1895, 1896, 1897, 1898, 1899, 1900, 1901, 1902, 1903].map((a) => ({ annee: a, statut: a === 1903 ? 'en_cours' : 'ouverte', visitee: true }) as Partial<AnneeCarte>), {
      ia: true,
      depart: 1895,
    })
    const fiche = (a: number) => () => json(fichePrete({ annee: a, salles: [] }))
    const routes: Routes = { 'GET /api/me/voyage': () => json(carte), ...Object.fromEntries([1895, 1896, 1897, 1898, 1899, 1900, 1901, 1902, 1903].map((a) => [FICHE(a), fiche(a)])) }

    const page = monter(PAGE, routes)
    await lu()
    expect(page.requetes.filter((r) => r.startsWith('GET /api/me/voyage/annees/')).sort()).toEqual([1895, 1896, 1897, 1898, 1899].map(FICHE))
    page.unmount()

    const suivante = monter('/voyage/decennies/1900/recherche', routes)
    await screen.findByRole('heading', { level: 1, name: PAGES_1900.mots.recherche.catalogue })
    await waitFor(() => expect(screen.queryByText('Le catalogue se charge…')).not.toBeInTheDocument())
    expect(suivante.requetes.filter((r) => r.startsWith('GET /api/me/voyage/annees/')).sort()).toEqual([1900, 1901, 1902, 1903].map(FICHE))
  })

  // Mutation : le `<mark>` posé sur la saisie au lieu du passage du titre (« arrivee » souligné tel quel).
  it('trouve sans accents, et souligne le passage', async () => {
    monter(PAGE)
    await lu()
    taper('arrivee')
    const [ligne, ...autres] = await lignes()
    expect(autres).toEqual([])
    expect(ligne).toHaveTextContent('L’Arrivée d’un train en gare de La Ciotat')
    expect([...ligne!.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['Arrivée'])
  })

  // Le jumeau du titre : la saisie trouve aussi un réalisateur, et le dit. Mutation : le réalisateur
  // écrit tel quel (rien de souligné sur une ligne trouvée par lui).
  it('souligne le réalisateur qu’il trouve', async () => {
    monter(PAGE)
    await lu()
    taper('melies')
    expect(await titres()).toEqual(['Le Manoir du diable', 'Cendrillon'])
    for (const ligne of await lignes()) expect([...ligne.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['Méliès'])
  })

  // Mutation : le filtre d'années ignoré par la page (`chercher(vues, saisie, new Set())`).
  it('une année cochée restreint le catalogue', async () => {
    monter(PAGE)
    await lu()
    taper('lumiere')
    expect(await titres()).toEqual(['Programme Lumière', 'L’Arrivée d’un train en gare de La Ciotat'])

    fireEvent.click(annee(1896))
    expect(annee(1896)).toHaveAttribute('aria-pressed', 'true')
    expect(await titres()).toEqual(['L’Arrivée d’un train en gare de La Ciotat'])

    // Sans saisie, l'année cochée montre tout son catalogue, pas l'affiche.
    taper('')
    expect(await titres()).toEqual(['L’Arrivée d’un train en gare de La Ciotat', 'La Fée aux choux', 'Le Manoir du diable'])
    expect(screen.getByText('3 résultats')).toBeInTheDocument()

    // Décochée, l'affiche revient.
    fireEvent.click(annee(1896))
    expect(annee(1896)).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(PAGES_1890.mots.recherche.affiche)).toBeInTheDocument()
  })

  // Les essentiels pas vus, de l'année la plus récente à la plus ancienne : ni un film vu (la Fée,
  // l'Arroseur), ni un film hors des essentiels (le Manoir). Mutation : la saisie vide qui montre tout.
  it('sans saisie, met à l’affiche les essentiels pas vus', async () => {
    monter(PAGE)
    await lu()
    expect(screen.getByText(PAGES_1890.mots.recherche.affiche)).toBeInTheDocument()
    expect(await titres()).toEqual(['Cendrillon', 'L’Arrivée d’un train en gare de La Ciotat', 'Programme Lumière', 'Le Repas de bébé'])
  })

  // Mutation : l'état écrit par sa clé (`sur_le_plex`, `introuvable`), la note tue.
  it('dit l’état de chaque vue en clair', async () => {
    monter(PAGE)
    await lu()
    fireEvent.click(annee(1896))
    fireEvent.click(annee(1897))
    const [train, fee, manoir, cendrillon] = await lignes()
    expect(train).toHaveTextContent('sur ton Plex')
    expect(fee).toHaveTextContent('vu · ★ 8')
    expect(manoir).toHaveTextContent('à demander')
    expect(cendrillon).toHaveTextContent(PAGES_1890.mots.introuvable)
  })

  // Le mot d'un film perdu est celui du monde de la décennie. Mutation : « perdu » de 1890 en dur.
  it('dit un film perdu par le mot de son monde', async () => {
    monter('/voyage/decennies/1900/recherche', {
      'GET /api/me/voyage': () => json(voyage1890(1900, [{ annee: 1900, statut: 'en_cours', visitee: true }], { ia: true, depart: 1895 })),
      [FICHE(1900)]: () => json(fichePrete({ annee: 1900, salles: [salle({ id: 's', cle: 'essentiels', films: [CENDRILLON] })] })),
    })
    const [ligne] = await lignes()
    expect(ligne).toHaveTextContent(PAGES_A_VENIR.mots.introuvable)
    expect(ligne).not.toHaveTextContent(PAGES_1890.mots.introuvable)
  })

  // Une bobine n'a pas de page : sa fiche est celle de son programme. Mutation : le lien vers le film
  // de la bobine (`vue.tmdbId`) au lieu de son programme.
  it('ouvre la fiche du film trouvé', async () => {
    monter(PAGE, { ...ROUTES, 'GET /api/reference/films/4/realisateurs': () => json({ realisateurs: [] }) })
    await lu()
    taper('repas')
    const [ligne] = await lignes()
    expect(ligne).toHaveAttribute('href', '/voyage/1895/films/f-prog')
    expect(ligne).toHaveTextContent(`${PAGES_1890.mots.recherche.ouvrir} ›`)
    fireEvent.click(ligne!)
    expect(await screen.findByRole('region', { name: 'Programme Lumière' })).toBeInTheDocument()
    expect(adresse()).toBe('/voyage/1895/films/f-prog')
  })

  // Le catalogue se refait quand une fiche change, pas à chaque lettre : sur une décennie de mille
  // vues, chaque frappe le reconstruirait. Mutation : la combinaison écrite dans le composant (une
  // fonction neuve à chaque rendu, que TanStack refait).
  it('ne refait pas le catalogue à chaque lettre tapée', async () => {
    monter(PAGE)
    await lu()
    const avant = compte.catalogue
    const mot = 'cendrillon'
    for (let i = 1; i <= mot.length; i += 1) taper(mot.slice(0, i))
    fireEvent.click(annee(1897))
    expect(await titres()).toEqual(['Cendrillon'])
    expect(compte.catalogue).toBe(avant)
  })

  // Le clavier d'un téléphone couvre la moitié basse de l'écran : sous le bandeau, il ne laissait voir
  // qu'une ligne du catalogue (vu au navigateur, 390 × 508). Toucher le champ amène la fenêtre en
  // haut, une fois ; la frappe ne fait rien bouger. À la souris, rien ne bouge. Mutations : rien
  // d'amené ; amené à chaque lettre ; amené sans clavier tactile ; la place du bas retirée, ou gardée
  // après le départ du doigt.
  it.each([
    ['au doigt', true],
    ['à la souris', false],
  ])('amène la fenêtre au-dessus du clavier quand le champ prend le doigt (%s)', async (_qui, doigt) => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q === '(pointer: coarse)' ? doigt : false,
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    const amener = vi.fn()
    Object.defineProperty(Element.prototype, 'scrollIntoView', { value: amener, configurable: true, writable: true })
    try {
      monter(PAGE)
      await lu()
      fireEvent.focus(champ())
      taper('cen')
      taper('cendr')
      expect(await titres()).toEqual(['Cendrillon'])
      if (doigt) {
        expect(amener).toHaveBeenCalledTimes(1)
        expect(amener.mock.contexts[0]).toBe(screen.getByRole('search'))
        expect(amener).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }))
        // La place de monter, même sur un catalogue court : la hauteur du bandeau, rendue au départ du doigt.
        expect(screen.getByTestId('place-du-clavier')).toHaveStyle({ height: `${PAGES_1890.hauteurs.guichet}px` })
        fireEvent.blur(champ())
        expect(screen.queryByTestId('place-du-clavier')).not.toBeInTheDocument()
      } else {
        expect(amener).not.toHaveBeenCalled()
        expect(screen.queryByTestId('place-du-clavier')).not.toBeInTheDocument()
      }
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
    }
  })

  // Rien ne part à la frappe : ni TMDB, ni le chroniqueur. Mutation : une recherche par saisie
  // (`GET /api/search?…`) branchée sur le champ.
  it('aucune requête ne part à la frappe', async () => {
    const { requetes } = monter(PAGE)
    await lu()
    const avant = [...requetes]
    const mot = 'cendrillon'
    for (let i = 1; i <= mot.length; i += 1) taper(mot.slice(0, i))
    expect(await titres()).toEqual(['Cendrillon'])
    await new Promise((fin) => setTimeout(fin, 50))
    expect(requetes).toEqual(avant)
  })

  // Mutations : le message de vacuité retiré ; celui de la recherche dit sans saisie.
  it('dit quand rien n’est trouvé, et quand rien n’est à l’affiche', async () => {
    const page = monter(PAGE)
    await lu()
    taper('nosferatu')
    expect(await screen.findByText(PAGES_1890.mots.recherche.vide)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Les films du catalogue' })).not.toBeInTheDocument()
    page.unmount()
    // Une autre app : la première entrée de son historique porte la même clé (`default`).
    window.sessionStorage.clear()

    // Aucune année écrite : le catalogue est vide, pas « introuvable ».
    monter(PAGE, { 'GET /api/me/voyage': () => json(voyage1890(1895, [{ annee: 1895, statut: 'en_cours', visitee: false }], { ia: true, depart: 1895 })) })
    expect(await screen.findByText('Aucune salle de la décennie n’est encore écrite.')).toBeInTheDocument()
    expect(screen.queryByText(PAGES_1890.mots.recherche.vide)).not.toBeInTheDocument()
  })

  // Une affiche vide n'est pas un catalogue vide : les essentiels sont tous vus, le reste se cherche.
  // Mutations : le message du catalogue vide dit ici ; celui de la recherche.
  it('dit quand les essentiels sont tous vus', async () => {
    monter(PAGE, {
      'GET /api/me/voyage': () => json(voyage1890(1895, [{ annee: 1895, statut: 'en_cours', visitee: true }], { ia: true, depart: 1895 })),
      [FICHE(1895)]: () => json(fichePrete({ annee: 1895, salles: [salle({ id: 's', cle: 'essentiels', films: [FEE] }), salle({ id: 's2', cle: 'ailleurs', films: [MANOIR] })] })),
    })
    expect(await screen.findByText('Les essentiels de la décennie sont tous vus.')).toBeInTheDocument()
    taper('manoir')
    expect(await titres()).toEqual(['Le Manoir du diable'])
  })

  // Tant qu'une fiche se lit, le guichet ne dit pas « rien à ce nom » : la vue cherchée peut être dans
  // l'année qui arrive. Mutation : le chargement des fiches ignoré (`enCours` toujours faux).
  it('ne dit rien d’introuvable tant qu’une fiche se lit', async () => {
    let lire: (r: Response) => void = () => undefined
    monter(PAGE, { ...ROUTES, [FICHE(1897)]: () => new Promise<Response>((fin) => void (lire = fin)) })
    await screen.findByRole('heading', { level: 1, name: 'Catalogue des vues' })
    taper('cendrillon')
    expect(await screen.findByText('Le catalogue se charge…')).toBeInTheDocument()
    expect(screen.queryByText(PAGES_1890.mots.recherche.vide)).not.toBeInTheDocument()
    lire(json(FICHES[1897]))
    expect(await titres()).toEqual(['Cendrillon'])
    expect(screen.queryByText('Le catalogue se charge…')).not.toBeInTheDocument()
  })

  // Une fiche en panne se tait : le catalogue est plus court, une ligne le dit. Mutations : la ligne
  // retirée ; la panne d'une fiche qui tue tout le guichet.
  it('une fiche en panne laisse le reste du catalogue, et le dit', async () => {
    monter(PAGE, { ...ROUTES, [FICHE(1896)]: refus('La fiche s’est égarée.') })
    await lu()
    expect(screen.getByText('Une année n’a pas pu être lue.')).toBeInTheDocument()
    expect(await titres()).toEqual(['Cendrillon', 'Programme Lumière', 'Le Repas de bébé'])
  })

  // Mutation : la panne de la carte dite par un message générique, ou « Réessayer » sans effet.
  it('une panne de la carte s’affiche telle que l’API l’a écrite, et se retente', async () => {
    let refuse = true
    monter(PAGE, { ...ROUTES, 'GET /api/me/voyage': () => (refuse ? refus('La carte s’est déchirée.')() : json(VOYAGE)) })
    expect(await screen.findByText('La carte s’est déchirée.')).toBeInTheDocument()
    refuse = false
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await titres()).toHaveLength(4)
  })

  // Mutation : `decennieDeLAdresse` contournée (`Number(param)`).
  it.each(['1895', '1880', 'abc', String(decennieDe(anneeCivile()) + 10)])('ramène à la carte une adresse qui n’est pas une décennie (%s)', async (d) => {
    monter(`/voyage/decennies/${d}/recherche`, { ...ROUTES, 'GET /api/me/voyage/tickets': () => json({ tickets: [] }) })
    expect(await screen.findByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
    expect(adresse()).toBe('/voyage')
  })

  // L'habillage vient du monde de la décennie, par le registre. Mutations : le monde de 1890 en dur
  // (`mondes(1890)`) ; les jetons retirés de la racine.
  it.each([
    [1890, PAGES_1890],
    [1900, PAGES_1900],
    [1910, PAGES_A_VENIR],
  ])('s’habille du monde de sa décennie (%i)', async (d, pages) => {
    monter(`/voyage/decennies/${d}/recherche`)
    expect(await screen.findByRole('heading', { level: 1, name: pages.mots.recherche.catalogue })).toBeInTheDocument()
    const racine = screen.getByRole('region', { name: `${pages.mots.recherche.catalogue}, années ${d}` })
    expect(racine.style.getPropertyValue('--m-papier')).toBe(pages.jetons['--m-papier'])
    expect(racine.style.getPropertyValue('--m-f-affiche')).toBe(pages.jetons['--m-f-affiche'])
    expect(screen.getByRole('searchbox', { name: pages.mots.recherche.champ })).toHaveAttribute('placeholder', pages.mots.recherche.champ)
    expect(screen.getByRole('link', { name: pages.mots.recherche.partout })).toBeInTheDocument()
  })

  // Le corail ne signale que ce que le joueur déclenche dans le jeu : chercher n'en est pas, ni le
  // lien hors du Voyage. Au calme, les lignes se posent sans glisser. Mutations : `var(--corail)` sur
  // le passage souligné ; la règle du calme retirée.
  it('ne porte pas le corail, et pose ses lignes sans glisser au calme', () => {
    const feuille = FEUILLE.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(feuille).not.toContain('--corail')
    const calme = feuille.slice(feuille.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(calme).toMatch(/\.entree\s*\{\s*animation:\s*none;?\s*\}/)
  })

  // `type="search"` dessine sa croix d'effacement à la couleur du système (un bleu vif, vu au
  // navigateur) : elle prend le bois du monde. Mutation : la règle retirée.
  it('dessine la croix d’effacement aux couleurs du monde', () => {
    const feuille = FEUILLE.replace(/\/\*[\s\S]*?\*\//g, '')
    const regle = /::-webkit-search-cancel-button\s*\{([^}]*)\}/.exec(feuille)?.[1] ?? ''
    expect(regle).toMatch(/appearance:\s*none/)
    expect(regle).toMatch(/background:\s*var\(--m-[\w-]+\)/)
  })

  // La recherche du journal, hors du catalogue (décision D7).
  it('cherche hors du Voyage', async () => {
    monter(PAGE)
    await lu()
    const lien = screen.getByRole('link', { name: 'Chercher hors du Voyage' })
    expect(lien).toHaveAttribute('href', '/recherche')
    fireEvent.click(lien)
    await waitFor(() => expect(adresse()).toBe('/recherche'))
  })

  // Mutation : le retour en simple lien vers la décennie (la décennie s'empilerait devant la carte).
  it('le retour recule dans l’historique quand il y a de quoi', async () => {
    monter(['/voyage', PAGE], { ...ROUTES, 'GET /api/me/voyage/tickets': () => json({ tickets: [] }) })
    await lu()
    fireEvent.click(screen.getByRole('link', { name: 'Retour aux années 1890' }))
    expect(await screen.findByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
  })

  // Mutation : un recul sans condition (rien derrière : rien ne se passerait).
  it('le retour mène à la décennie quand rien n’est derrière', async () => {
    monter(PAGE, {
      ...ROUTES,
      'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
      'GET /api/me/journal?limit=100&sortie_min=1890&sortie_max=1899': () => json({ items: [], next_cursor: null }),
    })
    await lu()
    const retour = screen.getByRole('link', { name: 'Retour aux années 1890' })
    expect(retour).toHaveAttribute('href', '/voyage/decennies/1890')
    fireEvent.click(retour)
    expect(await screen.findByRole('heading', { level: 1, name: 'Années 1890' })).toBeInTheDocument()
  })
})

describe('le guichetier', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Le guichet doublé, peint sur un contexte factice (jsdom n'a pas de canvas). */
  function doublerLeGuichet() {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => contexteFactice().ctx as never)
    const dessin = vi.spyOn(PAGES_1890, 'dessinerGuichet').mockImplementation(() => undefined)
    return {
      peint: () => waitFor(() => expect(dessin).toHaveBeenCalled()),
      dernier: (): VueGuichet => dessin.mock.calls[dessin.mock.calls.length - 1]![0],
    }
  }

  // Mutation : `frappe` jamais posé (le guichetier ne se penche plus).
  it('se penche à chaque lettre tapée', async () => {
    const guichet = doublerLeGuichet()
    monter(PAGE)
    await lu()
    await guichet.peint()
    expect(guichet.dernier().frappe).toBe(-9)
    taper('c')
    // L'instant de la toile à la lettre (jsdom peut dater ses images d'avant l'ouverture : `t` négatif).
    await waitFor(() => expect(guichet.dernier().frappe).not.toBe(-9))
    expect(guichet.dernier().frappe).toBeLessThanOrEqual(guichet.dernier().t)
  })

  // Mutation : la garde du calme retirée (`frappe` posé au calme aussi).
  it('ne bouge pas au calme', async () => {
    calme()
    const guichet = doublerLeGuichet()
    monter(PAGE)
    await lu()
    await guichet.peint()
    taper('cendr')
    // Au calme, l'image ne se repeint qu'au rendu : la saisie en provoque un.
    expect(await titres()).toEqual(['Cendrillon'])
    expect(guichet.dernier().vivant).toBe(false)
    expect(guichet.dernier().frappe).toBe(-9)
  })
})

// Deux sections du guichet sont des dessins qu'un monde peut composer (`GabaritsDesPages.teteDuGuichet`,
// `catalogueDuGuichet`). Sans gabarit, le défaut reste : tous les tests plus haut, montés sur 1890, qui
// n'en a aucun. Le monde de test est 1890, auquel on prête des dessins qui disent ce qu'ils reçoivent.
describe('le dessin du monde au guichet', () => {
  let remettre = () => undefined as void
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    remettre()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  const preter = (gabarits: typeof PAGES_1890.gabarits) => {
    const avant = PAGES_1890.gabarits
    PAGES_1890.gabarits = gabarits
    remettre = () => void (PAGES_1890.gabarits = avant)
  }
  const dit = (quoi: string) => screen.getByTestId(quoi).textContent

  const TeteDuMonde = (p: PropsTeteDuGuichet) => (
    <div>
      <p data-testid="tete">{`${p.decennie} | ${p.monde.pages.mots.recherche.catalogue} | ${p.calme ? 'calme' : 'vivante'}`}</p>
      {p.retour}
      <form {...p.guichet} aria-label="La grille du monde">
        <input {...p.champ} />
      </form>
    </div>
  )
  const CatalogueDuMonde = (p: PropsCatalogueDuGuichet) => (
    <div>
      <p data-testid="catalogue">{`${p.decennie} | ${p.annees.join(' ')} | cochées ${[...p.cochees].join(' ')} | ${p.aLAffiche ? 'affiche' : `cherché « ${p.saisie} »`} | ${p.enCours ? 'en cours' : 'lu'} | ${p.enPanne} | ${p.vide} | ${p.vues.map((v) => `${v.annee}:${v.titre}:voie ${v.voie}`).join(' ; ')}`}</p>
      <button type="button" onClick={() => p.onBasculer(1896)}>
        Cocher 1896
      </button>
    </div>
  )

  // Mutations : la page qui monte `Tete` sans passer par `gabaritDe` ; `onChange`, `onFocus` ou `onBlur`
  // sans effet (la saisie figée, la fenêtre qui ne monte plus au-dessus du clavier, la place jamais
  // rendue) ; l'envoi qui ne replie plus le clavier.
  it('la tête du monde reçoit le retour monté, le formulaire et le champ tout réglés, et la page garde le doigt', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(pointer: coarse)', media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
    const amener = vi.fn()
    Object.defineProperty(Element.prototype, 'scrollIntoView', { value: amener, configurable: true, writable: true })
    try {
      preter({ teteDuGuichet: TeteDuMonde })
      monter(['/voyage/decennies/1890', PAGE])
      await lu()
      expect(dit('tete')).toBe(`1890 | ${PAGES_1890.mots.recherche.catalogue} | vivante`)
      // Ni la toile ni l'enseigne du défaut.
      expect(screen.queryByRole('img', { name: 'Le guichet des années 1890.' })).toBeNull()
      expect(screen.queryByText('Guichet')).toBeNull()
      const grille = screen.getByRole('search', { name: 'La grille du monde' })
      expect(champ()).toHaveAttribute('placeholder', PAGES_1890.mots.recherche.champ)
      expect(champ()).toHaveAttribute('type', 'search')
      expect(champ()).toHaveAttribute('enterkeyhint', 'search')
      expect(champ()).toHaveAttribute('autocomplete', 'off')
      fireEvent.focus(champ())
      taper('cendr')
      expect(champ()).toHaveValue('cendr')
      expect(await titres()).toEqual(['Cendrillon'])
      expect(amener).toHaveBeenCalledTimes(1)
      expect(amener.mock.contexts[0]).toBe(grille)
      expect(screen.getByTestId('place-du-clavier')).toBeInTheDocument()
      // « Rechercher » du clavier ne fait que le replier : rien ne part, la page reste.
      champ().focus()
      fireEvent.submit(grille)
      expect(champ()).not.toHaveFocus()
      fireEvent.blur(champ())
      expect(screen.queryByTestId('place-du-clavier')).not.toBeInTheDocument()
      expect(adresse()).toBe(PAGE)
      fireEvent.click(screen.getByRole('link', { name: 'Retour aux années 1890' }))
      await waitFor(() => expect(adresse()).toBe('/voyage/decennies/1890'))
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
    }
  })

  // Mutations : `Catalogue` monté sans passer par `gabaritDe` ; les années tirées de la carte et non
  // des fiches prêtes ; `aLAffiche` toujours vrai ; `onBasculer` sans effet ; la voie perdue en route
  // (`catalogue.test.ts` tient sa règle).
  it('le catalogue du monde reçoit les années prêtes, les vues cherchées avec leur voie, et la phrase du vide', async () => {
    preter({ catalogueDuGuichet: CatalogueDuMonde })
    const rangees = { ...ROUTES, [FICHE(1896)]: () => json({ ...FICHES[1896]!, salles: FICHES[1896]!.salles.map((s, i) => ({ ...s, rang: [5, 3][i]! })) }) }
    monter(PAGE, rangees)
    await waitFor(() => expect(dit('catalogue')).toMatch(/\| lu \|/))
    expect(screen.queryByRole('heading', { level: 1, name: PAGES_1890.mots.recherche.catalogue })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Années' })).toBeNull()
    expect(dit('catalogue')).toBe(
      '1890 | 1895 1896 1897 | cochées  | affiche | lu | 0 | Les essentiels de la décennie sont tous vus. | 1897:Cendrillon:voie 1 ; 1896:L’Arrivée d’un train en gare de La Ciotat:voie 5 ; 1895:Programme Lumière:voie 1 ; 1895:Le Repas de bébé:voie 1',
    )
    taper('manoir')
    await waitFor(() => expect(dit('catalogue')).toMatch(/cherché « manoir » \| lu \| 0 \| [^|]* \| 1896:Le Manoir du diable:voie 3$/))
    expect(dit('catalogue')).toContain(`| ${PAGES_1890.mots.recherche.vide} |`)
    fireEvent.click(screen.getByRole('button', { name: 'Cocher 1896' }))
    taper('')
    await waitFor(() => expect(dit('catalogue')).toMatch(/cochées 1896 \| cherché « {2}» \|.*Ciotat:voie 5 ; 1896:La Fée aux choux:voie 5 ; 1896:Le Manoir du diable:voie 3$/))
    // Le lien hors du Voyage reste à la page.
    expect(screen.getByRole('link', { name: PAGES_1890.mots.recherche.partout })).toBeInTheDocument()
  })
})
