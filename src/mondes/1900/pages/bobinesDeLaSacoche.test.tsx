import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { BobineRamassee, Malle, RubriqueVue, Tickets, Voyage, Voyageur } from '../../../api/voyage'
import { cleDeBobineServie } from '../../../api/voyage'
import { exemple } from '../../../test/contrat'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { COURRIER_VIDE, voyage1890 } from '../../../test/voyage'
import { BOBINES as DE_LA_FOIRE } from '../../1890/bobines'
import { BOBINES as DU_TRAIN } from '../bobines'
import { MOTS_DES_BOBINES as M, compteDesBobines, decennieDite } from './retrouvees'

/**
 * Les bobines retrouvées dans la sacoche des années 1900 : la page montée dans l'app entière, où les
 * mondes n'arrivent que par le registre. Ce que le bloc lecteur lit, range et marque est tenu, sans
 * monde, par `pages/VoyageSacoche.bobines.test.tsx` ; ici, ce que 1900 en dit, et que les bobines de
 * la foire y sont. Aucun test sur le tracé de la boîte.
 */
const SACOCHE = '/voyage/sacoche'
const CARTE = 'GET /api/me/voyage'
const VOYAGEUR = 'GET /api/me/voyage/voyageur'
const vue = (rubrique: string) => `POST /api/me/voyage/rubriques/${rubrique}/vue`

const EN_1903: Voyage = voyage1890(1903, [{ annee: 1903, statut: 'en_cours', visitee: true, recompense: null }], { ia: true, source: null })
const EN_1910: Voyage = { ...EN_1903, annee_en_cours: 1910 }
const TICKETS_LUS: Tickets = { tickets: [{ annee: 1904, motif: '1903 est bouclée, 1904 t’attend.', emis_le: '2026-09-01T18:00:00.000Z', montre_le: null, utilise_le: null }] }
/** L'exemple du contrat : « Les Quatre Diables » (le 4 octobre 2026) et « Hamlet » (le 7), en clés du serveur ; la rubrique `bobine` jamais vue. */
const ETAT = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
const avec = (bobines: BobineRamassee[], vueLe: string | null = null): Voyageur => ({ ...ETAT, bobines, rubriques: ETAT.rubriques.map((r) => (r.rubrique === 'bobine' ? { ...r, vue_le: vueLe } : r)) })
/** Les six bobines du voyageur de 1903, dans l'ordre de la rubrique : la foire, puis le train. */
const LES_SIX = [...DE_LA_FOIRE, ...DU_TRAIN]

const ROUTES = {
  [CARTE]: () => json(EN_1903),
  'GET /api/me/voyage/tickets': () => json(TICKETS_LUS),
  'GET /api/me/voyage/decennies/1900/etiquettes': () => json(exemple<Malle>('/me/voyage/decennies/{decennie}/etiquettes', 'get', 200)),
  [VOYAGEUR]: () => json(ETAT),
  'GET /api/me/voyage/cartes-postales': () => json(COURRIER_VIDE),
  ...Object.fromEntries(['etiquette', 'objet', 'bobine'].map((r) => [vue(r), () => json({ rubrique: r, vue_le: '2026-10-09T10:00:00.000Z' } satisfies RubriqueVue)])),
}
// `retryable: false` : une panne relancée par TanStack attendrait trois secondes avant de se dire.
const panne = (message: string) => () => json({ code: 'VALIDATION_ERROR', message, retryable: false }, 400)

const region = () => screen.findByRole('region', { name: 'Bobines retrouvées' })
const titre = (r: HTMLElement) => within(r).getByRole('heading', { level: 2 }).textContent
/** Les places, dans l'ordre de l'écran : ce qui s'y écrit, et leur état. */
const places = async () => {
  const lignes = await within(await region()).findAllByRole('listitem')
  return lignes.map((li) => ({ li, ecrit: li.textContent ?? '', etat: li.getAttribute('data-etat') }))
}
const dite = (b: (typeof LES_SIX)[number], decennie: number, nouvelle = false) => `${b.titre}${b.qui}${decennieDite(decennie)}${nouvelle ? M.nouvelle : ''}`
const vide = (decennie: number) => `${M.aTrouver}${decennieDite(decennie)}`

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('les mots des bobines retrouvées', () => {
  // Mutation : « sur 6 » en dur dans `compteDesBobines` ; le compte pris sur toutes les places.
  it('le compte se dit sur les places qu’on lui passe, jamais sur six', () => {
    const [diables, janus] = DE_LA_FOIRE as [(typeof DE_LA_FOIRE)[number], (typeof DE_LA_FOIRE)[number]]
    expect(compteDesBobines([{ decennie: 1890, bobine: diables, nouvelle: false }, { decennie: 1890, bobine: null, nouvelle: false }, { decennie: 1890, bobine: janus, nouvelle: true }, { decennie: 1900, bobine: null, nouvelle: false }])).toBe('2 sur 4')
    expect(compteDesBobines([])).toBe('0 sur 0')
  })
})

