import { IconArrowLeft } from '@tabler/icons-react'
import { useRevenir } from './revenir'
import styles from './BoutonRetour.module.css'

interface Props {
  /** Le repli quand l'app n'a rien derrière cette page (ouverte d'un lien, d'un favori) : sinon, c'est l'historique. */
  vers?: string
  /** L'état de navigation à remettre avec `vers` : une page qui vit de son état (la fiche) ne se retrouve pas sans lui. */
  etat?: unknown
}

/**
 * Le retour des pages sans onglet (recherche, formulaire, fiche) : la barre reste visible, celui-ci
 * en tient lieu. Il recule dans l'historique dès qu'il y a de quoi, comme le geste du téléphone :
 * la page retrouvée l'est à sa position (`coque/defilement.ts`), ce qu'une navigation nouvelle vers
 * `vers` ne ferait pas — elle partirait du haut, et le membre perdrait sa place dans sa liste.
 */
export default function BoutonRetour({ vers, etat }: Props) {
  const revenir = useRevenir(vers, etat)

  return (
    <button type="button" onClick={revenir} className={styles.bouton} aria-label="Retour">
      <IconArrowLeft aria-hidden="true" className={styles.icone} />
    </button>
  )
}
