import { useEffect, useState, type ReactNode } from 'react'
import {
  IconArrowBarToUp,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconFileText,
  IconList,
  IconPlus,
  IconStack2,
  IconUsers,
  type TablerIcon,
} from '@tabler/icons-react'
import Affiche from '../../ui/Affiche'
import Attente, { Barre } from '../../ui/Attente'
import Monogramme from '../Monogramme'
import { lireLeRetourDuVu, type EpisodeCoche } from '../retourDuVu'
import MessageDuVu from './MessageDuVu'
import type { Vue } from './vues'
import styles from './Panneau.module.css'

/** Le prochain épisode à voir d'une série. */
export interface EpisodeAVoir {
  saison: number
  numero: number
  titre: string | null
}

/** Une série « en cours », telle que l'écran la montre. */
export interface SerieALEcran {
  /** `media_id`. */
  id: string
  titre: string
  /** L'adresse de la jaquette, prête à afficher, ou rien. */
  affiche: string | null
  /** Son prochain épisode ; `null` : elle est à jour. */
  episode: EpisodeAVoir | null
  /** La ligne du bas, déjà dite (« Regardée hier soir »). */
  quand: string | null
  /** D'une série à jour, le jour de son prochain épisode, déjà dit (« 21 octobre »), s'il est connu. */
  diffusion?: string | null
  /** Rien n'en a été vu : `quand` dit son ajout (« Ajoutée aujourd'hui »), que la liste montre sur sa carte. */
  nouvelle?: boolean
  /** Elle est en pause : hors du parcours des flèches, elle ne vient à l'écran que choisie dans la liste. */
  enPause?: boolean
}

/** Une invitation « vu à deux » qui m'attend. */
export interface InvitationALEcran {
  id: string
  /** Le pseudo de qui propose. */
  de: string
  /** Sa couleur d'identité (`identity_color`) : celle de son monogramme. */
  couleur: string
  serie: string
  episode: EpisodeAVoir
  /** « Proposé hier soir ». */
  quand: string | null
}

/** Ce que montre le petit écran. Une invitation passe avant toute série. */
export type EtatDeLEcran =
  | { etat: 'attente' }
  /** La lecture a échoué : le message de l'API, affichable tel quel, et « Réessayer ». */
  | { etat: 'panne'; message: string }
  /** Aucune série en cours. */
  | { etat: 'vide' }
  /** `rang` sur `sur` : « 1 sur 4 », dans l'ordre du dernier visionnage. */
  | { etat: 'serie'; serie: SerieALEcran; rang: number; sur: number }
  | { etat: 'invitation'; invitation: InvitationALEcran; sur: number }

/** Un avis : un message dans une rangée de touches (un lot noté, un échec, « Proposé à Alycia »), seul sauf s'il se défait. */
export interface Avis {
  /** Change à chaque avis : deux avis de même texte sont deux messages, chacun son temps. */
  cle: number
  texte: string
  /** Un échec. */
  alerte: boolean
  /** De quoi il parle (l'identifiant d'une série ou d'une invitation) : dans la liste, il se pose sur cette carte. */
  sujet?: string
  /** Ce qu'« Annuler » décoche : seul le « vu à deux » qu'on vient de proposer en porte un. */
  annuler?: EpisodeCoche
}

/** Où en est la lecture de la télécommande, pour une vue qui n'est pas le petit écran. */
export type Lecture = { etat: 'attente' } | { etat: 'panne'; message: string } | { etat: 'prete' }

