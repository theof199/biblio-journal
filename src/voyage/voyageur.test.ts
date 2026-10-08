import { describe, expect, it } from 'vitest'
import type { Malle, RubriqueVue, Voyageur } from '../api/voyage'
import { exemple } from '../test/contrat'
import { estNouveau, rubriquesAllumees, type DatesDesRubriques } from './voyageur'

/**
 * Le point rouge de la sacoche (plan des écrans des lots, brief 0) : la règle seule, sans rendu.
 * Chaque test dit la mutation de `voyageur.ts` qui le fait rougir.
 */
const vue = (rubrique: string, vueLe: string | null): RubriqueVue => ({ rubrique, vue_le: vueLe })
const MIDI = '2026-10-08T12:00:00.000Z'
const AVANT = '2026-10-08T11:59:59.999Z'
const APRES = '2026-10-08T12:00:00.001Z'

describe('ce qui est nouveau depuis ma dernière visite', () => {
  // Mutations : `>=` (un élément daté de l'instant même de la visite resterait nouveau, et le point
  // ne s'éteindrait jamais sur un objet ramassé dans la milliseconde) ; `vueLe === null` rendu faux.
  it('un élément est nouveau strictement après la visite, et toujours quand la rubrique n’a jamais été ouverte', () => {
    expect([AVANT, MIDI, APRES].map((d) => estNouveau(d, MIDI))).toEqual([false, false, true])
    expect([AVANT, MIDI, APRES].map((d) => estNouveau(d, null))).toEqual([true, true, true])
  })

  // Le serveur écrit un instant avec ou sans millisecondes : dans l'ordre du texte, « Z » (0x5A) passe
  // après « . » (0x2E), et l'instant le plus ancien semble le plus récent. Mutation : `date > vueLe`
  // sur les chaînes.
  it('compare des instants, jamais des chaînes : 09:00:00Z est avant 09:00:00.500Z', () => {
    const rond = '2026-10-08T09:00:00Z'
    const demi = '2026-10-08T09:00:00.500Z'
    // Ce que l'ordre du texte dirait, et que la règle ne doit pas dire.
    expect(rond > demi).toBe(true)
    expect(estNouveau(rond, demi)).toBe(false)
    expect(estNouveau(demi, rond)).toBe(true)
    // Le même instant, écrit dans deux fuseaux : ni l'un ni l'autre n'est après l'autre.
    expect(estNouveau('2026-10-08T11:00:00+02:00', '2026-10-08T09:00:00Z')).toBe(false)
    expect(estNouveau('2026-10-08T11:00:01+02:00', '2026-10-08T09:00:00Z')).toBe(true)
  })

  // Une place de la malle pas encore collée n'a pas de date. Mutation : la garde `NaN` retirée (une
  // date nulle serait nouvelle dans une rubrique jamais ouverte).
  it('une date nulle ou illisible n’est jamais nouvelle', () => {
    expect([estNouveau(null, null), estNouveau(null, MIDI), estNouveau('hier', null), estNouveau('hier', MIDI)]).toEqual([false, false, false, false])
  })

  // Un `vue_le` que `Date.parse` ne lit pas ne date aucune visite : il vaut « jamais vue », comme un
  // `vue_le` nul, et ne peut pas éteindre une rubrique. Mutation : la garde `Number.isNaN(visite)`
  // retirée (`instant > NaN` est faux : tout serait ancien, le point rouge éteint à jamais).
  it('un vue_le illisible vaut jamais vue : il n’éteint rien', () => {
    expect([AVANT, MIDI, APRES].map((d) => estNouveau(d, 'hier'))).toEqual([true, true, true])
    expect([estNouveau(null, 'hier'), estNouveau('hier', 'hier')]).toEqual([false, false])
    expect(rubriquesAllumees([vue('objet', 'hier'), vue('etiquette', '')], { objet: [AVANT], etiquette: [null] })).toEqual(['objet'])
  })
})

