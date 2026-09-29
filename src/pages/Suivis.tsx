import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { cles } from '../api/cles'
import { lireRealisateurs, suivreRealisateur, type Realisateur } from '../api/realisateurs'
import { lireSagas, suivreSaga, type Saga } from '../api/sagas'
import { chercherRealisateurs, chercherSagas } from '../api/personnes'
import { compteCarte, dernierVisionnage, LIBELLES_SUIVI, repartirSuivis, sousLigneCarte } from '../suivis/liste'
import type { EtatFilmographie, SourceSuivi } from '../suivis/liste'
import { useMasquerIntrouvables } from '../suivis/masquer'
import { useFilmographiesRealisateurs, useFilmographiesSagas } from '../suivis/useFilmographies'
import type { FilmSuivi } from '../suivis/prochain'
import { jourLocal } from '../ui/format'
import Affiche from '../ui/Affiche'
import Panne from '../ui/Panne'
import { useValeurDebouncee } from '../recherche/useValeurDebouncee'
import styles from './Suivis.module.css'

/**
 * `chercherRealisateurs`/`chercherSagas` rendent `profile_url`/`cover_url` — deux noms pour la
 * même idée d'image — ramenés ici à `image_url`, seul champ que `SectionSuivis` lit.
 */
const chercherRealisateursPourSuivis = async (q: string, signal?: AbortSignal) => {
  const { results } = await chercherRealisateurs(q, signal)
  return { results: results.map((r) => ({ tmdb_id: r.tmdb_id, name: r.name, image_url: r.profile_url })) }
}
const chercherSagasPourSuivis = async (q: string, signal?: AbortSignal) => {
  const { results } = await chercherSagas(q, signal)
  return { results: results.map((r) => ({ tmdb_id: r.tmdb_id, name: r.name, image_url: r.cover_url })) }
}

interface ResultatRecherche {
  tmdb_id: number
  name: string
  image_url: string | null
}

type Suivie = { tmdb_id: number; name: string; ajoute_le: string }

interface Props<E extends Suivie> {
  source: SourceSuivi
  /** Leurs films, chargés l'un après l'autre (`useFilmographies`) : la ligne sous chaque nom, l'ordre et les « complets » en dépendent. */
  filmographies: ReadonlyMap<number, EtatFilmographie<FilmSuivi>>
  masquerIntrouvables: boolean
  /** Le jour d'aujourd'hui (`AAAA-MM-JJ`), lu une fois : « vu il y a 3 jours » ne se recalcule pas à minuit. */
  aujourdHui: string
  titre: string
  libelleVide: string
  placeholderRecherche: string
  entites: E[] | undefined
  isPending: boolean
  erreur: unknown
  onReessayer: () => void
  image: (entite: E) => string | null
  lienDetail: (tmdbId: number) => string
  chercher: (q: string, signal?: AbortSignal) => Promise<{ results: ResultatRecherche[] }>
  suivre: (tmdbId: number) => Promise<unknown>
  clesListe: readonly unknown[]
}

/**
 * Une section de l'onglet Suivis (réalisateurs ou sagas) : la liste de ce qui est déjà suivi, puis
 * une recherche pour en suivre d'autres — reprise de `SuivisScreen.kt` et `ChercherSuiviScreen.kt`,
 * réunis ici en une seule page plutôt qu'un écran séparé.
 */
