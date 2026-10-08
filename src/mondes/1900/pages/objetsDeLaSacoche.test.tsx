import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Malle, RubriqueVue, Tickets, Voyage, Voyageur } from '../../../api/voyage'
import { exemple } from '../../../test/contrat'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { voyage1890 } from '../../../test/voyage'
import { OBJETS } from '../objets'
import { MOTS_DE_LA_CONSIGNE as M, compteDeLaConsigne, nomLuDeLaConsigne, placesDeConsigne } from './consigne'

/**
 * Les objets trouvés dans la sacoche des années 1900 (plan des écrans des lots, brief 3 ; maquette,
 * écran 15) : le catalogue, les règles de la consigne, puis la page montée dans l'app entière, où le
 * monde n'arrive que par le registre. Ce que le bloc lecteur lit et marque est tenu, sans monde, par
 * `pages/VoyageSacoche.objets.test.tsx` ; ici, ce que 1900 en dit. Aucun test sur le tracé d'un objet.
 */
const SACOCHE = '/voyage/sacoche'
const CARTE = 'GET /api/me/voyage'
const TICKETS = 'GET /api/me/voyage/tickets'
const MALLE = 'GET /api/me/voyage/decennies/1900/etiquettes'
const VOYAGEUR = 'GET /api/me/voyage/voyageur'
const VUE = 'POST /api/me/voyage/rubriques/objet/vue'
const VUE_DE_LA_MALLE = 'POST /api/me/voyage/rubriques/etiquette/vue'

const EN_1903: Voyage = voyage1890(1903, [{ annee: 1903, statut: 'en_cours', visitee: true, recompense: null }], { ia: true, source: null })
const EN_1910: Voyage = { ...EN_1903, annee_en_cours: 1910 }
const TICKETS_LUS: Tickets = { tickets: [{ annee: 1904, motif: '1903 est bouclée, 1904 t’attend.', emis_le: '2026-09-01T18:00:00.000Z', montre_le: null, utilise_le: null }] }
/** L'exemple du contrat : la lanterne (1900) et le parapluie (1902) ramassés. */
const ETAT = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
const ramasse = (cle: string, annee = 1900): Voyageur['objets'][number] => ({ cle, annee, ramasse_le: '2026-10-07T10:00:00.000Z' })
const avec = (...objets: Voyageur['objets']): Voyageur => ({ ...ETAT, objets })

const ROUTES = {
  [CARTE]: () => json(EN_1903),
  [TICKETS]: () => json(TICKETS_LUS),
  [MALLE]: () => json(exemple<Malle>('/me/voyage/decennies/{decennie}/etiquettes', 'get', 200)),
  [VOYAGEUR]: () => json(ETAT),
  [VUE]: () => json({ rubrique: 'objet', vue_le: '2026-10-08T10:00:00.000Z' } satisfies RubriqueVue),
  [VUE_DE_LA_MALLE]: () => json({ rubrique: 'etiquette', vue_le: '2026-10-08T10:00:00.000Z' } satisfies RubriqueVue),
}
// `retryable: false` : une panne relancée par TanStack attendrait trois secondes avant de se dire.
const panne = (message: string) => () => json({ code: 'VALIDATION_ERROR', message, retryable: false }, 400)

