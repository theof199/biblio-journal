import { useCallback, useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { IconSearch, IconTicket, IconX } from '@tabler/icons-react'
import { cles } from '../api/cles'
import { curseurSuivant, lireJournal } from '../api/journal'
import { lireReactions } from '../api/reactions'
import type { Reaction } from '../api/reactions'
import { lireStats } from '../api/stats'
import { useChargementInfini } from '../accueil/useChargementInfini'
import Affiche from '../ui/Affiche'
import BoutonRetour from '../ui/BoutonRetour'
import Panne from '../ui/Panne'
import { formatDateVisionnage, sousTitre } from '../ui/format'
import {
  appliquerFiltres,
  auCinema,
  basculerNote,
  basculerOrdreDate,
  basculerReactionFiltre,
  compteEnTete,
  FILTRES_INITIAUX,
  filtresActifs,
  libellePuceDate,
  libellePuceNote,
  libellePuceReaction,
  motsReactions,
  type FiltresMesFilms,
} from '../mesFilms/filtres'
import styles from './MesFilms.module.css'
import type { JournalItem } from '../api/journal'

/** Même taille de page que l'accueil (`Accueil.tsx`) : les deux partagent la clé `cles.journal`. */
const LIMITE = 20

/** La feuille ouverte sous les puces : au plus une à la fois, comme les deux feuilles d'Android. */
type Panneau = 'note' | 'reaction' | null

/**
 * « Mes films » (reprise de `FilmsScreen.kt`) : la liste de ce que le membre a vu, avec recherche,
 * tri et filtres — accessible depuis le profil, comme sur l'appli Android (`ProfileScreen.kt`,
 * « Mes films » n'y est poussé que depuis lui). Partage le cache du journal et des statistiques
 * avec l'accueil : la même clé TanStack Query (`cles.journal`, `cles.stats`), la même page de 20.
 *
 * Filtrer, trier et corriger vivent déjà ailleurs dans l'app : un film ouvre sa fiche (`Fiche.tsx`),
 * qui porte elle-même « Corriger » et, depuis le formulaire, la suppression — cette page ne les
 * réimplémente pas.
 */
export default function MesFilms() {
  const naviguer = useNavigate()
  const [filtres, setFiltres] = useState<FiltresMesFilms>(FILTRES_INITIAUX)
  const [panneau, setPanneau] = useState<Panneau>(null)

  const journal = useInfiniteQuery({
    queryKey: cles.journal,
    queryFn: ({ pageParam, signal }) => lireJournal({ limit: LIMITE, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => curseurSuivant(page),
  })
  const stats = useQuery({ queryKey: cles.stats, queryFn: ({ signal }) => lireStats(signal) })
  const reactions = useQuery({ queryKey: cles.reactions, queryFn: ({ signal }) => lireReactions(signal) })
  const catalogue = reactions.data?.reactions ?? []

  const actifs = filtresActifs(filtres)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = journal

  // Un filtre, un tri ou une recherche ne peut rien affirmer sur des pages pas encore chargées : le
  // journal se charge alors en entier, jumeau de `chargerTout()` (`FilmsViewModel.kt`).
  useEffect(() => {
    if (actifs && hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [actifs, hasNextPage, isFetchingNextPage, fetchNextPage])

  // Sans filtre, la pagination habituelle : la suite se charge quand la sentinelle entre dans
  // l'écran (jumeau de `Accueil.tsx`).
  const chargerLaSuite = useCallback(() => {
    if (!actifs && hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [actifs, hasNextPage, isFetchingNextPage, fetchNextPage])
  const sentinelle = useChargementInfini(chargerLaSuite, !actifs && !!hasNextPage)

  const items = useMemo(() => journal.data?.pages.flatMap((page) => page.items) ?? [], [journal.data])
  const visibles = useMemo(() => appliquerFiltres(items, filtres), [items, filtres])

  if (journal.isPending) return <p role="status">Chargement…</p>
  if (!journal.data) return <Panne erreur={journal.error} onReessayer={() => void journal.refetch()} />

  const total = stats.data?.dashboard.periods.all.counts.finished_by_type.movie
  const cetteAnnee = stats.data?.dashboard.periods.year.counts.finished_by_type.movie
  const compte = compteEnTete(total, cetteAnnee)

  const chargementComplet = !hasNextPage
  const rienDuTout = items.length === 0 && chargementComplet
  const rienAvecFiltres = visibles.length === 0 && actifs && chargementComplet
  const texteRogne = filtres.texte.trim()

  return (
    <div className={styles.page}>
      <div className={styles.entete}>
        <BoutonRetour vers="/profil" />
        <h1 className={styles.titre}>Mes films</h1>
        {compte ? <p className={styles.compte}>{compte}</p> : null}
      </div>

      <div className={styles.recherche}>
        <IconSearch aria-hidden="true" />
        <input
          type="search"
          value={filtres.texte}
          onChange={(event) => setFiltres((f) => ({ ...f, texte: event.target.value }))}
          placeholder="Un titre, un réalisateur"
          aria-label="Rechercher parmi mes films"
          className={styles.champRecherche}
        />
        {filtres.texte ? (
          <button type="button" onClick={() => setFiltres((f) => ({ ...f, texte: '' }))} aria-label="Effacer la recherche">
            <IconX aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className={styles.puces}>
        <button
          type="button"
          className={`${styles.puce} ${filtres.tri === 'date_asc' ? styles.puceActive : ''}`}
          aria-pressed={filtres.tri === 'date_asc'}
          onClick={() => setFiltres((f) => ({ ...f, tri: basculerOrdreDate(f.tri) }))}
        >
          {libellePuceDate(filtres.tri)}
        </button>
        <button
          type="button"
          className={`${styles.puce} ${filtres.tri === 'note_desc' || filtres.notes.length > 0 ? styles.puceActive : ''}`}
          aria-pressed={filtres.tri === 'note_desc' || filtres.notes.length > 0}
          aria-expanded={panneau === 'note'}
          onClick={() => setPanneau((p) => (p === 'note' ? null : 'note'))}
        >
          {libellePuceNote(filtres)}
        </button>
        <button
          type="button"
          className={`${styles.puce} ${filtres.reactions.length > 0 ? styles.puceActive : ''}`}
          aria-pressed={filtres.reactions.length > 0}
          aria-expanded={panneau === 'reaction'}
          onClick={() => setPanneau((p) => (p === 'reaction' ? null : 'reaction'))}
        >
          {libellePuceReaction(filtres)}
        </button>
      </div>

      {panneau === 'note' ? (
        <div className={styles.panneau}>
          <p className={styles.panneauLibelle}>Trier</p>
          <div className={styles.puces}>
            <button
              type="button"
              className={`${styles.puce} ${filtres.tri !== 'note_desc' ? styles.puceActive : ''}`}
              aria-pressed={filtres.tri !== 'note_desc'}
              onClick={() => setFiltres((f) => ({ ...f, tri: 'date_desc' }))}
            >
              Trier par date
            </button>
            <button
              type="button"
              className={`${styles.puce} ${filtres.tri === 'note_desc' ? styles.puceActive : ''}`}
              aria-pressed={filtres.tri === 'note_desc'}
              onClick={() => setFiltres((f) => ({ ...f, tri: 'note_desc' }))}
            >
              Trier par note
            </button>
          </div>
          <p className={styles.panneauLibelle}>Notes</p>
          <div className={styles.pastilles}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`${styles.pastille} ${filtres.notes.includes(n) ? styles.pastilleActive : ''}`}
                aria-pressed={filtres.notes.includes(n)}
                aria-label={`Note ${n}`}
                onClick={() => setFiltres((f) => ({ ...f, notes: basculerNote(f.notes, n) }))}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.effacerPanneau}
            onClick={() => setFiltres((f) => ({ ...f, tri: 'date_desc', notes: [] }))}
          >
            Effacer les notes
          </button>
        </div>
      ) : null}

      {panneau === 'reaction' ? (
        <div className={styles.panneau}>
          <div className={styles.puces}>
            {catalogue.map((r) => (
              <button
                key={r.cle}
                type="button"
                className={`${styles.puce} ${filtres.reactions.includes(r.cle) ? styles.puceActive : ''}`}
                aria-pressed={filtres.reactions.includes(r.cle)}
                onClick={() => setFiltres((f) => ({ ...f, reactions: basculerReactionFiltre(f.reactions, r.cle) }))}
              >
                {`${r.emoji} ${r.phrase}`}
              </button>
            ))}
          </div>
          <button type="button" className={styles.effacerPanneau} onClick={() => setFiltres((f) => ({ ...f, reactions: [] }))}>
            Effacer les réactions
          </button>
        </div>
      ) : null}

      {actifs && !chargementComplet ? <p role="status" className={styles.chargement}>Chargement…</p> : null}

      {journal.error ? (
        <div className={styles.erreur} role="alert">
          <p className={styles.erreurTexte}>{journal.error.message}</p>
          <button
            type="button"
            className={styles.bouton}
            onClick={() => (chargementComplet ? void journal.refetch() : void fetchNextPage())}
          >
            Réessayer
          </button>
        </div>
      ) : null}

      {rienDuTout ? (
        <div className={styles.vide}>
          <p>Aucun film pour l’instant.</p>
          <button type="button" className={styles.bouton} onClick={() => naviguer('/recherche')}>
            Ajouter un film
          </button>
        </div>
      ) : rienAvecFiltres ? (
        <div className={styles.vide}>
          <p>{texteRogne ? `Rien trouvé pour « ${texteRogne} ».` : 'Rien avec ces filtres.'}</p>
          <button type="button" className={styles.bouton} onClick={() => setFiltres(FILTRES_INITIAUX)}>
            Effacer
          </button>
        </div>
      ) : (
        <div className={styles.liste}>
          {visibles.map((item) => (
            <LigneFilm key={item.entry.id} item={item} catalogue={catalogue} />
          ))}
        </div>
      )}

      {!actifs && journal.hasNextPage ? <div ref={sentinelle} data-testid="sentinelle-mes-films" /> : null}
    </div>
  )
}

function LigneFilm({ item, catalogue }: { item: JournalItem; catalogue: Reaction[] }) {
  const mots = motsReactions(item.carnet.reactions, catalogue)
  return (
    <Link to={`/journal/${item.entry.id}`} state={{ item }} className={styles.ligne}>
      <Affiche src={item.media.cover_url} titre={item.media.title} note={item.entry.rating} taille="ligne" />
      <div className={styles.infosLigne}>
        <p className={styles.titreLigne}>{item.media.title}</p>
        <p className={styles.sousTitreLigne}>{sousTitre(item.media.director, item.media.year)}</p>
        <p className={styles.dateLigne}>
          {formatDateVisionnage(item.entry.finished_at)}
          {auCinema(item.carnet.reactions) ? (
            <>
              <IconTicket aria-hidden="true" className={styles.iconeTicket} />
              <span className="sr-only">Vu au cinéma</span>
            </>
          ) : null}
        </p>
        {mots ? <p className={styles.reactionsLigne}>{mots}</p> : null}
      </div>
    </Link>
  )
}
