import Panne from '../../../ui/Panne'
import type { PropsCoulisses } from '../../../voyage/sacoche/Repli'
import { MOTS_DE_LA_SACOCHE as M } from './sacoche'
import styles from './Sacoche.module.css'

/**
 * Les coulisses de la sacoche des années 1900 (maquette, écran 15 : `.coulisses`) : un casier fermé
 * au bas de la sacoche, que son titre ouvre. Dépliées : les dépenses au chroniqueur, une ligne par
 * mois (absentes tant que la page n'en passe pas : avant la réponse, et pour tout membre hors du
 * compte IA), leur panne, et les crédits des images. Le pli est celui de la page : le dessin ne lit
 * rien et ne retient rien. Rien n'y bouge.
 */
export default function CoulissesDeLaSacoche({ ids, depliees, basculer, panneDesDepenses, depenses, credits }: PropsCoulisses) {
  return (
    <div className={styles.coulisses}>
      <h2 id={ids.titre}>
        <button type="button" aria-expanded={depliees} aria-controls={depliees ? ids.contenu : undefined} onClick={basculer}>
          <span>{M.coulisses.titre}</span>
          <span className={styles.pli} aria-hidden="true">
            {depliees ? '▾' : '▸'}
          </span>
        </button>
      </h2>
      {depliees ? (
        <div id={ids.contenu} className={styles.contenu}>
          {panneDesDepenses || depenses ? (
            <section aria-label={M.coulisses.depenses}>
              <h3>{M.coulisses.depenses}</h3>
              {panneDesDepenses ? (
                <div className={styles.panne}>
                  <Panne erreur={panneDesDepenses.erreur} onReessayer={panneDesDepenses.reessayer} />
                </div>
              ) : depenses ? (
                <>
                  <p className={styles.courant}>{depenses.courant}</p>
                  {depenses.precedents.map((l) => (
                    <p key={l}>{l}</p>
                  ))}
                  <p className={styles.note}>{M.coulisses.note}</p>
                </>
              ) : null}
            </section>
          ) : null}
          <section aria-label={M.coulisses.credits}>
            <h3>{M.coulisses.credits}</h3>
            {credits.map((groupe) => (
              <div key={groupe.titre} className={styles.groupe}>
                <h4>{groupe.titre}</h4>
                <ul>
                  {groupe.credits.map((c) => (
                    <li key={c.fichier}>
                      <span className={styles.oeuvre}>{c.oeuvre}</span>
                      <span>{c.licence}</span>
                      {c.source ? (
                        <a href={c.source} target="_blank" rel="noreferrer">
                          {`Source : ${c.fichier}`}
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </div>
      ) : null}
    </div>
  )
}
