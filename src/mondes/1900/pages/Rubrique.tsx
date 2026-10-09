import type { MutableRefObject, ReactNode } from 'react'
import styles from './Rubrique.module.css'

/**
 * Le titre d'une rubrique des pages 1900 (maquette : `.sec`), commun à toutes ses sections : un titre
 * de niveau 2 par défaut, de niveau 1 quand c'est celui de la page (le guichet), un paragraphe là où la
 * section n'a pas à paraître au plan de la page. La
 * précision se pose en `<small>`. Avec `cible`, le titre peut recevoir le focus (hors de l'ordre de
 * tabulation) : un dialogue refermé dont le bouton d'ouverture n'existe plus le lui rend.
 */
export default function Rubrique({ balise: Balise = 'h2', cible, children }: { balise?: 'h1' | 'h2' | 'p'; cible?: MutableRefObject<HTMLElement | null>; children: ReactNode }) {
  return (
    <Balise className={styles.sec} tabIndex={cible ? -1 : undefined} ref={cible ? (e: HTMLElement | null) => void (cible.current = e) : undefined}>
      {children}
    </Balise>
  )
}
