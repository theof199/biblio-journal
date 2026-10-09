import Panne from '../../../ui/Panne'
import type { PropsBobinesDeLaSacoche } from '../../../voyage/sacoche/Bobines'
import Rubrique from './Rubrique'
import { MOTS_DES_BOBINES as M, compteDesBobines, decennieDite } from './retrouvees'
import styles from './Bobines.module.css'
import sacoche from './Sacoche.module.css'

/** La boîte de film, vue de dessus (la bobine de la carte, maquette : `.bobine::before`) : le fer, sa gorge, ses trois jours, son moyeu. Ses teintes sont dans la feuille. */
function Boite() {
  return (
    <svg viewBox="-20 -20 40 40" aria-hidden="true">
      <circle r="17" />
      <circle r="12.5" />
      <circle cx="0" cy="-7.5" r="3.2" />
      <circle cx="6.5" cy="3.75" r="3.2" />
      <circle cx="-6.5" cy="3.75" r="3.2" />
      <circle r="1.8" />
    </svg>
  )
}

/**
 * Les bobines retrouvées dans la sacoche des années 1900 : une ligne par place, dans l'ordre que le
 * bloc passe (les mondes traversés, la foire d'abord). Retrouvée, la boîte de film porte son
 * étiquette : le titre et qui l'a tourné, **tels que le fichier de son monde les dit**, et
 * « Nouvelle » si elle l'est ; sinon la place en pointillé, « à trouver », sans rien qui la nomme (le
 * bloc ne passe d'elle que sa décennie). Par analogie avec les objets trouvés : la maquette ne
 * dessine pas cette rubrique. Le dessin ne lit ni n'écrit rien ; on ne ramasse rien ici. Rien n'y bouge.
 */
export default function BobinesDeLaSacoche({ panne, places }: PropsBobinesDeLaSacoche) {
  return (
    <>
      <Rubrique>
        {M.titre} {places ? <small>{compteDesBobines(places)}</small> : null}
      </Rubrique>
      {panne ? (
        <div className={sacoche.panne}>
          <Panne erreur={panne.erreur} onReessayer={panne.reessayer} />
        </div>
      ) : places ? (
        <ul className={styles.boites}>
          {places.map((place, rang) => (
            // L'ordre des places est celui des mondes : il ne change pas d'un rendu à l'autre.
            <li key={rang} data-etat={place.bobine ? 'la' : 'manque'}>
              <Boite />
              <p>
                {place.bobine ? (
                  <>
                    <b>{place.bobine.titre}</b>
                    <span>{place.bobine.qui}</span>
                  </>
                ) : (
                  <i>{M.aTrouver}</i>
                )}
                <small>{decennieDite(place.decennie)}</small>
              </p>
              {place.nouvelle ? <em>{M.nouvelle}</em> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}
