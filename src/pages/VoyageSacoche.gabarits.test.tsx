import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Depenses, TicketUtilise, Tickets, Voyage } from '../api/voyage'
import { PAGES_1890 } from '../mondes/1890/pages'
import { exemple } from '../test/contrat'
import { SESSION, monterVoyage } from '../test/pageVoyage'
import { json } from '../test/serveur'
import { annee, voyage1890 } from '../test/voyage'
import { CREDITS } from '../voyage/sacoche'
import type { PropsPageDuPasseport } from '../voyage/sacoche/Page'
import type { PropsPasseportDeLaSacoche } from '../voyage/sacoche/Pages'
import type { PropsCoulisses } from '../voyage/sacoche/Repli'
import type { PropsTeteDeLaSacoche } from '../voyage/sacoche/Tete'
import type { PropsPortefeuille } from '../voyage/sacoche/Tickets'

// Cinq sections de la sacoche sont des dessins qu'un monde peut composer (`GabaritsDesPages` :
// `teteDeLaSacoche`, `passeportDeLaSacoche`, `pageDuPasseport`, `portefeuille`, `coulisses`). Sans
// gabarit, le défaut reste : tous les tests de `VoyageSacoche.test.tsx`, que ce fichier ne retouche
// pas. Le monde de test est 1890, auquel on prête des dessins qui disent ce qu'ils reçoivent.
const VOYAGE = 'GET /api/me/voyage'
const TICKETS = 'GET /api/me/voyage/tickets'
const DEPENSES = 'GET /api/me/voyage/depenses'
const UTILISER = 'POST /api/me/voyage/tickets/1898/utiliser'

const EN_1897 = voyage1890(
  1897,
  [
    { annee: 1895, statut: 'ouverte', recompense: 'ours', visitee: true },
    { annee: 1896, statut: 'ouverte', recompense: 'lion', visitee: true },
    { annee: 1897, statut: 'en_cours', recompense: 'ours', visitee: true },
    { annee: 1898, statut: 'verrouillee', recompense: null, visitee: false },
  ],
  { source: null, ia: true },
)
/** Les années 1890 bouclées, tamponnées, et deux années de 1900 : la sacoche est à 1900. */
const EN_1901: Voyage = {
  ...EN_1897,
  annee_en_cours: 1901,
  annees: [...EN_1897.annees, annee({ annee: 1900, statut: 'ouverte', recompense: 'ours' }), annee({ annee: 1901, statut: 'en_cours', recompense: null })],
  tampons: [{ decennie: 1890, boucle_le: '2026-03-14T12:00:00.000Z' }],
}
const ticket = (a: number, utiliseLe: string | null = null): Tickets['tickets'][number] => ({ annee: a, motif: `Vers ${a}.`, emis_le: '2026-09-01T18:00:00.000Z', montre_le: null, utilise_le: utiliseLe })
/** Dans l'ordre de l'API : l'utilisé d'abord. 1898 est offert (l'année qui suit 1897), 1899 attend. */
const TROIS_TICKETS: Tickets = { tickets: [ticket(1897, '2026-08-30T12:00:00.000Z'), ticket(1898), ticket(1899)] }
const DEPENSES_IA = exemple<Depenses>('/me/voyage/depenses', 'get', 200)
const ROUTES = { [VOYAGE]: () => json(EN_1897), [TICKETS]: () => json(TROIS_TICKETS), [DEPENSES]: () => json(DEPENSES_IA) }

const dit = (quoi: string) => screen.getByTestId(quoi).textContent
const dits = (quoi: string) => screen.getAllByTestId(quoi).map((e) => e.textContent)

