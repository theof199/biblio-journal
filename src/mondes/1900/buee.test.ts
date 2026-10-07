import { describe, expect, it } from 'vitest'
import { creerMonde1900 } from '.'
import type { Glissement } from '../types'
import { vueFactice } from '../../test/vueFactice'
import { bueePrise, COULURES, creerVitre, essuyer, forceDeLaBuee, PAS_DU_DOIGT, PLAFOND_DES_TRAITS, VITRE_EMBUEE, type Essuyage } from './buee'
import { BUEE } from './donnees'
import { LIEU } from './gares'
import { vitreOuverte } from './passage'
import { ANNEES, ARRETS, B1, PAS, S1 } from './trace'

/**
 * La buée de Creil (lot « moteur », idée 70). Ces tests ne portent que sur les règles (`buee.ts`) et
 * sur ce que le monde répond à un glissement : aucun ne fige les appels de canvas du trait
 * (`intemperies.ts`).
 */

const arret = (annee: number): number => ARRETS[annee - 1900]!
const CREIL = arret(1901)
const ECRAN = { W: 400, H: 800 }
const glisse = (phase: Glissement['phase'], x: number, y: number, x0 = 100, y0 = 400): Glissement => ({ phase, x, y, x0, y0 })
/** Un passage du doigt : posé en (100, 400), il passe par chaque point, et finit au dernier. */
const passer = (e: Essuyage, points: ReadonlyArray<readonly [number, number]>): Essuyage => {
  let suite = e
  points.forEach(([x, y], i) => (suite = essuyer(suite, glisse(i === 0 ? 'debut' : 'suite', x, y), ECRAN)))
  const [x, y] = points[points.length - 1]!
  return essuyer(suite, glisse('fin', x, y), ECRAN)
}

describe('quelle gare est embuée', () => {
  // Mutations : une gare de plus dans `BUEE` ; `BUEE` vide ; 1902 à la place de 1901.
  it('Creil, et elle seule', () => {
    expect(BUEE.map((annee) => LIEU[annee])).toEqual(['Creil'])
  })

  // Mutations : `forceDeLaBuee` qui ignore la table (pleine partout) ; le rang lu de travers (`i + 1`).
  it('à l’arrêt, la buée est pleine à Creil et nulle dans toute autre gare', () => {
    expect(ANNEES.map((annee) => forceDeLaBuee(arret(annee)))).toEqual([0, 1, 0, 0, 0, 0, 0, 0, 0, 0])
  })
})

describe('la force de la buée', () => {
  // Mutations : les seuils 0,3 et 0,56 déplacés (0,5 et 0,9 : elle atteindrait Couville à mi-chemin) ;
  // `Math.abs` retiré (rien avant la gare, tout après).
  it('pleine jusqu’à 30 % du chemin, nulle à 56 %, des deux côtés de la gare', () => {
    for (const sens of [-1, 1]) {
      expect(forceDeLaBuee(CREIL + sens * 0.3 * PAS), `plein, ${sens}`).toBe(1)
      const mi = forceDeLaBuee(CREIL + sens * 0.43 * PAS)
      expect(mi, `entre les deux, ${sens}`).toBeGreaterThan(0.2)
      expect(mi, `entre les deux, ${sens}`).toBeLessThan(0.8)
      expect(forceDeLaBuee(CREIL + sens * 0.56 * PAS), `nul, ${sens}`).toBe(0)
      expect(forceDeLaBuee(CREIL + sens * 0.8 * PAS), `nul plus loin, ${sens}`).toBe(0)
    }
  })

  // Le passage de la foire au train ne dépend que de l'avance : rien ne s'y pose sur la vitre.
  // Mutation : la garde `avance < B1` retirée.
  it('nulle avant la gare de 1900, même si la table embue la gare de 1900', () => {
    expect(forceDeLaBuee(B1, [1900])).toBe(1)
    for (const avance of [B1 - 1, B1 - 40, S1, 0, -300]) expect(forceDeLaBuee(avance, [1900]), String(avance)).toBe(0)
  })

  // Mutation : une année hors de la ligne lue au rang -1 sans que rien l'écarte ne change rien ; une
  // table qui la prendrait pour la dernière gare (`at(-1)`), si.
  it('une année hors de la ligne n’embue rien', () => {
    expect(ANNEES.map((annee) => forceDeLaBuee(arret(annee), [1899, 1910]))).toEqual(ANNEES.map(() => 0))
  })
})

