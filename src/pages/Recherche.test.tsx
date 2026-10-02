import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import Recherche from './Recherche'
import { createQueryClient } from '../api/queryClient'
import { cles } from '../api/cles'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import { filmDeSalle, fichePrete, salle, voyage1890 } from '../test/voyage'
import type { JournalPage } from '../api/journal'
import type { SearchPage } from '../api/recherche'

const VOYAGE_VIDE = {
  configure: false,
  depart: 1895,
  annee_en_cours: 1895,
  annees: [],
  ticket_a_montrer: null,
  tampons: [],
  seance_prise: null,
  ia: false,
  source: null,
}
const PLEX_VIDE = { configure: false, calcule_le: null, films: [], demandes: [] }
/** Servies par toute page qui lit le Voyage courant (l'année en cours vaut toujours 1895 ici, sans chronique). */
const ROUTES_VOYAGE = {
  'GET /api/me/voyage': () => json(VOYAGE_VIDE),
  'GET /api/me/voyage/annees/1895': () => json({ configure: false }),
  'GET /api/reference/plex': () => json(PLEX_VIDE),
}
const RESULTATS = exemple<SearchPage>('/search', 'get', 200)
const INCEPTION = RESULTATS.items.find((r) => r.type === 'movie')!

/** La page qu'ouvre un film choisi : elle montre le chemin et l'état de navigation reçus, que le formulaire lirait. */
function EtatRecu() {
  const { pathname, state } = useLocation()
  return <p data-testid="arrivee">{JSON.stringify({ pathname, state })}</p>
}

