import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import type { Ticket, Voyage } from '../api/voyage'
import { FabriqueMoteurContexte } from '../carte/CarteCanvas'
import { exemple } from '../test/contrat'
import { moteurFactice } from '../test/moteurFactice'
import { json, servir } from '../test/serveur'
import { fichePrete, voyage1890 } from '../test/voyage'

/**
 * Le registre de la page est une constante de module : ce fichier le double pour avoir deux mondes à
 * bobines. 1890 reste le vrai (trois bobines) ; 1900 est le vrai monde privé de sa scène, avec deux
 * bobines d'essai à la place des siennes ; 1910 reste « à venir », sans bobine. `Carte.test.tsx`
 * garde le vrai registre, scène et passage de 1900 compris.
 *
 * `scene1900`, éteint par défaut : allumé, le monde de 1900 porte une scène collante d'essai, et les
 * tests du déblocage l'allument et l'éteignent eux-mêmes. Le registre le relit à chaque appel, la
 * page tenant le sien pour tout le fichier. Le moteur est factice : la scène n'est jamais jouée.
 */
const essai = vi.hoisted(() => ({
  bobines1900: [
    { cle: 'essai-1900-a', titre: 'Essai A', qui: 'Personne, 1900' },
    { cle: 'essai-1900-b', titre: 'Essai B', qui: 'Personne, 1902' },
  ],
  scene1900: false,
  /** Les rendus de la page : `useMouvementReduit` y est appelé une fois par rendu. */
  rendus: 0,
}))
vi.mock('../mondes', async (original) => {
  const vrai = await original<typeof import('../mondes')>()
  return {
    ...vrai,
    creerRegistre: () => {
      const registre = vrai.creerRegistre()
      const de1900 = { ...registre(1900), bobines: essai.bobines1900, scene: null }
      const jamaisJouee = () => {
        throw new Error('la scène d’essai ne se joue pas')
      }
      const de1900AScene = { ...de1900, scene: { ecranDeLaCase: jamaisJouee, dessinerSuivi: jamaisJouee, dessinerBande: jamaisJouee, entree: [], arrets: [] } }
      return (decennie: number) => (decennie === 1900 ? (essai.scene1900 ? de1900AScene : de1900) : registre(decennie))
    },
  }
})
vi.mock('../ui/mouvement', async (original) => {
  const vrai = await original<typeof import('../ui/mouvement')>()
  return {
    ...vrai,
    useMouvementReduit: () => {
      essai.rendus += 1
      return vrai.useMouvementReduit()
    },
  }
})

const SESSION = exemple<{ user: { id: string; pseudo: string } }>('/auth/me', 'get', 200)
const CLE_BOBINES = `journal.carte.bobines.${SESSION.user.id}`

/** Un Voyage de 1895 à 1912 : trois décennies, dont la dernière sans bobine. */
const voyage = (enCours: number) =>
  voyage1890(
    enCours,
    Array.from({ length: 1912 - 1895 + 1 }, (_, i) => {
      const annee = 1895 + i
      return annee < enCours
        ? { annee, statut: 'ouverte' as const, visitee: true, recompense: null, progression: null }
        : { annee, statut: annee === enCours ? ('en_cours' as const) : ('verrouillee' as const), visitee: false, recompense: null, progression: null, profondeur: 0 }
    }),
  )

async function monter(enCours: number) {
  const f = moteurFactice()
  servir({
    'GET /api/auth/me': () => json(SESSION),
    'GET /api/me/voyage': () => json(voyage(enCours)),
    'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
  })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <FabriqueMoteurContexte.Provider value={f.fabrique}>
        <MemoryRouter initialEntries={['/voyage']}>
          <App />
        </MemoryRouter>
      </FabriqueMoteurContexte.Provider>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(f.etats.length).toBeGreaterThan(0))
  /** Une image du moteur : la décennie à l'écran, dite avec les présences. */
  const aLEcran = (decennie: number | null) => act(() => f.rappels().presences([], decennie))
  const trouver = (cle: string) =>
    act(() => {
      f.rappels().bobine(cle)
      f.rappels().bobineArrivee(cle)
    })
  return { ...f, aLEcran, trouver }
}

