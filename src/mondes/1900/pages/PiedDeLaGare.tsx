import { useState } from 'react'
import { useMouvementReduit } from '../../../ui/mouvement'
import type { PropsLigneDuBas } from '../../../voyage/annee/LigneDuBas'
import { jourDeParis } from '../../../voyage/passeport'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import Action from './Action'
import Carton from './Carton'
import { MOTS_DES_FETES, trajetDuBon } from './fetes'
import { MOTS_DU_PIED as M, dosDuBillet, libelleDuTicket } from './pied'
import Rubrique from './Rubrique'
import Ticket from './Ticket'
import styles from './Pied.module.css'

/**
 * Le bas d'une gare, à la place de la ligne du bas (les derniers écrans de 1900, brief 3 ; la maquette
 * ne le dessine pas, il est fait par analogie). Le ticket qui attend est le « Bon pour » d'une ligne
 * bouclée (écran 13 : le carton Edmondson, `Carton`) et son bouton corail (écran 12 : « Utiliser le
 * ticket de 1906 », `Action`) ; le billet utilisé, le ticket pâli du portefeuille (écran 15 :
 * `.tk.utilise`, `Ticket`), tamponné, qui se retourne ; le mot du jury, une dépêche épinglée
 * (`.depeche`).
 *
 * Il ne lit ni n'écrit rien : l'état vient de la page (`ligneDuBas`, qui ne lui passe le jury qu'au
 * compte IA), comme le geste, son verrou (`occupe`) et le refus de l'API (`erreur`). Le billet ne se
 * retourne en glissant que sous la racine vivante.
 */
export default function PiedDeLaGare({ monde, annee, ligne, onUtiliser, occupe, erreur }: PropsLigneDuBas) {
  const [retourne, setRetourne] = useState(false)
  const calme = useMouvementReduit()
  if (!ligne) return null

  if (ligne.type === 'ticket') {
    return (
      <section aria-label={M.region}>
        <Rubrique>
          {M.titre} <small>{M.attend}</small>
        </Rubrique>
        <div className={styles.bon}>
          <Carton tete={MOTS_DES_FETES.compagnie} titre={`${MOTS_DES_FETES.bon} ${ligne.annee}`} sous={trajetDuBon(annee, ligne.annee)} numero={MOTS_DES_FETES.entree} />
        </div>
        <Action onClick={() => onUtiliser(ligne.annee)} disabled={occupe}>
          {libelleDuTicket(ligne.annee)}
        </Action>
        {erreur ? (
          <p role="alert" className={styles.refus}>
            {erreur}
          </p>
        ) : null}
      </section>
    )
  }

  if (ligne.type === 'billet') {
    // Le jour de Paris, comme au portefeuille de la sacoche : le même ticket ne dit pas deux jours.
    const le = jourDeParis(ligne.utiliseLe)
    return (
      <>
        <Rubrique>
          {M.titre} <small>{M.servi}</small>
        </Rubrique>
        <button
          type="button"
          className={styles.billet}
          style={STYLE_DU_TEMPO}
          data-vivante={calme ? 'non' : 'oui'}
          data-retourne={retourne ? 'oui' : 'non'}
          aria-pressed={retourne}
          onClick={() => setRetourne((r) => !r)}
        >
          <span className={`${styles.face} ${styles.recto}`} aria-hidden={retourne}>
            <Ticket balise="span" annee={ligne.annee} utilise sous={`${M.utilise} ${le}`}>
              <span className={styles.tampon}>{MOTS_DES_FETES.entree}</span>
            </Ticket>
          </span>
          <span className={`${styles.face} ${styles.dos}`} aria-hidden={!retourne}>
            {dosDuBillet(annee, ligne.annee)}
          </span>
        </button>
        <p className={styles.retourner}>{M.retourner}</p>
      </>
    )
  }

  return (
    <section className={styles.depeche} aria-label={monde.pages.mots.jury}>
      <i className={styles.epingle} aria-hidden="true" />
      <small>{M.depeche}</small>
      <em>{monde.pages.mots.jury}</em>
      <p>{`${M.verdict} : ${ligne.motif}`}</p>
    </section>
  )
}