function monter(client = createQueryClient(), recentes: string[] = []) {
  window.localStorage.clear()
  if (recentes.length > 0) window.localStorage.setItem('journal.recherches-recentes', JSON.stringify(recentes))
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/recherche']}>
        <Routes>
          <Route path="/recherche" element={<Recherche />} />
          <Route path="*" element={<EtatRecu />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('la recherche', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('le délai attend la fin de la frappe : une seule requête pour plusieurs lettres', async () => {
    const requetes = servir({
      ...ROUTES_VOYAGE,
      'GET /api/search?type=movie&q=inception': () => json(RESULTATS),
    })
    monter()

    fireEvent.change(screen.getByLabelText('Rechercher un film'), { target: { value: 'i' } })
    await vi.advanceTimersByTimeAsync(100)
    fireEvent.change(screen.getByLabelText('Rechercher un film'), { target: { value: 'in' } })
    await vi.advanceTimersByTimeAsync(100)
    fireEvent.change(screen.getByLabelText('Rechercher un film'), { target: { value: 'inception' } })

    // Mutation : sans le débounce, chaque frappe ci-dessus aurait déjà déclenché son propre appel.
    expect(requetes.filter((r) => r.includes('/search'))).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(300)
    expect(requetes.filter((r) => r.includes('/search'))).toEqual(['GET /api/search?type=movie&q=inception'])

    await vi.advanceTimersByTimeAsync(300)
    expect(requetes.filter((r) => r.includes('/search'))).toHaveLength(1)
  })

  it('affiche une erreur de l’API telle quelle', async () => {
    const message = 'La recherche est momentanément indisponible.'
    servir({
      ...ROUTES_VOYAGE,
      'GET /api/search?type=movie&q=inception': () =>
        json({ code: 'SERVICE_UNCONFIGURED', message, retryable: false }, 503),
    })
    monter()

    fireEvent.change(screen.getByLabelText('Rechercher un film'), { target: { value: 'inception' } })
    await vi.advanceTimersByTimeAsync(300)
    vi.useRealTimers()

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  /** Le résultat « Inception » cherché, avec le visionnage donné déjà au journal en cache. */
  async function chercherUnFilmDejaVu(note: number | null) {
    const item = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!
    item.entry.rating = note
    const client = createQueryClient()
    // Le journal est déjà en cache (visité depuis l'accueil) : la recherche ne le relit pas.
    client.setQueryData(cles.journal, { pages: [{ items: [item], next_cursor: null }], pageParams: [undefined] })
    servir({
      ...ROUTES_VOYAGE,
      'GET /api/search?type=movie&q=inception': () => json({ ...RESULTATS, items: [{ ...INCEPTION, external_id: item.media.external_id }] }),
    })
    monter(client)

    fireEvent.change(screen.getByLabelText('Rechercher un film'), { target: { value: 'inception' } })
    await vi.advanceTimersByTimeAsync(300)
    vi.useRealTimers()
    await screen.findByRole('button', { name: /Inception/ })
  }

  it('marque d’étoiles, avec sa note dite en mots, un résultat déjà au journal et noté', async () => {
    await chercherUnFilmDejaVu(7)

    // Mutation : l'étiquette qui ne lit plus la note du cache (`note={null}`) perd son nom.
    const etiquette = screen.getByRole('img', { name: 'vu, noté 7 sur 10' })
    expect(etiquette.querySelectorAll('svg')).toHaveLength(5)
  })

  it('marque du mot « vu » un résultat déjà au journal sans note, et d’aucune étoile', async () => {
    await chercherUnFilmDejaVu(null)

    // Mutation : le mot « vu » retiré de l'étiquette sans note (ou les étoiles posées même sans note).
    expect(screen.getByText('vu')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /^vu/ })).toBeNull()
  })

  it('ne marque pas un résultat que le journal ne connaît pas', async () => {
    servir({ ...ROUTES_VOYAGE, 'GET /api/search?type=movie&q=inception': () => json(RESULTATS) })
    monter()

    fireEvent.change(screen.getByLabelText('Rechercher un film'), { target: { value: 'inception' } })
    await vi.advanceTimersByTimeAsync(300)
    vi.useRealTimers()
    await screen.findByRole('button', { name: /Inception/ })

    // Mutation : l'étiquette posée sur chaque résultat, `vu !== undefined` devenu `true`.
    expect(screen.queryByText('vu')).toBeNull()
    expect(screen.queryByRole('img', { name: /^vu/ })).toBeNull()
  })

  it('montre le titre d’un résultat et « réalisateur, année » dessous, en liste d’affiches', async () => {
    servir({ ...ROUTES_VOYAGE, 'GET /api/search?type=movie&q=inception': () => json(RESULTATS) })
    monter()

    fireEvent.change(screen.getByLabelText('Rechercher un film'), { target: { value: 'inception' } })
    await vi.advanceTimersByTimeAsync(300)
    vi.useRealTimers()

    // Mutation : `sousTitre` retiré du résultat, ou la liste rendue hors d'une `ul`.
    const bouton = await screen.findByRole('button', { name: /Inception/ })
    expect(within(bouton).getByText('Christopher Nolan, 2010')).toBeInTheDocument()
    expect(bouton.closest('ul')).toBeInTheDocument()
  })

  it('ouvre le formulaire de création avec le film touché', async () => {
    servir({ ...ROUTES_VOYAGE, 'GET /api/search?type=movie&q=inception': () => json(RESULTATS) })
    monter()

    fireEvent.change(screen.getByLabelText('Rechercher un film'), { target: { value: 'inception' } })
    await vi.advanceTimersByTimeAsync(300)
    vi.useRealTimers()
    fireEvent.click(await screen.findByRole('button', { name: /Inception/ }))

    // Mutation : `ouvrirFormulaire` qui ne passe plus le candidat en état de navigation.
    expect(screen.getByTestId('arrivee')).toHaveTextContent('"pathname":"/journal/nouveau"')
    expect(screen.getByTestId('arrivee')).toHaveTextContent('"external_id":"27205"')
  })

  it('dit quand rien n’est trouvé', async () => {
    servir({ ...ROUTES_VOYAGE, 'GET /api/search?type=movie&q=zzz': () => json({ ...RESULTATS, items: [] }) })
    monter()

    fireEvent.change(screen.getByLabelText('Rechercher un film'), { target: { value: 'zzz' } })
    await vi.advanceTimersByTimeAsync(300)
    vi.useRealTimers()

    expect(await screen.findByText('Rien trouvé pour « zzz ».')).toBeInTheDocument()
  })

  it('efface la saisie avec le bouton du champ, et ne le montre que s’il y a une saisie', async () => {
    servir({ ...ROUTES_VOYAGE })
    monter()
    const champ = screen.getByLabelText('Rechercher un film')
    expect(screen.queryByRole('button', { name: 'Effacer' })).toBeNull()

    fireEvent.change(champ, { target: { value: 'varda' } })
    fireEvent.click(screen.getByRole('button', { name: 'Effacer' }))

    // Mutation : `setSaisie('')` retiré du bouton.
    expect(champ).toHaveValue('')
  })

  describe('les dernières recherches', () => {
    it('s’écrivent comme des mots au crayon sous « Dernières recherches », et un toucher les remet dans le champ', () => {
      servir({ ...ROUTES_VOYAGE })
      monter(createQueryClient(), ['varda', 'max'])

      expect(screen.getByText('Dernières recherches')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'max' }))

      // Mutation : le mot qui ne remplit plus le champ (`setSaisie(terme)` retiré).
      expect(screen.getByLabelText('Rechercher un film')).toHaveValue('max')
    })

    it('s’effacent avec la corbeille, et la liste disparaît avec elles', () => {
      servir({ ...ROUTES_VOYAGE })
      monter(createQueryClient(), ['varda', 'max'])

      fireEvent.click(screen.getByRole('button', { name: 'Effacer les dernières recherches' }))

      // Mutation : `effacerRecentes` qui ne vide plus le stockage, ou qui ne vide plus la liste.
      expect(screen.queryByText('Dernières recherches')).toBeNull()
      expect(window.localStorage.getItem('journal.recherches-recentes')).toBe('[]')
    })

    it('ne sont pas montrées sans recherche passée', () => {
      servir({ ...ROUTES_VOYAGE })
      monter()

      expect(screen.queryByText('Dernières recherches')).toBeNull()
    })
  })

  it('propose « Tes Ensuite » en affiche, avec le titre du film', async () => {
    vi.useRealTimers()
    servir({
      ...ROUTES_VOYAGE,
      'GET /api/reference/plex': () =>
        json({ ...PLEX_VIDE, configure: true, films: [{ tmdb_id: 11, title: 'Le Bonheur', year: 1965, cover_url: null }] }),
    })
    monter()

    // Mutation : la liste « Ensuite » qui ne rend plus le film de Plex.
    expect(await screen.findByRole('heading', { name: 'Tes « Ensuite »' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Le Bonheur/ })).toBeInTheDocument()
  })

  describe('les films à voir de l’année en cours', () => {
    const A_VOIR = 'Pas encore vus, cette année du Voyage'
    const FICHE = fichePrete({
      annee: 1897,
      salles: [salle({ id: 's1', films: [filmDeSalle({ id: 'f1', tmdb_id: 4242, title: 'L’Arroseur arrosé', etat: 'sur_le_plex' })] })],
    })
    /** La carte en 1897 : l'année en cours, écrite (`visitee`) ou pas encore. */
    const carte = (visitee: boolean, ia: boolean) =>
      voyage1890(1897, [{ annee: 1897, statut: 'en_cours', visitee, recompense: null }], { ia, source: null, rattrape_la_source: false })

    // Le témoin : une année déjà ouverte se lit, et ses films pas encore vus se proposent.
    it('lit la fiche de l’année en cours déjà ouverte, et propose ses films pas encore vus', async () => {
      vi.useRealTimers()
      const requetes = servir({
        ...ROUTES_VOYAGE,
        'GET /api/me/voyage': () => json(carte(true, true)),
        'GET /api/me/voyage/annees/1897': () => json(FICHE),
      })
      monter()
      expect(await screen.findByText(A_VOIR)).toBeInTheDocument()
      expect(screen.getByText('L’Arroseur arrosé')).toBeInTheDocument()
      expect(requetes).toContain('GET /api/me/voyage/annees/1897')
    })

    // Lire une année non visitée enfile son ouverture chez le chroniqueur (au compte IA) : ouvrir la
    // recherche n'en lit aucune, et la lectrice ne lit pas une année que le Voyage suivi n'a pas
    // ouverte. Mutation : la garde `apercuLitLaFiche` retirée (`enabled` sur la seule année en cours).
    it.each([
      { cas: 'au compte IA', ia: true },
      { cas: 'à la lectrice, une année en attente du Voyage suivi', ia: false },
    ])('ne réveille pas le chroniqueur ($cas)', async ({ ia }) => {
      vi.useRealTimers()
      const requetes = servir({
        ...ROUTES_VOYAGE,
        'GET /api/me/voyage': () => json(carte(false, ia)),
        'GET /api/me/voyage/annees/1897': () => json(FICHE),
      })
      monter()
      await waitFor(() => expect(requetes).toContain('GET /api/me/voyage'))
      // Le temps que toute lecture déclenchée par la carte parte.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
      expect(requetes.some((r) => r.startsWith('GET /api/me/voyage/annees/'))).toBe(false)
      expect(screen.queryByText(A_VOIR)).toBeNull()
    })
  })
})

