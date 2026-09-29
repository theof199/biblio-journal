import { useId, type CSSProperties, type ReactNode } from 'react'
import type { Monde } from '../mondes/types'
import { useDialogue } from './dialogue'
import styles from './Feuillet.module.css'

interface Props {
  /** L'habillage du monde de l'année : ses jetons. */
  monde: Monde
  titre: string
  onFermer: () => void
  /** Les choix : chaque ligne touchable (bouton, lien) fait 44 px au moins. */
  children: ReactNode
}

/**
 * Le petit calque des choix (une marche, une salle nouvelle, un remplacement, « Mettre sur le
 * podium ») : en bas de l'écran, au-dessus de la barre d'onglets, sur le papier du monde (maquette
 * 1890 : `.feuillet`). Le même dialogue que la feuille du chroniqueur : nommé par son titre, il prend
 * le focus, le rend en se fermant, et se ferme à Échap comme d'un toucher sur le voile.
 */
export default function Feuillet({ monde, titre, onFermer, children }: Props) {
  const fermer = useDialogue<HTMLButtonElement>(onFermer)
  const id = useId()
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof monde.pages.jetons = { ...monde.pages.jetons }

  return (
    <div className={styles.calque} style={style}>
      <div className={styles.voile} onClick={onFermer} aria-hidden="true" />
      <div className={styles.feuillet} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className={styles.tete}>
          <h2 id={id}>{titre}</h2>
          <button ref={fermer} type="button" className={styles.fermer} onClick={onFermer}>
            Fermer
          </button>
        </div>
        <div className={styles.choix}>{children}</div>
      </div>
    </div>
  )
}
