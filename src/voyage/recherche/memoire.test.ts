import { afterEach, describe, expect, it, vi } from 'vitest'
import { noterLeGuichet, relireLeGuichet } from './memoire'

describe('le guichet retenu sous son entrée', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Mutation : la clé sans la décennie (le guichet de 1890 rouvert sur celui de 1900).
  it('se relit sous sa propre entrée et sa propre décennie', () => {
    noterLeGuichet('a1', 1890, { saisie: 'melies', annees: [1896] })
    expect(relireLeGuichet('a1', 1890)).toEqual({ saisie: 'melies', annees: [1896] })
    expect(relireLeGuichet('b2', 1890)).toEqual({ saisie: '', annees: [] })
    expect(relireLeGuichet('a1', 1900)).toEqual({ saisie: '', annees: [] })
  })

  // Un guichet vidé n'est plus retenu. Mutation : le vide écrit tel quel (le stockage garde une ligne par entrée visitée).
  it('n’occupe rien quand il est vide', () => {
    noterLeGuichet('a1', 1890, { saisie: 'x', annees: [] })
    noterLeGuichet('a1', 1890, { saisie: '', annees: [] })
    expect(window.sessionStorage.length).toBe(0)
  })

  // Une valeur abîmée (une autre version, une main dans les outils) ouvre un guichet vide, jamais
  // une page en panne. Mutation : le `try` retiré (`JSON.parse` lève).
  it.each([
    ['du texte', '{pas du json'],
    ['un nombre', '42'],
    ['null', 'null'],
  ])('se relit vide sur une valeur illisible (%s)', (_quoi, brut) => {
    window.sessionStorage.setItem('journal:guichet:1890:a1', brut)
    expect(relireLeGuichet('a1', 1890)).toEqual({ saisie: '', annees: [] })
  })

  // Mutations : les années prises telles quelles ; la saisie prise telle quelle.
  it('ne garde qu’une saisie écrite et des années entières', () => {
    window.sessionStorage.setItem('journal:guichet:1890:a1', JSON.stringify({ saisie: 7, annees: [1895, '1896', 1897.5, null] }))
    expect(relireLeGuichet('a1', 1890)).toEqual({ saisie: '', annees: [1895] })
  })

  // Le stockage refusé (navigation privée, quota) : rien ne lève. Mutation : le `try` retiré.
  it('se tait quand le stockage est refusé', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('refusé', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('refusé', 'SecurityError')
    })
    expect(() => noterLeGuichet('a1', 1890, { saisie: 'x', annees: [] })).not.toThrow()
    expect(relireLeGuichet('a1', 1890)).toEqual({ saisie: '', annees: [] })
  })
})