const region = () => screen.findByRole('region', { name: 'Objets trouvés' })
const titre = (r: HTMLElement) => within(r).getByRole('heading', { level: 2 }).textContent
/** Les places, dans l'ordre de l'écran : ce qui s'y lit (le nom de l'image) et ce qui s'y écrit. */
const places = async () => {
  const r = await region()
  const lignes = await within(r).findAllByRole('listitem')
  return lignes.map((li) => ({ li, lu: within(li).getByRole('img').getAttribute('aria-label') ?? '', ecrit: li.textContent ?? '', etat: li.getAttribute('data-etat') }))
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('le catalogue des objets trouvés de 1900', () => {
  // Mutations : deux objets échangés dans `OBJETS` ; l'année du parapluie passée à 1903 (l'exemple du
  // contrat le sert en 1902) ; la clé de la longue-vue écrite `longue-vue` (le contrat refuse le tiret) ;
  // la valise retirée.
  it('dix objets, un par gare de 1900 à 1909, dans l’ordre, par des clés à la forme du contrat ; ses années sont celles que le serveur sert', () => {
    expect(OBJETS.map((o) => o.annee)).toEqual([1900, 1901, 1902, 1903, 1904, 1905, 1906, 1907, 1908, 1909])
    expect(OBJETS.map((o) => o.cle)).toEqual(['lanterne', 'melon', 'parapluie', 'montre', 'programme', 'facteur', 'longuevue', 'eventail', 'sifflet', 'valise'])
    expect(OBJETS.filter((o) => !/^[a-z0-9_]{1,40}$/.test(o.cle))).toEqual([])
    expect(ETAT.objets.length).toBeGreaterThan(0)
    expect(ETAT.objets.map((s) => OBJETS.find((o) => o.cle === s.cle)?.annee)).toEqual(ETAT.objets.map((s) => s.annee))
  })

  // Un seul dessin par objet, que le quai reprendra : il existe, et rien de plus n'en est dit ici.
  // Mutation : les tracés d'un objet vidés (`traits: []`).
  it('chaque objet a son nom, son nom court et son dessin', () => {
    expect(OBJETS.filter((o) => o.traits.length === 0 || o.nom === '' || o.court === '')).toEqual([])
    expect(new Set(OBJETS.map((o) => o.nom)).size).toBe(OBJETS.length)
  })
})

describe('les règles de la consigne', () => {
  // Mutations : le compte pris sur la réponse (`servis.length` : 3, puis 4) ; les places prises sur la
  // réponse (une onzième place pour le gramophone).
  it('une clé servie que le catalogue ne connaît pas n’a pas de place et ne se compte pas ; servie deux fois, une clé ne compte qu’une fois', () => {
    const lues = placesDeConsigne([ramasse('lanterne'), ramasse('gramophone', 1911), ramasse('parapluie', 1902), ramasse('lanterne')])
    expect(lues.map((p) => p.objet)).toEqual(OBJETS)
    expect(lues.filter((p) => p.ramasse).map((p) => p.objet.cle)).toEqual(['lanterne', 'parapluie'])
    expect(compteDeLaConsigne(lues)).toBe('2 sur 10')
    expect(compteDeLaConsigne(placesDeConsigne([ramasse('gramophone', 1911)]))).toBe('0 sur 10')
  })

  // Mutation : « sur 10 » en dur dans `compteDeLaConsigne`.
  it('le compte se dit sur la longueur du catalogue, jamais sur dix', () => {
    expect(compteDeLaConsigne(placesDeConsigne([ramasse('melon', 1901)], OBJETS.slice(0, 3)))).toBe('1 sur 3')
  })

  // Mutations : le libellé du ramassé rendu pour toute place ; la condition renversée.
  it('une place prise dit son objet et sa gare ; une place vide ne dit que sa gare', () => {
    const [lanterne, melon] = placesDeConsigne([ramasse('lanterne')]) as [ReturnType<typeof placesDeConsigne>[number], ReturnType<typeof placesDeConsigne>[number]]
    expect(nomLuDeLaConsigne(lanterne)).toBe('1900 : une lanterne de chef de gare, dans la sacoche')
    expect(nomLuDeLaConsigne(melon)).toBe('1901 : un objet à trouver en gare')
  })
})

describe('les objets trouvés dans la sacoche de 1900', () => {
  // Mutations, dans le dessin de 1900 : la condition renversée (`place.ramasse ? <i>à trouver</i> :
  // court`) ; le nom court écrit sur les dix places ; `aria-label` pris du nom de l'objet pour toute
  // place ; le compte pris sur la réponse (`objets.length` : « 3 sur 10 ») ; les places rangées dans
  // l'ordre de la réponse.
  it('dix places dans l’ordre des années : un objet ramassé pend sous son nom, une place vide dit « à trouver » sans nommer son objet, et un objet inconnu ne compte pas', async () => {
    // Dans le désordre, avec une clé que l'appli ne connaît pas.
    monterVoyage(SACOCHE, { ...ROUTES, [VOYAGEUR]: () => json(avec(ramasse('parapluie', 1902), ramasse('gramophone', 1911), ramasse('lanterne'))) })
    const lues = await places()
    expect(titre(await region())).toBe(`${M.titre} 2 sur 10`)
    expect(lues.map((p) => p.etat)).toEqual(['la', 'manque', 'la', 'manque', 'manque', 'manque', 'manque', 'manque', 'manque', 'manque'])
    expect(lues.map((p) => p.ecrit)).toEqual(['1900Lanterne', '1901à trouver', '1902Parapluie', '1903à trouver', '1904à trouver', '1905à trouver', '1906à trouver', '1907à trouver', '1908à trouver', '1909à trouver'])
    expect(lues.map((p) => p.lu)).toEqual([
      '1900 : une lanterne de chef de gare, dans la sacoche',
      '1901 : un objet à trouver en gare',
      '1902 : un parapluie, dans la sacoche',
      ...[1903, 1904, 1905, 1906, 1907, 1908, 1909].map((a) => `${a} : un objet à trouver en gare`),
    ])
    // Une place vide ne nomme son objet nulle part : ni lu, ni écrit, ni dans un attribut.
    const vides = lues.filter((p) => p.etat === 'manque')
    expect(vides.flatMap((p) => OBJETS.filter((o) => p.li.outerHTML.includes(o.nom) || p.li.outerHTML.includes(o.court)).map((o) => o.cle))).toEqual([])
    expect(await region()).not.toHaveTextContent(/gramophone|1911/)
  })

  // Mutations : « à trouver » écrit en dur sous toute place ; le compte en dur.
  it.each([
    ['rien de ramassé', [], '0 sur 10', 10],
    ['tout ramassé', OBJETS.map((o) => ramasse(o.cle, o.annee)), '10 sur 10', 0],
  ])('%s : le compte et les places le disent', async (_, objets, compte, aTrouver) => {
    monterVoyage(SACOCHE, { ...ROUTES, [VOYAGEUR]: () => json(avec(...objets)) })
    const lues = await places()
    expect(titre(await region())).toBe(`${M.titre} ${compte}`)
    expect(lues).toHaveLength(10)
    expect(lues.filter((p) => p.ecrit.includes(M.aTrouver))).toHaveLength(aTrouver)
    expect(lues.filter((p) => p.lu.endsWith('dans la sacoche'))).toHaveLength(10 - aTrouver)
  })

  // Comme la malle : rien avant la réponse, ni rubrique, ni places « à trouver » qui se rempliraient
  // sous les yeux. Mutation : dans `voyage/sacoche/Objets.tsx`, la garde de l'attente retirée (la
  // rubrique paraît seule, sans compte).
  it('tant que l’état du voyageur n’a pas répondu, la rubrique ne paraît pas', async () => {
    let repondre!: (r: Response) => void
    monterVoyage(SACOCHE, { ...ROUTES, [VOYAGEUR]: () => new Promise<Response>((r) => (repondre = r)) })
    await within(await screen.findByRole('region', { name: 'Portefeuille' })).findByRole('list')
    await waitFor(() => expect(typeof repondre).toBe('function'))
    expect(screen.queryByRole('region', { name: 'Objets trouvés' })).toBeNull()
    expect(screen.queryByRole('heading', { name: new RegExp(M.titre) })).toBeNull()
    act(() => repondre(json(ETAT)))
    expect(await places()).toHaveLength(10)
  })

  // Règle commune 3 : une lecture en panne n'éteint que son bloc. La malle lit le même état, pour ce
  // qui y est nouveau : sa ligne reste. Mutations : la branche `panne` retirée du dessin de 1900 (il
  // resterait à « … ») ; `onReessayer` non branché ; dans `Malle.tsx`, la panne de la visite dite par
  // la malle (`panne` posée quand `visite` est nulle).
  it('la panne de l’état du voyageur se dit sous les objets trouvés, et n’éteint ni la malle ni le portefeuille ; « Réessayer » relit', async () => {
    let enPanne = true
    monterVoyage(SACOCHE, { ...ROUTES, [VOYAGEUR]: () => (enPanne ? panne('L’état du voyageur est en panne.')() : json(ETAT)) })
    const r = await region()
    expect(await within(r).findByRole('alert')).toHaveTextContent('L’état du voyageur est en panne.')
    expect(within(r).queryByRole('list')).toBeNull()
    expect(titre(r)?.trim()).toBe(M.titre)
    const malle = await screen.findByRole('region', { name: 'Malle' })
    expect(await within(malle).findByRole('button')).toHaveTextContent('1 étiquette sur 15')
    expect(within(malle).queryByRole('alert')).toBeNull()
    const portefeuille = screen.getByRole('region', { name: 'Portefeuille' })
    expect(await within(portefeuille).findByRole('button', { name: 'Utiliser le ticket pour 1904' })).toBeInTheDocument()
    expect(within(portefeuille).queryByRole('alert')).toBeNull()
    enPanne = false
    fireEvent.click(within(r).getByRole('button', { name: 'Réessayer' }))
    expect(await places()).toHaveLength(10)
    expect(within(r).queryByRole('alert')).toBeNull()
  })

  // Décision 1 : 1900 seulement. 1890 est tenu par `pages/VoyageSacoche.test.tsx`, qui reste vert sans
  // être retouché, et par `pages/VoyageSacoche.objets.test.tsx`. Mutation : `objetsDeLaSacoche` ajouté
  // aux gabarits du monde « à venir ».
  it('dix ans plus loin, la sacoche d’un monde à venir n’a pas de consigne et ne lit pas l’état du voyageur', async () => {
    const { client, requetes } = monterVoyage(SACOCHE, { ...ROUTES, [CARTE]: () => json(EN_1910) })
    expect(await screen.findByRole('heading', { level: 1, name: 'La sacoche du voyageur' })).toBeInTheDocument()
    await within(await screen.findByRole('region', { name: 'Portefeuille' })).findByRole('list')
    await waitFor(() => expect(client.isFetching() + client.isMutating()).toBe(0))
    expect(screen.queryByRole('region', { name: 'Objets trouvés' })).toBeNull()
    expect(requetes.filter((q) => /\/voyageur|\/rubriques\/|\/objets\//.test(q))).toEqual([])
  })
})
