import Panne from '../../../ui/Panne'
import type { PropsPasseportDeLaSacoche } from '../../../voyage/sacoche/Pages'
import Rubrique from './Rubrique'
import { MOTS_DE_LA_SACOCHE as M } from './sacoche'
import styles from './Sacoche.module.css'

/**
 * Le cadre du passeport dans la sacoche des années 1900 (maquette, écran 15 : `.sec`, `.pages-p`) :
 * sa rubrique, puis les pages **telles que la page les monte**, une par décennie. Il n'en habille
 * aucune : la page des années 1890 y garde le velours de la foire. Sur une colonne, et non deux
 * comme la maquette : le tampon d'une décennie ne se lit pas sous 196 px.
 */
export default function PasseportDeLaSacoche({ panne, pages, sansTampon }: PropsPasseportDeLaSacoche) {
  return (
    <>
      <Rubrique>
        {M.passeport.titre} <small>{M.passeport.sous}</small>
      </Rubrique>
      {panne ? (
        <div className={styles.panne}>
          <Panne erreur={panne.erreur} onReessayer={panne.reessayer} />
        </div>
      ) : pages ? (
        <>
          {sansTampon ? <p className={styles.vide}>{M.passeport.vide}</p> : null}
          <ul className={styles.pages}>
            {pages.map((p) => (
              <li key={p.decennie}>{p.page}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.vide}>{M.passeport.attente}</p>
      )}
    </>
  )
}
