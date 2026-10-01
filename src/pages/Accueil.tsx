import { useCallback } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { IconPlus } from '@tabler/icons-react'
import { cles } from '../api/cles'
import { curseurSuivant, lireJournal } from '../api/journal'
import { lireStats } from '../api/stats'
import { lireVoyage } from '../api/voyage'
import { lirePlex } from '../api/plex'
import { lireRealisateurs } from '../api/realisateurs'
import { lireSagas } from '../api/sagas'
import { entiteEnCours } from '../suivis/prochain'
import { useFilmographiesRealisateurs, useFilmographiesSagas } from '../suivis/useFilmographies'
import type { EtatFilmographie } from '../suivis/liste'
import { cartesEnsuite } from '../accueil/ensuite'
import { cartesEventail } from '../accueil/eventail'
import { compteAccueil, etatFronton } from '../accueil/fronton'
import { journalParMois } from '../accueil/journalParMois'
import { useChargementInfini } from '../accueil/useChargementInfini'
import { useMoisDeroules } from '../accueil/useMoisDeroules'
import Panne from '../ui/Panne'
import BandeVoyage from '../accueil/BandeVoyage'
import Eventail from '../accueil/Eventail'
import Pellicule from '../accueil/Pellicule'
import Fronton from '../accueil/Fronton'
import VitrineVide from '../accueil/VitrineVide'
import styles from './Accueil.module.css'
import type { FilmRealisateur, Realisateur } from '../api/realisateurs'
import type { FilmSaga, Saga } from '../api/sagas'

const LIMITE = 20

/** Les seules filmographies arrivées : une entité encore en attente ou en panne ne participe pas au « Ensuite ». */
function filmsPrets<F>(etats: ReadonlyMap<number, EtatFilmographie<F>>): Map<number, F[]> {
  const prets = new Map<number, F[]>()
  etats.forEach((etat, id) => {
    if (etat.statut === 'pret') prets.set(id, etat.films)
  })
  return prets
}

/**
 * « Accueil · la porte d'entrée » (reprise de `HomeScreen.kt`) : la façade d'un cinéma. Le fronton
 * annonce la séance du soir, à défaut le prochain film à voir, à défaut la dernière entrée ; sous lui
 * l'éventail des affiches à voir, la bande du Voyage, puis le journal : une pellicule par mois, en
 * pagination infinie. « Ensuite » vient de Plex et, en plus ou à défaut, du réalisateur et de la saga
 * suivis dont il reste le plus à voir (`accueil/ensuite.ts`, reprise de `HomeRoute.kt`). « Ce soir » et la bande du Voyage renvoient vers l'onglet Voyage.
 */
