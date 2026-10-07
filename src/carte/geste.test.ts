import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Geste, lirePincement, type Signal } from './geste'

describe('le geste', () => {
  let signaux: Signal[]
  let geste: Geste
  beforeEach(() => {
    vi.useFakeTimers()
    signaux = []
    geste = new Geste(
      { maintenant: () => Date.now(), programmer: (fn, ms) => setTimeout(fn, ms), annuler: (j) => clearTimeout(j as number) },
      (x) => (x < 50 ? 1897 : null),
      (s) => signaux.push(s),
    )
  })
  afterEach(() => vi.useRealTimers())

  it('un toucher bref est un toucher', () => {
    geste.baisser(10, 10, false)
    vi.advanceTimersByTime(120)
    geste.lever(11, 10)
    expect(signaux).toEqual([{ type: 'toucher', x: 11, y: 10 }])
  })

  // Mutation : ne pas annuler la minuterie au `lever` ouvre l'aperçu après un toucher bref.
  it('un appui long sur une case ouvre l’aperçu et n’est pas un toucher', () => {
    geste.baisser(10, 10, false)
    vi.advanceTimersByTime(470)
    geste.lever(10, 10)
    expect(signaux).toEqual([{ type: 'appuiLong', annee: 1897 }])
    signaux.length = 0
    geste.baisser(10, 10, false)
    vi.advanceTimersByTime(100)
    geste.lever(10, 10)
    vi.advanceTimersByTime(1000)
    expect(signaux).toEqual([{ type: 'toucher', x: 10, y: 10 }])
  })

  // Mutation : retirer la garde `bouge` fait ouvrir une fiche à chaque défilement.
  it('un doigt qui défile n’est ni un toucher ni un appui long', () => {
    geste.baisser(10, 10, false)
    geste.bouger(10, 40, false)
    vi.advanceTimersByTime(500)
    geste.lever(10, 80)
    expect(signaux).toEqual([])
  })

  it('un appui trop long hors d’une case n’est rien', () => {
    geste.baisser(200, 10, false)
    vi.advanceTimersByTime(700)
    geste.lever(200, 10)
    expect(signaux).toEqual([])
  })

  it('à la souris, un survol prolongé ouvre l’aperçu, et le quitter le referme', () => {
    geste.bouger(10, 10, true)
    vi.advanceTimersByTime(530)
    geste.bouger(200, 10, true)
    expect(signaux).toEqual([{ type: 'appuiLong', annee: 1897 }, { type: 'finSurvol' }])
  })
})

describe('le pincement', () => {
  it('resserrer ouvre la vue d’ensemble, écarter la referme, rien entre les deux', () => {
    expect(lirePincement(100, 70, false)).toBe('ouvrir')
    expect(lirePincement(100, 70, true)).toBeNull()
    expect(lirePincement(100, 140, true)).toBe('fermer')
    expect(lirePincement(100, 110, true)).toBeNull()
  })
})

