import { IconArrowLeft } from '@tabler/icons-react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './BoutonRetour.module.css'

interface Props {
  /** Le repli quand l'app n'a rien derrière cette page (ouverte d'un lien, d'un favori) : sinon, c'est l'historique. */
  vers?: string
  /** L'état de navigation à remettre avec `vers` : une page qui vit de son état (la fiche) ne se retrouve pas sans lui. */
  etat?: unknown
}

/**
 * Y a-t-il, derrière l'entrée affichée, une entrée de l'app ? La clé `default` est celle de la
 * toute première entrée, que l'app n'a pas poussée ; `idx`, que React Router pose dans
 * `history.state`, écarte une première entrée remplacée (une redirection à l'ouverture). Un
 * routeur en mémoire (les tests) n'écrit pas `history.state` : la clé seule tranche.
 */
function historiqueDerriere(cle: string): boolean {
  if (cle === 'default') return false
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  return typeof idx !== 'number' || idx > 0
}

/**
 * Le retour des pages sans onglet (recherche, formulaire, fiche) : la barre reste visible, celui-ci
 * en tient lieu. Il recule dans l'historique dès qu'il y a de quoi, comme le geste du téléphone :
 * la page retrouvée l'est à sa position (`coque/defilement.ts`), ce qu'une navigation nouvelle vers
 * `vers` ne ferait pas — elle partirait du haut, et le membre perdrait sa place dans sa liste.
 */
export default function BoutonRetour({ vers, etat }: Props) {
  const naviguer = useNavigate()
  const { key } = useLocation()
  const revenir = () => (vers && !historiqueDerriere(key) ? naviguer(vers, { state: etat }) : naviguer(-1))

  return (
    <button type="button" onClick={revenir} className={styles.bouton} aria-label="Retour">
      <IconArrowLeft aria-hidden="true" className={styles.icone} />
    </button>
  )
}
