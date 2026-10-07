import type { ReactNode, RefObject } from 'react'
import type { Reaction } from '../../api/reactions'
import type { FormulaireBrouillon } from '../../formulaire/patch'
import type { Monde } from '../../mondes/types'
import { formatDateVisionnage, sousTitre } from '../../ui/format'
import Panne from '../../ui/Panne'
import { initiale } from '../billet'
import { NUMERO_EN_ATTENTE, numeroLisible } from '../billets'
import styles from '../../pages/VoyageBillet.module.css'
import Cartons from './Cartons'
import Dateur from './Dateur'
import Numeroteur from './Numeroteur'
import Poincon from './Poincon'
import Tampon, { type Frappe } from './Tampon'

/** Le traitement des affiches du monde, par `filter` CSS : jamais une lecture de pixels. */
const TRAITEMENT = { sepia: styles.sepia, gris: styles.gris, couleur: '' } as const

/**
 * `inert` : ni toucher, ni focus, ni clavier, ni lecteur d'écran, sans rien changer à l'œil. React 18
 * ne le connaît pas et le pose tel quel, d'où la chaîne vide ; à React 19, il devient un booléen.
 */
export const INERTE = { inert: '' }

/** Où en est le compostage (décision D4) : au repos, la frappe du tampon, le numéroteur, le talon qui part. */
export type Etape = 'repos' | Exclude<Frappe, 'fini'> | 'numerote' | 'talon'

/**
 * Ce que reçoit le dessin du billet de séance, par défaut ou du monde
 * (`GabaritsDesPages.billetDeSeance`). La page (`pages/VoyageBillet.tsx`) garde ce qui lit et ce qui
 * écrit : le brouillon et sa garde, l'écriture, la suppression, la boîte où se lit le numéro, la
 * séquence du compostage, ses attentes et sa navigation. Le dessin rend ce qu'on lui passe et
 * rappelle la page à chaque geste ; il ne décide ni de l'étape ni du numéro.
 */
export interface PropsBilletDeSeance {
  monde: Monde
  /** L'année de la fiche d'où vient le film. */
  annee: number
  film: { titre: string; realisateur: string | null; sortie: number | null; couverture: string | null }
  /** Un visionnage corrigé : rien ne se tamponnera, et le numéro se lit déjà. */
  correction: boolean
  brouillon: FormulaireBrouillon
  /** Retouche le brouillon ; la page l'ignore dès que le billet est parti. */
  onRetoucher: (f: (b: FormulaireBrouillon) => FormulaireBrouillon) => void
  /** Le catalogue des réactions, nul tant qu'il n'est pas lu ; `panne` : sa lecture a échoué. */
  reactions: { catalogue: readonly Reaction[] | null; panne: unknown; onReessayer: () => void }
  pseudo: string
  /** Le numéro du billet dans la boîte de sa décennie, nul tant qu'il n'est pas lu. */
  numero: number | null
  /** Le tirage en cours du numéroteur (de 0 à 9), nul quand il ne roule pas. */
  tirage: number | null
  etape: Etape
  /** Ce que la frappe amène à l'écran : à poser sur l'élément qui porte le billet. */
  support: RefObject<HTMLDivElement>
  /** Le billet est parti (envoi, tampon) : rien n'y répond plus, focus compris (`INERTE`). */
  occupe: boolean
  /** Le refus de l'écriture, tel que l'API l'a écrit ; nul sinon. */
  refus: string | null
  onComposter: () => void
  /** « Supprimer » et sa confirmation, montés par la page ; nul hors correction. */
  suppression: ReactNode
}

/**
 * Le billet de séance par défaut (maquette 1890 : `initNotation`, écran VI) : la tête, le dateur, le
 * poinçon, les cartons, la remarque, le tampon qui le frappe, le talon qui part, le bouton.
 */
