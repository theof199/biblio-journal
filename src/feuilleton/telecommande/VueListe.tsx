import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { IconCheck, IconChevronDown, IconChevronUp, IconDots, IconPlayerPlay, IconPlus } from '@tabler/icons-react'
import Affiche from '../../ui/Affiche'
import Attente, { Barre } from '../../ui/Attente'
import Monogramme from '../Monogramme'
import { lireLeRetourDuVu, type EpisodeCoche } from '../retourDuVu'
import MessageDuVu from './MessageDuVu'
import { annulerLAvis, codeDe, NoteAJour, Panne, type Avis, type InvitationALEcran, type Lecture, type SerieALEcran } from './VueTelecommande'
import type { Vue } from './vues'
import styles from './Panneau.module.css'

export interface PropsVueListe {
  lecture: Lecture
  /** « À confirmer » : les invitations qui m'attendent, dans l'ordre reçu. */
  invitations: InvitationALEcran[]
  /** « En cours » puis « En pause », dans l'ordre du dernier visionnage. */
  enCours: SerieALEcran[]
  enPause: SerieALEcran[]
  /** L'avis à montrer : sur la carte dont il parle (`sujet`), en tête de la liste sinon. */
  avis?: Avis | null
  onAvisParti?: () => void
  onReessayer?: () => void
  /** Les écritures : celles du petit écran (`vivante.ts`), carte par carte. */
  onVu?: (coche: EpisodeCoche) => boolean | void
  onAnnulerLeVu?: (coche: EpisodeCoche) => void
  /** « Reprendre », la touche d'une carte en pause : la série sort de la pause, rien n'est coché. `false` : le geste est refusé. */
  onReprendre?: (serie: SerieALEcran) => boolean | void
  onConfirmer?: (invitation: InvitationALEcran) => void
  onRefuser?: (invitation: InvitationALEcran) => void
  /** « ⋯ » règle la télécommande sur la série ; « Ajouter une série » mène à l'ajout. */
  allerA: (vue: Vue) => void
}

/** Les deux sections telles qu'elles sont montrées : des identifiants, dans l'ordre. */
interface Ordre {
  enCours: string[]
  enPause: string[]
}

const FANTOMES = 3

/**
 * La liste : « À confirmer » quand il y en a, « En cours », « En pause » repliée, « Ajouter une série ».
 * Elle ne lit rien : tout lui vient de ses propriétés.
 *
 * **Une carte ne se dérobe pas sous le doigt.** Cocher un épisode fait de sa série la plus récente : dans
 * les données elle passe en tête, et sort de « En pause ». La liste, elle, **fige l'ordre montré** au
 * moment du « Vu » : la carte avance sur place (son épisode change, son message prend la place de ses
 * touches), et l'ordre ne suit les données qu'après le départ du message. Si le message part parce qu'on
 * touche ailleurs, l'ordre attend encore la fin de ce geste : ce qu'on est en train de toucher ne bouge
 * pas, et si c'est un autre « Vu », son message tient l'ordre à son tour. Un avis sans carte (« Vu à deux
 * noté », ou l'avis d'une carte de « En pause » repliée) qui chasse ce message rend l'ordre à son départ.
 *
 * **« Reprendre » suit la même règle, d'une section à l'autre.** L'ordre se fige au toucher : la carte
 * reprise reste où elle est, dans « En pause », le temps de la réponse puis de son message (« Reprise », ou
 * l'échec), à la place de ses touches ; au départ du message elle paraît en tête d'« En cours », avec « Vu ».
 */
