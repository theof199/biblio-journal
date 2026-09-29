import { describe, expect, it } from 'vitest'
import { MAX_REACTIONS, basculerReaction } from './reactions'

const ORDRE = ['adore', 'sympa', 'nul', 'marre', 'touche']

describe('basculerReaction', () => {
  it('coche une réaction absente', () => {
    expect(basculerReaction([], 'sympa', ORDRE)).toEqual(['sympa'])
  })

  it('décoche une réaction déjà cochée', () => {
    expect(basculerReaction(['sympa', 'adore'], 'sympa', ORDRE)).toEqual(['adore'])
  })

  it('range le résultat dans l’ordre du catalogue, pas l’ordre de saisie', () => {
    expect(basculerReaction(['sympa'], 'adore', ORDRE)).toEqual(['adore', 'sympa'])
  })

  it('refuse une réaction de plus une fois la limite atteinte', () => {
    const max = ['adore', 'sympa']
    expect(basculerReaction(max, 'nul', ORDRE, 2)).toEqual(max)

    // Mutation : sans la garde, la troisième réaction s'ajouterait quand même.
    expect(basculerReaction(max, 'nul', ORDRE, 2)).toHaveLength(2)
  })

  it('la limite par défaut est 12, comme l’appli Android et l’API', () => {
    expect(MAX_REACTIONS).toBe(12)
  })
})
