import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DELAI_CHRONIQUEUR_MS,
  accepterHoraire,
  composerUneSeance,
  declinerLaTable,
  dresserUneTable,
  estPrete,
  ignorerLaSeance,
  lireAnnee,
  lireCarton,
  lireContexte,
  lireCourrier,
  lireGenerique,
  lireMalle,
  lireTables,
  lireVoyageur,
  marquerCarteLue,
  marquerRubriqueVue,
  ouvrirUneSalle,
  poserSurLePodium,
  prendreMaPlace,
  posterCartePostale,
  prendreLaSeance,
  ramasserObjet,
  ramasserUneBobine,
  refusVu,
  remplacerDansLaSeance,
  renouvelerLesPistes,
  repondreAuControleur,
  retirerHoraire,
  utiliserTicket,
  viderLaMarche,
  voirPlus,
  type FicheAnnee,
} from './voyage'
import { exemple } from '../test/contrat'

describe('le client du Voyage', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  // Le `202` « en préparation » est une réponse, pas une panne : la fiche se relira.
  it('rend la fiche en préparation telle quelle', async () => {
    const corps = exemple('/me/voyage/annees/{annee}', 'get', 202)
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(corps), { status: 202 }))
    await expect(lireAnnee(1898)).resolves.toMatchObject({ statut: 'en_preparation' })
    expect(fetch).toHaveBeenCalledWith('/api/me/voyage/annees/1898', expect.objectContaining({ method: 'GET' }))
  })

  // Mutation : `annee + 1` ou une autre année dans le chemin encaisserait le mauvais ticket.
  it('encaisse le ticket de l’année qu’il ouvre', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{"annee_en_cours":1899}', { status: 200 }))
    await expect(utiliserTicket(1899)).resolves.toEqual({ annee_en_cours: 1899 })
    expect(fetch).toHaveBeenCalledWith('/api/me/voyage/tickets/1899/utiliser', expect.objectContaining({ method: 'POST' }))
  })

  // Mutation : `estPrete` qui ne regarde que l'existence : `{ configure: false }` et le `202`
  // passeraient pour des fiches, et la colonne Morris lirait un podium qui n'existe pas.
  it('ne prend pour une fiche prête que la forme `prete`', () => {
    expect(estPrete(exemple<FicheAnnee>('/me/voyage/annees/{annee}', 'get', 200))).toBe(true)
    expect(estPrete(exemple<FicheAnnee>('/me/voyage/annees/{annee}', 'get', 202))).toBe(false)
    expect(estPrete({ configure: false })).toBe(false)
    expect(estPrete(undefined)).toBe(false)
  })
})

