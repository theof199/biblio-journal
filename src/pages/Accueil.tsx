import { useCallback } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { IconPlus } from '@tabler/icons-react'
import { cles } from '../api/cles'
import { curseurSuivant, lireJournal } from '../api/journal'
import { lireStats } from '../api/stats'
import { lireVoyage } from '../api/voyage'
import { lirePlex } from '../api/plex'
import Affiche from '../ui/Affiche'
import Panne from '../ui/Panne'
import CarteCeSoir from '../accueil/CarteCeSoir'
import CarrouselEnsuite from '../accueil/CarrouselEnsuite'
import VitrineVide from '../accueil/VitrineVide'
import { useChargementInfini } from '../accueil/useChargementInfini'
import { compteAccueil, formatJour } from '../accueil/fronton'
import styles from './Accueil.module.css'

const LIMITE = 20

/**
 * « Accueil · la porte d'entrée » (reprise de `HomeScreen.kt`) : le fronton, « Ce soir », « Ensuite »
 * et la grille du journal, en pagination infinie. « Ensuite » montre aussi, à défaut de Plex, le
 * réalisateur ou la saga suivis dont il reste le plus à voir (`accueil/ensuite.ts`) ; « Ce soir » et
 * la carte du Voyage renvoient vers l'onglet Voyage, dont la fiche d'année vit dans un autre lot.
 */
export default function Accueil() {
  const naviguer = useNavigate()

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

  const compte = compteAccueil(stats.data?.dashboard.periods.year.counts.finished_by_type.movie)
  const seance = voyage.data?.seance_prise
  const ensuite = plex.data?.films[0]

  return (
    <div className={styles.page}>
      <div className={styles.fronton}>
        <h1 className={styles.jour}>{formatJour(new Date())}</h1>
        {compte ? <p className={styles.compte}>{compte}</p> : null}
      </div>

      {seance ? <CarteCeSoir seance={seance} /> : null}
      {ensuite ? <CarrouselEnsuite film={ensuite} /> : null}

      {vide ? (
        <VitrineVide onAjouter={() => naviguer('/recherche')} />
      ) : (
        <>
          <div className={styles.grille}>
            {items.map((item) => (
              <Link
                key={item.entry.id}
                to={`/journal/${item.entry.id}`}
                state={{ item }}
                className={styles.entree}
              >
                <Affiche src={item.media.cover_url} titre={item.media.title} note={item.entry.rating} />
              </Link>
            ))}
          </div>
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
        </>
      )}

      {!vide ? (
        <Link to="/recherche" className={styles.boutonAjouter} aria-label="Ajouter un film">
          <IconPlus aria-hidden="true" className={styles.icone} />
        </Link>
      ) : null}
    </div>
  )
}
