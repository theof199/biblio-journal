import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { cles } from '../api/cles'
import type { JournalItem, JournalPage } from '../api/journal'
import type { ReactionsCatalogue } from '../api/reactions'
import type { FichePrete, Malle } from '../api/voyage'
import { PAGES_1890 } from '../mondes/1890/pages'
import { exemple } from '../test/contrat'
import { SESSION, monterVoyage } from '../test/pageVoyage'
import { json } from '../test/serveur'
import { fichePrete, filmDeSalle, salle, voyage1890 } from '../test/voyage'
import { confierLeRetour, oublierLeRetour } from '../voyage/annee/retour'
import { oublierLeBillet } from '../voyage/billet/range'
import type { PropsFeteDuBadge } from '../voyage/celebrations/BadgeColle'
import type { EtatDeFete } from '../voyage/celebrations/scenes'

// La fête d'une étiquette de la malle (plan des écrans des lots, brief 6) tient à une clé de gabarit
// **sans défaut**, `feteDuBadge` : un monde qui ne la compose pas ne lit la malle ni sur le billet ni
// au retour. `VoyageBillet.test.tsx` et `VoyageAnnee.test.tsx`, montés sur 1890, restent verts sans
// être retouchés ; ce fichier tient les deux lectures, sur un 1890 auquel on prête un dessin qui dit
// ce qu'il reçoit, et sur le vrai 1890, qui ne lit rien.
const MALLE = 'GET /api/me/voyage/decennies/1890/etiquettes'
const CARTE = 'GET /api/me/voyage'
const ANNEE = 'GET /api/me/voyage/annees/1897'
const JOURNAL = 'POST /api/me/journal'
const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)

const VOYAGE = voyage1890(1897, [{ annee: 1897, statut: 'en_cours', visitee: true, recompense: null }], { ia: false, source: null, rattrape_la_source: false })
const FAUCON = filmDeSalle({ id: 'f-faucon', tmdb_id: 963, title: 'Le Faucon maltais', year: 1897, etat: 'a_demander', plex_url: null })
const fiche = (s: Partial<FichePrete> = {}): FichePrete =>
  fichePrete({
    annee: 1897,
    profondeur: 2,
    progression: { essentiels_vus: 0, essentiels_total: 2, salles_completes: 0, salles_autres: 1 },
    recompense: null,
    ticket: null,
    maturite: null,
    generique: null,
    salles: [salle({ id: 's-ess', nom: 'Les essentiels', films: [FAUCON] })],
    ...s,
  })
/** La fiche relue : l'Ours gagné et le ticket de 1898 émis, de quoi jouer une scène avant l'étiquette et une après. */
const GAGNEE = fiche({ profondeur: 3, recompense: 'ours', ticket: { annee: 1898, emis_le: '2026-09-21T21:00:00.000Z', utilise_le: null } })

/** L'exemple du contrat : la 7, « La Correspondance », collée ; la 8 et la 12 en trace de colle ; la 15 cachée. */
const COLLEE: Malle = { ...exemple<Malle>('/me/voyage/decennies/{decennie}/etiquettes', 'get', 200), decennie: 1890 }
/** La même malle avant le billet : la 7 en trace de colle, à un pas du seuil. */
const PAS_ENCORE: Malle = { ...COLLEE, collees: 0, etiquettes: COLLEE.etiquettes.map((p) => (p.numero === 7 ? { ...p, collee_le: null, progression: { fait: 0, seuil: 1 } } : p)) }
// `retryable: false` : une panne relancée par TanStack attendrait avant de se dire.
const panne = () => json({ code: 'VALIDATION_ERROR', message: 'La malle est en panne.', retryable: false }, 400)

/** Le dessin prêté : ce qu'il reçoit, en une ligne. */
const BadgeDuMonde = (p: PropsFeteDuBadge) => (
  <p data-testid="badge">{`${p.sur} | ${p.scene.place.nom} | ${p.scene.place.devise} | pas ${p.pas} | ${p.fini ? 'fini' : 'en cours'} | avant : ${p.scene.deja.map((d) => d.numero).join(' ') || 'rien'}`}</p>
)

const calme = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
const dialogue = (nom: string) => screen.findByRole('dialog', { name: nom })
const continuer = () => fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
const lAnnee = () => screen.findByRole('region', { name: 'L’année 1897' })
const desMalles = (requetes: string[]) => requetes.filter((r) => r.includes('/etiquettes'))

