import { Link } from 'react-router-dom'
import Affiche from '../ui/Affiche'
import styles from './CarrouselEnsuite.module.css'
import type { CandidatFilm } from '../formulaire/candidat'

/**
 * Une carte « Ensuite » (reprise de `CarrouselEnsuite`, `HomeScreen.kt`) : ce qu'il reste à voir,
 * en dehors du journal — Plex, ou le prochain film d'un réalisateur ou d'une saga suivis en cours
 * (`accueil/ensuite.ts`). `libelle` porte la distinction : « Ensuite » pour Plex, « Ensuite · {nom} »
 * pour une entité suivie (reprise de `LigneEnsuite`, `HomeScreen.kt`).
 */
export default function CarrouselEnsuite({ candidat, libelle }: { candidat: CandidatFilm; libelle: string }) {
  return (
    <Link to="/journal/nouveau" state={{ candidat }} className={styles.carte}>
      <Affiche src={candidat.cover_url} titre={candidat.title} taille="ligne" />
      <div className={styles.texte}>
        <p className={styles.etiquette}>{libelle}</p>
        <p className={styles.titre}>
          {candidat.title}
          {candidat.year ? ` (${candidat.year})` : ''}
        </p>
      </div>
    </Link>
  )
}
