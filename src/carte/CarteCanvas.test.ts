import { afterEach, describe, expect, it, vi } from 'vitest'
import { fabriqueReelle } from './CarteCanvas'
import type { Dependances } from './moteur'

const vu = vi.hoisted(() => ({ deps: null as unknown }))

vi.mock('./moteur', () => ({
  MoteurCarte: class {
    constructor(_canvas: unknown, _rappels: unknown, deps: unknown) {
      vu.deps = deps
    }
  },
}))

describe('le vrai moteur', () => {
  afterEach(() => vi.useRealTimers())

  // Relecture de la tâche 9 (idée 3, le jour et la nuit de l'heure réelle). Mutations : une heure
  // fixe (`heure: () => 12`) ; les minutes oubliées ; l'heure lue une fois pour toutes à la
  // fabrication du moteur au lieu de l'être à chaque image.
  it('lit l’heure de l’appareil, minutes comprises, à chaque demande', () => {
    fabriqueReelle(document.createElement('canvas'), {} as never)
    const deps = vu.deps as Dependances
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 29, 21, 30))
    expect(deps.heure()).toBe(21.5)
    vi.setSystemTime(new Date(2026, 8, 30, 6, 45))
    expect(deps.heure()).toBe(6.75)
  })
})
