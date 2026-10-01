import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import Suivis from './Suivis'
import { createQueryClient } from '../api/queryClient'
import { cles } from '../api/cles'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import type { Realisateur, RealisateurPage } from '../api/realisateurs'
import type { FilmsSaga, Saga } from '../api/sagas'
import { basculerMasquerIntrouvables, reinitialiserMasquerIntrouvables } from '../suivis/masquer'

const NOLAN = exemple<Realisateur[]>('/me/realisateurs', 'get', 200)[0]!
const ALIEN = exemple<Saga[]>('/me/sagas', 'get', 200)[0]!
const PAGE_NOLAN = exemple<RealisateurPage>('/me/realisateurs/{tmdbId}/page', 'get', 200)
const FILMS_ALIEN = exemple<FilmsSaga>('/me/sagas/{tmdbId}/films', 'get', 200)
const FILM_REALISATEUR = PAGE_NOLAN.films[0]!
const FILM_SAGA = FILMS_ALIEN.films[0]!

// Le débounce de la recherche (300 ms, `recherche/useValeurDebouncee.ts`) tourne en temps réel
// ici, jamais accéléré : `findBy*` l'attend simplement, avec une marge au-dessus de son délai.
const DELAI_RECHERCHE = { timeout: 2000 }

const ERREUR_TMDB = { code: 'SERVICE_UNCONFIGURED', message: 'TMDB est en panne.', retryable: false }

/** La page qu'ouvre un film de suivi : elle montre l'état de navigation reçu, que la fiche du film lirait. */
function EtatRecu() {
  const { pathname, state } = useLocation()
  return <p data-testid="arrivee">{JSON.stringify({ pathname, state })}</p>
}

