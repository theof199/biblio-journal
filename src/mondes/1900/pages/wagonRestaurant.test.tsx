import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '../../../api/client'
import type { Table, Tables, Voyage } from '../../../api/voyage'
import { creerRegistre } from '../..'
import { exemple } from '../../../test/contrat'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { ROUTES_DU_JEU, annee, voyage1890 } from '../../../test/voyage'
import type { TableDuWagon } from '../../../voyage/wagon/tables'
import WagonRestaurant from './WagonRestaurant'
import { MOTS_DU_COMPOSTEUR as C } from './carton'
import { MOTS_DU_WAGON as M, cartonDeLHote, cartonDeLInvite, ceQueDitLaTable, soirPasseDit } from './wagon'

// Le wagon-restaurant de 1900 (plan des écrans des lots, brief 15) : ce qu'il dit et ce qu'il offre,
// jamais son tracé. La page (la lecture, les écritures, le verrou, le renvoi à la carte) est tenue par
// `pages/VoyageWagonRestaurant.test.tsx`, les règles par `voyage/wagon/tables.test.ts`.
const monde = creerRegistre()(1900)
const EXEMPLE = exemple<Tables>('/me/voyage/tables', 'get', 200)
/** Alice (moi) a dressé une table pour bob. */
const LA_MIENNE: Table = { ...EXEMPLE.tables[0]!, soir: '2026-10-09' }
/** Bob m'invite. */
const CHEZ_BOB: Table = { ...LA_MIENNE, id: 'a1000000-0000-4000-8000-000000000001', hote: LA_MIENNE.invite, invite: LA_MIENNE.hote, film: { tmdb_id: 775, titre: 'Le Voyage dans la Lune' } }
const CAROL: Table['hote'] = { ...LA_MIENNE.invite, id: '33333333-3333-4333-8333-333333333333', pseudo: 'carol' }
const CHEZ_CAROL: Table = { ...CHEZ_BOB, id: 'b2000000-0000-4000-8000-000000000002', hote: CAROL, film: { tmdb_id: 22968, titre: 'Le Voyage à travers l’impossible' } }
/** L'exemple du contrat : chez bob, le 2 octobre, vue ensemble, mon billet noté 8 le 3. */
const VUE: Table = EXEMPLE.tables[1]!
const AUCUN = { prendre: false, decliner: false }
const LES_DEUX = { prendre: true, decliner: true }
const invite = (table: Table, plus: Partial<TableDuWagon> = {}): TableDuWagon => ({ table, role: 'invite', passee: false, gestes: LES_DEUX, enCours: false, refus: null, ...plus })
const hote = (table: Table, plus: Partial<TableDuWagon> = {}): TableDuWagon => ({ table, role: 'hote', passee: false, gestes: AUCUN, enCours: false, refus: null, ...plus })
const etat = (table: Table, e: Table['etat']): Table => ({ ...table, etat: e })