let remettre: (() => void) | null = null
const preter = () => {
  const avant = PAGES_1890.gabarits
  PAGES_1890.gabarits = { ...avant, feteDuBadge: BadgeDuMonde }
  remettre = () => void (PAGES_1890.gabarits = avant)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  localStorage.clear()
  oublierLeRetour(1897)
  oublierLeBillet()
  calme()
})
afterEach(() => {
  remettre?.()
  remettre = null
  oublierLeRetour(1897)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('la malle d’avant, lue par le billet', () => {
  /** Le serveur d'un billet : la fiche et la malle rendent leur « après » une fois le visionnage écrit. */
  function serveur(malleAvant: () => Response = () => json(PAS_ENCORE)) {
    const etat = { ecrit: false }
    const entree = exemple<JournalItem>('/me/journal', 'post', 201)
    entree.media.year = 1897
    return {
      [CARTE]: () => json(VOYAGE),
      'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
      [ANNEE]: () => json(etat.ecrit ? GAGNEE : fiche()),
      [MALLE]: () => (etat.ecrit ? json(COLLEE) : malleAvant()),
      'GET /api/reference/reactions': () => json(exemple<ReactionsCatalogue>('/reference/reactions', 'get', 200)),
      'GET /api/me/journal?limit=100&sortie_min=1890&sortie_max=1899': () => json({ ...PAGE, items: [], next_cursor: null }),
      'POST /api/media': () => json(exemple('/media', 'post', 201), 201),
      [JOURNAL]: () => {
        etat.ecrit = true
        return json(entree, 201)
      },
    }
  }
  const BILLET = `/voyage/1897/films/${FAUCON.id}/billet`
  const composter = () => screen.findByRole('button', { name: /Tamponner « Vu »/ })

  // Décision 1 du propriétaire : ces écrans sont de 1900 seulement. Mutations : la lecture de la
  // malle du billet sans regarder la clé (`enabled: true`) ; celle de l'année sans la regarder.
  it('un monde qui ne dessine pas cette fête ne lit la malle ni sur le billet ni au retour, et ne fête aucune étiquette', async () => {
    const { requetes } = monterVoyage(BILLET, serveur())
    fireEvent.click(await composter())
    await lAnnee()
    expect(await dialogue('L’Ours : trois films de 1897')).toBeInTheDocument()
    continuer()
    expect(screen.getByRole('dialog', { name: '1897 est bouclée' })).toBeInTheDocument()
    expect(desMalles(requetes)).toEqual([])
  })

  // Décision 4 : le billet lit la malle en s'ouvrant, et la confie telle qu'elle était **avant**
  // l'écriture. Mutations : `fete.malle` oubliée du retour (rien à comparer) ; la malle lue par
  // l'année seule, sans avant (rien ne se fêterait, ou tout).
  it('le billet lit la malle en s’ouvrant, sans rien écrire, et l’étiquette qu’il colle se fête sur l’année, entre la récompense et l’année bouclée', async () => {
    preter()
    const { requetes } = monterVoyage(BILLET, serveur())
    const bouton = await composter()
    await waitFor(() => expect(desMalles(requetes)).toEqual([MALLE]))
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([])
    fireEvent.click(bouton)
    await lAnnee()
    expect(await dialogue('L’Ours : trois films de 1897')).toBeInTheDocument()
    continuer()
    expect(screen.getByRole('dialog', { name: 'Étiquette collée : La Correspondance' })).toBeInTheDocument()
    expect(screen.getByTestId('badge')).toHaveTextContent('Étiquette collée | La Correspondance | Deux gares · un soir | pas 3 | fini | avant : rien')
    continuer()
    expect(screen.getByRole('dialog', { name: '1897 est bouclée' })).toBeInTheDocument()
  })

  // « Sans avant, aucune scène : la sacoche le dira. » Mutation : un avant vide à la place d'aucun
  // avant (`?? []` dans le billet) : toute la malle se fêterait.
  it('une malle que le billet n’a pas pu lire ne fête rien au retour, même relue depuis', async () => {
    preter()
    const { requetes } = monterVoyage(BILLET, serveur(panne))
    const bouton = await composter()
    await waitFor(() => expect(desMalles(requetes)).toEqual([MALLE]))
    fireEvent.click(bouton)
    await lAnnee()
    expect(await dialogue('L’Ours : trois films de 1897')).toBeInTheDocument()
    continuer()
    expect(screen.getByRole('dialog', { name: '1897 est bouclée' })).toBeInTheDocument()
    expect(screen.queryByTestId('badge')).toBeNull()
  })
})

describe('la malle relue par l’année, au retour d’un billet', () => {
  const FETE: EtatDeFete = { sallesCompletes: 0, salles: [], recompense: null, ticket: null }
  const avant = (malle?: Malle) => ({ profondeur: 2, progression: fiche().progression, fete: malle ? { ...FETE, malle: malle.etiquettes } : FETE })
  const routes = (malle: () => Response | Promise<Response>) => ({
    [CARTE]: () => json(VOYAGE),
    'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
    [ANNEE]: () => json(GAGNEE),
    [MALLE]: malle,
  })
  /** Comme en venant du billet : la carte et la fiche d'avant sont en cache ; la malle, celle qu'on dit. */
  const monter = (malle: () => Response | Promise<Response>, enCache?: Malle) =>
    monterVoyage('/voyage/1897', routes(malle), (c) => {
      c.setQueryData(cles.voyage, VOYAGE)
      c.setQueryData(cles.annee(1897), fiche())
      if (enCache) c.setQueryData(cles.malle(1890), enCache)
    })
  /** La fiche est relue : ce qui devait se fêter sans la malle l'aurait été. */
  const ficheRelue = async (client: ReturnType<typeof monter>['client']) => {
    await lAnnee()
    await waitFor(() => expect(client.getQueryState(cles.annee(1897))?.dataUpdateCount).toBeGreaterThan(1))
    await act(async () => undefined)
  }

  // La malle relue par le billet (qui l'a périmée) peut être en cache, fraîche, avant ce montage : elle
  // ne compte pas, l'année la relit toujours et attend sa réponse pour ranger les scènes. Mutations :
  // `refetchOnMount: 'always'` retiré (la fête ne partirait jamais) ; la malle non attendue (la
  // récompense et l'année se joueraient sans l'étiquette, ou l'étiquette après l'année bouclée).
  it('la fête attend la malle relue, et l’étiquette prend son rang entre la récompense et l’année bouclée', async () => {
    preter()
    confierLeRetour(1897, SESSION.user.id, { avant: avant(PAS_ENCORE), guet: null })
    let repondre!: (r: Response) => void
    const { client, requetes } = monter(() => new Promise<Response>((r) => (repondre = r)), COLLEE)
    await ficheRelue(client)
    expect(desMalles(requetes)).toEqual([MALLE])
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => repondre(json(COLLEE)))
    expect(await dialogue('L’Ours : trois films de 1897')).toBeInTheDocument()
    continuer()
    expect(screen.getByRole('dialog', { name: 'Étiquette collée : La Correspondance' })).toBeInTheDocument()
    continuer()
    expect(screen.getByRole('dialog', { name: '1897 est bouclée' })).toBeInTheDocument()
  })

  // Mutation : la malle d'après lue dans le cache sans attendre la relecture réussie (`malle.data`
  // pris malgré `isError`) : l'étiquette du cache se fêterait sur une panne.
  it('une relecture en panne ne fête aucune étiquette, même si le cache en porte une de plus, et le reste se fête', async () => {
    preter()
    confierLeRetour(1897, SESSION.user.id, { avant: avant(PAS_ENCORE), guet: null })
    const { requetes } = monter(panne, COLLEE)
    expect(await dialogue('L’Ours : trois films de 1897')).toBeInTheDocument()
    expect(desMalles(requetes)).toEqual([MALLE])
    continuer()
    expect(screen.getByRole('dialog', { name: '1897 est bouclée' })).toBeInTheDocument()
    expect(screen.queryByTestId('badge')).toBeNull()
  })

  // Le jumeau du billet de 1890, sur l'année seule : même si un retour lui confie une malle, un monde
  // qui ne dessine pas cette fête ne la relit pas. Mutation : `gabaritSeul` retiré d'`attendLaMalle`.
  it('un monde qui ne dessine pas cette fête ne relit pas la malle, quoi que le retour confie', async () => {
    confierLeRetour(1897, SESSION.user.id, { avant: avant(PAS_ENCORE), guet: null })
    const { requetes } = monter(() => json(COLLEE), COLLEE)
    expect(await dialogue('L’Ours : trois films de 1897')).toBeInTheDocument()
    continuer()
    expect(screen.getByRole('dialog', { name: '1897 est bouclée' })).toBeInTheDocument()
    expect(desMalles(requetes)).toEqual([])
  })

  // Mutations : la malle lue par toute année ouverte dans ce monde (`enabled` sans le retour) ; la
  // scène tirée du cache au montage, sans retour.
  it('au rechargement, ou sans retour, l’année ne lit pas la malle et ne fête rien', async () => {
    preter()
    const { client, requetes } = monter(() => json(COLLEE), PAS_ENCORE)
    await ficheRelue(client)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(desMalles(requetes)).toEqual([])
  })

  // Le retour d'un billet qui n'avait pas lu la malle : le reste se fête, sans elle ni sa lecture.
  // Mutation : `!!retour?.avant?.fete?.malle` retiré de `attendLaMalle`.
  it('un retour sans malle d’avant fête le reste, sans lire la malle', async () => {
    preter()
    confierLeRetour(1897, SESSION.user.id, { avant: avant(), guet: null })
    const { requetes } = monter(() => json(COLLEE), COLLEE)
    expect(await dialogue('L’Ours : trois films de 1897')).toBeInTheDocument()
    continuer()
    expect(screen.getByRole('dialog', { name: '1897 est bouclée' })).toBeInTheDocument()
    expect(desMalles(requetes)).toEqual([])
  })
})