function monter(client = createQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Suivis />} />
          <Route path="*" element={<EtatRecu />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const realisateur = (id: number, ajouteLe = `2026-09-0${id}T10:00:00.000Z`): Realisateur => ({
  ...NOLAN,
  tmdb_id: id,
  name: `Prénom Réalisateur${id}`,
  ajoute_le: ajouteLe,
})
const saga = (id: number, ajouteLe = `2026-09-0${id}T10:00:00.000Z`): Saga => ({ ...ALIEN, tmdb_id: id, name: `Saga ${id}`, ajoute_le: ajouteLe })

const filmRealisateur = (id: number, vu: string | null, options: { introuvable?: boolean; voyage?: boolean } = {}) => ({
  ...FILM_REALISATEUR,
  tmdb_id: id,
  title: `Film ${id}`,
  year: 1990 + (id % 10),
  vu: vu ? { entry_id: `e-${id}`, rating: null, finished_at: vu } : null,
  introuvable: options.introuvable ?? false,
  voyage: options.voyage ? { annee: 1896, salle_id: 'salle-1', film_id: `voyage-${id}` } : null,
})
const filmSaga = (id: number, vu: string | null, options: { introuvable?: boolean } = {}) => ({
  ...FILM_SAGA,
  tmdb_id: id,
  title: `Épisode ${id}`,
  year: 2000 + (id % 10),
  vu: vu ? { entry_id: `e-${id}`, rating: null, finished_at: vu } : null,
  introuvable: options.introuvable ?? false,
})

const pageRealisateur = (id: number, films: ReturnType<typeof filmRealisateur>[]): RealisateurPage => ({ ...PAGE_NOLAN, tmdb_id: id, films })
const filmsSaga = (films: ReturnType<typeof filmSaga>[]): FilmsSaga => ({ films })

/** L'affichette ou la planche de ce nom : l'élément de liste que son lien étend sur toute sa surface. */
const objet = async (nom: string) => (await screen.findByRole('link', { name: nom })).closest('li')!

const ouvrirCycles = () => fireEvent.click(screen.getByRole('tab', { name: /^Cycles/ }))

describe('la page Suivis', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => {
    vi.unstubAllGlobals()
    reinitialiserMasquerIntrouvables()
  })

  describe('l’en-tête', () => {
    it('compte les rétrospectives et les cycles une fois les deux listes arrivées', async () => {
      let repondreSagas: (r: Response) => void = () => undefined
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1), realisateur(2)]),
        'GET /api/me/sagas': () => new Promise<Response>((resolve) => (repondreSagas = resolve)),
        'GET /api/me/realisateurs/1/page': () => json(pageRealisateur(1, [])),
        'GET /api/me/realisateurs/2/page': () => json(pageRealisateur(2, [])),
      })
      monter()

      await screen.findByRole('link', { name: 'Prénom Réalisateur2' })
      // Mutation : sans l'attente des deux listes, « 2 rétrospectives · 0 cycle » s'afficherait déjà, faux.
      expect(screen.queryByText(/rétrospectives? ·/)).not.toBeInTheDocument()

      repondreSagas(json([ALIEN]))
      expect(await screen.findByText('2 rétrospectives · 1 cycle')).toBeInTheDocument()
    })
  })

  describe('les intercalaires', () => {
    beforeEach(() => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1), realisateur(2)]),
        'GET /api/me/sagas': () => json([saga(10)]),
        'GET /api/me/realisateurs/1/page': () => json(pageRealisateur(1, [filmRealisateur(11, null)])),
        'GET /api/me/realisateurs/2/page': () => json(pageRealisateur(2, [filmRealisateur(21, null)])),
        'GET /api/me/sagas/10/films': () => json(filmsSaga([filmSaga(101, null)])),
      })
    })

    it('s’ouvrent sur les rétrospectives, chacun portant son compte', async () => {
      monter()

      const rétrospectives = await screen.findByRole('tab', { name: 'Rétrospectives 2' })
      expect(rétrospectives).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('tab', { name: 'Cycles 1' })).toHaveAttribute('aria-selected', 'false')
      expect(screen.getByRole('tablist')).toContainElement(rétrospectives)
    })

    it('le panneau porte le nom de l’intercalaire ouvert', async () => {
      monter()

      expect(await screen.findByRole('tabpanel', { name: 'Rétrospectives 2' })).toBeInTheDocument()
      ouvrirCycles()
      expect(screen.getByRole('tabpanel', { name: 'Cycles 1' })).toBeInTheDocument()
    })

    it('n’affichent que la liste ouverte : toucher « Cycles » remplace les affichettes par les planches', async () => {
      monter()
      await screen.findByRole('link', { name: 'Prénom Réalisateur1' })
      expect(screen.queryByRole('link', { name: 'Saga 10' })).not.toBeInTheDocument()

      ouvrirCycles()

      // Mutation : un panneau qui montrerait les deux listes laisserait les rétrospectives ici.
      expect(await screen.findByRole('link', { name: 'Saga 10' })).toHaveAttribute('href', '/suivis/sagas/10')
      expect(screen.queryByRole('link', { name: 'Prénom Réalisateur1' })).not.toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Cycles 1' })).toHaveAttribute('aria-selected', 'true')
    })

    it('le compte d’un intercalaire manque tant que sa liste n’est pas arrivée', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1)]),
        'GET /api/me/sagas': () => new Promise<Response>(() => undefined),
        'GET /api/me/realisateurs/1/page': () => json(pageRealisateur(1, [])),
      })
      monter()

      expect(await screen.findByRole('tab', { name: 'Rétrospectives 1' })).toBeInTheDocument()
      // Mutation : un « 0 » par défaut s'afficherait ici, avant que les sagas aient répondu.
      expect(screen.getByRole('tab', { name: 'Cycles' })).toBeInTheDocument()
    })
  })

  describe('les états d’un panneau', () => {
    it('sans aucun suivi, chaque panneau le dit', async () => {
      servir({ 'GET /api/me/realisateurs': () => json([]), 'GET /api/me/sagas': () => json([]) })
      monter()

      expect(await screen.findByText('Tu ne suis aucun réalisateur.')).toBeInTheDocument()
      ouvrirCycles()
      expect(screen.getByText('Tu ne suis aucune saga.')).toBeInTheDocument()
    })

    it('dit « Chargement… » tant que la liste n’est pas arrivée', async () => {
      servir({ 'GET /api/me/realisateurs': () => new Promise<Response>(() => undefined), 'GET /api/me/sagas': () => json([]) })
      monter()

      expect(await screen.findByRole('status')).toHaveTextContent('Chargement…')
    })

    it('une liste en panne montre la panne, et « Réessayer » la redemande', async () => {
      let appels = 0
      servir({
        'GET /api/me/realisateurs': () => {
          appels += 1
          return appels === 1 ? json(ERREUR_TMDB, 503) : json([])
        },
        'GET /api/me/sagas': () => json([]),
      })
      monter()

      expect(await screen.findByRole('alert')).toHaveTextContent('TMDB est en panne.')
      fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

      // Mutation : un bouton sans `refetch` laisserait la panne à l'écran.
      expect(await screen.findByText('Tu ne suis aucun réalisateur.')).toBeInTheDocument()
    })

    it('la panne d’une liste ne touche pas l’autre intercalaire', async () => {
      servir({ 'GET /api/me/realisateurs': () => json(ERREUR_TMDB, 503), 'GET /api/me/sagas': () => json([]) })
      monter()

      await screen.findByRole('alert')
      ouvrirCycles()
      expect(screen.getByText('Tu ne suis aucune saga.')).toBeInTheDocument()
    })
  })

  describe('l’affichette d’une rétrospective', () => {
    it('est un seul lien vers la page du réalisateur, nommé par son seul nom', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([NOLAN]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/525/page': () => json(pageRealisateur(525, [filmRealisateur(10, '2026-09-20'), filmRealisateur(11, null)])),
      })
      monter()

      const affichette = await objet('Christopher Nolan')
      // Mutation : un lien qui avalerait le compte ou le prochain film changerait son nom.
      expect(within(affichette).getAllByRole('link')).toHaveLength(1)
      expect(within(affichette).getByRole('link')).toHaveAttribute('href', '/suivis/realisateurs/525')
    })

    it('porte « Rétrospective », les prénoms en petit et le dernier mot en grand', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([NOLAN]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/525/page': () => json(pageRealisateur(525, [filmRealisateur(10, null)])),
      })
      monter()

      const affichette = await objet('Christopher Nolan')
      const lien = within(affichette).getByRole('link')
      expect(within(affichette).getByText('Rétrospective')).toBeInTheDocument()
      expect(within(lien).getByText('Christopher')).toBeInTheDocument()
      // Mutation : sans la coupe, tout le nom tiendrait dans un seul morceau.
      expect(within(lien).getByText('Nolan')).toBeInTheDocument()
    })

    it('dit « N séances sur M », au singulier pour 0 et 1', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1), realisateur(2), realisateur(3)]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () => json(pageRealisateur(1, [filmRealisateur(10, '2026-09-20'), filmRealisateur(11, '2026-09-21'), filmRealisateur(12, null)])),
        'GET /api/me/realisateurs/2/page': () => json(pageRealisateur(2, [filmRealisateur(20, '2026-09-20'), filmRealisateur(21, null)])),
        'GET /api/me/realisateurs/3/page': () => json(pageRealisateur(3, [filmRealisateur(30, null)])),
      })
      monter()

      // Mutation : un pluriel dès 1 écrirait « 1 séances » ; un singulier jusqu'à 2, « 2 séance ».
      const compte = async (nom: string) => within(await objet(nom)).findByText(/séances? sur/)
      expect(await compte('Prénom Réalisateur1')).toHaveTextContent('2 séances sur 3')
      expect(await compte('Prénom Réalisateur2')).toHaveTextContent('1 séance sur 2')
      expect(await compte('Prénom Réalisateur3')).toHaveTextContent('0 séance sur 1')
    })

    it('un réalisateur compte tous ses films, ses séries écartées', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([NOLAN]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/525/page': () => json(PAGE_NOLAN),
      })
      monter()

      // Inception (vu) et une série jamais vue : sans la série, tout est vu, l'affichette est aux archives.
      fireEvent.click(await screen.findByRole('button', { name: 'Archives · 1' }))
      // Mutation : une filmographie qui garderait la série dirait « 1 séance sur 2 » et resterait en cours.
      expect(await screen.findByText(/séances? sur/)).toHaveTextContent('1 séance sur 1')
    })

    it('poinçonne un trou par film : vu, le prochain, introuvable, les autres vides', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1)]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () =>
          json(pageRealisateur(1, [filmRealisateur(10, '2026-09-20'), filmRealisateur(11, null, { introuvable: true }), filmRealisateur(12, null), filmRealisateur(13, null)])),
      })
      monter()

      const affichette = await objet('Prénom Réalisateur1')
      const trous = await waitFor(() => {
        const liste = affichette.querySelectorAll('[data-etat]')
        expect(liste).toHaveLength(4)
        return [...liste]
      })
      // Mutation : un seul « prochain », jamais l'introuvable, dans l'ordre du back.
      expect(trous.map((trou) => trou.getAttribute('data-etat'))).toEqual(['vu', 'introuvable', 'prochain', 'pas-encore'])
      // Décor : le compte dit déjà tout.
      expect(trous[0]!.parentElement).toHaveAttribute('aria-hidden', 'true')
    })

    it('« ensuite » annonce le premier film à voir, pas le dernier', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(2)]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/2/page': () => json(pageRealisateur(2, [filmRealisateur(20, '2026-09-20'), filmRealisateur(21, null), filmRealisateur(22, null)])),
      })
      monter()

      const affichette = await objet('Prénom Réalisateur2')
      // Mutation : prendre un autre film que `prochainAVoir` rendrait « Film 22 ».
      expect(await within(affichette).findByText('Film 21')).toBeInTheDocument()
      expect(within(affichette).getByText(/^ensuite/)).toBeInTheDocument()
      expect(within(affichette).queryByText('Film 22')).not.toBeInTheDocument()
    })

    it('colle l’affiche du prochain film au coin du portrait, en décor, sans second lien', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(2)]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/2/page': () => json(pageRealisateur(2, [filmRealisateur(20, '2026-09-20'), filmRealisateur(21, null)])),
      })
      monter()

      const affichette = await objet('Prénom Réalisateur2')
      const vignette = await within(affichette).findByAltText('Film 21')
      expect(vignette.closest('[aria-hidden="true"]')).not.toBeNull()
      expect(within(affichette).getAllByRole('link')).toHaveLength(1)
    })

    it('le portrait est une image sans texte alternatif : le nom dit déjà qui c’est', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([NOLAN]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/525/page': () => json(pageRealisateur(525, [filmRealisateur(10, null)])),
      })
      monter()

      const affichette = await objet('Christopher Nolan')
      const portrait = affichette.querySelector(`img[src="${NOLAN.profile_url}"]`)
      expect(portrait).toHaveAttribute('alt', '')
    })

    it('en attente, ne montre que le nom et « … » ; en panne, « indisponible »', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1), realisateur(2)]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () => json(ERREUR_TMDB, 503),
        'GET /api/me/realisateurs/2/page': () => new Promise<Response>(() => undefined),
      })
      monter()

      const enPanne = await objet('Prénom Réalisateur1')
      expect(await within(enPanne).findByText('indisponible')).toBeInTheDocument()
      const enAttente = await objet('Prénom Réalisateur2')
      expect(within(enAttente).getByText('…')).toBeInTheDocument()
      for (const affichette of [enPanne, enAttente]) {
        // Mutation : un compte ou un « ensuite » dessiné sans filmographie s'afficherait ici.
        expect(within(affichette).queryByText(/séances? sur/)).not.toBeInTheDocument()
        expect(within(affichette).queryByText(/^ensuite/)).not.toBeInTheDocument()
        expect(affichette.querySelectorAll('[data-etat]')).toHaveLength(0)
      }
    })

    it('classe de la plus récemment active à la plus ancienne, pas dans l’ordre du back', async () => {
      // Le back rend le plus récemment ajouté d'abord : 2, puis 1. Mais 1 a été vu le 20.
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(2, '2026-09-10T10:00:00.000Z'), realisateur(1, '2026-09-01T10:00:00.000Z')]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () => json(pageRealisateur(1, [filmRealisateur(10, '2026-09-20'), filmRealisateur(11, null)])),
        'GET /api/me/realisateurs/2/page': () => json(pageRealisateur(2, [filmRealisateur(20, null)])),
      })
      monter()

      await waitFor(() => expect(screen.getAllByText(/séances? sur/)).toHaveLength(2))
      const noms = within(screen.getByRole('tabpanel')).getAllByRole('link').map((lien) => lien.getAttribute('aria-label'))
      // Mutation : sans le tri, « Réalisateur2 » (premier du back) passerait devant.
      expect(noms).toEqual(['Prénom Réalisateur1', 'Prénom Réalisateur2'])
    })
  })

  describe('la planche d’un cycle', () => {
    const monterAlien = () => {
      servir({
        'GET /api/me/realisateurs': () => json([]),
        'GET /api/me/sagas': () => json([ALIEN]),
        'GET /api/me/sagas/8091/films': () => json(FILMS_ALIEN),
      })
      monter()
      ouvrirCycles()
    }

    it('est un seul lien vers la page de la saga, nommé par son seul nom', async () => {
      monterAlien()

      const planche = await objet('Alien (Saga)')
      expect(within(planche).getAllByRole('link')).toHaveLength(1)
      expect(within(planche).getByRole('link')).toHaveAttribute('href', '/suivis/sagas/8091')
      expect(within(planche).getByText('Cycle')).toBeInTheDocument()
    })

    it('dit « N séances sur M » : les cases visibles de la planche', async () => {
      monterAlien()

      // Alien : quatre films dont un introuvable, masqué par défaut — 1 sur 3.
      // Mutation : un compte qui ignorerait le réglage dirait « sur 4 ».
      expect(await within(await objet('Alien (Saga)')).findByText(/séances? sur/)).toHaveTextContent('1 séance sur 3')
    })

    it('compte les introuvables quand « Masquer les introuvables » est coupé', async () => {
      basculerMasquerIntrouvables()
      monterAlien()

      expect(await within(await objet('Alien (Saga)')).findByText(/séances? sur/)).toHaveTextContent('1 séance sur 4')
    })

    it('montre ses films : vu, prochain, pas encore — les introuvables masqués par défaut', async () => {
      monterAlien()

      const bande = await screen.findByRole('list', { name: 'Les films de Alien (Saga)' })
      // Mutation : une bande qui garderait l'introuvable masqué, ou qui ne marquerait pas le prochain, change cette liste.
      expect(within(bande).getAllByRole('listitem').map((c) => c.getAttribute('aria-label'))).toEqual([
        'Alien, le huitième passager, vu',
        'Aliens, le retour, prochain à voir',
        'Prometheus, pas encore',
      ])
      expect(within(bande).getByText('1979')).toBeInTheDocument()
    })

    it('garde les introuvables à leur place, marqués « perdu », quand l’interrupteur est coupé', async () => {
      basculerMasquerIntrouvables()
      monterAlien()

      const bande = await screen.findByRole('list', { name: 'Les films de Alien (Saga)' })
      expect(within(bande).getAllByRole('listitem')[2]).toHaveAccessibleName('Alien 3 (montage de travail), introuvable')
      expect(within(bande).getByText('perdu')).toBeInTheDocument()
    })

    it('coche au crayon ce qui est vu, et seulement cela', async () => {
      monterAlien()

      const cases = within(await screen.findByRole('list', { name: 'Les films de Alien (Saga)' })).getAllByRole('listitem')
      // Mutation : une coche posée sur chaque case, ou sur le prochain, change ce tableau.
      expect(cases.map((c) => c.querySelector('svg') !== null)).toEqual([true, false, false])
    })

    it('« ensuite » annonce le prochain film avec son année', async () => {
      monterAlien()

      const planche = await objet('Alien (Saga)')
      // Mutation : l'année perdue donnerait « Aliens, le retour » seul.
      expect(await within(planche).findByText('Aliens, le retour (1986)')).toBeInTheDocument()
    })

    it('un film sans affiche prend la petite enseigne de sa décennie', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([]),
        'GET /api/me/sagas': () => json([saga(10)]),
        'GET /api/me/sagas/10/films': () => json(filmsSaga([{ ...filmSaga(101, null), cover_url: null }])),
      })
      monter()
      ouvrirCycles()

      const planche = await objet('Saga 10')
      // L'enseigne est une image nommée par le titre (`SigneDeFilm`).
      expect(await within(planche).findByRole('img', { name: 'Épisode 101', hidden: true })).toBeInTheDocument()
    })

    it('en attente, ne montre que le nom et « … » ; en panne, « indisponible »', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([]),
        'GET /api/me/sagas': () => json([saga(1), saga(2)]),
        'GET /api/me/sagas/1/films': () => json(ERREUR_TMDB, 503),
        'GET /api/me/sagas/2/films': () => new Promise<Response>(() => undefined),
      })
      monter()
      ouvrirCycles()

      const enPanne = await objet('Saga 1')
      expect(await within(enPanne).findByText('indisponible')).toBeInTheDocument()
      const enAttente = await objet('Saga 2')
      expect(within(enAttente).getByText('…')).toBeInTheDocument()
      for (const planche of [enPanne, enAttente]) {
        // Mutation : une rangée de films dessinée sans filmographie s'afficherait ici.
        expect(within(planche).queryByRole('list')).not.toBeInTheDocument()
        expect(within(planche).queryByText(/séances? sur/)).not.toBeInTheDocument()
        expect(within(planche).queryByText(/^ensuite/)).not.toBeInTheDocument()
      }
    })
  })

  describe('la rangée « Ensuite »', () => {
    const rangee = async () => within(await screen.findByRole('region', { name: 'Ensuite' }))

    it('montre le prochain film de chaque suivi en cours : l’affiche, le titre et le nom du suivi', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(2)]),
        'GET /api/me/sagas': () => json([ALIEN]),
        'GET /api/me/realisateurs/2/page': () => json(pageRealisateur(2, [filmRealisateur(20, '2026-09-20'), filmRealisateur(21, null)])),
        'GET /api/me/sagas/8091/films': () => json(FILMS_ALIEN),
      })
      monter()

      const dans = await rangee()
      const liens = await dans.findAllByRole('link')
      expect(liens).toHaveLength(2)
      expect(within(liens[0]!).getByText('Film 21')).toBeInTheDocument()
      expect(within(liens[0]!).getByText('Prénom Réalisateur2')).toBeInTheDocument()
      expect(within(liens[1]!).getByText('Aliens, le retour')).toBeInTheDocument()
      expect(within(liens[1]!).getByText('Alien (Saga)')).toBeInTheDocument()
      expect(within(liens[0]!).getByAltText('Film 21')).toBeInTheDocument()
    })

    it('mêle réalisateurs et sagas, du plus récemment actif au plus ancien', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1, '2026-09-01T00:00:00.000Z'), realisateur(2, '2026-09-02T00:00:00.000Z')]),
        'GET /api/me/sagas': () => json([saga(10, '2026-09-03T00:00:00.000Z')]),
        'GET /api/me/realisateurs/1/page': () => json(pageRealisateur(1, [filmRealisateur(10, '2026-09-20'), filmRealisateur(11, null)])), // le 20
        'GET /api/me/realisateurs/2/page': () => json(pageRealisateur(2, [filmRealisateur(21, null)])), // ajouté le 2
        'GET /api/me/sagas/10/films': () => json(filmsSaga([filmSaga(101, '2026-09-10'), filmSaga(102, null)])), // le 10
      })
      monter()

      const dans = await rangee()
      await waitFor(() => expect(dans.getAllByRole('link')).toHaveLength(3))
      // Mutation : sans le tri par activité, l'ordre serait celui des listes (réalisateurs, puis sagas).
      expect(dans.getAllByRole('link').map((lien) => lien.textContent)).toEqual([
        'Film 11Prénom Réalisateur1',
        'Épisode 102Saga 10',
        'Film 21Prénom Réalisateur2',
      ])
    })

    it('un film d’une salle du Voyage mène à sa fiche du Voyage', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1)]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () => json(pageRealisateur(1, [filmRealisateur(11, null, { voyage: true })])),
      })
      monter()

      const lien = await (await rangee()).findByRole('link')
      expect(lien).toHaveAttribute('href', '/voyage/1896/films/voyage-11')
    })

    it('un autre film d’un réalisateur mène à sa fiche des Suivis, avec le film et le réalisateur en état', async () => {
      const film = filmRealisateur(11, null)
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1)]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () => json(pageRealisateur(1, [film])),
      })
      monter()

      fireEvent.click(await (await rangee()).findByRole('link'))

      // Mutation : sans l'état de navigation, la fiche ne saurait ni le film ni son réalisateur.
      expect(JSON.parse((await screen.findByTestId('arrivee')).textContent!)).toEqual({
        pathname: '/suivis/films/11',
        state: { film, realisateur: { tmdb_id: 1, name: 'Prénom Réalisateur1' } },
      })
    })

    it('un film de saga mène à sa fiche des Suivis, sans réalisateur', async () => {
      const film = filmSaga(101, null)
      servir({
        'GET /api/me/realisateurs': () => json([]),
        'GET /api/me/sagas': () => json([saga(10)]),
        'GET /api/me/sagas/10/films': () => json(filmsSaga([film])),
      })
      monter()

      fireEvent.click(await (await rangee()).findByRole('link'))

      expect(JSON.parse((await screen.findByTestId('arrivee')).textContent!)).toEqual({
        pathname: '/suivis/films/101',
        state: { film, realisateur: null },
      })
    })

    it('est absente quand aucun suivi n’a de prochain film : bouclés, en attente, en panne', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1), realisateur(2), realisateur(3)]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () => json(pageRealisateur(1, [filmRealisateur(10, '2026-09-20')])), // bouclée
        'GET /api/me/realisateurs/2/page': () => json(ERREUR_TMDB, 503),
        'GET /api/me/realisateurs/3/page': () => new Promise<Response>(() => undefined),
      })
      monter()

      await screen.findByRole('button', { name: 'Archives · 1' })
      // Mutation : une rangée posée sans filmographie, ou sur une bouclée, montrerait ce titre.
      expect(screen.queryByRole('heading', { name: 'Ensuite' })).not.toBeInTheDocument()
    })

    it('reste sur la page quand l’intercalaire des cycles est ouvert', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1)]),
        'GET /api/me/sagas': () => json([saga(10)]),
        'GET /api/me/realisateurs/1/page': () => json(pageRealisateur(1, [filmRealisateur(11, null)])),
        'GET /api/me/sagas/10/films': () => json(filmsSaga([filmSaga(101, null)])),
      })
      monter()
      ouvrirCycles()

      expect(await (await rangee()).findAllByRole('link')).toHaveLength(2)
    })
  })

  describe('les archives', () => {
    const SUIVIS_ET_ARCHIVES = () =>
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1), realisateur(2)]),
        'GET /api/me/sagas': () => json([saga(10), saga(11)]),
        'GET /api/me/realisateurs/1/page': () => json(pageRealisateur(1, [filmRealisateur(10, '2026-09-27')])), // bouclée
        'GET /api/me/realisateurs/2/page': () => json(pageRealisateur(2, [filmRealisateur(20, '2026-09-20'), filmRealisateur(21, null)])), // en cours
        'GET /api/me/sagas/10/films': () => json(filmsSaga([filmSaga(101, '2026-08-02')])), // bouclée
        'GET /api/me/sagas/11/films': () => json(filmsSaga([filmSaga(111, '2026-09-02'), filmSaga(112, null)])), // en cours
      })

    it('replient les rétrospectives bouclées derrière « Archives · 1 »', async () => {
      SUIVIS_ET_ARCHIVES()
      monter()

      const bouton = await screen.findByRole('button', { name: 'Archives · 1' })
      expect(bouton).toHaveAttribute('aria-expanded', 'false')
      // Mutation : des archives dépliées d'office montreraient la bouclée ici.
      expect(await screen.findByRole('link', { name: 'Prénom Réalisateur2' })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Prénom Réalisateur1' })).not.toBeInTheDocument()
    })

    it('dépliées, montrent les bouclées avec leur bandeau « Complet » et leur date de clôture', async () => {
      SUIVIS_ET_ARCHIVES()
      monter()

      fireEvent.click(await screen.findByRole('button', { name: 'Archives · 1' }))

      const bouton = screen.getByRole('button', { name: 'Refermer les archives' })
      expect(bouton).toHaveAttribute('aria-expanded', 'true')
      const affichette = await objet('Prénom Réalisateur1')
      expect(within(affichette).getByText('Complet')).toBeInTheDocument()
      // Mutation : sans la date, ou avec le préfixe « 1 sur 1 · », ce texte exact manque.
      expect(await within(affichette).findByText('bouclée le 27 septembre 2026')).toBeInTheDocument()
      expect(within(affichette).queryByText(/^ensuite/)).not.toBeInTheDocument()
      expect(within(affichette).queryByAltText(/Film/)).not.toBeInTheDocument()
    })

    it('« Refermer les archives » les replie', async () => {
      SUIVIS_ET_ARCHIVES()
      monter()

      fireEvent.click(await screen.findByRole('button', { name: 'Archives · 1' }))
      fireEvent.click(screen.getByRole('button', { name: 'Refermer les archives' }))

      expect(screen.getByRole('button', { name: 'Archives · 1' })).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('link', { name: 'Prénom Réalisateur1' })).not.toBeInTheDocument()
    })

    it('les cycles ont les leurs : une planche « Complet », « bouclé le … »', async () => {
      SUIVIS_ET_ARCHIVES()
      monter()
      ouvrirCycles()

      fireEvent.click(await screen.findByRole('button', { name: 'Archives · 1' }))

      const planche = await objet('Saga 10')
      expect(within(planche).getByText('Complet')).toBeInTheDocument()
      expect(await within(planche).findByText('bouclé le 2 août 2026')).toBeInTheDocument()
      expect(within(planche).queryByText(/^ensuite/)).not.toBeInTheDocument()
      // L'autre, en cours, reste au-dessus.
      expect(screen.getByRole('link', { name: 'Saga 11' })).toBeInTheDocument()
    })

    it('n’ont pas de bouton quand rien n’est bouclé, ni tant que les films n’ont pas répondu', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1), realisateur(2)]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () => json(pageRealisateur(1, [filmRealisateur(10, null)])),
        'GET /api/me/realisateurs/2/page': () => new Promise<Response>(() => undefined),
      })
      monter()

      await screen.findByText('Prénom Réalisateur1', { exact: false })
      await waitFor(() => expect(screen.getAllByText(/séances? sur/)).toHaveLength(1))
      expect(screen.queryByRole('button', { name: /archives/i })).not.toBeInTheDocument()
    })

    it('une liste dont tout est bouclé n’a que ses archives', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1)]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () => json(pageRealisateur(1, [filmRealisateur(10, '2026-09-27')])),
      })
      monter()

      expect(await screen.findByRole('button', { name: 'Archives · 1' })).toBeInTheDocument()
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })
  })

  describe('la mémoire de la session', () => {
    const SERVIR_ARCHIVES = () =>
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1)]),
        'GET /api/me/sagas': () => json([saga(10)]),
        'GET /api/me/realisateurs/1/page': () => json(pageRealisateur(1, [filmRealisateur(10, '2026-09-27')])),
        'GET /api/me/sagas/10/films': () => json(filmsSaga([filmSaga(101, '2026-08-02')])),
      })

    it('retient l’intercalaire choisi quand on quitte la page et qu’on y revient', async () => {
      SERVIR_ARCHIVES()
      const client = createQueryClient()
      const { unmount } = monter(client)
      await screen.findByRole('tab', { name: 'Rétrospectives 1' })
      ouvrirCycles()
      unmount()

      monter(client)

      // Mutation : sans mémoire, la page repartirait des rétrospectives.
      expect(await screen.findByRole('tab', { name: 'Cycles 1' })).toHaveAttribute('aria-selected', 'true')
    })

    it('retient les archives dépliées, chacune pour son intercalaire', async () => {
      SERVIR_ARCHIVES()
      const client = createQueryClient()
      const { unmount } = monter(client)
      fireEvent.click(await screen.findByRole('button', { name: 'Archives · 1' }))
      unmount()

      monter(client)

      // Mutation : sans mémoire, le bouton se relirait « Archives · 1 ».
      expect(await screen.findByRole('button', { name: 'Refermer les archives' })).toBeInTheDocument()
      // Celles des cycles n'ont pas été touchées : elles restent repliées.
      ouvrirCycles()
      expect(await screen.findByRole('button', { name: 'Archives · 1' })).toHaveAttribute('aria-expanded', 'false')
    })

    it('un autre client de requêtes repart des rétrospectives, archives fermées', async () => {
      SERVIR_ARCHIVES()
      const client = createQueryClient()
      const { unmount } = monter(client)
      fireEvent.click(await screen.findByRole('button', { name: 'Archives · 1' }))
      ouvrirCycles()
      unmount()

      monter()

      // Mutation : une mémoire partagée par tous les clients (module) ferait revenir ici l'état d'avant.
      expect(await screen.findByRole('tab', { name: 'Rétrospectives 1' })).toHaveAttribute('aria-selected', 'true')
      expect(await screen.findByRole('button', { name: 'Archives · 1' })).toBeInTheDocument()
    })

    it('ne retient pas l’ouverture de la recherche', async () => {
      SERVIR_ARCHIVES()
      const client = createQueryClient()
      const { unmount } = monter(client)
      fireEvent.click(await screen.findByRole('button', { name: '+ Suivre' }))
      expect(screen.getByRole('searchbox')).toBeInTheDocument()
      unmount()

      monter(client)

      await screen.findByRole('tab', { name: 'Rétrospectives 1' })
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '+ Suivre' })).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('la recherche pour suivre', () => {
    const RESULTATS_PERSONNES = { results: [{ tmdb_id: NOLAN.tmdb_id, name: NOLAN.name, profile_url: NOLAN.profile_url }] }
    const RESULTATS_SAGAS = { results: [{ tmdb_id: 119, name: 'Le Seigneur des anneaux', cover_url: null }] }
    const VIDES = { results: [] }

    const ouvrir = () => fireEvent.click(screen.getByRole('button', { name: '+ Suivre' }))
    const chercher = (q: string) => fireEvent.change(screen.getByRole('searchbox', { name: 'Un réalisateur ou une saga' }), { target: { value: q } })

    it('s’ouvre sous l’en-tête avec « + Suivre », focus dans le champ, et se referme', async () => {
      servir({ 'GET /api/me/realisateurs': () => json([]), 'GET /api/me/sagas': () => json([]) })
      monter()

      const bouton = await screen.findByRole('button', { name: '+ Suivre' })
      expect(bouton).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()

      fireEvent.click(bouton)

      const champ = screen.getByRole('searchbox', { name: 'Un réalisateur ou une saga' })
      expect(bouton).toHaveAttribute('aria-expanded', 'true')
      expect(bouton).toHaveAttribute('aria-controls', champ.closest('[id]')!.id)
      // Mutation : sans le focus à l'ouverture, le champ resterait sans curseur.
      expect(champ).toHaveFocus()
      expect(champ).toHaveAttribute('placeholder', 'Un réalisateur ou une saga')

      fireEvent.click(bouton)
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    })

    it('une seule saisie cherche les réalisateurs et les sagas, en deux groupes titrés', async () => {
      const requetes = servir({
        'GET /api/me/realisateurs': () => json([]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/reference/personnes?q=Nolan': () => json(RESULTATS_PERSONNES),
        'GET /api/reference/sagas?q=Nolan': () => json(RESULTATS_SAGAS),
      })
      monter()
      await screen.findByRole('button', { name: '+ Suivre' })
      ouvrir()
      chercher('Nolan')

      const realisateurs = await screen.findByRole('heading', { name: 'Réalisateurs' }, DELAI_RECHERCHE)
      const sagas = await screen.findByRole('heading', { name: 'Sagas' })
      // Mutation : une recherche qui n'appellerait qu'un des deux services laisserait un groupe vide.
      expect(requetes).toContain('GET /api/reference/personnes?q=Nolan')
      expect(requetes).toContain('GET /api/reference/sagas?q=Nolan')
      expect(within(realisateurs.closest('section')!).getByText(NOLAN.name)).toBeInTheDocument()
      expect(sagas.closest('section')).toHaveTextContent('Le Seigneur des anneaux')
    })

    it('un groupe sans résultat n’est pas rendu', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/reference/personnes?q=Nolan': () => json(RESULTATS_PERSONNES),
        'GET /api/reference/sagas?q=Nolan': () => json(VIDES),
      })
      monter()
      await screen.findByRole('button', { name: '+ Suivre' })
      ouvrir()
      chercher('Nolan')

      await screen.findByRole('heading', { name: 'Réalisateurs' }, DELAI_RECHERCHE)
      // Mutation : un groupe rendu d'office laisserait son titre sans rien dessous.
      expect(screen.queryByRole('heading', { name: 'Sagas' })).not.toBeInTheDocument()
    })

    it('sans aucun résultat, dit « Rien trouvé pour « q ». »', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/reference/personnes?q=Zzz': () => json(VIDES),
        'GET /api/reference/sagas?q=Zzz': () => json(VIDES),
      })
      monter()
      await screen.findByRole('button', { name: '+ Suivre' })
      ouvrir()
      chercher('Zzz')

      expect(await screen.findByText('Rien trouvé pour « Zzz ».', {}, DELAI_RECHERCHE)).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Réalisateurs' })).not.toBeInTheDocument()
    })

    it('ne dit pas « Rien trouvé » tant qu’un des deux services n’a pas répondu', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/reference/personnes?q=Zzz': () => json(VIDES),
        'GET /api/reference/sagas?q=Zzz': () => new Promise<Response>(() => undefined),
      })
      monter()
      await screen.findByRole('button', { name: '+ Suivre' })
      ouvrir()
      chercher('Zzz')

      expect(await screen.findByText('Recherche…', {}, DELAI_RECHERCHE)).toBeInTheDocument()
      expect(screen.queryByText(/Rien trouvé/)).not.toBeInTheDocument()
    })

    it('suivre un réalisateur invalide sa liste, pas celle des sagas, et la recherche reste ouverte', async () => {
      let appelsListe = 0
      const requetes = servir({
        'GET /api/me/realisateurs': () => {
          appelsListe += 1
          return json(appelsListe === 1 ? [] : [NOLAN])
        },
        'GET /api/me/sagas': () => json([]),
        // Un film à voir : l'affichette reste en cours, elle ne migre pas aux archives en pleine assertion.
        'GET /api/me/realisateurs/525/page': () => json(pageRealisateur(525, [filmRealisateur(10, null)])),
        'GET /api/reference/personnes?q=Nolan': () => json(RESULTATS_PERSONNES),
        'GET /api/reference/sagas?q=Nolan': () => json(RESULTATS_SAGAS),
        'POST /api/me/realisateurs': () => json(NOLAN, 201),
      })
      monter()
      await screen.findByText('Tu ne suis aucun réalisateur.')
      ouvrir()
      chercher('Nolan')

      const groupe = (await screen.findByRole('heading', { name: 'Réalisateurs' }, DELAI_RECHERCHE)).closest('section')!
      fireEvent.click(within(groupe).getByRole('button', { name: 'Suivre' }))

      // Mutation : sans `invalidateQueries` dans `onSuccess`, `GET /api/me/realisateurs` ne
      // repartirait jamais une deuxième fois, et Nolan ne rejoindrait jamais la liste ci-dessous.
      expect(await screen.findByRole('link', { name: NOLAN.name })).toBeInTheDocument()
      expect(requetes.filter((r) => r === 'GET /api/me/realisateurs')).toHaveLength(2)
      // Mutation : une invalidation des deux listes redemanderait aussi les sagas.
      expect(requetes.filter((r) => r === 'GET /api/me/sagas')).toHaveLength(1)
      expect(screen.getByRole('searchbox')).toBeInTheDocument()
    })

    it('suivre une saga invalide la liste des sagas, pas celle des réalisateurs', async () => {
      let appelsListe = 0
      const requetes = servir({
        'GET /api/me/realisateurs': () => json([]),
        'GET /api/me/sagas': () => {
          appelsListe += 1
          return json(appelsListe === 1 ? [] : [saga(119)])
        },
        'GET /api/me/sagas/119/films': () => json(filmsSaga([filmSaga(1, null)])),
        'GET /api/reference/personnes?q=Seigneur': () => json(VIDES),
        'GET /api/reference/sagas?q=Seigneur': () => json(RESULTATS_SAGAS),
        'POST /api/me/sagas': () => json(saga(119), 201),
      })
      monter()
      await screen.findByText('Tu ne suis aucun réalisateur.')
      ouvrir()
      chercher('Seigneur')

      fireEvent.click(await screen.findByRole('button', { name: 'Suivre' }, DELAI_RECHERCHE))

      await waitFor(() => expect(screen.getByRole('tab', { name: 'Cycles 1' })).toBeInTheDocument())
      expect(requetes.filter((r) => r === 'GET /api/me/sagas')).toHaveLength(2)
      expect(requetes.filter((r) => r === 'GET /api/me/realisateurs')).toHaveLength(1)
    })

    it('un réalisateur déjà suivi, trouvé à nouveau, est marqué « Suivi » et désactivé', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([NOLAN]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/525/page': () => json(pageRealisateur(525, [filmRealisateur(10, null)])),
        'GET /api/reference/personnes?q=Nolan': () => json(RESULTATS_PERSONNES),
        'GET /api/reference/sagas?q=Nolan': () => json(VIDES),
      })
      monter()
      await screen.findByRole('link', { name: NOLAN.name })
      ouvrir()
      chercher('Nolan')

      const suivi = await screen.findByRole('button', { name: 'Suivi' }, DELAI_RECHERCHE)
      expect(suivi).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Suivre' })).not.toBeInTheDocument()
    })

    it('une saga déjà suivie est marquée « Suivi » dans son groupe, un réalisateur du même numéro non', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([]),
        'GET /api/me/sagas': () => json([saga(119)]),
        'GET /api/me/sagas/119/films': () => json(filmsSaga([filmSaga(1, null)])),
        'GET /api/reference/personnes?q=Nolan': () => json({ results: [{ tmdb_id: 119, name: 'Quelqu’un', profile_url: null }] }),
        'GET /api/reference/sagas?q=Nolan': () => json(RESULTATS_SAGAS),
      })
      monter()
      await screen.findByRole('tab', { name: 'Cycles 1' })
      ouvrir()
      chercher('Nolan')

      const sagas = (await screen.findByRole('heading', { name: 'Sagas' }, DELAI_RECHERCHE)).closest('section')!
      const realisateurs = screen.getByRole('heading', { name: 'Réalisateurs' }).closest('section')!
      // Mutation : un seul ensemble d'identifiants pour les deux groupes marquerait aussi « Quelqu'un ».
      expect(within(sagas).getByRole('button', { name: 'Suivi' })).toBeDisabled()
      expect(within(realisateurs).getByRole('button', { name: 'Suivre' })).toBeEnabled()
    })

    it('affiche l’erreur d’un groupe telle quelle, sans masquer l’autre', async () => {
      const message = 'TMDB est momentanément indisponible.'
      servir({
        'GET /api/me/realisateurs': () => json([]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/reference/personnes?q=Miyazaki': () => json({ code: 'SERVICE_UNCONFIGURED', message, retryable: false }, 503),
        'GET /api/reference/sagas?q=Miyazaki': () => json(RESULTATS_SAGAS),
      })
      monter()
      await screen.findByRole('button', { name: '+ Suivre' })
      ouvrir()
      chercher('Miyazaki')

      const alerte = await screen.findByRole('alert', {}, DELAI_RECHERCHE)
      expect(alerte).toHaveTextContent(message)
      expect(within(alerte.closest('section')!).getByRole('heading', { name: 'Réalisateurs' })).toBeInTheDocument()
      expect(await screen.findByRole('heading', { name: 'Sagas' })).toBeInTheDocument()
    })
  })

  describe('le chargement des filmographies', () => {
    it('se fait l’une après l’autre, dans l’ordre de la liste', async () => {
      let enVol = 0
      let maximum = 0
      const partis: number[] = []
      const lente = (id: number) => async () => {
        enVol += 1
        maximum = Math.max(maximum, enVol)
        partis.push(id)
        await new Promise((resolve) => setTimeout(resolve, 20))
        enVol -= 1
        return json(pageRealisateur(id, [filmRealisateur(id * 10, null)]))
      }
      servir({
        'GET /api/me/realisateurs': () => json([1, 2, 3].map((id) => realisateur(id))),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': lente(1),
        'GET /api/me/realisateurs/2/page': lente(2),
        'GET /api/me/realisateurs/3/page': lente(3),
      })
      monter()

      await waitFor(() => expect(screen.getAllByText(/séances? sur/)).toHaveLength(3))
      // Mutation : lancées toutes ensemble, trois requêtes seraient en vol à la fois.
      expect(maximum).toBe(1)
      expect(partis).toEqual([1, 2, 3])
    })

    it('une filmographie en panne n’arrête pas les suivantes', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1), realisateur(2)]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () => json(ERREUR_TMDB, 503),
        'GET /api/me/realisateurs/2/page': () => json(pageRealisateur(2, [filmRealisateur(20, '2026-09-27')])),
      })
      monter()

      expect(await screen.findByText('indisponible')).toBeInTheDocument()
      // Mutation : une boucle qui s'arrêterait à la première erreur ne chargerait jamais la seconde (aux archives).
      expect(await screen.findByRole('button', { name: 'Archives · 1' })).toBeInTheDocument()
    })

    it('charge aussi les films de l’intercalaire fermé : le compte et « Ensuite » ont besoin des deux', async () => {
      const requetes = servir({
        'GET /api/me/realisateurs': () => json([realisateur(1)]),
        'GET /api/me/sagas': () => json([saga(10)]),
        'GET /api/me/realisateurs/1/page': () => json(pageRealisateur(1, [filmRealisateur(11, null)])),
        'GET /api/me/sagas/10/films': () => json(filmsSaga([filmSaga(101, null)])),
      })
      monter()

      // Mutation : ne charger que l'intercalaire ouvert ne demanderait jamais les films de la saga.
      await waitFor(() => expect(requetes).toContain('GET /api/me/sagas/10/films'))
      expect(screen.queryByRole('link', { name: 'Saga 10' })).not.toBeInTheDocument()
    })

    it('une filmographie déjà fraîche en cache (l’accueil l’a lue) n’est pas redemandée', async () => {
      const client = createQueryClient()
      client.setQueryData(cles.pageRealisateur(1), pageRealisateur(1, [filmRealisateur(10, null)]))
      const requetes = servir({
        'GET /api/me/realisateurs': () => json([realisateur(1), realisateur(2)]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () => json(pageRealisateur(1, [filmRealisateur(10, null)])),
        'GET /api/me/realisateurs/2/page': () => json(pageRealisateur(2, [filmRealisateur(20, null)])),
      })
      monter(client)

      await waitFor(() => expect(requetes).toContain('GET /api/me/realisateurs/2/page'))
      // Mutation : un `fetchQuery` qui forcerait la fraîcheur (`staleTime: 0`) redemanderait la première.
      expect(requetes).not.toContain('GET /api/me/realisateurs/1/page')
    })

    it('quitter l’onglet arrête la chaîne : la filmographie suivante n’est jamais demandée', async () => {
      let repondre: (r: Response) => void = () => undefined
      const requetes = servir({
        'GET /api/me/realisateurs': () => json([realisateur(1), realisateur(2)]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () => new Promise<Response>((resolve) => (repondre = resolve)),
        'GET /api/me/realisateurs/2/page': () => json(pageRealisateur(2, [])),
      })
      const { unmount } = monter()

      await waitFor(() => expect(requetes).toContain('GET /api/me/realisateurs/1/page'))
      unmount()
      repondre(json(pageRealisateur(1, [])))
      await new Promise((resolve) => setTimeout(resolve, 30))
      // Mutation : sans le drapeau d'annulation, la boucle continuerait après le démontage.
      expect(requetes).not.toContain('GET /api/me/realisateurs/2/page')
    })
  })
})
