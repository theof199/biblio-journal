import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import type { JournalItem, JournalPage } from '../api/journal'
import { createQueryClient } from '../api/queryClient'
import { PAGES_1890 } from '../mondes/1890/pages'
import { PAGES_1900 } from '../mondes/1900/pages'
import { PAGES_A_VENIR } from '../mondes/avenir/pages'
import { exemple } from '../test/contrat'
import { visionnage } from '../test/journal'
import { SESSION } from '../test/pageVoyage'
import { json, servir } from '../test/serveur'
import { fichePrete, filmDeSalle, salle, voyage1890 } from '../test/voyage'
import { oublierLeBillet, rangerLeBillet } from '../voyage/billet/range'
import { anneeCivile } from '../voyage/decennie'
import { decennieDe } from '../voyage/regles'
import stylesDuCasier from '../voyage/boite/Casier.module.css'
import FEUILLE_DU_CASIER from '../voyage/boite/Casier.module.css?raw'
import FEUILLE_DE_LA_VISIONNEUSE from '../voyage/boite/Visionneuse.module.css?raw'

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
  it.each(['1895', '1880', 'abc', String(decennieDe(anneeCivile()) + 10)])('ramène à la carte une adresse qui n’est pas une décennie (%s)', async (d) => {
    monter(`/voyage/decennies/${d}/billets`, { ...ROUTES, 'GET /api/me/voyage/tickets': () => json({ tickets: [] }) })
    expect(await screen.findByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
    expect(adresse()).toBe('/voyage')
  })

  // L'habillage vient du monde de la décennie, par le registre. Mutations : le monde de 1890 en dur
  // (`mondes(1890)`) ; les jetons retirés de la racine.
  it.each([
    [1890, PAGES_1890],
    [1900, PAGES_1900],
    [1910, PAGES_A_VENIR],
  ])('s’habille du monde de sa décennie (%i)', async (d, pages) => {
    monter(`/voyage/decennies/${d}/billets`, { ...ROUTES, [`GET /api/me/journal?limit=100&sortie_min=${d}&sortie_max=${d + 9}`]: journal([]) })
    expect(await screen.findByRole('heading', { level: 1, name: pages.mots.boite.titre })).toBeInTheDocument()
    const racine = screen.getByRole('region', { name: `${pages.mots.boite.titre}, années ${d}` })
    expect(racine.style.getPropertyValue('--m-papier')).toBe(pages.jetons['--m-papier'])
    expect(racine.style.getPropertyValue('--m-f-affiche')).toBe(pages.jetons['--m-f-affiche'])
    expect(await screen.findByText('Aucun billet encore')).toBeInTheDocument()
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

  // Le pied lit la boîte dans l'ordre des numéros, pas celui du casier (le dernier devant).
  // Mutations : le premier billet pris en tête du casier ; le dernier pris au début de la boîte.
  it('le pied dit le premier billet et le numéro du dernier', async () => {
    monter('/voyage/decennies/1890/billets')
    await billets()
    expect(screen.getByText(/^Premier billet/)).toHaveTextContent('Premier billet : N° 0001, le 1er août 2026, La Sortie de l’usine.Le dernier porte le N° 0003.')
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

    // « Tous » rouvre toute la boîte et retire l'intercalaire de l'adresse. Mutation : « Tous » sans effet.
    fireEvent.click(intercalaires.getByRole('button', { name: 'Tous' }))
    expect(intercalaires.getByRole('button', { name: 'Tous' })).toHaveAttribute('aria-pressed', 'true')
    expect(await billets()).toHaveLength(3)
    expect(adresse()).toBe('/voyage/decennies/1890/billets')

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

  // Le grand « VU » se posait en absolu au bas du billet, sur la remarque privée qu'il cachait en
  // partie (relecture de la tâche 7). Il flotte désormais à côté d'elle : le texte l'entoure, sans
  // jamais passer dessous. Mutations : le tampon remis en `position: absolute` ; sorti du bloc de
  // la remarque (le texte ne l'entourerait plus).
  it('le grand « VU » ne recouvre pas la remarque privée : il flotte à côté, le texte l’entoure', async () => {
    monter('/voyage/decennies/1890/billets?billet=e2')
    const dialogue = await screen.findByRole('dialog', { name: 'L’Arroseur arrosé' })
    const remarque = within(dialogue).getByText('Revu avec Alycia, on a ri.')
    const vu = within(dialogue).getByText(PAGES_1890.mots.billet.tampon)
    // Le tampon précède le texte dans le même bloc : un flottant que le texte contourne.
    expect(remarque.contains(vu)).toBe(true)
    expect(vu.compareDocumentPosition(remarque.lastChild!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const debut = FEUILLE_DE_LA_VISIONNEUSE.indexOf('.tampon {')
    const regle = FEUILLE_DE_LA_VISIONNEUSE.slice(debut, FEUILLE_DE_LA_VISIONNEUSE.indexOf('}', debut))
    expect(debut).toBeGreaterThanOrEqual(0)
    expect(regle).toMatch(/float:\s*right/)
    expect(regle).not.toMatch(/position:\s*absolute/)
  })

  // Un dialogue rend le focus au billet qui l'a ouvert, une fois rangé. Mutation : le casier remonté
  // à l'ouverture du billet (une clé qui suit `?billet=`), qui perd l'élément à qui rendre le focus.
  it('rend le focus, une fois le billet rangé, au billet touché', async () => {
    monter('/voyage/decennies/1890/billets')
    await billets()
    billet(/L’Arroseur arrosé/).focus()
    fireEvent.click(billet(/L’Arroseur arrosé/))
    const dialogue = await screen.findByRole('dialog', { name: 'L’Arroseur arrosé' })
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Ranger le billet' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(billet(/L’Arroseur arrosé/)).toHaveFocus()
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

  // La carte qui répond après le journal (son cache passé, une autre lecture en cours) : tant que les
  // intercalaires ne sont pas là, l'intercalaire de l'adresse n'est pas encore choisi. Mutation : le
  // billet rangé traité, et oublié, dès que le journal le porte, la carte encore attendue (le casier
  // de 1897 restait ouvert, sans lui).
  it('le billet rangé attend la carte pour ouvrir son casier', async () => {
    rangerLeBillet(SESSION.user.id, 'e2')
    let carte: (r: Response) => void = () => undefined
    const { client } = monter('/voyage/decennies/1890/billets?annee=1897', { ...ROUTES, 'GET /api/me/voyage': () => new Promise<Response>((r) => (carte = r)) })
    await waitFor(() => expect(client.getQueryData(cles.journalDesAnnees(1890, 1899))).toBeDefined())
    await new Promise((r) => setTimeout(r, 20))
    carte(json(VOYAGE))
    await waitFor(() => expect(adresse()).toBe('/voyage/decennies/1890/billets?annee=1895'))
    await waitFor(() => expect(billet(/L’Arroseur arrosé/)).toHaveClass(stylesDuCasier.nouveau!))
  })

  // La boîte commence au départ du Voyage (décision du propriétaire du 1er octobre 2026, 2c-1) : un
  // film sorti en 1892, vu avant tous les autres, n'a ni billet ni numéro, sous « Tous » comme dans le
  // pied, et le premier billet reste « La Sortie de l’usine ». Rangé par une séance, il n'est pas mis
  // en avant. Mutation : `billetsDeLaDecennie` bornée à la décennie seule (1890) au lieu du départ.
  it('ne porte aucun film d’avant le départ du Voyage, ni dans « Tous » ni dans le pied', async () => {
    const pierrot = vu('e0', 1892, '2026-07-20', { titre: 'Pauvre Pierrot', tmdb: 770 })
    rangerLeBillet(SESSION.user.id, 'e0')
    monter('/voyage/decennies/1890/billets', { ...ROUTES, [JOURNAL]: journal([...TROIS, pierrot]) })
    const lignes = (await billets()).map((b) => b.textContent)
    expect(lignes).toHaveLength(3)
    expect(lignes[2]).toMatch(/^N° 0001La Sortie de l’usine/)
    expect(screen.queryByText(/Pauvre Pierrot/)).not.toBeInTheDocument()
    expect(screen.getByText('3 billets, un par visionnage')).toBeInTheDocument()
    expect(screen.getByText(/^Premier billet/)).toHaveTextContent('Premier billet : N° 0001, le 1er août 2026, La Sortie de l’usine.Le dernier porte le N° 0003.')
  })

  it('un billet rangé pour un autre membre n’est pas mis en avant', async () => {
    rangerLeBillet('un-autre-membre', 'e2')
    monter('/voyage/decennies/1890/billets')
    await billets()
    expect(billet(/L’Arroseur arrosé/)).not.toHaveClass(stylesDuCasier.nouveau!)
  })

  // Mutation : le billet rangé oublié par une boîte qui ne le porte pas (celle d'une autre décennie,
  // ici un journal qui ne l'a pas encore, l'oublierait avant que la sienne ne le montre).
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

  // Mutations : le lien offert sans fiche en cache (vers un film deviné) ; le lien jamais offert ;
  // le lien sans l'entrée dans son état (le billet de correction n'aurait rien à corriger : il
  // n'existe pas de `GET /me/journal/{id}`).
  it('offre de corriger un billet seulement quand la fiche de son année est déjà lue', async () => {
    const fiche = fichePrete({ annee: 1897, salles: [salle({ id: 's1', films: [filmDeSalle({ id: 'f-train', tmdb_id: 776, title: 'L’Arrivée d’un train' })] })] })
    monter('/voyage/decennies/1890/billets?billet=e3')
    const dialogue = await screen.findByRole('dialog', { name: 'L’Arrivée d’un train' })
    expect(within(dialogue).getByText('9 sur 10')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Corriger le billet' })).not.toBeInTheDocument()
    cleanup()

    monter('/voyage/decennies/1890/billets?billet=e3', { ...ROUTES, 'GET /api/me/voyage/annees/1897': () => json(fiche), 'GET /api/reference/reactions': () => json(exemple('/reference/reactions', 'get', 200)) }, (client) =>
      client.setQueryData(cles.annee(1897), fiche),
    )
    const corriger = await screen.findByRole('link', { name: 'Corriger le billet' })
    expect(corriger).toHaveAttribute('href', '/voyage/1897/films/f-train/billet/corriger')
    fireEvent.click(corriger)
    expect(await screen.findByRole('heading', { level: 1, name: 'L’Arrivée d’un train' })).toBeInTheDocument()
    expect(screen.queryByText('Ce visionnage n’est plus disponible.')).not.toBeInTheDocument()
  })

  // Le parcours de deux tâches (la boîte, le billet de correction) : effacé, le billet recule vers la
  // boîte, sur l'adresse qui l'ouvrait en grand (`?billet=e3`). La boîte ne doit pas l'y rouvrir
  // depuis son cache, le temps que le journal soit relu (ici, jamais : la relecture ne répond pas).
  // Mutation : l'entrée effacée laissée dans les listes du journal en cache.
  it('un billet effacé depuis la boîte n’y reparaît pas en grand, même avant que le journal soit relu', async () => {
    const fiche = fichePrete({ annee: 1897, salles: [salle({ id: 's1', films: [filmDeSalle({ id: 'f-train', tmdb_id: 776, title: 'L’Arrivée d’un train' })] })] })
    let lectures = 0
    let effacements = 0
    monter(
      '/voyage/decennies/1890/billets',
      {
        ...ROUTES,
        [JOURNAL]: () => ((lectures += 1), lectures === 1 ? journal(TROIS)() : new Promise<Response>(() => undefined)),
        'GET /api/me/voyage/annees/1897': () => json(fiche),
        'GET /api/reference/reactions': () => json(exemple('/reference/reactions', 'get', 200)),
        'DELETE /api/me/journal/e3': () => ((effacements += 1), new Response(null, { status: 204 })),
      },
      (client) => client.setQueryData(cles.annee(1897), fiche),
    )
    await billets()
    fireEvent.click(billet(/L’Arrivée d’un train/))
    fireEvent.click(await screen.findByRole('link', { name: 'Corriger le billet' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    await boite()
    await waitFor(() => expect(adresse()).toBe('/voyage/decennies/1890/billets'))
    expect(effacements).toBe(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((await billets()).map((b) => b.textContent)).not.toContainEqual(expect.stringContaining('L’Arrivée d’un train'))
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

  // Le jumeau, pour la carte (le départ du Voyage fait les intercalaires). Mutations : « Réessayer »
  // qui ne relit que le journal ; la panne de la carte tue.
  it('une panne de la carte s’affiche telle que l’API l’a écrite, et se retente', async () => {
    let refuse = true
    monter('/voyage/decennies/1890/billets', { ...ROUTES, 'GET /api/me/voyage': () => (refuse ? refus('La carte s’est déchirée.')() : json(VOYAGE)) })
    expect(await screen.findByText('La carte s’est déchirée.')).toBeInTheDocument()
    refuse = false
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await billets()).toHaveLength(3)
  })

  // Le liseré dit un billet rangé, pas un geste du joueur : l'or du monde, jamais le corail, et rien
  // qui tombe au calme. Mutations : `var(--corail)` dans le liseré ; la règle du calme retirée.
  it('borde le billet rangé de l’or du monde, jamais du corail', () => {
    const regle = (selecteur: string) => {
      const debut = FEUILLE_DU_CASIER.indexOf(`${selecteur} {`)
      return debut < 0 ? '' : FEUILLE_DU_CASIER.slice(debut, FEUILLE_DU_CASIER.indexOf('}', debut))
    }
    expect(FEUILLE_DU_CASIER).not.toMatch(/--corail/)
    expect(regle('.nouveau')).toMatch(/box-shadow:\s*0 0 0 2px var\(--m-or\)/)
    const calme = FEUILLE_DU_CASIER.slice(FEUILLE_DU_CASIER.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(calme).toMatch(/\.nouveau\s*\{\s*animation:\s*none/)
  })

  // Mutation : un simple lien vers la décennie au lieu de `useRevenir` (la décennie s'empilerait
  // devant la page quittée, et le geste « retour » du téléphone ramènerait à la boîte).
  it('le retour recule dans l’historique quand il y a de quoi', async () => {
    monter(['/voyage', '/voyage/decennies/1890/billets'], { ...ROUTES, 'GET /api/me/voyage/tickets': () => json({ tickets: [] }) })
    await boite()
    fireEvent.click(screen.getByRole('link', { name: 'Retour aux années 1890' }))
    expect(await screen.findByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
  })

  // Mutation : un recul sans condition (rien derrière : rien ne se passerait).
  it('le retour mène à la décennie quand rien n’est derrière', async () => {
    monter('/voyage/decennies/1890/billets', { ...ROUTES, 'GET /api/me/voyage/tickets': () => json({ tickets: [] }) })
    await boite()
    const retour = screen.getByRole('link', { name: 'Retour aux années 1890' })
    expect(retour).toHaveAttribute('href', '/voyage/decennies/1890')
    fireEvent.click(retour)
    expect(await screen.findByRole('heading', { level: 1, name: 'Années 1890' })).toBeInTheDocument()
  })
})