const TeteDuMonde = (p: PropsTeteDeLaSacoche) => <h1 data-testid="tete">{`La besace de ${p.pseudo}`}</h1>
const CadreDuMonde = (p: PropsPasseportDeLaSacoche) => (
  <div data-testid="le-cadre">
    <p data-testid="cadre">{`${p.panne ? 'panne' : 'sans panne'} | ${p.pages ? p.pages.map((x) => x.decennie).join(' ') : 'attente'} | ${p.sansTampon ? 'sans tampon' : 'tamponné'}`}</p>
    {p.pages?.map((x) => <div key={x.decennie}>{x.page}</div>)}
  </div>
)
const PageDuMonde = (p: PropsPageDuPasseport) => (
  <p data-testid="page">{`${p.decennie} | ${p.monde.nom} | ${p.tampon ? `tampon ${p.tampon.boucle_le}` : 'sans tampon'} | ${p.anneau.faites}/${p.anneau.total} | ${p.vers}`}</p>
)
const TicketsDuMonde = (p: PropsPortefeuille) => (
  <div>
    <p data-testid="tickets">{`${p.panne ? 'panne' : 'sans panne'} | ${p.tickets ? p.tickets.map((t) => `${t.ticket.annee}${t.utiliser ? '*' : ''}`).join(' ') : 'attente'} | ${p.enCours ? 'en cours' : 'au repos'} | ${p.refus ?? 'sans refus'}`}</p>
    {p.tickets?.map((t) =>
      t.utiliser ? (
        <button key={t.ticket.annee} type="button" onClick={t.utiliser}>
          {`Prendre ${t.ticket.annee}`}
        </button>
      ) : null,
    )}
  </div>
)
const RepliDuMonde = (p: PropsCoulisses) => (
  <div>
    <h2 id={p.ids.titre}>Le repli du monde</h2>
    <p data-testid="repli" data-contenu={p.ids.contenu}>{`${p.depliees ? 'dépliées' : 'repliées'} | ${p.panneDesDepenses ? 'panne' : 'sans panne'} | ${p.depenses ? `${p.depenses.courant} ; ${p.depenses.precedents.length} avant` : 'rien'} | ${p.credits.length} groupes`}</p>
    <button type="button" onClick={p.basculer}>
      Plier ou déplier
    </button>
  </div>
)

