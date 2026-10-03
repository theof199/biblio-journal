import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import PageRealisateur from './PageRealisateur'
import { createQueryClient } from '../api/queryClient'
import { cles } from '../api/cles'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import { monterVoyage } from '../test/pageVoyage'
import { fichePrete, filmDeSalle, salle, voyage1890 } from '../test/voyage'
import { oublierLeRetour } from '../voyage/annee/retour'
import type { JournalItem } from '../api/journal'
import type { RealisateurPage } from '../api/realisateurs'
import type { ReactionsCatalogue } from '../api/reactions'

const PAGE_SUIVI = exemple<RealisateurPage>('/me/realisateurs/{tmdbId}/page', 'get', 200)
const PAGE_NON_SUIVI: RealisateurPage = { ...PAGE_SUIVI, suivi: false }
const PERDU = { ...PAGE_SUIVI.films[0]!, tmdb_id: 999, title: 'Film perdu', year: 2001, vu: null, introuvable: true }
const PAGE_AVEC_PERDU: RealisateurPage = { ...PAGE_SUIVI, films: [PAGE_SUIVI.films[0]!, PERDU] }
const COURT = { ...PAGE_SUIVI.films[0]!, tmdb_id: 111, title: 'Un court', year: 2005, court: true, vu: null, voyage: null }
const PAGE_AVEC_COURT: RealisateurPage = { ...PAGE_SUIVI, films: [PAGE_SUIVI.films[0]!, COURT] }
const PAGE_SANS_FILMS: RealisateurPage = { ...PAGE_SUIVI, films: [] }
/** Inception, que l'exemple du contrat place dans une salle de 2010 (`voyage`). */
const INCEPTION = PAGE_SUIVI.films[0]!
/** Le même film, dans aucune salle du Voyage. */
const PAGE_HORS_VOYAGE: RealisateurPage = { ...PAGE_SUIVI, films: [{ ...INCEPTION, voyage: null }, ...PAGE_SUIVI.films.slice(1)] }

/** La fiche d'un film des Suivis, réduite à l'état de navigation qu'elle reçoit. */
function SondeFicheFilm() {
  return <pre data-testid="etat-fiche-film">{JSON.stringify(useLocation().state)}</pre>
}