export default function Accueil() {
  const naviguer = useNavigate()
  const [deroules, basculer] = useMoisDeroules()

  const journal = useInfiniteQuery({
    queryKey: cles.journal,
    queryFn: ({ pageParam, signal }) => lireJournal({ limit: LIMITE, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => curseurSuivant(page),
  })
  // Trois sources annexes, jamais bloquantes : chacune apparaît quand elle répond, jamais si elle
  // échoue ou n'a rien à proposer (même règle que `HomeRoute.kt`).
  const stats = useQuery({ queryKey: cles.stats, queryFn: ({ signal }) => lireStats(signal) })
  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const plex = useQuery({ queryKey: cles.plex, queryFn: ({ signal }) => lirePlex(signal) })

  // Jumeau du précédent, pour les deux secondes cartes « Ensuite » : les réalisateurs et sagas
  // suivis, puis la filmographie de chacun — jamais bloquant non plus, et sans attendre que
  // l'onglet Suivis ait été ouvert (même règle que `HomeRoute.kt`). Les requêtes par entité
  // partagent leur clé avec `PageRealisateur`/`PageSaga` : ouvrir l'une après l'accueil ne
  // rappelle pas le back.
  const realisateursSuivis = useQuery({ queryKey: cles.realisateurs, queryFn: ({ signal }) => lireRealisateurs(signal) })
  const sagasSuivies = useQuery({ queryKey: cles.sagas, queryFn: ({ signal }) => lireSagas(signal) })

  // Une filmographie après l'autre, jamais toutes d'un coup (`useFilmographies`, reprise de
  // `SuivisViewModel.refresh` : le back appelle TMDB derrière, et sa file sortante a déjà cédé à une
  // rafale). Les réalisateurs d'abord, puis les sagas : deux chaînes qui ne se gênent pas.
  const filmographiesRealisateurs = useFilmographiesRealisateurs(realisateursSuivis.data)
  const filmographiesSagas = useFilmographiesSagas(sagasSuivies.data)

  const ensuiteRealisateur = entiteEnCours<Realisateur, FilmRealisateur>(
    realisateursSuivis.data ?? [],
    filmsPrets(filmographiesRealisateurs),
  )
  const ensuiteSaga = entiteEnCours<Saga, FilmSaga>(sagasSuivies.data ?? [], filmsPrets(filmographiesSagas))

  // Dépendances primitives plutôt que `journal` entier : sa référence change à chaque
  // notification de la requête, ce qui recréerait l'observateur (et la sentinelle) à chaque rendu.
  // Une erreur arrête la boucle (jumeau de `MesFilms.tsx`) : sans `isFetchNextPageError`, l'échec
  // d'une page faisait retomber `isFetchingNextPage` à faux, l'observateur recréé signalait la
  // sentinelle toujours visible, et la page repartait sans fin. « Réessayer » relance à la main.
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = journal
  const chargerLaSuite = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage])
  const sentinelle = useChargementInfini(chargerLaSuite, !!hasNextPage)

  if (journal.isPending) return <p role="status">Chargement…</p>
  // `!journal.data`, pas `journal.error` (jumeau de `MesFilms.tsx`) : une fois la première page
  // arrivée, l'échec d'une page suivante ne doit pas effacer la grille déjà affichée derrière la
  // panne plein écran — il se dit en ligne, avec « Réessayer ».
  if (!journal.data) return <Panne erreur={journal.error} onReessayer={() => void journal.refetch()} />

  const items = journal.data.pages.flatMap((page) => page.items)
  const vide = items.length === 0 && !journal.hasNextPage

  const maintenant = new Date()
  const compte = compteAccueil(stats.data?.dashboard.periods.year.counts.finished_by_type.movie)
  const seance = voyage.data?.seance_prise
  const cartes = cartesEnsuite(plex.data?.films[0], ensuiteRealisateur, ensuiteSaga)
  const mois = journalParMois(items)

  return (
    <div className={styles.fond}>
      <div className={styles.page}>
        <Fronton etat={etatFronton(maintenant, seance, cartes, items[0])} />
        <Eventail cartes={cartesEventail(seance, cartes)} />
        {voyage.data ? <BandeVoyage voyage={voyage.data} /> : null}

        {vide ? (
          <VitrineVide onAjouter={() => naviguer('/recherche')} />
        ) : (
          <section className={styles.journal} aria-labelledby="titre-journal">
            <div className={styles.entete}>
              <div className={styles.intitule}>
                <h2 id="titre-journal" className={styles.titre}>
                  Le journal
                </h2>
                {compte ? <p className={styles.compte}>{compte}</p> : null}
              </div>
              <Link to="/profil/mes-films" className={styles.mesFilms}>
                Mes films <span aria-hidden="true">→</span>
              </Link>
            </div>

            {mois.map((groupe) => (
              <Pellicule key={groupe.cle} mois={groupe} deroulee={deroules.has(groupe.cle)} onBasculer={() => basculer(groupe.cle)} />
            ))}

            {journal.hasNextPage ? (
              <div ref={sentinelle} data-testid="sentinelle-journal" className={styles.sentinelle} />
            ) : null}
            {journal.isFetchingNextPage && !isFetchNextPageError ? (
              <p className={styles.chargement}>Chargement…</p>
            ) : null}
            {isFetchNextPageError ? (
              <div className={styles.erreur} role="alert">
                <p className={styles.erreurTexte}>{journal.error?.message}</p>
                <button type="button" className={styles.bouton} onClick={() => void fetchNextPage()}>
                  Réessayer
                </button>
              </div>
            ) : null}
          </section>
        )}

        {!vide ? (
          <Link to="/recherche" className={styles.boutonAjouter}>
            <IconPlus aria-hidden="true" className={styles.icone} />
            <span>J’ai vu un film</span>
          </Link>
        ) : null}
      </div>
    </div>
  )
}