describe('quand un glissement est un essuyage', () => {
  // Mutations : le seuil de 0,4 retiré (`<= 0` : à mi-chemin, la buée se voit à peine et le doigt ne
  // défilerait plus) ; le seuil inversé.
  it('là où la buée se voit assez, pas là où elle s’efface', () => {
    expect(bueePrise(CREIL)).toBe(true)
    expect(bueePrise(CREIL + 0.4 * PAS)).toBe(true)
    expect(bueePrise(CREIL - 0.4 * PAS)).toBe(true)
    const loin = CREIL + 0.5 * PAS
    expect(forceDeLaBuee(loin)).toBeGreaterThan(0.004)
    expect(bueePrise(loin)).toBe(false)
    expect(bueePrise(arret(1902))).toBe(false)
  })

  // Le repli de la spec : une ligne à changer (`PORTEE_DE_L_ESSUYAGE`). Mutations : la portée ignorée ;
  // la portée mesurée depuis une autre gare que l'embuée (`ARRETS[0]`).
  it('avec une portée, seulement à l’arrêt de la gare embuée', () => {
    expect(bueePrise(CREIL, BUEE, 2)).toBe(true)
    expect(bueePrise(CREIL + 2, BUEE, 2)).toBe(true)
    expect(bueePrise(CREIL + 3, BUEE, 2)).toBe(false)
    expect(bueePrise(CREIL - 3, BUEE, 2)).toBe(false)
    expect(bueePrise(arret(1900), BUEE, 2)).toBe(false)
  })

  // La vitre s'ouvre avant la gare de 1900 : il y a des avances où tout se touche déjà et où la buée
  // n'a pourtant aucune force. La garde `vitreOuverte` de `bueePrise` double celle de la force : la
  // retirer seule ne change rien (mutation équivalente, dite au rapport) ; retirer les deux, si.
  it('jamais pendant le passage de la foire au train, quelle que soit la table', () => {
    expect(vitreOuverte(B1 - 10)).toBe(true)
    for (const avance of [B1 - 10, S1, 0]) expect(bueePrise(avance, [1900]), String(avance)).toBe(false)
    expect(bueePrise(B1, [1900])).toBe(true)
  })
})

describe('ce que le monde répond à un glissement', () => {
  const debut = (avance: number, surcharge: Parameters<typeof vueFactice>[0] = {}) => creerMonde1900().glisser!(glisse('debut', 130, 400), vueFactice({ avance, ...surcharge }).vue)

  // Mutations : `glisser: null` laissé au monde ; `glisser: () => true` (il prendrait tout glissement,
  // et le doigt ne défilerait plus de travers nulle part) ; `() => false`.
  it('il le prend en gare de Creil, et le refuse dans toute autre gare et pendant le passage', () => {
    expect(ANNEES.filter((annee) => debut(arret(annee)))).toEqual([1901])
    for (const avance of [S1, B1 - 10, 0]) expect(debut(avance), String(avance)).toBe(false)
  })

  // Décision de la session principale : la buée s'essuie aussi avec « moins d'animations ».
  // Mutation : `v.vivant` exigé dans `glisser`.
  it('il le prend aussi au calme', () => {
    expect(debut(CREIL, { vivant: false })).toBe(true)
  })

  // Mutation : un terme en `v.t` dans la prise (une buée qui respire).
  it('il répond la même chose à tout instant', () => {
    for (const avance of [CREIL, CREIL + 0.42 * PAS, CREIL + 0.46 * PAS, arret(1902)]) {
      const reponses = [0, 0.37, 3.2, 1234.5].map((t) => debut(avance, { t }))
      expect(new Set(reponses).size, String(avance)).toBe(1)
    }
  })
})

