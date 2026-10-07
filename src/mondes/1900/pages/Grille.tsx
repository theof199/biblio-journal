import { useId, useState } from 'react'
import type { PropsTeteDuGuichet } from '../../../voyage/recherche/Tete'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import { frontonDuGuichet } from './guichet'
import styles from './Guichet.module.css'

/**
 * La tête du guichet des années 1900 (maquette, écran 11 : `.guichet`, `.fronton`, `.grille`,
 * `.employe`, `.tablette`) : le fronton, la grille de laiton, l'employé derrière elle, et la tablette
 * où l'on demande son film. L'employé paraît à l'ouverture et hoche la tête à chaque lettre ; au
 * calme, il est là et ne bouge pas.
 *
 * Elle ne retient rien de la saisie : le formulaire et le champ sont ceux de la page, posés tels
 * quels (c'est la tablette que la page amène au-dessus du clavier).
 */
export default function Grille({ monde, decennie, calme, retour, guichet, champ }: PropsTeteDuGuichet) {
  const id = useId()
  // Les lettres entendues : chacune rejoue le hochement. Rien ne se compte au calme.
  const [entendues, setEntendues] = useState(0)
  return (
    <div className={styles.tete} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'}>
      {retour}
      <div className={styles.guichet}>
        <p className={styles.fronton}>{frontonDuGuichet(decennie)}</p>
        <div className={styles.grille} aria-hidden="true">
          <div className={styles.employe}>
            <div key={entendues} className={styles.buste} data-ecoute={entendues > 0 ? 'oui' : undefined} />
          </div>
        </div>
        <form {...guichet} className={styles.tablette}>
          <label htmlFor={id}>{monde.pages.mots.recherche.champ}</label>
          <input
            {...champ}
            id={id}
            onChange={(e) => {
              if (!calme) setEntendues((n) => n + 1)
              champ.onChange(e)
            }}
          />
        </form>
      </div>
    </div>
  )
}
