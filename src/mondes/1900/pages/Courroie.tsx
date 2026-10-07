import type { PropsTirette } from '../../../voyage/annee/Manivelle'
import styles from './Courroie.module.css'

/** La sangle au repos, en px, et ce qu'elle gagne par px de course du contenu. */
const AU_REPOS = 30
const PAR_PX = 0.3

/**
 * La courroie de la vitre, à la place de la manivelle dessinée (maquette, écran 14 : `.tirette`,
 * `.recharge`) : la sangle de cuir s'allonge avec le geste, puis un anneau tourne pendant que
 * l'indicateur se relit. Le geste, les seuils et les écouteurs sont ceux de `Manivelle`, qui la monte.
 * Au calme, la sangle ne s'allonge pas et rien ne tourne.
 */
export default function Courroie({ course, charge, calme, texte }: PropsTirette) {
  return (
    <div className={styles.courroie} aria-hidden="true" data-testid="courroie" data-vivante={calme ? 'non' : 'oui'}>
      <span className={styles.sangle} style={{ height: `${AU_REPOS + (calme || charge ? 0 : course * PAR_PX)}px` }} />
      <span className={styles.mot}>
        {charge ? <i className={styles.anneau} /> : null}
        {texte}
      </span>
    </div>
  )
}
