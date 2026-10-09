import type { ReactNode } from 'react'
import { MOTS_DE_LA_SACOCHE as M } from './sacoche'
import styles from './Ticket.module.css'

interface Props {
  /** Un élément de liste dans le portefeuille, une ligne dans un bouton (le billet du bas d'une gare). */
  balise?: 'li' | 'span'
  /** L'année où le ticket mène. */
  annee: number
  /** Le ticket a servi : il pâlit. */
  utilise: boolean
  /** Ce qu'il dit sous son millésime : son jour, ou son motif. */
  sous?: ReactNode
  /** Ce qu'il porte à droite : le geste dans le portefeuille, le tampon au bas d'une gare. */
  children?: ReactNode
}

/**
 * Le ticket d'une année des pages 1900 (maquette, écran 15 : `.tk`, `.tk.utilise`) : le carton, sa bande
 * rouge, « Ticket pour » et le millésime ; utilisé, il pâlit. Un seul dessin pour le portefeuille de la
 * sacoche et le billet utilisé au bas d'une gare : il n'offre rien de lui-même, son site lui passe ce
 * qu'il porte à droite. Rien n'y bouge.
 */
export default function Ticket({ balise: Balise = 'li', annee, utilise, sous, children }: Props) {
  return (
    <Balise className={styles.tk} data-utilise={utilise ? 'oui' : 'non'}>
      <span className={styles.texte}>
        <small>{M.portefeuille.pour}</small>
        <b>{annee}</b>
        {sous ? <em>{sous}</em> : null}
      </span>
      {children}
    </Balise>
  )
}
