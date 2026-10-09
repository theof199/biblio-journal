import type { PropsNouvelleSalle } from '../../../voyage/salles/TenteALouer'
import Action from './Action'
import Rubrique from './Rubrique'
import { LigneDeVoie } from './Voie'
import { MOTS_DES_VOIES as M } from './voies'
import styles from './Voies.module.css'

/**
 * La voie à ouvrir, à la place de la tente à louer (les derniers écrans de 1900, brief 4 ; la maquette
 * ne la dessine pas : par analogie avec ses voies, écran 2, `.voie`, et son bouton `.bout-action`). Au
 * repos, une voie en pointillé, la plaque vide, et le bouton corail ; pendant que le chroniqueur écrit,
 * une voie « en travaux » qui dit la demande et que la salle s'écrit, sans rien offrir d'ouvrir ; le
 * guet abandonné, elle le dit et offre de réessayer ; refusée, elle porte le motif du refus.
 *
 * Elle ne lit ni n'écrit rien : la zone, la demande, l'abandon et les deux gestes viennent de
 * `NouvelleSalle`, que `Salles` ne monte qu'au compte IA. Rien n'y bouge.
 */
export default function VoieAOuvrir({ monde, zone, demande, abandon, onOuvrir, onReessayer }: PropsNouvelleSalle) {
  const mots = monde.pages.mots
  const travaux = zone === 'fantome'
  const titre = travaux ? M.travaux : M.aOuvrir
  return (
    <section aria-label={titre}>
      <Rubrique balise="p">
        {titre} <small>{M.aOuvrirSous}</small>
      </Rubrique>
      <div className={styles.voies}>
        <div className={`${styles.voie} ${styles.aOuvrir}`} data-etat={zone}>
          {travaux ? (
            <LigneDeVoie numero={null} nom={demande?.demande} mention={abandon ? null : <span role="status">{mots.salleNeuve.sEcrit}</span>} compte={M.enTravaux} />
          ) : zone === 'refus' ? (
            <LigneDeVoie numero={null} nom={<span role="alert">{demande?.motif ?? M.sansMotif}</span>} mention={M.refusee} />
          ) : (
            <LigneDeVoie numero={null} nom={mots.nouvelleSalle} />
          )}
        </div>
      </div>
      {travaux ? (
        abandon ? (
          <div role="alert" className={styles.suite}>
            <p className={styles.sansReponse}>{M.sansReponse}</p>
            <Action onClick={onReessayer}>{M.reessayer}</Action>
          </div>
        ) : null
      ) : (
        <div className={styles.suite}>
          <Action onClick={onOuvrir}>{mots.salleNeuve.ouvrir}</Action>
        </div>
      )}
    </section>
  )
}
