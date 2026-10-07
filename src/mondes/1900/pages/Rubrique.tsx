import type { ReactNode } from 'react'
import styles from './Rubrique.module.css'

/**
 * Le titre d'une rubrique des pages 1900 (maquette : `.sec`), commun à toutes ses sections : un titre
 * de niveau 2 par défaut, de niveau 1 quand c'est celui de la page (le guichet), un paragraphe là où la
 * section n'a pas à paraître au plan de la page. La
 * précision se pose en `<small>`.
 */
export default function Rubrique({ balise: Balise = 'h2', children }: { balise?: 'h1' | 'h2' | 'p'; children: ReactNode }) {
  return <Balise className={styles.sec}>{children}</Balise>
}
