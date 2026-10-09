import { useId, type CSSProperties, type ReactNode, type RefObject } from 'react'
import type { Monde } from '../mondes/types'
import { useDialogue } from './dialogue'
import { gabaritDe } from './gabarit'
import styles from './Feuillet.module.css'

interface Props {
  /** L'habillage du monde de l'année : ses jetons, et le cadre de ses feuillets s'il en dessine un. */
  monde: Monde
  titre: string
  onFermer: () => void
  /** Les choix : chaque ligne touchable (bouton, lien) fait 44 px au moins. */
  children: ReactNode
}

/**
 * Ce que `Feuillet` passe au cadre d'un feuillet, section que le monde peut composer
 * (`GabaritsDesPages.feuillet`). Le dialogue, son nom, le focus, Échap, le voile et la fermeture
 * restent à `Feuillet` : le cadre ne dessine que le papier, son titre et « Fermer ».
 */
export interface PropsCadreDuFeuillet {
  monde: Monde
  titre: string
  /** L'identifiant que le titre porte : c'est par lui que le dialogue se nomme. */
  idDuTitre: string
  /** La référence que le bouton « Fermer » porte : il prend le focus à l'ouverture. */
  fermer: RefObject<HTMLButtonElement>
  onFermer: () => void
  /** Les choix du feuillet, tels que le site les a montés : le cadre les rend sans y toucher. */
  children: ReactNode
}

/** Le cadre par défaut : le papier du monde et sa bordure double (maquette 1890 : `.feuillet`). */
export function Cadre({ titre, idDuTitre, fermer, onFermer, children }: PropsCadreDuFeuillet) {
  return (
    <div className={styles.feuillet}>
      <div className={styles.tete}>
        <h2 id={idDuTitre}>{titre}</h2>
        <button ref={fermer} type="button" className={styles.fermer} onClick={onFermer}>
          Fermer
        </button>
      </div>
      <div className={styles.choix}>{children}</div>
    </div>
  )
}

/**
 * Le petit calque des choix (une marche, une salle nouvelle, un remplacement, « Mettre sur le
 * podium », « Dresser une table ») : en bas de l'écran, au-dessus de la barre d'onglets, sur le papier
 * du monde. Le même dialogue que la feuille du chroniqueur : nommé par son titre, il prend le focus,
 * le rend en se fermant, et se ferme à Échap comme d'un toucher sur le voile. Son cadre est une
 * section que le monde peut composer (`gabarits.feuillet` ; le défaut : `Cadre`).
 */
export default function Feuillet({ monde, titre, onFermer, children }: Props) {
  const fermer = useDialogue<HTMLButtonElement>(onFermer)
  const id = useId()
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof monde.pages.jetons = { ...monde.pages.jetons }
  const LeCadre = gabaritDe(monde, 'feuillet', Cadre)

  return (
    <div className={styles.calque} style={style}>
      <div className={styles.voile} onClick={onFermer} aria-hidden="true" />
      <div className={styles.dialogue} role="dialog" aria-modal="true" aria-labelledby={id}>
        <LeCadre monde={monde} titre={titre} idDuTitre={id} fermer={fermer} onFermer={onFermer}>
          {children}
        </LeCadre>
      </div>
    </div>
  )
}
