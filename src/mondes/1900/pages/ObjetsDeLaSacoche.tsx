import Panne from '../../../ui/Panne'
import type { PropsObjetsDeLaSacoche } from '../../../voyage/sacoche/Objets'
import DessinDObjet from './DessinDObjet'
import { MOTS_DE_LA_CONSIGNE as M, compteDeLaConsigne, nomLuDeLaConsigne, placesDeConsigne } from './consigne'
import Rubrique from './Rubrique'
import styles from './Consigne.module.css'
import sacoche from './Sacoche.module.css'

/**
 * Les objets trouvés dans la sacoche des années 1900 (maquette, écran 15 : `.trouves`) : dix places de
 * consigne, dans l'ordre des années. Ramassé, l'objet pend à son étiquette de papier, datée de sa
 * gare, sous son nom court ; sinon sa silhouette, l'année de la gare et « à trouver », sans rien qui
 * le nomme. Le compte se dit sur le catalogue. Le dessin ne lit ni n'écrit rien :
 * `voyage/sacoche/Objets.tsx` lui passe ce que le serveur sert ; on ne ramasse rien ici. Rien n'y bouge.
 */
export default function ObjetsDeLaSacoche({ panne, objets }: PropsObjetsDeLaSacoche) {
  const places = objets ? placesDeConsigne(objets) : null
  return (
    <>
      <Rubrique>
        {M.titre} {places ? <small>{compteDeLaConsigne(places)}</small> : null}
      </Rubrique>
      {panne ? (
        <div className={sacoche.panne}>
          <Panne erreur={panne.erreur} onReessayer={panne.reessayer} />
        </div>
      ) : places ? (
        <ul className={styles.consigne}>
          {places.map((place) => (
            <li key={place.objet.cle} data-etat={place.ramasse ? 'la' : 'manque'}>
              <span className={styles.place} role="img" aria-label={nomLuDeLaConsigne(place)}>
                <DessinDObjet objet={place.objet} />
                <small>{place.objet.annee}</small>
                <span>{place.ramasse ? place.objet.court : <i>{M.aTrouver}</i>}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}
