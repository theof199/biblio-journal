import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { cleDeBobineDuMonde, cleDeBobineServie, type Voyageur } from '../api/voyage'
import { creerRegistre } from '../mondes'
import { exemple } from '../test/contrat'
import { bobinesAuCompte, cleRefusee, rangerLaBobine, resteAVerser, verser } from './bobines'

/**
 * Les bobines perdues entre l'appli et le compte. Le catalogue du serveur est recopié ici de
 * `../biblio-back/docs/frontend-integration.md` (étape 36) : six clés, toutes en tirets bas.
 */
const CATALOGUE_DU_SERVEUR = ['les_quatre_diables', 'la_tete_de_janus', 'londres_apres_minuit', 'soldiers', 'hamlet', 'fairylogue']
const mondes = creerRegistre()
const DES_MONDES = [1890, 1900].flatMap((d) => mondes(d).bobines.map((b) => b.cle))

describe('la traduction des clés de bobine', () => {
  // Mutations : `cleDeBobineServie` rendue à l'identité (une clé à tirets partirait, `400`) ; une
  // bobine d'un monde renommée hors du catalogue du serveur (`404` au ramassage).
  it('du monde au serveur : chaque bobine du registre devient une clé du catalogue du serveur, sans tiret', () => {
    expect(DES_MONDES).toHaveLength(6)
    expect(DES_MONDES.map(cleDeBobineServie)).toEqual(CATALOGUE_DU_SERVEUR)
    for (const cle of DES_MONDES.map(cleDeBobineServie)) expect(cle).not.toContain('-')
  })

  // Mutation : `cleDeBobineDuMonde` rendue à l'identité : une bobine que le compte tient ne serait
  // reconnue par aucun monde, et se proposerait de nouveau.
  it('du serveur au monde : chaque clé du catalogue du serveur redevient la clé d’une bobine du registre', () => {
    expect(CATALOGUE_DU_SERVEUR.map(cleDeBobineDuMonde)).toEqual(DES_MONDES)
  })

  // L'aller et retour ne tient que pour une clé de monde sans tiret bas. Mutation : une bobine du
  // registre nommée avec un tiret bas.
  it('l’aller et retour rend chaque clé, dans les deux sens', () => {
    for (const cle of DES_MONDES) expect(cleDeBobineDuMonde(cleDeBobineServie(cle))).toBe(cle)
    for (const cle of CATALOGUE_DU_SERVEUR) expect(cleDeBobineServie(cleDeBobineDuMonde(cle))).toBe(cle)
  })
})

