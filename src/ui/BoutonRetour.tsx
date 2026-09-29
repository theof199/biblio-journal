import { IconArrowLeft } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import styles from './BoutonRetour.module.css'

interface Props {
  /** Chemin explicite plutôt que l'historique — utile depuis une page qu'on peut atteindre sans passer par la précédente. */
  vers?: string
  /** L'état de navigation à remettre avec `vers` : une page qui vit de son état (la fiche) ne se retrouve pas sans lui. */
  etat?: unknown
}

/** Le retour des pages sans onglet (recherche, formulaire, fiche) : la barre reste visible, celui-ci en tient lieu. */
export default function BoutonRetour({ vers, etat }: Props) {
  const naviguer = useNavigate()
  const revenir = () => (vers ? naviguer(vers, { state: etat }) : naviguer(-1))

  return (
    <button type="button" onClick={revenir} className={styles.bouton} aria-label="Retour">
      <IconArrowLeft aria-hidden="true" className={styles.icone} />
    </button>
  )
}
