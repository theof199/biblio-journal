import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { cles } from '../../../api/cles'
import { createQueryClient } from '../../../api/queryClient'
import type { FichePrete, Voyage } from '../../../api/voyage'
import type { JournalPage } from '../../../api/journal'
import { creerRegistre } from '../..'
import { exemple } from '../../../test/contrat'
import { SESSION, monterVoyage } from '../../../test/pageVoyage'
import { json, servir } from '../../../test/serveur'
import { annee, fichePrete, filmDeSalle, salle, voyage1890 } from '../../../test/voyage'
import { confierLeRetour, oublierLeRetour } from '../../../voyage/annee/retour'
import Celebrations from '../../../voyage/celebrations/Celebrations'
import { ANNEE, GARDE_DU_CHOIX, PAS_DE_L_ANNEE, RECOMPENSE, SALLE } from '../../../voyage/celebrations/deroule'
import type { Scene } from '../../../voyage/celebrations/scenes'
import { TEMPO } from '../../../voyage/tempo'
import { FENETRES, cartonDeLaVoiture, fenetresDeLaVoiture, trajetDuBon } from './fetes'
import FEUILLE_DES_FETES from './Fetes.module.css?raw'

/**
 * Les fêtes des années 1900 (plan des pages 1900, brief 11 ; maquette, écran 13) : la voiture
 * complète, l'étiquette de malle, la ligne bouclée. Le séquenceur est celui de `voyage/celebrations/`,
 * monté avec le monde du registre ; ses propres tests (`Celebrations.test.tsx`) tiennent le cadre, le
 * son et la vibration pour tout monde, et ne sont pas retouchés.
 */
const MONDE = creerRegistre()(1900)
const somme = (durees: readonly number[]) => durees.reduce((a, b) => a + b, 0)
const passer = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
const calme = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

const film = (n: number) => filmDeSalle({ id: `f${n}`, tmdb_id: n, title: `Film ${n}`, cover_url: n === 2 ? null : `/affiche-${n}.jpg`, etat: 'vu' })
// Cinq films : la voiture n'a que quatre fenêtres. Dans la réponse, la voie 5 vient avant la voie 2.
const MELIES = salle({ id: 's-melies', rang: 5, nom: 'Méliès, toujours', films: [1, 2, 3, 4, 5].map(film) })
const AUTRE = salle({ id: 's-autre', rang: 2, nom: 'Les poursuites', films: [filmDeSalle({ id: 'f9', tmdb_id: 9, etat: 'a_demander' })] })
// Le Lion sans la Palme : une salle complète sur deux, la ligne de la Palme reste attendue.
const PROGRESSION = { essentiels_vus: 2, essentiels_total: 2, salles_completes: 1, salles_autres: 2 }
const TICKET = { annee: 1905, emis_le: '2026-09-21T21:00:00.000Z', utilise_le: null }
const FICHE = fichePrete({ annee: 1904, profondeur: 4, progression: PROGRESSION, recompense: 'lion', ticket: TICKET, salles: [MELIES, AUTRE], maturite: null, generique: null })
/** 1899 est une autre décennie, 1901 n'a rien gagné, 1904 est l'année fêtée, 1905 vient après. */
const CARTE: Voyage = {
  ...voyage1890(1904, [
    { annee: 1899, statut: 'ouverte', recompense: 'palme' },
    { annee: 1900, statut: 'ouverte', recompense: 'lion' },
    { annee: 1901, statut: 'ouverte', recompense: null },
    { annee: 1902, statut: 'ouverte', recompense: 'palme' },
    { annee: 1903, statut: 'ouverte', recompense: 'ours' },
    { annee: 1904, statut: 'en_cours', recompense: 'lion' },
  ]),
  tampons: [{ decennie: 1890, boucle_le: '2026-03-14T12:00:00.000Z' }],
}
const AVEC_1905: Voyage = { ...CARTE, annees: [...CARTE.annees, annee({ annee: 1905, statut: 'verrouillee', recompense: 'ours' })] }

