import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { cles } from '../api/cles'
import { estPrete, type FicheAnnee, type FichePrete, type Horaire, type Voyage } from '../api/voyage'
import { PAGES_1890 } from '../mondes/1890/pages'
import { monterVoyage } from '../test/pageVoyage'
import { json } from '../test/serveur'
import { VOYAGEUR_VIDE, fichePrete, malleVide, voyage1890 } from '../test/voyage'
import type { PropsTeteDAnnee } from '../voyage/annee/Bandeau'
import type { PropsHoraireDeLAnnee } from '../voyage/annee/Horaire'
import type { PropsProgramme } from '../voyage/annee/Programme'

// L'horaire d'une gare (plan des écrans des lots, brief 10) tient à une clé de gabarit **sans
// défaut**, `horaireDeLAnnee` : un monde qui ne la compose pas ne montre rien de l'horaire que la
// fiche sert pourtant. `VoyageAnnee.test.tsx`, monté sur 1890, reste vert sans être retouché ; ce
// fichier tient le bloc lecteur sur un 1890 auquel on prête un dessin qui dit ce qu'il reçoit, et le
// vrai 1890, qui ne dit ni ne lit rien de plus.
const CARTE = 'GET /api/me/voyage'
const ANNEE = 'GET /api/me/voyage/annees/1897'
const TENIR = 'POST /api/me/voyage/annees/1897/horaire'
const RETIRER = 'DELETE /api/me/voyage/annees/1897/horaire'

const ACCEPTE: Horaire = { echeance: '2026-10-18', accepte_le: '2026-10-12T08:00:00.000Z', etat: 'accepte' }
const VOYAGE = voyage1890(
  1897,
  [
    { annee: 1896, statut: 'ouverte', visitee: true, recompense: 'ours', horaire: null },
    { annee: 1897, statut: 'en_cours', visitee: true, recompense: null, horaire: null },
  ],
  { ia: false, source: null, rattrape_la_source: false },
)
const fiche = (s: Partial<FichePrete> = {}): FichePrete => fichePrete({ annee: 1897, ticket: null, maturite: null, generique: null, horaire: null, horaire_proposable: null, ...s })
const PROPOSEE = fiche({ horaire_proposable: '2026-10-18' })
const ACCEPTEE = fiche({ horaire: ACCEPTE })
const TICKET = { annee: 1898, emis_le: '2026-10-10T19:00:00.000Z', utilise_le: null }
const TENUE = fiche({ horaire: { ...ACCEPTE, etat: 'tenu' }, ticket: TICKET })
const MANQUEE = fiche({ horaire: { ...ACCEPTE, etat: 'manque' } })

// `retryable: false` : une panne relancée par TanStack attendrait avant de se dire.
const refus = (status: number, message: string) => json({ code: status === 409 ? 'CONFLICT' : status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message, retryable: false }, status)
const routes = (f: FichePrete, plus: Record<string, (init: RequestInit) => Response | Promise<Response>> = {}) => ({
  [CARTE]: () => json(VOYAGE),
  'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
  [ANNEE]: () => json(f),
  ...plus,
})

/** Le dessin prêté : ce qu'il reçoit, en une ligne, et les gestes qu'on lui offre. */
const HoraireDuMonde = (p: PropsHoraireDeLAnnee) => (
  <section aria-label="L’horaire prêté">
    <p data-testid="horaire">
      {`${p.annee} | ${p.horaire ? `${p.horaire.etat} ${p.horaire.echeance}` : 'aucun'} | proposé : ${p.proposable ?? 'rien'} | arrivée : ${p.arriveeLe ?? 'rien'} | ${p.occupe ? 'occupé' : 'libre'} | vient : ${p.vient ?? 'rien'}`}
    </p>
    {p.onTenir ? (
      <button type="button" onClick={p.onTenir}>
        Tenir l’horaire
      </button>
    ) : null}
    {p.onRetirer ? (
      <button type="button" onClick={p.onRetirer}>
        Sans horaire
      </button>
    ) : null}
    {p.erreur ? <p role="alert">{p.erreur}</p> : null}
  </section>
)

