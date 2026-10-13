import { useState } from 'react'
import type { Membre } from '../../api/feuilleton'
import { useSession } from '../../session/SessionContext'
import Affiche from '../../ui/Affiche'
import Attente, { Barre } from '../../ui/Attente'
import Monogramme from '../Monogramme'
import { useLesMembres } from './donnees'
import { lireLeDernierChoisi, noterLeDernierChoisi } from './memoire'
import { codeDe, Panne, type Lecture, type SerieALEcran } from './VueTelecommande'
import styles from './Panneau.module.css'

export interface PropsVueADeux {
  /** Où en est la lecture de la télécommande, d'où vient la série. */
  lecture: Lecture
  /** La série dont on propose le prochain épisode ; `null`, ou sans épisode : rien à proposer. */
  serie: SerieALEcran | null
  onReessayer?: () => void
  /** Cocher l'épisode pour moi, puis inviter ce membre. `false` : le geste est refusé (une écriture est en cours). */
  onProposer: (serie: SerieALEcran, membre: Membre) => boolean
  /** Le choix est fait : retour à la télécommande, où le message se dit. */
  onFait: () => void
}

const FANTOMES = 3
const messageDe = (erreur: unknown) => (erreur instanceof Error ? erreur.message : 'Une erreur inattendue est survenue. Réessaie.')

/**
 * Le « vu à deux » : l'épisode à l'écran de la télécommande, et les membres à qui le proposer. C'est
 * cette vue qui lit les membres, à son ouverture (`useLesMembres`) : sans moi, sans les comptes
 * désactivés, **le dernier choisi sur cet appareil en premier, et marqué** (`memoire.ts`). Choisir coche
 * l'épisode pour moi puis invite (`vivante.ts`), et ramène à la télécommande sans attendre la réponse.
 */
export default function VueADeux({ lecture, serie, onReessayer, onProposer, onFait }: PropsVueADeux) {
  const { user } = useSession()
  const membres = useLesMembres()
  const [dernier] = useState(() => lireLeDernierChoisi(user.id))
  const episode = serie?.episode ?? null

  const autres = (membres.data ?? []).filter((membre) => membre.id !== user.id)
  const ranges = [...autres.filter((membre) => membre.id === dernier), ...autres.filter((membre) => membre.id !== dernier)]

  const choisir = (membre: Membre) => {
    if (!serie || !episode || onProposer(serie, membre) === false) return
    noterLeDernierChoisi(user.id, membre.id)
    onFait()
  }

  return (
    <>
      <h2 className={styles.titreVue}>Vu à deux</h2>

      {lecture.etat === 'panne' ? (
        <Panne message={lecture.message} onReessayer={onReessayer} />
      ) : lecture.etat === 'attente' ? (
        <div className={styles.ecran} data-piece="ecran" data-etat="attente">
          <Attente libelle="La télécommande s’allume…" className={styles.fantome}>
            <div className={styles.sujet}>
              <Affiche src={null} titre="" taille="ligne" />
              <div className={styles.infos}>
                <Barre largeur="longue" />
                <Barre largeur="moyenne" />
              </div>
            </div>
          </Attente>
        </div>
      ) : serie && episode ? (
        <div className={styles.ecran} data-piece="ecran" data-etat="serie">
          <div className={styles.sujet}>
            <Affiche src={serie.affiche} titre={serie.titre} taille="ligne" />
            <div className={styles.infos}>
              <p className={styles.libelle}>Tu l’as vu avec qui ?</p>
              <h3 className={styles.titre}>{serie.titre}</h3>
              <p className={styles.episode}>
                <span className={styles.code}>{codeDe(episode)}</span>
                {episode.titre ? <span className={styles.nomEp}>{episode.titre}</span> : null}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className={styles.phrase}>{serie ? `${serie.titre} est à jour : aucun épisode à proposer.` : 'Aucun épisode à proposer : aucune série n’est en cours.'}</p>
      )}

      {lecture.etat !== 'prete' || !serie || !episode ? null : membres.isPending ? (
        <Attente libelle="Les membres arrivent…" className={`${styles.pile} ${styles.serree}`}>
          {Array.from({ length: FANTOMES }, (_, rang) => (
            <div key={rang} className={`${styles.touche} ${styles.membre}`} data-piece="touche">
              <Barre largeur="moyenne" />
            </div>
          ))}
        </Attente>
      ) : membres.isError ? (
        <Panne message={messageDe(membres.error)} onReessayer={() => void membres.refetch()} />
      ) : ranges.length === 0 ? (
        <p className={styles.phrase}>Personne d’autre ici pour l’instant : il n’y a personne à qui le proposer.</p>
      ) : (
        <ul className={`${styles.pile} ${styles.serree}`} aria-label="À qui le proposer">
          {ranges.map((membre) => (
            <li key={membre.id}>
              <button type="button" className={`${styles.touche} ${styles.membre}`} data-piece="touche" data-dernier={membre.id === dernier ? '' : undefined} onClick={() => choisir(membre)}>
                <Monogramme pseudo={membre.pseudo} couleur={membre.identity_color} className={styles.mono} />
                <span className={styles.pseudo}>{membre.pseudo}</span>
                {membre.id === dernier ? <span className={`${styles.libelle} ${styles.dernier}`}>La dernière fois</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
