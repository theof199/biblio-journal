import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { Link } from 'react-router-dom'
import type { Table, Tables } from '../api/voyage'
import { PAGES_1890 } from '../mondes/1890/pages'
import { exemple } from '../test/contrat'
import { SESSION, monterVoyage } from '../test/pageVoyage'
import { json } from '../test/serveur'
import { fichePrete, voyage1890 } from '../test/voyage'
import type { PropsOrdreDAnnee } from '../voyage/annee/Ordre'
import type { PropsPorteDuWagon } from '../voyage/wagon/tables'

// La porte du wagon-restaurant sur la fiche de mon année en cours (plan des écrans des lots, brief 16,
// décision 10) tient à une clé de gabarit **sans défaut**, `porteDuWagon`. `VoyageAnnee.test.tsx`,
// monté sur 1890, reste vert sans être retouché ; ce fichier tient le bloc lecteur sur un 1890 auquel
// on prête un dessin qui dit ce qu'il reçoit, et le vrai 1890, qui ne lit aucune table.
const CARTE = 'GET /api/me/voyage'
const TABLES = 'GET /api/me/voyage/tables'
const FICHE = (a: number) => `GET /api/me/voyage/annees/${a}`

const voyage = (ia: boolean) =>
  voyage1890(
    1897,
    [
      { annee: 1896, statut: 'ouverte', visitee: true, recompense: 'ours', horaire: null },
      { annee: 1897, statut: 'en_cours', visitee: true, recompense: null, horaire: null },
    ],
    { ia, source: null, rattrape_la_source: false },
  )
const fiche = (annee: number) => fichePrete({ annee, ticket: null, maturite: null, generique: null, horaire: null, horaire_proposable: null })

const EXEMPLE = exemple<Tables>('/me/voyage/tables', 'get', 200)
/** Le 9 octobre 2026, 20 h à Paris. */
const MAINTENANT = '2026-10-09T18:00:00.000Z'
const MOI = SESSION.user
const AUTRE = EXEMPLE.tables.map((t) => (t.hote.id === MOI.id ? t.invite : t.hote))[0]!
const MOI_A_TABLE = EXEMPLE.tables.map((t) => (t.hote.id === MOI.id ? t.hote : t.invite))[0]!
const table = (id: string, plus: Partial<Table>): Table => ({ ...EXEMPLE.tables[0]!, id, soir: '2026-10-09', hote: AUTRE, invite: MOI_A_TABLE, etat: 'attend', vu_ensemble: false, mon_billet: null, ...plus })
/** Chez l'autre, ce soir : j'y suis invité. */
const INVITATION = table('invitation', {})
/** La mienne, ce soir, que mon invité a déclinée : elle reste la mienne. */
const LA_MIENNE = table('la-mienne', { hote: MOI_A_TABLE, invite: AUTRE, etat: 'a_decline' })
const DECLINEE = table('declinee-par-moi', { etat: 'a_decline' })
const HIER = table('hier', { soir: '2026-10-08', etat: 'a_pris_sa_place' })
const DEMAIN = table('demain', { soir: '2026-10-10' })

const routes = (tables: Table[] | (() => Response), ia = false) => ({
  [CARTE]: () => json(voyage(ia)),
  'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
  [FICHE(1897)]: () => json(fiche(1897)),
  [FICHE(1896)]: () => json(fiche(1896)),
  [TABLES]: typeof tables === 'function' ? tables : () => json({ tables } satisfies Tables),
})

