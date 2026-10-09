import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import type { Bobine } from '../../../api/voyage'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { fichePrete, filmDeSalle, salle, voyage1890 } from '../../../test/voyage'
import { PAGES_1900 } from '../pages'

/**
 * Le programme d'un film des années 1900 (les derniers écrans de 1900, brief 1) : ses bobines se lisent
 * en compartiments, comme dans la voiture. La page se monte dans l'app entière, le monde n'y arrive que
 * par le registre. Le défaut, et donc 1890, est tenu sans retouche par `pages/VoyageFilm.test.tsx`.
 */
const bobine = (tmdb_id: number, title: string, etat: Bobine['etat'], cover_url: string | null = null): Bobine => ({ tmdb_id, title, duree_min: tmdb_id - 510, cover_url, plex_url: null, etat })
/** Un programme dont la première bobine est vue : son `tmdb_id` (511) est celui de cette bobine, jamais celui d'une bobine à voir. */
const PROGRAMME = filmDeSalle({
  id: 'p-lumiere',
  tmdb_id: 511,
  title: 'Programme Lumière',
  etat: 'sur_le_plex',
  plex_url: null,
  programme: {
    duree_min: 10,
    bobines: [bobine(511, 'La Sortie de l’usine', 'vu', 'https://image.tmdb.org/t/p/w154/usine.jpg'), bobine(512, 'Le Repas de bébé', 'sur_le_plex'), bobine(513, 'L’Arroseur arrosé', 'introuvable'), bobine(514, 'La Mer', 'a_demander')],
  },
})
const FICHE = fichePrete({ annee: 1903, salles: [salle({ id: 's-ess', nom: 'Les essentiels', films: [PROGRAMME] })], podium: [null, null, null], ticket: null, maturite: null, seances: [], demande_salle: null })
const CARTE = 'GET /api/me/voyage'
const ANNEE = 'GET /api/me/voyage/annees/1903'
const REALISATEURS = 'GET /api/reference/films/511/realisateurs'
const EN_1903 = voyage1890(1903, [{ annee: 1903, statut: 'en_cours', visitee: true, recompense: null }], { ia: false, source: null, rattrape_la_source: false })
const ROUTES = { [CARTE]: () => json(EN_1903), [ANNEE]: () => json(FICHE), [REALISATEURS]: () => json({ realisateurs: [] }) }

const monter = () => monterVoyage('/voyage/1903/films/p-lumiere', ROUTES)
const programme = () => screen.findByRole('region', { name: 'Programme' })
const bobines = (region: HTMLElement) => within(within(region).getByRole('list', { name: 'Les bobines de Programme Lumière' })).getAllByRole('listitem')
const BILLET = (tmdb: number) => `/voyage/1903/films/p-lumiere/billet?bobine=${tmdb}`

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  localStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

describe('le programme d’un film des années 1900', () => {
  // Mutations : `programmeDuFilm` retiré de `PAGES_1900` (le défaut reviendrait, avec « Programme ·
  // 10 min » sur une ligne) ; la durée du programme que le dessin ne dirait plus.
  it('se lit en compartiments, un par bobine, sous sa durée, à la place du programme par défaut', async () => {
    monter()
    const region = await programme()
    expect(bobines(region)).toHaveLength(4)
    expect(within(region).getByRole('heading', { level: 2 })).toHaveTextContent(/^Programme\s*10 min$/)
    expect(within(region).queryByText('Programme · 10 min')).toBeNull()
    expect(screen.getAllByRole('region', { name: 'Programme' })).toHaveLength(1)
  })

  // Mutations : la mention de l'état retirée d'un compartiment (seule la plaque, que le lecteur d'écran
  // ne lit pas, le dirait), ou cachée au lecteur d'écran ; la durée d'une bobine tue ; la lettre prise à `i` (la première serait « @ ») ;
  // l'introuvable dit « libre » sur sa plaque, ou par un mot écrit ici et non celui du monde.
  it('chaque bobine dit sa durée, sa place et son état, et sa plaque dit si elle est occupée', async () => {
    monter()
    const lus = bobines(await programme()).map((li) => [li.querySelector('img')?.getAttribute('src') ?? null, ...[...li.querySelectorAll('span, small')].filter((e) => e.children.length === 0).map((e) => e.textContent)].join(' | '))
    const perdu = PAGES_1900.mots.introuvable
    expect(lus).toEqual([
      'https://image.tmdb.org/t/p/w154/usine.jpg | 1 min · compartiment A | vu | occupé',
      ' | sans affiche | 2 min · compartiment B | sur ton Plex | libre',
      ` | sans affiche | 3 min · compartiment C | ${perdu} | ${perdu}`,
      ' | sans affiche | 4 min · compartiment D | à voir | libre',
    ])
    // L'état se lit hors de la plaque, qui n'est qu'une image : sa mention n'est jamais cachée au lecteur d'écran.
    expect(bobines(await programme()).map((li) => li.querySelector('small:last-of-type')!.closest('[aria-hidden]'))).toEqual([null, null, null, null])
  })

  // Mutations : le talon offert à toute bobine (`b.etat !== 'vu'` retiré) ; l'adresse sans `?bobine=` ;
  // `?bobine=` à l'identifiant du film (`film.tmdb_id`, 511 : la bobine déjà vue) ; la ligne du film
  // remplacée par l'identifiant TMDB dans le chemin.
  it('une bobine qui reste à voir tend « Je l’ai vu » vers son billet, à son identifiant ; une bobine vue ne tend rien', async () => {
    monter()
    const region = await programme()
    const liens = within(region).getAllByRole('link')
    expect(liens.map((l) => `${l.getAttribute('aria-label')} | ${l.textContent} | ${l.getAttribute('href')}`)).toEqual([
      `Je l’ai vu : Le Repas de bébé | Je l’ai vu | ${BILLET(512)}`,
      `Je l’ai vu : L’Arroseur arrosé | Je l’ai vu | ${BILLET(513)}`,
      `Je l’ai vu : La Mer | Je l’ai vu | ${BILLET(514)}`,
    ])
    expect(within(bobines(region)[0]!).queryByRole('link')).toBeNull()
  })

  // Mutation : une lecture ajoutée au dessin (un `fetch`, une requête TanStack) : le gabarit ne lit rien.
  it('ne lit rien de plus : la fiche, ses réalisateurs et la carte', async () => {
    const { requetes } = monter()
    await programme()
    await waitFor(() => expect(requetes).toContain(REALISATEURS))
    expect(requetes.filter((r) => !r.includes('/auth/')).sort()).toEqual([CARTE, ANNEE, REALISATEURS].sort())
  })
})
