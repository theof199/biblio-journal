import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { JournalPage } from '../../../api/journal'
import type { FichePrete } from '../../../api/voyage'
import { creerRegistre } from '../..'
import { PAGES_1890 } from '../../1890/pages'
import { exemple } from '../../../test/contrat'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { fichePrete, filmDeSalle, salle, voyage1890 } from '../../../test/voyage'
import Feuille from '../../../voyage/Feuille'
import { PAGES_1900 } from '../pages'
import PageDuGuide from './PageDuGuide'
import feuille from './PageDuGuide.module.css?raw'

/**
 * La feuille du chroniqueur des années 1900 (les derniers écrans de 1900, brief 5) : une page du
 * « Guide du voyageur ». Les cas de `voyage/Feuille.test.tsx` qui portent sur le dialogue valent pour
 * elle, rejoués ici au monde de 1900 ; puis ce qui lui est propre (pas d'estrade, la tête hors de ce
 * qui défile, les mots de 1900), ce qu'elle ne doit pas montrer avant que `Feuille` le dise vu, et ses
 * usages sur une fiche d'année. Celui de la fiche d'un film est tenu par `hale.test.tsx` (« Le film »).
 */
const monde = creerRegistre()(1900)
const calme = (oui: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: oui, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
/** 28 mots après la lettrine ; la suite à 28 × 75 + 350 ms, le second paragraphe 420 ms plus tard. */
const LONG =
  'Un premier paragraphe assez long pour être composé mot à mot par le chroniqueur, qui prend son temps et sa plume ; puis la suite arrive en fondu, bien après les mots.\n\nUn second paragraphe.'
const PREMIERE_SUITE = 28 * 75 + 350
const SUITE = 'bien après les mots.'
const ESTRADE = 'Le chroniqueur sur son estrade.'

type Etat = Parameters<typeof Feuille>[0]['etat']
const page = (etat: Etat, onFermer = vi.fn(), onReessayer = vi.fn(), m = monde) => (
  <Feuille monde={m} quoi="ouverture" esp="Ouverture" titre="1903" sous="Le voyage immobile" etat={etat} onFermer={onFermer} onReessayer={onReessayer} />
)
function monter(etat: Etat, onFermer = vi.fn(), onReessayer = vi.fn()) {
  return { ...render(page(etat, onFermer, onReessayer)), onFermer, onReessayer }
}
/** Le fondu : la page cache par un `opacity: 0` en ligne ce qui n'est pas encore dit vu. */
const cache = (el: HTMLElement) => el.style.opacity === '0'
/** Le corps d'une règle de la feuille, tel qu'écrit. */
function regle(css: string, selecteur: string) {
  const debut = css.indexOf(`${selecteur} {`)
  if (debut < 0) throw new Error(`règle absente : ${selecteur}`)
  const reste = css.slice(debut)
  return reste.slice(reste.indexOf('{') + 1, reste.indexOf('}'))
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('la feuille du chroniqueur des années 1900', () => {
  // Mutations : `feuilleDuChroniqueur` retiré de `PAGES_1900` (l'estrade reviendrait) ; une `Toile`
  // d'estrade, ou son libellé, remontée dans `PageDuGuide` ; la clé donnée à 1890.
  it('est une page du Guide, sans estrade ; en 1890, l’estrade reste et la page du Guide n’existe pas', () => {
    calme(true)
    expect(PAGES_1900.gabarits.feuilleDuChroniqueur).toBe(PageDuGuide)
    expect(PAGES_1890.gabarits.feuilleDuChroniqueur).toBeUndefined()
    const vue = monter({ type: 'texte', texte: LONG })
    const dialogue = screen.getByRole('dialog')
    expect(dialogue.firstElementChild).toHaveAttribute('data-vivante')
    expect(screen.queryByRole('img')).toBeNull()
    expect(dialogue.querySelector('canvas')).toBeNull()
    expect(dialogue).not.toHaveTextContent(/estrade/i)
    expect(within(dialogue).getByText('Guide du voyageur')).toBeInTheDocument()
    vue.unmount()
    render(page({ type: 'texte', texte: LONG }, vi.fn(), vi.fn(), creerRegistre()(1890)))
    expect(screen.getByRole('img', { name: ESTRADE })).toBeInTheDocument()
    expect(screen.getByRole('dialog').firstElementChild).not.toHaveAttribute('data-vivante')
    expect(screen.queryByText('Guide du voyageur')).toBeNull()
  })

  // Mutations : la rubrique ou le titre du dessin sans l'identifiant que `Feuille` lui passe (le
  // dialogue perdrait la moitié de son nom) ; le sous-titre, le titre courant ou le folio retirés.
  it.each([
    { quoi: 'ouverture', esp: 'Ouverture', titre: '1903', sous: 'Le voyage immobile', folio: 'Feuille n° 1' },
    { quoi: 'salle', esp: 'Salle', titre: 'Les essentiels', sous: '1903', folio: 'Feuille n° 2' },
    { quoi: 'film', esp: 'Le film', titre: 'Le Vol du grand rapide', sous: '1903 · salle « Les essentiels »', folio: 'Feuille n° 3' },
    { quoi: 'generique', esp: 'Générique', titre: 'Le générique de fin', sous: '1903', folio: 'Feuille n° 4' },
  ] as const)('$quoi : un dialogue nommé par sa rubrique et son titre, son sous-titre, et son folio en tête', ({ quoi, esp, titre, sous, folio }) => {
    calme(true)
    render(<Feuille monde={monde} quoi={quoi} esp={esp} titre={titre} sous={sous} etat={{ type: 'texte', texte: LONG }} onFermer={vi.fn()} onReessayer={vi.fn()} />)
    const dialogue = screen.getByRole('dialog', { name: `${esp} ${titre}` })
    expect(dialogue).toHaveAttribute('aria-modal', 'true')
    expect(within(dialogue).getByRole('heading', { level: 2, name: titre })).toBeInTheDocument()
    expect(within(dialogue).getByText(esp)).toBeInTheDocument()
    expect(within(dialogue).getByText(sous)).toBeInTheDocument()
    // Le folio est dans la tête, à côté du titre courant et de « Fermer », hors de ce qui défile.
    const tete = within(dialogue).getByRole('button', { name: 'Fermer' }).parentElement!
    expect(tete).toHaveTextContent('Guide du voyageur')
    expect(within(tete).getByText(folio)).toBeInTheDocument()
  })

  // Mutation : la référence du focus non posée sur « Fermer ».
  it('prend le focus sur « Fermer » et se ferme à Échap', () => {
    calme(true)
    const { onFermer } = monter({ type: 'attente' })
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onFermer).toHaveBeenCalledOnce()
  })

  // Mutations : le bouton « Fermer » sans son `onClick`, ou sans son mot ; un `onClick={onFermer}` posé
  // sur la page (toucher le texte fermerait).
  it('se ferme d’un toucher sur « Fermer », jamais d’un toucher sur le texte', () => {
    calme(true)
    const { onFermer } = monter({ type: 'texte', texte: LONG })
    fireEvent.click(screen.getByText('Un second paragraphe.'))
    expect(onFermer).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onFermer).toHaveBeenCalledOnce()
  })

  // Mutation : la référence du focus non posée (rien n'aurait pris le focus, rien ne le rendrait).
  it('rend le focus, à la fermeture, à l’élément qui l’avait', () => {
    calme(true)
    const vue = (ouvert: boolean) => (
      <>
        <button type="button">Lire l’ouverture</button>
        {ouvert ? page({ type: 'attente' }) : null}
      </>
    )
    const { rerender } = render(vue(false))
    screen.getByRole('button', { name: 'Lire l’ouverture' }).focus()
    rerender(vue(true))
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus()
    rerender(vue(false))
    expect(screen.getByRole('button', { name: 'Lire l’ouverture' })).toHaveFocus()
  })

  // Le dessin ne pose pas de jetons : ceux du calque, posés par `Feuille`, sont ceux de 1900.
  it('pose les jetons de son monde', () => {
    calme(true)
    monter({ type: 'attente' })
    expect(screen.getByRole('dialog').style.getPropertyValue('--m-tel')).toBe(PAGES_1900.jetons['--m-tel'])
  })

  // Le dessin n'a pas d'horloge : hors du calme, il ne montre la suite, puis chaque paragraphe, qu'au
  // moment où `Feuille` les dit vus, et chaque mot attend son tour. Mutations : `cache` ignoré sur la
  // suite ou sur un paragraphe (tout montré d'un coup) ; le délai d'un mot non posé (les mots viendraient
  // ensemble) ; `debut` rendu d'un bloc hors du calme.
  it('hors du calme, les mots viennent l’un après l’autre, puis la suite, puis chaque paragraphe, à la cadence de la feuille', () => {
    calme(false)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    monter({ type: 'texte', texte: LONG })
    expect(screen.getByRole('dialog').firstElementChild).toHaveAttribute('data-vivante', 'oui')
    const premier = screen.getByText(SUITE).parentElement!
    const mots = [...premier.querySelectorAll<HTMLElement>('span')].filter((s) => s.style.animationDelay !== '')
    expect(mots.map((s) => s.style.animationDelay)).toEqual(Array.from({ length: 28 }, (_, k) => `${k * 75}ms`))
    expect(mots[0]).toHaveTextContent('n')
    expect(mots[27]).toHaveTextContent('fondu,')
    expect(cache(screen.getByText(SUITE))).toBe(true)
    expect(cache(screen.getByText('Un second paragraphe.'))).toBe(true)
    act(() => void vi.advanceTimersByTime(PREMIERE_SUITE - 1))
    expect(cache(screen.getByText(SUITE))).toBe(true)
    act(() => void vi.advanceTimersByTime(1))
    expect(cache(screen.getByText(SUITE))).toBe(false)
    expect(cache(screen.getByText('Un second paragraphe.'))).toBe(true)
    act(() => void vi.advanceTimersByTime(420))
    expect(cache(screen.getByText('Un second paragraphe.'))).toBe(false)
  })

  // Mutations : `data-vivante` posé en dur à « oui » ; au calme, la suite ou un paragraphe laissés
  // cachés ; les mots rendus un à un au calme (ils porteraient un délai, et attendraient).
  it('au calme, le texte est entier, posé d’un bloc, et rien n’est vivant', () => {
    calme(true)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    monter({ type: 'texte', texte: LONG })
    expect(vi.getTimerCount()).toBe(0)
    const dialogue = screen.getByRole('dialog')
    expect(dialogue.firstElementChild).toHaveAttribute('data-vivante', 'non')
    expect(dialogue).toHaveTextContent(LONG.replace('\n\n', ''))
    expect(cache(screen.getByText(SUITE))).toBe(false)
    expect(cache(screen.getByText('Un second paragraphe.'))).toBe(false)
    expect([...dialogue.querySelectorAll<HTMLElement>('span')].filter((s) => s.style.animationDelay !== '')).toEqual([])
  })

  // Mutations : le message de l'API remplacé par une phrase du dessin ; « Réessayer » retiré, ou sans
  // son geste ; « Réessayer » offert aussi sous un texte ou pendant l'attente ; la plaque en dur.
  it('l’erreur dit le message de l’API tel quel sous la plaque du monde et offre « Réessayer », que rien d’autre n’offre', () => {
    calme(true)
    const { onReessayer, rerender, onFermer } = monter({ type: 'erreur', message: 'Le chroniqueur ne répond pas pour l’instant.' })
    expect(screen.getByText('Le chroniqueur ne répond pas pour l’instant.')).toBeInTheDocument()
    expect(PAGES_1900.mots.chroniqueur.relache).not.toBe(PAGES_1890.mots.chroniqueur.relache)
    expect(screen.getByText(PAGES_1900.mots.chroniqueur.relache)).toBeInTheDocument()
    expect(screen.queryByText('RELÂCHE')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(onReessayer).toHaveBeenCalledOnce()
    expect(onFermer).not.toHaveBeenCalled()
    rerender(page({ type: 'attente' }))
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull()
    rerender(page({ type: 'texte', texte: LONG }))
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull()
    expect(screen.queryByText(PAGES_1900.mots.chroniqueur.relache)).toBeNull()
  })

  // Mutations : la phrase de 1890 gardée en 1900 ; l'attente sans son nom ; la phrase entière montrée
  // d'emblée hors du calme (le dessin qui ignorerait `tapee`), ou ses lettres lues une à une.
  it('l’attente a les mots de 1900, d’un seul nom, tapée lettre à lettre hors du calme et entière au calme', () => {
    const phrase = PAGES_1900.mots.chroniqueur.ecrit
    expect(phrase).not.toBe(PAGES_1890.mots.chroniqueur.ecrit)
    calme(false)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const vive = monter({ type: 'attente' })
    const etat = () => screen.getByRole('status', { name: phrase })
    expect(etat()).toHaveTextContent(phrase.slice(0, 1), { normalizeWhitespace: false })
    expect(etat()).not.toHaveTextContent(phrase)
    act(() => void vi.advanceTimersByTime(65 * 4))
    expect(etat().textContent).toBe(phrase.slice(0, 5))
    for (const span of etat().querySelectorAll('span')) expect(span).toHaveAttribute('aria-hidden', 'true')
    vive.unmount()
    calme(true)
    monter({ type: 'attente' })
    expect(etat().textContent).toBe(phrase)
  })

  // Le texte long défile sans que « Fermer » passe sur lui : la tête est hors de ce qui défile.
  // Mutations : « Fermer » rendu dans la zone qui défile ; le défilement remis sur la page entière
  // (`overflow-y` retiré de `.defile`), ou la tête rendue collante par-dessus ; « Fermer » sous la cible tactile.
  it('seule la page défile : « Fermer », le titre courant et le folio sont hors d’elle, et « Fermer » fait 44 px', () => {
    calme(true)
    monter({ type: 'texte', texte: LONG })
    const defile = screen.getByRole('heading', { level: 2 }).parentElement!.parentElement!
    expect(defile).toContainElement(screen.getByText('Un second paragraphe.'))
    expect(defile).not.toContainElement(screen.getByRole('button', { name: 'Fermer' }))
    expect(defile).not.toContainElement(screen.getByText('Feuille n° 1'))
    expect(regle(feuille, '.defile')).toMatch(/overflow-y:\s*auto/)
    expect(regle(feuille, '.defile')).toMatch(/min-height:\s*0/)
    expect(regle(feuille, '.page')).toMatch(/height:\s*100%/)
    expect(regle(feuille, '.page')).not.toMatch(/overflow/)
    expect(regle(feuille, '.tete')).not.toMatch(/position/)
    expect(regle(feuille, '.fermer')).toMatch(/min-height:\s*44px/)
    expect(regle(feuille, '.fermer')).toMatch(/min-width:\s*44px/)
  })
})

describe('les feuilles d’une fiche d’année 1900 sont des pages du Guide', () => {
  const VOYAGE = voyage1890(1903, [{ annee: 1903, statut: 'en_cours', visitee: true, recompense: null }], { ia: true, source: null, rattrape_la_source: false })
  const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
  const ROBBERY = filmDeSalle({ id: 'f-rob', tmdb_id: 5698, rang: 1, title: 'The Great Train Robbery', year: 1903, etat: 'vu', note: 9, cover_url: null })
  const FICHE: FichePrete = fichePrete({
    annee: 1903,
    ouverture: 'En 1903, le cinéma apprend à raconter.\n\nPrenez place.',
    ticket: { annee: 1904, emis_le: '2026-10-08T21:00:00.000Z', utilise_le: null },
    maturite: null,
    generique: 'La ligne est bouclée.',
    pistes: [],
    demande_salle: null,
    salles: [salle({ id: 's-ess', rang: 1, nom: 'Les essentiels', contexte: 'Ce qu’il ne fallait pas manquer.', films: [ROBBERY] })],
    seances: [],
    seance_en_cours: false,
  })
  const ROUTES = {
    'GET /api/me/voyage': () => json(VOYAGE),
    'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
    'GET /api/me/voyage/tables': () => json({ tables: [] }),
    'GET /api/me/voyage/annees/1903': () => json(FICHE),
    'GET /api/me/journal?limit=100&sortie_min=1903&sortie_max=1903': () => json({ ...PAGE, items: [], next_cursor: null }),
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    calme(true)
    localStorage.clear()
  })

  /** La feuille ouverte : une page du Guide (sa racine, son titre courant), sans estrade, avec son texte. */
  const page1900 = async (nom: string, titre: string, texte: string) => {
    const dialogue = await screen.findByRole('dialog', { name: nom })
    expect(dialogue.firstElementChild).toHaveAttribute('data-vivante')
    expect(within(dialogue).getByRole('heading', { level: 2, name: titre })).toBeInTheDocument()
    expect(within(dialogue).getByText('Guide du voyageur')).toBeInTheDocument()
    expect(within(dialogue).queryByRole('img', { name: ESTRADE })).toBeNull()
    expect(within(dialogue).getByRole('button', { name: 'Fermer' })).toBeInTheDocument()
    expect(dialogue).toHaveTextContent(texte)
    return dialogue
  }

  // Mutations, pour les trois : le site qui ne passerait plus par `Feuille` ; la rubrique ou le titre
  // perdus par le dessin ; une lecture ajoutée à l'ouverture d'un texte déjà écrit.
  it('« Lire l’ouverture » ouvre la page de l’année, sans rien lire de plus', async () => {
    const { requetes } = monterVoyage('/voyage/1903', ROUTES)
    fireEvent.click(await screen.findByRole('button', { name: 'Lire l’ouverture' }))
    const avant = requetes.length
    const dialogue = await page1900('Ouverture 1903', '1903', 'Prenez place.')
    expect(within(dialogue).getByText('Feuille n° 1')).toBeInTheDocument()
    expect(requetes.length).toBe(avant)
  })

  it('« Le générique de fin » ouvre la page du générique, déjà écrit : rien n’est demandé au chroniqueur', async () => {
    const { requetes } = monterVoyage('/voyage/1903', ROUTES)
    fireEvent.click(await screen.findByRole('button', { name: 'Le générique de fin' }))
    const dialogue = await page1900('Générique Le générique de fin', 'Le générique de fin', 'La ligne est bouclée.')
    expect(within(dialogue).getByText('Feuille n° 4')).toBeInTheDocument()
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([])
  })

  it('« Le contexte de la salle » ouvre la page de la salle par-dessus sa voiture, déjà écrit : rien n’est demandé', async () => {
    const { requetes } = monterVoyage('/voyage/1903?voiture=s-ess', ROUTES)
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Les essentiels' })).getByRole('button', { name: /Le contexte de la salle/ }))
    const dialogue = await page1900('Salle Les essentiels', 'Les essentiels', 'Ce qu’il ne fallait pas manquer.')
    expect(within(dialogue).getByText('Feuille n° 2')).toBeInTheDocument()
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([])
  })
})
