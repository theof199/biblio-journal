import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { cles } from '../api/cles'
import { lirePageRealisateur, neplusSuivreRealisateur, suivreRealisateur } from '../api/realisateurs'
import { filmsSansSeries, filmsVus } from '../suivis/prochain'
import { IconAward } from '@tabler/icons-react'
import Affiche from '../ui/Affiche'
import Sceau from '../ui/Sceau'
import { filmographieTerminee } from '../profil/bilan'
import BoutonRetour from '../ui/BoutonRetour'
import Panne from '../ui/Panne'
import styles from './PageRealisateur.module.css'

const anneeDe = (date: string) => date.slice(0, 4)

/** « 1861 – 1938 », « né en 1958 »/« née en 1958 »/« naissance en 1958 », ou vide sans aucune date. */
function ligneDates(naissance: string | null, deces: string | null, genre: 'homme' | 'femme' | null): string {
  if (naissance && deces) return `${anneeDe(naissance)} – ${anneeDe(deces)}`
  if (naissance) {
    const annee = anneeDe(naissance)
    if (genre === 'homme') return `né en ${annee}`
    if (genre === 'femme') return `née en ${annee}`
    return `naissance en ${annee}`
  }
  return ''
}

const libelleSuivi = (suivi: boolean, genre: 'homme' | 'femme' | null): string => {
  if (!suivi) return 'Suivre'
  return genre === 'femme' ? 'Suivie' : 'Suivi'
}

/**
 * La page d'un réalisateur (reprise de `RealisateurScreen.kt`) : sa fiche, suivre/ne plus suivre,
 * et sa filmographie — films seulement, les séries écartées comme sur Android (`filmsSansSeries`) :
 * le journal ne connaît que des films. Un film cliqué ouvre sa fiche, qu'il soit vu ou à voir : celle
 * du Voyage s'il figure dans une salle (`voyage`, la plus ancienne année ; décision D5 du plan 2b,
 * `DestinationFilm.Voyage` sur Android), l'onglet Voyage alors marqué et « Retour » qui recule
 * jusqu'ici ; sinon celle des Suivis (`FicheFilm`), avec le film et le réalisateur en état de
 * navigation.
 */
export default function PageRealisateur() {
  const { tmdbId } = useParams<{ tmdbId: string }>()
  const id = Number(tmdbId)
  const client = useQueryClient()
  // Local à cette page, actif par défaut (`rememberSaveable`, `RealisateurScreen.kt`) : à la
  // différence de celui d'une saga, il ne survit pas à une sortie de la page.
  const [masquerIntrouvables, setMasquerIntrouvables] = useState(true)

  const page = useQuery({
    queryKey: cles.pageRealisateur(id),
    queryFn: ({ signal }) => lirePageRealisateur(id, signal),
  })

  const suivi = useMutation({
    mutationFn: async (): Promise<void> => {
      if (page.data!.suivi) await neplusSuivreRealisateur(id)
      else await suivreRealisateur(id)
    },
    // `cles.realisateurs` seule suffit : `cles.pageRealisateur(id)` la préfixe
    // (`['realisateurs', id, 'page']`), TanStack Query invalide donc les deux à l'appel d'un seul —
    // un second appel explicite sur la clé la plus précise redemanderait la page deux fois.
    onSuccess: () => void client.invalidateQueries({ queryKey: cles.realisateurs }),
  })

  if (page.isPending) {
    return (
      <div className={styles.page}>
        <BoutonRetour vers="/suivis" />
        <p role="status">Chargement…</p>
      </div>
    )
  }
  if (page.error) {
    return (
      <div className={styles.page}>
        <BoutonRetour vers="/suivis" />
        <Panne erreur={page.error} onReessayer={() => void page.refetch()} />
      </div>
    )
  }

  const fiche = page.data
  const films = filmsSansSeries(fiche.films)
  // Masqués, les introuvables quittent la liste (`filmsAffiches`) ; l'en-tête garde tous les films —
  // l'interrupteur cache des affiches, il ne change pas la filmographie.
  const filmsAffiches = masquerIntrouvables ? films.filter((film) => !film.introuvable) : films
  const dates = ligneDates(fiche.naissance, fiche.deces, fiche.genre)

  return (
    <div className={styles.page}>
      <div className={styles.entete}>
        <BoutonRetour vers="/suivis" />
      </div>

      <div className={styles.fiche}>
        <span className={styles.portrait}>
          <Affiche src={fiche.photo_url} titre={fiche.name} taille="ligne" className={styles.photo} />
          {/* Le sceau de la rétrospective complète (`retrospectiveComplete`, Android) : tout vu ou
              introuvable — vide aussi, rien n'y reste à voir. Jumeau de celui des cartes des Suivis. */}
          {filmographieTerminee(films) ? (
            <Sceau icone={IconAward} libelle="Rétrospective complète" className={styles.sceau} />
          ) : null}
        </span>
        <div className={styles.infos}>
          <h1 className={styles.nom}>{fiche.name}</h1>
          {dates ? <p className={styles.dates}>{dates}</p> : null}
          <p className={styles.compte}>
            {filmsVus(films)} vus sur {films.length}
          </p>
        </div>
      </div>

      <button
        type="button"
        className={styles.boutonSuivre}
        onClick={() => suivi.mutate()}
        disabled={suivi.isPending}
      >
        {libelleSuivi(fiche.suivi, fiche.genre)}
      </button>
      {suivi.error ? (
        <p role="alert">{suivi.error instanceof Error ? suivi.error.message : String(suivi.error)}</p>
      ) : null}

      {fiche.presentation ? <p className={styles.presentation}>{fiche.presentation}</p> : null}

      <label className={styles.interrupteur}>
        <input
          type="checkbox"
          role="switch"
          checked={masquerIntrouvables}
          onChange={(event) => setMasquerIntrouvables(event.target.checked)}
        />
        Masquer les introuvables
      </label>

      {films.length === 0 ? (
        <p className={styles.vide}>Aucun film connu pour ce réalisateur.</p>
      ) : (
        <ul className={styles.liste}>
          {filmsAffiches.map((film) => (
            <li key={film.tmdb_id}>
              <Link
                to={film.voyage ? `/voyage/${film.voyage.annee}/films/${film.voyage.film_id}` : `/suivis/films/${film.tmdb_id}`}
                state={film.voyage ? undefined : { film, realisateur: { tmdb_id: id, name: fiche.name } }}
                className={styles.film}
              >
                <Affiche src={film.cover_url} titre={film.title} taille="ligne" />
                <div className={styles.infosFilm}>
                  <p className={styles.titreFilm}>
                    {film.title}
                    {film.year ? ` (${film.year})` : ''}
                  </p>
                  <p className={styles.etatFilm}>
                    {film.vu ? `Vu${film.vu.rating != null ? ` · ${film.vu.rating}/10` : ''}` : film.introuvable ? 'Introuvable' : 'À voir'}
                    {/* Le lien mène à l'onglet Voyage, à l'année de `voyage` : le signe l'annonce
                        (décision du propriétaire du 1er octobre 2026). */}
                    {film.voyage ? <span className={styles.signeVoyage}>{` · Voyage ${film.voyage.annee}`}</span> : null}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