export interface PropsVueTelecommande {
  ecran: EtatDeLEcran
  /** « Réessayer », sur l'écran en panne. */
  onReessayer?: () => void
  /** L'avis à montrer, qui passe devant le retour du « Vu » ; `onAvisParti` : son temps est passé. */
  avis?: Avis | null
  onAvisParti?: () => void
  /** Le compte porté par la touche « En cours », s'il est connu. */
  enCours: number | null
  /** Les touches « Aller à » : passer à une autre vue du panneau. */
  allerA: (vue: Vue) => void
  /** Les flèches. Sans fonction, la touche est éteinte. */
  onPrecedente?: () => void
  onSuivante?: () => void
  /** « Vu » : cocher le prochain épisode de la série à l'écran. `false` : le geste est refusé (une écriture est en cours), aucun message. */
  onVu?: (coche: EpisodeCoche) => boolean | void
  /** « Annuler », dans le message qui suit « Vu ». */
  onAnnulerLeVu?: (coche: EpisodeCoche) => void
  /** Les trois touches de « Cet épisode ». */
  onVuADeux?: (serie: SerieALEcran) => void
  onToutJusquIci?: (serie: SerieALEcran) => void
  onTouteLaSaison?: (serie: SerieALEcran) => void
  /** L'invitation à l'écran. */
  onConfirmer?: (invitation: InvitationALEcran) => void
  onRefuser?: (invitation: InvitationALEcran) => void
}

export const codeDe = (episode: Pick<EpisodeAVoir, 'saison' | 'numero'>) => `S${episode.saison} E${episode.numero}`

/** L'« Annuler » d'un avis qui se défait (« Proposé à Alycia ») : il décoche, et l'avis s'en va. Sinon rien : le message est seul. */
export function annulerLAvis(avis: Avis, { onAnnulerLeVu, onAvisParti }: { onAnnulerLeVu?: (coche: EpisodeCoche) => void; onAvisParti?: () => void }) {
  const coche = avis.annuler
  if (!coche || !onAnnulerLeVu) return undefined
  return () => {
    onAnnulerLeVu(coche)
    onAvisParti?.()
  }
}

/** Une lecture en panne : le message de l'API, tel quel, et « Réessayer », dans un écran du boîtier. */
export function Panne({ message, onReessayer, titre = 'Sans signal' }: { message: string; onReessayer?: () => void; titre?: string }) {
  return (
    <div className={styles.ecran} data-piece="ecran" data-etat="panne" role="alert">
      <p className={styles.etat}>
        <span className={styles.libelle}>{titre}</span>
      </p>
      <p className={styles.panne}>{message}</p>
      <button type="button" className={styles.touche} data-piece="touche" disabled={!onReessayer} onClick={onReessayer}>
        Réessayer
      </button>
    </div>
  )
}

function Pave({ Icone, onClick, children }: { Icone: TablerIcon; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`${styles.touche} ${styles.pave}`} data-piece="touche" disabled={!onClick} onClick={onClick}>
      <Icone aria-hidden="true" className={styles.icone} />
      <span>{children}</span>
    </button>
  )
}

/**
 * La vue d'ouverture du panneau : le petit écran (la série regardée en dernier, ou l'invitation qui
 * attend), la rangée principale (précédente, « Vu », suivante), les trois touches de « Cet épisode »,
 * les trois d'« Aller à », le pied. Elle ne lit rien : tout lui vient de ses propriétés.
 */
