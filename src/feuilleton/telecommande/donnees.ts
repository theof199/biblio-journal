import type { EtatDeLEcran } from './VueTelecommande'

/**
 * Ce que la télécommande sait, tant que le contrat de ses routes n'est pas tiré : rien. **C'est ici que
 * le lot suivant branche l'API** (`GET /me/feuilleton/telecommande`, le « vu à deux ») ; les composants
 * ne lisent que ces deux fonctions et leurs propriétés.
 */

/** Une invitation « vu à deux » m'attend-elle ? Le point rouge du bouton rond et le voyant du panneau. */
export function useInvitationEnAttente(): boolean {
  return false
}

/** Ce que montre la vue d'ouverture : en attente, tant que rien ne se lit. */
export function useEcranDeLaTelecommande(): { ecran: EtatDeLEcran; enCours: number | null } {
  return { ecran: { etat: 'attente' }, enCours: null }
}
