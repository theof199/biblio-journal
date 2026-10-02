import { describe, expect, it } from 'vitest'
import { reactionsFavorites, reactionsVisibles } from './reactionsVisibles'

const catalogue = ['adore', 'sympa', 'nul', 'marre', 'touche'].map((cle) => ({ cle, emoji: '🎬', phrase: cle }))

describe('reactionsFavorites', () => {
  it('prend les trois plus posées du journal, dans l’ordre où on les lui donne', () => {
    const posees = [{ cle: 'touche' }, { cle: 'nul' }, { cle: 'adore' }, { cle: 'sympa' }]
    expect(reactionsFavorites(posees, catalogue)).toEqual(['touche', 'nul', 'adore'])
  })

  it('complète par les premières du catalogue quand le journal en a posé moins de trois', () => {
    expect(reactionsFavorites([{ cle: 'touche' }], catalogue)).toEqual(['touche', 'adore', 'sympa'])
  })

  it('sans journal, ce sont les trois premières du catalogue', () => {
    expect(reactionsFavorites([], catalogue)).toEqual(['adore', 'sympa', 'nul'])
  })

  it('ne compte pas deux fois une réaction déjà favorite quand il complète', () => {
    expect(reactionsFavorites([{ cle: 'adore' }], catalogue)).toEqual(['adore', 'sympa', 'nul'])
  })

  it('n’en invente pas quand le catalogue en a moins de trois', () => {
    expect(reactionsFavorites([], catalogue.slice(0, 2))).toEqual(['adore', 'sympa'])
  })
})

describe('reactionsVisibles', () => {
  const favorites = ['nul', 'adore', 'sympa']

  it('replié, montre les favorites dans l’ordre du catalogue', () => {
    expect(reactionsVisibles(catalogue, favorites, [], false).map((r) => r.cle)).toEqual(['adore', 'sympa', 'nul'])
  })

  it('replié, garde visible une réaction cochée qui n’est pas favorite, après les favorites', () => {
    expect(reactionsVisibles(catalogue, favorites, ['touche'], false).map((r) => r.cle)).toEqual(['adore', 'sympa', 'nul', 'touche'])
  })

  it('ne montre pas deux fois une favorite cochée', () => {
    expect(reactionsVisibles(catalogue, favorites, ['adore'], false)).toHaveLength(3)
  })

  it('déplié, montre tout le catalogue, dans son ordre', () => {
    expect(reactionsVisibles(catalogue, favorites, [], true).map((r) => r.cle)).toEqual(catalogue.map((r) => r.cle))
  })
})