export default function VueListe(props: PropsVueListe) {
  const { lecture, invitations, enCours, enPause, avis, allerA } = props
  const [retour, setRetour] = useState<{ texte: string; coche: EpisodeCoche } | null>(null)
  const [fige, setFige] = useState<Ordre | null>(null)
  const [deplie, setDeplie] = useState(false)
  const idDeLaPause = useId()

  // La dernière forme connue de chaque série : une carte figée dont la série vient de finir reste lisible.
  const connues = useRef(new Map<string, SerieALEcran>())
  for (const serie of [...enCours, ...enPause]) connues.current.set(serie.id, serie)

  const figees = new Set(fige ? [...fige.enCours, ...fige.enPause] : [])
  const montrer = (ordre: string[] | undefined, vraies: SerieALEcran[]) =>
    ordre ? [...ordre.flatMap((id) => connues.current.get(id) ?? []), ...vraies.filter((serie) => !figees.has(serie.id))] : vraies
  const montre = { enCours: montrer(fige?.enCours, enCours), enPause: montrer(fige?.enPause, enPause) }

  const sujets = new Set([...invitations, ...montre.enCours, ...(deplie ? montre.enPause : [])].map((carte) => carte.id))
  const avisSurCarte = avis?.sujet && sujets.has(avis.sujet) ? avis : null
  const avisSeul = avis && !avisSurCarte ? avis : null

  // Un avis (l'échec du « Vu », surtout) prend la place du retour : « Épisode noté » ne revient pas après lui.
  useEffect(() => {
    if (avis) setRetour(null)
  }, [avis])

  /** Un message tient-il une carte ? Lu par la fin d'un geste, après le rendu qui suit ce geste. */
  const tenu = useRef(false)
  tenu.current = retour !== null || avisSurCarte !== null
  const doigt = useRef(false)
  const aRendre = useRef(false)
  useEffect(() => {
    const pose = () => {
      doigt.current = true
    }
    const leve = () => {
      doigt.current = false
      if (!aRendre.current) return
      aRendre.current = false
      // Après le `click` de ce geste, et le rendu qu'il a pu demander (un autre « Vu » tient l'ordre à son tour).
      window.setTimeout(() => {
        if (!tenu.current) setFige(null)
      }, 0)
    }
    document.addEventListener('pointerdown', pose, true)
    document.addEventListener('pointerup', leve, true)
    document.addEventListener('pointercancel', leve, true)
    return () => {
      document.removeEventListener('pointerdown', pose, true)
      document.removeEventListener('pointerup', leve, true)
      document.removeEventListener('pointercancel', leve, true)
    }
  }, [])
  /** Un message vient de partir : l'ordre suit les données, tout de suite, ou à la fin du geste en cours. */
  const rendreLOrdre = () => {
    if (doigt.current) aRendre.current = true
    else setFige(null)
  }

  const vu = (serie: SerieALEcran) => {
    if (!serie.episode || !props.onVu) return
    const coche: EpisodeCoche = { serieId: serie.id, serie: serie.titre, saison: serie.episode.saison, numero: serie.episode.numero, titre: serie.episode.titre }
    if (props.onVu(coche) === false) return
    setFige({ enCours: montre.enCours.map((carte) => carte.id), enPause: montre.enPause.map((carte) => carte.id) })
    setRetour({ texte: lireLeRetourDuVu(coche), coche })
  }

  const reprendre = (serie: SerieALEcran) => {
    if (!props.onReprendre || props.onReprendre(serie) === false) return
    // Figé dès le toucher : la réponse, qui porte la carte en tête d'« En cours », ne la déplace pas sous le doigt.
    setFige({ enCours: montre.enCours.map((carte) => carte.id), enPause: montre.enPause.map((carte) => carte.id) })
  }

  /** Ce qui prend la place des touches d'une carte, à hauteur égale : l'avis qui parle d'elle, ou le retour de son « Vu ». */
  const messageDe = (id: string): ReactNode => {
    if (avisSurCarte?.sujet === id) {
      return (
        <MessageDuVu
          key={avisSurCarte.cle}
          texte={avisSurCarte.texte}
          alerte={avisSurCarte.alerte}
          onAnnuler={annulerLAvis(avisSurCarte, props)}
          onPartir={() => {
            props.onAvisParti?.()
            rendreLOrdre()
          }}
        />
      )
    }
    if (!avis && retour?.coche.serieId === id) {
      return (
        <MessageDuVu
          texte={retour.texte}
          onAnnuler={() => {
            props.onAnnulerLeVu?.(retour.coche)
            setRetour(null)
            rendreLOrdre()
          }}
          onPartir={() => {
            setRetour(null)
            rendreLOrdre()
          }}
        />
      )
    }
    return null
  }

  const carte = (serie: SerieALEcran) => (
    <li key={serie.id} className={styles.ecran} data-piece="ecran" data-etat="serie">
      <div className={styles.sujet}>
        <Affiche src={serie.affiche} titre={serie.titre} taille="ligne" />
        <div className={styles.infos}>
          {serie.nouvelle && serie.quand ? <p className={styles.libelle}>{serie.quand}</p> : null}
          <h3 className={styles.titre}>{serie.titre}</h3>
          <p className={styles.episode}>
            <span className={styles.code}>{serie.episode ? codeDe(serie.episode) : 'À jour'}</span>
            {serie.episode?.titre ? <span className={styles.nomEp}>{serie.episode.titre}</span> : null}
          </p>
        </div>
      </div>
      <div className={styles.rangee}>
        {messageDe(serie.id) ?? (
          <>
            {serie.enPause ? (
              <button type="button" className={`${styles.touche} ${styles.large}`} data-piece="touche" aria-label={`Reprendre : ${serie.titre}`} disabled={!props.onReprendre} onClick={() => reprendre(serie)}>
                <IconPlayerPlay aria-hidden="true" className={styles.icone} />
                Reprendre
              </button>
            ) : serie.episode ? (
              <button
                type="button"
                className={`${styles.touche} ${styles.principale} ${styles.large}`}
                data-piece="touche-principale"
                aria-label={`Vu : ${serie.titre}, ${codeDe(serie.episode)}`}
                disabled={!props.onVu}
                onClick={() => vu(serie)}
              >
                <IconCheck aria-hidden="true" className={styles.icone} />
                Vu
              </button>
            ) : serie.diffusion ? (
              <NoteAJour diffusion={serie.diffusion} />
            ) : (
              <span className={styles.creux} />
            )}
            <button type="button" className={`${styles.touche} ${styles.carree}`} data-piece="touche" aria-label={`Régler la télécommande sur ${serie.titre}`} onClick={() => allerA({ nom: 'telecommande', serie: serie.id })}>
              <IconDots aria-hidden="true" className={styles.icone} />
            </button>
          </>
        )}
      </div>
    </li>
  )

  const ajouter = (
    <button type="button" className={`${styles.touche} ${styles.ligneEntiere}`} data-piece="touche" onClick={() => allerA({ nom: 'ajouter' })}>
      <IconPlus aria-hidden="true" className={styles.icone} />
      Ajouter une série
    </button>
  )

  if (lecture.etat === 'panne') return <Panne message={lecture.message} onReessayer={props.onReessayer} />

  if (lecture.etat === 'attente') {
    return (
      <>
        <h2 className={styles.libelle}>
          <b>En cours</b>
        </h2>
        <Attente libelle="La liste arrive…" className={styles.pile}>
          {Array.from({ length: FANTOMES }, (_, rang) => (
            <div key={rang} className={styles.ecran} data-piece="ecran" data-etat="attente">
              <div className={styles.sujet}>
                <Affiche src={null} titre="" taille="ligne" />
                <div className={styles.infos}>
                  <Barre largeur="longue" />
                  <Barre largeur="moyenne" />
                </div>
              </div>
              <div className={styles.rangee} />
            </div>
          ))}
        </Attente>
      </>
    )
  }

  const aucune = montre.enCours.length === 0 && montre.enPause.length === 0

  return (
    <>
      {avisSeul ? (
        <div className={styles.rangee}>
          <MessageDuVu
            key={avisSeul.cle}
            texte={avisSeul.texte}
            alerte={avisSeul.alerte}
            onAnnuler={annulerLAvis(avisSeul, props)}
            onPartir={() => {
              props.onAvisParti?.()
              // Il a pu chasser le message d'une carte (ou parler d'une carte repliée) : l'ordre figé se rend ici aussi.
              rendreLOrdre()
            }}
          />
        </div>
      ) : null}

      {invitations.length > 0 ? (
        <>
          <h2 className={styles.libelle}>
            <span className={styles.pastille} />
            <b>À confirmer</b> {invitations.length}
          </h2>
          <ul className={styles.pile}>
            {invitations.map((invitation) => (
              <li key={invitation.id} className={`${styles.ecran} ${styles.invitation}`} data-piece="ecran" data-etat="invitation">
                <div className={styles.sujet}>
                  <Monogramme pseudo={invitation.de} couleur={invitation.couleur} className={styles.mono} />
                  <div className={styles.infos}>
                    <p className={styles.dit}>
                      <b>{invitation.de}</b> a vu{' '}
                      <b>
                        {invitation.serie} {codeDe(invitation.episode)}
                      </b>{' '}
                      avec toi
                    </p>
                    {invitation.quand ? <p className={styles.libelle}>{invitation.quand}</p> : null}
                  </div>
                </div>
                <div className={styles.rangee}>
                  {messageDe(invitation.id) ?? (
                    <>
                      <button type="button" className={`${styles.touche} ${styles.large}`} data-piece="touche" disabled={!props.onRefuser} onClick={() => props.onRefuser?.(invitation)}>
                        Refuser
                      </button>
                      <button type="button" className={`${styles.touche} ${styles.principale} ${styles.large}`} data-piece="touche-principale" disabled={!props.onConfirmer} onClick={() => props.onConfirmer?.(invitation)}>
                        <IconCheck aria-hidden="true" className={styles.icone} />
                        Confirmer
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2 className={styles.libelle}>
        <b>En cours</b> {montre.enCours.length}
      </h2>
      {montre.enCours.length > 0 ? (
        <ul className={styles.pile} aria-label="En cours">
          {montre.enCours.map(carte)}
        </ul>
      ) : (
        <p className={styles.phrase}>{aucune ? 'Aucune série suivie pour l’instant. « Ajouter une série » en cherche une.' : 'Aucune série en cours.'}</p>
      )}

      {montre.enPause.length > 0 ? (
        <>
          <button type="button" className={styles.repli} aria-expanded={deplie} aria-controls={idDeLaPause} onClick={() => setDeplie(!deplie)}>
            <span className={styles.libelle}>
              <b>En pause</b> {montre.enPause.length}
            </span>
            {deplie ? <IconChevronUp aria-hidden="true" className={styles.icone} /> : <IconChevronDown aria-hidden="true" className={styles.icone} />}
          </button>
          <ul id={idDeLaPause} className={styles.pile} aria-label="En pause" hidden={!deplie}>
            {montre.enPause.map(carte)}
          </ul>
        </>
      ) : null}

      {ajouter}
    </>
  )
}
