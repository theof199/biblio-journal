import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import type { JournalItem, JournalPage } from '../api/journal'
import { createQueryClient } from '../api/queryClient'
import { exemple } from '../test/contrat'
import { visionnage } from '../test/journal'
import { SESSION } from '../test/pageVoyage'
import { json, servir } from '../test/serveur'
import { fichePrete, filmDeSalle, salle, voyage1890 } from '../test/voyage'
import { oublierLeBillet, rangerLeBillet } from '../voyage/billet/range'
import stylesDuCasier from '../voyage/boite/Casier.module.css'

const VOYAGE = voyage1890(
  1897,
  [
    { annee: 1895, statut: 'ouverte', visitee: true, recompense: 'palme', profondeur: 9 },
    { annee: 1896, statut: 'ouverte', visitee: true, recompense: 'lion', profondeur: 6 },
    { annee: 1897, statut: 'en_cours', visitee: true, recompense: null, profondeur: 2 },
    { annee: 1898, statut: 'verrouillee', visitee: false, recompense: null, profondeur: 0 },
    { annee: 1899, statut: 'verrouillee', visitee: false, recompense: null, profondeur: 0 },
  ],
  { ia: true, source: null, rattrape_la_source: false, depart: 1895 },
)
const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
const JOURNAL = 'GET /api/me/journal?limit=100&sortie_min=1890&sortie_max=1899'

/** Un visionnage d'un film sorti `an`, vu le `date`, du film TMDB `tmdb`. */
const vu = (id: string, an: number, date: string, o: { titre?: string; note?: number | null; tmdb?: number; remarque?: string; reactions?: string[] } = {}) => {
  const v = visionnage({ id, media: 'm-' + id, titre: o.titre, annee: an, date, note: o.note ?? null, reactions: o.reactions })
  v.media.source = 'tmdb'
  v.media.type = 'movie'
  v.media.external_id = String(o.tmdb ?? 1000)
  v.carnet.comment = o.remarque ?? null
  return v
}

/**
 * Trois visionnages, que l'API rend **dans un autre ordre** que la boîte : du premier vu au dernier,
 * « La Sortie de l’usine » (1895, le 1er août), « L’Arroseur arrosé » (1895, le 1er septembre),
 * « L’Arrivée d’un train » (1897, le 3 septembre) ; le dernier devant, il porte le N° 0003.
 */
const SORTIE = vu('e1', 1895, '2026-08-01', { titre: 'La Sortie de l’usine', note: 7, tmdb: 774 })
const ARROSEUR = vu('e2', 1895, '2026-09-01', { titre: 'L’Arroseur arrosé', tmdb: 775, remarque: 'Revu avec Alycia, on a ri.' })
const TRAIN = vu('e3', 1897, '2026-09-03', { titre: 'L’Arrivée d’un train', note: 9, tmdb: 776 })
const TROIS = [ARROSEUR, TRAIN, SORTIE]

const journal = (items: JournalItem[]) => () => json({ ...PAGE, items, next_cursor: null })
const refus = (message: string) => () => json({ code: 'VALIDATION', message, retryable: false }, 400)

const ROUTES = {
  'GET /api/me/voyage': () => json(VOYAGE),
  [JOURNAL]: journal(TROIS),
}

/** L'adresse que l'app affiche : l'intercalaire et le billet ouvert y vivent. */
function Adresse() {
  const { pathname, search } = useLocation()
  return <output data-testid="adresse">{`${pathname}${search}`}</output>
}
const adresse = () => screen.getByTestId('adresse').textContent

/** La boîte dans l'app entière, sous la coque (comme `monterVoyage`), l'adresse lisible. */
function monter(entree: string | string[], routes: Record<string, (init: RequestInit) => Response | Promise<Response>> = ROUTES, avant?: (client: QueryClient) => void) {
  const client = createQueryClient()
  avant?.(client)
  const requetes = servir({ 'GET /api/auth/me': () => json(SESSION), ...routes })
  const entrees = Array.isArray(entree) ? entree : [entree]
  const vue = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={entrees} initialIndex={entrees.length - 1}>
        <App />
        <Adresse />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...vue, client, requetes }
}

