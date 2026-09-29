import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import Suivis from './Suivis'
import { createQueryClient } from '../api/queryClient'
import { cles } from '../api/cles'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import type { Realisateur } from '../api/realisateurs'
import type { FilmsSaga, Saga } from '../api/sagas'
import type { RealisateurPage } from '../api/realisateurs'
import { basculerMasquerIntrouvables, reinitialiserMasquerIntrouvables } from '../suivis/masquer'

const NOLAN = exemple<Realisateur[]>('/me/realisateurs', 'get', 200)[0]!
const ALIEN = exemple<Saga[]>('/me/sagas', 'get', 200)[0]!
const PAGE_NOLAN = exemple<RealisateurPage>('/me/realisateurs/{tmdbId}/page', 'get', 200)
const FILMS_ALIEN = exemple<FilmsSaga>('/me/sagas/{tmdbId}/films', 'get', 200)
const RESULTATS_PERSONNES = { results: [{ tmdb_id: NOLAN.tmdb_id, name: NOLAN.name, profile_url: NOLAN.profile_url }] }

// Le débounce de la recherche (300 ms, `recherche/useValeurDebouncee.ts`) tourne en temps réel
// ici, jamais accéléré : `findBy*` l'attend simplement, avec une marge au-dessus de son délai.
const DELAI_RECHERCHE = { timeout: 2000 }

