import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconMapPin, IconMovie, IconUser } from '@tabler/icons-react'
import Attente, { Barre } from '../ui/Attente'
import { distanceAffichee } from './distance'
import { dansCombien, heureAffichee, type EntreeDuTableau } from './seances'
import styles from './TableauDuHall.module.css'

/** « Environ cinq entrées » (la maquette) : de quoi voir la soirée d'un coup d'œil, le reste se déplie. */
export const ENTREES_VISIBLES = 5

const MARQUES = {
  realisateur: { icone: IconUser, libelle: 'Réalisateur suivi' },
  saga: { icone: IconMovie, libelle: 'Saga suivie' },
} as const

function SceauMini({ marque }: { marque: keyof typeof MARQUES }) {
  const { icone: Icone, libelle } = MARQUES[marque]
  return (
    <span role="img" aria-label={libelle} className={styles.sceauMini}>
      <Icone aria-hidden="true" />
    </span>
  )
}

interface Props {
  /** Les séances à venir, déjà dans l'ordre du tableau (`entreesDuTableau`). Vide : « Plus de séance ce soir. » */
  entrees: readonly EntreeDuTableau[]
  /** L'horloge de la page : « dans N min » de la toute prochaine séance. */
  maintenantMs: number
  /** Le lien et l'état de navigation d'une entrée : la page sait ouvrir la fiche d'un film. */
  ouvrir: (film: EntreeDuTableau['seance']['film']) => { to: string; state: unknown }
  /** Vrai quand la position n'est pas encore autorisée et que les cinémas ont des coordonnées. */
  proposerPosition: boolean
  onAutoriser: () => void
}

/**
 * « Prochaines séances » (variante A de la maquette, « le tableau du hall ») : le panneau du fronton
 * de l'accueil — cadre, rail, ampoules (`--fronton-*`) — portant une ligne par séance à venir
 * aujourd'hui. Le tableau reste en place une fois la dernière séance passée : un panneau qui
 * disparaîtrait se lirait comme un chargement ou une panne.
 */
export function TableauDuHall({ entrees, maintenantMs, ouvrir, proposerPosition, onAutoriser }: Props) {
  const [deplie, setDeplie] = useState(false)
  const visibles = deplie ? entrees : entrees.slice(0, ENTREES_VISIBLES)
  const marques = [...new Set(visibles.flatMap(({ seance }) => (seance.marque ? [seance.marque] : [])))]

  return (
    <div className={styles.tableau}>
      <div className={styles.ampoules} />
      <div className={styles.corps}>
        {entrees.length === 0 ? (
          <p className={styles.vide}>Plus de séance ce soir.</p>
        ) : (
          <>
            <div className={styles.tete} aria-hidden="true">
              <span>Heure</span>
              <span>Film · cinéma</span>
              <span>Version</span>
            </div>
            <ol className={styles.lignes}>
              {visibles.map(({ seance, cinema, distance }, rang) => {
                const { to, state } = ouvrir(seance.film)
                return (
                  <li key={`${seance.cinema_id}-${seance.debut}-${seance.film.tmdb_id}-${seance.version}`}>
                    <Link to={to} state={state} className={rang === 0 ? `${styles.ligne} ${styles.prochaine}` : styles.ligne}>
                      <span className={styles.heure}>
                        <time dateTime={seance.debut}>{heureAffichee(seance.debut)}</time>
                        {rang === 0 ? <span className={styles.reste}>{dansCombien(seance.debut, maintenantMs)}</span> : null}
                      </span>
                      <span className={styles.film}>
                        <span className={styles.titre}>{seance.film.title}</span>
                        <span className={styles.meta}>
                          {seance.marque ? <SceauMini marque={seance.marque} /> : null}
                          <span className={styles.lieu}>
                            {[cinema?.nom, distance != null ? distanceAffichee(distance) : null].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </span>
                      <span className={styles.version}>{seance.version}</span>
                    </Link>
                  </li>
                )
              })}
            </ol>
            {proposerPosition ? (
              <div className={styles.position}>
                <IconMapPin aria-hidden="true" className={styles.iconePosition} />
                <p className={styles.textePosition}>
                  Autoriser la position pour voir les salles les plus proches
                  <small className={styles.promesse}>Elle ne quitte pas ton téléphone.</small>
                </p>
                <button type="button" className={styles.autoriser} onClick={onAutoriser}>
                  Autoriser
                </button>
              </div>
            ) : null}
            <div className={styles.pied}>
              <ul className={styles.legende}>
                {marques.map((marque) => (
                  <li key={marque} className={styles.legendeMarque}>
                    <SceauMini marque={marque} />
                    {MARQUES[marque].libelle}
                  </li>
                ))}
              </ul>
              {entrees.length > ENTREES_VISIBLES ? (
                <button type="button" className={styles.toutVoir} aria-expanded={deplie} onClick={() => setDeplie(!deplie)}>
                  {deplie ? 'Réduire' : `Tout voir (${entrees.length})`}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
      <div className={styles.ampoules} />
    </div>
  )
}

/** Le tableau avant l'arrivée des séances : trois lignes en blanc, dans le même panneau. */
export function TableauEnAttente() {
  return (
    <div className={styles.tableau}>
      <div className={styles.ampoules} />
      <Attente className={styles.corps}>
        {Array.from({ length: 3 }, (_, ligne) => (
          <div key={ligne} className={styles.ligne} data-testid="ligne-tableau-en-attente">
            <Barre largeur="courte" />
            <span className={styles.film}>
              <Barre largeur="longue" />
              <Barre largeur="moyenne" />
            </span>
          </div>
        ))}
      </Attente>
      <div className={styles.ampoules} />
    </div>
  )
}
