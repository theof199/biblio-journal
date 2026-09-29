import { describe, expect, it } from 'vitest'
import { RELECTURES, etatRelecture, intervalle, messageEchecComposition } from './relecture'

describe('les relectures', () => {
  // Mutation : `>` au lieu de `>=` ferait partir une requête de plus que le plafond.
  it('abandonnent à la `plafond`-ième réponse encore en attente, pas une de plus', () => {
    expect(etatRelecture(true, 35, RELECTURES.annee)).toBe('attente')
    expect(etatRelecture(true, 36, RELECTURES.annee)).toBe('abandon')
    expect(etatRelecture(true, 10, RELECTURES.carton)).toBe('abandon')
    expect(etatRelecture(true, 12, RELECTURES.verdict)).toBe('abandon')
  })

  // Mutation : compter avant de regarder `enAttente` : une réponse prête au dernier essai passerait pour un abandon.
  it('finissent dès que rien n’attend plus, quel que soit le compte', () => {
    expect(etatRelecture(false, 36, RELECTURES.annee)).toBe('fini')
  })

  it('donnent à TanStack Query l’intervalle tant qu’on attend, rien sinon', () => {
    expect(intervalle(true, 0, RELECTURES.annee)).toBe(5_000)
    expect(intervalle(true, 0, RELECTURES.fournee)).toBe(3_000)
    expect(intervalle(false, 0, RELECTURES.annee)).toBe(false)
    expect(intervalle(true, 36, RELECTURES.annee)).toBe(false)
  })
})

describe('une composition qui n’a rien donné', () => {
  // Mutations : muette sur un abandon ; bavarde alors qu'une séance est arrivée.
  it('le dit, différemment selon qu’elle a abandonné ou fini sans rien', () => {
    expect(messageEchecComposition('fini', 1, 2)).toBeNull()
    expect(messageEchecComposition('abandon', 1, 1)).toBe('Le chroniqueur n’a pas répondu, reviens plus tard.')
    expect(messageEchecComposition('fini', 1, 1)).toBe('Le chroniqueur n’a pas pu composer ce soir, réessaie.')
  })
})