export default function VueTelecommande(props: PropsVueTelecommande) {
  const { ecran, enCours, allerA, avis } = props
  const [retour, setRetour] = useState<{ texte: string; coche: EpisodeCoche } | null>(null)

  // Un avis (l'échec du « Vu », surtout) prend la place du retour : « Épisode noté » ne revient pas après lui.
  useEffect(() => {
    if (avis) setRetour(null)
  }, [avis])

  const serie = ecran.etat === 'serie' ? ecran.serie : null
  const invitation = ecran.etat === 'invitation' ? ecran.invitation : null
  const episode = serie?.episode ?? null
  const surSerie = <T,>(action?: (serie: SerieALEcran) => T) => (serie && episode && action ? () => action(serie) : undefined)

  const vu = () => {
    if (!serie || !episode || !props.onVu) return
    const coche: EpisodeCoche = { serieId: serie.id, serie: serie.titre, saison: episode.saison, numero: episode.numero, titre: episode.titre }
    if (props.onVu(coche) === false) return
    setRetour({ texte: lireLeRetourDuVu(coche), coche })
  }

  return (
    <>
      <Ecran ecran={ecran} onReessayer={props.onReessayer} />

      {/* La rangée principale : sa hauteur est fixe, le message y prend la place des touches. */}
      <div className={`${styles.rangee} ${styles.grande}`} data-piece="rangee-principale">
        {avis ? (
          <MessageDuVu key={avis.cle} texte={avis.texte} alerte={avis.alerte} onAnnuler={annulerLAvis(avis, props)} onPartir={() => props.onAvisParti?.()} />
        ) : retour ? (
          <MessageDuVu
            texte={retour.texte}
            onAnnuler={() => {
              props.onAnnulerLeVu?.(retour.coche)
              setRetour(null)
            }}
            onPartir={() => setRetour(null)}
          />
        ) : invitation ? (
          <>
            <button type="button" className={`${styles.touche} ${styles.large}`} data-piece="touche" disabled={!props.onRefuser} onClick={() => props.onRefuser?.(invitation)}>
              Refuser
            </button>
            <button type="button" className={`${styles.touche} ${styles.principale} ${styles.large}`} data-piece="touche-principale" disabled={!props.onConfirmer} onClick={() => props.onConfirmer?.(invitation)}>
              <IconCheck aria-hidden="true" className={styles.icone} />
              Confirmer
            </button>
          </>
        ) : (
          <>
            <button type="button" className={`${styles.touche} ${styles.carree}`} data-piece="touche" aria-label="Série précédente" disabled={!serie || !props.onPrecedente} onClick={props.onPrecedente}>
              <IconChevronLeft aria-hidden="true" className={styles.icone} />
            </button>
            <button
              type="button"
              className={`${styles.touche} ${styles.principale} ${styles.large}`}
              data-piece="touche-principale"
              aria-label={serie && episode ? `Vu : ${serie.titre}, ${codeDe(episode)}` : undefined}
              disabled={!serie || !episode || !props.onVu}
              onClick={vu}
            >
              <IconCheck aria-hidden="true" className={styles.icone} />
              Vu
            </button>
            <button type="button" className={`${styles.touche} ${styles.carree}`} data-piece="touche" aria-label="Série suivante" disabled={!serie || !props.onSuivante} onClick={props.onSuivante}>
              <IconChevronRight aria-hidden="true" className={styles.icone} />
            </button>
          </>
        )}
      </div>

      <p className={styles.libelle} id="telecommande-cet-episode">
        Cet épisode
      </p>
      <div className={`${styles.rangee} ${styles.trois}`} role="group" aria-labelledby="telecommande-cet-episode">
        <Pave Icone={IconUsers} onClick={surSerie(props.onVuADeux)}>
          Vu à deux
        </Pave>
        <Pave Icone={IconArrowBarToUp} onClick={surSerie(props.onToutJusquIci)}>
          Tout jusqu’ici
        </Pave>
        <Pave Icone={IconStack2} onClick={surSerie(props.onTouteLaSaison)}>
          Toute la saison
        </Pave>
      </div>

      <p className={styles.libelle} id="telecommande-aller-a">
        Aller à
      </p>
      <div className={`${styles.rangee} ${styles.trois}`} role="group" aria-labelledby="telecommande-aller-a">
        <Pave Icone={IconList} onClick={() => allerA({ nom: 'en-cours' })}>
          En cours{enCours === null ? null : <> <span className={styles.compte}>{enCours}</span></>}
        </Pave>
        <Pave Icone={IconPlus} onClick={() => allerA({ nom: 'ajouter' })}>
          Ajouter
        </Pave>
        <Pave Icone={IconFileText} onClick={serie ? () => allerA({ nom: 'fiche', serie: serie.id }) : undefined}>
          Fiche
        </Pave>
      </div>
    </>
  )
}

/**
 * Le petit écran. En attente, il garde sa forme : une affiche et deux lignes laissées en blanc. **Il a la
 * même hauteur dans tous ses états** (`.petit` : son sujet a la hauteur d'une affiche, monogramme compris) :
 * une invitation traitée laisse la place à la série sans que les rangées du dessous ne bougent.
 */
