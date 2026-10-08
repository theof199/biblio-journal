import type { PropsHoraireDeLAnnee } from '../../../voyage/annee/Horaire'
import { MOTS_DE_L_HORAIRE as M, arriverAvant, ceQueLeGesteAFait, enGareDe, phraseDeLHoraireManque, promesseDeLHoraire } from './horaire'
import Rubrique from './Rubrique'
import styles from './Horaire.module.css'

/**
 * L'horaire de la gare, sous l'indicateur (maquette, écran 14 : `.horaire-prop`) : une affichette de
 * papier, l'échéance servie en titre, et deux talons. Celui qui dit l'état présent est enfoncé et ne
 * fait rien ; l'autre écrit, si le bloc lecteur en passe le geste. **Tenu, il ne dessine rien** : la
 * plaque de la tête (« à l'heure ») et l'indicateur (« Horaire tenu ») le disent. Manqué, une ligne.
 * Rien n'y bouge.
 */
export default function HoraireDeLaGare({ annee, horaire, proposable, onTenir, onRetirer, occupe, vient, erreur }: PropsHoraireDeLAnnee) {
  if (horaire?.etat === 'tenu') return null
  if (horaire?.etat === 'manque') {
    return (
      <section className={styles.horaire} aria-label={M.rubrique}>
        <Rubrique>{M.rubrique}</Rubrique>
        <p className={styles.manque}>
          <b>{M.manque}</b>
          {phraseDeLHoraireManque(horaire.echeance)}
        </p>
      </section>
    )
  }
  const echeance = horaire?.echeance ?? proposable
  // Le bloc lecteur ne monte pas ce dessin sans horaire ni proposition : la ligne ne sert qu'au typage.
  if (echeance === null) return null
  const accepte = horaire !== null
  // Le talon enfoncé dit l'état, et le bloc lecteur ne lui passe aucun geste (« Tenir » ne s'offre que
  // sans horaire, « Sans horaire » qu'accepté). L'autre se dit en attente tant qu'une écriture est
  // partie ; le verrou, lui, est au bloc lecteur.
  const talon = (nom: string, enfonce: boolean, geste: (() => void) | null) => (
    <button
      type="button"
      className={`${styles.talon} ${enfonce ? styles.plein : ''}`}
      aria-pressed={enfonce}
      aria-disabled={!enfonce && occupe ? true : undefined}
      onClick={geste ?? undefined}
    >
      {nom}
    </button>
  )
  return (
    <section className={styles.horaire} aria-label={M.rubrique} aria-busy={occupe}>
      <Rubrique>
        {M.rubrique}
        <small>{M.facultatif}</small>
      </Rubrique>
      <div className={styles.affichette}>
        <p>
          <small>{enGareDe(annee, accepte)}</small>
          <b>{arriverAvant(echeance)}</b>
          {promesseDeLHoraire(annee)}
        </p>
        <div className={styles.talons}>
          {talon(M.tenir, accepte, onTenir)}
          {talon(M.sans, !accepte, onRetirer)}
        </div>
      </div>
      {/* Présente dès le bloc monté, vide : une région d'état ne se lit qu'à son changement. */}
      <p role="status" className={styles.etat}>
        {ceQueLeGesteAFait(vient, annee, horaire?.echeance ?? null)}
      </p>
      {erreur ? (
        <p role="alert" className={styles.erreur}>
          {erreur}
        </p>
      ) : null}
    </section>
  )
}
