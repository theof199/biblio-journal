import { useMouvementReduit } from '../../../ui/mouvement'
import { NOM_DE_RECOMPENSE } from '../../../voyage/annee/Embleme'
import type { PropsFeteDeLaRecompense } from '../../../voyage/celebrations/DessinDeLaRecompense'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import { FORME_DE_L_ETIQUETTE, MOTS_DES_FETES, placeDeLEtiquette } from './fetes'
import styles from './Fetes.module.css'

/**
 * L'étiquette de malle, à la place de la presse à médailles (maquette, écran 13 : `.s-recompense`) :
 * la malle porte les étiquettes des années d'avant, que la scène a lues de la carte ; le pinceau
 * passe la colle, puis l'étiquette de l'année tombe à sa place au pas de la frappe, et son nom se
 * dit. Le dessin ne lit ni ne séquence rien. Au calme, l'étiquette est collée et le pinceau absent.
 */
export default function EtiquetteDeMalle({ scene, pas, fini, nom, motif, passees }: PropsFeteDeLaRecompense) {
  const calme = useMouvementReduit()
  return (
    <div className={styles.fete} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'}>
      <div className={styles.malle}>
        <i className={styles.coin} aria-hidden="true" />
        <i className={styles.coin} aria-hidden="true" />
        <i className={styles.coin} aria-hidden="true" />
        <i className={styles.coin} aria-hidden="true" />
        <ul aria-label={MOTS_DES_FETES.malle}>
          {passees.map((p, i) => {
            const place = placeDeLEtiquette(i)
            return (
              <li key={p.annee} className={`${styles.etiquette} ${styles.passee}`} data-forme={FORME_DE_L_ETIQUETTE[p.recompense]} style={{ left: place.left, top: place.top, transform: `rotate(${place.angle}deg)` }}>
                <b>{NOM_DE_RECOMPENSE[p.recompense]}</b>
                <small>{p.annee}</small>
              </li>
            )
          })}
          {pas >= 1 ? (
            <li className={`${styles.etiquette} ${styles.neuve}`} data-forme={FORME_DE_L_ETIQUETTE[scene.recompense]} data-neuve="oui">
              <em>{MOTS_DES_FETES.compagnie}</em>
              <b>{NOM_DE_RECOMPENSE[scene.recompense]}</b>
              <small>{scene.annee}</small>
            </li>
          ) : null}
        </ul>
        <i className={styles.colle} aria-hidden="true" />
        {calme ? null : <i className={styles.pinceau} aria-hidden="true" />}
      </div>
      {fini ? (
        <>
          <p className={styles.titre}>{nom}</p>
          <p className={styles.sous}>{motif}</p>
        </>
      ) : null}
    </div>
  )
}
