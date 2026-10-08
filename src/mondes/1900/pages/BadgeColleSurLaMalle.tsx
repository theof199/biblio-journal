import { useMouvementReduit } from '../../../ui/mouvement'
import type { PropsFeteDuBadge } from '../../../voyage/celebrations/BadgeColle'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import BadgeDeMalle from './BadgeDeMalle'
import MalleDeFete from './MalleDeFete'
import { placeDuBadge } from './fetes'
import styles from './Fetes.module.css'

/**
 * « Étiquette collée » (maquette, écran 13 : `.s-etiquette`) : la malle des fêtes porte les badges
 * collés avant, que la scène a comptés ; le pinceau passe la colle, puis le badge neuf tombe à sa
 * place au premier pas, et son nom se dit : « Étiquette collée », le nom, et **la devise servie** (la
 * maquette y écrit une phrase que le contrat ne sert pas). Le badge est celui de la malle de la
 * sacoche (`BadgeDeMalle`), la malle celle de la récompense (`MalleDeFete`). Le dessin ne lit ni ne
 * séquence rien. Au calme, le badge est collé et le pinceau absent.
 */
export default function BadgeColleSurLaMalle({ scene, pas, fini, sur }: PropsFeteDuBadge) {
  const calme = useMouvementReduit()
  return (
    <div className={styles.fete} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'}>
      <MalleDeFete calme={calme}>
        {scene.deja.map((place, i) => {
          const ou = placeDuBadge(i)
          return (
            <li key={place.numero} className={styles.badge} style={{ left: ou.left, top: ou.top, transform: `rotate(${ou.angle}deg)` }}>
              <BadgeDeMalle place={place} />
            </li>
          )
        })}
        {pas >= 1 ? (
          <li className={`${styles.badge} ${styles.neuve}`} data-neuve="oui">
            <BadgeDeMalle place={scene.place} />
          </li>
        ) : null}
      </MalleDeFete>
      {fini ? (
        <>
          <p className={styles.sur}>{sur}</p>
          <p className={styles.titre}>{scene.place.nom}</p>
          {scene.place.devise === null ? null : <p className={styles.sous}>{scene.place.devise}</p>}
        </>
      ) : null}
    </div>
  )
}