function monter(client = createQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Suivis />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('l’onglet Suivis', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    reinitialiserMasquerIntrouvables()
  })

  it('sans aucun suivi, montre les deux listes vides', async () => {
    servir({ 'GET /api/me/realisateurs': () => json([]), 'GET /api/me/sagas': () => json([]) })
    monter()

    expect(await screen.findByText('Tu ne suis aucun réalisateur.')).toBeInTheDocument()
    expect(screen.getByText('Tu ne suis aucune saga.')).toBeInTheDocument()
  })

  it('liste les réalisateurs et sagas déjà suivis, chacun en lien vers sa page', async () => {
    servir({
      'GET /api/me/realisateurs': () => json([NOLAN]),
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/realisateurs/525/page': () => json(PAGE_NOLAN),
      'GET /api/me/sagas/8091/films': () => json(FILMS_ALIEN),
    })
    monter()

    expect(await screen.findByRole('link', { name: (n) => n.includes(NOLAN.name) })).toHaveAttribute(
      'href',
      `/suivis/realisateurs/${NOLAN.tmdb_id}`,
    )
    expect(screen.getByRole('link', { name: (n) => n.includes(ALIEN.name) })).toHaveAttribute(
      'href',
      `/suivis/sagas/${ALIEN.tmdb_id}`,
    )
  })

  it('suivre un réalisateur trouvé par la recherche invalide le cache : il rejoint la liste', async () => {
    // Le premier appel rend une liste vide, le second (après la mutation) la rend avec Nolan —
    // c'est l'invalidation de `cles.realisateurs` qui déclenche ce second appel.
    let appelsListe = 0
    const requetes = servir({
      'GET /api/me/realisateurs': () => {
        appelsListe += 1
        return json(appelsListe === 1 ? [] : [NOLAN])
      },
      'GET /api/me/sagas': () => json([]),
      // Un film à voir : la carte reste en cours, elle ne migre pas sous « complets » en pleine assertion.
      'GET /api/me/realisateurs/525/page': () => json({ ...PAGE_NOLAN, films: [{ ...PAGE_NOLAN.films[0]!, vu: null }] }),
      'GET /api/reference/personnes?q=Nolan': () => json(RESULTATS_PERSONNES),
      'POST /api/me/realisateurs': () => json(NOLAN, 201),
    })
    monter()

    await screen.findByText('Tu ne suis aucun réalisateur.')
    fireEvent.change(screen.getByLabelText('Un nom de réalisateur'), { target: { value: 'Nolan' } })

    const bouton = await screen.findByRole('button', { name: 'Suivre' }, DELAI_RECHERCHE)
    fireEvent.click(bouton)

    // Mutation : sans `invalidateQueries` dans `onSuccess`, `GET /api/me/realisateurs` ne
    // repartirait jamais une deuxième fois, et Nolan ne rejoindrait jamais la liste ci-dessous.
    expect(await screen.findByRole('link', { name: (n) => n.includes(NOLAN.name) })).toBeInTheDocument()
    expect(requetes.filter((r) => r === 'GET /api/me/realisateurs')).toHaveLength(2)
  })

  it('affiche l’erreur de la recherche telle quelle', async () => {
    const message = 'TMDB est momentanément indisponible.'
    servir({
      'GET /api/me/realisateurs': () => json([]),
      'GET /api/me/sagas': () => json([]),
      'GET /api/reference/personnes?q=Miyazaki': () => json({ code: 'SERVICE_UNCONFIGURED', message, retryable: false }, 503),
    })
    monter()

    await screen.findByText('Tu ne suis aucun réalisateur.')
    fireEvent.change(screen.getByLabelText('Un nom de réalisateur'), { target: { value: 'Miyazaki' } })

    expect(await screen.findByText(message, {}, DELAI_RECHERCHE)).toBeInTheDocument()
  })

  it('un réalisateur déjà suivi trouvé à nouveau par la recherche est marqué « Suivi », pas « Suivre »', async () => {
    servir({
      'GET /api/me/realisateurs': () => json([NOLAN]),
      'GET /api/me/sagas': () => json([]),
      'GET /api/me/realisateurs/525/page': () => json(PAGE_NOLAN),
      'GET /api/reference/personnes?q=Nolan': () => json(RESULTATS_PERSONNES),
    })
    monter()

    await screen.findByRole('link', { name: (n) => n.includes(NOLAN.name) })
    fireEvent.change(screen.getByLabelText('Un nom de réalisateur'), { target: { value: 'Nolan' } })

    const resultats = await screen.findAllByRole('button', { name: 'Suivi' }, DELAI_RECHERCHE)
    expect(resultats).toHaveLength(1)
    expect(resultats[0]).toBeDisabled()
  })

  describe('la ligne sous chaque nom, l’ordre et les « complets »', () => {
    // Le jour est fixé à la main : « vu il y a 3 mois » ne dépend pas de l'horloge de la machine.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-09-29T12:00:00'))
    })

    const realisateur = (id: number, ajouteLe: string): Realisateur => ({ ...NOLAN, tmdb_id: id, name: `Réalisateur ${id}`, ajoute_le: ajouteLe })
    const filmRealisateur = (id: number, vu: string | null) => ({
      ...PAGE_NOLAN.films[0]!,
      tmdb_id: id,
      title: `Film ${id}`,
      vu: vu ? { entry_id: `e-${id}`, rating: null, finished_at: vu } : null,
      introuvable: false,
    })
    const page = (id: number, films: ReturnType<typeof filmRealisateur>[]) => ({ ...PAGE_NOLAN, tmdb_id: id, films })

    it('dit « N sur M » sous chaque nom, avec le dernier visionnage ; un cycle compte ses cases visibles', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1, '2026-09-01T10:00:00.000Z')]),
        'GET /api/me/sagas': () => json([ALIEN]),
        'GET /api/me/realisateurs/1/page': () => json(page(1, [filmRealisateur(10, '2026-09-26'), filmRealisateur(11, null)])),
        'GET /api/me/sagas/8091/films': () => json(FILMS_ALIEN),
      })
      monter()

      // Mutation : sans la ligne sous le nom, ces deux textes n'existent pas.
      expect(await screen.findByText('1 sur 2 · vu il y a 3 jours')).toBeInTheDocument()
      // Alien : quatre films dont un introuvable, masqué par défaut — 1 sur 3, le film vu le 1er juin.
      expect(await screen.findByText('1 sur 3 · vu il y a 3 mois')).toBeInTheDocument()
    })

    it('un cycle compte ses introuvables quand « Masquer les introuvables » est coupé', async () => {
      basculerMasquerIntrouvables()
      servir({
        'GET /api/me/realisateurs': () => json([]),
        'GET /api/me/sagas': () => json([ALIEN]),
        'GET /api/me/sagas/8091/films': () => json(FILMS_ALIEN),
      })
      monter()

      // Mutation : un compte qui ignorerait le réglage garderait « 1 sur 3 ».
      expect(await screen.findByText('1 sur 4 · vu il y a 3 mois')).toBeInTheDocument()
    })

    it('un film ajouté sans visionnage se date de son ajout', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1, '2026-09-01T10:00:00.000Z')]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () => json(page(1, [filmRealisateur(10, null)])),
      })
      monter()

      expect(await screen.findByText('0 sur 1 · ajouté le 1er septembre 2026')).toBeInTheDocument()
    })

    it('classe de la plus récemment active à la plus ancienne, pas dans l’ordre du back', async () => {
      // Le back rend le plus récemment ajouté d'abord : 2, puis 1. Mais 1 a été vu le 20.
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(2, '2026-09-10T10:00:00.000Z'), realisateur(1, '2026-09-01T10:00:00.000Z')]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () => json(page(1, [filmRealisateur(10, '2026-09-20'), filmRealisateur(11, null)])),
        'GET /api/me/realisateurs/2/page': () => json(page(2, [filmRealisateur(20, null)])),
      })
      monter()

      await screen.findByText('1 sur 2 · vu il y a 1 semaine')
      await screen.findByText('0 sur 1 · ajouté le 10 septembre 2026')
      const noms = screen.getAllByRole('link').map((lien) => lien.textContent ?? '')
      // Mutation : sans le tri, « Réalisateur 2 » (premier du back) passerait devant.
      expect(noms.findIndex((n) => n.includes('Réalisateur 1'))).toBeLessThan(noms.findIndex((n) => n.includes('Réalisateur 2')))
    })

    it('range les rétrospectives bouclées sous « Rétrospectives complètes », en bas', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1, '2026-09-01T10:00:00.000Z'), realisateur(2, '2026-09-02T10:00:00.000Z')]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () => json(page(1, [filmRealisateur(10, '2026-09-27')])), // bouclée
        'GET /api/me/realisateurs/2/page': () => json(page(2, [filmRealisateur(20, '2026-09-20'), filmRealisateur(21, null)])), // en cours
      })
      monter()

      const titre = await screen.findByRole('heading', { name: 'Rétrospectives complètes' })
      expect(await screen.findByText('1 sur 1 · bouclée le 27 septembre 2026')).toBeInTheDocument()
      // Le réalisateur 2 (en cours) est au-dessus du titre, le 1 (bouclé) en dessous.
      const enCours = screen.getByRole('link', { name: (n) => n.includes('Réalisateur 2') })
      const bouclee = screen.getByRole('link', { name: (n) => n.includes('Réalisateur 1') })
      expect(enCours.compareDocumentPosition(titre) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      // Mutation : sans la partition, la bouclée resterait au-dessus du titre.
      expect(titre.compareDocumentPosition(bouclee) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('une liste sans aucune bouclée n’affiche pas le titre des complets, et une filmographie vide ne boucle rien', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1, '2026-09-01T10:00:00.000Z')]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () => json(page(1, [])),
      })
      monter()

      await screen.findByText('0 sur 0 · ajouté le 1er septembre 2026')
      expect(screen.queryByRole('heading', { name: 'Rétrospectives complètes' })).not.toBeInTheDocument()
    })

    it('charge les filmographies l’une après l’autre, dans l’ordre de la liste', async () => {
      let enVol = 0
      let maximum = 0
      const partis: number[] = []
      const lente = (id: number) => async () => {
        enVol += 1
        maximum = Math.max(maximum, enVol)
        partis.push(id)
        await new Promise((resolve) => setTimeout(resolve, 20))
        enVol -= 1
        return json(page(id, [filmRealisateur(id * 10, null)]))
      }
      servir({
        'GET /api/me/realisateurs': () => json([1, 2, 3].map((id) => realisateur(id, `2026-09-0${id}T10:00:00.000Z`))),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': lente(1),
        'GET /api/me/realisateurs/2/page': lente(2),
        'GET /api/me/realisateurs/3/page': lente(3),
      })
      monter()

      await waitFor(() => expect(screen.getAllByText(/^0 sur 1 · ajouté le/)).toHaveLength(3))
      // Mutation : lancées toutes ensemble, trois requêtes seraient en vol à la fois.
      expect(maximum).toBe(1)
      expect(partis).toEqual([1, 2, 3])
    })

    it('une filmographie en panne se lit « indisponible » sans arrêter les suivantes', async () => {
      servir({
        'GET /api/me/realisateurs': () => json([realisateur(1, '2026-09-01T10:00:00.000Z'), realisateur(2, '2026-09-02T10:00:00.000Z')]),
        'GET /api/me/sagas': () => json([]),
        'GET /api/me/realisateurs/1/page': () => json({ code: 'SERVICE_UNCONFIGURED', message: 'TMDB est en panne.', retryable: false }, 503),
        'GET /api/me/realisateurs/2/page': () => json(page(2, [filmRealisateur(20, '2026-09-27')])),
      })
      monter()

      expect(await screen.findByText('indisponible')).toBeInTheDocument()
      // Mutation : une boucle qui s'arrêterait à la première erreur ne chargerait jamais la seconde.
      expect(await screen.findByText('1 sur 1 · bouclée le 27 septembre 2026')).toBeInTheDocument()
    })
  })
})

