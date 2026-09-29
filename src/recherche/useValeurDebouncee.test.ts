import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useValeurDebouncee } from './useValeurDebouncee'

describe('useValeurDebouncee', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('ne répercute pas la valeur avant 300 ms', () => {
    const { result, rerender } = renderHook(({ v }) => useValeurDebouncee(v), { initialProps: { v: 'i' } })
    rerender({ v: 'in' })
    act(() => vi.advanceTimersByTime(299))
    expect(result.current).toBe('i')
  })

  it('répercute la valeur une fois le délai écoulé', () => {
    const { result, rerender } = renderHook(({ v }) => useValeurDebouncee(v), { initialProps: { v: 'i' } })
    rerender({ v: 'in' })
    act(() => vi.advanceTimersByTime(300))
    expect(result.current).toBe('in')
  })

  // Mutation : sans le `clearTimeout` du délai précédent, taper « i », « in », « inc » en moins de
  // 300 ms produirait deux valeurs répercutées (« in » puis « inc ») au lieu d'une seule.
  it('une nouvelle frappe repousse le délai plutôt que de l’empiler', () => {
    const { result, rerender } = renderHook(({ v }) => useValeurDebouncee(v), { initialProps: { v: 'i' } })
    rerender({ v: 'in' })
    act(() => vi.advanceTimersByTime(200))
    rerender({ v: 'inc' })
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe('i')
    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe('inc')
  })
})
