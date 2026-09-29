import { afterEach, describe, expect, it, vi } from 'vitest'
import { ecrireAnneeVue, lireAnneeVue } from './memoire'

describe('la mémoire de l’année vue', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('se relit par membre', () => {
    ecrireAnneeVue('alice', 1897)
    expect(lireAnneeVue('alice')).toBe(1897)
    expect(lireAnneeVue('bob')).toBeNull()
  })

  // Mutations : le `try` retiré de `lireAnneeVue`, ou d'`ecrireAnneeVue` : un stockage bloqué
  // (navigation privée, réglage du navigateur) ferait tomber la carte au lieu de l'ouvrir sans marche.
  it('vaut « jamais vue » quand le stockage est bloqué, et s’écrit sans lever', () => {
    const bloque = () => {
      throw new DOMException('Le stockage est bloqué.', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(bloque)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(bloque)
    expect(lireAnneeVue('alice')).toBeNull()
    expect(() => ecrireAnneeVue('alice', 1897)).not.toThrow()
  })
})
