import type { ReactNode } from 'react'
import type { MotsDesPages } from '../../mondes/types'
import { passage, type Vue } from '../catalogue'

/**
 * Ce que le guichet dit d'une vue et de son catalogue, commun au dessin par défaut et à celui d'un
 * monde (`GabaritsDesPages.catalogueDuGuichet`) : l'état en clair, le passage souligné, les phrases
 * d'attente et de panne. Sans lecture ni état.
 */

/** L'état d'une vue, en clair (maquette : `etatDe`) ; un film perdu dit le mot du monde. */
export function etatLisible(v: Vue, m: MotsDesPages): string {
  switch (v.etat) {
    case 'vu':
      return v.note !== null ? `vu · ★ ${v.note}` : 'vu'
    case 'sur_le_plex':
      return 'sur ton Plex'
    case 'a_demander':
      return 'à demander'
    case 'demande':
      return 'demandé'
    case 'introuvable':
      return m.introuvable
  }
}

/** Un texte dont le passage que trouve la saisie est souligné ; tel quel s'il n'y est pas. */
export function souligne(texte: string, saisie: string): ReactNode {
  const p = passage(texte, saisie)
  if (!p) return texte
  return (
    <>
      {p.avant}
      <mark>{p.trouve}</mark>
      {p.apres}
    </>
  )
}

/** Sous le titre du catalogue, dès qu'on cherche : « 1 résultat », « 4 résultats ». */
export const compteDesResultats = (n: number): string => `${n} résultat${n > 1 ? 's' : ''}`

/** Tant qu'une fiche du catalogue se lit. */
export const LE_CATALOGUE_SE_CHARGE = 'Le catalogue se charge…'

/** Les fiches du catalogue qui n'ont pas pu être lues : le reste se cherche quand même. */
export const phraseDesPannes = (n: number): string => (n === 1 ? 'Une année n’a pas pu être lue.' : `${n} années n’ont pas pu être lues.`)