const VOITURE: Scene = { type: 'salle', noms: ['Méliès, toujours'], combien: 1 }
const LION: Scene = { type: 'recompense', annee: 1904, recompense: 'lion' }
const LIGNE: Scene = { type: 'annee', annee: 1904, recompense: 'lion', ticket: 1905 }
const MONTRE = 'POST /api/me/voyage/tickets/1905/montre'

describe('les règles des fêtes de 1900', () => {
  // Mutations : `slice(-FENETRES)` retiré (cinq fenêtres) ou pris au début (la dernière fenêtre ne
  // serait pas le dernier film) ; des fenêtres nommées sans salle.
  it('la voiture montre ses quatre derniers films, et quatre fenêtres sans film quand la salle manque', () => {
    const salleFetee = { numero: 5, nom: 'Méliès, toujours', films: MELIES.films.map((f) => ({ id: f.id, titre: f.title, affiche: f.cover_url })) }
    expect(fenetresDeLaVoiture(salleFetee).map((f) => f.titre)).toEqual(['Film 2', 'Film 3', 'Film 4', 'Film 5'])
    expect(fenetresDeLaVoiture(null)).toHaveLength(FENETRES)
    expect(fenetresDeLaVoiture(null).every((f) => f.titre === null && f.affiche === null)).toBe(true)
  })

  // Mutation : le carton de la scène repris tel quel (« Salle complète », « 2 salles »).
  it('le carton dit une voiture là où la scène dit une salle, sans recompter', () => {
    expect(cartonDeLaVoiture(VOITURE, { sur: 'Salle complète', titre: 'Méliès, toujours' })).toEqual({ sur: 'Voiture complète', titre: 'Méliès, toujours' })
    expect(cartonDeLaVoiture({ type: 'salle', noms: ['A', 'B'], combien: 2 }, { sur: 'Salles complètes', titre: '2 salles' })).toEqual({ sur: 'Voitures complètes', titre: '2 voitures' })
    expect(cartonDeLaVoiture({ type: 'salle', noms: [], combien: 1 }, { sur: 'Salle complète', titre: 'Une salle' })).toEqual({ sur: 'Voiture complète', titre: 'Une voiture' })
    // Une salle qui s'appelle « La salle des machines » garde son nom.
    expect(cartonDeLaVoiture({ type: 'salle', noms: ['La salle des machines'], combien: 1 }, { sur: 'Salle complète', titre: 'La salle des machines' }).titre).toBe('La salle des machines')
  })

  // Mutation : le lieu de l'année bouclée à la place de celui où le ticket mène.
  it('le « Bon pour » dit la gare où le ticket mène, et l’année seule quand elle n’a pas de lieu', () => {
    expect(trajetDuBon(1904, 1905)).toBe('de 1904 à Bassersdorf')
    expect(trajetDuBon(1909, 1910)).toBe('de 1909 à 1910')
  })
})