describe('ce qu’un glissement efface', () => {
  // Le `debut` arrive à plus de dix pixels du poser : le premier trait part du poser. Mutations : le
  // premier trait parti du doigt (`g.x`, `g.y` : les dix premiers pixels resteraient embués) ; des
  // pixels au lieu de parts de l'écran ; `W` et `H` échangés.
  it('le début ôte du poser au doigt, chaque suite du doigt au doigt, en parts de l’écran', () => {
    let e = essuyer(VITRE_EMBUEE, glisse('debut', 140, 400), ECRAN)
    expect(e.traits).toEqual([{ genre: 'doigt', x0: 0.25, y0: 0.5, x1: 0.35, y1: 0.5 }])
    e = essuyer(e, glisse('suite', 200, 440), ECRAN)
    expect(e.traits).toEqual([{ genre: 'doigt', x0: 0.25, y0: 0.5, x1: 0.35, y1: 0.5 }, { genre: 'doigt', x0: 0.35, y0: 0.5, x1: 0.5, y1: 0.55 }])
  })

  // Mutation : le pas du doigt retiré (un trait par `pointermove`, cent par seconde).
  it('un doigt qui ne bouge presque pas n’ajoute rien, puis ajoute dès qu’il a fait son pas', () => {
    const e = essuyer(VITRE_EMBUEE, glisse('debut', 140, 400), ECRAN)
    const surPlace = essuyer(e, glisse('suite', 140 + PAS_DU_DOIGT - 1, 400), ECRAN)
    expect(surPlace).toBe(e)
    expect(essuyer(surPlace, glisse('suite', 140 + PAS_DU_DOIGT, 400), ECRAN).traits).toHaveLength(2)
  })

  // Mutations : les gouttes posées sous le dernier point au lieu du plus bas ; sous le plus haut
  // (`<`) ; une seule goutte ; les gouttes oubliées ; le passage laissé ouvert après la fin.
  it('la fin pose deux gouttes sous le point le plus bas du passage, et ferme le passage', () => {
    const e = passer(VITRE_EMBUEE, [[140, 400], [200, 480], [300, 420]])
    expect(e.doigt).toBeNull()
    const gouttes = e.traits.filter((t) => t.genre === 'goutte')
    expect(e.traits.map((t) => t.genre)).toEqual(['doigt', 'doigt', 'doigt', 'goutte', 'goutte'])
    expect(gouttes).toHaveLength(COULURES.length)
    gouttes.forEach((g, k) => {
      const c = COULURES[k]!
      expect(g.x0 * ECRAN.W).toBeCloseTo(200 + c.dx, 6)
      expect(g.y0 * ECRAN.H).toBeCloseTo(480 + c.dy, 6)
      expect(g.x1 * ECRAN.W).toBeCloseTo(200 + c.dx + 2, 6)
      expect(g.y1 * ECRAN.H).toBeCloseTo(480 + c.dy + c.l, 6)
    })
  })

  // La `fin` n'est pas un lever : reprise par le navigateur, elle porte le dernier mouvement, et les
  // gouttes coulent quand même. Au lever, elle porte le point du lever, qui s'essuie. Mutations : la
  // `fin` qui n'ajoute jamais son point ; les gouttes réservées à une fin qui a bougé.
  it('une fin sans lever n’ajoute que les gouttes, une fin au lever essuie d’abord jusqu’au lever', () => {
    const ouvert = essuyer(essuyer(VITRE_EMBUEE, glisse('debut', 140, 400), ECRAN), glisse('suite', 200, 400), ECRAN)
    const reprise = essuyer(ouvert, glisse('fin', 200, 400), ECRAN)
    expect(reprise.traits.map((t) => t.genre)).toEqual(['doigt', 'doigt', 'goutte', 'goutte'])
    const levee = essuyer(ouvert, glisse('fin', 260, 400), ECRAN)
    expect(levee.traits.map((t) => t.genre)).toEqual(['doigt', 'doigt', 'doigt', 'goutte', 'goutte'])
    expect(levee.traits[2]).toMatchObject({ x0: 0.5, x1: 0.65 })
  })

  // Mutation : la garde `if (!doigt) return e` retirée (une suite sans début essuierait depuis nulle part).
  it('hors d’un passage, une suite ou une fin ne fait rien', () => {
    expect(essuyer(VITRE_EMBUEE, glisse('suite', 200, 400), ECRAN)).toBe(VITRE_EMBUEE)
    expect(essuyer(VITRE_EMBUEE, glisse('fin', 200, 400), ECRAN)).toBe(VITRE_EMBUEE)
    const ferme = passer(VITRE_EMBUEE, [[140, 400]])
    expect(essuyer(ferme, glisse('suite', 300, 600), ECRAN)).toBe(ferme)
  })

  // Mutations : la borne retirée ; la place des gouttes non gardée (`+ 1 <=` : le dernier passage ne
  // coulerait pas, ou la liste dépasserait) ; des gouttes sous un passage qui n'a rien ôté.
  it('la liste ne passe jamais sa borne, le passage qui l’atteint coule encore, le suivant n’ôte plus rien', () => {
    const allerRetour = Array.from({ length: PLAFOND_DES_TRAITS * 2 }, (_, k) => [k % 2 === 0 ? 300 : 120, 400] as const)
    const plein = passer(VITRE_EMBUEE, allerRetour)
    expect(plein.traits).toHaveLength(PLAFOND_DES_TRAITS)
    expect(plein.traits.slice(-3).map((t) => t.genre)).toEqual(['doigt', 'goutte', 'goutte'])
    const encore = passer(plein, [[140, 600], [300, 600]])
    expect(encore.traits).toBe(plein.traits)
    expect(encore.doigt).toBeNull()
  })
})

