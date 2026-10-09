import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import type { Bobine } from '../../api/voyage'
import { PAGES_1890 } from '../../mondes/1890/pages'
import { monterVoyage } from '../../test/pageVoyage'
import { json } from '../../test/serveur'
import { fichePrete, filmDeSalle, salle } from '../../test/voyage'
import type { PropsProgrammeDuFilm } from './Programme'

/**
 * La clé `programmeDuFilm` (les derniers écrans de 1900, brief 1) : la page lit le programme d'un film
 * au monde, et lui passe ce que le défaut recevait. Le défaut lui-même est tenu, sans retouche, par
 * `pages/VoyageFilm.test.tsx` ; le dessin de 1900 par `mondes/1900/pages/programme.test.tsx`.
 */
const bobine = (tmdb_id: number, title: string, etat: Bobine['etat']): Bobine => ({ tmdb_id, title, duree_min: 1, cover_url: null, plex_url: null, etat })
const PROGRAMME = filmDeSalle({
  id: 'p-lumiere',
  tmdb_id: 511,
  title: 'Programme Lumière',
  etat: 'sur_le_plex',
  plex_url: null,
  programme: { duree_min: 2, bobines: [bobine(511, 'La Sortie de l’usine', 'vu'), bobine(512, 'Le Repas de bébé', 'sur_le_plex')] },
})
const SEUL = filmDeSalle({ id: 'f-seul', tmdb_id: 15, title: 'Un film seul', etat: 'a_demander', plex_url: null })
const FICHE = fichePrete({ annee: 1897, salles: [salle({ id: 's-ess', nom: 'Les essentiels', films: [PROGRAMME, SEUL] })], podium: [null, null, null], ticket: null, maturite: null, seances: [], demande_salle: null })
const ANNEE = 'GET /api/me/voyage/annees/1897'
const ROUTES = {
  [ANNEE]: () => json(FICHE),
  'GET /api/reference/films/511/realisateurs': () => json({ realisateurs: [] }),
  'GET /api/reference/films/15/realisateurs': () => json({ realisateurs: [] }),
}

/** Un programme de monde, qui dit ce qu'il a reçu. */
const ProgrammeDuMonde = (p: PropsProgrammeDuFilm) => (
  <section aria-label="Le programme du monde">{`${p.monde.nom}, ${p.annee}, ligne ${p.film.id}, ${p.programme.duree_min} min, ${p.programme.bobines.map((b) => `${b.tmdb_id} ${b.etat}`).join(' et ')}`}</section>
)

describe('le programme d’un film, section qu’un monde peut composer', () => {
  let remettre = () => undefined as void
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
    const avant = PAGES_1890.gabarits
    PAGES_1890.gabarits = { programmeDuFilm: ProgrammeDuMonde }
    remettre = () => void (PAGES_1890.gabarits = avant)
  })
  afterEach(() => {
    remettre()
    vi.unstubAllGlobals()
  })

  // Mutations : la page qui monte `Programme` sans passer par `gabaritDe` ; l'année, la ligne du film
  // ou le programme que la page ne passerait plus (la ligne du film remplacée par son `tmdb_id`).
  it('la page monte le programme du monde à la place du défaut, avec ce que le défaut recevait', async () => {
    const { requetes } = monterVoyage('/voyage/1897/films/p-lumiere', ROUTES)
    const programme = await screen.findByRole('region', { name: 'Le programme du monde' })
    expect(programme).toHaveTextContent(/, 1897, ligne p-lumiere, 2 min, 511 vu et 512 sur_le_plex$/)
    expect(screen.queryByRole('region', { name: 'Programme' })).toBeNull()
    expect(within(programme).queryByRole('link')).toBeNull()
    // Aucune lecture de plus : la fiche et les réalisateurs.
    await waitFor(() => expect(requetes).toContain('GET /api/reference/films/511/realisateurs'))
    expect(requetes.filter((r) => !r.includes('/auth/')).sort()).toEqual([ANNEE, 'GET /api/reference/films/511/realisateurs'].sort())
  })

  // Mutation : le programme du monde monté sur tout film (`film.programme` non regardé).
  it('un film sans programme ne monte pas le programme du monde', async () => {
    monterVoyage('/voyage/1897/films/f-seul', ROUTES)
    expect(await screen.findByRole('heading', { level: 1, name: 'Un film seul' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Le programme du monde' })).toBeNull()
  })
})