const compteur = () => screen.getByText(/^Bobines retrouvées/)

describe('le compteur de bobines, par décennie', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  // Mutations : le compte et le total pris à toutes les bobines du Voyage (`bobinesDuVoyage`) à la
  // place de celles du monde montré ; un nouveau nom pour la clé de `carte/memoire.ts` (les bobines
  // trouvées avant le lot, écrites sous ce nom-ci, ne seraient plus comptées).
  it('ne mêle pas deux décennies : une trouvaille dans l’une ne monte pas le compte de l’autre, et celles d’avant le lot restent comptées', async () => {
    localStorage.setItem(CLE_BOBINES, JSON.stringify(['les-quatre-diables', 'la-tete-de-janus', 'essai-1900-a']))
    const { aLEcran, trouver } = await monter(1903)
    aLEcran(1900)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    aLEcran(1890)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 2/3')
    aLEcran(1900)
    trouver('essai-1900-b')
    expect(compteur()).toHaveTextContent('Bobines retrouvées 2/2')
    aLEcran(1890)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 2/3')
    expect(JSON.parse(localStorage.getItem(CLE_BOBINES)!)).toEqual(['les-quatre-diables', 'la-tete-de-janus', 'essai-1900-a', 'essai-1900-b'])
  })

  // Une bobine ramassée à une frontière, devant un autre monde que le sien.
  // Mutation : le compteur laissé sur la décennie à l'écran pendant le vol (« 1/3 » sous une bobine
  // de 1900, et un message qui dirait « 1/2 »).
  it('montre, pendant le vol d’une bobine d’une autre décennie, le compte de cette décennie-là, et le message dit le même', async () => {
    localStorage.setItem(CLE_BOBINES, JSON.stringify(['les-quatre-diables']))
    const { aLEcran, trouver, rappels } = await monter(1903)
    aLEcran(1890)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/3')
    act(() => rappels().bobine('essai-1900-a'))
    expect(compteur()).toHaveTextContent('Bobines retrouvées 0/2')
    act(() => rappels().bobineArrivee('essai-1900-a'))
    expect(screen.getByRole('status')).toHaveTextContent('Bobine retrouvée 1/2« Essai A », Personne, 1900 : un film perdu.')
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    trouver('essai-1900-b')
    expect(screen.getByRole('status')).toHaveTextContent('Bobine retrouvée 2/2')
    expect(compteur()).toHaveTextContent('Bobines retrouvées 2/2')
    expect(await screen.findByText('Toutes les bobines perdues sont retrouvées.', {}, { timeout: 4500 })).toBeInTheDocument()
  }, 15000)

  // Le compteur est caché tant que la décennie montrée n'a aucune trouvaille. Mutations : la
  // décennie de la bobine oubliée à son arrivée (le compteur, apparu pour le vol, disparaît devant un
  // 1890 sans trouvaille) ; `decennieVueRef` écrite elle aussi à l'arrivée (à l'image suivante, le
  // moteur redit 1890 et le compteur disparaît de même).
  it('n’apparaît jamais pour une bobine en vol pour disparaître à son arrivée', async () => {
    const { aLEcran, rappels } = await monter(1903)
    aLEcran(1890)
    expect(compteur()).not.toBeVisible()
    act(() => rappels().bobine('essai-1900-a'))
    expect(compteur()).toBeVisible()
    expect(compteur()).toHaveTextContent('Bobines retrouvées 0/2')
    act(() => rappels().bobineArrivee('essai-1900-a'))
    expect(compteur()).toBeVisible()
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    // Les images suivantes : le moteur redit la même décennie, le compteur garde celle de la bobine.
    for (let i = 0; i < 100; i++) aLEcran(1890)
    expect(compteur()).toBeVisible()
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
  })

  // Mutations : la décennie posée par une bobine arrivée gardée pour de bon (l'état jamais remplacé
  // une fois posé) ; le compte ou le total du message pris au compteur du dernier rendu (ramassée et
  // arrivée d'un coup, comme au calme, la bobine n'a pas eu de rendu en vol : ce compteur-là est
  // encore celui de 1890).
  it('revient, après le vol, à la décennie à l’écran dès que le moteur en dit une autre', async () => {
    localStorage.setItem(CLE_BOBINES, JSON.stringify(['les-quatre-diables', 'la-tete-de-janus']))
    const { aLEcran, trouver } = await monter(1903)
    aLEcran(1890)
    trouver('essai-1900-a')
    expect(screen.getByRole('status')).toHaveTextContent('Bobine retrouvée 1/2')
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    // Devant un monde sans bobines, il garde ce qu'il montre ; le moteur dit 1900 puis 1890 : il suit.
    aLEcran(1910)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    aLEcran(1900)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    aLEcran(1890)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 2/3')
  })

  // Mutations : la décennie montrée suivie sans condition (devant 1910, « 0/0 », et le compteur
  // caché) ; une décennie nulle (une carte sans section) qui viderait le compteur.
  it('garde, devant un monde sans bobines, la décennie qu’il montrait', async () => {
    localStorage.setItem(CLE_BOBINES, JSON.stringify(['essai-1900-a']))
    const { aLEcran } = await monter(1911)
    aLEcran(1900)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    aLEcran(1910)
    expect(compteur()).toBeVisible()
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    aLEcran(null)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    // Et il la quitte pour la prochaine qui en porte.
    aLEcran(1890)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 0/3')
  })

  // Le moteur n'a encore rien dit. Mutations : la décennie de l'année en cours prise telle quelle
  // (1910 : « 0/0 ») ; la dernière décennie à bobines du Voyage, sans regarder l'année en cours
  // (1900 pour un membre encore en 1898) ; la première (1890 pour un membre en 1911).
  it.each([
    { enCours: 1898, texte: 'Bobines retrouvées 1/3' },
    { enCours: 1903, texte: 'Bobines retrouvées 2/2' },
    { enCours: 1911, texte: 'Bobines retrouvées 2/2' },
  ])('montre à l’ouverture la décennie de l’année en cours ($enCours), ou la dernière avant elle qui porte des bobines', async ({ enCours, texte }) => {
    localStorage.setItem(CLE_BOBINES, JSON.stringify(['les-quatre-diables', 'essai-1900-a', 'essai-1900-b']))
    const { aLEcran } = await monter(enCours)
    expect(compteur()).toBeVisible()
    expect(compteur()).toHaveTextContent(texte)
    // La première image devant un monde sans bobines n'y change rien.
    aLEcran(1910)
    expect(compteur()).toHaveTextContent(texte)
  })

  // Mutation : `setDecennieVue` sans comparaison à la dernière décennie dite. Le moteur dit la
  // décennie à chaque image : la page ne se rend que lorsqu'elle change. La mutation ne tombe que
  // d'un rendu (N + 1 contre N) : React écarte de lui-même un `setState` à valeur égale, sauf le
  // premier après un changement, pour lequel il rend le composant une fois avant de renoncer. Si
  // React cessait de le faire, la mutation deviendrait équivalente et ce test ne la verrait plus.
  it('ne rend pas la page une fois de plus pour cent images sans changement de décennie', async () => {
    const { aLEcran } = await monter(1903)
    aLEcran(1890)
    const avant = essai.rendus
    expect(avant).toBeGreaterThan(0)
    for (let i = 0; i < 100; i++) aLEcran(1890)
    for (let i = 0; i < 100; i++) aLEcran(1910)
    expect(essai.rendus).toBe(avant)
    // Le témoin : un changement de décennie, lui, rend la page.
    aLEcran(1900)
    expect(essai.rendus).toBeGreaterThan(avant)
  })
})

