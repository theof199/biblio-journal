import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { JournalPage } from '../api/journal'
import type { Voyage } from '../api/voyage'
import { PAGES_1890 } from '../mondes/1890/pages'
import type { VueMonument } from '../mondes/types'
import { exemple } from '../test/contrat'
import { contexteFactice } from '../test/contexteFactice'
import { visionnage } from '../test/journal'
import { SESSION, monterVoyage } from '../test/pageVoyage'
import { json } from '../test/serveur'
import { fichePrete, voyage1890 } from '../test/voyage'
import { anneeCivile } from '../voyage/decennie'
import stylesDuTampon from '../voyage/passeport/Tampon.module.css'
import { decennieDe } from '../voyage/regles'

/**
 * 1895 Palme, 1896 Lion, 1897 en cours (deux films, pas encore l'Ours), 1898 verrouillée mais
 * portant déjà l'Ours par des films vus en avance, 1899 verrouillée sans rien : trois années sur
 * cinq portent leur récompense ; il manque 1897 et 1899.
 */
const VOYAGE = voyage1890(
  1897,
  [
    { annee: 1895, statut: 'ouverte', visitee: true, recompense: 'palme', profondeur: 9 },
    { annee: 1896, statut: 'ouverte', visitee: true, recompense: 'lion', profondeur: 6 },
    { annee: 1897, statut: 'en_cours', visitee: true, recompense: null, profondeur: 2 },
    { annee: 1898, statut: 'verrouillee', visitee: false, recompense: 'ours', profondeur: 3 },
    { annee: 1899, statut: 'verrouillee', visitee: false, recompense: null, profondeur: 0 },
  ],
  { ia: true, source: null, rattrape_la_source: false, depart: 1895 },
)
const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
const JOURNAL = 'GET /api/me/journal?limit=100&sortie_min=1890&sortie_max=1899'
const TICKETS = 'GET /api/me/voyage/tickets'
const MANEGE = 'Le manège des années 1890 : touchez un cheval pour ouvrir son année.'
const PHRASE = 'Il manque une récompense en 1897 et 1899, et le ticket de 1900.'

const ticket = (annee: number, utiliseLe: string | null = null) => ({ annee, motif: 'Un ticket.', emis_le: '2026-09-21T21:00:00.000Z', montre_le: null, utilise_le: utiliseLe })
/** Un visionnage d'un film sorti `an`, avec son affiche. */
const vu = (id: string, an: number, note: number | null = null) => {
  const v = visionnage({ id, media: 'm-' + id, annee: an, date: '2026-09-01', note })
  v.media.cover_url = `https://image.tmdb.org/t/p/w500/${id}.jpg`
  return v
}
const journal = (items: ReturnType<typeof vu>[]) => () => json({ ...PAGE, items, next_cursor: null })
const refus = (message: string) => () => json({ code: 'VALIDATION', message, retryable: false }, 400)

const ROUTES = {
  'GET /api/me/voyage': () => json(VOYAGE),
  [TICKETS]: () => json({ tickets: [ticket(1900)] }),
  [JOURNAL]: journal([]),
}

/**
 * Le manège doublé : trois figures, 1893 (sans page : avant le départ) d'abord, puis 1898 et 1897 ;
 * la toile peint sur un contexte factice (jsdom n'a pas de canvas ; sans rectangle, la toile rend
 * les coordonnées du toucher telles quelles).
 */
function doublerLeManege() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => contexteFactice().ctx as never)
  const dessin = vi.spyOn(PAGES_1890, 'dessinerMonument').mockImplementation((v: VueMonument) => {
    v.zone(1893, 330, 200, 30)
    v.zone(1898, 200, 60, 30)
    v.zone(1897, 60, 60, 30)
  })
  return {
    peint: () => waitFor(() => expect(dessin).toHaveBeenCalled()),
    dernier: () => dessin.mock.calls[dessin.mock.calls.length - 1]![0],
  }
}

/** `matchMedia` manque à jsdom : le test pose la réponse de « moins d'animations ». */
const calme = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

const decennie = () => screen.findByRole('heading', { level: 1, name: 'Années 1890' })
const registreDeLaPage = () => within(screen.getByRole('region', { name: 'Registre des recettes' }))