const calmer = (calme: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches: calme, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
function monter(tables: TableDuWagon[] | null, plus: { panne?: { erreur: Error; reessayer: () => void } } = {}) {
  const prendre = vi.fn()
  const decliner = vi.fn()
  const vue = render(<WagonRestaurant monde={monde} moi="alice" panne={plus.panne ?? null} tables={tables} prendre={prendre} decliner={decliner} />)
  return { ...vue, prendre, decliner }
}
const duSoir = () => within(screen.getByRole('list', { name: M.ceSoir })).getAllByRole('article')
const boutons = (dans: HTMLElement = document.body) => within(dans).queryAllByRole('button').map((b) => b.textContent)
const cartons = (table: HTMLElement) => [...table.querySelectorAll('[data-qui]')].map((c) => `${c.getAttribute('data-qui')} : ${c.querySelector('b')!.textContent} / ${c.querySelector('span')!.textContent}`)
const scene = (table: HTMLElement) => table.querySelector('[data-etat]')!

describe('le wagon-restaurant de 1900', () => {
  beforeEach(() => calmer(true))
  afterEach(() => vi.unstubAllGlobals())

  // **Plusieurs invitations peuvent attendre le même soir : une liste, pas une scène unique.**
  // Mutations : la première table du soir seule (`ceSoir.slice(0, 1)`) ; les tables triées ; une
  // table passée montée en scène (le filtre `!t.passee` retiré).
  it('monte une scène par table de ce soir, dans l’ordre reçu, chacune sous son nom', () => {
    monter([invite(CHEZ_BOB), invite(CHEZ_CAROL), hote(LA_MIENNE), invite(VUE, { passee: true, gestes: AUCUN })])

    expect(screen.getByRole('heading', { level: 1, name: M.titre })).toBeInTheDocument()
    expect(duSoir().map((a) => a.getAttribute('aria-label'))).toEqual(['La table de bob', 'La table de carol', 'Ta table, avec bob'])
    expect(duSoir().map((a) => a.querySelectorAll('svg').length)).toEqual([1, 1, 1])
  })

  // Les gestes sont ceux que la page offre, et eux seuls : le dessin ne regarde ni le rôle ni l'état
  // pour en décider. Mutations : les deux boutons toujours rendus ; « Prendre ma place » rendu sur
  // `gestes.decliner` ; les deux rappels échangés ; l'identifiant d'une autre table passé.
  it('n’offre que les gestes reçus : rien à l’hôte, « Décliner » seul une fois la place prise, plus rien une fois déclinée', () => {
    const { prendre, decliner } = monter([invite(CHEZ_BOB), invite(etat(CHEZ_CAROL, 'a_pris_sa_place'), { gestes: { prendre: false, decliner: true } }), hote(LA_MIENNE)])
    const [bob, carol, mienne] = duSoir()

    expect(boutons(bob)).toEqual([`${M.prendre}ce soir, avec bob`, `${M.decliner}${M.rienNeSePerd}`])
    expect(boutons(carol)).toEqual([`${M.decliner}${M.rienNeSePerd}`])
    expect(boutons(mienne)).toEqual([])
    // Sans geste, pas de rangée de gestes vide sous la table.
    expect([bob, carol, mienne].map((t) => t!.querySelectorAll('[class*="choix"]').length)).toEqual([1, 1, 0])
    fireEvent.click(within(bob!).getByRole('button', { name: /Prendre ma place/ }))
    fireEvent.click(within(carol!).getByRole('button', { name: /Décliner/ }))
    expect(prendre.mock.calls).toEqual([[CHEZ_BOB.id]])
    expect(decliner.mock.calls).toEqual([[CHEZ_CAROL.id]])
  })

  // Chaque geste suit le sien : la page seule décide. Mutation : « Décliner » toujours rendu.
  it('une table déclinée n’offre plus rien, et « Décliner » ne vient pas avec « Prendre ma place »', () => {
    const { unmount } = monter([invite(etat(CHEZ_BOB, 'a_decline'), { gestes: AUCUN })])
    expect(boutons()).toEqual([])
    unmount()
    monter([invite(CHEZ_BOB, { gestes: { prendre: true, decliner: false } })])
    expect(boutons()).toEqual([`${M.prendre}ce soir, avec bob`])
  })

  // L'état se lit sur la table : le couvert de l'hôte toujours servi, celui de l'invité selon `etat`,
  // tel que servi. Mutations : `data-etat` figé à « attend » ; les deux cartons échangés ; « Toi »
  // posé sur le carton de l'autre ; le carton de l'hôte dit par `etat` (« sa place l'attend ») ; le
  // carton de l'invité dit par les mots de l'hôte.
  it.each([
    ['attend', 'ta place t’attend', 'sa place l’attend'],
    ['a_pris_sa_place', 'tu as pris ta place', 'a pris sa place'],
    ['a_decline', 'place rendue', 'place rendue'],
  ] as const)('la scène porte l’état « %s », et les cartons le disent à l’invité comme à l’hôte', (e, aMoi, aLui) => {
    monter([invite(etat(CHEZ_BOB, e)), hote(etat(LA_MIENNE, e))])
    const [bob, mienne] = duSoir()

    expect(scene(bob!)).toHaveAttribute('data-etat', e)
    expect(cartons(bob!)).toEqual(['hote : bob / a pris sa place', `invite : Toi / ${aMoi}`])
    expect(scene(mienne!)).toHaveAttribute('data-etat', e)
    expect(cartons(mienne!)).toEqual(['hote : Toi / tu as pris ta place', `invite : bob / ${aLui}`])
    expect(cartonDeLHote(CHEZ_BOB, 'invite')).toEqual({ nom: 'bob', dit: 'a pris sa place' })
    expect(cartonDeLInvite(etat(LA_MIENNE, e), 'hote')).toEqual({ nom: 'bob', dit: aLui })
  })

  // Le menu : `film.titre` et « ce soir ». Ni réalisateur, ni année, ni durée, ni heure (constat 17 :
  // `film` ne porte que `tmdb_id` et `titre`). Mutations : « féerie de Georges Méliès, 1904 » ou
  // « vingt minutes » remis au menu ; « Ce soir à 8 h ½ » ; le titre écrit en dur.
  it('le menu ne dit que le titre servi et « ce soir »', () => {
    monter([invite(CHEZ_BOB), invite(CHEZ_CAROL)])

    const menus = duSoir().map((a) => a.querySelector('strong')!.parentElement!.textContent)
    expect(menus).toEqual([
      `${M.sur}${M.titre}${M.menu}${M.plat}Le Voyage dans la Lune${M.ceSoir}${M.service}`,
      `${M.sur}${M.titre}${M.menu}${M.plat}Le Voyage à travers l’impossible${M.ceSoir}${M.service}`,
    ])
    expect(document.body.textContent).not.toMatch(/Méliès|19\d\d|minutes|8 h|Composter/)
  })

  // **« Vu ensemble » se lit sur `vu_ensemble`, jamais déduit** : une place prise ne le dit pas, ni ce
  // soir ni un soir passé. Mutations : `vu_ensemble` remplacé par `etat === 'a_pris_sa_place'` dans
  // `ceQueDitLaTable`, puis dans `soirPasseDit` ; « Vu ensemble » dit dès que `mon_billet` existe.
  it('« Vu ensemble » ne se dit que si le serveur le dit', () => {
    const prise = etat(CHEZ_BOB, 'a_pris_sa_place')
    const { unmount } = monter([invite(prise), invite({ ...VUE, vu_ensemble: false }, { passee: true, gestes: AUCUN })])
    expect(document.body.textContent).not.toMatch(/Vu ensemble/)
    expect(ceQueDitLaTable(prise, 'invite')).toBe('Deux couverts ce soir : ton verre est servi. Si vous voyez tous deux le film, vos billets porteront le même tampon.')
    expect(soirPasseDit({ ...VUE, vu_ensemble: false }, 'invite').reste).toBe('place prise')
    unmount()

    monter([invite({ ...prise, vu_ensemble: true }), invite(VUE, { passee: true, gestes: AUCUN })])
    expect(within(duSoir()[0]!).getByRole('status')).toHaveTextContent('Vous l’avez vu tous les deux : « Vu ensemble ».')
    expect(within(screen.getByRole('list', { name: M.passees })).getByRole('listitem')).toHaveTextContent(/Vu ensemble$/)
    // Même une table qui attendrait encore : le serveur seul le dit.
    expect(ceQueDitLaTable({ ...CHEZ_BOB, vu_ensemble: true }, 'invite')).toMatch(/Vu ensemble/)
  })

  // Ce que chaque état dit, à l'invité et à l'hôte. Mutations : les phrases de l'hôte dites à
  // l'invité ; « la proposition retourne au train du soir » remise (faux au contrat).
  it('dit l’état de la table, à l’invité puis à l’hôte', () => {
    expect((['attend', 'a_pris_sa_place', 'a_decline'] as const).map((e) => ceQueDitLaTable(etat(CHEZ_BOB, e), 'invite'))).toEqual([
      'bob t’invite à sa table, ce soir seulement.',
      'Deux couverts ce soir : ton verre est servi. Si vous voyez tous deux le film, vos billets porteront le même tampon.',
      'Place rendue : bob garde la sienne. Rien ne se perd.',
    ])
    expect((['attend', 'a_pris_sa_place', 'a_decline'] as const).map((e) => ceQueDitLaTable(etat(LA_MIENNE, e), 'hote'))).toEqual([
      'bob n’a pas encore pris sa place.',
      'bob a pris sa place : deux couverts ce soir. Si vous voyez tous deux le film, vos billets porteront le même tampon.',
      'bob a rendu sa place : ta soirée est libre.',
    ])
    monter([invite(CHEZ_BOB)])
    expect(within(duSoir()[0]!).getByRole('status')).toHaveTextContent('bob t’invite à sa table, ce soir seulement.')
  })

  // Les soirs passés : des lignes, sans scène ni geste, dans l'ordre reçu ; le jour est celui servi,
  // dit hors du fuseau de l'appareil. **Ce test change au brief 16 parce que la règle change** : une
  // table vue à deux montre mon billet tamponné (il disait « sans billet »). Le billet de l'autre
  // n'est pas dessiné, et une table qui n'est pas vue à deux n'en montre aucun. Mutations : un bouton
  // rendu sur une ligne passée, même offert par erreur ; le jour passé par `new Date(soir)` sous un
  // fuseau de l'ouest ; « n'a pas eu lieu » dit d'une table déclinée ; `MonBillet` retiré des lignes
  // passées, ou monté sur toutes.
  it('un soir passé se dit en une ligne, sans scène, sans geste ; vu à deux, il montre mon billet tamponné, et lui seul', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    const jamais: Table = { ...LA_MIENNE, id: 'd4000000-0000-4000-8000-000000000004', soir: '2026-10-01' }
    monter([invite(VUE, { passee: true, gestes: LES_DEUX }), hote(jamais, { passee: true }), invite(etat({ ...CHEZ_CAROL, soir: '2026-09-30' }, 'a_decline'), { passee: true, gestes: AUCUN })])
    vi.unstubAllEnvs()

    expect(screen.queryByRole('list', { name: M.ceSoir })).toBeNull()
    expect(screen.getByText(M.aucune)).toBeInTheDocument()
    const lignes = within(screen.getByRole('list', { name: M.passees })).getAllByRole('listitem')
    expect(lignes.map((l) => [...l.querySelectorAll(':scope > small, :scope > b, :scope > span, :scope > em')].map((c) => c.textContent).join(' | '))).toEqual([
      '2 octobre 2026 | Le Voyage dans la Lune | à la table de bob | Vu ensemble',
      '1er octobre 2026 | Le Voyage à travers l’impossible | à ta table, avec bob | n’a pas eu lieu',
      '30 septembre 2026 | Le Voyage à travers l’impossible | à la table de carol | place rendue',
    ])
    expect(boutons()).toEqual([])
    expect(document.querySelectorAll('svg')).toHaveLength(0)
    expect(lignes.map((l) => within(l).queryAllByRole('figure', { name: M.monBillet }).length)).toEqual([1, 0, 0])
    const billet = within(lignes[0]!).getByRole('figure', { name: M.monBillet })
    expect(billet).toHaveTextContent('Le Voyage dans la Lune')
    expect(billet).toHaveTextContent('toi · 3 octobre 2026')
    expect(billet).toHaveTextContent('8 / 10')
    expect(within(billet).getAllByRole('img').map((i) => i.getAttribute('aria-label'))).toEqual(['VU : Le voyage immobile · vu le 3 octobre 2026', C.ensemble.dit])
    // Le mien seul : rien du billet de bob, que le serveur ne sert pas.
    expect(billet.textContent).not.toMatch(/bob/)
    expect(lignes[1]!.textContent + lignes[2]!.textContent).not.toMatch(/\/ ?10|sans note/)
  })

  // **Le tampon suit `vu_ensemble`, tel que servi** (brief 16) : ni une place prise, ni un billet à
  // mon journal que le serveur ne dit pas vu ensemble, ni un « vu ensemble » sans billet servi ne
  // montrent de carton. Vue à deux ce soir même, la table montre mon billet sous sa scène.
  // Mutations : dans `monBilletTamponne`, `vu_ensemble` remplacé par `etat === 'a_pris_sa_place'`,
  // ou retiré (posé dès `mon_billet`) ; `MonBillet` retiré de la table du soir ; le tampon vert non
  // passé au carton.
  it('mon billet ne paraît, tamponné, que sur une table que le serveur dit vue à deux', () => {
    const prise = etat(CHEZ_BOB, 'a_pris_sa_place')
    const { unmount } = monter([invite({ ...prise, mon_billet: VUE.mon_billet }), invite({ ...prise, id: 'c3000000-0000-4000-8000-000000000003', vu_ensemble: true, mon_billet: null }), invite({ ...VUE, vu_ensemble: false }, { passee: true, gestes: AUCUN })])
    expect(screen.queryAllByRole('figure')).toEqual([])
    expect(screen.queryAllByRole('img', { name: C.ensemble.dit })).toEqual([])
    unmount()

    monter([invite({ ...prise, vu_ensemble: true, mon_billet: VUE.mon_billet }), invite(CHEZ_CAROL)])
    const [bob, carol] = duSoir()
    const billet = within(bob!).getByRole('figure', { name: M.monBillet })
    expect(billet).toHaveTextContent(prise.film.titre)
    expect(within(billet).getAllByRole('img').map((i) => i.getAttribute('aria-label'))).toEqual(['VU : Le voyage immobile · vu le 3 octobre 2026', C.ensemble.dit])
    expect(within(billet).getByRole('img', { name: C.ensemble.dit })).toHaveTextContent(C.ensemble.mot)
    expect(within(carol!).queryByRole('figure')).toBeNull()
    expect(screen.getAllByRole('figure')).toHaveLength(1)
  })

  // Mutations : le refus dit sans rôle d'alerte, ou sur toutes les tables ; la panne tue ; les tables
  // montrées sous la panne.
  it('un refus se dit sur sa table, une panne des tables à leur place', () => {
    const { unmount } = monter([invite(CHEZ_BOB), invite(CHEZ_CAROL, { refus: 'Le wagon est fermé pour travaux.' })])
    expect(within(duSoir()[0]!).queryByRole('alert')).toBeNull()
    expect(within(duSoir()[1]!).getByRole('alert')).toHaveTextContent('Le wagon est fermé pour travaux.')
    unmount()

    const reessayer = vi.fn()
    monter(null, { panne: { erreur: new ApiError({ code: 'VALIDATION_ERROR', message: 'Le wagon est fermé.', retryable: false }, 400), reessayer } })
    expect(screen.getByText('Le wagon est fermé.')).toBeInTheDocument()
    expect(screen.queryByText(M.aucune)).toBeNull()
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
    fireEvent.click(screen.getByRole('button'))
    expect(reessayer).toHaveBeenCalledTimes(1)
  })

  // Rien ne bouge au calme : les boucles de la vitre et les fondus ne tiennent qu'à `data-vivante='oui'`.
  // Mutation : `data-vivante` figé à « oui ».
  it.each([
    [true, 'non'],
    [false, 'oui'],
  ])('mouvement réduit %s : la scène est vivante « %s »', (calme, vivante) => {
    calmer(calme)
    monter([invite(CHEZ_BOB)])
    expect(scene(duSoir()[0]!)).toHaveAttribute('data-vivante', vivante)
  })

  // La mise en lumière (maquette, l. 1347-1355) : la feuille ne la joue que sous `data-entree='oui'`,
  // que la scène porte une fois, à l'entrée de la page, pour toutes les tables de ce soir ensemble.
  // Mutations, dans `WagonRestaurant.tsx` : `entree` vrai pour toute table hors du calme (une table
  // venue ensuite s'allumerait, et une table éclairée se rallumerait remontée) ; `eclairee` sans effet
  // (la scène garde `data-entree` : remontée, elle rejouerait) ; la garde `e.target === carton`
  // retirée (la fin d'une animation d'un mot du carton éteindrait l'entrée en cours) ; la liste
  // fixée au montage plutôt qu'au premier rendu des tables (rien ne s'allume après un chargement).
  it('la mise en lumière se joue à l’entrée de la page, pour toutes les tables de ce soir ensemble, et ne rejoue ni à un rendu, ni à un geste, ni pour une table venue ensuite', () => {
    calmer(false)
    const enLumiere = () => duSoir().map((t) => scene(t).getAttribute('data-entree'))
    const voile = (t: HTMLElement) => scene(t).querySelectorAll(':scope > span[aria-hidden]').length
    const cartonDe = (t: HTMLElement) => t.querySelector<HTMLElement>("[data-qui='invite']")!
    // La page arrive pendant la lecture, puis montre ses tables : c'est là qu'elle entre.
    const { rerender } = monter(null)
    const page = (tables: TableDuWagon[] | null) => rerender(<WagonRestaurant monde={monde} moi="alice" panne={null} tables={tables} prendre={() => undefined} decliner={() => undefined} />)
    page([invite(CHEZ_BOB), invite(CHEZ_CAROL)])
    expect(enLumiere()).toEqual(['oui', 'oui'])
    expect(duSoir().map(voile)).toEqual([1, 1])
    const premiere = scene(duSoir()[0]!)
    // Un rendu de plus, puis un geste (ma place prise) : la même scène, que rien ne remonte.
    page([invite(CHEZ_BOB), invite(CHEZ_CAROL)])
    page([invite(etat(CHEZ_BOB, 'a_pris_sa_place')), invite(CHEZ_CAROL)])
    expect(scene(duSoir()[0]!)).toBe(premiere)
    // La fin d'une animation d'un mot du carton n'est pas celle de l'entrée.
    fireEvent.animationEnd(cartonDe(duSoir()[0]!).querySelector('b')!)
    expect(enLumiere()).toEqual(['oui', 'oui'])
    // Le carton de l'invité entre le dernier : sa fin clôt l'entrée de sa table, et d'elle seule.
    fireEvent.animationEnd(cartonDe(duSoir()[0]!))
    expect(enLumiere()).toEqual([null, 'oui'])
    expect(duSoir().map(voile)).toEqual([0, 1])
    fireEvent.animationEnd(cartonDe(duSoir()[1]!))
    expect(enLumiere()).toEqual([null, null])
    // Un geste, une table venue ensuite, des tables perdues puis relues : plus rien ne s'allume.
    page([invite(etat(CHEZ_BOB, 'a_decline')), invite(CHEZ_CAROL), hote(LA_MIENNE)])
    expect(enLumiere()).toEqual([null, null, null])
    page(null)
    page([invite(CHEZ_BOB), invite(CHEZ_CAROL)])
    expect(scene(duSoir()[0]!)).not.toBe(premiere)
    expect(enLumiere()).toEqual([null, null])
    expect(duSoir().map(voile)).toEqual([0, 0])
  })

  // Au calme : l'état final, tout de suite. Mutation : `calme` ignoré dans la liste des tables à éclairer.
  it('au calme, aucune table n’entre : elle est éclairée, son menu posé', () => {
    calmer(true)
    monter([invite(CHEZ_BOB), invite(CHEZ_CAROL)])
    expect(duSoir().map((t) => scene(t).getAttribute('data-entree'))).toEqual([null, null])
    expect(duSoir().map((t) => scene(t).querySelectorAll(':scope > span[aria-hidden]').length)).toEqual([0, 0])
  })

  // La feuille vise les lueurs de la lampe par leur remplissage : le tracé, engendré, ne leur donne
  // aucune classe. S'il les perdait, la lampe ne s'allumerait plus, sans rien dire. Mutation : le
  // sélecteur de la feuille n'est pas en cause ici ; un halo retiré du tracé, oui.
  it('le tracé de la table a toujours les lueurs que la mise en lumière vise : le halo deux fois, la flaque', () => {
    monter([invite(CHEZ_BOB)])
    const s = scene(duSoir()[0]!)
    expect(s.querySelectorAll(":scope > svg [fill='url(#wr-halo)']")).toHaveLength(2)
    expect(s.querySelectorAll(":scope > svg [fill='url(#wr-flaque)']")).toHaveLength(1)
  })

  // Un geste parti : les deux boutons le disent, sans disparaître. Mutation : `aria-disabled` retiré.
  it('pendant l’envoi, les gestes de la table sont dits inactifs', () => {
    monter([invite(CHEZ_BOB, { enCours: true }), invite(CHEZ_CAROL)])
    expect(within(duSoir()[0]!).getAllByRole('button').map((b) => b.getAttribute('aria-disabled'))).toEqual(['true', 'true'])
    expect(within(duSoir()[1]!).getAllByRole('button').map((b) => b.getAttribute('aria-disabled'))).toEqual(['false', 'false'])
  })
})

