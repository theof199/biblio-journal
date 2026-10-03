import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export const DRAPEAU_RECHARGEMENT = 'journal:morceau-recharge'

/** Vrai si l'on peut recharger : le drapeau est posé, il dira au prochain échec que l'on a déjà essayé. */
function armerLeRechargement(): boolean {
  try {
    if (window.sessionStorage.getItem(DRAPEAU_RECHARGEMENT)) return false
    window.sessionStorage.setItem(DRAPEAU_RECHARGEMENT, '1')
    return true
  } catch {
    // Stockage fermé (navigation privée) : sans drapeau, un rechargement pourrait boucler.
    return false
  }
}

function leverLeDrapeau(): void {
  try {
    window.sessionStorage.removeItem(DRAPEAU_RECHARGEMENT)
  } catch {
    // Le morceau est là : un drapeau qui reste n'empêche que le prochain rechargement, pas la page.
  }
}

/**
 * Charge un morceau de l'app. Un onglet resté ouvert sur une ancienne version demande un morceau
 * au nom haché que le serveur n'a plus : on recharge une fois pour prendre le nouvel `index.html`.
 * Hors ligne et sans cache, le second échec remonte au lieu de recharger sans fin.
 */
export async function chargerMorceau<T>(importer: () => Promise<T>): Promise<T> {
  try {
    const module = await importer()
    leverLeDrapeau()
    return module
  } catch (erreur) {
    if (!armerLeRechargement()) throw erreur
    window.location.reload()
    // La page part : le repli de `Suspense` reste affiché au lieu de montrer une erreur d'une seconde.
    return new Promise<T>(() => {})
  }
}

/** `React.lazy` d'une page, dont l'import passe par `chargerMorceau`. */
export function paresseux<P>(importer: () => Promise<{ default: ComponentType<P> }>): LazyExoticComponent<ComponentType<P>> {
  return lazy(() => chargerMorceau(importer))
}