describe('la vitre du monde, et son oubli', () => {
  const vue = (avance: number) => ({ avance, ...ECRAN })
  const essuyerACreil = (vitre: ReturnType<typeof creerVitre>) => {
    expect(vitre.glisser(glisse('debut', 140, 400), vue(CREIL))).toBe(true)
    vitre.glisser(glisse('suite', 300, 400), vue(CREIL))
    vitre.glisser(glisse('fin', 300, 400), vue(CREIL))
  }

  // Mutations : `glisser` qui n'écrit pas dans la vitre ; qui rend faux après le début.
  it('garde ce que le doigt a ôté tant que la buée a de la force, même là où elle ne se prend plus', () => {
    const vitre = creerVitre()
    essuyerACreil(vitre)
    expect(vitre.essuyage(CREIL).traits.map((t) => t.genre)).toEqual(['doigt', 'doigt', 'goutte', 'goutte'])
    expect(bueePrise(CREIL + 0.5 * PAS)).toBe(false)
    expect(vitre.essuyage(CREIL + 0.5 * PAS).traits).toHaveLength(4)
    expect(vitre.essuyage(CREIL).traits).toHaveLength(4)
  })

  // La maquette réembue la vitre dès que la force retombe à zéro (l. 3728). Mutations : la liste non
  // vidée quand la force retombe à zéro ; vidée dès que la buée ne se prend plus (`FORCE_DE_PRISE`).
  it('oublie tout dès que la buée n’a plus de force : revenir à Creil retrouve la vitre embuée', () => {
    for (const depart of [arret(1902), arret(1900), CREIL + 0.56 * PAS, S1]) {
      const vitre = creerVitre()
      essuyerACreil(vitre)
      expect(vitre.essuyage(depart), String(depart)).toBe(VITRE_EMBUEE)
      expect(vitre.essuyage(CREIL), String(depart)).toBe(VITRE_EMBUEE)
    }
  })

  // Le train emmené sous le doigt (un passage, un rappel) : la vitre se réembue, et la suite du même
  // appui n'y ôte plus rien, même revenue en gare. Mutation : l'oubli constaté au dessin seul, pas
  // dans `glisser` (la suite reçue loin de Creil essuierait une buée qui n'y est pas).
  it('un glissement dont le train s’éloigne ne laisse rien, et sa suite n’essuie plus', () => {
    const vitre = creerVitre()
    vitre.glisser(glisse('debut', 140, 400), vue(CREIL))
    vitre.glisser(glisse('suite', 200, 400), vue(arret(1902)))
    vitre.glisser(glisse('suite', 300, 400), vue(CREIL))
    vitre.glisser(glisse('fin', 300, 400), vue(CREIL))
    expect(vitre.essuyage(CREIL)).toBe(VITRE_EMBUEE)
  })

  // Mutation : le refus du début qui ouvre quand même un passage.
  it('un début refusé n’ouvre rien', () => {
    const vitre = creerVitre()
    expect(vitre.glisser(glisse('debut', 140, 400), vue(CREIL + 0.5 * PAS))).toBe(false)
    vitre.glisser(glisse('suite', 300, 400), vue(CREIL))
    expect(vitre.essuyage(CREIL)).toBe(VITRE_EMBUEE)
  })

  // « Un registre par appelant » : le monde qu'une page tient ne sait rien de la vitre que le moteur
  // dessine. Mutation : la mémoire sortie de la fermeture, au niveau du module.
  it('chaque vitre a sa mémoire', () => {
    const une = creerVitre()
    const autre = creerVitre()
    essuyerACreil(une)
    expect(autre.essuyage(CREIL)).toBe(VITRE_EMBUEE)
    expect(une.essuyage(CREIL).traits).toHaveLength(4)
  })
})
