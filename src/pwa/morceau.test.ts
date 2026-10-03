import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chargerMorceau, DRAPEAU_RECHARGEMENT } from './morceau'

describe('chargerMorceau', () => {
  const recharger = vi.fn()

  beforeEach(() => {
    window.sessionStorage.clear()
    recharger.mockReset()
    vi.stubGlobal('location', { ...window.location, reload: recharger })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const echec = () => Promise.reject(new Error('Failed to fetch dynamically imported module'))

  it('rend le module quand l’import réussit', async () => {
    await expect(chargerMorceau(() => Promise.resolve({ default: 'page' }))).resolves.toEqual({ default: 'page' })
  })

  // Mutation : retirer `leverLeDrapeau()` après l'import réussi.
  it('un import réussi lève le drapeau', async () => {
    window.sessionStorage.setItem(DRAPEAU_RECHARGEMENT, '1')
    await chargerMorceau(() => Promise.resolve({ default: 'page' }))
    expect(window.sessionStorage.getItem(DRAPEAU_RECHARGEMENT)).toBeNull()
  })

  // Mutation : retirer `window.location.reload()`.
  it('un premier échec recharge la page', async () => {
    void chargerMorceau(echec)
    await vi.waitFor(() => expect(recharger).toHaveBeenCalledTimes(1))
  })

  // Mutation : retirer le `setItem` d'`armerLeRechargement`.
  it('un premier échec pose le drapeau avant de recharger', async () => {
    void chargerMorceau(echec)
    await vi.waitFor(() => expect(recharger).toHaveBeenCalled())
    expect(window.sessionStorage.getItem(DRAPEAU_RECHARGEMENT)).toBe('1')
  })

  // Mutation : ne plus lire le drapeau (`getItem`) avant de recharger.
  it('un second échec remonte l’erreur', async () => {
    window.sessionStorage.setItem(DRAPEAU_RECHARGEMENT, '1')
    await expect(chargerMorceau(echec)).rejects.toThrow('Failed to fetch dynamically imported module')
  })

  it('un second échec ne recharge pas', async () => {
    window.sessionStorage.setItem(DRAPEAU_RECHARGEMENT, '1')
    await chargerMorceau(echec).catch(() => undefined)
    expect(recharger).not.toHaveBeenCalled()
  })

  // Mutation : dans le `catch` d'`armerLeRechargement`, rendre `true`.
  it('un stockage qui jette fait remonter l’erreur de l’import', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('fermé', 'SecurityError')
    })
    await expect(chargerMorceau(echec)).rejects.toThrow('Failed to fetch dynamically imported module')
  })

  it('un stockage qui jette ne recharge pas', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('fermé', 'SecurityError')
    })
    await chargerMorceau(echec).catch(() => undefined)
    expect(recharger).not.toHaveBeenCalled()
  })

  it('un stockage qui jette ne casse pas un import réussi', async () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('fermé', 'SecurityError')
    })
    await expect(chargerMorceau(() => Promise.resolve('ok'))).resolves.toBe('ok')
  })
})
