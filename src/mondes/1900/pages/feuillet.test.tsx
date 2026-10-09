import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { JournalPage } from '../../../api/journal'
import type { FichePrete } from '../../../api/voyage'
import { creerRegistre } from '../..'
import { exemple } from '../../../test/contrat'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { fichePrete, filmDeSalle, morceau, salle, seance, voyage1890 } from '../../../test/voyage'
import Feuillet from '../../../voyage/Feuillet'
import { PAGES_1900 } from '../pages'
import CadreDuFeuillet from './CadreDuFeuillet'
import feuille from './Feuillet.module.css?raw'

/**
 * Le cadre des feuillets des années 1900 (les derniers écrans de 1900, brief 2). Les sept cas de
 * `voyage/Feuillet.test.tsx` valent pour lui, rejoués ici au monde de 1900 ; puis ce qui lui est
 * propre (le calme, la tête qui ne défile pas), et les contenus des feuillets d'une fiche d'année, que
 * le cadre ne doit pas perdre. Les deux feuillets de la fiche d'un film (le podium, la table) sont
 * tenus de la même façon par `hale.test.tsx`, le titre d'une marche par `classes.test.tsx`.
 */
const monde = creerRegistre()(1900)
const calme = () => vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

function monter(onFermer = vi.fn(), choisir = vi.fn()) {
  const vue = render(
    <Feuillet monde={monde} titre="2ᵉ classe" onFermer={onFermer}>
      <button type="button" onClick={choisir}>
        Le Voyage dans la Lune
      </button>
    </Feuillet>,
  )
  return { ...vue, onFermer, choisir }
}

/** Le corps d'une règle de la feuille, tel qu'écrit. */
function regle(css: string, selecteur: string) {
  const debut = css.indexOf(`${selecteur} {`)
  if (debut < 0) throw new Error(`règle absente : ${selecteur}`)
  const reste = css.slice(debut)
  return reste.slice(reste.indexOf('{') + 1, reste.indexOf('}'))
}

afterEach(() => vi.unstubAllGlobals())