function Ecran({ ecran, onReessayer }: { ecran: EtatDeLEcran; onReessayer?: () => void }) {
  if (ecran.etat === 'attente') {
    return (
      <div className={`${styles.ecran} ${styles.petit}`} data-piece="ecran" data-etat="attente">
        <Attente libelle="La télécommande s’allume…" className={styles.fantome}>
          <div className={styles.etat}>
            <Barre largeur="courte" />
          </div>
          <div className={styles.sujet}>
            <Affiche src={null} titre="" taille="ligne" />
            <div className={styles.infos}>
              <Barre largeur="longue" />
              <Barre largeur="moyenne" />
            </div>
          </div>
          <div className={styles.etat}>
            <Barre largeur="moyenne" />
          </div>
        </Attente>
      </div>
    )
  }

  if (ecran.etat === 'panne') return <Panne message={ecran.message} onReessayer={onReessayer} />

  if (ecran.etat === 'vide') {
    return (
      <div className={`${styles.ecran} ${styles.petit}`} data-piece="ecran" data-etat="vide">
        <p className={styles.etat}>
          <span className={styles.libelle}>En cours</span>
        </p>
        <div className={styles.sujet}>
          <Affiche src={null} titre="" taille="ligne" />
          <div className={styles.infos}>
            <h3 className={`${styles.titre} ${styles.entier}`}>Aucune série en cours</h3>
            <p className={styles.doux}>« Ajouter » en cherche une.</p>
          </div>
        </div>
      </div>
    )
  }

  if (ecran.etat === 'invitation') {
    const { invitation, sur } = ecran
    return (
      <div className={`${styles.ecran} ${styles.petit} ${styles.invitation}`} data-piece="ecran" data-etat="invitation">
        <p className={styles.etat}>
          <span className={styles.libelle}>
            <span className={styles.pastille} />
            <b>À confirmer</b>
          </span>
          {sur > 0 ? <span className={styles.libelle}>{sur === 1 ? 'Avant ta série' : `Avant tes ${sur} séries`}</span> : null}
        </p>
        <div className={styles.sujet}>
          <Monogramme pseudo={invitation.de} couleur={invitation.couleur} className={styles.mono} />
          <p className={styles.dit}>
            <b>{invitation.de}</b> a vu{' '}
            <b>
              {invitation.serie} {codeDe(invitation.episode)}
            </b>{' '}
            avec toi
          </p>
        </div>
        {invitation.quand ? (
          <p className={styles.etat}>
            <span className={styles.libelle}>{invitation.quand}</span>
          </p>
        ) : null}
      </div>
    )
  }

  const { serie, rang, sur } = ecran
  return (
    <div className={`${styles.ecran} ${styles.petit}`} data-piece="ecran" data-etat="serie">
      <p className={styles.etat}>
        <span className={styles.libelle}>{serie.enPause ? 'En pause' : 'En cours'}</span>
        {serie.enPause ? null : (
          <span className={styles.libelle}>
            <b>
              {rang} sur {sur}
            </b>
          </span>
        )}
      </p>
      <div className={styles.sujet}>
        <Affiche src={serie.affiche} titre={serie.titre} taille="ligne" />
        <div className={styles.infos}>
          <h3 className={styles.titre}>{serie.titre}</h3>
          {serie.episode ? (
            <p className={styles.episode}>
              <span className={styles.code}>{codeDe(serie.episode)}</span>
              {serie.episode.titre ? <span className={styles.nomEp}>{serie.episode.titre}</span> : null}
            </p>
          ) : (
            <p className={styles.episode}>
              <span className={styles.code}>À jour</span>
              {serie.diffusion ? <span className={styles.nomEp}>Prochain épisode le {serie.diffusion}</span> : null}
            </p>
          )}
        </div>
      </div>
      {serie.quand ? (
        <p className={styles.etat}>
          <span className={styles.libelle}>{serie.quand}</span>
        </p>
      ) : null}
    </div>
  )
}