function SectionSuivis<E extends Suivie>({
  source,
  filmographies,
  masquerIntrouvables,
  aujourdHui,
  titre,
  libelleVide,
  placeholderRecherche,
  entites,
  isPending,
  erreur,
  onReessayer,
  image,
  lienDetail,
  chercher,
  suivre,
  clesListe,
}: Props<E>) {
  const client = useQueryClient()
  const [saisie, setSaisie] = useState('')
  const requete = useValeurDebouncee(saisie, 300).trim()

  const recherche = useQuery({
    queryKey: [...clesListe, 'recherche', requete],
    queryFn: ({ signal }) => chercher(requete, signal),
    enabled: requete.length > 0,
  })

  const suiviMutation = useMutation({
    mutationFn: (tmdbId: number) => suivre(tmdbId),
    onSuccess: () => void client.invalidateQueries({ queryKey: clesListe }),
  })

  const tmdbIdsSuivis = useMemo(() => new Set((entites ?? []).map((e) => e.tmdb_id)), [entites])
  // En cours d'abord, bouclées ensuite (la section « complets »), chacune de la plus récemment
  // active à la plus ancienne : un ordre d'affichage seulement, la liste du back reste celle du cache.
  const { enCours, bouclees } = useMemo(
    () => repartirSuivis(entites ?? [], filmographies),
    [entites, filmographies],
  )

  const ligne = (entite: E, bouclee: boolean) => {
    const etat = filmographies.get(entite.tmdb_id)
    let sousLigne = '…'
    if (etat?.statut === 'indisponible') sousLigne = 'indisponible'
    else if (etat?.statut === 'pret') {
      const { vus, total } = compteCarte(source, etat.films, masquerIntrouvables)
      sousLigne = sousLigneCarte(source, vus, total, dernierVisionnage(etat.films), entite.ajoute_le, aujourdHui, bouclee)
    }
    return (
      <li key={entite.tmdb_id}>
        <Link to={lienDetail(entite.tmdb_id)} className={styles.entite}>
          <Affiche src={image(entite)} titre={entite.name} taille="ligne" />
          <span className={styles.texteEntite}>
            <span className={styles.nomEntite}>{entite.name}</span>
            <span className={styles.sousLigne}>{sousLigne}</span>
          </span>
        </Link>
      </li>
    )
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.titreSection}>{titre}</h2>

      {isPending ? (
        <p role="status">Chargement…</p>
      ) : erreur ? (
        <Panne erreur={erreur} onReessayer={onReessayer} />
      ) : entites && entites.length > 0 ? (
        <>
          {enCours.length > 0 ? <ul className={styles.liste}>{enCours.map((entite) => ligne(entite, false))}</ul> : null}
          {bouclees.length > 0 ? (
            <>
              <h3 className={styles.titreComplets}>{LIBELLES_SUIVI[source].titreComplets}</h3>
              <ul className={styles.liste}>{bouclees.map((entite) => ligne(entite, true))}</ul>
            </>
          ) : null}
        </>
      ) : (
        <p className={styles.vide}>{libelleVide}</p>
      )}

      <input
        type="search"
        value={saisie}
        onChange={(event) => setSaisie(event.target.value)}
        placeholder={placeholderRecherche}
        aria-label={placeholderRecherche}
        className={styles.champRecherche}
      />

      {requete ? (
        recherche.error ? (
          <p role="alert">{recherche.error instanceof Error ? recherche.error.message : String(recherche.error)}</p>
        ) : recherche.isPending ? (
          <p role="status">Recherche…</p>
        ) : recherche.data!.results.length === 0 ? (
          <p className={styles.vide}>Rien trouvé pour « {requete} ».</p>
        ) : (
          <ul className={styles.liste}>
            {recherche.data!.results.map((resultat) => {
              const dejaSuivi = tmdbIdsSuivis.has(resultat.tmdb_id)
              return (
                <li key={resultat.tmdb_id} className={styles.resultatRecherche}>
                  <Affiche src={resultat.image_url} titre={resultat.name} taille="ligne" />
                  <span className={styles.nomEntite}>{resultat.name}</span>
                  <button
                    type="button"
                    className={styles.boutonSuivre}
                    disabled={dejaSuivi || suiviMutation.isPending}
                    onClick={() => suiviMutation.mutate(resultat.tmdb_id)}
                  >
                    {dejaSuivi ? 'Suivi' : 'Suivre'}
                  </button>
                </li>
              )
            })}
          </ul>
        )
      ) : null}

      {suiviMutation.error ? (
        <p role="alert">
          {suiviMutation.error instanceof Error ? suiviMutation.error.message : String(suiviMutation.error)}
        </p>
      ) : null}
    </section>
  )
}

/**
 * L'onglet Suivis (reprise de `SuivisScreen.kt`) : les réalisateurs suivis et les sagas suivies,
 * chacun avec sa recherche pour en suivre d'autres. Un clic sur une entité déjà suivie ouvre sa
 * page (`PageRealisateur`/`PageSaga`), qui porte le bouton pour ne plus la suivre — la liste
 * elle-même ne fait qu'afficher et chercher.
 */
export default function Suivis() {
  const realisateurs = useQuery({ queryKey: cles.realisateurs, queryFn: ({ signal }) => lireRealisateurs(signal) })
  const sagas = useQuery({ queryKey: cles.sagas, queryFn: ({ signal }) => lireSagas(signal) })

  // Leurs films, une entité après l'autre — jamais toutes d'un coup (`useFilmographies`).
  const filmsRealisateurs = useFilmographiesRealisateurs(realisateurs.data)
  const filmsSagas = useFilmographiesSagas(sagas.data)
  const masquerIntrouvables = useMasquerIntrouvables()
  const aujourdHui = useMemo(() => jourLocal(), [])

  return (
    <div className={styles.page}>
      <h1 className={styles.titre}>Suivis</h1>

      <SectionSuivis<Realisateur>
        source="realisateurs"
        filmographies={filmsRealisateurs}
        masquerIntrouvables={masquerIntrouvables}
        aujourdHui={aujourdHui}
        titre="Réalisateurs"
        libelleVide="Tu ne suis aucun réalisateur."
        placeholderRecherche="Un nom de réalisateur"
        entites={realisateurs.data}
        isPending={realisateurs.isPending}
        erreur={realisateurs.error}
        onReessayer={() => void realisateurs.refetch()}
        image={(r) => r.profile_url}
        lienDetail={(tmdbId) => `/suivis/realisateurs/${tmdbId}`}
        chercher={chercherRealisateursPourSuivis}
        suivre={suivreRealisateur}
        clesListe={cles.realisateurs}
      />

      <SectionSuivis<Saga>
        source="sagas"
        filmographies={filmsSagas}
        masquerIntrouvables={masquerIntrouvables}
        aujourdHui={aujourdHui}
        titre="Sagas"
        libelleVide="Tu ne suis aucune saga."
        placeholderRecherche="Un nom de saga"
        entites={sagas.data}
        isPending={sagas.isPending}
        erreur={sagas.error}
        onReessayer={() => void sagas.refetch()}
        image={(s) => s.cover_url}
        lienDetail={(tmdbId) => `/suivis/sagas/${tmdbId}`}
        chercher={chercherSagasPourSuivis}
        suivre={suivreSaga}
        clesListe={cles.sagas}
      />
    </div>
  )
}
