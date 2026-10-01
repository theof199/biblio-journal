import { afterEach, describe, expect, it, vi } from 'vitest'
import { ecrireAnneeVue, ecrireBobines, ecrireSon, lireAnneeVue, lireBobines, lireSon } from './memoire'

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

describe('le réglage du son et les bobines trouvées, sur l’appareil (plan 2d)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  // Mutations : `lireSon` qui rend vrai sans réglage (le son proposé d'emblée) ; une clé commune à
  // tous les membres.
  it('le son est coupé par défaut, et le choix se relit par membre', () => {
    expect(lireSon('alice')).toBe(false)
    ecrireSon('alice', true)
    expect(lireSon('alice')).toBe(true)
    expect(lireSon('bob')).toBe(false)
    ecrireSon('alice', false)
    expect(lireSon('alice')).toBe(false)
  })

  // Mutations : le filtre des chaînes retiré (une valeur abîmée passerait pour une clé) ; une clé
  // commune à tous les membres.
  it('les bobines trouvées se relisent par membre, et une valeur abîmée n’en vaut aucune', () => {
    expect(lireBobines('alice')).toEqual([])
    ecrireBobines('alice', ['les-quatre-diables'])
    expect(lireBobines('alice')).toEqual(['les-quatre-diables'])
    expect(lireBobines('bob')).toEqual([])
    localStorage.setItem('journal.carte.bobines.bob', '{pas du json')
    expect(lireBobines('bob')).toEqual([])
    localStorage.setItem('journal.carte.bobines.bob', '["la-tete-de-janus", 3, null]')
    expect(lireBobines('bob')).toEqual(['la-tete-de-janus'])
  })

  // Mutations : un `try` retiré de l'une des quatre fonctions.
  it('un stockage qui lève vaut « coupé » et « aucune », et s’écrit sans lever', () => {
    const bloque = () => {
      throw new DOMException('Le stockage est bloqué.', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(bloque)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(bloque)
    expect(lireSon('alice')).toBe(false)
    expect(lireBobines('alice')).toEqual([])
    expect(() => ecrireSon('alice', true)).not.toThrow()
    expect(() => ecrireBobines('alice', ['les-quatre-diables'])).not.toThrow()
  })
})
