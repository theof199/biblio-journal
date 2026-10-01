import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appliquerTheme, ecrireTheme, lireTheme } from './theme'

describe('le réglage du thème', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })
  afterEach(() => vi.restoreAllMocks())

  it('est « auto » tant que rien n’a été choisi', () => {
    expect(lireTheme()).toBe('auto')
  })

  it('se retrouve après l’avoir écrit', () => {
    ecrireTheme('sombre')
    expect(lireTheme()).toBe('sombre')
  })

  it('retombe sur « auto » devant une valeur inconnue', () => {
    localStorage.setItem('journal.theme', 'violet')
    expect(lireTheme()).toBe('auto')
  })

  it('pose le choix sur <html>', () => {
    appliquerTheme('clair')
    expect(document.documentElement).toHaveAttribute('data-theme', 'clair')
    appliquerTheme('sombre')
    expect(document.documentElement).toHaveAttribute('data-theme', 'sombre')
  })

  it('ôte l’attribut pour « auto » : la feuille suit alors le téléphone', () => {
    appliquerTheme('sombre')
    appliquerTheme('auto')
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('survit à un stockage qui lève, en lecture comme en écriture', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('stockage refusé')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('stockage refusé')
    })
    expect(lireTheme()).toBe('auto')
    expect(() => ecrireTheme('clair')).not.toThrow()
  })
})
