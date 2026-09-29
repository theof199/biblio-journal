import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMouvementReduit } from './mouvement'

function reglage(initial: boolean) {
  const ecouteurs = new Set<() => void>()
  const mq = {
    matches: initial,
    addEventListener: (_: string, f: () => void) => ecouteurs.add(f),
    removeEventListener: (_: string, f: () => void) => ecouteurs.delete(f),
  }
  vi.stubGlobal('matchMedia', () => mq)
  return (v: boolean) => {
    mq.matches = v
    ecouteurs.forEach((f) => f())
  }
}

describe('useMouvementReduit', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('vaut faux sans `matchMedia` (jsdom)', () => {
    expect(renderHook(() => useMouvementReduit()).result.current).toBe(false)
  })

  // Mutation : lire `matches` une fois au montage sans s'abonner.
  it('suit le réglage quand il change en cours de route', () => {
    const changer = reglage(false)
    const { result } = renderHook(() => useMouvementReduit())
    expect(result.current).toBe(false)
    act(() => changer(true))
    expect(result.current).toBe(true)
  })
})