export default function BilletDeSeance({ monde, film, correction, brouillon, onRetoucher, reactions, pseudo, numero, tirage, etape, support, occupe, refus, onComposter, suppression }: PropsBilletDeSeance) {
  const m = monde.pages.mots
  const sous = sousTitre(film.realisateur, film.sortie)
  const date = formatDateVisionnage(brouillon.date)
  return (
    <div className={styles.notation}>
      <div className={styles.tete}>
        <span className={`${styles.cab} ${TRAITEMENT[monde.traitement.affiches]}`}>
          {film.couverture ? <img src={film.couverture} alt="" decoding="async" /> : <span className={styles.sansImage} />}
        </span>
        <div>
          <span className={styles.sc}>Enregistrer un visionnage</span>
          <h1 className={styles.titre}>{film.titre}</h1>
          {sous ? <small>{sous}</small> : null}
        </div>
      </div>

      {/* Le support porte le billet et ce qui le frappe : le masque du billet rognerait le marteau. */}
      <div ref={support} className={styles.support} data-etape={etape}>
        {/* Sous le tampon, rien du billet ne répond, au doigt comme au clavier, focus compris. */}
        <div className={styles.billet} {...(occupe ? INERTE : null)}>
          <div className={styles.entete}>
            <small>{m.billet.tete}</small>
            <strong>{m.billet.titre}</strong>
            <Numeroteur numero={numero} tirage={tirage} />
          </div>
          <div className={`${styles.rubrique} ${styles.dateur}`}>
            <Dateur date={brouillon.date} onChange={(d) => onRetoucher((b) => ({ ...b, date: d }))} />
          </div>
          <div className={styles.rubrique}>
            <div className={styles.rubriqueTete}>
              Ta note <em>poinçonnez</em>
            </div>
            <Poincon note={brouillon.note} onNote={(note) => onRetoucher((b) => ({ ...b, note }))} />
          </div>
          <div className={styles.rubrique}>
            <div className={styles.rubriqueTete}>
              Tes réactions <em>douze cartons au plus</em>
            </div>
            {reactions.catalogue ? (
              <Cartons catalogue={reactions.catalogue} choisis={brouillon.reactions} onChange={(r) => onRetoucher((b) => ({ ...b, reactions: r }))} />
            ) : reactions.panne ? (
              <div className={styles.erreurCartons}>
                <Panne erreur={reactions.panne} onReessayer={reactions.onReessayer} />
              </div>
            ) : (
              <p role="status" className={styles.attente}>
                Chargement…
              </p>
            )}
          </div>
          <div className={`${styles.rubrique} ${styles.remarque}`}>
            <div className={styles.rubriqueTete}>
              <span>
                <span className={styles.cire} aria-hidden="true">
                  {initiale(pseudo)}
                </span>
                Ta remarque
              </span>
              <em>privée : toi seul la lis</em>
            </div>
            <textarea
              aria-label="Remarque privée"
              placeholder="Ce que tu en retiens, pour toi…"
              value={brouillon.remarque}
              onChange={(e) => onRetoucher((b) => ({ ...b, remarque: e.target.value }))}
            />
          </div>
        </div>
        {etape !== 'repos' ? (
          <Tampon mot={m.billet.tampon} autour={m.billet.tamponAutour} date={date} frappe={etape === 'descend' || etape === 'pose' || etape === 'remonte' ? etape : 'fini'} />
        ) : null}
        {/* Le talon du billet tamponné, qui part dans la boîte (maquette 1890 : `.billet-sort`). */}
        {etape === 'talon' ? (
          <div className={styles.talonQuiPart} aria-hidden="true">
            <span>
              <b>{numero !== null ? numeroLisible(numero) : NUMERO_EN_ATTENTE}</b>
              {`${film.titre} · ${date}`}
            </span>
            <span className={styles.vuDuTalon}>{m.billet.tampon}</span>
          </div>
        ) : null}
      </div>

      {refus ? (
        <p role="alert" className={styles.erreur}>
          {refus}
        </p>
      ) : null}
      <button type="button" className={styles.valider} disabled={occupe} onClick={onComposter}>
        <span>
          <b>{correction ? 'Corriger le billet' : m.billet.valider}</b> <small>{m.billet.validerSous}</small>
        </span>
        <span className={styles.talon} aria-hidden="true">
          {m.billet.tampon}
        </span>
      </button>

      {suppression}
    </div>
  )
}