describe('les cartes des Suivis', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-29T12:00:00'))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    reinitialiserMasquerIntrouvables()
  })

  const realisateur = (id: number): Realisateur => ({ ...NOLAN, tmdb_id: id, name: `Réalisateur ${id}`, ajoute_le: `2026-09-0${id}T10:00:00.000Z` })
  const film = (id: number, vu: string | null) => ({
    ...PAGE_NOLAN.films[0]!,
    tmdb_id: id,
    title: `Film ${id}`,
    year: 1990 + id,
    vu: vu ? { entry_id: `e-${id}`, rating: null, finished_at: vu } : null,
    introuvable: false,
  })
  const page = (id: number, films: ReturnType<typeof film>[]): RealisateurPage => ({ ...PAGE_NOLAN, tmdb_id: id, films })
  /** La carte (l'élément de liste) qui porte ce nom. */
  const carte = async (nom: string) => (await screen.findByRole('link', { name: (n) => n.includes(nom) })).closest('li')!

  it('l’en-tête compte les rétrospectives et les cycles, une fois les deux listes arrivées', async () => {
    let repondreSagas: (r: Response) => void = () => undefined
    servir({
      'GET /api/me/realisateurs': () => json([realisateur(1), realisateur(2)]),
      'GET /api/me/sagas': () => new Promise<Response>((resolve) => (repondreSagas = resolve)),
      'GET /api/me/realisateurs/1/page': () => json(page(1, [])),
      'GET /api/me/realisateurs/2/page': () => json(page(2, [])),
    })
    monter()

    await screen.findByRole('link', { name: (n) => n.includes('Réalisateur 2') })
    // Mutation : sans l'attente des deux listes, « 2 rétrospectives · 0 cycle » s'afficherait déjà, faux.
    expect(screen.queryByText(/rétrospectives? ·/)).not.toBeInTheDocument()

    repondreSagas(json([ALIEN]))
    expect(await screen.findByText('2 rétrospectives · 1 cycle')).toBeInTheDocument()
  })

  it('« 4/12 » à droite de chaque carte arrivée, rien tant que sa filmographie manque', async () => {
    servir({
      'GET /api/me/realisateurs': () => json([realisateur(1), realisateur(2)]),
      'GET /api/me/sagas': () => json([]),
      'GET /api/me/realisateurs/1/page': () => json(page(1, [film(10, '2026-09-20'), film(11, null), film(12, null)])),
      'GET /api/me/realisateurs/2/page': () => json({ code: 'SERVICE_UNCONFIGURED', message: 'TMDB est en panne.', retryable: false }, 503),
    })
    monter()

    // Mutation : sans le compte, cette image n'existe pas.
    expect(within(await carte('Réalisateur 1')).getByRole('img', { name: '1 sur 3' })).toHaveTextContent('1/3')
    await within(await carte('Réalisateur 2')).findByText('indisponible')
    expect(within(await carte('Réalisateur 2')).queryByRole('img', { name: / sur / })).not.toBeInTheDocument()
  })

  it('une rétrospective bouclée porte le sceau « Rétrospective complète » ; en cours, non', async () => {
    servir({
      'GET /api/me/realisateurs': () => json([realisateur(1), realisateur(2)]),
      'GET /api/me/sagas': () => json([]),
      'GET /api/me/realisateurs/1/page': () => json(page(1, [film(10, '2026-09-27')])),
      'GET /api/me/realisateurs/2/page': () => json(page(2, [film(20, '2026-09-20'), film(21, null)])),
    })
    monter()

    // La carte change de liste en passant sous « complets » : on la relit une fois rangée.
    await screen.findByText('1 sur 1 · bouclée le 27 septembre 2026')
    // Mutation : sans le sceau, ou posé sur toutes les cartes, l'une des deux assertions tombe.
    expect(within(await carte('Réalisateur 1')).getByRole('img', { name: 'Rétrospective complète' })).toBeInTheDocument()
    await within(await carte('Réalisateur 2')).findByText('1 sur 2 · vu il y a 1 semaine')
    expect(within(await carte('Réalisateur 2')).queryByRole('img', { name: 'Rétrospective complète' })).not.toBeInTheDocument()
  })

  it('une filmographie de réalisateur ne compte pas ses séries', async () => {
    // L'exemple de Nolan : Inception (vu) et une série jamais vue. Sans la série, tout est vu.
    servir({
      'GET /api/me/realisateurs': () => json([NOLAN]),
      'GET /api/me/sagas': () => json([]),
      'GET /api/me/realisateurs/525/page': () => json(PAGE_NOLAN),
    })
    monter()

    // Mutation : une filmographie qui garderait la série dirait « 1 sur 2 » et resterait en cours.
    expect(await screen.findByText('1 sur 1 · bouclée le 12 juillet 2026')).toBeInTheDocument()
  })

  it('« Ensuite » et le prochain film sous une carte en cours ; rien sous une bouclée', async () => {
    servir({
      'GET /api/me/realisateurs': () => json([realisateur(1), realisateur(2)]),
      'GET /api/me/sagas': () => json([]),
      'GET /api/me/realisateurs/1/page': () => json(page(1, [film(10, '2026-09-27')])),
      'GET /api/me/realisateurs/2/page': () => json(page(2, [film(20, '2026-09-20'), film(21, null), film(22, null)])),
    })
    monter()

    const enCours = await carte('Réalisateur 2')
    // Le premier non vu, pas le dernier. Mutation : prendre un autre film que `prochainAVoir` rendrait « Film 22 ».
    expect(await within(enCours).findByText('Film 21 (2011)')).toBeInTheDocument()
    expect(within(enCours).getByText('Ensuite')).toBeInTheDocument()
    await within(await carte('Réalisateur 1')).findByText(/bouclée le/)
    expect(within(await carte('Réalisateur 1')).queryByText('Ensuite')).not.toBeInTheDocument()
  })

  it('la bande d’un cycle : vu, prochain, pas encore — les introuvables masqués par défaut', async () => {
    servir({
      'GET /api/me/realisateurs': () => json([]),
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/sagas/8091/films': () => json(FILMS_ALIEN),
    })
    monter()

    const bande = await screen.findByRole('list', { name: 'Les films de Alien (Saga)' })
    // Mutation : une bande qui garderait l'introuvable masqué, ou qui ne marquerait pas le prochain, change cette liste.
    expect(within(bande).getAllByRole('listitem').map((c) => c.getAttribute('aria-label'))).toEqual([
      'Alien, le huitième passager, vu',
      'Aliens, le retour, prochain à voir',
      'Prometheus, pas encore',
    ])
    expect(within(bande).getByText('1979')).toBeInTheDocument()
  })

  it('la bande garde les introuvables à leur place quand l’interrupteur est coupé', async () => {
    basculerMasquerIntrouvables()
    servir({
      'GET /api/me/realisateurs': () => json([]),
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/sagas/8091/films': () => json(FILMS_ALIEN),
    })
    monter()

    const bande = await screen.findByRole('list', { name: 'Les films de Alien (Saga)' })
    expect(within(bande).getAllByRole('listitem')[2]).toHaveAccessibleName('Alien 3 (montage de travail), introuvable')
    expect(within(bande).getByText('Perdu')).toBeInTheDocument()
  })

  it('une rétrospective n’a pas de bande, un cycle bouclé n’a pas de sceau', async () => {
    const tousVus = { films: FILMS_ALIEN.films.map((f) => ({ ...f, vu: f.vu ?? { entry_id: `e-${f.tmdb_id}`, rating: null, finished_at: '2026-09-01' } })) }
    servir({
      'GET /api/me/realisateurs': () => json([realisateur(1)]),
      'GET /api/me/sagas': () => json([ALIEN]),
      'GET /api/me/realisateurs/1/page': () => json(page(1, [film(10, '2026-09-27')])),
      'GET /api/me/sagas/8091/films': () => json(tousVus),
    })
    monter()

    await screen.findByRole('heading', { name: 'Cycles complets' })
    const cycle = await carte('Alien (Saga)')
    // Mutation : un sceau posé sans regarder la source en mettrait un sur ce cycle bouclé.
    expect(within(cycle).queryByRole('img', { name: 'Rétrospective complète' })).not.toBeInTheDocument()
    await within(await carte('Réalisateur 1')).findByRole('img', { name: 'Rétrospective complète' })
    // Mutation : une bande posée sans regarder la source en dessinerait une sous le réalisateur.
    expect(screen.queryByRole('list', { name: 'Les films de Réalisateur 1' })).not.toBeInTheDocument()
  })

  it('une filmographie déjà fraîche en cache (l’accueil l’a lue) n’est pas redemandée', async () => {
    const client = createQueryClient()
    client.setQueryData(cles.pageRealisateur(1), page(1, [film(10, null)]))
    const requetes = servir({
      'GET /api/me/realisateurs': () => json([realisateur(1), realisateur(2)]),
      'GET /api/me/sagas': () => json([]),
      'GET /api/me/realisateurs/1/page': () => json(page(1, [film(10, null)])),
      'GET /api/me/realisateurs/2/page': () => json(page(2, [film(20, null)])),
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
      'GET /api/me/realisateurs/2/page': () => json(page(2, [])),
    })
    const { unmount } = monter()

    await waitFor(() => expect(requetes).toContain('GET /api/me/realisateurs/1/page'))
    unmount()
    repondre(json(page(1, [])))
    await new Promise((resolve) => setTimeout(resolve, 30))
    // Mutation : sans le drapeau d'annulation, la boucle continuerait après le démontage.
    expect(requetes).not.toContain('GET /api/me/realisateurs/2/page')
  })
})
