import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { cles } from '../../../api/cles'
import type { JournalItem, JournalPage } from '../../../api/journal'
import type { ReactionsCatalogue } from '../../../api/reactions'
import type { Table, Tables, Voyageur } from '../../../api/voyage'
import { exemple } from '../../../test/contrat'
import { visionnage } from '../../../test/journal'
import { SESSION, monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { VOYAGEUR_VIDE, fichePrete, filmDeSalle, salle, voyage1890 } from '../../../test/voyage'
import { oublierLeBillet, rangerLeBillet } from '../../../voyage/billet/range'
import { billetsDeLaDecennie, numeroDe, numeroLisible } from '../../../voyage/billets'
import { PAGES_1890 } from '../../1890/pages'
import { PAGES_1900 } from '../pages'
import { MOTS_DU_COMPOSTEUR as C } from './carton'
import { MOTS_DU_CASIER as M, compteDeLaCase, compteDeLaLiasse, liasseDe, titreDeLaLiasse } from './casier'

/**
 * Le casier du contrôleur (plan des pages 1900, brief 7) : la boîte à billets d'une décennie 1900. La
 * page se monte dans l'app entière, le monde n'y arrive que par le registre ; elle garde ses deux
 * lectures, l'adresse et le billet rangé. Les tests de `pages/VoyageBoite.test.tsx`, montés sur 1890,
 * tiennent le défaut.
 */
/** Le départ du Voyage, que le contrat fige : toute la décennie 1900 est après lui. */
const DEPART = 1895
const VOYAGE = voyage1890(
  1905,
  [
    { annee: 1903, statut: 'ouverte', visitee: true, recompense: 'lion' },
    { annee: 1904, statut: 'ouverte', visitee: true, recompense: 'ours' },
    { annee: 1905, statut: 'en_cours', visitee: true, recompense: null },
    { annee: 1906, statut: 'verrouillee', visitee: false, recompense: null },
  ],
  { ia: true, source: null, rattrape_la_source: false, depart: DEPART },
)
const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
const CATALOGUE = exemple<ReactionsCatalogue>('/reference/reactions', 'get', 200)
const CARTE = 'GET /api/me/voyage'
const JOURNAL = 'GET /api/me/journal?limit=100&sortie_min=1900&sortie_max=1909'
const REACTIONS = 'GET /api/reference/reactions'
/** L'état du voyageur, que la boîte de 1900 lit pour ses poinçons (lot d'écrans, brief 8). */
const VOYAGEUR = 'GET /api/me/voyage/voyageur'
/** Mes tables, que la boîte de 1900 lit pour le tampon « Vu ensemble » (lot d'écrans, brief 16). */
const TABLES = 'GET /api/me/voyage/tables'
const BOITE = '/voyage/decennies/1900/billets'

const vu = (id: string, an: number, date: string, o: { titre: string; note?: number | null; tmdb?: number; realisateur?: string | null; remarque?: string; reactions?: string[] }) => {
  const v = visionnage({ id, media: 'm-' + id, titre: o.titre, annee: an, date, note: o.note ?? null, reactions: o.reactions })
  v.media.source = 'tmdb'
  v.media.type = 'movie'
  v.media.external_id = String(o.tmdb ?? 1000)
  v.media.director = o.realisateur ?? null
  v.carnet.comment = o.remarque ?? null
  return v
}

/**
 * Quatre visionnages, que l'API rend dans le désordre. Du premier vu au dernier : « The Big Swallow »
 * (1901, N° 0001), « Life of an American Fireman » (1903, N° 0002), « Rescued by Rover » (1905,
 * N° 0003), « Le Vol du grand rapide » (1903, N° 0004) : la liasse de 1903 porte les N° 0002 et 0004,
 * jamais « 1 » et « 2 ».
 */
const SWALLOW = vu('e0', 1901, '2026-04-01', { titre: 'The Big Swallow' })
const FIREMAN = vu('e1', 1903, '2026-05-01', { titre: 'Life of an American Fireman', realisateur: 'Edwin S. Porter', tmdb: 774 })
const ROVER = vu('e2', 1905, '2026-06-01', { titre: 'Rescued by Rover', note: 6, tmdb: 775 })
const VOL = vu('e3', 1903, '2026-09-01', { titre: 'Le Vol du grand rapide', note: 8, realisateur: 'Edwin S. Porter', tmdb: 776, remarque: 'Le coup de feu vers la salle.', reactions: ['adore', 'en_salle'] })
const TOUS = [VOL, SWALLOW, ROVER, FIREMAN]

const journal = (items: JournalItem[]) => () => json({ ...PAGE, items, next_cursor: null })
const ROUTES = { [CARTE]: () => json(VOYAGE), [JOURNAL]: journal(TOUS), [REACTIONS]: () => json(CATALOGUE), [VOYAGEUR]: () => json(VOYAGEUR_VIDE), [TABLES]: () => json({ tables: [] }) }

const cases = async () => within(await screen.findByRole('group', { name: M.cases }))
/** Les cartons de la liasse sortie, dans l'ordre de la page. */
const liasse = async (titre: string) => within(await screen.findByRole('list', { name: titre })).getAllByRole('button')
const carton = (titre: RegExp) => screen.getByRole('button', { name: titre })
const calme = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  oublierLeBillet()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  oublierLeBillet()
})