// Ajouts de la relecture : chaque test tue une mutation qui survivait au bloc du plan.
describe('le geste, ses bornes et ses jumeaux', () => {
  let signaux: Signal[]
  let geste: Geste
  beforeEach(() => {
    vi.useFakeTimers()
    signaux = []
    geste = new Geste(
      { maintenant: () => Date.now(), programmer: (fn, ms) => setTimeout(fn, ms), annuler: (j) => clearTimeout(j as number) },
      (x) => (x < 50 ? 1897 : null),
      (s) => signaux.push(s),
    )
  })
  afterEach(() => vi.useRealTimers())

  // Mutation : `APPUI_LONG_MS` changé (200, 600…).
  it('l’appui long part à 460 ms, pas avant', () => {
    geste.baisser(10, 10, false)
    vi.advanceTimersByTime(459)
    expect(signaux).toEqual([])
    vi.advanceTimersByTime(1)
    expect(signaux).toEqual([{ type: 'appuiLong', annee: 1897 }])
  })

  // Mutation : `SURVOL_MS` changé, ou `survoler` qui arme au délai de l’appui long.
  it('à la souris, le survol ouvre l’aperçu à 520 ms, pas avant', () => {
    geste.bouger(10, 10, true)
    vi.advanceTimersByTime(519)
    expect(signaux).toEqual([])
    vi.advanceTimersByTime(1)
    expect(signaux).toEqual([{ type: 'appuiLong', annee: 1897 }])
  })

  // Mutation : `TOUCHER_MAX_MS` abaissé, ou `>` devenu `>=`.
  it('hors d’une case, un appui de 650 ms est encore un toucher', () => {
    geste.baisser(200, 10, false)
    vi.advanceTimersByTime(650)
    geste.lever(200, 10)
    expect(signaux).toEqual([{ type: 'toucher', x: 200, y: 10 }])
  })

  // Mutation : le seuil `BOUGE_PX` ramené à zéro.
  it('un doigt qui tremble de quelques pixels touche encore', () => {
    geste.baisser(10, 10, false)
    geste.bouger(14, 13, false)
    vi.advanceTimersByTime(100)
    geste.lever(14, 13)
    expect(signaux).toEqual([{ type: 'toucher', x: 14, y: 13 }])
  })

  // Mutation : `survoler` sans annuler la minuterie de la case quittée.
  it('à la souris, une case quittée avant le délai n’ouvre rien', () => {
    geste.bouger(10, 10, true)
    vi.advanceTimersByTime(300)
    geste.bouger(200, 10, true)
    vi.advanceTimersByTime(1000)
    expect(signaux).not.toContainEqual({ type: 'appuiLong', annee: 1897 })
  })

  // Mutation : `quitter` sans le signal `finSurvol`.
  it('quitter la carte referme l’aperçu ouvert par le survol', () => {
    geste.bouger(10, 10, true)
    vi.advanceTimersByTime(530)
    geste.quitter()
    expect(signaux).toEqual([{ type: 'appuiLong', annee: 1897 }, { type: 'finSurvol' }])
  })

  // Mutation : `quitter` sans annuler la minuterie du survol.
  it('quitter la carte avant le délai du survol n’ouvre rien ensuite', () => {
    geste.bouger(10, 10, true)
    vi.advanceTimersByTime(100)
    geste.quitter()
    vi.advanceTimersByTime(1000)
    expect(signaux).not.toContainEqual({ type: 'appuiLong', annee: 1897 })
  })

  // Mutation : `annulerAppui` sans annuler la minuterie.
  it('un geste repris par le navigateur n’ouvre pas l’aperçu', () => {
    geste.baisser(10, 10, false)
    vi.advanceTimersByTime(100)
    geste.annulerAppui()
    vi.advanceTimersByTime(1000)
    expect(signaux).toEqual([])
  })

  // Mutation : `baisser` sans `annulerAppui` en tête.
  it('un nouvel appui annule la minuterie du précédent', () => {
    geste.baisser(10, 10, false)
    vi.advanceTimersByTime(300)
    geste.baisser(10, 10, false)
    vi.advanceTimersByTime(300)
    expect(signaux).toEqual([])
  })

  // Mutation : `bouger` qui survole aussi au doigt.
  it('au doigt, glisser sur une case ne la survole pas', () => {
    geste.baisser(200, 10, false)
    geste.bouger(10, 10, false)
    vi.advanceTimersByTime(1000)
    geste.lever(10, 10)
    // Le geste est horizontal : il glisse (lot « moteur »), et ne dit rien d'autre.
    expect(signaux.filter((x) => x.type !== 'glisse')).toEqual([])
  })

  // Mutation : `baisser` qui arme l’appui long à la souris.
  it('à la souris, un clic maintenu reste un toucher', () => {
    geste.baisser(10, 10, true)
    vi.advanceTimersByTime(470)
    geste.lever(10, 10)
    expect(signaux).toEqual([{ type: 'toucher', x: 10, y: 10 }])
  })
})

describe('le pincement, son jumeau', () => {
  // Mutation : `fermer` sans regarder `ensembleOuvert`.
  it('écarter quand la vue d’ensemble est fermée n’est rien', () => {
    expect(lirePincement(100, 140, false)).toBeNull()
  })
})