describe('le client de la fiche d’une année', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 }))))
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const parti = () => {
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    return { url, methode: init?.method, corps: init?.body === undefined ? undefined : JSON.parse(String(init.body)) }
  }

  // Mutations : une autre méthode, ou la place prise dans le corps plutôt que dans le chemin.
  it('pose sur une marche par `PUT`, la place dans le chemin, le film dans le corps', async () => {
    await poserSurLePodium(1897, 2, { tmdb_id: 12 })
    expect(parti()).toEqual({ url: '/api/me/voyage/annees/1897/podium/2', methode: 'PUT', corps: { tmdb_id: 12 } })
  })

  it('vide une marche par `DELETE`', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))
    await expect(viderLaMarche(1897, 3)).resolves.toBeUndefined()
    expect(parti()).toMatchObject({ url: '/api/me/voyage/annees/1897/podium/3', methode: 'DELETE' })
  })

  it('demande une fournée, une salle, les pistes, le refus vu, par leurs chemins', async () => {
    await voirPlus('s1')
    await ouvrirUneSalle(1897, { demande: 'Les fantômes', piste: 'Les fantômes' })
    await renouvelerLesPistes(1897)
    await refusVu('d1')
    const appels = vi.mocked(fetch).mock.calls.map(([url, init]) => `${init?.method} ${String(url)}`)
    expect(appels).toEqual([
      'POST /api/me/voyage/salles/s1/plus',
      'POST /api/me/voyage/annees/1897/salles',
      'POST /api/me/voyage/annees/1897/pistes',
      'POST /api/me/voyage/demandes-salles/d1/vue',
    ])
  })

  it('compose, prend, ignore et remplace une séance par leurs chemins', async () => {
    await composerUneSeance(1897)
    await prendreLaSeance('x')
    await ignorerLaSeance('x')
    await remplacerDansLaSeance('x', { morceau: 'court', film_id: 'f', bobine_tmdb_id: 3 })
    const appels = vi.mocked(fetch).mock.calls.map(([url, init]) => `${init?.method} ${String(url)}`)
    expect(appels).toEqual([
      'POST /api/me/voyage/annees/1897/seances',
      'POST /api/me/voyage/seances/x/prendre',
      'POST /api/me/voyage/seances/x/ignorer',
      'POST /api/me/voyage/seances/x/remplacer',
    ])
  })

  // Mutation : le délai d'écriture par défaut (45 s) sur un appel synchrone au chroniqueur.
  it('laisse 80 s aux trois appels synchrones au chroniqueur', async () => {
    const delai = vi.spyOn(AbortSignal, 'timeout')
    await lireContexte(1897, 's1')
    await renouvelerLesPistes(1897)
    await lireGenerique(1897)
    expect(delai.mock.calls.map(([ms]) => ms)).toEqual([DELAI_CHRONIQUEUR_MS, DELAI_CHRONIQUEUR_MS, DELAI_CHRONIQUEUR_MS])
    expect(DELAI_CHRONIQUEUR_MS).toBe(80_000)
  })

  it('lit le carton d’un film par `GET`, sans corps', async () => {
    await lireCarton(15)
    expect(parti()).toEqual({ url: '/api/reference/chroniques/films/15', methode: 'GET', corps: undefined })
  })

  // Les jumeaux des deux tests d'en haut : le test des délais ne lit pas les chemins, celui des
  // chemins ne lit pas les corps. Mutations : `…/plus` pour le contexte, `…/pistes` pour le
  // générique, un corps réécrit pour la salle nouvelle ou pour le remplacement.
  it('lit le contexte et le générique par leurs chemins, et envoie tels quels les corps d’une salle et d’un remplacement', async () => {
    await lireContexte(1897, 's1')
    await lireGenerique(1897)
    await ouvrirUneSalle(1897, { demande: 'Les fantômes', piste: 'Les fantômes' })
    await remplacerDansLaSeance('x', { morceau: 'court', film_id: 'f', bobine_tmdb_id: 3 })
    const partis = vi.mocked(fetch).mock.calls.map(([url, init]) => ({
      url,
      corps: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    }))
    expect(partis).toEqual([
      { url: '/api/me/voyage/annees/1897/salles/s1/contexte', corps: undefined },
      { url: '/api/me/voyage/annees/1897/generique', corps: undefined },
      { url: '/api/me/voyage/annees/1897/salles', corps: { demande: 'Les fantômes', piste: 'Les fantômes' } },
      { url: '/api/me/voyage/seances/x/remplacer', corps: { morceau: 'court', film_id: 'f', bobine_tmdb_id: 3 } },
    ])
  })

  // Mutation : le signal de l'appelant perdu en route : quitter la fiche n'annulerait plus la lecture.
  it('annule la lecture du carton avec l’appelant', async () => {
    const appelant = new AbortController()
    appelant.abort()
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      if (init?.signal?.aborted) throw new DOMException('annulée', 'AbortError')
      return new Response('{}', { status: 200 })
    })
    await expect(lireCarton(15, appelant.signal)).rejects.toThrow()
  })
})

