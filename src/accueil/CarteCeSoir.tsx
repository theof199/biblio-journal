import { Link } from 'react-router-dom'
import Affiche from '../ui/Affiche'
import styles from './CarteCeSoir.module.css'
import type { SeancePrise } from '../api/voyage'

/**
 * « Ce soir » (reprise de `CarteCeSoir.kt`) : la séance prise dans le Voyage, tant que son long
 * n'est pas encore vu. Mène à l'onglet Voyage — la fiche d'année n'existe pas encore ici (plan de
 * la carte, en cours dans un autre lot).
 */
export default function CarteCeSoir({ seance }: { seance: SeancePrise }) {
  return (
    <Link to="/voyage" className={styles.carte}>
      <Affiche src={seance.long.cover_url} titre={seance.long.title} taille="ligne" />
      <div className={styles.texte}>
        <p className={styles.etiquette}>Ce soir</p>
        <p className={styles.titre}>{seance.long.title}</p>
        {seance.court ? <p className={styles.court}>+ {seance.court.title} · court</p> : null}
        <p className={styles.annee}>Voyage {seance.annee}</p>
      </div>
    </Link>
  )
}
