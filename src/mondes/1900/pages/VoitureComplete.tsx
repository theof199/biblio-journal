import { useMouvementReduit } from '../../../ui/mouvement'
import type { PropsFeteDeLaSalle } from '../../../voyage/celebrations/DessinDeLaSalle'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import { MOTS_DES_FETES, cartonDeLaVoiture, fenetresDeLaVoiture } from './fetes'
import styles from './Fetes.module.css'
import voies from './Voies.module.css'

/**
 * La voiture complète, à la place du rideau (maquette, écran 13 : `.s-voiture`) : la voiture de la
 * salle à quai, sa voie, les affiches de ses films aux fenêtres (la fenêtre et la plaque sont celles
 * du compartiment, `Voies.module.css`), la dernière qui s'allume, la plaque « Complet » qui tombe,
 * le guidon de départ qui se lève ; puis le carton dit laquelle. Le dessin ne séquence rien : la
 * scène lui dit quand le carton se pose. Au calme, tout est posé.
 */
export default function VoitureComplete({ scene, carton, fini, salle }: PropsFeteDeLaSalle) {
  const calme = useMouvementReduit()
  const dit = cartonDeLaVoiture(scene, carton)
  return (
    <div className={styles.fete} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'}>
      <div className={styles.quai}>
        <i className={styles.guidon} aria-hidden="true" />
        <div className={styles.voiture}>
          {salle ? <p className={styles.voie}>{`Voie ${salle.numero}`}</p> : null}
          <ul className={styles.fenetres} aria-label={salle ? `Les fenêtres de la voiture ${salle.nom}` : undefined} aria-hidden={salle ? undefined : true}>
            {fenetresDeLaVoiture(salle).map((f) => (
              <li key={f.cle}>
                {f.affiche ? (
                  <img className={voies.fenetre} src={f.affiche} alt={f.titre ?? ''} decoding="async" />
                ) : (
                  <span className={`${voies.fenetre} ${voies.vide}`}>{f.titre ?? ''}</span>
                )}
              </li>
            ))}
          </ul>
          <p className={`${voies.plaque} ${voies.occupe} ${styles.complet}`}>{MOTS_DES_FETES.complet}</p>
          <i className={styles.roues} aria-hidden="true" />
        </div>
        <i className={styles.rail} aria-hidden="true" />
      </div>
      {fini ? (
        <>
          <p className={styles.sur}>{dit.sur}</p>
          <p className={styles.titre}>{dit.titre}</p>
          <p className={styles.sous}>{MOTS_DES_FETES.guidon}</p>
        </>
      ) : null}
    </div>
  )
}