const boite = () => screen.findByRole('heading', { level: 1, name: 'La boîte à billets' })
/** Les billets du casier ouvert, dans l'ordre de la page. */
const billets = async () => within(await screen.findByRole('list', { name: 'Les billets' })).getAllByRole('button')
const billet = (titre: RegExp) => screen.getByRole('button', { name: titre })

describe('la boîte à billets', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    oublierLeBillet()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    oublierLeBillet()
  })

  // Mutation : une lecture de fiche ajoutée (`GET …/annees/1897`, qui enfilerait une ouverture chez
  // le chroniqueur) ; `journalComplet` à la place de mes films de la décennie. Ouvrir un billet sans
  // réaction ne lit rien de plus.
  it('ne lit que la carte et mes films de la décennie', async () => {
    const { requetes } = monter('/voyage/decennies/1890/billets')
    await boite()
    fireEvent.click((await billets())[0]!)
    await screen.findByRole('dialog')
    expect(requetes.filter((r) => r !== 'GET /api/auth/me').sort()).toEqual(['GET /api/me/voyage', JOURNAL].sort())
  })

  // Mutation : `decennieDeLAdresse` contournée (`Number(param)`).
  it.each(['1895', '1880', 'abc'])('ramène à la carte une adresse qui n’est pas une décennie (%s)', async (d) => {
    monter(`/voyage/decennies/${d}/billets`, { ...ROUTES, 'GET /api/me/voyage/tickets': () => json({ tickets: [] }) })
    expect(await screen.findByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
    expect(adresse()).toBe('/voyage')
  })

  // Mutations : `casier` contourné (l'ordre de l'API, ou la boîte sans la retourner).
  it('numérote les billets du premier vu au dernier, le dernier devant', async () => {
    monter('/voyage/decennies/1890/billets')
    const lignes = (await billets()).map((b) => b.textContent)
    expect(lignes).toHaveLength(3)
    expect(lignes[0]).toMatch(/^N° 0003L’Arrivée d’un train3 septembre 2026 · 9\/10/)
    expect(lignes[1]).toMatch(/^N° 0002L’Arroseur arrosé1er septembre 2026/)
    expect(lignes[2]).toMatch(/^N° 0001La Sortie de l’usine1er août 2026 · 7\/10/)
    expect(screen.getByText('3 billets, un par visionnage')).toBeInTheDocument()
  })

  // Mutation : le filtre de l'intercalaire retiré (`casier(billets, null)`) ; l'intercalaire hors de
  // l'adresse ; l'adresse poussée au lieu d'être remplacée (le « retour » repasserait chaque intercalaire).
  it('un intercalaire n’ouvre que les billets de son année, et vit dans l’adresse', async () => {
    monter(['/voyage/decennies/1890', '/voyage/decennies/1890/billets'], { ...ROUTES, 'GET /api/me/voyage/tickets': () => json({ tickets: [] }) })
    await billets()
    const intercalaires = within(screen.getByRole('group', { name: 'Les intercalaires' }))
    expect(intercalaires.getAllByRole('button').map((b) => b.textContent)).toEqual(['Tous', '1895', '1896', '1897', '1898', '1899'])

    fireEvent.click(intercalaires.getByRole('button', { name: /^1895/ }))
    expect(intercalaires.getByRole('button', { name: /^1895/ })).toHaveAttribute('aria-pressed', 'true')
    expect((await billets()).map((b) => b.textContent)).toEqual([expect.stringMatching(/^N° 0002L’Arroseur/), expect.stringMatching(/^N° 0001La Sortie/)])
    expect(adresse()).toBe('/voyage/decennies/1890/billets?annee=1895')

    fireEvent.click(intercalaires.getByRole('button', { name: /^1896/ }))
    expect(screen.getByText('Aucun billet pour cette année.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Les billets' })).not.toBeInTheDocument()

    // Remplacée, pas empilée : le retour quitte la boîte d'un seul geste.
    fireEvent.click(screen.getByRole('link', { name: 'Retour aux années 1890' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Années 1890' })).toBeInTheDocument()
  })

  // Le jumeau de l'écriture : une adresse qui porte déjà l'intercalaire l'ouvre.
  it('ouvre l’intercalaire que porte l’adresse', async () => {
    monter('/voyage/decennies/1890/billets?annee=1897')
    expect((await billets()).map((b) => b.textContent)).toEqual([expect.stringMatching(/^N° 0003L’Arrivée/)])
  })

  // Mutations : la remarque tue ; Échap sans effet ; le focus laissé sur la page.
  it('ouvre un billet en grand, avec la remarque privée, et le ferme à Échap', async () => {
    monter('/voyage/decennies/1890/billets')
    await billets()
    fireEvent.click(billet(/L’Arroseur arrosé/))
    const dialogue = await screen.findByRole('dialog', { name: 'L’Arroseur arrosé' })
    expect(within(dialogue).getByText('N° 0002')).toBeInTheDocument()
    expect(within(dialogue).getByText('1er septembre 2026')).toBeInTheDocument()
    expect(within(dialogue).getByText('sans note')).toBeInTheDocument()
    expect(within(dialogue).getByText('Revu avec Alycia, on a ri.')).toBeInTheDocument()
    expect(within(dialogue).getByRole('button', { name: 'Ranger le billet' })).toHaveFocus()
    expect(adresse()).toBe('/voyage/decennies/1890/billets?billet=e2')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(adresse()).toBe('/voyage/decennies/1890/billets')
  })

  // Mutation : le catalogue des réactions lu à l'ouverture de la boîte (sans `enabled`) ; les clés
  // montrées telles quelles, le catalogue lu.
  it('dit les réactions d’un billet par leur phrase, en ne lisant le catalogue qu’à son ouverture', async () => {
    const reactions = exemple<unknown>('/reference/reactions', 'get', 200)
    const avecReactions = vu('e4', 1896, '2026-09-02', { titre: 'Le Déjeuner de bébé', reactions: ['adore', 'en_salle'] })
    const { requetes } = monter('/voyage/decennies/1890/billets', { ...ROUTES, [JOURNAL]: journal([...TROIS, avecReactions]), 'GET /api/reference/reactions': () => json(reactions) })
    await billets()
    expect(requetes).not.toContain('GET /api/reference/reactions')
    fireEvent.click(billet(/Le Déjeuner de bébé/))
    const liste = within(await screen.findByRole('list', { name: 'Tes réactions' }))
    expect(await liste.findByText('❤️ J’ai adoré')).toBeInTheDocument()
    expect(liste.getByText('🎬 En salle')).toBeInTheDocument()
  })

  // Mutations : `oublierLeBillet` retiré (montré à chaque ouverture) ; le membre ignoré (un billet
  // rangé pour un autre compte montré quand même) ; son casier qui ne s'ouvre pas.
  it('le billet rangé est mis en avant une fois, et son casier s’ouvre', async () => {
    rangerLeBillet(SESSION.user.id, 'e2')
    const premiere = monter('/voyage/decennies/1890/billets?annee=1897')
    await waitFor(() => expect(adresse()).toBe('/voyage/decennies/1890/billets?annee=1895'))
    await waitFor(() => expect(billet(/L’Arroseur arrosé/)).toHaveClass(stylesDuCasier.nouveau!))
    expect(billet(/L’Arroseur arrosé/)).toHaveAccessibleName(/rangé à l’instant$/)
    expect(billet(/La Sortie de l’usine/)).not.toHaveClass(stylesDuCasier.nouveau!)
    premiere.unmount()

    monter('/voyage/decennies/1890/billets?annee=1895')
    await billets()
    expect(billet(/L’Arroseur arrosé/)).not.toHaveClass(stylesDuCasier.nouveau!)
  })

  it('un billet rangé pour un autre membre n’est pas mis en avant', async () => {
    rangerLeBillet('un-autre-membre', 'e2')
    monter('/voyage/decennies/1890/billets')
    await billets()
    expect(billet(/L’Arroseur arrosé/)).not.toHaveClass(stylesDuCasier.nouveau!)
  })

  // Mutation : le billet rangé oublié par une boîte qui ne le porte pas (celle des années 1900
  // l'oublierait avant que celle des années 1890 ne le montre).
  it('une boîte qui ne porte pas le billet rangé le laisse à la sienne', async () => {
    rangerLeBillet(SESSION.user.id, 'e2')
    const autre = monter('/voyage/decennies/1890/billets', { ...ROUTES, [JOURNAL]: journal([SORTIE, TRAIN]) })
    await billets()
    autre.unmount()
    monter('/voyage/decennies/1890/billets')
    await waitFor(() => expect(billet(/L’Arroseur arrosé/)).toHaveClass(stylesDuCasier.nouveau!))
  })

  // Mutation : le calque ouvert sur rien (un dialogue vide), ou jamais refermé dans l'adresse.
  it('un billet inconnu dans l’adresse se ferme', async () => {
    monter('/voyage/decennies/1890/billets?billet=inconnu')
    await billets()
    await waitFor(() => expect(adresse()).toBe('/voyage/decennies/1890/billets'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // Mutations : le lien offert sans fiche en cache (vers un film deviné) ; le lien jamais offert.
  it('offre de corriger un billet seulement quand la fiche de son année est déjà lue', async () => {
    const fiche = fichePrete({ annee: 1897, salles: [salle({ id: 's1', films: [filmDeSalle({ id: 'f-train', tmdb_id: 776 })] })] })
    const avec = monter('/voyage/decennies/1890/billets?billet=e3', ROUTES, (client) => client.setQueryData(cles.annee(1897), fiche))
    const corriger = await screen.findByRole('link', { name: 'Corriger le billet' })
    expect(corriger).toHaveAttribute('href', '/voyage/1897/films/f-train/billet/corriger')
    avec.unmount()

    monter('/voyage/decennies/1890/billets?billet=e3')
    await screen.findByRole('dialog', { name: 'L’Arrivée d’un train' })
    expect(screen.queryByRole('link', { name: 'Corriger le billet' })).not.toBeInTheDocument()
  })

  // Mutations : un message générique à la place de celui de l'API ; « Réessayer » sans effet.
  it('une panne du journal s’affiche telle que l’API l’a écrite, et se retente', async () => {
    let refuse = true
    monter('/voyage/decennies/1890/billets', { ...ROUTES, [JOURNAL]: () => (refuse ? refus('Le journal s’est égaré.')() : journal(TROIS)()) })
    expect(await screen.findByText('Le journal s’est égaré.')).toBeInTheDocument()
    refuse = false
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await billets()).toHaveLength(3)
  })

  // Mutation : `useRevenir` remplacé par un simple lien (la décennie s'empilerait devant la boîte),
  // ou par un recul sans condition (rien derrière : rien ne se passerait).
  it('le retour mène à la décennie quand rien n’est derrière', async () => {
    monter('/voyage/decennies/1890/billets', { ...ROUTES, 'GET /api/me/voyage/tickets': () => json({ tickets: [] }) })
    await boite()
    const retour = screen.getByRole('link', { name: 'Retour aux années 1890' })
    expect(retour).toHaveAttribute('href', '/voyage/decennies/1890')
    fireEvent.click(retour)
    expect(await screen.findByRole('heading', { level: 1, name: 'Années 1890' })).toBeInTheDocument()
  })
})
