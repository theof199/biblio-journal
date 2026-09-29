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
