import { describe, expect, it } from 'vitest'
import { sousTitre } from './format'

describe('sousTitre', () => {
  it('joint le réalisateur et l’année', () => {
    expect(sousTitre('Christopher Nolan', 2010)).toBe('Christopher Nolan, 2010')
  })

  it('omet le réalisateur manquant, sans virgule seule', () => {
    expect(sousTitre(null, 2010)).toBe('2010')
  })

  it('omet l’année manquante', () => {
    expect(sousTitre('Christopher Nolan', null)).toBe('Christopher Nolan')
  })

  it('rend une chaîne vide sans rien connaître', () => {
    expect(sousTitre(null, null)).toBe('')
  })
})