describe('les rubriques allumées', () => {
  const TOUTES = [vue('etiquette', MIDI), vue('objet', MIDI), vue('bobine', MIDI), vue('courrier', MIDI)]

  // Mutations : `some` devenu `every` (une rubrique s'éteindrait tant qu'un seul élément est ancien) ;
  // les dates d'une autre rubrique lues (`dates.objet` pour toutes).
  it('s’allume la rubrique dont un élément est daté après sa visite, et elle seule', () => {
    expect(rubriquesAllumees(TOUTES, { etiquette: [AVANT, APRES], objet: [AVANT, MIDI], courrier: [] })).toEqual(['etiquette'])
    expect(rubriquesAllumees(TOUTES, { etiquette: [AVANT], objet: [APRES] })).toEqual(['objet'])
    expect(rubriquesAllumees(TOUTES, { etiquette: [APRES], objet: [APRES], courrier: [APRES] })).toEqual(['etiquette', 'objet', 'courrier'])
  })

  // Mutation : la condition « non vide » retirée (`vueLe === null ||` devant le `some`) : un voyageur
  // qui n'a rien ramassé verrait un point rouge qu'aucune visite n'explique.
  it('une rubrique jamais ouverte ne s’allume que si elle n’est pas vide', () => {
    const jamais = [vue('etiquette', null), vue('objet', null), vue('courrier', null)]
    expect(rubriquesAllumees(jamais, { etiquette: [], objet: [AVANT] })).toEqual(['objet'])
    expect(rubriquesAllumees(jamais, {})).toEqual([])
  })

  // La malle sert quinze places, dont la plupart sans `collee_le`. Mutation : « non vide » compté
  // sur la longueur de la liste (`vueLe === null ? liste.length > 0 : …`).
  it('des éléments sans date ne font pas une rubrique non vide', () => {
    expect(rubriquesAllumees([vue('etiquette', null)], { etiquette: [null, null, null] })).toEqual([])
    expect(rubriquesAllumees([vue('etiquette', null)], { etiquette: [null, AVANT, null] })).toEqual(['etiquette'])
    expect(rubriquesAllumees([vue('etiquette', MIDI)], { etiquette: [null, AVANT, null] })).toEqual([])
  })

  // Le contrat sert `rubrique` en chaîne et prévient que la liste peut s'allonger. Mutation : toutes
  // les rubriques servies parcourues (la garde `estConnue` retirée) : « wagon » s'allumerait, et
  // « constructor », dont le nom est celui d'une propriété de tout objet, ferait tomber la carte.
  it('une rubrique que l’appli ne connaît pas s’ignore, datée ou non, sans rien casser', () => {
    // Des dates rangées par ce que le serveur a servi, sans passer par le type : ce qu'un appelant pressé écrirait.
    const dates = { wagon: [APRES], objet: [APRES] } as DatesDesRubriques
    expect(rubriquesAllumees([vue('wagon', null), vue('constructor', null), vue('toString', MIDI), vue('objet', MIDI)], dates)).toEqual(['objet'])
  })

  // Mutations : la boucle menée sur les clés de `dates` plutôt que sur les rubriques servies (une
  // rubrique que le serveur ne sert pas n'a pas de `vue_le` : elle resterait allumée à jamais) ; la
  // garde `allumees.includes` retirée.
  it('une rubrique que le serveur ne sert pas ne s’allume pas, et une rubrique servie deux fois ne s’allume qu’une fois', () => {
    expect(rubriquesAllumees([vue('objet', MIDI)], { etiquette: [APRES], objet: [AVANT] })).toEqual([])
    expect(rubriquesAllumees([vue('objet', AVANT), vue('objet', null)], { objet: [MIDI] })).toEqual(['objet'])
  })

  // Les exemples du contrat, tels quels : la règle lit la forme que l'API sert, pas une forme recopiée.
  // Le parapluie y est ramassé le 6 octobre, la rubrique `objet` vue le 5 ; la Correspondance collée le
  // 29 septembre, la rubrique `etiquette` vue le 1er octobre ; `bobine` et `courrier` jamais vues, et vides.
  // Mutation : `vue_le` lu sous un autre nom dans la déstructuration (`vueLe` tout court).
  it('lit l’état du voyageur et la malle tels que le contrat les sert : le parapluie allume « objet », et lui seul', () => {
    const v = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
    const malle = exemple<Malle>('/me/voyage/decennies/{decennie}/etiquettes', 'get', 200)
    const dates = { objet: v.objets.map((o) => o.ramasse_le), etiquette: malle.etiquettes.map((e) => e.collee_le) }
    expect(dates.etiquette.some((d) => d === null)).toBe(true)
    expect(dates.etiquette.some((d) => d !== null)).toBe(true)
    expect(rubriquesAllumees(v.rubriques, dates)).toEqual(['objet'])
    // La sacoche ouverte après le dernier ramassage : plus rien de neuf.
    const revues = v.rubriques.map((r) => (r.rubrique === 'objet' ? { ...r, vue_le: '2026-10-06T18:03:27.001Z' } : r))
    expect(rubriquesAllumees(revues, dates)).toEqual([])
  })
})
