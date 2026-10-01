import type { CSSProperties } from 'react'
import { decennieDeAnnee } from './fronton'
import { lignesDeTitre, longueurDeLecture } from './titre'
import styles from './SigneDeFilm.module.css'

/** Au-delà, le titre d'une vignette passe sur deux lignes : elle est trois fois plus étroite que le fronton. */
const LONGUEUR_TITRE_GRAND = 6

const longueur = (valeur: number): CSSProperties => ({ '--longueur': valeur }) as CSSProperties

/**
 * Le titre d'un film sans affiche, en petite enseigne de sa décennie : le fond, l'encre, la police et
 * le relief du fronton (`theme.css`, `data-decennie`), dessinés à la taille du fronton puis réduits à
 * celle d'une vignette. Le titre y tient comme au fronton : une ligne s'il est court, deux lignes
 * équilibrées sinon. L'enseigne est une image nommée par le titre, dont les lignes ne se relisent pas.
 */
export default function SigneDeFilm({ titre, annee }: { titre: string; annee: number | null | undefined }) {
  const lignes = lignesDeTitre(titre, LONGUEUR_TITRE_GRAND)
  const lecture = longueurDeLecture(lignes)

  return (
    <div className={styles.echelle} data-decennie={decennieDeAnnee(annee)} role="img" aria-label={titre}>
      <div className={styles.panneau}>
        {lignes.map((ligne) => (
          <div
            key={ligne.texte}
            className={`${styles.titre} ${ligne.compacte ? styles.compacte : styles.grande}`}
            style={longueur(ligne.compacte ? lecture : ligne.texte.length)}
            data-texte={ligne.texte}
          >
            {ligne.texte}
          </div>
        ))}
      </div>
    </div>
  )
}