describe('la page d’une décennie', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // Mutations : une lecture de la fiche de l'année en cours ajoutée (`GET …/annees/1897`) ;
  // `journalComplet` à la place (`GET /api/me/journal?limit=100`) ; la lecture des tickets retirée.
  it('ne lit que la carte, mes tickets et mes films de la décennie', async () => {
    const { requetes } = monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    expect(await screen.findByText(PHRASE)).toBeInTheDocument()
    await screen.findByRole('list', { name: 'La palissade' })
    expect(requetes.filter((r) => r !== 'GET /api/auth/me').sort()).toEqual(['GET /api/me/voyage', TICKETS, JOURNAL].sort())
  })

  // Mutation : `decennieDeLAdresse` contournée (`Number(param)`).
  it.each(['1895', '1880', 'abc', String(decennieDe(anneeCivile()) + 10)])('ramène à la carte une adresse qui n’est pas une décennie (%s)', async (adresse) => {
    monterVoyage(`/voyage/decennies/${adresse}`, ROUTES)
    expect(await screen.findByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^Années/ })).not.toBeInTheDocument()
  })

  // Le jumeau de la règle, dans la page. Mutation : `decennieDeLAdresse(decennie, new Date().getFullYear())`
  // (l'année de l'appareil, réglé sur UTC : encore 2029).
  it('ouvre la décennie neuve dès le 1er janvier à Paris, quel que soit le fuseau de l’appareil', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2029-12-31T23:30:00.000Z'))
    vi.stubEnv('TZ', 'UTC')
    try {
      monterVoyage('/voyage/decennies/2030', { ...ROUTES, 'GET /api/me/journal?limit=100&sortie_min=2030&sortie_max=2039': journal([]) })
      expect(await screen.findByRole('heading', { level: 1, name: 'Années 2030' })).toBeInTheDocument()
    } finally {
      vi.unstubAllEnvs()
      vi.useRealTimers()
    }
  })

  // Mutations : `figureTouchee` contournée par la première figure (1893, sans page) ; le toucher
  // sans ses coordonnées ; l'ouverture branchée sur le premier contact (`onToucher`), qu'un
  // défilement commence aussi : le `pointerdown` seul ne doit rien ouvrir.
  it('ouvre l’année du cheval touché, au toucher achevé seulement', async () => {
    const manege = doublerLeManege()
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, 'GET /api/me/voyage/annees/1897': () => json(fichePrete({ annee: 1897 })) })
    await decennie()
    await manege.peint()
    const toile = screen.getByRole('img', { name: MANEGE })

    fireEvent.pointerDown(toile, { clientX: 62, clientY: 58 })
    expect(screen.getByRole('heading', { level: 1, name: 'Années 1890' })).toBeInTheDocument()

    fireEvent.click(toile, { clientX: 62, clientY: 58 })
    expect(await screen.findByRole('region', { name: 'L’année 1897' })).toBeInTheDocument()
  })

  // Mutations : `bouclee: false` en dur ; `cases: []` (la foire ne se remplirait plus) ; les chevaux
  // d'une autre décennie.
  it('donne au manège un cheval par année, les cases de la décennie et le tampon', async () => {
    const manege = doublerLeManege()
    const bouclee: Voyage = { ...VOYAGE, tampons: [{ decennie: 1890, boucle_le: '2026-01-14T10:00:00.000Z' }] }
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, 'GET /api/me/voyage': () => json(bouclee) })
    await decennie()
    await manege.peint()
    const vue = manege.dernier()
    expect(vue.annees.map((a) => `${a.annee} ${a.etat}`)).toEqual([
      '1890 avant', '1891 avant', '1892 avant', '1893 avant', '1894 avant',
      '1895 palme', '1896 lion', '1897 encours', '1898 avance', '1899 verrou',
    ])
    expect(vue.cases.map((c) => `${c.annee} ${c.etat} ${c.profondeur}`)).toEqual(['1895 palme 9', '1896 lion 6', '1897 encours 2', '1898 verrou 3', '1899 verrou 0'])
    expect(vue.bouclee).toBe(true)
    expect(vue.H).toBe(PAGES_1890.hauteurs.monument)
  })

  // Mutation : la garde `ouvrable` retirée (1893 ouvrirait une page qui n'existe pas au Voyage).
  it('n’ouvre pas une année sans page', async () => {
    const manege = doublerLeManege()
    const { requetes } = monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    await manege.peint()

    fireEvent.click(screen.getByRole('img', { name: MANEGE }), { clientX: 331, clientY: 199 })
    expect(screen.getByRole('heading', { level: 1, name: 'Années 1890' })).toBeInTheDocument()
    expect(requetes.some((r) => r.includes('/annees/1893'))).toBe(false)
  })

  // Mutations : le toucher oublié (le manège ne s'emballe jamais) ; l'emballement même sur une année
  // qui s'ouvre ; l'emballement au calme.
  it('s’emballe au toucher hors d’une année qui s’ouvre', async () => {
    const manege = doublerLeManege()
    monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    await manege.peint()
    const toile = screen.getByRole('img', { name: MANEGE })

    fireEvent.pointerDown(toile, { clientX: 62, clientY: 58 })
    await new Promise((fin) => setTimeout(fin, 50))
    expect(manege.dernier().touche).toBe(-9)

    fireEvent.pointerDown(toile, { clientX: 10, clientY: 300 })
    // L'instant de la toile au toucher (jsdom peut dater ses images d'avant l'ouverture : `t` négatif).
    await waitFor(() => expect(manege.dernier().touche).not.toBe(-9))
    expect(manege.dernier().touche).toBeLessThanOrEqual(manege.dernier().t)
  })

  it('ne s’emballe pas au calme', async () => {
    calme()
    const manege = doublerLeManege()
    let lire: (r: Response) => void = () => undefined
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, [TICKETS]: () => new Promise<Response>((fin) => void (lire = fin)) })
    await decennie()
    await manege.peint()

    fireEvent.pointerDown(screen.getByRole('img', { name: MANEGE }), { clientX: 10, clientY: 300 })
    // Au calme, l'image ne se repeint qu'au rendu : les tickets, servis après le toucher, en provoquent un.
    lire(json({ tickets: [ticket(1900)] }))
    await screen.findByText(PHRASE)
    await waitFor(() => expect(manege.dernier().vivant).toBe(false))
    expect(manege.dernier().touche).toBe(-9)
  })

  // Mutation : la phrase tirée de `profondeur > 0` au lieu de la récompense (1897 compterait, 1898 aussi).
  it('dit ce qui manque au tampon', async () => {
    monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    expect(await screen.findByText(PHRASE)).toBeInTheDocument()
    expect(screen.getByText('3 années sur 5')).toBeInTheDocument()
  })

  // Mutation : `ceQuiManque(v.annees, [], d, v.depart)` (les tickets non passés) : la phrase réclame le
  // ticket de 1900 ; le test précédent passe encore sous cette mutation, celui-ci tombe.
  it('ne réclame pas un ticket déjà utilisé', async () => {
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, [TICKETS]: () => json({ tickets: [ticket(1900, '2026-09-30T20:00:00.000Z')] }) })
    await decennie()
    expect(await screen.findByText('Il manque une récompense en 1897 et 1899.')).toBeInTheDocument()
    expect(screen.queryByText(/ticket de 1900/)).not.toBeInTheDocument()
  })

  // Mutation : `tickets.data?.tickets ?? []` : la phrase part avant la réponse et réclame le ticket de 1900.
  it('ne dit rien du ticket tant que les tickets ne sont pas lus', async () => {
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, [TICKETS]: () => new Promise<Response>(() => undefined) })
    await decennie()
    expect(await screen.findByText('3 années sur 5')).toBeInTheDocument()
    await screen.findByRole('list', { name: 'La palissade' })
    expect(screen.queryByText(/Il manque/)).not.toBeInTheDocument()
  })

  // Mutations : la panne des tickets tue (`?? []` : la phrase réclame le ticket) ; la `Panne` des
  // tickets à la place de toute la page.
  it('une panne des tickets se dit à la place de la phrase, le passeport reste', async () => {
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, [TICKETS]: refus('Les tickets se sont égarés.') })
    await decennie()
    expect(await screen.findByText('Les tickets se sont égarés.')).toBeInTheDocument()
    expect(screen.getByText('3 années sur 5')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: MANEGE })).toBeInTheDocument()
    expect(screen.queryByText(/ticket de 1900/)).not.toBeInTheDocument()
  })

  // Mutations : la phrase montrée même tamponné (`phraseDuPasseport(…, null)`) ; le tampon du livret
  // qui frappe (`frappe` passé) : il se refrapperait à chaque visite d'une décennie bouclée depuis
  // des mois.
  it('montre le tampon et sa date, sans phrase ni frappe, une fois bouclée', async () => {
    const bouclee: Voyage = { ...VOYAGE, tampons: [{ decennie: 1890, boucle_le: '2026-01-14T10:00:00.000Z' }] }
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, 'GET /api/me/voyage': () => json(bouclee) })
    await decennie()
    const jour = await screen.findByText('14 janvier 2026')
    expect(jour.parentElement).toHaveClass(stylesDuTampon.tampon!)
    expect(jour.parentElement).not.toHaveClass(stylesDuTampon.frappe!)
    expect(screen.queryByText('Le tampon se pose ici')).not.toBeInTheDocument()
    // Les tickets lus, la phrase aurait pu se dire : elle se tait.
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url) === '/api/me/voyage/tickets')).toBe(true))
    await new Promise((fin) => setTimeout(fin, 50))
    expect(screen.queryByText(/Il manque/)).not.toBeInTheDocument()
  })

  // Le jumeau : sans tampon, sa place. Mutation : le livret sans `place` (rien ne se montre).
  it('montre la place du tampon tant que la décennie n’est pas bouclée', async () => {
    monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    expect(await screen.findByText('Le tampon se pose ici')).toBeInTheDocument()
  })

  // Mutations : `ouvrable` ignoré (chaque ligne un lien, 1890 et 1899 compris) ; « Prochainement »
  // dit aussi d'une année d'avant le départ.
  it('le registre ouvre les années ouvrables, et elles seules', async () => {
    const court = voyage1890(1897, VOYAGE.annees.filter((a) => a.annee <= 1897), { ia: true, depart: 1895 })
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, 'GET /api/me/voyage': () => json(court) })
    await decennie()
    const registre = registreDeLaPage()
    expect(registre.getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/voyage/1895', '/voyage/1896', '/voyage/1897'])
    const lignes = registre.getAllByRole('listitem')
    expect(lignes).toHaveLength(10)
    expect(lignes[0]).toHaveTextContent(/^1890—$/)
    expect(lignes[9]).toHaveTextContent(/^1899Prochainement$/)
  })

  // Mutations : la palissade nourrie d'une liste vide ; la note tue.
  it('colle mes affiches par année et dit ma meilleure note au registre', async () => {
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, [JOURNAL]: journal([vu('a', 1895, 8), vu('b', 1895, 6), vu('c', 1896)]) })
    await decennie()
    const palissade = await screen.findByRole('list', { name: 'La palissade' })
    const panneaux = within(palissade).getAllByRole('listitem')
    expect(panneaux[0]!.querySelectorAll('img')).toHaveLength(2)
    expect(panneaux[0]).toHaveTextContent('+7')
    expect(panneaux[1]!.querySelectorAll('img')).toHaveLength(1)
    expect(panneaux[3]).toHaveTextContent('en avance')
    expect(registreDeLaPage().getAllByRole('listitem')[5]).toHaveTextContent('8/10')
  })

  // Mutation : un lien vers la décennie de l'année civile au lieu de celle de la page.
  it('la boîte et le guichet sont à un toucher', async () => {
    monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    expect(screen.getByRole('link', { name: 'La boîte à billets' })).toHaveAttribute('href', '/voyage/decennies/1890/billets')
    expect(screen.getByRole('link', { name: 'Catalogue des vues' })).toHaveAttribute('href', '/voyage/decennies/1890/recherche')
  })

  // Mutation : la `Panne` du journal à la place de toute la page.
  it('une panne du journal laisse le manège et le passeport', async () => {
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, [JOURNAL]: refus('Le journal s’est égaré.') })
    await decennie()
    expect(await screen.findByText('Le journal s’est égaré.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: MANEGE })).toBeInTheDocument()
    expect(screen.getByText('3 années sur 5')).toBeInTheDocument()
    expect(await screen.findByText(PHRASE)).toBeInTheDocument()
    expect(registreDeLaPage().getAllByRole('listitem')).toHaveLength(10)
  })

  // Mutation : « Retour à la carte » en simple lien vers `/voyage` : la carte s'empilerait devant
  // l'année quittée, et le geste « retour » du téléphone y ramènerait.
  it('« Retour à la carte » recule dans l’historique quand il y a de quoi', async () => {
    monterVoyage(['/voyage/1897', '/voyage/decennies/1890'], { ...ROUTES, 'GET /api/me/voyage/annees/1897': () => json(fichePrete({ annee: 1897 })) })
    await decennie()
    fireEvent.click(screen.getByRole('link', { name: 'Retour à la carte' }))
    expect(await screen.findByRole('region', { name: 'L’année 1897' })).toBeInTheDocument()
  })

  // Le jumeau : ouverte d'un lien, sans rien de l'app derrière. Mutation : toujours reculer
  // (`navigate(-1)` au lieu de `useRevenir` : rien ne se passerait).
  it('« Retour à la carte » mène à la carte quand rien n’est derrière', async () => {
    monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    const retour = screen.getByRole('link', { name: 'Retour à la carte' })
    expect(retour).toHaveAttribute('href', '/voyage')
    fireEvent.click(retour)
    expect(await screen.findByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
  })
})