function monter(tmdbId = 525, client = createQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/suivis/realisateurs/${tmdbId}`]}>
        <Routes>
          <Route path="/suivis/realisateurs/:tmdbId" element={<PageRealisateur />} />
          <Route path="/suivis/films/:tmdbId" element={<SondeFicheFilm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('la page d’un réalisateur', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Le mode de compte est gardé sur l'appareil : aucun test ne doit hériter du choix d'un autre.
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('affiche la fiche et la filmographie, la série écartée', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_SUIVI) })
    monter()

    expect(await screen.findByRole('heading', { name: 'Christopher Nolan' })).toBeInTheDocument()
    expect(screen.getByText('1 vus sur 1')).toBeInTheDocument()
    expect(screen.getByText('Inception (2010)')).toBeInTheDocument()
    // Mutation : sans `filmsSansSeries`, la série de l'exemple (« Voyage à travers le cinéma
    // américain ») apparaîtrait aussi dans la liste et fausserait le compte ci-dessus (2 sur 2).
    expect(screen.queryByText(/Voyage à travers le cinéma américain/)).not.toBeInTheDocument()
  })

  it('« Masquer les introuvables » est actif par défaut, le coupe les fait revenir, le compte garde tout', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_AVEC_PERDU) })
    monter()

    const interrupteur = await screen.findByRole('switch', { name: 'Masquer les introuvables' })
    expect(interrupteur).toBeChecked()
    // Mutation : un filtre qui ignorerait l'interrupteur laisserait « Film perdu » affiché d'emblée.
    expect(screen.queryByText('Film perdu (2001)')).not.toBeInTheDocument()
    // L'en-tête compte tous les films, introuvables compris : masquer n'efface rien.
    expect(screen.getByText('1 vus sur 2')).toBeInTheDocument()

    fireEvent.click(interrupteur)

    expect(screen.getByText('Film perdu (2001)')).toBeInTheDocument()
    expect(screen.getByText('Introuvable')).toBeInTheDocument()
    expect(screen.getByText('1 vus sur 2')).toBeInTheDocument()
  })

  it('l’interrupteur d’un réalisateur ne survit pas à la page : il redevient actif', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_AVEC_PERDU) })
    const premiere = monter()
    fireEvent.click(await screen.findByRole('switch', { name: 'Masquer les introuvables' }))
    premiere.unmount()

    monter()

    // Mutation : un réglage tenu hors de la page (comme celui des sagas) resterait coupé ici.
    expect(await screen.findByRole('switch', { name: 'Masquer les introuvables' })).toBeChecked()
  })

  it('le sceau « Rétrospective complète » quand tout est vu ou introuvable, pas avant', async () => {
    const A_VOIR = { ...PAGE_SUIVI.films[0]!, tmdb_id: 998, title: 'Film à voir', year: 2002, vu: null, introuvable: false }
    servir({
      // Inception vu, et un introuvable jamais vu.
      'GET /api/me/realisateurs/525/page': () => json(PAGE_AVEC_PERDU),
      'GET /api/me/realisateurs/526/page': () => json({ ...PAGE_AVEC_PERDU, tmdb_id: 526, films: [...PAGE_AVEC_PERDU.films, A_VOIR] }),
    })
    const { unmount } = monter()

    // Mutation : exiger un visionnage de chaque film, l'introuvable compris, retirerait ce sceau.
    expect(await screen.findByRole('img', { name: 'Rétrospective complète' })).toBeInTheDocument()
    unmount()

    monter(526)
    await screen.findByText('Film à voir (2002)')
    // Mutation : un sceau posé sans condition resterait ici.
    expect(screen.queryByRole('img', { name: 'Rétrospective complète' })).not.toBeInTheDocument()
  })

  it('sans aucun film, le dit plutôt que de montrer une liste vide', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_SANS_FILMS) })
    monter()

    expect(await screen.findByText('Aucun film connu pour ce réalisateur.')).toBeInTheDocument()
  })

  // Mutations : le lien toujours vers le Voyage (`film.voyage!` lève sur un film hors du Voyage) ;
  // l'état de navigation oublié (la fiche des Suivis relirait le film et son réalisateur).
  it('un film hors du Voyage ouvre la fiche du film, avec le film et le réalisateur déjà connu en état de navigation', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_HORS_VOYAGE) })
    monter()

    const lien = await screen.findByRole('link', { name: (n) => n.includes('Inception') })
    expect(lien).toHaveAttribute('href', '/suivis/films/27205')
    fireEvent.click(lien)
    const etat = JSON.parse((await screen.findByTestId('etat-fiche-film')).textContent ?? 'null') as {
      film: { tmdb_id: number }
      realisateur: { tmdb_id: number; name: string }
    }
    expect(etat.film.tmdb_id).toBe(27205)
    expect(etat.realisateur).toEqual({ tmdb_id: 525, name: 'Christopher Nolan' })
  })

  // Décision D5 du plan 2b (`DestinationFilm.Voyage`, Android). Mutations : le lien toujours vers les
  // Suivis ; l'année de sortie (`year`) au lieu de celle du Voyage ; le `tmdb_id` au lieu de la ligne de salle.
  it('un film d’une salle du Voyage ouvre sa fiche du Voyage, à l’année et à la ligne de salle de `voyage`', async () => {
    // Sorti fin 1895 chez TMDB, projeté dans une salle de 1896 : l'année du Voyage n'est pas celle de sortie.
    const TRAIN = {
      ...INCEPTION,
      tmdb_id: 12345,
      title: 'L’Arrivée d’un train',
      year: 1895,
      release_date: '1895-12-28',
      voyage: { annee: 1896, salle_id: 'salle-1896', film_id: 'film-1896' },
    }
    servir({ 'GET /api/me/realisateurs/525/page': () => json({ ...PAGE_SUIVI, films: [...PAGE_SUIVI.films, TRAIN] }) })
    monter()

    const lien = await screen.findByRole('link', { name: (n) => n.includes('Inception') })
    expect(lien).toHaveAttribute('href', '/voyage/2010/films/22222222-0000-4000-8000-000000000002')
    expect(screen.getByRole('link', { name: (n) => n.includes('L’Arrivée d’un train') })).toHaveAttribute('href', '/voyage/1896/films/film-1896')
  })

  // Décision du propriétaire du 1er octobre 2026 (2b-5) : la ligne d'un film qui mène au Voyage
  // l'annonce, à l'année de `voyage` (1896, pas l'année de sortie, 1895) ; celle d'un film des Suivis
  // n'en dit rien. Mutations : le signe retiré ; posé sur toutes les lignes ; l'année de sortie.
  it('le signe « Voyage <année> » annonce le changement d’onglet, sur les seuls films du Voyage', async () => {
    const TRAIN = { ...INCEPTION, tmdb_id: 12345, title: 'L’Arrivée d’un train', year: 1895, release_date: '1895-12-28', voyage: { annee: 1896, salle_id: 'salle-1896', film_id: 'film-1896' } }
    const HORS = { ...INCEPTION, tmdb_id: 54321, title: 'Un film des Suivis', voyage: null }
    servir({ 'GET /api/me/realisateurs/525/page': () => json({ ...PAGE_SUIVI, films: [TRAIN, HORS] }) })
    monter()

    const train = await screen.findByRole('link', { name: (n) => n.includes('L’Arrivée d’un train') })
    expect(within(train).getByText('· Voyage 1896')).toBeInTheDocument()
    expect(within(screen.getByRole('link', { name: (n) => n.includes('Un film des Suivis') })).queryByText(/Voyage/)).toBeNull()
  })

  it('range les longs métrages et les courts sous leur titre, les courts hors de la liste des longs', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_AVEC_COURT) })
    monter()

    const longs = (await screen.findByRole('heading', { level: 2, name: 'Longs métrages' })).closest('section')!
    const courts = screen.getByRole('heading', { level: 2, name: 'Courts métrages' }).closest('section')!
    expect(within(longs).getByText('Inception (2010)')).toBeInTheDocument()
    // Mutation : sans séparation, le court resterait dans la liste des longs.
    expect(within(longs).queryByText('Un court (2005)')).not.toBeInTheDocument()
    expect(within(courts).getByText('Un court (2005)')).toBeInTheDocument()
    expect(within(courts).queryByText('Inception (2010)')).not.toBeInTheDocument()
  })

  it('sans court, ne montre pas le titre « Courts métrages »', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_SUIVI) })
    monter()

    await screen.findByRole('heading', { level: 2, name: 'Longs métrages' })
    // Mutation : un titre posé sans condition resterait au-dessus d'une liste vide.
    expect(screen.queryByRole('heading', { name: 'Courts métrages' })).not.toBeInTheDocument()
  })

  it('par défaut compte longs et courts séparément', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_AVEC_COURT) })
    monter()

    expect(await screen.findByText('1 vus sur 1 · courts 0 sur 1')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'séparément' })).toBeChecked()
  })

  it('choisir « ensemble » additionne longs et courts', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_AVEC_COURT) })
    monter()

    fireEvent.click(await screen.findByRole('radio', { name: 'ensemble' }))

    // Mutation : un choix qui ne change pas le compte laisserait « courts 0 sur 1 ».
    expect(screen.getByText('1 vus sur 2')).toBeInTheDocument()
  })

  it('choisir « longs seulement » ne compte que les longs', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_AVEC_COURT) })
    monter()

    fireEvent.click(await screen.findByRole('radio', { name: 'longs seulement' }))

    expect(screen.getByText('1 vus sur 1')).toBeInTheDocument()
    expect(screen.queryByText(/courts 0 sur 1/)).not.toBeInTheDocument()
  })

  it('le choix du compte est retenu au retour sur la page', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_AVEC_COURT) })
    const premiere = monter()
    fireEvent.click(await screen.findByRole('radio', { name: 'ensemble' }))
    premiere.unmount()

    monter()

    // Mutation : un choix qui ne s'écrit pas, ou une lecture qui ignore la mémoire, rendrait « séparément ».
    expect(await screen.findByRole('radio', { name: 'ensemble' })).toBeChecked()
    expect(screen.getByText('1 vus sur 2')).toBeInTheDocument()
  })

  it('le sceau suit le compte : complet sur les longs, il n’apparaît qu’en « longs seulement »', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': () => json(PAGE_AVEC_COURT) })
    monter()

    await screen.findByRole('heading', { name: 'Christopher Nolan' })
    // Mutation : un sceau toujours calculé sur tous les films ne s'allumerait jamais ici.
    expect(screen.queryByRole('img', { name: 'Rétrospective complète' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'longs seulement' }))
    expect(screen.getByRole('img', { name: 'Rétrospective complète' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'ensemble' }))
    expect(screen.queryByRole('img', { name: 'Rétrospective complète' })).not.toBeInTheDocument()
  })

  it('« Sur le Plex » marque les films du Plex, vus ou à voir, et eux seuls', async () => {
    const SUR_PLEX_A_VOIR = { ...COURT, tmdb_id: 112, title: 'Plex à voir', sur_le_plex: true, court: false }
    servir({
      'GET /api/me/realisateurs/525/page': () =>
        json({ ...PAGE_SUIVI, films: [{ ...INCEPTION, sur_le_plex: true }, SUR_PLEX_A_VOIR, { ...COURT, title: 'Hors Plex' }] }),
    })
    monter()

    const ligneDe = async (titre: string) => within(await screen.findByRole('link', { name: (n) => n.includes(titre) }))
    // Mutation : le marqueur réservé aux films à voir ferait manquer Inception, déjà vu.
    expect((await ligneDe('Inception')).getByText(/^Vu · 9\/10 · Sur le Plex$/)).toBeInTheDocument()
    expect((await ligneDe('Plex à voir')).getByText('À voir · Sur le Plex')).toBeInTheDocument()
    // Mutation : un marqueur posé sur toutes les lignes.
    expect((await ligneDe('Hors Plex')).queryByText(/Sur le Plex/)).not.toBeInTheDocument()
  })

  it('le lien « Ouvrir dans Plex » n’existe qu’avec un `plex_url`, s’ouvre dans un autre onglet, hors du lien de la ligne', async () => {
    const URL_PLEX = 'https://app.plex.tv/desktop/#!/server/abc/details?key=/library/metadata/42'
    servir({
      'GET /api/me/realisateurs/525/page': () =>
        json({ ...PAGE_SUIVI, films: [{ ...INCEPTION, plex_url: URL_PLEX }, { ...COURT, court: false, title: 'Sans Plex' }] }),
    })
    monter()

    const lien = await screen.findByRole('link', { name: 'Ouvrir Inception dans Plex' })
    // Mutation : l'adresse d'un autre champ, ou un lien sans `target`/`rel` ouvrirait Plex dans la page du journal.
    expect(lien).toHaveAttribute('href', URL_PLEX)
    expect(lien).toHaveAttribute('target', '_blank')
    expect(lien).toHaveAttribute('rel', 'noopener noreferrer')
    // Mutation : le lien posé dans celui de la ligne (un lien emboîté dans un lien).
    expect(lien.closest('a:not([target])')).toBeNull()
    expect(lien.parentElement?.tagName).toBe('LI')
    // Mutation : un lien rendu sans condition apparaîtrait aussi sur le film sans `plex_url`.
    expect(screen.queryByLabelText('Ouvrir Sans Plex dans Plex')).not.toBeInTheDocument()
  })

  it('ne plus suivre invalide le cache : la page relue montre « Suivre »', async () => {
    let appels = 0
    const requetes = servir({
      'GET /api/me/realisateurs/525/page': () => {
        appels += 1
        return json(appels === 1 ? PAGE_SUIVI : PAGE_NON_SUIVI)
      },
      'DELETE /api/me/realisateurs/525': () => new Response(null, { status: 204 }),
    })
    const client = createQueryClient()
    client.setQueryData(cles.realisateurs, [])
    monter(525, client)

    const bouton = await screen.findByRole('button', { name: 'Suivi' })
    fireEvent.click(bouton)

    // Mutation : sans `invalidateQueries`, la page ne serait jamais relue et le bouton resterait
    // sur « Suivi » malgré le `DELETE` réussi.
    expect(await screen.findByRole('button', { name: 'Suivre' })).toBeInTheDocument()
    expect(requetes.filter((r) => r.includes('/me/realisateurs/525/page'))).toHaveLength(2)
    // Mutation : n'invalider que `cles.pageRealisateur(525)` laisserait l'onglet Suivis le lister.
    expect(client.getQueryState(cles.realisateurs)?.isInvalidated).toBe(true)
  })

  it('suivre depuis une page pas encore suivie invalide le cache : la page relue montre « Suivi »', async () => {
    let appels = 0
    servir({
      'GET /api/me/realisateurs/525/page': () => {
        appels += 1
        return json(appels === 1 ? PAGE_NON_SUIVI : PAGE_SUIVI)
      },
      'POST /api/me/realisateurs': () => json(PAGE_SUIVI, 201),
    })
    monter()

    const bouton = await screen.findByRole('button', { name: 'Suivre' })
    fireEvent.click(bouton)

    expect(await screen.findByRole('button', { name: 'Suivi' })).toBeInTheDocument()
  })

  it('affiche l’erreur de l’API telle quelle sur un échec de suivi', async () => {
    const message = 'Ce réalisateur est introuvable chez TMDB.'
    servir({
      'GET /api/me/realisateurs/525/page': () => json(PAGE_SUIVI),
      'DELETE /api/me/realisateurs/525': () => json({ code: 'NOT_FOUND', message, retryable: false }, 404),
    })
    monter()

    const bouton = await screen.findByRole('button', { name: 'Suivi' })
    fireEvent.click(bouton)

    expect(await screen.findByText(message)).toBeInTheDocument()
  })
})

describe('depuis la page d’un réalisateur, le Voyage', () => {
  /** La ligne de salle de l'exemple du contrat : Inception, à voir, dans les essentiels de 2010. */
  const FILM_2010 = filmDeSalle({
    id: INCEPTION.voyage!.film_id,
    tmdb_id: 27205,
    title: 'Inception',
    original_title: 'Inception',
    year: 2010,
    realisateur: 'Christopher Nolan',
    raison: null,
    etat: 'a_demander',
    note: null,
    plex_url: null,
  })
  const FICHE_2010 = fichePrete({
    annee: 2010,
    salles: [salle({ id: INCEPTION.voyage!.salle_id, nom: 'Les essentiels', films: [FILM_2010] })],
    podium: [null, null, null],
    ticket: null,
    maturite: null,
    generique: null,
    seances: [],
    seance_en_cours: false,
    pistes: [],
    demande_salle: null,
  })
  // Hors IA : aucun guet du verdict ne se mêle au retour.
  const VOYAGE_2010 = voyage1890(2010, [{ annee: 2010, statut: 'en_cours', visitee: true, recompense: null }], {
    ia: false,
    source: { id: '22222222-2222-4222-8222-222222222222', pseudo: 'theo', annee_en_cours: 2010 },
    rattrape_la_source: false,
  })
  const PAGE_A_VOIR: RealisateurPage = { ...PAGE_SUIVI, films: [{ ...INCEPTION, vu: null }] }
  const ROUTES = {
    'GET /api/me/realisateurs/525/page': () => json(PAGE_A_VOIR),
    'GET /api/me/voyage': () => json(VOYAGE_2010),
    'GET /api/me/voyage/annees/2010': () => json(FICHE_2010),
    'GET /api/reference/films/27205/realisateurs': () => json({ realisateurs: [{ tmdb_id: 525, name: 'Christopher Nolan' }] }),
    'GET /api/reference/reactions': () => json(exemple<ReactionsCatalogue>('/reference/reactions', 'get', 200)),
    'POST /api/media': () => json(exemple('/media', 'post', 201), 201),
    'POST /api/me/journal': () => json({ ...exemple<JournalItem>('/me/journal', 'post', 201), media: { ...exemple<JournalItem>('/me/journal', 'post', 201).media, year: 2010 } }, 201),
  }
  const ouvrirInception = async () => fireEvent.click(await screen.findByRole('link', { name: (n) => n.includes('Inception') }))

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    oublierLeRetour(2010)
  })
  afterEach(() => vi.unstubAllGlobals())

  // Points de vigilance 10 et D5. Mutations : le lien vers les Suivis (l'onglet Suivis resterait
  // marqué) ; un lien qui remplace la page du réalisateur (« Retour » mènerait à l'année 2010).
  it('ouvre la fiche du film sous l’onglet Voyage, de sa seule année, et « Retour » ramène au réalisateur', async () => {
    const { requetes } = monterVoyage('/suivis/realisateurs/525', ROUTES)
    await ouvrirInception()

    expect(await screen.findByRole('heading', { level: 1, name: 'Inception' })).toBeInTheDocument()
    expect(screen.getByText('Salle · Les essentiels')).toBeInTheDocument()
    const onglets = screen.getByRole('navigation', { name: 'Onglets' })
    expect(within(onglets).getByRole('link', { name: 'Voyage' })).toHaveAttribute('aria-current', 'page')
    expect(requetes.filter((r) => r.includes('/me/voyage/annees/'))).toEqual(['GET /api/me/voyage/annees/2010'])

    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Christopher Nolan' })).toBeInTheDocument()
  })

  // Le ledger de la tâche 11 : composter remplace le billet par l'année, jamais par le réalisateur ;
  // l'historique devient [réalisateur, film, année]. Mutations : le lien du réalisateur qui remplace
  // (le réalisateur perdu derrière le film) ; le billet qui recule au lieu de revenir à l'année.
  // Le réalisateur retrouvé se relit : mutation, `cles.realisateurs` retiré des péremptions du billet
  // (la page gardée en cache 30 s dirait encore « À voir »).
  it('« Je l’ai vu » puis composter revient à l’année, avec le film puis le réalisateur derrière elle', async () => {
    // Au calme, l'année revient aussitôt : la lecture de l'année plus bas ne court pas contre le tampon
    // du billet (décision D4), qui a ses propres tests (`VoyageBillet.test.tsx`).
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
    let creations = 0
    monterVoyage('/suivis/realisateurs/525', {
      ...ROUTES,
      // Avant le compostage, Inception est à voir ; après, l'API le rend vu (l'exemple du contrat, 9/10).
      'GET /api/me/realisateurs/525/page': () => json(creations === 0 ? PAGE_A_VOIR : PAGE_SUIVI),
      'POST /api/me/journal': () => ((creations += 1), ROUTES['POST /api/me/journal']()),
    })
    await ouvrirInception()
    fireEvent.click(await screen.findByRole('link', { name: /Je l’ai vu/ }))
    fireEvent.click(await screen.findByRole('button', { name: '7 sur 10' }))
    // 2010 est habillée par le monde « à venir » : son bouton de billet dit « Je l’ai vu » (`mots.billet.valider`).
    fireEvent.click(screen.getByRole('button', { name: /Je l’ai vu/ }))

    expect(await screen.findByRole('region', { name: 'L’année 2010' })).toBeInTheDocument()
    expect(creations).toBe(1)
    fireEvent.click(screen.getByRole('link', { name: 'Retour à la carte' }))
    expect(await screen.findByText('Salle · Les essentiels')).toBeInTheDocument()
    // La fiche du film, pas le billet rouvert.
    expect(screen.queryByRole('button', { name: '7 sur 10' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Christopher Nolan' })).toBeInTheDocument()
    expect(await screen.findByText('Vu · 9/10')).toBeInTheDocument()
    expect(screen.queryByText('À voir')).toBeNull()
  })
})

describe('la page d’un réalisateur qui attend sa fiche', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  const jamais = () => new Promise<Response>(() => {})

  it('annonce « Chargement… » une seule fois', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': jamais })
    monter()

    expect(await screen.findAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Chargement…')
  })

  it('garde le bouton retour, sans le bouton « Suivre » ni l’interrupteur qui agiraient sur rien', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': jamais })
    monter()

    expect(await screen.findByRole('button', { name: 'Retour' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Suivi?e?$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('dessine six films en blanc', async () => {
    servir({ 'GET /api/me/realisateurs/525/page': jamais })
    monter()

    expect(await screen.findAllByTestId('ligne-en-attente')).toHaveLength(6)
  })

  it('ne lance que sa requête, une fois', async () => {
    const requetes = servir({ 'GET /api/me/realisateurs/525/page': jamais })
    monter()

    await screen.findByRole('status')
    await new Promise((r) => setTimeout(r, 20))
    expect(requetes).toEqual(['GET /api/me/realisateurs/525/page'])
  })

  it('à l’arrivée de la fiche, le statut et les formes en blanc s’en vont', async () => {
    let liberer!: () => void
    servir({ 'GET /api/me/realisateurs/525/page': () => new Promise<Response>((r) => (liberer = () => r(json(PAGE_SUIVI)))) })
    monter()
    await screen.findByRole('status')

    liberer()

    expect(await screen.findByRole('heading', { name: 'Christopher Nolan' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ligne-en-attente')).not.toBeInTheDocument()
  })
})