describe('la recherche qui attend ses résultats', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  /** Cherche « inception » ; la requête ne répond qu'au signal du test, rendu. */
  async function chercherEnAttente() {
    let liberer!: () => void
    const requetes = servir({
      ...ROUTES_VOYAGE,
      'GET /api/search?type=movie&q=inception': () => new Promise<Response>((r) => (liberer = () => r(json(RESULTATS)))),
    })
    monter()
    fireEvent.change(screen.getByLabelText('Rechercher un film'), { target: { value: 'inception' } })
    await vi.advanceTimersByTimeAsync(300)
    return { requetes, liberer: () => liberer() }
  }

  it('annonce « Recherche… » une seule fois', async () => {
    await chercherEnAttente()

    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Recherche…')
  })

  it('dessine deux rangées de trois affiches en blanc', async () => {
    await chercherEnAttente()

    expect(screen.getAllByTestId('affiche-en-attente')).toHaveLength(6)
  })

  it('garde le guichet : sa question et son champ', async () => {
    await chercherEnAttente()

    expect(screen.getByRole('heading', { level: 1, name: 'Quel film as-tu vu ?' })).toBeInTheDocument()
    expect(screen.getByLabelText('Rechercher un film')).toHaveValue('inception')
  })

  it('ne lance que la recherche, une fois : le squelette n’ajoute aucune requête', async () => {
    const { requetes } = await chercherEnAttente()

    await vi.advanceTimersByTimeAsync(500)
    expect(requetes.filter((r) => !(r in ROUTES_VOYAGE) && !r.includes('/me/voyage/annees'))).toEqual(['GET /api/search?type=movie&q=inception'])
  })

  it('à l’arrivée des résultats, le statut et les affiches en blanc s’en vont', async () => {
    const { liberer } = await chercherEnAttente()

    liberer()
    await vi.advanceTimersByTimeAsync(0)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByTestId('affiche-en-attente')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Inception/ })).toBeInTheDocument()
  })
})
