import type { ReactNode } from 'react'
import Panne from '../../ui/Panne'
import type { PanneDeBloc } from '../sacoche'
import commun from './Sacoche.module.css'
import styles from './Passeport.module.css'

/**
 * Ce que reçoit le passeport de la sacoche, par défaut ou du monde de mon année en cours
 * (`GabaritsDesPages.passeportDeLaSacoche`) : le cadre du bloc, son titre et ses états, posés dans la
 * région « Passeport » que `Passeport.tsx` garde d'un monde à l'autre. Les pages lui
 * arrivent **montées**, une par décennie, chacune dessinée par le monde de **sa** décennie
 * (`pageDuPasseport`) : le cadre les pose telles quelles, sans les habiller ni en omettre.
 */
export interface PropsPasseportDeLaSacoche {
  /** La carte est en panne : le bloc le dit, et lui seul. */
  panne: PanneDeBloc | null
  /** Une page par décennie, du départ à celle en cours ; nul tant que la carte n'a pas répondu. */
  pages: readonly { decennie: number; page: ReactNode }[] | null
  /** La carte a répondu sans aucun tampon : jamais vrai avant sa réponse. */
  sansTampon: boolean
}

/**
 * Le passeport par défaut (reprise de `PasseportCard`, Android) : « … » tant que la carte n'a pas
 * répondu ; « Aucun tampon encore » après une réponse sans tampon, jamais avant.
 */
export default function Pages({ panne, pages, sansTampon }: PropsPasseportDeLaSacoche) {
  return (
    <>
      <h2 className={commun.titreSec}>
        Passeport <small>une page par décennie</small>
      </h2>
      {panne ? (
        <div className={commun.panne}>
          <Panne erreur={panne.erreur} onReessayer={panne.reessayer} />
        </div>
      ) : pages ? (
        <>
          {sansTampon ? <p className={commun.vide}>Aucun tampon encore</p> : null}
          <ul className={styles.liste}>
            {pages.map((p) => (
              <li key={p.decennie}>{p.page}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className={commun.vide}>…</p>
      )}
    </>
  )
}
