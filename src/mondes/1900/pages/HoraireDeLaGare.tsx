import { useEffect, useId, useRef, useState } from 'react'
import type { PropsHoraireDeLAnnee } from '../../../voyage/annee/Horaire'
import { MOTS_DE_L_HORAIRE as M, arriverAvant, ceQueLeGesteAFait, enGareDe, horaireManqueDit, phraseDeLHoraireManque, promesseDeLHoraire } from './horaire'
import Rubrique from './Rubrique'
import styles from './Horaire.module.css'

/**
 * L'horaire de la gare, sous l'indicateur (maquette, écran 14 : `.horaire-prop`) : une affichette de
 * papier, l'échéance servie en titre, et deux talons. Celui qui dit l'état présent est enfoncé et ne
 * fait rien ; l'autre écrit, si le bloc lecteur en passe le geste. **Tenu, il ne dessine rien** : la
 * plaque de la tête (« à l'heure ») et l'indicateur (« Horaire tenu ») le disent. Manqué, une ligne ;
 * manqué sous mes yeux (un refus, la fiche relue), la région d'état le dit et reprend le focus que
 * les talons disparus ont laissé tomber. Rien n'y bouge.
 */
export default function HoraireDeLaGare({ annee, horaire, proposable, onTenir, onRetirer, occupe, vient, erreur }: PropsHoraireDeLAnnee) {
  const precision = useId()
  const region = useRef<HTMLElement>(null)
  const etat = horaire?.etat ?? null
  // Manqué **sous mes yeux** (un refus, puis la fiche relue), pas à l'arrivée sur la page : la région
  // d'état le dit. Et dès que les talons disparaissent sous mes yeux (manqué, ou retiré sans que la
  // fiche ait pu se relire), celui qui portait le focus l'a laissé tomber au document.
  const sansTalon = etat === 'manque' || (horaire === null && proposable === null)
  const [auMontage] = useState({ etat, sansTalon })
  const vientDeManquer = etat === 'manque' && auMontage.etat !== 'manque'
  const talonsPerdus = sansTalon && !auMontage.sansTalon
  useEffect(() => {
    // Le focus tombé au document revient à la région ; ailleurs dans la page, il reste où il est.
    if (talonsPerdus && document.activeElement === document.body) region.current?.focus()
  }, [talonsPerdus])

  if (etat === 'tenu') return null
  const echeance = horaire?.echeance ?? proposable
  // Ni horaire ni proposition : le bloc lecteur ne monte ce dessin que pour dire un retrait dont la
  // fiche n'a pas pu se relire. La phrase seule, sans affichette ni talon.
  if (echeance === null && vient !== 'retire') return null
  const manque = etat === 'manque'
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
  // Un seul nom, « L'horaire », pour la région et pour son titre : « facultatif » se voit dans le titre
  // sans entrer dans son nom, et se lit comme la description de la région.
  const offert = !manque && echeance !== null
  return (
    <section ref={region} tabIndex={-1} className={styles.horaire} aria-label={M.rubrique} aria-describedby={offert ? precision : undefined} aria-busy={manque ? undefined : occupe}>
      <Rubrique>
        {M.rubrique}
        {offert ? (
          <small id={precision} aria-hidden="true">
            {M.facultatif}
          </small>
        ) : null}
      </Rubrique>
      {manque && echeance !== null ? (
        <p className={styles.manque}>
          <b>{M.manque}</b>
          {phraseDeLHoraireManque(echeance)}
        </p>
      ) : echeance !== null ? (
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
      ) : null}
      {/* Présente dès le bloc monté, vide : une région d'état ne se lit qu'à son changement. La même
          d'un état à l'autre (un seul rendu, la même place) : elle dit le geste, ou l'horaire qui vient d'être manqué. */}
      <p role="status" className={styles.etat}>
        {vientDeManquer && horaire ? horaireManqueDit(horaire.echeance) : ceQueLeGesteAFait(vient, annee, horaire?.echeance ?? null)}
      </p>
      {erreur ? (
        <p role="alert" className={styles.erreur}>
          {erreur}
        </p>
      ) : null}
    </section>
  )
}
