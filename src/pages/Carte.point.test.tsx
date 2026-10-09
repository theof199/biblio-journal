import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import type { CartePostaleRecue, Courrier, Malle, ObjetRamasse, Voyageur } from '../api/voyage'
import { FabriqueMoteurContexte } from '../carte/CarteCanvas'
import stylesDeLaCarte from '../carte/Carte.module.css'
import { exemple } from '../test/contrat'
import { moteurFactice } from '../test/moteurFactice'
import { json, servir } from '../test/serveur'
import { COURRIER_VIDE, voyage1890 } from '../test/voyage'

/**
 * Le point rouge de la pastille de la sacoche (plan des écrans des lots, brief 5), côté page : ce que
 * la carte lit pour lui, quand il s'allume, ce que dit le nom du lien, ce qui l'éteint et le rallume
 * sans rien relire, et qu'il se tait en panne. Le registre est le vrai ; le moteur est factice. Rien
 * ici ne regarde un dessin.
 */
const SESSION = exemple<{ user: { id: string; pseudo: string } }>('/auth/me', 'get', 200)
const LIRE = 'GET /api/me/voyage/voyageur'
const MALLE_1900 = 'GET /api/me/voyage/decennies/1900/etiquettes'
const BOITE = 'GET /api/me/voyage/cartes-postales'
const RAMASSER_LE_MELON = 'POST /api/me/voyage/objets/melon/ramasser'
const VUE = (rubrique: string) => `POST /api/me/voyage/rubriques/${rubrique}/vue`
const SACOCHE = 'Sacoche du voyageur'
const ETIQUETTE = 'une étiquette vient d’être collée sur la malle'
const OBJET = 'un objet trouvé en gare'
const COURRIER = 'une carte postale est arrivée'
/** L'exemple du contrat : une carte reçue de bob postée le 6 octobre 2026 (déjà lue le même jour), une envoyée le 5. */
const BOITE_DU_CONTRAT = exemple<Courrier>('/me/voyage/cartes-postales', 'get', 200)
const RECUE: CartePostaleRecue = BOITE_DU_CONTRAT.recues[0]!
const boite = (b: Courrier) => ({ [BOITE]: () => json(b) })

const LANTERNE: ObjetRamasse = { cle: 'lanterne', annee: 1900, ramasse_le: '2026-10-03T09:00:00.000Z' }
const MELON: ObjetRamasse = { cle: 'melon', annee: 1901, ramasse_le: '2026-10-08T10:00:00.000Z' }
/** L'exemple du contrat : la Correspondance collée le 29 septembre 2026, les autres places sans date. */
const MALLE: Malle = { ...exemple<Malle>('/me/voyage/decennies/{decennie}/etiquettes', 'get', 200), decennie: 1900 }
const BASE = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
/** Un état dont chaque rubrique porte la visite donnée ; une rubrique absente de `vues` n'a jamais été ouverte. */
const etat = (objets: ObjetRamasse[], vues: Record<string, string>): Voyageur => ({
  ...BASE,
  objets,
  rubriques: ['etiquette', 'objet', 'bobine', 'courrier'].map((rubrique) => ({ rubrique, vue_le: vues[rubrique] ?? null })),
})
const AVANT_TOUT = '2026-09-01T00:00:00.000Z'
const APRES_TOUT = '2026-10-07T00:00:00.000Z'
/** Tout est vu : ni l'étiquette du 29 septembre ni la lanterne du 3 octobre ne sont neuves. */
const TOUT_VU = etat([LANTERNE], { etiquette: APRES_TOUT, objet: APRES_TOUT })

/** Un Voyage de 1895 à `fin`, toutes les années ouvertes jusqu'à `enCours`. */
const voyage = (enCours: number, fin = 1909) =>
  voyage1890(
    enCours,
    Array.from({ length: fin - 1895 + 1 }, (_, i) => {
      const annee = 1895 + i
      return annee < enCours
        ? { annee, statut: 'ouverte' as const, visitee: true, recompense: null, progression: null }
        : { annee, statut: annee === enCours ? ('en_cours' as const) : ('verrouillee' as const), visitee: false, recompense: null, progression: null, profondeur: 0 }
    }),
  )

type Routes = Record<string, (init: RequestInit) => Response | Promise<Response>>

