import { afterEach, describe, expect, it, vi } from 'vitest'
import { vibrer } from './haptique'

describe('vibrer', () => {
  afterEach(() => {
    delete (navigator as { vibrate?: unknown }).vibrate
  })

  // Mutation : appeler `navigator.vibrate` sans garde lève sur iPhone (et dans jsdom).
  it('ne lève pas là où le navigateur ne vibre pas', () => {
    expect('vibrate' in navigator).toBe(false)
    expect(() => vibrer(20)).not.toThrow()
  })

  it('vibre là où le navigateur le sait', () => {
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    vibrer([10, 40, 10])
    expect(vibrate).toHaveBeenCalledWith([10, 40, 10])
  })
})