describe('les bobines retrouvées dans la sacoche de 1900', () => {
  // Ce sont les bobines du voyageur, pas celles de la décennie : les trois de la foire, puis les trois
  // du train. Mutations : dans `voyage/sacoche/Bobines.tsx`, le catalogue réduit au monde de mon année
  // en cours (trois places, « Les Quatre Diables » absente) ; dans le dessin de 1900, la condition
  // renversée (le titre sous une place vide) ; le titre écrit en dur (« Film perdu ») ou `qui` omis ;
  // le compte pris sur toutes les places (« 6 sur 6 ») ; « Nouvelle » écrit sur toute place trouvée
  // (second test) ; dans `voyage/sacoche/retrouvees.ts`, la clé servie cherchée sans traduction.
  it('six places, la foire puis le train : une bobine que le compte tient dit son titre et qui l’a tourné, tels que son monde les sait ; une place vide dit « à trouver » et sa décennie, sans rien nommer', async () => {
    monterVoyage(SACOCHE, ROUTES)
    const lues = await places()
    await waitFor(async () => expect(titre(await region())).toBe(`${M.titre} 2 sur 6`))
    expect(LES_SIX).toHaveLength(6)
    expect(lues.map((p) => p.etat)).toEqual(['la', 'manque', 'manque', 'manque', 'la', 'manque'])
    await waitFor(async () =>
      expect((await places()).map((p) => p.ecrit)).toEqual([dite(LES_SIX[0]!, 1890, true), vide(1890), vide(1890), vide(1900), dite(LES_SIX[4]!, 1900, true), vide(1900)]),
    )
    // Ce que le fichier de chaque monde sait, à la lettre.
    expect(lues[0]!.ecrit).toContain('Les Quatre DiablesF. W. Murnau, 1928')
    expect(lues[4]!.ecrit).toContain('HamletGeorges Méliès, 1907')
    // Une place vide ne nomme sa bobine nulle part : ni écrit, ni dans un attribut. Aucune clé du serveur n'est montrée.
    const vides = lues.filter((p) => p.etat === 'manque')
    expect(vides.flatMap((p) => LES_SIX.filter((b) => [b.titre, b.qui, b.cle, cleDeBobineServie(b.cle)].some((mot) => p.li.outerHTML.includes(mot))).map((b) => b.cle))).toEqual([])
    expect((await region()).outerHTML).not.toMatch(/les_quatre_diables|les-quatre-diables|hamlet/)
  })

  // Mutation : `<em>` rendu sans regarder `place.nouvelle`.
  it('« Nouvelle » ne se dit que d’une bobine ramassée depuis ma dernière visite', async () => {
    monterVoyage(SACOCHE, { ...ROUTES, [VOYAGEUR]: () => json(avec(ETAT.bobines, '2026-10-05T00:00:00.000Z')) })
    await waitFor(async () => expect((await places()).filter((p) => p.etat === 'la').map((p) => p.ecrit)).toEqual([dite(LES_SIX[0]!, 1890), dite(LES_SIX[4]!, 1900, true)]))
  })

  // Mutations : « à trouver » écrit en dur sous toute place ; le compte en dur.
  it.each([
    ['aucune bobine', [], '0 sur 6', 6],
    ['les six', LES_SIX.map((b) => ({ cle: cleDeBobineServie(b.cle), ramasse_le: '2026-10-04T10:00:00.000Z' })), '6 sur 6', 0],
  ])('%s : le compte et les places le disent', async (_, bobines, compte, aTrouver) => {
    monterVoyage(SACOCHE, { ...ROUTES, [VOYAGEUR]: () => json(avec(bobines, '2026-10-08T00:00:00.000Z')) })
    const lues = await places()
    expect(titre(await region())).toBe(`${M.titre} ${compte}`)
    expect(lues).toHaveLength(6)
    expect(lues.filter((p) => p.ecrit.startsWith(M.aTrouver))).toHaveLength(aTrouver)
    expect(lues.filter((p) => p.etat === 'la').map((p) => p.ecrit)).toEqual(aTrouver === 0 ? LES_SIX.map((b, i) => dite(b, i < 3 ? 1890 : 1900)) : [])
  })

  // Règle commune 3 : une lecture en panne n'éteint que son bloc. Mutations : la branche `panne`
  // retirée du dessin de 1900 ; `onReessayer` non branché.
  it('la panne de l’état du voyageur se dit sous les bobines retrouvées ; « Réessayer » relit', async () => {
    let enPanne = true
    monterVoyage(SACOCHE, { ...ROUTES, [VOYAGEUR]: () => (enPanne ? panne('L’état du voyageur est en panne.')() : json(ETAT)) })
    const r = await region()
    expect(await within(r).findByRole('alert')).toHaveTextContent('L’état du voyageur est en panne.')
    expect(within(r).queryByRole('list')).toBeNull()
    expect(titre(r)?.trim()).toBe(M.titre)
    enPanne = false
    fireEvent.click(within(r).getByRole('button', { name: 'Réessayer' }))
    expect(await places()).toHaveLength(6)
    expect(within(r).queryByRole('alert')).toBeNull()
  })

  // 1900 seulement. Mutation : `bobinesDeLaSacoche` ajouté aux gabarits du monde « à venir ».
  it('dix ans plus loin, la sacoche d’un monde à venir n’a pas cette rubrique et ne lit pas l’état du voyageur', async () => {
    const { client, requetes } = monterVoyage(SACOCHE, { ...ROUTES, [CARTE]: () => json(EN_1910) })
    expect(await screen.findByRole('heading', { level: 1, name: 'La sacoche du voyageur' })).toBeInTheDocument()
    await within(await screen.findByRole('region', { name: 'Portefeuille' })).findByRole('list')
    await waitFor(() => expect(client.isFetching() + client.isMutating()).toBe(0))
    expect(screen.queryByRole('region', { name: 'Bobines retrouvées' })).toBeNull()
    expect(requetes.filter((q) => /\/voyageur|\/rubriques\/|\/bobines\//.test(q))).toEqual([])
  })
})