/** La carte d'un membre, montée et donnée au moteur ; `calme` attend que plus rien ne se lise ni ne s'écrive. */
async function monter(voyageur: Voyageur, routes: Routes = {}, { enCours = 1903, fin = 1909 }: { enCours?: number; fin?: number } = {}) {
  const f = moteurFactice()
  const client = createQueryClient()
  const requetes = servir({
    'GET /api/auth/me': () => json(SESSION),
    'GET /api/me/voyage': () => json(voyage(enCours, fin)),
    'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
    [LIRE]: () => json(voyageur),
    [MALLE_1900]: () => json(MALLE),
    [BOITE]: () => json(COURRIER_VIDE),
    ...routes,
  })
  render(
    <QueryClientProvider client={client}>
      <FabriqueMoteurContexte.Provider value={f.fabrique}>
        <MemoryRouter initialEntries={['/voyage']}>
          <App />
        </MemoryRouter>
      </FabriqueMoteurContexte.Provider>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(f.etats.length).toBeGreaterThan(0))
  const calme = () => waitFor(() => expect(client.isFetching() + client.isMutating()).toBe(0))
  return { ...f, client, requetes, calme }
}

/** Le lien de la sacoche, par le début de son nom : il n'y en a qu'un. */
const lien = () => screen.getByRole('link', { name: new RegExp(`^${SACOCHE}`) })
const nom = () => lien().getAttribute('aria-label')
const points = () => lien().querySelectorAll(`.${stylesDeLaCarte.point}`).length
const laCarteEstLa = () => expect(screen.getByRole('heading', { level: 1, name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()

describe('le point rouge de la sacoche, sur la carte de 1900', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  // Mutations : le suffixe toujours posé (`nomDeLaSacoche` sans sa garde) ; le point toujours monté ;
  // le titre laissé à « Sacoche du voyageur » quand le nom change.
  it('rien de neuf : pas de point, et le lien se nomme exactement « Sacoche du voyageur »', async () => {
    const banc = await monter(TOUT_VU)
    await banc.calme()
    expect(nom()).toBe(SACOCHE)
    expect(lien()).toHaveAttribute('title', SACOCHE)
    expect(points()).toBe(0)
    // La carte a lu, une fois chacun, l'état du voyageur et la malle de la décennie de mon année en cours.
    expect(banc.requetes.filter((r) => r === LIRE)).toHaveLength(1)
    expect(banc.requetes.filter((r) => r === MALLE_1900)).toHaveLength(1)
  })

  // Mutations : les `collee_le` jamais passés (la malle non lue : `enabled: false`) ; les `ramasse_le`
  // jamais passés ; une seule phrase gardée quand deux rubriques sont allumées ; le point non monté.
  it.each([
    ['une étiquette collée depuis ma visite', etat([LANTERNE], { etiquette: AVANT_TOUT, objet: APRES_TOUT }), `${SACOCHE} : ${ETIQUETTE}`],
    ['un objet ramassé depuis ma visite', etat([LANTERNE], { etiquette: APRES_TOUT, objet: AVANT_TOUT }), `${SACOCHE} : ${OBJET}`],
    ['les deux, jamais ouvertes', etat([LANTERNE], {}), `${SACOCHE} : ${ETIQUETTE} et ${OBJET}`],
  ])('%s : le point s’allume, et le nom du lien dit pourquoi', async (_cas, voyageur, attendu) => {
    const banc = await monter(voyageur)
    await banc.calme()
    expect(nom()).toBe(attendu)
    expect(lien()).toHaveAttribute('title', attendu)
    expect(points()).toBe(1)
  })

  // Le courrier (brief 13) : la carte lit ma boîte pour les `postee_le` des cartes **reçues**, comparés
  // à ma visite de la rubrique. Mutations : la boîte jamais lue (`enabled: false` dans `Carte.tsx`) ;
  // les envoyées comptées (`RUBRIQUES_DE_LA_PASTILLE`) ; les seules cartes non lues (la carte du
  // contrat est déjà lue : le point ne dépend que de la visite de la rubrique) ; la phrase du courrier
  // rangée après celle des objets.
  it.each([
    ['une carte reçue depuis ma visite, même déjà lue', etat([LANTERNE], { etiquette: APRES_TOUT, objet: APRES_TOUT, courrier: AVANT_TOUT }), BOITE_DU_CONTRAT, `${SACOCHE} : ${COURRIER}`, 1],
    ['une carte reçue, la rubrique jamais ouverte, avec le reste', etat([LANTERNE], {}), BOITE_DU_CONTRAT, `${SACOCHE} : ${ETIQUETTE} et ${COURRIER} et ${OBJET}`, 1],
    ['une carte reçue avant ma visite', etat([LANTERNE], { etiquette: APRES_TOUT, objet: APRES_TOUT, courrier: APRES_TOUT }), BOITE_DU_CONTRAT, SACOCHE, 0],
    ['des cartes envoyées seules, la rubrique jamais ouverte', TOUT_VU, { ...BOITE_DU_CONTRAT, recues: [] }, SACOCHE, 0],
  ])('le courrier, %s : le point et le nom du lien suivent, et la boîte est lue une fois', async (_cas, voyageur, lue, attendu, n) => {
    const banc = await monter(voyageur, boite(lue))
    await waitFor(() => expect(nom()).toBe(attendu))
    await banc.calme()
    expect(nom()).toBe(attendu)
    expect(points()).toBe(n)
    expect(banc.requetes.filter((r) => r === BOITE)).toHaveLength(1)
  })

  // **Une carte postale ne se montre que dans la sacoche** : la carte du Voyage lit la boîte pour ses
  // dates, et n'en écrit rien, ni à l'écran, ni dans un nom, ni dans un titre. Mutation : le mot de la
  // dernière carte ajouté au nom du lien (`nomDeLaSacoche`), ou le pseudo de l'expéditeur à sa phrase.
  it('la carte du Voyage ne dit rien d’une carte postale : ni son mot, ni qui l’envoie, nulle part dans la page', async () => {
    const banc = await monter(etat([LANTERNE], {}), boite(BOITE_DU_CONTRAT))
    await waitFor(() => expect(nom()).toContain(COURRIER))
    await banc.calme()
    const page = document.body.outerHTML
    for (const prive of [RECUE.mot, BOITE_DU_CONTRAT.envoyees[0]!.mot, RECUE.id]) expect(page).not.toContain(prive)
    expect(document.title).not.toContain(RECUE.mot)
    expect(nom()).not.toContain(RECUE.expediteur.pseudo)
  })

  // `bobine` et `courrier` jamais ouvertes, une rubrique inconnue servie : rien ne s'allume par elles.
  // Mutation : le point allumé dès qu'une rubrique servie n'a pas de `vue_le`.
  it('ni « bobine », ni un « courrier » sans carte reçue (la boîte servie est vide), ni une rubrique inconnue n’allument le point', async () => {
    const banc = await monter({ ...TOUT_VU, rubriques: [...TOUT_VU.rubriques, { rubrique: 'wagon', vue_le: null }] })
    await banc.calme()
    expect(TOUT_VU.rubriques.filter((r) => r.vue_le === null).map((r) => r.rubrique)).toEqual(['bobine', 'courrier'])
    expect(nom()).toBe(SACOCHE)
    expect(points()).toBe(0)
  })

  // La règle 3 du plan : la carte n'attend pas cette lecture, et sa panne se tait. Mutations : une
  // garde « Chargement… » sur l'état du voyageur ou sur la malle ; une `Panne` rendue pour l'un d'eux.
  it('tant que l’état du voyageur et la malle ne sont pas lus, la carte est là, sans point', async () => {
    const jamais = () => new Promise<Response>(() => undefined)
    const banc = await monter(etat([LANTERNE], {}), { [LIRE]: jamais, [MALLE_1900]: jamais })
    await waitFor(() => expect(banc.requetes).toEqual(expect.arrayContaining([LIRE, MALLE_1900])))
    laCarteEstLa()
    expect(screen.queryByText('Chargement…')).not.toBeInTheDocument()
    expect(nom()).toBe(SACOCHE)
    expect(points()).toBe(0)
  })

  it.each([
    ['l’état du voyageur', LIRE, SACOCHE, 0],
    // La malle seule en panne : sa rubrique reste éteinte, celle des objets garde son point.
    ['la malle', MALLE_1900, `${SACOCHE} : ${OBJET}`, 1],
    // La boîte seule en panne : sa rubrique reste éteinte, les deux autres gardent le point.
    ['la boîte aux cartes postales', BOITE, `${SACOCHE} : ${ETIQUETTE} et ${OBJET}`, 1],
  ])('%s en panne se tait : la carte reste, sans alerte ni « Réessaie »', async (_quoi, route, attendu, n) => {
    const banc = await monter(etat([LANTERNE], {}), { [route]: () => json({ code: 'INTERNAL', message: 'Panne.', retryable: false }, 500) })
    await banc.calme()
    laCarteEstLa()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/Réessa/)).not.toBeInTheDocument()
    expect(nom()).toBe(attendu)
    expect(points()).toBe(n)
  })

  // L'état relu en panne, celui d'avant encore en cache : la carte garde ce qu'elle savait. Mutations :
  // dans `Carte.tsx`, l'état du point pris nul en erreur (`voyageur.error ? undefined : voyageur.data` :
  // le point s'éteint) ; de même pour `ramasses` (les dix objets passeraient pour ramassés).
  it('l’état relu en panne, le point et les objets ramassés restent ceux du cache, sans un mot', async () => {
    let enPanne = false
    const banc = await monter(etat([LANTERNE], { etiquette: APRES_TOUT, objet: AVANT_TOUT }), { [LIRE]: () => (enPanne ? json({ code: 'INTERNAL', message: 'Panne.', retryable: false }, 500) : json(etat([LANTERNE], { etiquette: APRES_TOUT, objet: AVANT_TOUT }))) })
    await banc.calme()
    expect(points()).toBe(1)
    enPanne = true
    await act(async () => {
      await banc.client.refetchQueries({ queryKey: cles.voyageur, exact: true })
    })
    await waitFor(() => expect(banc.client.getQueryState(cles.voyageur)?.status).toBe('error'))
    await banc.calme()
    expect(nom()).toBe(`${SACOCHE} : ${OBJET}`)
    expect(points()).toBe(1)
    expect(vi.mocked(banc.moteur.reglerObjets).mock.calls.pop()![0]).toEqual(['lanterne'])
    laCarteEstLa()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // De retour de la sacoche, le point est éteint sans relecture : le crochet de la visite a écrit le
  // cache, champ par champ. Mutation : `useVisiteDeRubrique` n'écrit plus le cache (son `onSuccess`
  // retiré).
  it('de retour de la sacoche, le point est éteint, sans que rien soit relu', async () => {
    const banc = await monter(etat([LANTERNE], {}), {
      [VUE('etiquette')]: () => json({ rubrique: 'etiquette', vue_le: '2026-10-08T11:00:00.000Z' }),
      [VUE('objet')]: () => json({ rubrique: 'objet', vue_le: '2026-10-08T11:00:00.000Z' }),
      'GET /api/me/voyage/depenses': () => json({ code: 'INTERNAL', message: 'Panne.', retryable: false }, 500),
    })
    await banc.calme()
    expect(points()).toBe(1)
    fireEvent.click(lien())
    await screen.findByRole('region', { name: 'Objets trouvés' })
    await waitFor(() => expect(banc.requetes).toEqual(expect.arrayContaining([VUE('etiquette'), VUE('objet')])))
    await banc.calme()
    fireEvent.click(screen.getByRole('link', { name: 'Retour à la carte' }))
    await waitFor(laCarteEstLa)
    expect(nom()).toBe(SACOCHE)
    expect(points()).toBe(0)
    expect(banc.requetes.filter((r) => r === LIRE)).toHaveLength(1)
    expect(banc.requetes.filter((r) => r === MALLE_1900)).toHaveLength(1)
  })

  // Le jumeau, pour le courrier : la rubrique vue dans la sacoche éteint le point, la boîte n'est pas
  // relue, et **la carte reçue reste nouvelle** (personne ne l'a ouverte : aucune carte n'est marquée
  // lue par la visite de la rubrique). Mutations : `Courrier.tsx` qui ne marque plus la rubrique
  // (`useVisiteDeRubrique` retiré : le point reste) ; toutes les reçues marquées lues à l'ouverture de
  // la sacoche.
  it('de retour de la sacoche, le point du courrier est éteint, sans que la boîte soit relue ni qu’aucune carte soit marquée lue', async () => {
    const neuve: CartePostaleRecue = { ...RECUE, lue_le: null }
    const vu = '2026-10-08T11:00:00.000Z'
    const banc = await monter(etat([LANTERNE], { etiquette: APRES_TOUT, objet: APRES_TOUT }), {
      ...boite({ ...BOITE_DU_CONTRAT, recues: [neuve] }),
      [VUE('etiquette')]: () => json({ rubrique: 'etiquette', vue_le: vu }),
      [VUE('objet')]: () => json({ rubrique: 'objet', vue_le: vu }),
      [VUE('courrier')]: () => json({ rubrique: 'courrier', vue_le: vu }),
      'GET /api/me/voyage/depenses': () => json({ code: 'INTERNAL', message: 'Panne.', retryable: false }, 500),
    })
    await waitFor(() => expect(nom()).toBe(`${SACOCHE} : ${COURRIER}`))
    expect(points()).toBe(1)
    fireEvent.click(lien())
    await screen.findByRole('region', { name: 'Courrier' })
    await waitFor(() => expect(banc.requetes).toContain(VUE('courrier')))
    await waitFor(() => expect(banc.client.getQueryData<Voyageur>(cles.voyageur)?.rubriques.find((r) => r.rubrique === 'courrier')?.vue_le).toBe(vu))
    fireEvent.click(screen.getByRole('link', { name: 'Retour à la carte' }))
    await waitFor(laCarteEstLa)
    expect(nom()).toBe(SACOCHE)
    expect(points()).toBe(0)
    expect(banc.requetes.filter((r) => r === BOITE)).toHaveLength(1)
    expect(banc.requetes.filter((r) => r.startsWith('POST') && r.includes('/cartes-postales'))).toEqual([])
    expect(banc.client.getQueryData<Courrier>(cles.courrier)?.recues).toEqual([neuve])
  })

  // Le point se rallume sur le cache quand un objet vient d'être ramassé sur le quai : sa ligne porte
  // l'instant du serveur, après ma dernière visite. Mutations : le point lu sur un état retenu à
  // l'arrivée (un `useState`, comme « nouveau » dans la sacoche) ; le ramassage qui ne pose plus sa ligne.
  it('un objet ramassé sur le quai rallume le point, sans rien relire', async () => {
    const banc = await monter(TOUT_VU, { [RAMASSER_LE_MELON]: () => json(MELON) })
    await banc.calme()
    expect(points()).toBe(0)
    const avant = [...banc.requetes]
    act(() => banc.rappels().objet!('melon', { x: 60, y: 520 }))
    await waitFor(() => expect(banc.client.getQueryData<Voyageur>(cles.voyageur)?.objets).toEqual([LANTERNE, MELON]))
    await banc.calme()
    expect(nom()).toBe(`${SACOCHE} : ${OBJET}`)
    expect(points()).toBe(1)
    expect(banc.requetes).toEqual([...avant, RAMASSER_LE_MELON])
  })
})

describe('le point rouge, 1900 seulement', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  // Un membre en 1899 : le monde de son année en cours ne monte aucune rubrique, rien de plus ne part.
  // `servir` refuse toute route qu'il ne nomme pas ; la liste est entière. Mutations : la malle lue sans
  // condition ; l'état du voyageur lu sans condition ; les rubriques prises au monde de 1900 en dur.
  it('en 1899, la carte ne lit ni l’état du voyageur ni la malle, et la pastille reste telle quelle', async () => {
    const banc = await monter(etat([LANTERNE], {}), {}, { enCours: 1899 })
    await banc.calme()
    expect([...banc.requetes].sort()).toEqual(['GET /api/auth/me', 'GET /api/me/voyage', 'GET /api/me/voyage/tickets'])
    expect(nom()).toBe(SACOCHE)
    expect(points()).toBe(0)
  })

  // Un membre en 1911, dans le monde « à venir » : la carte montre 1900 et lit l'état du voyageur pour
  // ses objets (brief 4), mais sa sacoche ne monte ni malle ni consigne. Rien ne s'y marquerait vu : le
  // point resterait allumé à jamais. Mutations : toutes les rubriques de la liste, sans regarder le
  // monde ; le monde pris sur les années montrées et non sur mon année en cours.
  it('en 1911, la sacoche ne monte aucune rubrique : pas de point malgré un objet neuf, et ni la malle ni la boîte ne sont lues', async () => {
    const banc = await monter(etat([LANTERNE], {}), boite(BOITE_DU_CONTRAT), { enCours: 1911, fin: 1912 })
    await waitFor(() => expect(banc.client.getQueryState(cles.voyageur)?.status).toBe('success'))
    await banc.calme()
    expect(banc.requetes.filter((r) => r.includes('/etiquettes'))).toEqual([])
    // La règle a changé au brief 13 : une rubrique de plus se date ailleurs que dans l'état du voyageur.
    expect(banc.requetes.filter((r) => r.includes('/cartes-postales'))).toEqual([])
    expect(nom()).toBe(SACOCHE)
    expect(points()).toBe(0)
  })
})
