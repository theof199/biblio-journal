import type { Billet } from '../annee'
import styles from './Corde.module.css'

/** Le nom complet d'un billet, pour qui ne le voit pas : « 3 films vus », « 1 essentiel sur 5 », « Aucun essentiel encore ». */
export const nomDuBillet = (b: Billet): string =>
  [b.valeur === null ? null : String(b.valeur), b.libelle, b.total === null ? null : `sur ${b.total}`].filter(Boolean).join(' ')

/**
 * Les billets suspendus à la corde (maquette 1890 : `.corde`, `billetsCorde`) : la valeur en grand,
 * le total en petit, le libellé dessous. Ils se balancent, sauf au calme (la feuille s'en charge).
 */
export default function Corde({ billets, nom = 'La progression de l’année' }: { billets: readonly (Billet & { tete?: string })[]; nom?: string }) {
  return (
    <ul className={styles.corde} aria-label={nom}>
      {billets.map((b) => (
        <li key={b.cle} className={styles.billet} aria-label={nomDuBillet(b)}>
          <span aria-hidden="true">
            {b.tete ? <span className={styles.num}>{b.tete}</span> : null}
            {b.valeur !== null ? (
              <b>
                {b.valeur}
                {b.total !== null ? <small>{`/${b.total}`}</small> : null}
              </b>
            ) : null}
            <span className={styles.libelle}>{b.libelle}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
