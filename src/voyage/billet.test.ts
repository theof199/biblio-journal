import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { compteDesCartons, decalerJour, initiale, molettes, peutAvancer, raccourci } from './billet'

describe('le dateur', () => {
  // Le changement d'heure n'existe pas en UTC, le fuseau de la CI : le test pose celui du téléphone.
  beforeAll(() => vi.stubEnv('TZ', 'Europe/Paris'))
  afterAll(() => vi.unstubAllEnvs())

  // Mutation : un décalage de 24 h en millisecondes tombe sur le mauvais jour autour du changement d'heure.
  it('franchit les mois, les années et le changement d’heure en jours du calendrier', () => {
    expect(decalerJour('2026-03-01', -1)).toBe('2026-02-28')
    expect(decalerJour('2025-12-31', 1)).toBe('2026-01-01')
    expect(decalerJour('2026-10-25', 1)).toBe('2026-10-26')
    expect(decalerJour('2026-03-30', -1)).toBe('2026-03-29')
  })

  it('montre le jour, le mois d’affiche et l’année', () => {
    expect(molettes('2026-08-05')).toEqual({ jour: '05', mois: 'AOÛT', an: '2026' })
  })

  // Mutation : `<=` laisserait dater un visionnage de demain.
  it('n’avance pas au-delà d’aujourd’hui', () => {
    expect(peutAvancer('2026-09-29', '2026-09-30')).toBe(true)
    expect(peutAvancer('2026-09-30', '2026-09-30')).toBe(false)
  })

  // Mutation : `iso !== aujourdhui` laisserait avancer un jour déjà passé au-delà d'aujourd'hui.
  it('n’avance pas davantage un jour déjà au-delà d’aujourd’hui', () => {
    expect(peutAvancer('2026-10-01', '2026-09-30')).toBe(false)
  })

  it('allume « Aujourd’hui » ou « Hier », sinon rien', () => {
    expect(raccourci('2026-09-30', '2026-09-30')).toBe('aujourdhui')
    expect(raccourci('2026-09-29', '2026-09-30')).toBe('hier')
    expect(raccourci('2026-09-28', '2026-09-30')).toBeNull()
    expect(raccourci('2026-02-28', '2026-03-01')).toBe('hier')
  })
})

describe('les cartons et la cire', () => {
  it('comptent les cartons choisis', () => {
    expect(compteDesCartons(0)).toBe('aucun carton')
    expect(compteDesCartons(1)).toBe('1 carton choisi')
    expect(compteDesCartons(3)).toBe('3 cartons choisis')
  })

  it('scellent de l’initiale du membre', () => {
    expect(initiale(' théo')).toBe('T')
  })
})
