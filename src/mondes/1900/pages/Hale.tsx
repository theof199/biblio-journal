import type { PropsProjection } from '../../../voyage/film/Projection'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import { libelleDeLaVoiture } from './hale'
import styles from './Hale.module.css'

/**
 * La fausse voiture d'un Hale's Tours, à la place de la projection (maquette, écran 5 : `.hale`) : la
 * caisse de bois, les banquettes et leurs voyageurs de dos, le faisceau, et l'écran au bout de
 * l'allée, qui porte l'image que la page a chargée (le fond du film, sinon son affiche) et reste
 * blanc de lumière tant qu'elle manque. Une seule image : la maquette en alterne deux, le contrat n'en
 * sert qu'une.
 *
 * L'écran et les banquettes tanguent, le faisceau scintille ; au calme, rien ne bouge :
 * `data-vivante` porte seul les animations de la feuille.
 */
export default function Hale({ film, image, calme }: PropsProjection) {
  return (
    <div className={styles.hale} role="img" aria-label={libelleDeLaVoiture(film.title)} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'}>
      <div className={styles.faisceau} />
      <div className={styles.ecran} style={image ? { backgroundImage: `url(${JSON.stringify(image.src)})` } : undefined} />
      <div className={styles.caisse} />
      <div className={styles.banquettes} />
    </div>
  )
}