describe('un feuillet des années 1900', () => {
  // Le plancher : c'est bien le cadre de 1900 que ces cas montent, pas le défaut. Mutation : `feuillet`
  // retiré de `PAGES_1900`.
  it('est monté dans le cadre de 1900', () => {
    expect(PAGES_1900.gabarits.feuillet).toBe(CadreDuFeuillet)
    monter()
    expect(screen.getByRole('dialog').firstElementChild).toHaveAttribute('data-vivante')
  })

  // Mutation : le titre du cadre sans l'identifiant que `Feuillet` lui passe (le dialogue perdrait son nom).
  it('est un dialogue nommé par son titre, qui porte ses choix', () => {
    monter()
    expect(screen.getByRole('dialog', { name: '2ᵉ classe' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { level: 2, name: '2ᵉ classe' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Le Voyage dans la Lune' })).toBeInTheDocument()
  })

  // Mutation : la référence du focus non posée sur « Fermer ».
  it('prend le focus et se ferme à Échap', () => {
    const { onFermer } = monter()
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onFermer).toHaveBeenCalledOnce()
  })

  // Mutation : le bouton « Fermer » du cadre sans son `onClick`, ou sans son mot.
  it('se ferme d’un toucher sur « Fermer »', () => {
    const { onFermer } = monter()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onFermer).toHaveBeenCalledOnce()
  })

  // Mutation : la référence du focus non posée (rien n'aurait pris le focus, rien ne le rendrait).
  it('rend le focus, à la fermeture, à l’élément qui l’avait', () => {
    const vue = (ouvert: boolean) => (
      <>
        <button type="button">La portière de 2ᵉ classe</button>
        {ouvert ? (
          <Feuillet monde={monde} titre="2ᵉ classe" onFermer={vi.fn()}>
            <p>Rien</p>
          </Feuillet>
        ) : null}
      </>
    )
    const { rerender } = render(vue(false))
    screen.getByRole('button', { name: 'La portière de 2ᵉ classe' }).focus()
    rerender(vue(true))
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus()
    rerender(vue(false))
    expect(screen.getByRole('button', { name: 'La portière de 2ᵉ classe' })).toHaveFocus()
  })

  // Mutation : un `onClick={onFermer}` posé sur le cadre (un choix fermerait aussi).
  it('se ferme d’un toucher sur le voile, jamais d’un choix', () => {
    const { onFermer, choisir, container } = monter()
    fireEvent.click(screen.getByRole('button', { name: 'Le Voyage dans la Lune' }))
    expect(choisir).toHaveBeenCalledOnce()
    expect(onFermer).not.toHaveBeenCalled()
    fireEvent.click(container.querySelector('[aria-hidden="true"]')!)
    expect(onFermer).toHaveBeenCalledOnce()
  })

  // Le cadre ne pose pas de jetons : ceux du calque, posés par `Feuillet`, sont ceux de 1900.
  it('pose les jetons de son monde', () => {
    const { container } = monter()
    expect(container.querySelector<HTMLElement>(':scope > div')!.style.getPropertyValue('--m-papier')).toBe(PAGES_1900.jetons['--m-papier'])
  })

  // Mutations : la hauteur des choix retirée, ou abaissée ; le bouton « Fermer » sous la cible tactile.
  it('fait 44 px au moins à chaque ligne touchable et à « Fermer »', () => {
    expect(regle(feuille, '.choix :is(button, a)')).toMatch(/min-height:\s*44px/)
    expect(regle(feuille, '.fermer')).toMatch(/min-height:\s*44px/)
    expect(regle(feuille, '.fermer')).toMatch(/min-width:\s*44px/)
  })

  // Mutations : `data-vivante` posé en dur à « oui » ; le calme lu à l'envers.
  it('ne se détache qu’hors du calme', () => {
    const vive = monter()
    expect(screen.getByRole('dialog').firstElementChild).toHaveAttribute('data-vivante', 'oui')
    vive.unmount()
    calme()
    monter()
    expect(screen.getByRole('dialog').firstElementChild).toHaveAttribute('data-vivante', 'non')
  })

  // Le feuillet le plus long défile sans que « Fermer » passe sur son contenu : la tête est hors de
  // ce qui défile. Mutations : « Fermer » rendu dans la zone des choix ; le défilement remis sur le
  // cadre entier (`overflow-y` retiré de `.choix`), ou la tête rendue collante par-dessus.
  it('seuls les choix défilent : « Fermer » et le titre sont hors d’eux', () => {
    monter()
    const choix = screen.getByRole('button', { name: 'Le Voyage dans la Lune' }).parentElement!
    expect(choix).not.toContainElement(screen.getByRole('button', { name: 'Fermer' }))
    expect(choix).not.toContainElement(screen.getByRole('heading', { level: 2 }))
    expect(regle(feuille, '.choix')).toMatch(/overflow-y:\s*auto/)
    expect(regle(feuille, '.choix')).toMatch(/min-height:\s*0/)
    expect(regle(feuille, '.cadre')).not.toMatch(/overflow/)
    expect(regle(feuille, '.tete')).not.toMatch(/position/)
  })
})

describe('les feuillets d’une fiche d’année 1900 gardent leur contenu', () => {
  const VOYAGE = voyage1890(1903, [{ annee: 1903, statut: 'en_cours', visitee: true, recompense: null }], { ia: true, source: null, rattrape_la_source: false })
  const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
  const ROBBERY = filmDeSalle({ id: 'f-rob', tmdb_id: 5698, rang: 1, title: 'The Great Train Robbery', year: 1903, etat: 'vu', note: 9, cover_url: null })
  const FEES = filmDeSalle({ id: 'f-fees', tmdb_id: 776, rang: 2, title: 'Le Royaume des fées', year: 1903, etat: 'sur_le_plex', cover_url: null })
  const LUNE = filmDeSalle({ id: 'f-lune', tmdb_id: 775, rang: 3, title: 'Le Voyage dans la Lune', year: 1902, etat: 'sur_le_plex', cover_url: null })
  const FICHE: FichePrete = fichePrete({
    annee: 1903,
    ticket: null,
    maturite: null,
    generique: null,
    pistes: [],
    demande_salle: null,
    salles: [salle({ id: 's-ess', rang: 1, nom: 'Les essentiels', films: [ROBBERY, FEES, LUNE] })],
    podium: [null, { place: 2, tmdb_id: 4242, programme_id: null, title: 'Un film du journal', cover_url: null, backdrop_url: null }, null],
    seances: [seance({ id: 'se-7', rang: 7, long: morceau(FEES), court: null })],
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
    localStorage.clear()
  })

  /** Le feuillet ouvert : dans le cadre de 1900, avec « Fermer ». */
  const ouvert = async (nom: string) => {
    const dialogue = await screen.findByRole('dialog', { name: nom })
    expect(dialogue.firstElementChild).toHaveAttribute('data-vivante')
    expect(within(dialogue).getByRole('button', { name: 'Fermer' })).toBeInTheDocument()
    return dialogue
  }

  // Mutation, pour les trois : le cadre de 1900 qui ne rend plus ses enfants.
  it('« Quelle salle ? » garde son champ', async () => {
    monterVoyage('/voyage/1903', ROUTES)
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir une voie' }))
    expect(within(await ouvert('Quelle salle ?')).getByRole('textbox')).toBeInTheDocument()
  })

  it('le feuillet d’une classe occupée garde « Retirer »', async () => {
    monterVoyage('/voyage/1903', ROUTES)
    fireEvent.click(await screen.findByRole('button', { name: '2ᵉ classe : Un film du journal, changer de voyageur' }))
    expect(within(await ouvert('2ᵉ classe')).getByRole('button', { name: 'Retirer' })).toBeInTheDocument()
  })

  it('« Un autre long » garde ses remplaçants', async () => {
    monterVoyage('/voyage/1903', ROUTES)
    fireEvent.click(await screen.findByRole('button', { name: 'Autre long' }))
    expect(within(await ouvert('Un autre long')).getByRole('button', { name: /Le Voyage dans la Lune/ })).toBeInTheDocument()
  })
})