// L'état du voyageur, la malle, le contrôleur et l'horaire (plan des écrans des lots, brief 0) : une
// fonction par route des lots 1 à 6 de l'API. Les cartes postales suivent (brief 13) ; rien pour les tables.
describe('le client de l’état du voyageur', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 }))))
  afterEach(() => vi.unstubAllGlobals())

  // Mutations : la décennie
  // décalée d'une année dans le chemin (`decennie + 1` : l'API répondrait 400) ; `lireVoyageur` sur
  // `/me/voyage` (la carte prise pour l'état).
  it('lit l’état du voyageur et la malle d’une décennie par `GET`, sans corps', async () => {
    await lireVoyageur()
    await lireMalle(1900)
    const partis = vi.mocked(fetch).mock.calls.map(([url, init]) => ({ url, methode: init?.method, corps: init?.body }))
    expect(partis).toEqual([
      { url: '/api/me/voyage/voyageur', methode: 'GET', corps: undefined },
      { url: '/api/me/voyage/decennies/1900/etiquettes', methode: 'GET', corps: undefined },
    ])
  })

  // Mutation : le signal oublié de l'une des deux lectures : quitter la sacoche ne l'annulerait plus.
  it('passe le signal de l’appelant aux deux lectures', async () => {
    for (const lire of [(s: AbortSignal) => lireVoyageur(s), (s: AbortSignal) => lireMalle(1900, s)]) {
      vi.mocked(fetch).mockClear()
      const quitter = new AbortController()
      await lire(quitter.signal)
      const { signal } = vi.mocked(fetch).mock.calls[0]![1]!
      expect(signal!.aborted).toBe(false)
      quitter.abort()
      expect(signal!.aborted).toBe(true)
    }
  })

  // Mutations : `ramasserObjet` et `marquerRubriqueVue` échangés de chemin ; la clé posée dans un
  // corps plutôt que dans le chemin ; un `PUT` pour la rubrique.
  it('ramasse un objet et marque une rubrique vue par `POST`, la clé dans le chemin, sans corps', async () => {
    await ramasserObjet('lanterne')
    await marquerRubriqueVue('etiquette')
    const partis = vi.mocked(fetch).mock.calls.map(([url, init]) => ({ url, methode: init?.method, corps: init?.body }))
    expect(partis).toEqual([
      { url: '/api/me/voyage/objets/lanterne/ramasser', methode: 'POST', corps: undefined },
      { url: '/api/me/voyage/rubriques/etiquette/vue', methode: 'POST', corps: undefined },
    ])
  })

  // Une clé vient du serveur (une chaîne, pas une énumération) et entre dans un chemin. Mutation :
  // `encodeURIComponent` retiré de l'une ou de l'autre (la requête viserait une autre route).
  it('ne laisse pas une clé sortir de son segment de chemin', async () => {
    await ramasserObjet('../voyageur?x')
    await marquerRubriqueVue('a/b')
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      '/api/me/voyage/objets/..%2Fvoyageur%3Fx/ramasser',
      '/api/me/voyage/rubriques/a%2Fb/vue',
    ])
  })

  // Le serveur ne connaît que les tirets bas et répond `400` à une clé à tirets. Mutations : la clé du
  // monde envoyée telle quelle ; la route des objets ; la clé dans un corps ; `encodeURIComponent` retiré.
  it('ramasse une bobine par `POST`, sa clé traduite en tirets bas dans le chemin, sans corps', async () => {
    await ramasserUneBobine('les-quatre-diables')
    await ramasserUneBobine('hamlet')
    await ramasserUneBobine('../voyageur?x')
    const partis = vi.mocked(fetch).mock.calls.map(([url, init]) => ({ url, methode: init?.method, corps: init?.body }))
    expect(partis).toEqual([
      { url: '/api/me/voyage/bobines/les_quatre_diables/ramasser', methode: 'POST', corps: undefined },
      { url: '/api/me/voyage/bobines/hamlet/ramasser', methode: 'POST', corps: undefined },
      { url: '/api/me/voyage/bobines/..%2Fvoyageur%3Fx/ramasser', methode: 'POST', corps: undefined },
    ])
  })

  // Mutations : la réponse envoyée nue (`'presente'` au lieu de `{ reponse }`) ; `refuse` envoyé
  // quoi qu'on réponde.
  it('répond au contrôleur par `POST`, la réponse dans le corps', async () => {
    await repondreAuControleur('presente')
    await repondreAuControleur('refuse')
    const partis = vi.mocked(fetch).mock.calls.map(([url, init]) => ({ url, methode: init?.method, corps: JSON.parse(String(init?.body)) }))
    expect(partis).toEqual([
      { url: '/api/me/voyage/controleur/reponse', methode: 'POST', corps: { reponse: 'presente' } },
      { url: '/api/me/voyage/controleur/reponse', methode: 'POST', corps: { reponse: 'refuse' } },
    ])
  })

  // **Le serveur seul choisit l'échéance.** Mutations : une échéance envoyée dans le corps de
  // l'acceptation (`{ echeance }`) ; le retrait par `POST` ; l'année suivante dans le chemin.
  it('accepte un horaire par `POST` sans aucun corps, et le retire par `DELETE`', async () => {
    await accepterHoraire(1903)
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))
    await expect(retirerHoraire(1903)).resolves.toBeUndefined()
    const partis = vi.mocked(fetch).mock.calls.map(([url, init]) => ({ url, methode: init?.method, corps: init?.body, type: (init?.headers as Record<string, string>)['content-type'] }))
    expect(partis).toEqual([
      { url: '/api/me/voyage/annees/1903/horaire', methode: 'POST', corps: undefined, type: undefined },
      { url: '/api/me/voyage/annees/1903/horaire', methode: 'DELETE', corps: undefined, type: undefined },
    ])
  })
})

