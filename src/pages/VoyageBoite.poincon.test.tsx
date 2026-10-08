import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { cles } from '../api/cles'
import type { JournalItem, JournalPage } from '../api/journal'
import type { Voyageur } from '../api/voyage'
import { PAGES_1890 } from '../mondes/1890/pages'
import { exemple } from '../test/contrat'
import { visionnage } from '../test/journal'
import { monterVoyage } from '../test/pageVoyage'
import { json } from '../test/serveur'
import { voyage1890 } from '../test/voyage'
import { oublierLeBillet } from '../voyage/billet/range'
import type { PropsBilletEnGrand } from '../voyage/boite/BilletEnGrand'
import type { PropsCasier } from '../voyage/boite/Casier'

// Le poinçon doré au casier (plan des écrans des lots, brief 8). La boîte à billets ne lit l'état du
// voyageur que si le monde de sa décennie compose le contrôleur (`controleurDeLaCarte`, la clé sans
// défaut de la carte) : aucune clé de plus. Ce fichier tient la page sur un 1890 auquel on prête des
// dessins qui disent ce qu'ils reçoivent ; `VoyageBoite.test.tsx`, non retouché, tient que la boîte de
// 1890 telle qu'elle est ne lit que la carte et mes films de la décennie.
const CARTE = 'GET /api/me/voyage'
const JOURNAL = 'GET /api/me/journal?limit=100&sortie_min=1890&sortie_max=1899'
const VOYAGEUR = 'GET /api/me/voyage/voyageur'

const VOYAGE = voyage1890(
  1897,
  [
    { annee: 1895, statut: 'ouverte', visitee: true, recompense: 'palme', profondeur: 9 },
    { annee: 1896, statut: 'ouverte', visitee: true, recompense: 'lion', profondeur: 6 },
    { annee: 1897, statut: 'en_cours', visitee: true, recompense: null, profondeur: 2 },
  ],
  { ia: true, source: null, rattrape_la_source: false, depart: 1895 },
)
const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)

const film = (id: string, media: string, date: string, titre: string): JournalItem => {
  const v = visionnage({ id, media, titre, annee: 1896, date })
  v.media.source = 'tmdb'
  v.media.type = 'movie'
  v.media.external_id = '774'
  return v
}
/** Deux séances du même film (le même `media_id`), et un autre film : seule la seconde séance est poinçonnée. */
const PREMIERE = film('e-premiere', 'm-manoir', '2026-09-01', 'Le Manoir du diable')
const SECONDE = film('e-seconde', 'm-manoir', '2026-10-06', 'Le Manoir du diable')
const AUTRE = film('e-autre', 'm-autre', '2026-10-07', 'Une partie de cartes')

const BASE = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
const POINCONNE: Voyageur = { ...BASE, poincons: [{ log_entry_id: SECONDE.entry.id, media_id: SECONDE.media.id, poinconne_le: '2026-10-08T18:00:00.000Z' }] }

const ROUTES = {
  [CARTE]: () => json(VOYAGE),
  [JOURNAL]: () => json({ ...PAGE, items: [SECONDE, AUTRE, PREMIERE], next_cursor: null }),
  [VOYAGEUR]: () => json(POINCONNE),
}

/** Les dessins prêtés : ce qu'ils reçoivent, en une ligne. */
const CasierDuMonde = (p: PropsCasier) => (
  <section aria-label="Le casier du monde">
    <p data-testid="billets">{p.billets.map((b) => `${b.item.entry.id}${p.poinconnes?.has(b.item.entry.id) ? ' poinçonné' : ''}`).join(' | ')}</p>
    {p.billets.map((b) => (
      <button key={b.item.entry.id} type="button" onClick={() => p.onOuvrir(b.item.entry.id)}>
        {`Sortir ${b.item.entry.id}`}
      </button>
    ))}
  </section>
)
const BilletDuMonde = (p: PropsBilletEnGrand) => (
  <section aria-label="Le billet du monde">
    <p data-testid="grand">{`${p.billet.item.entry.id}${p.poinconne ? ' poinçonné' : ''}`}</p>
    <button type="button" onClick={p.onFermer}>
      Ranger
    </button>
  </section>
)
const DESSINS = { casier: CasierDuMonde, billetEnGrand: BilletDuMonde }
/** Le monde compose le contrôleur : la boîte n'en regarde que la présence, jamais le dessin. */
const AVEC_LE_CONTROLEUR = { ...DESSINS, controleurDeLaCarte: () => null }

const dit = (quoi: string) => screen.getByTestId(quoi).textContent
const sansSession = (requetes: string[]) => requetes.filter((r) => r !== 'GET /api/auth/me').sort()

