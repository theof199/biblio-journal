import { useSyncExternalStore } from 'react'

/**
 * L'interrupteur « Masquer les introuvables » des sagas (reprise de `SuivisUi.masquerIntrouvables`,
 * Android) : actif par défaut, partagé entre la page d'une saga et le compte de ses cartes dans la
 * liste des Suivis — c'est un réglage d'affichage, pas une donnée d'une saga. Tenu ici, hors d'un
 * composant, pour survivre à une sortie puis un retour sur la page tant que l'app tourne. Celui de
 * la page d'un réalisateur reste local à cette page (`rememberSaveable`, côté Android).
 */
let masquer = true
const abonnes = new Set<() => void>()

const abonner = (rappel: () => void) => {
  abonnes.add(rappel)
  return () => void abonnes.delete(rappel)
}
const lire = () => masquer

export function basculerMasquerIntrouvables(): void {
  masquer = !masquer
  abonnes.forEach((rappel) => rappel())
}

/** Remet le réglage à son défaut : pour les tests, qui partagent le module. */
export function reinitialiserMasquerIntrouvables(): void {
  masquer = true
  abonnes.forEach((rappel) => rappel())
}

export const useMasquerIntrouvables = () => useSyncExternalStore(abonner, lire)
