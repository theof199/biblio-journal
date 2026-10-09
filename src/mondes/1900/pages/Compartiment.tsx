import { Link } from 'react-router-dom'
import { MOTS_DES_VOIES } from './voies'
import styles from './Voies.module.css'

interface Props {
  /** L'affiche à la fenêtre ; nulle, la fenêtre dit « sans affiche ». */
  affiche: string | null
  titre: string
  /** Ce qui se lit sous le titre, une ligne par mention : la place, l'état. */
  mentions: string[]
  /** La plaque : occupé ou libre (`plaqueDuCompartiment`). Elle redit l'état en image : le lecteur d'écran lit la mention. */
  plaque: { mot: string; occupe: boolean }
  /** Où le compartiment mène, et comment il se nomme alors ; sans adresse, il ne se touche pas. */
  lien?: { vers: string; nom: string }
}

/**
 * Un compartiment (maquette, écran 4 : `.compart`) : l'affiche à sa fenêtre, le titre et ses mentions,
 * la plaque. Commun à la voiture d'une salle, où un film ouvre sa fiche, et au programme d'un film, où
 * une bobine n'a pas de fiche à elle. Rien n'y bouge.
 */
export default function Compartiment({ affiche, titre, mentions, plaque, lien }: Props) {
  const corps = (
    <>
      {affiche ? <img className={styles.fenetre} src={affiche} alt="" loading="lazy" decoding="async" /> : <span className={`${styles.fenetre} ${styles.vide}`}>{MOTS_DES_VOIES.sansAffiche}</span>}
      <span className={styles.film}>
        {titre}
        {mentions.map((m) => (
          <small key={m}>{m}</small>
        ))}
      </span>
      <span className={`${styles.plaque} ${plaque.occupe ? styles.occupe : ''}`} aria-hidden="true">
        {plaque.mot}
      </span>
    </>
  )
  return lien ? (
    <Link to={lien.vers} className={styles.compartiment} aria-label={lien.nom}>
      {corps}
    </Link>
  ) : (
    <div className={styles.compartiment}>{corps}</div>
  )
}