// Les cartes postales (plan des écrans des lots, brief 13) : lire ma boîte, marquer lue une carte
// reçue, poster la carte d'une gare. Le mot d'une carte est privé : il ne voyage que dans un corps.
describe('le client du courrier', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 }))))
  afterEach(() => vi.unstubAllGlobals())

  // Mutations : la boîte lue sur `/me/voyage/voyageur` ; le signal oublié (quitter la sacoche
  // n'annulerait plus la lecture).
  it('lit ma boîte par `GET`, sans corps, sous le signal de l’appelant', async () => {
    const quitter = new AbortController()
    await lireCourrier(quitter.signal)
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect({ url, methode: init?.method, corps: init?.body }).toEqual({ url: '/api/me/voyage/cartes-postales', methode: 'GET', corps: undefined })
    expect(init!.signal!.aborted).toBe(false)
    quitter.abort()
    expect(init!.signal!.aborted).toBe(true)
  })

  // Mutations : l'identifiant posé dans un corps ; `encodeURIComponent` retiré (un identifiant qui
  // n'en est pas un viserait une autre route) ; un `PUT`.
  it('marque une carte lue par `POST`, l’identifiant dans le chemin et lui seul, sans corps', async () => {
    await marquerCarteLue('3f0e6c1a-0000-4000-8000-000000000001')
    await marquerCarteLue('../cartes-postales?x')
    const partis = vi.mocked(fetch).mock.calls.map(([url, init]) => ({ url, methode: init?.method, corps: init?.body }))
    expect(partis).toEqual([
      { url: '/api/me/voyage/cartes-postales/3f0e6c1a-0000-4000-8000-000000000001/lue', methode: 'POST', corps: undefined },
      { url: '/api/me/voyage/cartes-postales/..%2Fcartes-postales%3Fx/lue', methode: 'POST', corps: undefined },
    ])
  })

  // Le corps est strict côté serveur : un champ de plus vaut `400`. Mutations : le mot posé dans
  // l'adresse (`?mot=`) ; un champ ajouté au corps (`postee_le`) ; le corps réécrit (`mot` rogné).
  it('poste une carte par `POST`, le corps tel quel, et rien du mot dans l’adresse', async () => {
    const corps = { annee: 1903, destinataire_id: '3f0e6c1a-0000-4000-8000-000000000002', mot: '  Bien arrivé à Longueville.  ' }
    await posterCartePostale(corps)
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect({ url, methode: init?.method, corps: JSON.parse(String(init?.body)) }).toEqual({ url: '/api/me/voyage/cartes-postales', methode: 'POST', corps })
  })
})

// Les tables du wagon-restaurant (plan des écrans des lots, brief 15) : lire mes tables, prendre ma
// place, décliner, et dresser une table (qu'aucun écran n'appelle avant le brief 16).
describe('le client du wagon-restaurant', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 }))))
  afterEach(() => vi.unstubAllGlobals())

  // Mutations : les tables lues sur `/me/voyage/cartes-postales` ; le signal oublié.
  it('lit mes tables par `GET`, sans corps, sous le signal de l’appelant', async () => {
    const quitter = new AbortController()
    await lireTables(quitter.signal)
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect({ url, methode: init?.method, corps: init?.body }).toEqual({ url: '/api/me/voyage/tables', methode: 'GET', corps: undefined })
    expect(init!.signal!.aborted).toBe(false)
    quitter.abort()
    expect(init!.signal!.aborted).toBe(true)
  })

  // Mutations : les deux routes échangées (décliner prendrait la place) ; `encodeURIComponent` retiré ;
  // l'identifiant posé dans un corps.
  it('prend ma place et décline par `POST`, l’identifiant encodé dans le chemin, sans corps', async () => {
    await prendreMaPlace('3f0e6c1a-0000-4000-8000-000000000001')
    await declinerLaTable('3f0e6c1a-0000-4000-8000-000000000001')
    await prendreMaPlace('../tables?x')
    await declinerLaTable('../tables?x')
    const partis = vi.mocked(fetch).mock.calls.map(([url, init]) => ({ url, methode: init?.method, corps: init?.body }))
    expect(partis).toEqual([
      { url: '/api/me/voyage/tables/3f0e6c1a-0000-4000-8000-000000000001/place', methode: 'POST', corps: undefined },
      { url: '/api/me/voyage/tables/3f0e6c1a-0000-4000-8000-000000000001/decliner', methode: 'POST', corps: undefined },
      { url: '/api/me/voyage/tables/..%2Ftables%3Fx/place', methode: 'POST', corps: undefined },
      { url: '/api/me/voyage/tables/..%2Ftables%3Fx/decliner', methode: 'POST', corps: undefined },
    ])
  })

  // Le corps est strict côté serveur : un champ de plus vaut `400`. Mutations : un champ ajouté au
  // corps (`soir`) ; la table dressée par `PUT`.
  it('dresse une table par `POST`, le corps tel quel', async () => {
    const corps = { invite_id: '3f0e6c1a-0000-4000-8000-000000000002', tmdb_id: 775 }
    await dresserUneTable(corps)
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect({ url, methode: init?.method, corps: JSON.parse(String(init?.body)) }).toEqual({ url: '/api/me/voyage/tables', methode: 'POST', corps })
  })
})