describe('le dessin du monde dans la sacoche', () => {
  let remettre = () => undefined as void
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-29T12:00:00.000Z'))
  })
  afterEach(() => {
    remettre()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  const preter = (gabarits: typeof PAGES_1890.gabarits) => {
    const avant = PAGES_1890.gabarits
    PAGES_1890.gabarits = gabarits
    remettre = () => void (PAGES_1890.gabarits = avant)
  }

  // Mutation : la page qui monte `Tete` sans passer par `gabaritDe`.
  it('la tête du monde reçoit le pseudo et porte le titre ; le retour reste à la page', async () => {
    preter({ teteDeLaSacoche: TeteDuMonde })
    monterVoyage('/voyage/sacoche', ROUTES)
    expect(await screen.findByRole('heading', { level: 1, name: `La besace de ${SESSION.user.pseudo}` })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'La sacoche du voyageur' })).toBeNull()
    expect(screen.queryByText(`Le Voyage de ${SESSION.user.pseudo}`)).toBeNull()
    expect(screen.getByRole('link', { name: 'Retour à la carte' })).toHaveAttribute('href', '/voyage')
  })

  // Mutations : `Pages` monté sans passer par `gabaritDe` ; `sansTampon` vrai avant la réponse de la
  // carte ; `pages` vide (et non nul) avant elle ; la panne de la carte tue.
  it('le cadre du monde reçoit l’attente, puis une page par décennie et « sans tampon », ou la panne', async () => {
    preter({ passeportDeLaSacoche: CadreDuMonde })
    let carte!: (r: Response) => void
    const { unmount } = monterVoyage('/voyage/sacoche', { ...ROUTES, [VOYAGE]: () => new Promise<Response>((r) => (carte = r)) })
    await waitFor(() => expect(typeof carte).toBe('function'))
    expect(dit('cadre')).toBe('sans panne | attente | tamponné')
    // La région reste celle de la page, d'un monde à l'autre ; son titre par défaut n'y est plus.
    const region = screen.getByRole('region', { name: 'Passeport' })
    expect(within(region).queryByRole('heading', { name: /Passeport/ })).toBeNull()
    act(() => carte(json(EN_1897)))
    await waitFor(() => expect(dit('cadre')).toBe('sans panne | 1890 | sans tampon'))
    // La page, elle, reste celle du défaut : son anneau et son lien.
    expect(region).toContainElement(screen.getByTestId('le-cadre'))
    const page = within(screen.getByTestId('le-cadre')).getByRole('link')
    expect(page).toHaveAttribute('href', '/voyage/decennies/1890')
    expect(page).toHaveTextContent('3 années sur 5')
    unmount()

    monterVoyage('/voyage/sacoche', { ...ROUTES, [VOYAGE]: () => json({ code: 'VALIDATION_ERROR', message: 'La carte est en panne.', retryable: false }, 400) })
    await waitFor(() => expect(dit('cadre')).toBe('panne | attente | tamponné'))
  })

  // Le cadre est au monde de mon année en cours, la page au monde de **sa** décennie. Mutations : la
  // page lue au monde de l'année en cours (`gabaritDe(monde de 1901, …)` : celle de 1890 perdrait le
  // dessin prêté à 1890, ou celle de 1900 le gagnerait) ; le cadre lu au monde de la décennie de départ.
  it('en 1901, la page des années 1890 est dessinée par le monde de 1890, pas son cadre ni la page de 1900', async () => {
    preter({ pageDuPasseport: PageDuMonde, passeportDeLaSacoche: CadreDuMonde, teteDeLaSacoche: TeteDuMonde, portefeuille: TicketsDuMonde, coulisses: RepliDuMonde })
    monterVoyage('/voyage/sacoche', { ...ROUTES, [VOYAGE]: () => json(EN_1901), [TICKETS]: () => json({ tickets: [] }) })
    await waitFor(() => expect(dits('page')).toEqual(['1890 | Les origines | tampon 2026-03-14T12:00:00.000Z | 3/5 | /voyage/decennies/1890']))
    // Rien de ce qui se lit au monde de l'année en cours n'est pris à 1890.
    for (const quoi of ['cadre', 'tete', 'tickets', 'repli']) expect(screen.queryByTestId(quoi)).toBeNull()
    // La page de 1900 est là, hors du dessin prêté à 1890.
    expect(screen.getByRole('link', { name: /Années 1900/ })).toHaveAttribute('href', '/voyage/decennies/1900')
  })

  // Mutations : `Tickets` monté sans passer par `gabaritDe` ; les tickets passés dans l'ordre de
  // l'API (l'utilisé d'abord) ; `utiliser` posé sur tout ticket non utilisé (1899 gagne son geste) ;
  // le verrou retiré (deux requêtes) ; `enCours` jamais dit ; `refus` tu.
  it('le portefeuille du monde reçoit les tickets rangés et le geste sur le seul ticket offert ; la page encaisse', async () => {
    preter({ portefeuille: TicketsDuMonde })
    let liberer!: (r: Response) => void
    const { requetes } = monterVoyage(['/voyage', '/voyage/sacoche'], { ...ROUTES, [UTILISER]: () => new Promise<Response>((r) => (liberer = r)) })
    await waitFor(() => expect(dit('tickets')).toBe('sans panne | 1898* 1899 1897 | au repos | sans refus'))
    expect(within(screen.getByRole('region', { name: 'Portefeuille' })).queryByRole('heading', { name: /Portefeuille/ })).toBeNull()
    const prendre = screen.getByRole('button', { name: 'Prendre 1898' })
    fireEvent.click(prendre)
    fireEvent.click(prendre)
    await waitFor(() => expect(dit('tickets')).toContain('| en cours |'))
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([UTILISER])
    act(() => liberer(json({ code: 'NOT_FOUND', message: 'Ce ticket a déjà servi.', retryable: false }, 404)))
    await waitFor(() => expect(dit('tickets')).toBe('sans panne | 1898* 1899 1897 | au repos | Ce ticket a déjà servi.'))

    // Accepté, c'est la page qui mène à la carte.
    fireEvent.click(prendre)
    await waitFor(() => expect(requetes.filter((r) => r.startsWith('POST'))).toHaveLength(2))
    act(() => liberer(json(exemple<TicketUtilise>('/me/voyage/tickets/{annee}/utiliser', 'post', 200))))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'La sacoche du voyageur' })).toBeNull())
  })

  // Mutations : `Repli` monté sans passer par `gabaritDe` ; `enabled: depliees` retiré (les dépenses
  // lues à l'ouverture de la sacoche) ; `basculer` sans effet ; les lignes des dépenses perdues en route.
  it('les Coulisses du monde arrivent repliées, sans lecture ; dépliées, la page lit les dépenses et les lui dit', async () => {
    preter({ coulisses: RepliDuMonde })
    const { requetes } = monterVoyage('/voyage/sacoche', ROUTES)
    await waitFor(() => expect(dit('repli')).toBe(`repliées | sans panne | rien | ${CREDITS.length} groupes`))
    await screen.findByText('3 années sur 5')
    await new Promise((r) => setTimeout(r, 50))
    expect(requetes).not.toContain(DEPENSES)
    expect(screen.queryByRole('button', { name: /Coulisses/ })).toBeNull()
    // La région est celle de la page, nommée par le titre du monde ; le pli désigne son contenu.
    expect(screen.getByRole('region', { name: 'Le repli du monde' })).toContainElement(screen.getByTestId('repli'))
    expect(screen.getByTestId('repli').getAttribute('data-contenu')).toMatch(/-contenu$/)

    fireEvent.click(screen.getByRole('button', { name: 'Plier ou déplier' }))
    await waitFor(() => expect(dit('repli')).toBe(`dépliées | sans panne | Ce mois-ci : 5 appels, environ 101,2 centimes de dollar ; 1 avant | ${CREDITS.length} groupes`))
    expect(requetes.filter((r) => r === DEPENSES)).toHaveLength(1)
    expect(CREDITS.length).toBeGreaterThan(0)
  })
})
