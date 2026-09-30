import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Y a-t-il, derrière l'entrée affichée, une entrée de l'app ? La clé `default` est celle de la
 * toute première entrée, que l'app n'a pas poussée ; `idx`, que React Router pose dans
 * `history.state`, écarte une première entrée remplacée (une redirection à l'ouverture). Un
 * routeur en mémoire (les tests) n'écrit pas `history.state` : la clé seule tranche.
 */
export function historiqueDerriere(cle: string): boolean {
  if (cle === 'default') return false
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  return typeof idx !== 'number' || idx > 0
}

/**
 * Le geste « retour » d'une page sans onglet : reculer dans l'historique dès qu'il y a de quoi,
 * comme le geste du téléphone (la page retrouvée l'est à sa position, `coque/defilement.ts`) ;
 * sinon, aller à `vers` avec `etat`. Une navigation nouvelle vers `vers` quand l'historique la
 * porte déjà empilerait la page quittée derrière elle : le geste du téléphone y ramènerait.
 */
export function useRevenir(vers?: string, etat?: unknown): () => void {
  const naviguer = useNavigate()
  const { key } = useLocation()
  return () => (vers && !historiqueDerriere(key) ? naviguer(vers, { state: etat }) : naviguer(-1))
}
