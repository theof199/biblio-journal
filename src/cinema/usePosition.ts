import { createContext, useContext, useEffect } from 'react'
import type { Coordonnees } from './distance'

/**
 * Où en est la position du membre, pour trier les salles par distance (README, « Au ciné ») :
 * - `verification` : on ne sait pas encore ce que le navigateur permet ;
 * - `a_demander` : la permission n'est pas tranchée, l'onglet offre « Autoriser » — rien n'est demandé avant ce geste ;
 * - `en_attente` : le navigateur lit la position ;
 * - `indisponible` : refusée, absente ou en échec — on trie par heure seule, sans rien offrir ;
 * - `connue` : les coordonnées sont là.
 */
export type StatutPosition = 'verification' | 'a_demander' | 'en_attente' | 'indisponible' | 'connue'

export interface Position {
  statut: StatutPosition
  /** En mémoire de la page seulement : jamais envoyée dans une requête, jamais écrite dans le navigateur. */
  coordonnees: Coordonnees | null
  /** Lit la permission une fois ; si elle est déjà accordée, lit la position, sans fenêtre ni geste. */
  verifier: () => void
  /** Le geste du membre : demande la position au navigateur, qui pose alors sa question. */
  demander: () => void
}

/** Sans fournisseur (une page montée seule) : rien n'est offert ni lu, le tri se fait par heure. */
const SANS_POSITION: Position = {
  statut: 'indisponible',
  coordonnees: null,
  verifier: () => {},
  demander: () => {},
}

export const ContextePosition = createContext<Position>(SANS_POSITION)

/** La position partagée de l'onglet Au ciné et de la fiche d'un film, qui s'ouvre depuis lui. */
export function usePosition(): Position {
  const position = useContext(ContextePosition)
  const { verifier } = position
  useEffect(() => {
    verifier()
  }, [verifier])
  return position
}