describe('le poinçon doré à la boîte à billets', () => {
  let remettre = () => undefined as void
  const preter = (gabarits: typeof PAGES_1890.gabarits) => {
    const avant = PAGES_1890.gabarits
    PAGES_1890.gabarits = gabarits
    remettre = () => void (PAGES_1890.gabarits = avant)
  }
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    oublierLeBillet()
  })
  afterEach(() => {
    remettre()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    oublierLeBillet()
  })

  // Mutations : le poinçon cherché par `media_id` (la première séance du même film le porterait) ;
  // `poinconnes` que la page ne passe plus au casier ; `poinconne` que la page ne passe plus à la
  // visionneuse, ou que la visionneuse ne passe plus au dessin ; `poinconne` vrai pour tout billet
  // sorti ; une fiche d'année lue pour l'occasion.
  it('un monde qui compose le contrôleur : la boîte lit l’état du voyageur et passe le poinçon de la séance présentée, jamais de l’autre séance du même film', async () => {
    preter(AVEC_LE_CONTROLEUR)
    const { requetes, client } = monterVoyage('/voyage/decennies/1890/billets', ROUTES)
    await waitFor(() => expect(dit('billets')).toBe('e-autre | e-seconde poinçonné | e-premiere'))

    fireEvent.click(screen.getByRole('button', { name: 'Sortir e-seconde' }))
    await waitFor(() => expect(dit('grand')).toBe('e-seconde poinçonné'))
    fireEvent.click(screen.getByRole('button', { name: 'Ranger' }))
    await waitFor(() => expect(screen.queryByTestId('grand')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Sortir e-premiere' }))
    await waitFor(() => expect(dit('grand')).toBe('e-premiere'))

    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(sansSession(requetes)).toEqual([CARTE, JOURNAL, VOYAGEUR].sort())
  })

  // La clé du contrôleur seule ouvre la lecture : composer le casier ou le billet sorti ne suffit pas.
  // Mutations : `enabled` retiré de la lecture ; la lecture ouverte par la clé `casier`.
  it('un monde qui ne compose pas le contrôleur ne lit rien de plus, même s’il dessine son casier', async () => {
    preter(DESSINS)
    const { requetes, client } = monterVoyage('/voyage/decennies/1890/billets', ROUTES)
    await waitFor(() => expect(dit('billets')).toBe('e-autre | e-seconde | e-premiere'))
    fireEvent.click(screen.getByRole('button', { name: 'Sortir e-seconde' }))
    await waitFor(() => expect(dit('grand')).toBe('e-seconde'))
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(sansSession(requetes)).toEqual([CARTE, JOURNAL].sort())
  })

  // La carte a déjà lu l'état du voyageur : il est en cache, et `enabled: false` ne l'empêche pas de se
  // rendre. Mutation : `entreesPoinconnees(voyageur.data)` sans regarder la clé.
  it('un monde qui ne compose pas le contrôleur ne montre aucun poinçon, même avec l’état du voyageur en cache', async () => {
    preter(DESSINS)
    const { requetes, client } = monterVoyage('/voyage/decennies/1890/billets', ROUTES, (c) => c.setQueryData(cles.voyageur, POINCONNE))
    await waitFor(() => expect(dit('billets')).toBe('e-autre | e-seconde | e-premiere'))
    fireEvent.click(screen.getByRole('button', { name: 'Sortir e-seconde' }))
    await waitFor(() => expect(dit('grand')).toBe('e-seconde'))
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(dit('billets')).toBe('e-autre | e-seconde | e-premiere')
    expect(sansSession(requetes)).toEqual([CARTE, JOURNAL].sort())
  })

  // Mutation : l'erreur de l'état du voyageur jointe à la garde des pannes de la page
  // (`voyage.error || journal.error || voyageur.error`).
  it('l’état du voyageur en panne : le casier entier, sans poinçon et sans un mot', async () => {
    preter(AVEC_LE_CONTROLEUR)
    const { requetes, client } = monterVoyage('/voyage/decennies/1890/billets', {
      ...ROUTES,
      [VOYAGEUR]: () => json({ code: 'INTERNAL', message: 'Le contrôleur est souffrant.', retryable: false }, 500),
    })
    await waitFor(() => expect(dit('billets')).toBe('e-autre | e-seconde | e-premiere'))
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(requetes).toContain(VOYAGEUR)
    expect(dit('billets')).toBe('e-autre | e-seconde | e-premiere')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/souffrant/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Réessa/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sortir e-seconde' }))
    await waitFor(() => expect(dit('grand')).toBe('e-seconde'))
  })

  // Mutation : l'état du voyageur joint à la garde du chargement (`!v || !billets || !voyageur.data`).
  it('l’état du voyageur qui tarde ne retient pas le casier : les billets d’abord, le poinçon quand il arrive', async () => {
    preter(AVEC_LE_CONTROLEUR)
    let repondre = (_: Response) => undefined as void
    const tard = new Promise<Response>((r) => void (repondre = r))
    monterVoyage('/voyage/decennies/1890/billets', { ...ROUTES, [VOYAGEUR]: () => tard })
    await waitFor(() => expect(dit('billets')).toBe('e-autre | e-seconde | e-premiere'))
    expect(screen.queryByText('Chargement…')).toBeNull()
    repondre(json(POINCONNE))
    await waitFor(() => expect(dit('billets')).toBe('e-autre | e-seconde poinçonné | e-premiere'))
  })
})