describe('les règles du casier', () => {
  // Mutations : `liasseDe` sans tri (l'ordre reçu, le dernier devant) ; un tri qui renumérote.
  it('la liasse va du plus ancien billet au plus récent, quel que soit l’ordre reçu, sans renuméroter', () => {
    const b = billetsDeLaDecennie(TOUS, 1900, DEPART)
    expect(liasseDe([...b].reverse()).map((x) => `${x.numero}:${x.item.entry.id}`)).toEqual(['1:e0', '2:e1', '3:e2', '4:e3'])
    expect(liasseDe([b[3]!, b[1]!]).map((x) => x.numero)).toEqual([2, 4])
  })

  // Mutations : « 1 billets » ; « 0 billet » sous une case sans billet.
  it('dit le compte d’une case et le titre de sa liasse', () => {
    expect([0, 1, 15].map(compteDeLaCase)).toEqual(['vide', '1 billet', '15 billets'])
    expect([0, 1, 2].map(compteDeLaLiasse)).toEqual(['aucun billet', '1 billet', '2 billets'])
    expect([titreDeLaLiasse(1903), titreDeLaLiasse(null)]).toEqual(['La liasse de 1903', 'Toute la liasse'])
  })
})

describe('le casier du contrôleur', () => {
  // Mutations : une case oubliée ; le compte d'une case pris ailleurs que chez la page.
  it('porte une case par année de la décennie et « Tous », à la place de la boîte de la foire', async () => {
    monterVoyage(BOITE, ROUTES)
    expect(await screen.findByRole('heading', { level: 1, name: PAGES_1900.mots.boite.titre })).toBeInTheDocument()
    const noms = (await cases()).getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(noms).toEqual(['1900, vide', '1901, 1 billet', '1902, vide', '1903, 2 billets', '1904, vide', '1905, 1 billet', '1906, vide', '1907, vide', '1908, vide', '1909, vide', 'Tous, 4 billets'])
    expect(screen.queryByRole('group', { name: 'Les intercalaires' })).toBeNull()
    expect(screen.queryByRole('list', { name: 'Les billets' })).toBeNull()
  })

  // La page passe les années du Voyage ; le casier n'en invente aucune. Le départ du Voyage tombe au
  // milieu des années 1890 : le casier, prêté à leur boîte, n'y porte aucune case d'avant 1895, et un
  // film de 1892 n'y a ni carton ni numéro. Mutation : les dix années de la décennie dessinées par le
  // casier (`Array.from({ length: 10 }, (_, k) => 1890 + k)` à la place des années reçues).
  it('ne porte aucune case pour une année d’avant le départ du Voyage', async () => {
    const avant = PAGES_1890.gabarits
    PAGES_1890.gabarits = { casier: PAGES_1900.gabarits.casier }
    try {
      const pierrot = vu('a0', 1892, '2026-03-01', { titre: 'Pauvre Pierrot' })
      const sortie = vu('a1', 1895, '2026-03-02', { titre: 'La Sortie de l’usine' })
      monterVoyage('/voyage/decennies/1890/billets', { [CARTE]: () => json(VOYAGE), 'GET /api/me/journal?limit=100&sortie_min=1890&sortie_max=1899': journal([sortie, pierrot]) })
      const noms = (await cases()).getAllByRole('button').map((b) => b.getAttribute('aria-label'))
      expect(noms).toEqual(['1895, 1 billet', '1896, vide', '1897, vide', '1898, vide', '1899, vide', 'Tous, 1 billet'])
      expect((await liasse(M.toute)).map((c) => c.textContent)).toEqual([expect.stringMatching(/La Sortie de l’usine.*N° 0001/)])
      expect(screen.queryByText(/Pauvre Pierrot/)).toBeNull()
    } finally {
      PAGES_1890.gabarits = avant
    }
  })

  // Mutations : une fiche d'année lue par le casier ou par le billet sorti (`useQuery` sur
  // `cles.annee`) ; le catalogue des réactions lu dès l'ouverture du casier. La liste gagne l'état du
  // voyageur au brief 8 du lot d'écrans, parce que la règle change : 1900 compose le contrôleur, sa
  // boîte lit ses poinçons ; et mes tables au brief 16, de même : 1900 compose le wagon-restaurant, sa
  // boîte lit ses tampons « Vu ensemble ». Elle reste entière : une lecture de plus doit y passer.
  it('ne lit que la carte, mes films de la décennie, l’état du voyageur et mes tables, puis les réactions du seul billet sorti : jamais une fiche d’année', async () => {
    const { requetes, client } = monterVoyage(BOITE, ROUTES)
    await liasse(M.toute)
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(requetes.filter((r) => r !== 'GET /api/auth/me').sort()).toEqual([CARTE, JOURNAL, TABLES, VOYAGEUR].sort())
    fireEvent.click(carton(/Life of an American Fireman/))
    await screen.findByRole('dialog', { name: 'Life of an American Fireman' })
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(carton(/Le Vol du grand rapide/))
    const dialogue = await screen.findByRole('dialog', { name: 'Le Vol du grand rapide' })
    expect(await within(dialogue).findByText('❤️ J’ai adoré')).toBeInTheDocument()
    expect(requetes.filter((r) => r !== 'GET /api/auth/me').sort()).toEqual([CARTE, JOURNAL, REACTIONS, TABLES, VOYAGEUR].sort())
  })

  // Le numéro est celui du billet de séance : la même liste, la même règle (`billetsDeLaDecennie`,
  // `numeroDe`), jamais le rang dans la liasse. Mutations : `numeroLisible(i + 1)` sur le carton ;
  // `liasseDe` contournée (le dernier devant, comme la foire) ; la date, la note ou le tampon retirés.
  it('sort la liasse d’une case du plus ancien au plus récent, chaque billet sur son carton, à son numéro de séance', async () => {
    monterVoyage(`${BOITE}?annee=1903`, ROUTES)
    const cartons = await liasse('La liasse de 1903')
    const numero = (id: string) => numeroLisible(numeroDe(billetsDeLaDecennie(TOUS, 1900, DEPART), id)!)
    expect([numero('e1'), numero('e3')]).toEqual(['N° 0002', 'N° 0004'])
    expect(cartons).toHaveLength(2)
    expect(cartons[0]!.textContent).toBe(`${C.compagnie}Life of an American FiremanEdwin S. Porter · gare de 1903${numero('e1')}sans note01 MA 26VU`)
    expect(cartons[1]!.textContent).toBe(`${C.compagnie}Le Vol du grand rapideEdwin S. Porter · gare de 1903${numero('e3')}8 / 1001 SE 26VU`)
    // La date pressée ne se lit pas : le tampon la dit.
    expect(within(cartons[1]!).getByRole('img', { name: 'VU : Le voyage immobile · vu le 1er septembre 2026' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'La liasse de 1903 2 billets' })).toBeInTheDocument()
    // Sous « Tous », toute la liasse, dans le même sens.
    fireEvent.click((await cases()).getByRole('button', { name: /^Tous/ }))
    expect((await liasse(M.toute)).map((c) => /N° \d{4}/.exec(c.textContent!)![0])).toEqual(['N° 0001', 'N° 0002', 'N° 0003', 'N° 0004'])
  })

  // Mutations : `onChoisir` non branché sur une case, ou sur « Tous » ; `aria-pressed` figé ; la
  // phrase d'une case sans billet tue.
  it('la case choisie vit dans l’adresse, « Tous » l’en retire, une case sans billet le dit', async () => {
    monterVoyage([`/voyage/decennies/1900`, BOITE], { ...ROUTES, 'GET /api/me/voyage/tickets': () => json({ tickets: [] }) })
    const c = await cases()
    expect(c.getByRole('button', { name: /^Tous/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(c.getByRole('button', { name: /^1905/ }))
    expect(c.getByRole('button', { name: /^1905/ })).toHaveAttribute('aria-pressed', 'true')
    expect(c.getByRole('button', { name: /^Tous/ })).toHaveAttribute('aria-pressed', 'false')
    expect((await liasse('La liasse de 1905')).map((x) => x.textContent)).toEqual([expect.stringContaining('Rescued by Rover')])

    fireEvent.click(c.getByRole('button', { name: /^1904/ }))
    expect(screen.getByText(PAGES_1900.mots.boite.vide)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'La liasse de 1904 aucun billet' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: /liasse/i })).toBeNull()

    fireEvent.click(c.getByRole('button', { name: /^Tous/ }))
    expect(await liasse(M.toute)).toHaveLength(4)
    // L'adresse est remplacée, pas empilée : le retour quitte le casier d'un seul geste.
    fireEvent.click(screen.getByRole('link', { name: 'Retour aux années 1900' }))
    await waitFor(() => expect(screen.queryByRole('group', { name: M.cases })).toBeNull())
  })

  it('ouvre la case que porte l’adresse, et ignore une année qui n’a pas de case', async () => {
    monterVoyage(`${BOITE}?annee=1905`, ROUTES)
    expect(await liasse('La liasse de 1905')).toHaveLength(1)
    cleanup()
    monterVoyage(`${BOITE}?annee=1899`, ROUTES)
    expect(await liasse(M.toute)).toHaveLength(4)
  })

  // Mutations : `nouveau` ignoré par le casier (ni marque ni mot) ; la marque posée sur tout carton.
  it('met en avant, une fois, le billet que la séance vient de ranger, sa case ouverte', async () => {
    rangerLeBillet(SESSION.user.id, 'e3')
    const premiere = monterVoyage(`${BOITE}?annee=1905`, ROUTES)
    const cartons = await liasse('La liasse de 1903')
    expect(cartons.map((x) => x.getAttribute('data-neuf'))).toEqual([null, 'oui'])
    expect(cartons[1]).toHaveAccessibleName(new RegExp(`, ${M.range}$`))
    expect(cartons[0]).not.toHaveAccessibleName(new RegExp(M.range))
    premiere.unmount()

    monterVoyage(`${BOITE}?annee=1903`, ROUTES)
    expect((await liasse('La liasse de 1903')).map((x) => x.getAttribute('data-neuf'))).toEqual([null, null])
  })

  // Au calme, rien ne bouge : la feuille n'anime que sous `data-vivante='oui'`. Mutation : `calme`
  // ignoré dans `CasierDuControleur` ou dans `BilletDuCasier`.
  it('au calme, ni le casier ni le billet sorti ne bougent ; sinon ils vivent', async () => {
    const vivantes = async () => {
      const racine = (await screen.findByRole('group', { name: M.cases })).closest('[data-vivante]')
      fireEvent.click(carton(/Rescued by Rover/))
      const sorti = (await screen.findByRole('dialog')).closest('[data-vivante]')
      return [racine?.getAttribute('data-vivante'), sorti?.getAttribute('data-vivante')]
    }
    monterVoyage(BOITE, ROUTES)
    expect(await vivantes()).toEqual(['oui', 'oui'])
    cleanup()
    calme()
    monterVoyage(BOITE, ROUTES)
    expect(await vivantes()).toEqual(['non', 'non'])
    // Au calme, aucun carton n'attend son tour.
    expect((await liasse(M.toute)).map((x) => x.closest('li')!.style.animationDelay)).toEqual(['', '', '', ''])
  })
})

describe('un billet du casier sorti en grand', () => {
  // La remarque est la mienne : elle vient de `/me/journal`, la seule lecture de la page avec la carte
  // (le compte des requêtes, plus haut). Mutations : la date en toutes lettres, la note, une réaction
  // ou la remarque tues ; le focus laissé sur la page ; Échap sans effet ; le billet hors de l'adresse.
  it('dit la date, la note, les réactions et ma remarque, prend le focus, vit dans l’adresse et se range à Échap', async () => {
    monterVoyage(`${BOITE}?annee=1903`, ROUTES)
    await liasse('La liasse de 1903')
    carton(/Le Vol du grand rapide/).focus()
    fireEvent.click(carton(/Le Vol du grand rapide/))
    const dialogue = await screen.findByRole('dialog', { name: 'Le Vol du grand rapide' })
    const d = within(dialogue)
    expect(d.getByText('Séance du 1er septembre 2026')).toBeInTheDocument()
    expect(d.getByText('8 / 10')).toBeInTheDocument()
    expect(d.getByText('N° 0004')).toBeInTheDocument()
    expect(d.getByText('Edwin S. Porter · gare de 1903')).toBeInTheDocument()
    const reactions = within(d.getByRole('list', { name: M.reactions }))
    expect(await reactions.findByText('❤️ J’ai adoré')).toBeInTheDocument()
    expect(reactions.getByText('🎬 En salle')).toBeInTheDocument()
    expect(d.getByText('Le coup de feu vers la salle.')).toBeInTheDocument()
    expect(d.getByText(C.remarqueSous)).toBeInTheDocument()
    expect(d.getByRole('button', { name: PAGES_1900.mots.boite.ranger })).toHaveFocus()
    expect(screen.getByRole('group', { name: M.cases })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(carton(/Le Vol du grand rapide/)).toHaveFocus()
  })

  // Mutations : un billet sans note qui dirait « 0 / 10 » ; un carnet vide ou une liste de coupons
  // vide montrés ; « Ranger au casier » sans effet.
  it('sans note, sans réaction ni remarque, ne montre ni coupon ni carnet, et se range d’un toucher', async () => {
    monterVoyage(`${BOITE}?billet=e1`, ROUTES)
    const d = within(await screen.findByRole('dialog', { name: 'Life of an American Fireman' }))
    expect(d.getByText('sans note')).toBeInTheDocument()
    expect(d.getByText('Séance du 1er mai 2026')).toBeInTheDocument()
    expect(d.queryByRole('list')).toBeNull()
    expect(d.queryByText(C.remarque)).toBeNull()
    fireEvent.click(d.getByRole('button', { name: PAGES_1900.mots.boite.ranger }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  // La boîte ne lit jamais la fiche d'une année : « Corriger » ne s'offre que si elle est déjà en cache.
  // Mutations : le lien jamais offert par le billet du monde ; offert sans l'entrée dans son état (le
  // composteur n'aurait rien à corriger).
  it('n’offre « Corriger le billet » que si la fiche de l’année est déjà lue, et mène au composteur en correction', async () => {
    monterVoyage(`${BOITE}?billet=e3`, ROUTES)
    await screen.findByRole('dialog', { name: 'Le Vol du grand rapide' })
    expect(screen.queryByRole('link', { name: new RegExp(C.corriger) })).toBeNull()
    cleanup()

    const fiche = fichePrete({ annee: 1903, salles: [salle({ id: 's1', films: [filmDeSalle({ id: 'f-vol', tmdb_id: 776, title: 'Le Vol du grand rapide', year: 1903 })] })] })
    const { requetes } = monterVoyage(`${BOITE}?billet=e3`, { ...ROUTES, 'GET /api/me/voyage/annees/1903': () => json(fiche) }, (client) => client.setQueryData(cles.annee(1903), fiche))
    const lien = await screen.findByRole('link', { name: `${C.corriger} ${C.corrigerSous}` })
    expect(lien).toHaveAttribute('href', '/voyage/1903/films/f-vol/billet/corriger')
    expect(requetes).not.toContain('GET /api/me/voyage/annees/1903')
    fireEvent.click(lien)
    // Le composteur en correction : le carton porte le titre de la page, et garde son numéro.
    expect(await screen.findByRole('heading', { level: 1, name: 'Le Vol du grand rapide' })).toBeInTheDocument()
    expect(screen.queryByText('Ce visionnage n’est plus disponible.')).toBeNull()
    expect(await screen.findByText('N° 0004')).toBeInTheDocument()
  })
})

describe('le poinçon doré au casier', () => {
  /** Une seconde séance du « Vol du grand rapide » : le même film (`media_id`), une autre entrée, la seule présentée au contrôleur. */
  const SECONDE = vu('e4', 1903, '2026-09-20', { titre: 'Le Vol du grand rapide', note: 9, realisateur: 'Edwin S. Porter', tmdb: 776 })
  SECONDE.media.id = VOL.media.id
  SECONDE.entry.media_id = VOL.entry.media_id
  const POINCONNE: Voyageur = { ...VOYAGEUR_VIDE, poincons: [{ log_entry_id: SECONDE.entry.id, media_id: SECONDE.media.id, poinconne_le: '2026-10-08T18:00:00.000Z' }] }
  const AVEC = { ...ROUTES, [JOURNAL]: journal([...TOUS, SECONDE]), [VOYAGEUR]: () => json(POINCONNE) }
  const poincons = (ou: HTMLElement) => within(ou).queryAllByRole('img', { name: C.poincon })

  // Mutations : `poinconnes` ignoré par le casier ; le poinçon posé sur tout carton dès qu'un billet
  // l'est ; cherché par le film (`media.id`, sur une table de films : la première séance le porterait) ;
  // `poinconne` ignoré par le billet sorti, ou vrai pour tous ; le nom du poinçon tu dans le bouton du
  // carton ; le poinçon du casier dit « frais » (il se percerait à chaque sortie de la liasse).
  it('un billet présenté au contrôleur garde son poinçon, en liasse et sorti en grand ; l’autre séance du même film n’en porte pas', async () => {
    monterVoyage(`${BOITE}?annee=1903`, AVEC)
    const cartons = await liasse('La liasse de 1903')
    expect(cartons.map((x) => within(x).getByText(/^N° /).textContent)).toEqual(['N° 0002', 'N° 0004', 'N° 0005'])
    await waitFor(() => expect(cartons.map((x) => poincons(x).length)).toEqual([0, 0, 1]))
    expect(cartons[2]).toHaveAccessibleName(new RegExp(C.poincon))
    expect(cartons[1]).not.toHaveAccessibleName(new RegExp(C.poincon))
    expect(poincons(cartons[2]!)[0]).not.toHaveAttribute('data-frais')

    fireEvent.click(cartons[2]!)
    const sorti = await screen.findByRole('dialog', { name: 'Le Vol du grand rapide' })
    expect(within(sorti).getByText('N° 0005')).toBeInTheDocument()
    expect(poincons(sorti)).toHaveLength(1)
    expect(poincons(sorti)[0]).not.toHaveAttribute('data-frais')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    fireEvent.click(cartons[1]!)
    const autre = await screen.findByRole('dialog', { name: 'Le Vol du grand rapide' })
    expect(within(autre).getByText('N° 0004')).toBeInTheDocument()
    expect(poincons(autre)).toHaveLength(0)
  })

  // La garde de la page est tenue sur un dessin prêté (`pages/VoyageBoite.poincon.test.tsx`) ; ici,
  // le casier de 1900 lui-même. Mutation : l'erreur de l'état du voyageur jointe aux pannes de la page.
  it('l’état du voyageur en panne : toute la liasse, aucun poinçon, pas un mot', async () => {
    const { client, requetes } = monterVoyage(BOITE, { ...AVEC, [VOYAGEUR]: () => json({ code: 'INTERNAL', message: 'Le contrôleur est souffrant.', retryable: false }, 500) })
    const cartons = await liasse(M.toute)
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(requetes).toContain(VOYAGEUR)
    expect(cartons).toHaveLength(5)
    expect(cartons.map((x) => poincons(x).length)).toEqual([0, 0, 0, 0, 0])
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/souffrant/)).toBeNull()
  })
})

describe('le tampon « Vu ensemble » au casier', () => {
  /** Une seconde séance du « Vol du grand rapide » : le même film (`media_id`), une autre entrée, celle de la table vue à deux. */
  const SECONDE = vu('e4', 1903, '2026-09-20', { titre: 'Le Vol du grand rapide', note: 9, realisateur: 'Edwin S. Porter', tmdb: 776 })
  SECONDE.media.id = VOL.media.id
  SECONDE.entry.media_id = VOL.entry.media_id
  /** L'exemple du contrat : chez bob, vue ensemble, mon billet. Ici, mon billet est la seconde séance. */
  const VUE = exemple<Tables>('/me/voyage/tables', 'get', 200).tables[1]!
  const table = (plus: Partial<Table> = {}): Table => ({ ...VUE, mon_billet: { ...VUE.mon_billet!, id: SECONDE.entry.id, media_id: SECONDE.media.id }, ...plus })
  const servir = (tables: Table[], voyageur: Voyageur = VOYAGEUR_VIDE) => ({ ...ROUTES, [JOURNAL]: journal([...TOUS, SECONDE]), [TABLES]: () => json({ tables }), [VOYAGEUR]: () => json(voyageur) })
  const tampons = (ou: HTMLElement) => within(ou).queryAllByRole('img', { name: C.ensemble.dit })
  const poincons = (ou: HTMLElement) => within(ou).queryAllByRole('img', { name: C.poincon })

  // Mutations : `vusEnsemble` ignoré par le casier ; le tampon posé sur tout carton ; cherché par le
  // film (`mon_billet.media_id` dans `entreesVuesEnsemble`, et `entry.media_id` au casier : la première
  // séance le porterait) ; `vuEnsemble` ignoré par le billet sorti, ou vrai pour tous ; son nom tu dans
  // le bouton du carton.
  it('le billet d’une table vue à deux porte le tampon, en liasse et sorti en grand ; l’autre séance du même film ne le porte pas', async () => {
    monterVoyage(`${BOITE}?annee=1903`, servir([table()]))
    const cartons = await liasse('La liasse de 1903')
    expect(cartons.map((x) => within(x).getByText(/^N° /).textContent)).toEqual(['N° 0002', 'N° 0004', 'N° 0005'])
    await waitFor(() => expect(cartons.map((x) => tampons(x).length)).toEqual([0, 0, 1]))
    expect(tampons(cartons[2]!)[0]).toHaveTextContent(C.ensemble.mot)
    expect(cartons[2]).toHaveAccessibleName(new RegExp(C.ensemble.dit))
    expect(cartons[1]).not.toHaveAccessibleName(new RegExp(C.ensemble.dit))
    expect(cartons.map((x) => poincons(x).length)).toEqual([0, 0, 0])

    fireEvent.click(cartons[2]!)
    const sorti = await screen.findByRole('dialog', { name: 'Le Vol du grand rapide' })
    expect(within(sorti).getByText('N° 0005')).toBeInTheDocument()
    expect(tampons(sorti)).toHaveLength(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    fireEvent.click(cartons[1]!)
    const autre = await screen.findByRole('dialog', { name: 'Le Vol du grand rapide' })
    expect(within(autre).getByText('N° 0004')).toBeInTheDocument()
    expect(tampons(autre)).toHaveLength(0)
  })

  // **`vu_ensemble` se lit tel que servi** : une place prise, mon billet déjà au journal, ne tamponne
  // rien tant que l'autre ne l'a pas vu. Mutations : `vu_ensemble` remplacé par
  // `etat === 'a_pris_sa_place'` dans `entreesVuesEnsemble` ; tout `mon_billet` tamponné.
  it('une place prise ne tamponne rien tant que le serveur ne dit pas « vu ensemble »', async () => {
    const { client, requetes } = monterVoyage(BOITE, servir([table({ vu_ensemble: false, etat: 'a_pris_sa_place' })]))
    const cartons = await liasse(M.toute)
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(requetes).toContain(TABLES)
    expect(cartons).toHaveLength(5)
    expect(cartons.map((x) => tampons(x).length)).toEqual([0, 0, 0, 0, 0])
    expect(document.body.textContent).not.toMatch(/vu ensemble/i)
  })

  // Un billet présenté au contrôleur **et** vu à deux porte les deux marques : le poinçon n'est pas
  // effacé par le tampon, ni l'inverse. Mutations : une seule marque dans `Carton` (`poincon &&
  // !ensemble`, `ensemble && !poincon`) ; au casier, le tampon passé à la place du poinçon
  // (`ensemble` seulement quand `poinconnes` ne l'a pas).
  it('un billet poinçonné et vu ensemble garde ses deux marques, en liasse et sorti en grand', async () => {
    const POINCONNE: Voyageur = { ...VOYAGEUR_VIDE, poincons: [{ log_entry_id: SECONDE.entry.id, media_id: SECONDE.media.id, poinconne_le: '2026-10-08T18:00:00.000Z' }] }
    monterVoyage(`${BOITE}?annee=1903`, servir([table()], POINCONNE))
    const cartons = await liasse('La liasse de 1903')
    await waitFor(() => expect(cartons.map((x) => [tampons(x).length, poincons(x).length])).toEqual([[0, 0], [0, 0], [1, 1]]))
    expect(cartons[2]).toHaveAccessibleName(new RegExp(C.ensemble.dit))
    expect(cartons[2]).toHaveAccessibleName(new RegExp(C.poincon))

    fireEvent.click(cartons[2]!)
    const sorti = await screen.findByRole('dialog', { name: 'Le Vol du grand rapide' })
    expect([tampons(sorti).length, poincons(sorti).length]).toEqual([1, 1])
  })

  // Mutation : l'erreur de mes tables jointe aux pannes de la page (`voyage.error || journal.error`).
  it('mes tables en panne : toute la liasse, aucun tampon, pas un mot', async () => {
    const { client, requetes } = monterVoyage(BOITE, { ...servir([]), [TABLES]: () => json({ code: 'INTERNAL', message: 'Le wagon est en révision.', retryable: false }, 500) })
    const cartons = await liasse(M.toute)
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(requetes).toContain(TABLES)
    expect(cartons).toHaveLength(5)
    expect(cartons.map((x) => tampons(x).length)).toEqual([0, 0, 0, 0, 0])
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/révision/)).toBeNull()
  })
})
