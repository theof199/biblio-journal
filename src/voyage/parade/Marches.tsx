import type { Marche, Podium, Salle } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import { useAppuiLong } from './appuiLong'
import styles from './Parade.module.css'

const PLACES = [1, 2, 3] as const

/** Le traitement des affiches du monde, par `filter` CSS : jamais une lecture de pixels. */
const TRAITEMENT = { sepia: styles.sepia, gris: styles.gris, couleur: '' } as const

/**
 * Ce que reçoit le podium d'une année, par défaut ou du monde (`GabaritsDesPages.parade`). `Parade`
 * garde le calque du feuillet (`?marche=<place>`), l'écriture et sa garde contre le double toucher :
 * le podium n'en reçoit que les deux gestes et l'erreur.
 */
export interface PropsMarches {
  monde: Monde
  annee: number
  podium: Podium
  /** Les salles de la fiche, pour retrouver le film d'une marche ; aucune pour une année en attente. */
  salles: readonly Salle[]
  /** Ouvre le feuillet d'une marche : y poser un film, le changer, la vider. */
  onOuvrir: (place: number) => void
  /** Vide une marche sans feuillet (l'appui long par défaut). */
  onVider: (place: number) => void
  /** Le refus de la dernière écriture sans feuillet, tel que l'API l'a écrit. */
  erreur: string | null
}

/**
 * Le podium par défaut (maquette 1890 : `parade`, styles 150 à 165) : trois marches sous deux
 * projecteurs (2, 1, 3 à l'écran). Toucher une marche ouvre son feuillet ; un appui long sur une
 * marche occupée la vide.
 */
export default function Marches({ monde, podium, onOuvrir, onVider, erreur }: PropsMarches) {
  const m = monde.pages.mots
  return (
    <section aria-label={`${m.parade.titre}, ${m.parade.sous}`}>
      <p className={styles.titreSec}>
        {m.parade.titre} <small>{m.parade.sous}</small>
      </p>
      <div className={`${styles.parade} ${TRAITEMENT[monde.traitement.affiches]}`}>
        {PLACES.map((place) => (
          <MarcheDuPodium key={place} place={place} marche={podium[place - 1] ?? null} onOuvrir={() => onOuvrir(place)} onVider={() => onVider(place)} />
        ))}
      </div>
      <p className={styles.aide}>Toucher une marche pour y poser un film · appui long pour la vider</p>
      {erreur ? (
        <p role="alert" className={styles.message}>
          {erreur}
        </p>
      ) : null}
    </section>
  )
}

interface PropsMarche {
  place: number
  marche: Marche | null
  onOuvrir: () => void
  onVider: () => void
}

/** Une marche : l'affiche et le titre de son occupant, ou « à venir » ; son socle porte sa place. */
function MarcheDuPodium({ place, marche, onOuvrir, onVider }: PropsMarche) {
  const appui = useAppuiLong(!!marche, onVider)
  return (
    <button
      type="button"
      className={`${styles.marche} ${styles[`m${place}`]}`}
      aria-label={marche ? `Marche ${place} : ${marche.title}` : `Marche ${place} : à venir, poser un film`}
      {...appui.ecouteurs}
      onClick={() => {
        if (!appui.aEteLong()) onOuvrir()
      }}
    >
      {marche ? (
        <span className={styles.cab}>
          {marche.cover_url ? <img src={marche.cover_url} alt="" decoding="async" /> : <span className={styles.sansImage} />}
          <span className={styles.t}>{marche.title}</span>
        </span>
      ) : (
        <span className={styles.vide}>
          à venir
          <br />
          poser un film
        </span>
      )}
      <span className={styles.socle} aria-hidden="true">
        {place}
      </span>
    </button>
  )
}
