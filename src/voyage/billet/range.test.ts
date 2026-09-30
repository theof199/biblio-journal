import { afterEach, describe, expect, it } from 'vitest'
import { billetRange, oublierLeBillet, rangerLeBillet } from './range'

describe('le dernier billet rangé', () => {
  afterEach(oublierLeBillet)

  // Mutation : le membre ignoré (un autre membre, sur le même onglet, verrait le billet d'un autre).
  it('ne se montre qu’au membre qui l’a rangé', () => {
    rangerLeBillet('alice', 'e1')
    expect(billetRange('alice')).toBe('e1')
    expect(billetRange('bob')).toBeNull()
  })

  // Mutations : lu en le prenant (une seconde lecture, `StrictMode`, ne le verrait plus) ; jamais oublié.
  it('se lit sans être pris, et s’oublie une fois montré', () => {
    rangerLeBillet('alice', 'e1')
    expect(billetRange('alice')).toBe('e1')
    expect(billetRange('alice')).toBe('e1')
    oublierLeBillet()
    expect(billetRange('alice')).toBeNull()
  })

  it('garde le dernier rangé', () => {
    rangerLeBillet('alice', 'e1')
    rangerLeBillet('alice', 'e2')
    expect(billetRange('alice')).toBe('e2')
  })
})
