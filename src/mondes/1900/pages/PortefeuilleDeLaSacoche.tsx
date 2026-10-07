import Panne from '../../../ui/Panne'
import { jourDeParis } from '../../../voyage/passeport'
import type { PropsPortefeuille } from '../../../voyage/sacoche/Tickets'
import Rubrique from './Rubrique'
import { libelleDUtiliser, MOTS_DE_LA_SACOCHE as M } from './sacoche'
import styles from './Sacoche.module.css'

/**
 * Le portefeuille de la sacoche des années 1900 (maquette, écran 15 : `.portefeuille`, `.tk`) : un
 * carton par ticket, sa bande rouge, « Ticket pour » et le millésime ; utilisé, il pâlit et dit son
 * jour, à Paris ; sinon son motif, que le défaut dit aussi. « Utiliser », au corail, ne paraît que
 * sur le ticket où la page pose le geste (`utiliser`) : le dessin ne l'offre nulle part ailleurs, ne
 * range ni ne lit rien. Rien n'y bouge.
 */
export default function PortefeuilleDeLaSacoche({ panne, tickets, enCours, refus }: PropsPortefeuille) {
  return (
    <>
      <Rubrique>
        {M.portefeuille.titre} <small>{M.portefeuille.sous}</small>
      </Rubrique>
      {panne ? (
        <div className={styles.panne}>
          <Panne erreur={panne.erreur} onReessayer={panne.reessayer} />
        </div>
      ) : !tickets ? (
        <p className={styles.vide}>{M.portefeuille.attente}</p>
      ) : tickets.length === 0 ? (
        <p className={styles.vide}>{M.portefeuille.vide}</p>
      ) : (
        <ul className={styles.portefeuille}>
          {tickets.map(({ ticket: t, utiliser }) => (
            <li key={t.annee} className={styles.tk} data-utilise={t.utilise_le ? 'oui' : 'non'}>
              <span className={styles.texte}>
                <small>{M.portefeuille.pour}</small>
                <b>{t.annee}</b>
                {t.utilise_le ? (
                  <em>
                    {M.portefeuille.utilise} <time dateTime={t.utilise_le}>{jourDeParis(t.utilise_le)}</time>
                  </em>
                ) : t.motif ? (
                  <em>{t.motif}</em>
                ) : null}
              </span>
              {utiliser ? (
                <button type="button" className={styles.utiliser} disabled={enCours} onClick={utiliser} aria-label={libelleDUtiliser(t.annee)}>
                  {M.portefeuille.utiliser}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {refus ? (
        <p role="alert" className={styles.panne}>
          {refus}
        </p>
      ) : null}
    </>
  )
}
