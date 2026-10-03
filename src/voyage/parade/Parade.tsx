import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { ApiError } from '../../api/client'
import { journalDesAnnees } from '../../api/journal'
import { poserSurLePodium, viderLaMarche, type Marche, type Podium, type Salle } from '../../api/voyage'
import { APPUI_LONG_MS } from '../../carte/geste'
import type { Monde } from '../../mondes/types'
import Panne from '../../ui/Panne'
import { useCalque } from '../calque'
import Feuillet from '../Feuillet'
import { candidats, corpsPodium, lignesDeLaMarche, type Candidat } from '../podium'
import styles from './Parade.module.css'

const PLACES = [1, 2, 3] as const

/** Le traitement des affiches du monde, par `filter` CSS : jamais une lecture de pixels. */
const TRAITEMENT = { sepia: styles.sepia, gris: styles.gris, couleur: '' } as const

const messageDe = (e: unknown) => (e instanceof ApiError ? e.message : 'Le podium n’a pas pu s’écrire. Réessaie.')

/** Une écriture sur une marche : un candidat qu'on y pose, ou `null` pour la vider. */
interface Ecriture {
  place: number
  candidat: Candidat | null
}

interface Props {
  monde: Monde
  annee: number
  podium: Podium
  /** Les salles de la fiche, pour les programmes entièrement vus ; aucune pour une année en attente. */
  salles: readonly Salle[]
}

/**
 * La parade (maquette 1890 : `parade`, styles 150 à 165) : le podium de l'année, trois marches sous
 * deux projecteurs (2, 1, 3 à l'écran). Toucher une marche ouvre son feuillet dans l'adresse
 * (`?marche=<place>`) ; un appui long sur une marche occupée la vide. Chaque écriture relit la fiche
 * et la carte (l'affiche du n°1), et deux touchers rapprochés n'écrivent qu'une fois.
 */
export default function Parade({ monde, annee, podium, salles }: Props) {
  const feuillet = useCalque('marche')
  const ouverte = PLACES.find((p) => String(p) === feuillet.valeur) ?? null
  const m = monde.pages.mots

  // L'appui long : vider sans feuillet. `isPending` ne se voit qu'au rendu suivant : la garde.
  const vider = useEcriture(annee)

  return (
    <section aria-label={`${m.parade.titre}, ${m.parade.sous}`}>
      <p className={styles.titreSec}>
        {m.parade.titre} <small>{m.parade.sous}</small>
      </p>
      <div className={`${styles.parade} ${TRAITEMENT[monde.traitement.affiches]}`}>
        {PLACES.map((place) => (
          <MarcheDuPodium key={place} place={place} marche={podium[place - 1] ?? null} onOuvrir={() => feuillet.ouvrir(String(place))} onVider={() => vider.envoyer({ place, candidat: null })} />
        ))}
      </div>
      <p className={styles.aide}>Toucher une marche pour y poser un film · appui long pour la vider</p>
      {vider.erreur ? (
        <p role="alert" className={styles.message}>
          {vider.erreur}
        </p>
      ) : null}

      {ouverte !== null ? (
        <Feuillet monde={monde} titre={`Marche ${ouverte}`} onFermer={feuillet.fermer}>
          <ChoixDeLaMarche annee={annee} place={ouverte} marche={podium[ouverte - 1] ?? null} salles={salles} onFermer={feuillet.fermer} />
        </Feuillet>
      ) : null}
    </section>
  )
}

/**
 * Une écriture sur le podium, gardée contre le double toucher (`isPending` ne se voit qu'au rendu
 * suivant) ; la fiche et la carte (l'affiche du n°1) se relisent après. `apres` passe par les rappels
 * de `mutate`, qui se taisent une fois le composant démonté : c'est au feuillet de porter sa mutation,
 * pour que sa fermeture pendant l'envoi (le « retour » du téléphone) ne recule pas une seconde fois.
 */
function useEcriture(annee: number) {
  const client = useQueryClient()
  const ecrire = useMutation({
    mutationFn: async ({ place, candidat }: Ecriture): Promise<void> => {
      if (candidat) await poserSurLePodium(annee, place, corpsPodium(candidat))
      else await viderLaMarche(annee, place)
    },
    // La fiche et la carte (l'affiche du n°1) se relisent. Une écriture du chroniqueur en vol sous
    // `['voyage']` (le générique, le contexte d'une salle) n'est pas relancée : sans donnée encore,
    // TanStack Query 5 rend la lecture en cours au lieu de l'annuler (`Query.fetch`, `cancelRefetch`).
    onSuccess: () => void client.invalidateQueries({ queryKey: cles.voyage }),
  })
  const envoi = useRef(false)
  const envoyer = (e: Ecriture, apres?: () => void) => {
    if (envoi.current) return
    envoi.current = true
    ecrire.mutate(e, { onSuccess: apres, onSettled: () => void (envoi.current = false) })
  }
  return { envoyer, occupe: ecrire.isPending, erreur: ecrire.error ? messageDe(ecrire.error) : null }
}

