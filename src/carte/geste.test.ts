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
    expect(signaux).toEqual([])
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
