import { describe, expect, it } from 'vitest'
import { formatDateVisionnage, jourLocal, normaliser, sousTitre } from './format'

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

describe('jourLocal', () => {
  it('rend le jour du calendrier local, pas celui de Greenwich', () => {
    // Le fuseau des tests est figé sur Paris (`vite.config.ts`, `test.env`). À 0 h 30 le 30, il est
    // encore 22 h 30 le 29 à Greenwich. Mutation : `toISOString().slice(0, 10)` rend '2026-09-29'.
    expect(new Date(2026, 8, 30, 0, 30).getTimezoneOffset()).not.toBe(0)
    expect(jourLocal(new Date(2026, 8, 30, 0, 30))).toBe('2026-09-30')
  })

  it('complète le mois et le jour sur deux chiffres', () => {
    expect(jourLocal(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
  })
})

describe('formatDateVisionnage', () => {
  it('écrit le jour, le mois en toutes lettres et l’année', () => {
    expect(formatDateVisionnage('2026-07-12')).toBe('12 juillet 2026')
  })

  it('ordinalise le premier du mois', () => {
    expect(formatDateVisionnage('2026-10-01')).toBe('1er octobre 2026')
  })
})

describe('normaliser', () => {
  it('met en minuscules', () => {
    expect(normaliser('MIYAZAKI')).toBe('miyazaki')
  })

  it('retire les accents', () => {
    expect(normaliser('Amélie')).toBe('amelie')
  })

  it('rogne les espaces aux extrémités', () => {
    expect(normaliser('  Miyazaki  ')).toBe('miyazaki')
  })

  // Mutation : sans `.toLowerCase()` après `.replace`, « CAFÉ » et « café » resteraient distincts.
  it('« miya » retrouve « Hayao Miyazaki »', () => {
    expect(normaliser('Hayao Miyazaki').includes(normaliser('miya'))).toBe(true)
  })
})