interface PropsMarche {
  place: number
  marche: Marche | null
  onOuvrir: () => void
  onVider: () => void
}

/** Une marche : l'affiche et le titre de son occupant, ou « à venir » ; son socle porte sa place. */
function MarcheDuPodium({ place, marche, onOuvrir, onVider }: PropsMarche) {
  const minuteur = useRef<number | undefined>(undefined)
  const long = useRef(false)
  const lacher = () => {
    window.clearTimeout(minuteur.current)
    minuteur.current = undefined
  }
  useEffect(() => lacher, [])

  return (
    <button
      type="button"
      className={`${styles.marche} ${styles[`m${place}`]}`}
      aria-label={marche ? `Marche ${place} : ${marche.title}` : `Marche ${place} : à venir, poser un film`}
      onPointerDown={() => {
        long.current = false
        lacher()
        if (!marche) return
        minuteur.current = window.setTimeout(() => {
          minuteur.current = undefined
          long.current = true
          onVider()
        }, APPUI_LONG_MS)
      }}
      onPointerUp={lacher}
      onPointerLeave={lacher}
      onPointerCancel={lacher}
      // Une touche n'est jamais le relâcher d'un appui long : le clavier (le chemin qui remplace
      // l'appui long, par le feuillet et « Retirer ») ne se fait pas avaler son premier geste.
      onKeyDown={() => void (long.current = false)}
      // L'appui long ne doit ouvrir ni le menu du navigateur, ni le feuillet au relâcher.
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (long.current) {
          long.current = false
          return
        }
        onOuvrir()
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

interface PropsChoix {
  annee: number
  place: number
  marche: Marche | null
  salles: readonly Salle[]
  onFermer: () => void
}

/**
 * Le feuillet d'une marche : « Retirer » si elle est occupée, puis mes films de l'année (mon journal,
 * lu à l'ouverture du feuillet seulement) et les programmes vus de mes salles, l'occupant coché.
 */
function ChoixDeLaMarche({ annee, place, marche, salles, onFermer }: PropsChoix) {
  const { envoyer, occupe, erreur } = useEcriture(annee)
  const onChoisir = (candidat: Candidat | null) => envoyer({ place, candidat }, onFermer)
  // Mes films sortis cette année-là, jamais tout le journal : la clé de l'année fermée (`VoyageAnnee`),
  // qu'une année en attente lit déjà pour ses films vus en avance.
  const journal = useQuery({ queryKey: cles.journalDesAnnees(annee, annee), queryFn: ({ signal }) => journalDesAnnees(annee, annee, signal) })
  const lignes = lignesDeLaMarche(marche, journal.data ? candidats(journal.data, annee, salles) : [])
  const aucun = journal.data && !lignes.some((l) => l.type === 'candidat')

  return (
    <>
      <ul className={styles.choix}>
        {lignes.map((l) =>
          l.type === 'retirer' ? (
            <li key="retirer">
              <button type="button" className={styles.retirer} disabled={occupe} onClick={() => onChoisir(null)}>
                Retirer
              </button>
            </li>
          ) : (
            <li key={l.candidat.type === 'film' ? `f${l.candidat.tmdbId}` : `p${l.candidat.programmeId}`}>
              <button type="button" className={styles.candidat} aria-pressed={l.occupant} disabled={occupe} onClick={() => onChoisir(l.candidat)}>
                {l.candidat.affiche ? <img src={l.candidat.affiche} alt="" loading="lazy" decoding="async" /> : <span className={styles.sansImage} />}
                <span>
                  {l.candidat.titre}
                  <small>{l.candidat.type === 'programme' ? 'programme vu' : l.candidat.note !== null ? `vu · ${l.candidat.note}/10` : 'vu'}</small>
                </span>
              </button>
            </li>
          ),
        )}
      </ul>
      {journal.error ? (
        <Panne erreur={journal.error} onReessayer={() => void journal.refetch()} />
      ) : !journal.data ? (
        <p role="status">Chargement…</p>
      ) : aucun ? (
        <p className={styles.rien}>{`Aucun film de ${annee} dans ton journal pour l’instant.`}</p>
      ) : null}
      {erreur ? (
        <p role="alert" className={styles.erreur}>
          {erreur}
        </p>
      ) : null}
    </>
  )
}
