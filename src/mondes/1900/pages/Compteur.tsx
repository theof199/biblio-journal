import { useMouvementReduit } from '../../../ui/mouvement'
import type { PropsCordeDAnnee } from '../../../voyage/annee/Corde'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import { gainDe, phraseDuCompteur, venuesDArriver } from './lignes'
import styles from './Indicateur.module.css'

/**
 * Le compteur des arrivées, à la place de la corde des billets (maquette, écran 14 : `.r-compteur`) :
 * la molette porte le nombre d'arrivées de l'indicateur. Au retour d'un billet, un « +1 » monte (le
 * premier gain qui pointe une ligne de l'indicateur), et la molette tourne de l'ancien nombre au
 * nouveau si une ligne vient d'arriver ; au calme, rien ne monte et le nouveau nombre est posé d'un coup.
 */
export default function Compteur({ arrivees, gains, bouclee }: PropsCordeDAnnee) {
  const calme = useMouvementReduit()
  const n = arrivees.filter((a) => a.arrivee).length
  const venues = calme ? 0 : venuesDArriver(arrivees, gains).length
  const gain = calme ? undefined : arrivees.map((a) => gainDe(a, gains)).find((g) => g !== undefined)
  return (
    <p className={styles.compteur} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'}>
      <b className={styles.molette} data-tourne={venues > 0 ? 'oui' : 'non'}>
        {venues > 0 ? (
          <span className={styles.rouleau}>
            <span aria-hidden="true">{n - venues}</span>
            <span>{n}</span>
          </span>
        ) : (
          n
        )}
      </b>
      <span>{phraseDuCompteur(arrivees, bouclee)}</span>
      {gain ? (
        <span className={styles.plus} aria-hidden="true">
          {`+${gain.apres - gain.avant}`}
        </span>
      ) : null}
    </p>
  )
}