/** 1895 à 1912, dans l'ordre. */
const TOUTES = Array.from({ length: 1912 - 1895 + 1 }, (_, i) => 1895 + i)
const AVANT_1900 = [1895, 1896, 1897, 1898, 1899]
const SUIT = (annee: number) => ({ id: '22222222-2222-4222-8222-222222222222', pseudo: 'Théo', annee_en_cours: annee })
/** Le ticket de 1900 gagné, montré et gardé : jamais utilisé. */
const TICKET_1900: Ticket = { annee: 1900, motif: '1899 t’a bien occupé, 1900 t’attend.', emis_le: '2026-09-21T21:00:00.000Z', montre_le: '2026-09-21T21:05:00.000Z', utilise_le: null }
const TAMPON_1890 = { decennie: 1890, boucle_le: '2026-09-21T21:00:00.000Z' }

/** La carte montée sur un Voyage donné ; les fiches de `enCache` sont posées avant le premier rendu. */
async function ouvrir(v: Voyage, { tickets = [] as Ticket[], enCache = [] as ReturnType<typeof fichePrete>[] } = {}) {
  const f = moteurFactice()
  const client = createQueryClient()
  for (const fiche of enCache) client.setQueryData(cles.annee(fiche.annee), fiche)
  servir({
    'GET /api/auth/me': () => json(SESSION),
    'GET /api/me/voyage': () => json(v),
    'GET /api/me/voyage/tickets': () => json({ tickets }),
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
  /** Les années de chaque état donné au moteur, du premier au dernier. */
  const donnees = () => f.etats.map((e) => e.cases.map((c) => c.annee))
  const dernier = () => f.etats[f.etats.length - 1]!
  /** Les années du dernier état donné. */
  const montrees = () => dernier().cases.map((c) => c.annee)
  return { ...f, donnees, dernier, montrees }
}

const lues = () =>
  within(screen.getByRole('navigation', { name: 'Les années du Voyage' }))
    .getAllByRole('link')
    .map((l) => Number(l.textContent!.slice(0, 4)))

describe('le déblocage d’un monde à scène', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
    essai.scene1900 = true
  })
  afterEach(() => {
    essai.scene1900 = false
    vi.unstubAllGlobals()
  })

  // Le membre resté en 1899, son ticket de 1900 en poche et le tampon de 1890 posé : seule son année
  // en cours ouvre 1900. 1910, « à venir » et sans scène, ne reparaît pas au-delà du trou.
  // Mutations : l'année en cours remplacée par celle du ticket offert ; par 1900 dès que le tampon de
  // 1890 est posé ; la règle bornée à la seule décennie à scène (1910 à 1912 donnés).
  it('ne donne au moteur aucune année de 1900 ni d’après tant que l’année en cours est 1899, ticket de 1900 gagné, montré et gardé, tampon de 1890 posé', async () => {
    const { donnees, montrees } = await ouvrir(voyage1890(1899, voyage(1899).annees, { tampons: [TAMPON_1890] }), { tickets: [TICKET_1900] })
    // Le ticket est bien connu de la page : elle l'offre.
    expect(await screen.findByRole('button', { name: /Utiliser le ticket/ })).toBeInTheDocument()
    expect(montrees()).toEqual(AVANT_1900)
    for (const annees of donnees()) expect(annees).toEqual(AVANT_1900)
  })

  // Mutation : `<=` dans `premiereDecennieCachee` (le `>` au lieu du `>=`) : 1900 resterait fermée à
  // qui vient d'y entrer, et la carte n'aurait plus la case de son année en cours.
  it('donne toutes les années dès que l’année en cours est 1900', async () => {
    const { montrees } = await ouvrir(voyage(1900))
    expect(montrees()).toEqual(TOUTES)
  })

  // Le Voyage suivi déjà en 1903 quand je suis en 1899 : sa roulotte n'a pas de case où se garer.
  // Mutations : `v.source.annee_en_cours` passé tel quel (une roulotte garée en 1903) ; `annee: null`
  // à la place de `roulotte: null` (« je mène », et le pseudo du voyageur suivi traverserait 1890).
  it('ne donne aucune roulotte au moteur quand le Voyage suivi est rendu dans une décennie cachée, et le HUD dit toujours qui l’on suit', async () => {
    const { etats } = await ouvrir(voyage1890(1899, voyage(1899).annees, { ia: false, source: SUIT(1903) }))
    for (const e of etats) expect(e.roulotte).toBeNull()
    expect(screen.getByText(/^Tu suis le Voyage de Théo/)).toBeInTheDocument()
  })

  // Les témoins du test d'avant. Mutations : la roulotte ôtée à tout Voyage suivi ; ôtée dès que le
  // Voyage suivi est devant moi, sans regarder ce qui est caché.
  it.each([
    { cas: 'derrière moi, dans une décennie montrée', enCours: 1899, suivi: 1897 },
    { cas: 'devant moi, dans une décennie montrée', enCours: 1896, suivi: 1899 },
    { cas: 'en 1903 quand j’ai atteint 1900', enCours: 1900, suivi: 1903 },
  ])('gare la roulotte du Voyage suivi dans son année : $cas', async ({ enCours, suivi }) => {
    const { dernier } = await ouvrir(voyage1890(enCours, voyage(enCours).annees, { ia: false, source: SUIT(suivi) }))
    expect(dernier().roulotte).toEqual({ pseudo: 'Théo', annee: suivi })
  })

  // Les fiches se demandent par les années du Voyage et se lisent par rang : le filtre passe après.
  // La réponse est ici rangée 1900 à 1912 puis 1895 à 1899, pour que le rang d'une année montrée ne
  // soit pas son rang dans le Voyage ; rangée par année, les cachées sont en queue et la mutation ne
  // se verrait pas. Mutation : filtrer `v.annees` avant le `map` (1897 prendrait la fiche de 1902).
  it('garde à chaque année montrée sa propre fiche en cache', async () => {
    const marche = fichePrete().podium[0]!
    const fiche = (annee: number) => fichePrete({ annee, podium: [{ ...marche, cover_url: `https://essai.test/${annee}.jpg` }, null, null], salles: [] })
    const annees = voyage(1899).annees.map((a) => ({ ...a, affiche_url: `https://essai.test/carte-${a.annee}.jpg` }))
    const melees = [...annees.filter((a) => a.annee >= 1900), ...annees.filter((a) => a.annee < 1900)]
    const { dernier } = await ouvrir(voyage1890(1899, melees), { enCache: [fiche(1897), fiche(1902), fiche(1900)] })
    const affiches = Object.fromEntries(dernier().cases.map((c) => [c.annee, c.affiches]))
    expect(affiches).toEqual({
      1895: ['https://essai.test/carte-1895.jpg'],
      1896: ['https://essai.test/carte-1896.jpg'],
      1897: ['https://essai.test/1897.jpg'],
      1898: ['https://essai.test/carte-1898.jpg'],
      1899: ['https://essai.test/carte-1899.jpg'],
    })
  })

  // Qui ne voit pas le canvas ne lit pas davantage 1900. Mutation : la liste construite sur `v.annees`.
  it('ne nomme, dans la liste des années lue par un lecteur d’écran, aucune année cachée', async () => {
    await ouvrir(voyage1890(1899, voyage(1899).annees, { tampons: [TAMPON_1890] }), { tickets: [TICKET_1900] })
    await screen.findByRole('button', { name: /Utiliser le ticket/ })
    expect(lues()).toEqual(AVANT_1900)
  })

  it('nomme toutes les années dans cette liste une fois 1900 atteinte', async () => {
    await ouvrir(voyage(1900))
    expect(lues()).toEqual(TOUTES)
  })
})

describe('sans monde à scène au registre', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  // Le drapeau éteint, c'est un registre sans monde à scène (1900 y est privé de la sienne) : rien n'est caché, la roulotte se gare où en
  // est le Voyage suivi. Mutation : la scène lue ailleurs qu'au registre (`d === 1900` en dur).
  it('donne toutes les années, les nomme toutes, et gare la roulotte en 1903 pour un membre en 1899', async () => {
    expect(essai.scene1900).toBe(false)
    const { donnees, dernier } = await ouvrir(voyage1890(1899, voyage(1899).annees, { ia: false, source: SUIT(1903) }))
    for (const annees of donnees()) expect(annees).toEqual(TOUTES)
    expect(dernier().roulotte).toEqual({ pseudo: 'Théo', annee: 1903 })
    expect(lues()).toEqual(TOUTES)
  })
})