// La page entière, en 1900 : le monde compose bien la clé, et un geste y va jusqu'au serveur.
describe('la page du wagon-restaurant, en 1901', () => {
  const EN_1901: Voyage = {
    ...voyage1890(1899, [{ annee: 1899, statut: 'ouverte', recompense: 'ours', visitee: true }], { source: null, ia: true }),
    annee_en_cours: 1901,
    tampons: [{ decennie: 1890, boucle_le: '2026-03-14T12:00:00.000Z' }],
  }
  EN_1901.annees = [...EN_1901.annees, annee({ annee: 1900, statut: 'ouverte', recompense: 'ours' }), annee({ annee: 1901, statut: 'en_cours', recompense: null })]
  const PLACE = `POST /api/me/voyage/tables/${CHEZ_BOB.id}/place`

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    calmer(true)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-09T18:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Mutations : `wagonRestaurant` retirée de `PAGES_1900` (la page renvoie à la carte) ; la page qui
  // lit une fiche d'année, l'état du voyageur ou le courrier.
  it('1900 compose la clé : mes tables s’y lisent, « Prendre ma place » part et la table le dit, sans rien lire d’autre', async () => {
    const { requetes } = monterVoyage('/voyage/wagon-restaurant', {
      // Les routes du jeu d'abord : elles servent des tables vides (brief 16), que ce test remplace.
      ...ROUTES_DU_JEU,
      'GET /api/me/voyage': () => json(EN_1901),
      'GET /api/me/voyage/tables': () => json({ tables: [CHEZ_BOB, LA_MIENNE, VUE] } satisfies Tables),
      [PLACE]: () => json(etat(CHEZ_BOB, 'a_pris_sa_place')),
    })

    const page = await screen.findByRole('region', { name: 'Le wagon-restaurant' })
    await waitFor(() => expect(duSoir().map((a) => a.getAttribute('aria-label'))).toEqual(['La table de bob', 'Ta table, avec bob']))
    expect(boutons(page)).toEqual([`${M.prendre}ce soir, avec bob`, `${M.decliner}${M.rienNeSePerd}`])
    expect(within(page).getByRole('list', { name: M.passees })).toHaveTextContent('Vu ensemble')

    fireEvent.click(within(page).getByRole('button', { name: /Prendre ma place/ }))
    await waitFor(() => expect(cartons(duSoir()[0]!)).toEqual(['hote : bob / a pris sa place', 'invite : Toi / tu as pris ta place']))
    expect(boutons(page)).toEqual([`${M.decliner}${M.rienNeSePerd}`])
    expect(requetes.filter((r) => r.includes('/me/voyage')).sort()).toEqual(['GET /api/me/voyage', 'GET /api/me/voyage/tables', PLACE].sort())
  })
})
