import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lireMesAbonnements, type Abonnement } from './abonnements'
import { cles } from './cles'
import { exemple } from '../test/contrat'
import { json, servir } from '../test/serveur'

/** L'exemple du contrat : bob et camille, sur une seule page. */
type Page = { items: { user: Abonnement }[]; next_cursor: string | null }
const EXEMPLE = exemple<Page>('/users/{id}/following', 'get', 200)
const [BOB, CAMILLE] = EXEMPLE.items as [Page['items'][number], Page['items'][number]]
const DAN = { ...CAMILLE, user: { ...CAMILLE.user, id: '44444444-4444-4444-8444-444444444444', pseudo: 'dan' } }
/** Un curseur est opaque : celui-ci porte ce qu'une adresse doit encoder. */
const CURSEUR = 'a+b/c=='
const PREMIERE = 'GET /api/users/me/following?limit=100'
const DEUXIEME = `GET /api/users/me/following?limit=100&cursor=${encodeURIComponent(CURSEUR)}`
const TROISIEME = 'GET /api/users/me/following?limit=100&cursor=fin'

describe('mes abonnements', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  // Mutations : la première page seule (la boucle retirée : ni camille ni dan) ; le curseur de la
  // première page renvoyé à chaque tour (la troisième requête ne part pas, une requête inattendue
  // sinon) ; le curseur posé sans passer par la requête (`?cursor=a+b/c==`, lu « a b/c== » par le
  // serveur) ; `/users/me/followers` ; les lignes rendues entières (les comptes d'un profil avec).
  it('lit toutes les pages, par le curseur rendu tel quel, et rend les membres dans l’ordre servi', async () => {
    const requetes = servir({
      [PREMIERE]: () => json({ items: [BOB], next_cursor: CURSEUR }),
      [DEUXIEME]: () => json({ items: [CAMILLE], next_cursor: 'fin' }),
      [TROISIEME]: () => json({ items: [DAN], next_cursor: null }),
    })
    expect(await lireMesAbonnements()).toEqual([BOB.user, CAMILLE.user, DAN.user])
    expect(requetes).toEqual([PREMIERE, DEUXIEME, TROISIEME])
  })

  // Le cas que l'écran doit dire (« tu ne suis personne ») : une liste vide, pas une panne.
  it('sans abonnement, rend une liste vide en une requête', async () => {
    const requetes = servir({ [PREMIERE]: () => json({ items: [], next_cursor: null }) })
    expect(await lireMesAbonnements()).toEqual([])
    expect(requetes).toEqual([PREMIERE])
  })

  // La route sert aussi les comptes désactivés (elle ne filtre rien), et le serveur refuse par `409`
  // une carte ou une table pour eux : ils ne sont pas rendus, pour les deux écrans d'un coup.
  // Mutation : le filtre sur `deactivated` retiré (dan revient, à sa place).
  it('ne rend pas un compte désactivé, sur quelque page qu’il soit ; s’il ne reste personne, la liste est vide', async () => {
    const eteint = (ligne: Page['items'][number]) => ({ ...ligne, user: { ...ligne.user, deactivated: true } })
    servir({
      [PREMIERE]: () => json({ items: [BOB, eteint(DAN)], next_cursor: CURSEUR }),
      [DEUXIEME]: () => json({ items: [eteint(DAN), CAMILLE], next_cursor: null }),
    })
    expect([BOB.user.deactivated, CAMILLE.user.deactivated]).toEqual([false, false])
    expect(await lireMesAbonnements()).toEqual([BOB.user, CAMILLE.user])
    servir({ [PREMIERE]: () => json({ items: [eteint(BOB), eteint(CAMILLE)], next_cursor: null }) })
    expect(await lireMesAbonnements()).toEqual([])
  })

  // Une écriture au journal périme le préfixe `voyage` : elle ne change pas qui je suis.
  // Mutation : la clé rangée sous `voyage` (`['voyage', 'abonnements']`).
  it('sa clé vit hors du préfixe `voyage`', () => {
    expect(cles.abonnements[0]).not.toBe(cles.voyage[0])
  })
})
