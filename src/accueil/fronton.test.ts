import { describe, expect, it } from 'vitest'
import { compteAccueil, formatJour } from './fronton'

describe('formatJour', () => {
  it('écrit le jour en toutes lettres, capitalisé', () => {
    expect(formatJour(new Date(2026, 8, 24))).toBe('Jeudi 24 septembre')
  })

  it('ordinalise le premier du mois', () => {
    expect(formatJour(new Date(2026, 9, 1))).toBe('Jeudi 1er octobre')
  })
})

describe('compteAccueil', () => {
  it('rend nul tant que /stats n’a pas répondu', () => {
    expect(compteAccueil(undefined)).toBeNull()
    expect(compteAccueil(null)).toBeNull()
  })

  it('dit « Aucun film encore » à zéro, jamais « 0 film »', () => {
    expect(compteAccueil(0)).toBe('Aucun film encore')
  })

  it('accorde au singulier pour un seul film', () => {
    expect(compteAccueil(1)).toBe('1 film cette année')
  })

  it('accorde au pluriel au-delà', () => {
    expect(compteAccueil(12)).toBe('12 films cette année')
  })
})
