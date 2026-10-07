import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Depenses, TicketUtilise, Tickets, Voyage } from '../../../api/voyage'
import { exemple } from '../../../test/contrat'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { voyage1890 } from '../../../test/voyage'
import { PAGES_1890 } from '../../1890/pages'
import { PAGES_1900 } from '../pages'
import { MOTS_DE_LA_SACOCHE as M, compteDeLAnneau, etatDeLaPage, libelleDUtiliser, partDeLAnneau } from './sacoche'

/**
 * La sacoche du voyageur des années 1900 (plan des pages 1900, brief 10 ; maquette, écran 15) : la
 * page montée dans l'app entière, le monde n'y arrive que par le registre. Les tests de
 * `pages/VoyageSacoche.test.tsx`, montés sur 1890, tiennent le défaut ; ceux-ci tiennent ce que 1900
 * en fait, et ce qu'il n'en fait pas encore (la malle, le courrier, les objets trouvés).
 */
const SACOCHE = '/voyage/sacoche'
const CARTE = 'GET /api/me/voyage'
const TICKETS = 'GET /api/me/voyage/tickets'
const DEPENSES = 'GET /api/me/voyage/depenses'
const UTILISER = 'POST /api/me/voyage/tickets/1904/utiliser'

/** Les années 1890 bouclées et tamponnées, trois gares de 1900 récompensées, la quatrième en cours. */
const VOYAGE: Voyage = voyage1890(
  1903,
  [
    ...[1895, 1896, 1897, 1898, 1899].map((a) => ({ annee: a, statut: 'ouverte' as const, visitee: true, recompense: 'ours' as const })),
    { annee: 1900, statut: 'ouverte', visitee: true, recompense: 'lion' },
    { annee: 1901, statut: 'ouverte', visitee: true, recompense: 'ours' },
    { annee: 1902, statut: 'ouverte', visitee: true, recompense: 'palme' },
    { annee: 1903, statut: 'en_cours', visitee: true, recompense: null },
    { annee: 1904, statut: 'verrouillee', visitee: false, recompense: null },
  ],
  { ia: true, source: null, tampons: [{ decennie: 1890, boucle_le: '2026-03-14T12:00:00.000Z' }] },
)
/** Dix ans plus loin : les années 1900 tamponnées à leur tour, la sacoche est celle d'un monde « à venir ». */
const EN_1910: Voyage = {
  ...VOYAGE,
  annee_en_cours: 1910,
  tampons: [...VOYAGE.tampons, { decennie: 1900, boucle_le: '2026-09-12T12:00:00.000Z' }],
}
const ticket = (a: number, utiliseLe: string | null = null): Tickets['tickets'][number] => ({ annee: a, motif: `${a - 1} est bouclée, ${a} t’attend.`, emis_le: '2026-09-01T18:00:00.000Z', montre_le: null, utilise_le: utiliseLe })
/** Dans l'ordre de l'API : l'utilisé d'abord. 1904 est offert (l'année qui suit 1903), 1905 attend son tour. */
const TROIS_TICKETS: Tickets = { tickets: [ticket(1903, '2026-08-30T23:30:00.000Z'), ticket(1904), ticket(1905)] }
const DEPENSES_IA = exemple<Depenses>('/me/voyage/depenses', 'get', 200)
const ROUTES = { [CARTE]: () => json(VOYAGE), [TICKETS]: () => json(TROIS_TICKETS), [DEPENSES]: () => json(DEPENSES_IA) }
// `retryable: false` : une panne relancée par TanStack attendrait trois secondes avant de se dire.
const panne = (message: string) => () => json({ code: 'VALIDATION_ERROR', message, retryable: false }, 400)

const region = (nom: string) => screen.findByRole('region', { name: nom })
const sacoche = () => screen.findByRole('heading', { level: 1, name: M.titre })
const tickets = async () => within(await within(await region('Portefeuille')).findByRole('list')).getAllByRole('listitem')
const deplier = async () => fireEvent.click(within(await region(M.coulisses.titre)).getByRole('button', { name: M.coulisses.titre }))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-29T12:00:00.000Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  // Rend `TZ` tel qu'il était : Node le relit à chaque affectation.
  vi.unstubAllEnvs()
})

