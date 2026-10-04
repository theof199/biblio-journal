import { describe, expect, it } from 'vitest'
import { distanceAffichee, distanceKm } from './distance'

const HALLES = { latitude: 48.8625, longitude: 2.3466 }
const ODEON = { latitude: 48.8527, longitude: 2.3385 }

describe('distanceKm', () => {
  it('est nulle d’un point à lui-même', () => {
    expect(distanceKm(HALLES, HALLES)).toBe(0)
  })

  it('donne la distance à vol d’oiseau : Les Halles – Odéon, un peu plus d’un kilomètre', () => {
    expect(distanceKm(HALLES, ODEON)).toBeCloseTo(1.2, 1)
  })

  it('ne dépend pas du sens', () => {
    expect(distanceKm(ODEON, HALLES)).toBeCloseTo(distanceKm(HALLES, ODEON), 10)
  })

  it('tient les longues distances : Paris – Lyon, environ 392 km', () => {
    expect(distanceKm({ latitude: 48.8566, longitude: 2.3522 }, { latitude: 45.764, longitude: 4.8357 })).toBeCloseTo(392, -1)
  })

  it('compte les degrés de longitude plus courts en latitude élevée : même écart, moins de kilomètres à 60° qu’à l’équateur', () => {
    const alEquateur = distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })
    const a60Degres = distanceKm({ latitude: 60, longitude: 0 }, { latitude: 60, longitude: 1 })
    expect(a60Degres).toBeCloseTo(alEquateur / 2, 0)
  })
})

describe('distanceAffichee', () => {
  it.each([
    [0.45, 'à 450 m'],
    [0.004, 'à 10 m'],
    [1.2, 'à 1,2 km'],
    [1.04, 'à 1,0 km'],
    [9.94, 'à 9,9 km'],
    [12.4, 'à 12 km'],
  ])('%s km se lit « %s »', (km, attendu) => {
    expect(distanceAffichee(km)).toBe(attendu)
  })

  it('passe au kilomètre avant d’écrire mille mètres : 0,999 km se lit « 1,0 km »', () => {
    expect(distanceAffichee(0.999)).toBe('à 1,0 km')
  })

  it('passe aux kilomètres entiers avant d’écrire « 10,0 km » : 9,96 km se lit « 10 km »', () => {
    expect(distanceAffichee(9.96)).toBe('à 10 km')
  })
})