describe('les durées des fêtes de 1900', () => {
  const CSS = FEUILLE_DES_FETES.replace(/\/\*[\s\S]*?\*\//g, '')
  /** La durée et le délai d'une animation nommée, en millisecondes, tels que la feuille les joue au tempo. */
  const jouee = (nom: string) => {
    const regle = new RegExp(`animation:\\s*${nom}\\s[^;]*;`).exec(CSS)?.[0] ?? ''
    const [duree = Number.NaN, delai = 0] = [...regle.matchAll(/calc\(\s*(\d+)ms\s*\*\s*var\(--tempo\)\s*\)/g)].map((m) => Number(m[1]) * TEMPO)
    return { duree, delai, fin: duree + delai }
  }

  // Le jumeau de « les durées du carton » (`composteur.test.tsx`) : la scène attend les pas de
  // `deroule.ts`, la feuille des fêtes joue ses propres durées, et rien d'autre ne les lie. Chaque
  // geste qui mène à un pas dure ce pas ; ce qui se joue pendant un pas tient dedans.
  // Mutations, dans la feuille seule : `pointe` à 900 ms ; `pinceau`, `colle`, la durée ou le délai de
  // `glissiere`, le délai de `leve` ou d'`eclaire-colle` changés ; `eclaire` plus long que le pas de
  // la salle ; `frappe` ou `monte` plus longs que le pas qui les suit.
  it('la voiture complète joue le pas de la salle : « Complet » est tombé quand le carton vient, et le guidon se lève avec lui', () => {
    expect(jouee('glissiere').fin).toBe(SALLE[0])
    expect(jouee('leve').delai).toBe(SALLE[0])
    expect(jouee('eclaire').fin).toBeLessThanOrEqual(SALLE[0])
  })

  it('l’étiquette de malle joue les pas de la récompense : le pinceau passe, la colle luit, puis l’étiquette se colle', () => {
    expect(jouee('pinceau').fin).toBe(RECOMPENSE[0])
    expect(jouee('eclaire-colle').fin).toBe(RECOMPENSE[0])
    expect(jouee('colle').fin).toBe(RECOMPENSE[1])
  })

  it('la ligne bouclée joue les pas de l’année : une ligne pointée par pas, le tampon frappé avant le titre, chaque mot monté avant le suivant', () => {
    const lignes = ANNEE.slice(1, PAS_DE_L_ANNEE.ampoules)
    expect(new Set(lignes)).toEqual(new Set([jouee('pointe').fin]))
    expect(jouee('frappe').fin).toBeLessThanOrEqual(ANNEE[PAS_DE_L_ANNEE.medaille])
    expect(jouee('monte').fin).toBeLessThanOrEqual(Math.min(...ANNEE.slice(PAS_DE_L_ANNEE.titre)))
  })
})

describe('les fêtes de 1900, dans le séquenceur', () => {
  let vibrate: ReturnType<typeof vi.fn>
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
    vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
  })
  afterEach(() => {
    delete (navigator as { vibrate?: unknown }).vibrate
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function monter(scenes: readonly Scene[], o: { fiche?: FichePrete | null; carte?: Voyage; onUtiliser?: (a: number) => void } = {}) {
    const client = createQueryClient()
    client.setQueryData<Voyage>(cles.voyage, o.carte ?? CARTE)
    const requetes = servir({ [MONTRE]: () => new Response(null, { status: 204 }), 'GET /api/me/voyage': () => json(CARTE) })
    const onFin = vi.fn()
    const vue = render(
      <QueryClientProvider client={client}>
        <Celebrations monde={MONDE} membre="membre-1" scenes={scenes} onFin={onFin} fiche={o.fiche === undefined ? FICHE : o.fiche} onUtiliser={o.onUtiliser} />
      </QueryClientProvider>,
    )
    return { ...vue, requetes, onFin }
  }
  const racine = (c: HTMLElement) => c.querySelector('[data-vivante]')
  const etiquettes = () => within(screen.getByRole('list', { name: 'Les étiquettes de la malle' })).getAllByRole('listitem')
  const lignes = () => within(screen.getByRole('list', { name: 'Les arrivées de 1904' })).getAllByRole('listitem')
  const pointees = () => lignes().map((l) => `${l.querySelector('b')!.textContent}:${l.getAttribute('data-pointee')}`)

  // Mutations : `VoitureComplete` retiré des gabarits de 1900 (le rideau reviendrait, sans voie ni
  // fenêtres) ; le numéro de voie recalculé ; le carton monté avant `fini` ; « Complet » retiré.
  it('la salle bouclée est une voiture complète : sa voie, ses fenêtres, « Complet », puis le carton', async () => {
    const { container, onFin } = monter([VOITURE])
    expect(screen.getByRole('dialog', { name: 'Salle complète : Méliès, toujours' })).toHaveFocus()
    expect(screen.getByText('Voie 5')).toBeInTheDocument()
    const fenetres = within(screen.getByRole('list', { name: 'Les fenêtres de la voiture Méliès, toujours' })).getAllByRole('listitem')
    // Le film 2 n'a pas d'affiche : son titre tient la fenêtre.
    expect(fenetres.map((f) => f.querySelector('img')?.getAttribute('alt') ?? f.textContent)).toEqual(['Film 2', 'Film 3', 'Film 4', 'Film 5'])
    expect(fenetres.map((f) => f.querySelector('img')?.getAttribute('src') ?? null)).toEqual([null, '/affiche-3.jpg', '/affiche-4.jpg', '/affiche-5.jpg'])
    expect(screen.getByText('Complet')).toBeInTheDocument()
    expect(screen.queryByText('Voiture complète')).toBeNull()
    expect(racine(container)).toHaveAttribute('data-vivante', 'oui')
    await passer(somme(SALLE))
    expect(screen.getByText('Voiture complète')).toBeInTheDocument()
    expect(screen.getByText('Méliès, toujours')).toBeInTheDocument()
    expect(screen.getByText('Plus un film à y voir : le chef de gare lève le guidon.')).toBeInTheDocument()
    expect(vibrate).toHaveBeenCalledTimes(1)
    // Le toucher reste celui du cadre : n'importe où sur la scène, il passe à la suite.
    fireEvent.click(screen.getByText('Complet'))
    expect(onFin).toHaveBeenCalledTimes(1)
  })

  // Sans la salle (plusieurs à la fois, ou la carte sans fiche) : une voiture sans voie ni film nommé.
  // Mutation : une voie ou une liste de fenêtres rendue sans salle.
  it('plusieurs salles à la fois : des voitures, sans voie ni film nommé', () => {
    calme()
    monter([{ type: 'salle', noms: ['Méliès, toujours', 'Les poursuites'], combien: 2 }])
    expect(screen.getByText('Voitures complètes')).toBeInTheDocument()
    expect(screen.getByText('2 voitures')).toBeInTheDocument()
    expect(screen.queryByText(/^Voie /)).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  // Les étiquettes d'avant sont lues de la carte : celles de la décennie, avant l'année, récompensées.
  // Mutations : toutes les années de la carte (`recompensesDAvant` sans filtre : 1899, 1901 sans
  // récompense, 1904 et 1905 entreraient) ; l'étiquette neuve collée avant le pas de la frappe ; le
  // nom dit avant la fin.
  it('la récompense est une étiquette collée sur la malle, à côté de celles des années d’avant', async () => {
    const { container } = monter([LION], { carte: AVEC_1905 })
    expect(screen.getByRole('dialog', { name: 'Le Lion : les essentiels de 1904' })).toBeInTheDocument()
    expect(etiquettes().map((e) => e.textContent)).toEqual(['Lion1900', 'Palme1902', 'Ours1903'])
    expect(container.querySelector('[data-neuve]')).toBeNull()
    await passer(RECOMPENSE[0])
    expect(etiquettes().map((e) => e.textContent)).toEqual(['Lion1900', 'Palme1902', 'Ours1903', 'Ch. de fer du VoyageLion1904'])
    expect(container.querySelector('[data-neuve]')).toHaveAttribute('data-forme', 'ronde')
    expect(screen.queryByText('Le Lion')).toBeNull()
    await passer(RECOMPENSE[1] + RECOMPENSE[2])
    expect(screen.getByText('Le Lion')).toBeInTheDocument()
    expect(screen.getByText('les essentiels de 1904')).toBeInTheDocument()
  })

  // La première récompense de la décennie : la malle est nue, rien ne s'invente.
  it('sans récompense avant elle, l’étiquette est seule sur la malle', () => {
    calme()
    monter([{ type: 'recompense', annee: 1900, recompense: 'ours' }])
    expect(etiquettes().map((e) => e.textContent)).toEqual(['Ch. de fer du VoyageOurs1900'])
    expect(etiquettes()[0]).toHaveAttribute('data-forme', 'carree')
  })

  // Les lignes sont celles de l'indicateur, sur les arrivées de la fiche : elles se pointent une à une,
  // une ligne attendue ne se pointe jamais. Mutations : `a.arrivee` retiré de `data-pointee` (la Palme
  // attendue serait pointée) ; `pas > i` retiré (toutes pointées d'emblée) ; le tampon ou le carton
  // montés avant leur pas ; la ligne du ticket recomptée ici.
  it('l’année bouclée pointe ses lignes une à une, reçoit le tampon, puis le guichet tend le carton', async () => {
    monter([LIGNE], { onUtiliser: () => undefined })
    expect(screen.getByRole('dialog', { name: '1904 est bouclée' })).toBeInTheDocument()
    expect(screen.getByText('Cinquième gare')).toBeInTheDocument()
    expect(lignes().map((l) => l.textContent)).toEqual(['Ours3 films de 1904arrivé · 4', 'LionTous les essentielsarrivé', 'Palme2 salles complètesattendu · 1 sur 2', 'TicketLe ticket pour 1905arrivé'])
    expect(pointees()).toEqual(['Ours:non', 'Lion:non', 'Palme:non', 'Ticket:non'])
    await passer(ANNEE[0])
    expect(pointees()).toEqual(['Ours:oui', 'Lion:non', 'Palme:non', 'Ticket:non'])
    await passer(ANNEE[1] + ANNEE[2] + ANNEE[3])
    expect(pointees()).toEqual(['Ours:oui', 'Lion:oui', 'Palme:non', 'Ticket:oui'])
    expect(screen.queryByText('Ligne bouclée')).toBeNull()
    await passer(somme(ANNEE.slice(4, PAS_DE_L_ANNEE.medaille)))
    expect(screen.getByText('Ligne bouclée')).toBeInTheDocument()
    expect(vibrate).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Bon pour 1905')).toBeNull()
    await passer(somme(ANNEE.slice(PAS_DE_L_ANNEE.medaille, PAS_DE_L_ANNEE.guichet)))
    expect(screen.getByText('est bouclée')).toBeInTheDocument()
    expect(screen.getByText('Lion · les essentiels de 1904')).toBeInTheDocument()
    expect(screen.getByText('Bon pour 1905')).toBeInTheDocument()
    expect(screen.getByText('de 1904 à Bassersdorf')).toBeInTheDocument()
    // Le carton du « Bon pour » n'a ni note ni trous : ce n'est pas un billet de séance.
    expect(screen.queryByText('sans note')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    await passer(ANNEE[PAS_DE_L_ANNEE.guichet]!)
    expect(screen.getByRole('button', { name: 'Le garder' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'L’utiliser' })).toBeInTheDocument()
  })

  // Le toucher qui termine la scène, redoublé au même endroit, ne dépense pas le billet. Mutation :
  // `GARDE_DU_CHOIX` à zéro (le second toucher, un dixième de seconde après, tomberait sur un bouton armé).
  it('le billet n’est pas dépensé par un toucher redoublé, puis le choix répond une fois', async () => {
    const onUtiliser = vi.fn()
    const { requetes, onFin } = monter([LIGNE], { onUtiliser })
    await passer(ANNEE[0])
    fireEvent.click(screen.getByRole('dialog'))
    const utiliser = screen.getByRole('button', { name: 'L’utiliser' })
    expect(utiliser).toHaveAttribute('aria-disabled', 'true')
    await passer(100)
    expect(100).toBeLessThan(GARDE_DU_CHOIX)
    fireEvent.click(utiliser)
    fireEvent.click(screen.getByRole('button', { name: 'Le garder' }))
    expect(onUtiliser).not.toHaveBeenCalled()
    expect(onFin).not.toHaveBeenCalled()
    expect(requetes).toEqual([])
    await passer(GARDE_DU_CHOIX)
    act(() => {
      utiliser.click()
      utiliser.click()
    })
    await passer(0)
    expect(onUtiliser).toHaveBeenCalledTimes(1)
    expect(onUtiliser).toHaveBeenCalledWith(1905)
    expect(requetes.filter((r) => r === MONTRE)).toHaveLength(1)
    expect(onFin).toHaveBeenCalledTimes(1)
  })

  // Le rattrapage de la carte ne tient pas de fiche : pas d'indicateur, et rien d'inventé.
  // Mutation : des lignes écrites sans arrivées (la ligne du ticket supposée).
  it('sans la fiche de l’année, la ligne bouclée n’a pas d’indicateur : la plaque, le tampon, le carton', () => {
    calme()
    monter([LIGNE], { fiche: null })
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.getByText('Cinquième gare')).toBeInTheDocument()
    expect(screen.getByText('Ligne bouclée')).toBeInTheDocument()
    expect(screen.getByText('Bon pour 1905')).toBeInTheDocument()
  })

  // Les confettis du poinçon ne tombent que d'une salve jouée. Mutations : les confettis montés sans
  // regarder `salve` (ils tomberaient d'un toucher impatient) ou sans regarder le calme.
  it('les confettis du poinçon tombent au pas de la médaille, jamais d’un toucher impatient', async () => {
    const jouee = monter([LIGNE])
    await passer(somme(ANNEE.slice(0, PAS_DE_L_ANNEE.medaille - 1)))
    expect(jouee.container.querySelector('[data-chads]')).toBeNull()
    await passer(ANNEE[PAS_DE_L_ANNEE.medaille - 1]!)
    expect(jouee.container.querySelector('[data-chads]')).not.toBeNull()
    jouee.unmount()
    const pressee = monter([LIGNE])
    await passer(ANNEE[0])
    fireEvent.click(screen.getByRole('dialog'))
    await passer(somme(ANNEE))
    expect(screen.getByText('Bon pour 1905')).toBeInTheDocument()
    expect(pressee.container.querySelector('[data-chads]')).toBeNull()
  })

  // Rien ne bouge au calme : chaque fête pose son état final d'un coup, sous une racine qui n'anime
  // rien, sans pinceau ni confettis, sans vibration (les minuteries sont celles du séquenceur, que
  // `Celebrations.test.tsx` tient pour tout monde : un dessin n'en pose aucune). Mutations : `calme` ignoré dans
  // un des trois dessins (`data-vivante` à « oui ») ; le pinceau ou les confettis montés au calme.
  it.each([
    ['la voiture complète', VOITURE, 'Voiture complète', 'Continuer'],
    ['l’étiquette de malle', LION, 'Le Lion', 'Continuer'],
    ['la ligne bouclée', LIGNE, 'Bon pour 1905', 'Le garder'],
  ] as const)('au calme, %s pose son état final et rien ne bouge', async (_nom, scene, mot, bouton) => {
    calme()
    const { container } = monter([scene])
    expect(racine(container)).toHaveAttribute('data-vivante', 'non')
    expect(container.querySelectorAll('[data-vivante="oui"]')).toHaveLength(0)
    expect(screen.getByText(mot)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: bouton })).toBeInTheDocument()
    expect(container.querySelector('[data-chads]')).toBeNull()
    expect(container.querySelector('[class*="pinceau"]')).toBeNull()
    await passer(somme(ANNEE))
    expect(vibrate).not.toHaveBeenCalled()
  })
  it('au calme, l’étiquette neuve est collée et les lignes arrivées sont pointées d’emblée', () => {
    calme()
    const { container, unmount } = monter([LION])
    expect(container.querySelector('[data-neuve]')).not.toBeNull()
    unmount()
    monter([LIGNE])
    expect(pointees()).toEqual(['Ours:oui', 'Lion:oui', 'Palme:non', 'Ticket:oui'])
  })
  // Le jumeau : hors du calme, la racine vit et le pinceau passe. Sans lui, le calme ne prouverait rien.
  it('hors du calme, la racine de chaque fête vit', () => {
    const { container } = monter([LION])
    expect(racine(container)).toHaveAttribute('data-vivante', 'oui')
    expect(container.querySelector('[class*="pinceau"]')).not.toBeNull()
  })

  // Les mêmes scènes, dans le même ordre, et aucune autre : la scène « Étiquette collée » d'un badge
  // (maquette, écran 13) n'est pas de ce lot. Mutation : une scène de plus glissée dans le séquenceur
  // après la récompense.
  it('trois scènes, dans l’ordre, et aucune scène de badge', () => {
    calme()
    const { onFin } = monter([VOITURE, LION, LIGNE])
    const noms: string[] = []
    for (let i = 0; i < 6 && screen.queryByRole('dialog'); i += 1) {
      noms.push(screen.getByRole('dialog').getAttribute('aria-label')!)
      expect(screen.queryByText(/Étiquette collée/)).toBeNull()
      fireEvent.click(screen.queryByRole('button', { name: 'Continuer' }) ?? screen.getByRole('button', { name: 'Le garder' }))
    }
    expect(noms).toEqual(['Salle complète : Méliès, toujours', 'Le Lion : les essentiels de 1904', '1904 est bouclée'])
    expect(onFin).toHaveBeenCalledTimes(1)
  })
})

describe('les fêtes de 1900, sur la fiche de l’année', () => {
  const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
  const AVANT = { profondeur: 3, progression: { ...PROGRESSION, essentiels_vus: 1, salles_completes: 0 }, fete: { sallesCompletes: 0, salles: [], recompense: 'ours' as const, ticket: null } }
  const calmeIci = calme
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => {
    oublierLeRetour(1904)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // La page passe sa fiche au séquenceur : la voiture a sa voie, la ligne ses arrivées, et la fête ne
  // lit rien de plus (ni fiche d'une autre année, ni l'état du voyageur, ni les étiquettes de badges).
  // Mutations : `fiche` non passée par `VoyageAnnee` (ni voie, ni indicateur) ; une lecture ajoutée
  // par un dessin.
  it('au retour d’un billet, la fête montre la salle et les arrivées de la fiche relue, sans rien lire de plus', async () => {
    calmeIci()
    confierLeRetour(1904, SESSION.user.id, { avant: AVANT, guet: null })
    const { requetes } = monterVoyage(
      '/voyage/1904',
      {
        'GET /api/me/voyage': () => json(CARTE),
        'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
        'GET /api/me/voyage/annees/1904': () => json(FICHE),
        'GET /api/me/journal?limit=100&sortie_min=1904&sortie_max=1904': () => json({ ...PAGE, items: [], next_cursor: null }),
        [MONTRE]: () => new Response(null, { status: 204 }),
      },
      (c) => {
        c.setQueryData(cles.voyage, CARTE)
        c.setQueryData(cles.annee(1904), { ...FICHE, profondeur: 3, progression: AVANT.progression, recompense: 'ours', ticket: null })
      },
    )
    expect(await screen.findByRole('dialog', { name: 'Salle complète : Méliès, toujours' })).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByText('Voie 5')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    const malle = within(screen.getByRole('dialog', { name: 'Le Lion : les essentiels de 1904' })).getByRole('list', { name: 'Les étiquettes de la malle' })
    expect(within(malle).getAllByRole('listitem').map((e) => e.textContent)).toEqual(['Lion1900', 'Palme1902', 'Ours1903', 'Ch. de fer du VoyageLion1904'])
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    const ligne = within(screen.getByRole('dialog', { name: '1904 est bouclée' }))
    expect(within(ligne.getByRole('list', { name: 'Les arrivées de 1904' })).getAllByRole('listitem')).toHaveLength(4)
    expect(ligne.getByText('Bon pour 1905')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Le garder' }))
    await waitFor(() => expect(requetes).toContain(MONTRE))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(requetes.filter((r) => /voyageur|etiquettes|objets|annees\/(?!1904)/.test(r))).toEqual([])
  })
})