describe('les bobines entre l’appareil et le compte, sans rendu', () => {
  const ETAT = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
  const refus = (statut: number) => new ApiError({ code: 'X', message: 'Non.', retryable: false }, statut)

  // Mutation : la traduction oubliée à la lecture du compte.
  it('lit les bobines du compte par leur clé du monde ; l’état pas lu, rien', () => {
    expect(bobinesAuCompte(ETAT)).toEqual(['les-quatre-diables', 'hamlet'])
    expect(bobinesAuCompte(undefined)).toBeUndefined()
  })

  // Une API d'avant les bobines au compte, ou un cache d'avant, sert l'état sans le champ : le contrat
  // ne le prévoit pas, la carte ne doit pas en tomber. Mutations : `?.bobines.map` (la carte casse) ;
  // la ligne posée sur un état sans le champ (il passerait pour lu, et tout l'appareil serait versé).
  it('un état servi sans `bobines` vaut « pas lu » : rien n’en est tiré, rien n’y est rangé', () => {
    const sansLeChamp = { ...ETAT, bobines: undefined } as unknown as Voyageur
    expect(bobinesAuCompte(sansLeChamp)).toBeUndefined()
    expect(rangerLaBobine(sansLeChamp, { cle: 'soldiers', ramasse_le: '2026-10-09T09:00:00.000Z' })).toBe(sansLeChamp)
  })

  // Rejouable côté serveur : la même ligne rendue une seconde fois ne fait pas deux bobines. Sans
  // état en cache (1890), rien n'est posé. Mutations : la ligne toujours ajoutée ; la ligne posée seule.
  it('range la ligne dans `bobines` et ne touche à rien d’autre ; rejouée, elle ne se double pas ; sans état, rien', () => {
    const ligne = { cle: 'soldiers', ramasse_le: '2026-10-09T09:00:00.000Z' }
    const range = rangerLaBobine(ETAT, ligne)
    expect(range).toEqual({ ...ETAT, bobines: [...ETAT.bobines, ligne] })
    expect(rangerLaBobine(range, { ...ligne, ramasse_le: '2026-10-10T09:00:00.000Z' })).toEqual(range)
    expect(rangerLaBobine(undefined, ligne)).toBeUndefined()
  })

  it('ne reste à verser que ce que le compte n’a pas, dans l’ordre de l’appareil', () => {
    expect(resteAVerser(['hamlet', 'soldiers', 'les-quatre-diables'], ['les-quatre-diables'])).toEqual(['hamlet', 'soldiers'])
    expect(resteAVerser(['hamlet'], ['hamlet'])).toEqual([])
  })

  // Mutations : un `409`, un `500` ou l'API injoignable (statut 0) pris pour un refus de la clé.
  it('seuls `404` et `400` refusent la clé', () => {
    expect([404, 400, 409, 500, 0, 401].map((s) => cleRefusee(refus(s)))).toEqual([true, true, false, false, false, false])
    expect(cleRefusee(new Error('autre chose'))).toBe(false)
  })

  // Le statut d'un refus ne dit pas sa cause (une route inconnue d'une API plus ancienne répond `404`
  // elle aussi) : une clé qu'un monde connaît n'est jamais réglée sur un refus. Mutations : le
  // versement poursuivi après une panne ; arrêté par un refus ; la clé en panne réglée ; la clé connue
  // refusée réglée (`404`, `400`) ; la clé inconnue refusée gardée ; une clé rejouée dans la visite.
  it('verse dans l’ordre, chaque clé une fois : acceptée, elle est réglée ; refusée, seulement si aucun monde ne la connaît ; à la première panne il s’arrête', async () => {
    const partis: string[] = []
    const reglees: string[] = []
    const ramasser = (cle: string) => {
      partis.push(cle)
      const statut = { inconnue: 404, 'inconnue-mal-formee': 400, hamlet: 404, soldiers: 400, panne: 500 }[cle]
      return statut ? Promise.reject(refus(statut)) : Promise.resolve()
    }
    const connue = (cle: string) => DES_MONDES.includes(cle)
    await verser(['fairylogue', 'inconnue', 'hamlet', 'inconnue-mal-formee', 'soldiers', 'la-tete-de-janus', 'panne', 'c'], ramasser, (cle) => void reglees.push(cle), connue)
    expect(partis).toEqual(['fairylogue', 'inconnue', 'hamlet', 'inconnue-mal-formee', 'soldiers', 'la-tete-de-janus', 'panne'])
    expect(reglees).toEqual(['fairylogue', 'inconnue', 'inconnue-mal-formee', 'la-tete-de-janus'])
  })

  // Mutation : `encore` lu une fois au départ, ou jamais.
  it('relit avant chaque clé que la visite tient encore : sinon la suivante ne part pas, celle qui est partie se règle', async () => {
    const partis: string[] = []
    const reglees: string[] = []
    let vivante = true
    const ramasser = (cle: string) => {
      partis.push(cle)
      if (cle === 'b') vivante = false
      return Promise.resolve()
    }
    await verser(['a', 'b', 'c'], ramasser, (cle) => void reglees.push(cle), () => true, () => vivante)
    expect(partis).toEqual(['a', 'b'])
    expect(reglees).toEqual(['a', 'b'])
  })
})
