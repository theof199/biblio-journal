import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { ApiError } from '../../api/client'
import { journalDesAnnees } from '../../api/journal'
import { poserSurLePodium, viderLaMarche, type Marche, type Podium, type Salle } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import Panne from '../../ui/Panne'
import { useCalque } from '../calque'
import Feuillet from '../Feuillet'
import { gabaritDe } from '../gabarit'
import { candidats, corpsPodium, lignesDeLaMarche, type Candidat } from '../podium'
import Marches from './Marches'
import styles from './Parade.module.css'

const PLACES = [1, 2, 3] as const

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
 * La parade : le podium de l'année. Le dessin des trois marches est une section que le monde peut
 * composer (`gabarits.parade` ; le défaut : `Marches`). Ce qui écrit reste ici : le feuillet d'une
 * marche dans l'adresse (`?marche=<place>`), et l'écriture sans feuillet, qui vide. Chaque écriture
 * relit la fiche et la carte (l'affiche du n°1), et deux touchers rapprochés n'écrivent qu'une fois.
 */
export default function Parade({ monde, annee, podium, salles }: Props) {
  const feuillet = useCalque('marche')
  const ouverte = PLACES.find((p) => String(p) === feuillet.valeur) ?? null
  const LePodium = gabaritDe(monde, 'parade', Marches)

  // Vider sans feuillet. `isPending` ne se voit qu'au rendu suivant : la garde.
  const vider = useEcriture(annee)

  return (
    <>
      <LePodium monde={monde} annee={annee} podium={podium} salles={salles} onOuvrir={(place) => feuillet.ouvrir(String(place))} onVider={(place) => vider.envoyer({ place, candidat: null })} erreur={vider.erreur} />
      {ouverte !== null ? (
        <Feuillet monde={monde} titre={monde.pages.mots.parade.marche(ouverte)} onFermer={feuillet.fermer}>
          <ChoixDeLaMarche annee={annee} place={ouverte} marche={podium[ouverte - 1] ?? null} salles={salles} onFermer={feuillet.fermer} />
        </Feuillet>
      ) : null}
    </>
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
