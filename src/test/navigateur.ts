import { vi } from 'vitest'

type EtatPermission = 'granted' | 'prompt' | 'denied'

interface Reglages {
  /** `undefined` : le navigateur n'a pas `navigator.geolocation`. */
  geolocation?: { reponse: 'position' | 'refus' | 'jamais'; latitude?: number; longitude?: number }
  /** `undefined` : pas d'API Permissions ; `'erreur'` : `query` rejette. */
  permission?: EtatPermission | 'erreur'
}

/**
 * Pose `navigator.geolocation` et `navigator.permissions` doublés (jsdom n'en a aucun) et rend les
 * espions : de quoi prouver ce qui a été demandé, et quand. `retirer()` remet jsdom tel qu'il était.
 */
export function simulerNavigateur({ geolocation, permission }: Reglages) {
  const getCurrentPosition = vi.fn((succes: PositionCallback, echec?: PositionErrorCallback | null) => {
    if (geolocation?.reponse === 'position') {
      succes({ coords: { latitude: geolocation.latitude ?? 0, longitude: geolocation.longitude ?? 0 } } as GeolocationPosition)
    } else if (geolocation?.reponse === 'refus') {
      echec?.({ code: 1, message: 'refusé' } as GeolocationPositionError)
    }
  })
  const query = vi.fn(() =>
    permission === 'erreur' ? Promise.reject(new TypeError('geolocation non géré')) : Promise.resolve({ state: permission }),
  )
  if (geolocation) Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
  if (permission) Object.defineProperty(navigator, 'permissions', { value: { query }, configurable: true })
  const retirer = () => {
    Reflect.deleteProperty(navigator, 'geolocation')
    Reflect.deleteProperty(navigator, 'permissions')
  }
  return { getCurrentPosition, query, retirer }
}
