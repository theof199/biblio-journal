import Panne from '../../../ui/Panne'
import type { PropsObjetsDeLaSacoche } from '../../../voyage/sacoche/Objets'
import type { ObjetTrouve } from '../objets'
import { MOTS_DE_LA_CONSIGNE as M, compteDeLaConsigne, nomLuDeLaConsigne, placesDeConsigne } from './consigne'
import Rubrique from './Rubrique'
import styles from './Consigne.module.css'
import sacoche from './Sacoche.module.css'

/** Le dessin d'un objet, tel que le catalogue le porte : ses tracés, dans sa vue de 40 sur 40. Muet : la place dit son nom. */
function Objet({ objet }: { objet: ObjetTrouve }) {
  return (
    <svg viewBox="-20 -20 40 40" aria-hidden="true">
      <g transform={objet.tourne ? `rotate(${objet.tourne})` : undefined}>
        {objet.traits.map((t, k) => (
          <path
            key={k}
            d={t.d}
            fill={t.fond ?? 'none'}
            stroke={t.trait}
            strokeWidth={t.trait ? (t.epais ?? 1) : undefined}
            strokeLinecap={t.rond ? 'round' : undefined}
            strokeDasharray={t.tirets?.join(' ')}
          />
        ))}
      </g>
    </svg>
  )
}

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
                <Objet objet={place.objet} />
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