/** Le dessin prêté : ce qu'il reçoit, en une ligne, et le lien vers le wagon. */
const PorteDuMonde = (p: PropsPorteDuWagon) => (
  <nav aria-label="La porte prêtée">
    <p data-testid="porte">{p.tables.map((t) => `${t.table.id} (${t.role})`).join(' | ')}</p>
    <Link to={p.vers}>Entrer</Link>
  </nav>
)
/** Un ordre prêté, qui nomme chaque place : où la porte se range, et ce qui y arrive. */
const OrdreDuMonde = (p: PropsOrdreDAnnee) => (
  <div data-testid="ordre">
    {(['corde', 'boniment', 'programme', 'horaire', 'parade', 'seance', 'porte', 'salles', 'ligneDuBas'] as const).map((place) => (
      <div key={place} data-place={place} data-vide={p[place] === null ? 'oui' : 'non'}>
        {p[place]}
      </div>
    ))}
  </div>
)

let remettre: (() => void) | null = null
const preter = (gabarits: typeof PAGES_1890.gabarits = { porteDuWagon: PorteDuMonde }) => {
  const avant = PAGES_1890.gabarits
  PAGES_1890.gabarits = { ...avant, ...gabarits }
  remettre = () => void (PAGES_1890.gabarits = avant)
}
const lAnnee = (a = 1897) => screen.findByRole('region', { name: `L’année ${a}` })
const calme = (client: ReturnType<typeof monterVoyage>['client']) => waitFor(() => expect(client.isFetching()).toBe(0))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  localStorage.clear()
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
  // L'heure se fixe, elle ne s'attend pas ; `Date` seule, pour que les minuteries de TanStack courent.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(MAINTENANT))
})
afterEach(() => {
  remettre?.()
  remettre = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('la porte du wagon-restaurant, hors d’un monde qui la dessine', () => {
  // Décision 1 du propriétaire : ces écrans sont de 1900 seulement. La liste des requêtes est exigée
  // **entière**. Mutation : dans `VoyageAnnee.tsx`, `<Porte>` monté sans regarder la clé (un dessin
  // par défaut), ou les tables lues par la page elle-même.
  it('la fiche de mon année en cours, en 1890, ne lit aucune table et ne montre aucune porte', async () => {
    const { requetes, client } = monterVoyage('/voyage/1897', routes([INVITATION]))
    await lAnnee()
    await screen.findByRole('region', { name: PAGES_1890.mots.boniment })
    await calme(client)
    expect(requetes.filter((r) => r !== 'GET /api/auth/me').sort()).toEqual([CARTE, FICHE(1897)].sort())
    expect(screen.queryByText(/wagon/i)).toBeNull()
  })
})

describe('la porte du wagon-restaurant, dans un monde qui la dessine', () => {
  // Mutations : `tablesDeLaPorte` contournée dans le bloc (toutes les tables passées) ; le rôle
  // calculé sur le pseudo, ou toujours « invité » ; l'adresse écrite autrement que celle de la page
  // du wagon ; la porte montée au compte IA seulement (`v.ia &&`).
  it.each([
    ['un membre hors IA', false],
    ['le compte IA', true],
  ])('pour %s, elle reçoit mes tables de ce soir que je n’ai pas déclinées, dans l’ordre servi, et mène au wagon', async (_, ia) => {
    preter()
    const { requetes, client } = monterVoyage('/voyage/1897', routes([HIER, INVITATION, DECLINEE, LA_MIENNE, DEMAIN], ia))
    const page = await lAnnee()
    expect(await within(page).findByTestId('porte')).toHaveTextContent('invitation (invite) | la-mienne (hote)')
    expect(within(page).getByRole('link', { name: 'Entrer' })).toHaveAttribute('href', '/voyage/wagon-restaurant')
    await calme(client)
    expect(requetes.filter((r) => r === TABLES)).toHaveLength(1)
  })

  // **La porte n'existe que s'il y a une table ce soir** : une table d'hier, de demain, ou que j'ai
  // déclinée, ne l'ouvre pas ; aucune table non plus. Rien, pas même un dessin vide. Mutations : le
  // dessin monté sur une liste vide ; toute table (le filtre retiré, `tables.length > 0`).
  it.each([
    ['une table d’hier', [HIER]],
    ['une table de demain', [DEMAIN]],
    ['une table que j’ai déclinée', [DECLINEE]],
    ['aucune table', []],
  ])('%s : aucune porte', async (_, tables) => {
    preter()
    const { requetes, client } = monterVoyage('/voyage/1897', routes(tables))
    const page = await lAnnee()
    await screen.findByRole('region', { name: PAGES_1890.mots.boniment })
    await calme(client)
    expect(requetes).toContain(TABLES)
    expect(within(page).queryByRole('navigation', { name: 'La porte prêtée' })).toBeNull()
  })

  // Le soir d'une table est un jour de Paris : à 23 h 30 de Greenwich le 9, c'est déjà le 10 à Paris,
  // et la table du 9 n'ouvre plus rien. Mutation : le jour de Greenwich dans `ceSoirMeme`.
  it('à 23 h 30 de Greenwich, la table d’hier à Paris n’ouvre plus la porte, celle du jour de Paris si', async () => {
    vi.setSystemTime(new Date('2026-10-09T22:30:00.000Z'))
    preter()
    monterVoyage('/voyage/1897', routes([INVITATION, DEMAIN]))
    expect(await screen.findByTestId('porte')).toHaveTextContent(/^demain \(invite\)$/)
  })

  // Sur mon année en cours seulement : une année bouclée ne lit aucune table, même dans un monde qui
  // compose la clé. Mutation : `annee === v.annee_en_cours` retiré de `VoyageAnnee.tsx`.
  it('une année bouclée ne lit aucune table et ne montre aucune porte', async () => {
    preter()
    const { requetes, client } = monterVoyage('/voyage/1896', routes([INVITATION]))
    const page = await lAnnee(1896)
    await screen.findByRole('region', { name: PAGES_1890.mots.boniment })
    await calme(client)
    expect(requetes).not.toContain(TABLES)
    expect(within(page).queryByTestId('porte')).toBeNull()
  })

  // Une lecture en panne n'éteint que son bloc, et la porte n'a alors rien à dire : la fiche reste
  // entière, sans alerte. Mutations : l'erreur des tables jointe aux pannes de la fiche ; un message
  // rendu par le bloc.
  it('mes tables en panne : la fiche entière, aucune porte, pas un mot', async () => {
    preter()
    const { requetes, client } = monterVoyage(
      '/voyage/1897',
      routes(() => json({ code: 'INTERNAL', message: 'Le wagon est en révision.', retryable: false }, 500)),
    )
    const page = await lAnnee()
    await screen.findByRole('region', { name: PAGES_1890.mots.boniment })
    await calme(client)
    expect(requetes).toContain(TABLES)
    expect(within(page).queryByTestId('porte')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/révision/)).toBeNull()
  })

  // Une place de plus dans l'ordre des sections, hors de la séance : l'ordre la reçoit à part, et
  // nulle sans table… le bloc, lui, ne rend rien. Hors IA, la séance est nulle et la porte est là.
  // Mutations : la porte rangée dans `seance` (elle disparaîtrait hors IA, ou la séance avec elle).
  // L'ordre par défaut qui oublierait `porte` rougit les tests plus haut, montés sur lui.
  it('la porte a sa place dans l’ordre, après la séance, que la séance soit montée ou non', async () => {
    preter({ porteDuWagon: PorteDuMonde, ordreDAnnee: OrdreDuMonde })
    monterVoyage('/voyage/1897', routes([INVITATION]))
    await screen.findByTestId('porte')
    const places = () => [...screen.getByTestId('ordre').children].map((c) => `${c.getAttribute('data-place')}${c.getAttribute('data-vide') === 'oui' ? ' (nulle)' : ''}`)
    expect(places()).toEqual(['corde', 'boniment', 'programme', 'horaire (nulle)', 'parade', 'seance (nulle)', 'porte', 'salles', 'ligneDuBas'])
    expect(screen.getByTestId('porte').closest('[data-place]')).toHaveAttribute('data-place', 'porte')
  })
})