let remettre: (() => void) | null = null
const preter = (gabarits: typeof PAGES_1890.gabarits = { horaireDeLAnnee: HoraireDuMonde }) => {
  const avant = PAGES_1890.gabarits
  PAGES_1890.gabarits = { ...avant, ...gabarits }
  remettre = () => void (PAGES_1890.gabarits = avant)
}
const ligne = () => screen.findByTestId('horaire')
const tenir = () => screen.findByRole('button', { name: 'Tenir l’horaire' })
const retirer = () => screen.findByRole('button', { name: 'Sans horaire' })
const lAnnee = () => screen.findByRole('region', { name: 'L’année 1897' })
const ficheEnCache = (c: ReturnType<typeof monterVoyage>['client']) => {
  const f = c.getQueryData<FicheAnnee>(cles.annee(1897))
  return estPrete(f) ? { horaire: f.horaire, horaire_proposable: f.horaire_proposable } : null
}
const caseEnCache = (c: ReturnType<typeof monterVoyage>['client']) => c.getQueryData<Voyage>(cles.voyage)?.annees.find((a) => a.annee === 1897)?.horaire
/** Une réponse retenue : le test la rend quand il veut, sans rien attendre. */
function retenue() {
  let rendre!: (r: Response) => void
  const promesse = new Promise<Response>((ok) => (rendre = ok))
  return { promesse, rendre }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  localStorage.clear()
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
})
afterEach(() => {
  remettre?.()
  remettre = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('l’horaire, hors d’un monde qui le dessine', () => {
  // Décision 1 du propriétaire : ces écrans sont de 1900 seulement. La liste des requêtes est exigée
  // **entière**. Mutation : une lecture de plus dans la page (l'état du voyageur lu sans regarder la clé).
  it.each([
    ['proposé', PROPOSEE],
    ['tenu', TENUE],
  ])('la fiche d’une année de 1890 ne dit rien d’un horaire %s, et ne lit que la session, la carte et sa fiche', async (_, f) => {
    const { requetes, client } = monterVoyage('/voyage/1897', routes(f))
    const page = await lAnnee()
    await screen.findByRole('region', { name: PAGES_1890.mots.boniment })
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect([...requetes].sort()).toEqual(['GET /api/auth/me', CARTE, ANNEE].sort())
    expect(page).not.toHaveTextContent(/horaire|à l’heure/i)
  })

  // La tête et le programme reçoivent de quoi dire un horaire tenu, mais seulement dans un monde qui
  // compose l'horaire : un monde qui habille sa tête sans lui n'en apprend rien. Mutations : `aLHeure`
  // passé sans regarder la clé ; `horaireTenu` passé sans la regarder.
  it('sans la clé, ni la tête ni le programme d’un monde n’apprennent un horaire tenu', async () => {
    preter({
      teteDAnnee: (p: PropsTeteDAnnee) => <p data-testid="tete">{p.aLHeure ? 'à l’heure' : 'sans mention'}</p>,
      programme: (p: PropsProgramme) => <p data-testid="programme">{p.horaireTenu ? `tenu ${p.horaireTenu.echeance}` : 'sans horaire'}</p>,
    })
    monterVoyage('/voyage/1897', routes(TENUE))
    expect(await screen.findByTestId('programme')).toHaveTextContent('sans horaire')
    expect(screen.getByTestId('tete')).toHaveTextContent('sans mention')
    expect(screen.queryByTestId('horaire')).toBeNull()
  })

  // Mutations : `aLHeure` vrai pour tout horaire (accepté compris) ; l'échéance ou l'arrivée d'un
  // autre champ (`accepte_le` pour l'arrivée).
  it('avec la clé, la tête et le programme reçoivent l’horaire tenu, son échéance et l’instant de l’arrivée, et rien pour un horaire accepté', async () => {
    const gabarits = {
      horaireDeLAnnee: HoraireDuMonde,
      teteDAnnee: (p: PropsTeteDAnnee) => <p data-testid="tete">{p.aLHeure ? 'à l’heure' : 'sans mention'}</p>,
      programme: (p: PropsProgramme) => <p data-testid="programme">{p.horaireTenu ? `tenu ${p.horaireTenu.echeance}, arrivé ${p.horaireTenu.arriveeLe}` : 'sans horaire'}</p>,
    }
    preter(gabarits)
    const tenue = monterVoyage('/voyage/1897', routes(TENUE))
    expect(await screen.findByTestId('programme')).toHaveTextContent('tenu 2026-10-18, arrivé 2026-10-10T19:00:00.000Z')
    expect(screen.getByTestId('tete')).toHaveTextContent('à l’heure')
    tenue.unmount()
    monterVoyage('/voyage/1897', routes(ACCEPTEE))
    expect(await screen.findByTestId('programme')).toHaveTextContent('sans horaire')
    expect(screen.getByTestId('tete')).toHaveTextContent('sans mention')
  })
})

describe('le bloc lecteur de l’horaire', () => {
  // « Tenir l'horaire » ne s'offre pas sans `horaire_proposable` : sans lui ni horaire, le bloc entier
  // n'existe pas (une seule garde, la sortie du bloc). Mutation : le bloc rendu sans horaire ni proposition.
  it('ni horaire ni proposition : le bloc n’existe pas, et rien ne s’offre', async () => {
    preter()
    monterVoyage('/voyage/1897', routes(fiche()))
    await screen.findByRole('region', { name: PAGES_1890.mots.boniment })
    expect(screen.queryByTestId('horaire')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tenir l’horaire' })).toBeNull()
  })

  // Mutation : `proposable` calculé ou retenu au lieu de l'échéance servie ; « Sans horaire » offert
  // sans horaire.
  it('proposé : l’échéance servie, « Tenir l’horaire » seul, sous le programme dans l’ordre par défaut', async () => {
    preter()
    const { requetes } = monterVoyage('/voyage/1897', routes(PROPOSEE))
    expect(await ligne()).toHaveTextContent('1897 | aucun | proposé : 2026-10-18 | arrivée : rien | libre | vient : rien')
    expect(await tenir()).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sans horaire' })).toBeNull()
    const boniment = screen.getByRole('region', { name: PAGES_1890.mots.boniment })
    const parade = screen.getByRole('region', { name: 'La parade, le podium' })
    const bloc = screen.getByRole('region', { name: 'L’horaire prêté' })
    expect(boniment.compareDocumentPosition(bloc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(bloc.compareDocumentPosition(parade) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Le bloc ne lit rien : tout vient de la fiche que la page tient.
    expect(requetes.filter((r) => r.includes('/horaire'))).toEqual([])
  })

  // Mutations : « Sans horaire » offert dès qu'un horaire existe (tenu, manqué) ; « Tenir l'horaire »
  // offert par-dessus un horaire ; l'arrivée passée pour tout état ; l'arrivée lue ailleurs qu'au ticket.
  it.each([
    ['accepté', ACCEPTEE, '1897 | accepte 2026-10-18 | proposé : rien | arrivée : rien | libre | vient : rien', true],
    ['tenu', TENUE, '1897 | tenu 2026-10-18 | proposé : rien | arrivée : 2026-10-10T19:00:00.000Z | libre | vient : rien', false],
    ['manqué', MANQUEE, '1897 | manque 2026-10-18 | proposé : rien | arrivée : rien | libre | vient : rien', false],
    // Un manqué bouclé depuis : son ticket est là, et ce n'est pas une arrivée à l'heure.
    ['manqué puis bouclé', fiche({ horaire: { ...ACCEPTE, etat: 'manque' }, ticket: TICKET }), '1897 | manque 2026-10-18 | proposé : rien | arrivée : rien | libre | vient : rien', false],
  ])('%s : l’état et l’échéance servis, « Sans horaire » seulement tant qu’il est accepté', async (_, f, dit, retirable) => {
    preter()
    monterVoyage('/voyage/1897', routes(f))
    expect(await ligne()).toHaveTextContent(dit)
    expect(screen.queryByRole('button', { name: 'Tenir l’horaire' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sans horaire' }) !== null).toBe(retirable)
  })

  // Mutations : le verrou retiré (deux `POST`) ; l'échéance proposée glissée dans la requête ;
  // `invalidateQueries` sur le préfixe `voyage` (la malle, l'état du voyageur et l'autre fiche
  // seraient périmés) ; une des deux relectures oubliée ; `vient` jamais posé.
  it('« Tenir l’horaire » écrit une fois pour deux touchers, sans corps, puis relit la fiche et la carte, elles seules', async () => {
    preter()
    const corps: unknown[] = []
    let ecrit = false
    const { requetes, client } = monterVoyage(
      '/voyage/1897',
      routes(PROPOSEE, {
        [ANNEE]: () => json(ecrit ? ACCEPTEE : PROPOSEE),
        [CARTE]: () => json(ecrit ? { ...VOYAGE, annees: VOYAGE.annees.map((a) => (a.annee === 1897 ? { ...a, horaire: ACCEPTE } : a)) } : VOYAGE),
        [TENIR]: (init) => {
          corps.push(init.body)
          ecrit = true
          return json(ACCEPTE, 201)
        },
      }),
      (c) => {
        c.setQueryData(cles.malle(1890), malleVide(1890))
        c.setQueryData(cles.voyageur, VOYAGEUR_VIDE)
        c.setQueryData(cles.annee(1896), fiche({ annee: 1896 }))
      },
    )
    const bouton = await tenir()
    await waitFor(() => expect(client.isFetching()).toBe(0))
    const avant = requetes.length
    fireEvent.click(bouton)
    fireEvent.click(bouton)
    await waitFor(() => expect(screen.getByTestId('horaire')).toHaveTextContent('1897 | accepte 2026-10-18 | proposé : rien | arrivée : rien | libre | vient : accepte'))
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(requetes.slice(avant).sort()).toEqual([CARTE, ANNEE, TENIR].sort())
    expect(corps).toEqual([undefined])
    for (const cle of [cles.malle(1890), cles.voyageur, cles.annee(1896)]) expect(client.getQueryState(cle)?.isInvalidated).toBe(false)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  // Accepté, tout est su par la réponse : l'écran ne reste pas sur la proposition quand la relecture
  // tombe. Mutations : la fiche du cache non écrite (la proposition resterait, fausse) ; la case de
  // la carte non écrite ; toutes les cases de la carte écrites.
  it('accepté, la fiche et la carte en cache l’apprennent de la réponse, même si leur relecture tombe en panne', async () => {
    preter()
    let ecrit = false
    const { client } = monterVoyage(
      '/voyage/1897',
      routes(PROPOSEE, {
        [ANNEE]: () => (ecrit ? refus(400, 'La fiche est en panne.') : json(PROPOSEE)),
        [CARTE]: () => (ecrit ? refus(400, 'La carte est en panne.') : json(VOYAGE)),
        [TENIR]: () => ((ecrit = true), json(ACCEPTE, 201)),
      }),
    )
    fireEvent.click(await tenir())
    await waitFor(() => expect(screen.getByTestId('horaire')).toHaveTextContent('1897 | accepte 2026-10-18 | proposé : rien'))
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(screen.getByTestId('horaire')).toHaveTextContent('1897 | accepte 2026-10-18 | proposé : rien')
    expect(ficheEnCache(client)).toEqual({ horaire: ACCEPTE, horaire_proposable: null })
    expect(caseEnCache(client)).toEqual(ACCEPTE)
    // Sa case seule : l'horaire d'une gare n'est pas celui de la voisine.
    expect(client.getQueryData<Voyage>(cles.voyage)?.annees.map((a) => [a.annee, a.horaire?.etat ?? null])).toEqual([
      [1896, null],
      [1897, 'accepte'],
    ])
  })

  // Mutations : le verrou retiré (deux `DELETE`) ; `vient` gardé au geste suivant ; la proposition calculée sur l'appareil au lieu
  // d'être relue ; la fiche écrite à la main avant sa relecture (le bloc disparaîtrait le temps de la
  // relecture : `occupé` ne se verrait jamais avec l'horaire encore à l'écran).
  it('« Sans horaire » retire une fois pour deux touchers, et la gare repropose l’échéance que la fiche relue sert', async () => {
    preter()
    let ecrit = false
    const relue = retenue()
    const { requetes, client } = monterVoyage(
      '/voyage/1897',
      routes(ACCEPTEE, {
        [ANNEE]: () => (ecrit ? relue.promesse : json(ACCEPTEE)),
        [RETIRER]: () => ((ecrit = true), new Response(null, { status: 204 })),
        [TENIR]: () => refus(400, 'Pas ce soir.'),
      }),
    )
    const bouton = await retirer()
    await waitFor(() => expect(client.isFetching()).toBe(0))
    fireEvent.click(bouton)
    fireEvent.click(bouton)
    // Le temps de la relecture, l'horaire reste à l'écran, occupé : rien ne clignote, rien n'est faux longtemps.
    await waitFor(() => expect(requetes.filter((r) => r === ANNEE)).toHaveLength(2))
    expect(screen.getByTestId('horaire')).toHaveTextContent('1897 | accepte 2026-10-18 | proposé : rien | arrivée : rien | occupé | vient : rien')
    // Un autre dimanche que celui d'avant : la proposition est celle du serveur.
    await act(async () => relue.rendre(json(fiche({ horaire_proposable: '2026-10-25' }))))
    await waitFor(() => expect(screen.getByTestId('horaire')).toHaveTextContent('1897 | aucun | proposé : 2026-10-25 | arrivée : rien | libre | vient : retire'))
    expect(requetes.filter((r) => r === RETIRER)).toHaveLength(1)
    expect(caseEnCache(client)).toBeNull()
    // Ce que le geste d'avant venait de faire ne se redit pas sous le refus du suivant.
    fireEvent.click(await tenir())
    expect(await screen.findByRole('alert')).toHaveTextContent('Pas ce soir.')
    expect(screen.getByTestId('horaire')).toHaveTextContent('1897 | aucun | proposé : 2026-10-25 | arrivée : rien | libre | vient : rien')
  })

  // Mutations : le repli retiré (l'horaire retiré resterait « accepté » à l'écran, « Sans horaire »
  // offert) ; la case de la carte non écrite.
  it('retiré, puis la fiche relue en panne : l’écran ne dit plus un horaire qui n’existe plus', async () => {
    preter()
    let ecrit = false
    const { client } = monterVoyage(
      '/voyage/1897',
      routes(ACCEPTEE, {
        [ANNEE]: () => (ecrit ? refus(400, 'La fiche est en panne.') : json(ACCEPTEE)),
        [CARTE]: () => (ecrit ? refus(400, 'La carte est en panne.') : json({ ...VOYAGE, annees: VOYAGE.annees.map((a) => (a.annee === 1897 ? { ...a, horaire: ACCEPTE } : a)) })),
        [RETIRER]: () => ((ecrit = true), new Response(null, { status: 204 })),
      }),
    )
    fireEvent.click(await retirer())
    await waitFor(() => expect(ficheEnCache(client)).toEqual({ horaire: null, horaire_proposable: null }))
    await waitFor(() => expect(screen.queryByTestId('horaire')).toBeNull())
    expect(screen.queryByRole('button', { name: 'Sans horaire' })).toBeNull()
    expect(caseEnCache(client)).toBeNull()
  })

  // Un `409` (la gare a changé ailleurs) et le `404` d'un horaire déjà retiré ne sont pas des pannes.
  // Mutations : le `409` dit comme une erreur ; le `404` dit comme une erreur ; aucune relecture
  // après eux (l'écran resterait sur ce que le serveur refuse).
  it.each([
    ['409 à l’acceptation', PROPOSEE, TENIR, 409, 'Cette gare a déjà son horaire : un horaire manqué ne se reprend pas.', MANQUEE, '1897 | manque 2026-10-18'],
    ['409 au retrait', ACCEPTEE, RETIRER, 409, 'Cet horaire est tenu : il ne se retire plus.', TENUE, '1897 | tenu 2026-10-18'],
    ['404 au retrait', ACCEPTEE, RETIRER, 404, 'Cette gare n’a pas d’horaire.', PROPOSEE, '1897 | aucun | proposé : 2026-10-18'],
  ])('un %s ne dit rien : la fiche et la carte se relisent, et l’écran dit ce qu’elles servent', async (_, depart, ecriture, status, message, apres, dit) => {
    preter()
    let refuse = false
    const { requetes, client } = monterVoyage(
      '/voyage/1897',
      routes(depart, {
        [ANNEE]: () => json(refuse ? apres : depart),
        [ecriture]: () => ((refuse = true), refus(status, message)),
      }),
    )
    const bouton = ecriture === TENIR ? await tenir() : await retirer()
    await waitFor(() => expect(client.isFetching()).toBe(0))
    const avant = requetes.length
    fireEvent.click(bouton)
    await waitFor(() => expect(screen.getByTestId('horaire')).toHaveTextContent(dit))
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(requetes.slice(avant).sort()).toEqual([CARTE, ANNEE, ecriture].sort())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(message)).toBeNull()
    expect(screen.getByTestId('horaire')).toHaveTextContent('vient : rien')
  })

  // Mutations : l'erreur jamais dite ; un message écrit ici à la place de celui du serveur ; le
  // verrou jamais rendu (le second toucher n'écrirait pas) ; l'erreur gardée après le geste refait.
  it('un refus qui porte un message le dit tel quel, rien ne se relit, et le geste se refait', async () => {
    preter()
    let n = 0
    const { requetes, client } = monterVoyage(
      '/voyage/1897',
      routes(PROPOSEE, {
        [TENIR]: () => ((n += 1), n === 1 ? refus(400, 'Cette année n’est pas du Voyage.') : json(ACCEPTE, 201)),
        [ANNEE]: () => json(n < 2 ? PROPOSEE : ACCEPTEE),
      }),
    )
    const bouton = await tenir()
    await waitFor(() => expect(client.isFetching()).toBe(0))
    const avant = requetes.length
    fireEvent.click(bouton)
    expect(await screen.findByRole('alert')).toHaveTextContent('Cette année n’est pas du Voyage.')
    expect(requetes.slice(avant)).toEqual([TENIR])
    expect(screen.getByTestId('horaire')).toHaveTextContent('1897 | aucun | proposé : 2026-10-18 | arrivée : rien | libre | vient : rien')
    fireEvent.click(screen.getByRole('button', { name: 'Tenir l’horaire' }))
    await waitFor(() => expect(screen.getByTestId('horaire')).toHaveTextContent('1897 | accepte 2026-10-18'))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(requetes.filter((r) => r === TENIR)).toHaveLength(2)
  })

  // Mutation : la panne du réseau tue (aucune alerte) ; le verrou jamais rendu.
  it('une panne du réseau se dit, l’horaire reste ce qu’il était, et la demande se rejoue', async () => {
    preter()
    let n = 0
    const { requetes } = monterVoyage(
      '/voyage/1897',
      routes(ACCEPTEE, {
        [RETIRER]: () => {
          n += 1
          if (n === 1) throw new TypeError('Failed to fetch')
          return new Response(null, { status: 204 })
        },
        [ANNEE]: () => json(n < 2 ? ACCEPTEE : PROPOSEE),
      }),
    )
    fireEvent.click(await retirer())
    expect((await screen.findByRole('alert')).textContent).not.toBe('')
    expect(screen.getByTestId('horaire')).toHaveTextContent('1897 | accepte 2026-10-18 | proposé : rien | arrivée : rien | libre')
    fireEvent.click(screen.getByRole('button', { name: 'Sans horaire' }))
    await waitFor(() => expect(screen.getByTestId('horaire')).toHaveTextContent('1897 | aucun | proposé : 2026-10-18'))
    expect(requetes.filter((r) => r === RETIRER)).toHaveLength(2)
  })

  // Ce que le cache doit apprendre survit au départ : la carte, où l'on va, lit ce cache. Mutation :
  // l'écriture du cache passée dans les rappels de `mutate`, que TanStack tait page quittée.
  it('la page quittée pendant l’écriture, le cache apprend quand même l’horaire accepté', async () => {
    preter()
    const reponse = retenue()
    const { requetes, client, unmount } = monterVoyage('/voyage/1897', routes(PROPOSEE, { [TENIR]: () => reponse.promesse }))
    fireEvent.click(await tenir())
    await waitFor(() => expect(requetes).toContain(TENIR))
    unmount()
    await act(async () => reponse.rendre(json(ACCEPTE, 201)))
    await waitFor(() => expect(ficheEnCache(client)).toEqual({ horaire: ACCEPTE, horaire_proposable: null }))
    expect(caseEnCache(client)).toEqual(ACCEPTE)
  })
})