describe('le glissement horizontal (lot « moteur »)', () => {
  let signaux: Signal[]
  let geste: Geste
  beforeEach(() => {
    vi.useFakeTimers()
    signaux = []
    geste = new Geste(
      { maintenant: () => Date.now(), programmer: (fn, ms) => setTimeout(fn, ms), annuler: (j) => clearTimeout(j as number) },
      (x) => (x < 50 ? 1897 : null),
      (s) => signaux.push(s),
    )
  })
  afterEach(() => vi.useRealTimers())
  const glisse = (phase: 'debut' | 'suite' | 'fin', x: number, y: number, x0 = 200, y0 = 300): Signal => ({ type: 'glisse', phase, x, y, x0, y0 })

  // Mutation : la comparaison retournée (`<` à la place de `>` entre `|dx|` et `|dy|`).
  it('un geste plus large que haut est un glissement, un geste plus haut que large n’en est pas un', () => {
    geste.baisser(200, 300, false)
    geste.bouger(214, 304, false)
    expect(signaux).toEqual([glisse('debut', 214, 304)])
    geste.bouger(260, 290, false)
    expect(signaux).toEqual([glisse('debut', 214, 304), glisse('suite', 260, 290)])
    geste.lever(261, 290)
    signaux.length = 0
    geste.baisser(200, 300, false)
    geste.bouger(204, 314, false)
    geste.bouger(206, 380, false)
    geste.lever(206, 380)
    expect(signaux).toEqual([])
  })

  // Mutation : le seuil `BOUGE_PX` retiré de la décision (un doigt qui tremble glisserait, et son
  // toucher serait perdu).
  it('sous dix pixels rien ne glisse, et le toucher reste un toucher', () => {
    geste.baisser(200, 300, false)
    geste.bouger(208, 301, false)
    geste.lever(208, 301)
    expect(signaux).toEqual([{ type: 'toucher', x: 208, y: 301 }])
  })

  // Mutation : la décision reprise à chaque mouvement (la garde `!a.bouge` retirée).
  it('un geste commencé à la verticale ne devient pas un glissement en route', () => {
    geste.baisser(200, 300, false)
    geste.bouger(202, 330, false)
    geste.bouger(280, 332, false)
    geste.bouger(340, 334, false)
    geste.lever(340, 334)
    expect(signaux).toEqual([])
  })

  // Le jumeau : un glissement dévié vers le haut reste un glissement, jusqu'au lever.
  // Mutation : la `suite` gardée par la même comparaison que le `debut`.
  it('un glissement dévié à la verticale reste un glissement', () => {
    geste.baisser(200, 300, false)
    geste.bouger(230, 300, false)
    geste.bouger(232, 200, false)
    expect(signaux).toEqual([glisse('debut', 230, 300), glisse('suite', 232, 200)])
  })

  // Mutations : le `toucher` émis au lever d'un glissement (la garde `bouge` retirée de `lever`) ;
  // la `fin` retirée de `lever`.
  it('un glissement finit au lever, par une fin et sans toucher, même bref', () => {
    geste.baisser(200, 300, false)
    geste.bouger(230, 300, false)
    vi.advanceTimersByTime(60)
    geste.lever(236, 302)
    expect(signaux).toEqual([glisse('debut', 230, 300), glisse('fin', 236, 302)])
    // Rien ne reste ouvert : un mouvement sans appui ne dit rien.
    geste.bouger(300, 300, false)
    geste.lever(300, 300)
    expect(signaux).toHaveLength(2)
  })

  // Mutations : la `fin` retirée d'`annulerAppui` ; le point de la fin pris au poser (`a.x`, `a.y`)
  // au lieu du dernier mouvement ; l'appui laissé en place (une seconde annulation redirait la fin).
  it('un pointercancel finit le glissement là où le doigt était, une seule fois', () => {
    geste.baisser(200, 300, false)
    geste.bouger(230, 300, false)
    geste.bouger(250, 296, false)
    signaux.length = 0
    geste.annulerAppui()
    geste.annulerAppui()
    expect(signaux).toEqual([glisse('fin', 250, 296)])
  })

  // Un second doigt qui se pose (`baisser` sans `lever`) : le glissement d'avant est fini.
  // Mutation : `annulerAppui` retiré de `baisser`.
  it('un appui neuf finit le glissement d’avant', () => {
    geste.baisser(200, 300, false)
    geste.bouger(230, 300, false)
    signaux.length = 0
    geste.baisser(100, 100, false)
    expect(signaux).toEqual([glisse('fin', 230, 300)])
  })

  // Mutation : la garde `!a.long` retirée de la décision.
  it('un appui long déjà parti ne devient pas un glissement', () => {
    geste.baisser(10, 10, false)
    vi.advanceTimersByTime(470)
    geste.bouger(60, 10, false)
    geste.lever(60, 10)
    expect(signaux).toEqual([{ type: 'appuiLong', annee: 1897 }])
  })

  // Mutation : la minuterie non annulée quand le mouvement décide d'un glissement.
  it('un glissement parti d’une case n’ouvre pas son aperçu', () => {
    geste.baisser(10, 10, false)
    geste.bouger(40, 10, false)
    vi.advanceTimersByTime(600)
    expect(signaux).toEqual([glisse('debut', 40, 10, 10, 10)])
  })

  // Mutation : le glissement réservé au doigt (`!souris` dans la décision).
  it('à la souris, bouton tenu, le geste glisse aussi', () => {
    geste.baisser(200, 300, true)
    geste.bouger(230, 300, true)
    expect(signaux).toContainEqual(glisse('debut', 230, 300))
  })

  // La toile ne capture pas le pointeur : le bouton relâché dehors n'arrive jamais. Mutation : le
  // glissement ouvert laissé tel quel par `quitter` (la souris revenue glisserait sans bouton).
  it('à la souris, quitter la toile finit le glissement là où il était, et la souris revenue ne glisse plus', () => {
    geste.baisser(200, 300, true)
    geste.bouger(230, 300, true)
    geste.bouger(260, 304, true)
    signaux.length = 0
    geste.quitter()
    expect(signaux).toEqual([glisse('fin', 260, 304)])
    geste.bouger(300, 310, true)
    geste.bouger(340, 310, true)
    expect(signaux).toEqual([glisse('fin', 260, 304)])
  })

  // Le jumeau : `quitter` ne finit que le glissement. Mutation : tout appui annulé par `quitter`
  // (`if (this.appui)` au lieu de `if (this.appui?.glisse)`).
  it('quitter la toile ne lâche pas un appui qui n’est pas un glissement', () => {
    geste.baisser(200, 300, true)
    geste.quitter()
    geste.lever(202, 301)
    expect(signaux).toEqual([{ type: 'toucher', x: 202, y: 301 }])
  })
})