describe('les règles de la sacoche 1900', () => {
  // Mutations : la garde d'une décennie sans année retirée de `partDeLAnneau` (`0 / 0` : l'anneau
  // tracerait `NaN`) ; son plafond retiré ; les deux mots de `etatDeLaPage` échangés.
  it('l’anneau dit son compte et sa part, la page son état, le geste son nom', () => {
    expect(compteDeLAnneau({ faites: 4, total: 10 })).toBe('4/10')
    expect([{ faites: 4, total: 10 }, { faites: 0, total: 0 }, { faites: 12, total: 10 }].map(partDeLAnneau)).toEqual([0.4, 0, 1])
    expect([etatDeLaPage(null), etatDeLaPage({ decennie: 1900, boucle_le: '2026-09-12T12:00:00.000Z' })]).toEqual(['En cours', 'Tampon posé'])
    expect(libelleDUtiliser(1905)).toBe('Utiliser le ticket pour 1905')
  })
})

describe('la sacoche du voyageur en 1900', () => {
  // Mutations : `teteDeLaSacoche` retiré des gabarits de 1900 (la tête par défaut revient) ; le titre
  // du rabat rendu en `<b>` comme la maquette (la page n'aurait plus de titre de niveau 1).
  it('est de cuir : le rabat porte le titre de la page et le nom de la compagnie, aux jetons de 1900', async () => {
    monterVoyage(SACOCHE, ROUTES)
    const titre = await sacoche()
    expect(screen.getAllByRole('heading', { level: 1 })).toEqual([titre])
    expect(screen.getByText(M.compagnie)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'La sacoche du voyageur' })).toBeNull()
    const page = screen.getByRole('region', { name: 'La sacoche du voyageur' })
    expect(page.style.getPropertyValue('--m-velours')).toBe(PAGES_1900.jetons['--m-velours'])
    expect(screen.getByRole('link', { name: 'Retour à la carte' })).toHaveAttribute('href', '/voyage')
  })

  // Le brief 10 laisse de côté la malle (lot Étiquettes), le courrier (lot À deux) et les objets
  // trouvés (lot Objets) : aucune rubrique vide ne les annonce, et rien ne lit leur état. Mutations :
  // la section de la maquette portée telle quelle (une `Rubrique` « La malle » dans le cadre du
  // passeport, « Le courrier » ou « Les objets trouvés » dans le portefeuille) ; une lecture de
  // `GET /me/voyage/voyageur` ou d'une fiche d'année ajoutée à la page.
  it('ne montre que trois rubriques, le passeport, le portefeuille et les coulisses : ni malle, ni courrier, ni objets trouvés, et ne lit que la carte, les tickets et, au dépli, les dépenses', async () => {
    const { requetes } = monterVoyage(SACOCHE, ROUTES)
    await sacoche()
    await tickets()
    const page = screen.getByRole('region', { name: 'La sacoche du voyageur' })
    // Le signe du pli, à côté du titre des coulisses, ne se lit pas : il n'est pas du titre.
    const rubriques = () => within(page).getAllByRole('heading', { level: 2 }).map((h) => h.textContent?.replace(/[▸▾]$/, ''))
    expect(rubriques()).toEqual(['Le passeport une page par décennie', 'Le portefeuille les tickets', 'Les coulisses'])
    expect(page).not.toHaveTextContent(/malle|étiquette|courrier|carte postale|objets? trouvés?|à trouver/i)

    await deplier()
    await region(M.coulisses.depenses)
    await new Promise((r) => setTimeout(r, 50))
    expect(rubriques()).toEqual(['Le passeport une page par décennie', 'Le portefeuille les tickets', 'Les coulisses'])
    expect(within(page).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([M.coulisses.depenses, M.coulisses.credits])
    const duVoyage = requetes.filter((r) => r.includes('/me/voyage'))
    expect(new Set(duVoyage)).toEqual(new Set([CARTE, TICKETS, DEPENSES]))
    expect(requetes.filter((r) => /\/annees|\/voyageur|\/etiquettes|\/objets|\/rubriques/.test(r))).toEqual([])
  })

  // Chaque page du passeport est dessinée par le monde de **sa** décennie. Mutations : dans
  // `Passeport.tsx`, un seul monde pour toutes les pages (`mondes(decennieDe(v.annee_en_cours))` : la
  // page des années 1890 passerait au papier de 1900, sous le nom « Le voyage immobile ») ; dans le
  // cadre de 1900, les jetons de 1900 reposés sur chaque `li`.
  it('la page des années 1890 reste celle de la foire, sur son velours ; celle des années 1900 est de papier, son anneau au cœur', async () => {
    monterVoyage(SACOCHE, ROUTES)
    const passeport = await region('Passeport')
    const pages = await waitFor(() => {
      const liens = within(passeport).getAllByRole('link')
      expect(liens.map((a) => a.getAttribute('href'))).toEqual(['/voyage/decennies/1890', '/voyage/decennies/1900'])
      return liens
    })
    const [foire, train] = pages as [HTMLElement, HTMLElement]

    expect(foire.style.getPropertyValue('--m-velours')).toBe(PAGES_1890.jetons['--m-velours'])
    expect(foire.style.getPropertyValue('--m-f-affiche')).toBe(PAGES_1890.jetons['--m-f-affiche'])
    expect(foire).toHaveTextContent('Les origines')
    expect(foire).toHaveTextContent('Spectateur des origines')
    expect(foire).toHaveTextContent('14 mars 2026')
    expect(foire).not.toHaveTextContent(new RegExp(`${M.page.pose}|${M.page.enCours}|${M.page.recompenses}|Le voyage immobile`))
    // Aucun jeton de 1900 n'est reposé entre la sacoche et la page de 1890.
    expect(foire.closest('li')!.style.getPropertyValue('--m-velours')).toBe('')

    expect(train.style.getPropertyValue('--m-papier')).toBe(PAGES_1900.jetons['--m-papier'])
    expect(train.style.getPropertyValue('--m-velours')).toBe(PAGES_1900.jetons['--m-velours'])
    expect(train).toHaveTextContent('Années 1900')
    expect(train).toHaveTextContent('Le voyage immobile')
    expect(within(train).getByText('3/10')).toBeInTheDocument()
    expect(within(train).getByText('3 années sur 10')).toBeInTheDocument()
    expect(within(train).getByText(M.page.enCours)).toBeInTheDocument()
    expect(within(train).queryByText(M.page.pose)).toBeNull()
  })

  // La page de 1900 pose ses jetons sur elle : la sacoche d'un autre monde la montre telle quelle.
  // Mutations : `style` retiré de `PageDeLaSacoche` (elle prendrait le costume du monde « à venir ») ;
  // l'anneau gardé sous le tampon ; « Tampon posé » dit d'après l'anneau plein et non d'après le tampon.
  it('en 1910, dans la sacoche d’un autre monde, la page des années 1900 garde son papier et porte son tampon', async () => {
    monterVoyage(SACOCHE, { ...ROUTES, [CARTE]: () => json(EN_1910), [TICKETS]: () => json({ tickets: [] }) })
    // La sacoche, elle, est celle du défaut.
    expect(await screen.findByRole('heading', { level: 1, name: 'La sacoche du voyageur' })).toBeInTheDocument()
    const passeport = await region('Passeport')
    const train = await within(passeport).findByRole('link', { name: /Années 1900/ })
    expect(within(passeport).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/voyage/decennies/1890', '/voyage/decennies/1900', '/voyage/decennies/1910'])
    expect(train.style.getPropertyValue('--m-papier')).toBe(PAGES_1900.jetons['--m-papier'])
    expect(within(train).getByText(M.page.pose)).toBeInTheDocument()
    expect(train).toHaveTextContent('Spectateur du voyage immobile')
    expect(train).toHaveTextContent('12 septembre 2026')
    expect(within(train).queryByText(M.page.enCours)).toBeNull()
    expect(within(train).queryByText(/\d\/10/)).toBeNull()
    expect(train).not.toHaveTextContent(/années? sur/)
  })

  // Mutations, dans le dessin de 1900 : le bouton posé sur tout ticket non utilisé
  // (`t.utilise_le === null`, 1905 en gagne un) ; `disabled` retiré ; le jour d'un ticket utilisé lu
  // sans `jourDeParis` (le 30 août, sous `TZ=UTC`) ; le motif d'un ticket à utiliser retiré.
  it('« Utiliser » ne s’offre que sur le ticket que la carte offre ; un ticket utilisé pâlit et dit son jour, à Paris', async () => {
    vi.stubEnv('TZ', 'UTC')
    let liberer!: (r: Response) => void
    const { requetes } = monterVoyage(['/voyage', SACOCHE], { ...ROUTES, [UTILISER]: () => new Promise<Response>((r) => (liberer = r)) })
    const portefeuille = await region('Portefeuille')
    const [offert, attend, utilise] = (await tickets()) as [HTMLElement, HTMLElement, HTMLElement]
    await waitFor(() => expect(within(portefeuille).getAllByRole('button')).toHaveLength(1))
    expect((await tickets()).map((li) => li.textContent?.match(/^Ticket pour(\d{4})/)?.[1])).toEqual(['1904', '1905', '1903'])
    expect(offert).toHaveTextContent('1903 est bouclée, 1904 t’attend.')
    expect(attend).toHaveTextContent('1904 est bouclée, 1905 t’attend.')
    expect(utilise).toHaveTextContent('utilisé le 31 août 2026')
    expect(utilise).not.toHaveTextContent('1902 est bouclée')
    expect([offert, attend, utilise].map((li) => li.getAttribute('data-utilise'))).toEqual(['non', 'non', 'oui'])

    const bouton = within(offert).getByRole('button', { name: 'Utiliser le ticket pour 1904' })
    expect(bouton).toHaveTextContent(/^Utiliser$/)
    fireEvent.click(bouton)
    await waitFor(() => expect(bouton).toBeDisabled())
    fireEvent.click(bouton)
    await waitFor(() => expect(typeof liberer).toBe('function'))
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([UTILISER])
    // Encaissé, il mène à la carte : la sacoche n'est plus là.
    act(() => liberer(json(exemple<TicketUtilise>('/me/voyage/tickets/{annee}/utiliser', 'post', 200))))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'La sacoche du voyageur' })).toBeNull())
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([UTILISER])
  })

  // Mutation : le paragraphe `role="alert"` du refus retiré du dessin de 1900.
  it('un « Utiliser » refusé se dit dans le portefeuille, et la sacoche reste ouverte', async () => {
    monterVoyage(SACOCHE, { ...ROUTES, [UTILISER]: () => json({ code: 'NOT_FOUND', message: 'Ce ticket a déjà servi.', retryable: false }, 404) })
    const portefeuille = await region('Portefeuille')
    fireEvent.click(await within(portefeuille).findByRole('button', { name: 'Utiliser le ticket pour 1904' }))
    expect(await within(portefeuille).findByRole('alert')).toHaveTextContent('Ce ticket a déjà servi.')
    expect(await sacoche()).toBeInTheDocument()
    expect(within(await region('Passeport')).queryByRole('alert')).toBeNull()
  })

  // Mutations : « Aucun tampon encore » ou « Aucun ticket » dits sans réponse (la branche de
  // l'attente retirée du cadre ou du portefeuille de 1900) ; la phrase du vide retirée.
  it('« … » tant que la carte et les tickets n’ont pas répondu ; « Aucun tampon encore » et « Aucun ticket » après une réponse vide', async () => {
    let tk!: (r: Response) => void
    // La carte est déjà en cache (la sacoche s'ouvre d'elle) : c'est elle qui fait de la sacoche celle de 1900.
    const sansTampon = { ...VOYAGE, tampons: [] }
    monterVoyage(SACOCHE, { ...ROUTES, [CARTE]: () => json(sansTampon), [TICKETS]: () => new Promise<Response>((r) => (tk = r)) })
    await sacoche()
    const passeport = await region('Passeport')
    const portefeuille = await region('Portefeuille')
    await waitFor(() => expect(typeof tk).toBe('function'))
    expect(within(portefeuille).getByText('…')).toBeInTheDocument()
    expect(portefeuille).not.toHaveTextContent(/Aucun/)
    expect(await within(passeport).findByText('Aucun tampon encore')).toBeInTheDocument()
    act(() => tk(json({ tickets: [] })))
    expect(await within(portefeuille).findByText('Aucun ticket')).toBeInTheDocument()
    expect(within(portefeuille).queryByText('…')).toBeNull()
    expect(within(portefeuille).queryByRole('list')).toBeNull()
  })

  // Chaque bloc tombe seul en panne. Mutations : la branche `panne` retirée du portefeuille de 1900
  // (il resterait à « … ») ; la panne des tickets dite aussi par le cadre du passeport.
  it('une panne des tickets n’éteint que le portefeuille : le passeport garde ses pages', async () => {
    monterVoyage(SACOCHE, { ...ROUTES, [TICKETS]: panne('Le portefeuille est en panne.') })
    await sacoche()
    const portefeuille = await region('Portefeuille')
    expect(await within(portefeuille).findByRole('alert')).toHaveTextContent('Le portefeuille est en panne.')
    expect(within(portefeuille).getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
    const passeport = await region('Passeport')
    expect(within(passeport).getAllByRole('link')).toHaveLength(2)
    expect(within(passeport).queryByRole('alert')).toBeNull()
  })

  // La carte en panne après avoir répondu : la sacoche est déjà celle de 1900, et son cadre dit la
  // panne. Mutation : la branche `panne` retirée du cadre du passeport de 1900 (les pages resteraient,
  // sans rien dire).
  it('une panne de la carte se dit dans le passeport, et lui seul', async () => {
    let enPanne = false
    const { client } = monterVoyage(SACOCHE, { ...ROUTES, [CARTE]: () => (enPanne ? panne('La carte est en panne.')() : json(VOYAGE)) })
    await sacoche()
    const passeport = await region('Passeport')
    await waitFor(() => expect(within(passeport).getAllByRole('link')).toHaveLength(2))
    enPanne = true
    await act(async () => {
      await client.refetchQueries({ queryKey: ['voyage'], exact: true })
    })
    expect(await within(passeport).findByRole('alert')).toHaveTextContent('La carte est en panne.')
    expect(within(passeport).queryByRole('link')).toBeNull()
    expect(within(await region('Portefeuille')).queryByRole('alert')).toBeNull()
    // La sacoche reste celle de 1900 : la carte lue avant la panne est toujours là.
    expect(screen.getByRole('heading', { level: 1, name: M.titre })).toBeInTheDocument()
  })

  // Mutations, dans le dessin de 1900 : le contenu monté sans regarder `depliees` ; `aria-expanded`
  // figé ; la rubrique « Dépenses » montée sans lignes (un titre seul, avant la réponse) ; une entrée
  // de crédits sur deux.
  it('les coulisses sont repliées, et rien ne lit les dépenses ; dépliées, elles disent les dépenses et tous les crédits', async () => {
    let repondre!: (r: Response) => void
    const { requetes } = monterVoyage(SACOCHE, { ...ROUTES, [DEPENSES]: () => new Promise<Response>((r) => (repondre = r)) })
    const coulisses = await region(M.coulisses.titre)
    await tickets()
    await new Promise((r) => setTimeout(r, 50))
    const pli = within(coulisses).getByRole('button', { name: M.coulisses.titre })
    expect(pli).toHaveAttribute('aria-expanded', 'false')
    expect(pli).not.toHaveAttribute('aria-controls')
    expect(screen.queryByRole('region', { name: M.coulisses.credits })).toBeNull()
    expect(requetes).not.toContain(DEPENSES)

    fireEvent.click(pli)
    expect(pli).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(pli.getAttribute('aria-controls')!)).toContainElement(await region(M.coulisses.credits))
    await waitFor(() => expect(typeof repondre).toBe('function'))
    // Avant la réponse, la rubrique des dépenses ne paraît pas pour disparaître.
    expect(screen.queryByRole('region', { name: M.coulisses.depenses })).toBeNull()
    act(() => repondre(json(DEPENSES_IA)))
    const depenses = await region(M.coulisses.depenses)
    expect(within(depenses).getByText('Ce mois-ci : 5 appels, environ 101,2 centimes de dollar')).toBeInTheDocument()
    expect(within(depenses).getByText('Août 2026 : 12 appels, environ 254,3 centimes de dollar')).toBeInTheDocument()
    expect(within(depenses).getByText(/estimation/i)).toBeInTheDocument()

    const fichiers = import.meta.glob('../../../**/assets/CREDITS.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const sources = Object.values(fichiers).flatMap((texte) => texte.split(/^## /m).slice(1).map((e) => /^- Source : (\S+)/m.exec(e)![1]!))
    expect(sources.length).toBeGreaterThanOrEqual(2)
    const liens = within(await region(M.coulisses.credits)).getAllByRole('link').map((a) => a.getAttribute('href'))
    expect([...liens].sort()).toEqual([...sources].sort())

    fireEvent.click(pli)
    expect(screen.queryByRole('region', { name: M.coulisses.credits })).toBeNull()
  })

  // Mutations : la garde de la liste vide contournée dans le dessin (la rubrique montée dès que la
  // page passe `null`) ; la panne des dépenses tue (`panneDesDepenses` ignorée).
  it.each([
    ['une liste vide (un membre hors du compte IA) ne montre pas la rubrique', () => json({ mois: [] }), null],
    ['une panne des dépenses se dit, et les crédits restent', panne('Les dépenses sont en panne.'), 'Les dépenses sont en panne.'],
  ])('dans les coulisses, %s', async (_, reponse, message) => {
    const { client } = monterVoyage(SACOCHE, { ...ROUTES, [DEPENSES]: reponse })
    await deplier()
    await waitFor(() => expect(client.getQueryState(['voyage', 'depenses'])?.fetchStatus).toBe('idle'))
    await waitFor(() => expect(client.getQueryState(['voyage', 'depenses'])?.status).not.toBe('pending'))
    expect(within(await region(M.coulisses.credits)).getAllByRole('link').length).toBeGreaterThan(0)
    if (message === null) {
      expect(screen.queryByRole('region', { name: M.coulisses.depenses })).toBeNull()
    } else {
      expect(await within(await region(M.coulisses.depenses)).findByRole('alert')).toHaveTextContent(message)
      expect(within(await region('Passeport')).queryByRole('alert')).toBeNull()
    }
  })
})
