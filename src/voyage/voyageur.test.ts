import { describe, expect, it } from 'vitest'
import type { Courrier, Malle, RubriqueVue, Voyageur } from '../api/voyage'
import { exemple } from '../test/contrat'
import { creerRegistre } from '../mondes'
import type { Monde } from '../mondes/types'
import { entreesPoinconnees, estNouveau, nomDeLaSacoche, nouveautesDeLaSacoche, rubriquesAllumees, rubriquesDeLaPastille, RUBRIQUES_DE_LA_PASTILLE, type DatesDesRubriques } from './voyageur'

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

/**
 * La pastille de la sacoche (brief 5) : quelles rubriques la regardent pour un monde, pourquoi elle
 * s'allume, et le nom du lien. La page (`pages/Carte.point.test.tsx`) tient ce qui se lit et se montre.
 */
describe('la pastille de la sacoche', () => {
  const mondes = creerRegistre()
  const ETIQUETTE = 'une étiquette vient d’être collée sur la malle'
  const OBJET = 'un objet trouvé en gare'
  const malle = exemple<Malle>('/me/voyage/decennies/{decennie}/etiquettes', 'get', 200)
  const base = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
  /** Jamais rien ouvert, un objet ramassé, et une rubrique que l'appli ne connaît pas. */
  const jamais: Voyageur = { ...base, rubriques: [vue('etiquette', null), vue('objet', null), vue('bobine', null), vue('courrier', null), vue('wagon', null)] }

  // Mutations : le filtre retiré (toute la liste pour tout monde) ; `gabaritSeul` lu sur une seule clé
  // pour toutes les rubriques (`malleDeLaSacoche` : un monde qui ne compose que la consigne n'aurait rien).
  it('ne regarde que les rubriques dont le monde compose le bloc : aucune en 1890 ni « à venir », les trois en 1900, dans l’ordre de la sacoche', () => {
    expect(rubriquesDeLaPastille(mondes(1890))).toEqual([])
    expect(rubriquesDeLaPastille(mondes(1910))).toEqual([])
    expect(rubriquesDeLaPastille(mondes(1900)).map((r) => r.rubrique)).toEqual(['etiquette', 'courrier', 'objet'])
    const m = mondes(1900)
    const consigneSeule: Monde = { ...m, pages: { ...m.pages, gabarits: { ...m.pages.gabarits, malleDeLaSacoche: undefined, courrierDeLaSacoche: undefined } } }
    expect(rubriquesDeLaPastille(consigneSeule).map((r) => r.rubrique)).toEqual(['objet'])
  })

  // Mutations : toutes les rubriques servies sans `vue_le` allumées (`bobine`, `courrier`, « wagon ») ;
  // les rubriques de toute la liste et non les rubriques montées ; l'ordre des phrases pris au serveur.
  it('dit pourquoi, une phrase par rubrique montée et allumée, jamais pour « bobine », un « courrier » dont la boîte n’est pas lue, ni une inconnue', () => {
    const lu = { voyageur: jamais, malle, courrier: undefined }
    expect(nouveautesDeLaSacoche(RUBRIQUES_DE_LA_PASTILLE, lu)).toEqual([ETIQUETTE, OBJET])
    expect(nouveautesDeLaSacoche(RUBRIQUES_DE_LA_PASTILLE, { ...lu, voyageur: { ...jamais, rubriques: [...jamais.rubriques].reverse() } })).toEqual([ETIQUETTE, OBJET])
    expect(nouveautesDeLaSacoche(RUBRIQUES_DE_LA_PASTILLE.filter((r) => r.rubrique === 'objet'), lu)).toEqual([OBJET])
    expect(nouveautesDeLaSacoche([], lu)).toEqual([])
    // Tout vu, `bobine`, `courrier` et « wagon » restant jamais ouvertes : plus rien.
    const vu = { ...jamais, rubriques: jamais.rubriques.map((r) => (r.rubrique === 'etiquette' || r.rubrique === 'objet' ? { ...r, vue_le: '2026-10-08T12:00:00.000Z' } : r)) }
    expect(nouveautesDeLaSacoche(RUBRIQUES_DE_LA_PASTILLE, { voyageur: vu, malle, courrier: undefined })).toEqual([])
  })

  // Mutations : la garde `!lu.voyageur` retirée (la carte tomberait avant la réponse) ; les dates de
  // la malle lues sans garde (`malle.etiquettes` d'une malle pas lue).
  it('sans l’état du voyageur, rien ; sans la malle, sa rubrique seule reste éteinte', () => {
    expect(nouveautesDeLaSacoche(RUBRIQUES_DE_LA_PASTILLE, { voyageur: undefined, malle, courrier: undefined })).toEqual([])
    expect(nouveautesDeLaSacoche(RUBRIQUES_DE_LA_PASTILLE, { voyageur: jamais, malle: undefined, courrier: undefined })).toEqual([OBJET])
  })

  // Le courrier (brief 13) : une carte **reçue** l'allume par son `postee_le`, comparé à la visite de
  // la rubrique. L'exemple du contrat : une reçue postée le 6 octobre 2026 (déjà lue), une envoyée le
  // 5. Mutations, dans `RUBRIQUES_DE_LA_PASTILLE` : les envoyées prises avec les reçues (une carte que
  // j'écris allumerait mon propre point) ; les seules cartes non lues (`lue_le === null` : une carte
  // ouverte sur un autre appareil éteindrait le point sans que la rubrique soit vue ici) ; `lue_le`
  // pris pour date ; la boîte pas lue qui fait tomber la règle (`courrier.recues` sans garde).
  it('une carte postale reçue allume « courrier » par son `postee_le` : ni une carte envoyée, ni `lue_le`, ni une boîte pas lue', () => {
    const COURRIER = 'une carte postale est arrivée'
    const boite = exemple<Courrier>('/me/voyage/cartes-postales', 'get', 200)
    const vuLe = (courrier: string | null): Voyageur => ({ ...base, objets: [], rubriques: [vue('etiquette', '2026-10-08T12:00:00.000Z'), vue('objet', null), vue('courrier', courrier)] })
    const dit = (v: Voyageur, courrier: Courrier | undefined) => nouveautesDeLaSacoche(RUBRIQUES_DE_LA_PASTILLE, { voyageur: v, malle, courrier })
    expect(boite.recues.map((c) => [c.postee_le, c.lue_le])).toEqual([['2026-10-06T08:30:00.000Z', '2026-10-06T12:04:11.000Z']])
    expect(dit(vuLe(null), boite)).toEqual([COURRIER])
    expect(dit(vuLe('2026-10-06T08:00:00.000Z'), boite)).toEqual([COURRIER])
    // Vue entre l'envoi et la lecture de la carte : la rubrique est éteinte, `lue_le` n'y change rien.
    expect(dit(vuLe('2026-10-06T09:00:00.000Z'), boite)).toEqual([])
    // Des envoyées seules, la rubrique jamais ouverte : rien.
    expect(dit(vuLe(null), { ...boite, recues: [] })).toEqual([])
    expect(dit(vuLe(null), undefined)).toEqual([])
  })

  // Mutation : le suffixe toujours posé.
  it('le nom du lien reste « Sacoche du voyageur » point éteint, et dit pourquoi allumé', () => {
    expect(nomDeLaSacoche([])).toBe('Sacoche du voyageur')
    expect(nomDeLaSacoche([OBJET])).toBe('Sacoche du voyageur : un objet trouvé en gare')
    expect(nomDeLaSacoche([ETIQUETTE, OBJET])).toBe('Sacoche du voyageur : une étiquette vient d’être collée sur la malle et un objet trouvé en gare')
  })
})


describe('les billets poinçonnés', () => {
  // Mutations : la table tenue par `media_id` ; un état pas encore lu qui lèverait.
  it('se tiennent par l’entrée de journal, jamais par le film, et il n’y en a aucun tant que l’état n’est pas lu', () => {
    const lu: Voyageur = { ...exemple<Voyageur>('/me/voyage/voyageur', 'get', 200), poincons: [{ log_entry_id: 'e-seconde', media_id: 'm-manoir', poinconne_le: '2026-10-08T18:00:00.000Z' }] }
    expect([...entreesPoinconnees(lu)]).toEqual(['e-seconde'])
    expect(entreesPoinconnees(lu).has('m-manoir')).toBe(false)
    expect(entreesPoinconnees(undefined).size).toBe(0)
  })
})
