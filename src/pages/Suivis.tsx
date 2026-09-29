import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { cles } from '../api/cles'
import { lireRealisateurs, suivreRealisateur, type Realisateur } from '../api/realisateurs'
import { lireSagas, suivreSaga, type Saga } from '../api/sagas'
import { chercherRealisateurs, chercherSagas } from '../api/personnes'
import {
  casesBande,
  compteCarte,
  compteSuivis,
  dernierVisionnage,
  LIBELLES_SUIVI,
  repartirSuivis,
  sousLigneCarte,
} from '../suivis/liste'
import type { EtatBande, EtatFilmographie, FilmCarte, SourceSuivi } from '../suivis/liste'
import { useMasquerIntrouvables } from '../suivis/masquer'
import { useFilmographiesRealisateurs, useFilmographiesSagas } from '../suivis/useFilmographies'
import { prochainAVoir } from '../suivis/prochain'
import { jourLocal } from '../ui/format'
import { IconAward, IconCheck } from '@tabler/icons-react'
import Affiche from '../ui/Affiche'
import Sceau from '../ui/Sceau'
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
  filmographies: ReadonlyMap<number, EtatFilmographie<FilmCarte>>
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

  const ligne = (entite: E, bouclee: boolean) => (
    <CarteSuivi
      key={entite.tmdb_id}
      source={source}
      nom={entite.name}
      image={image(entite)}
      ajouteLe={entite.ajoute_le}
      lien={lienDetail(entite.tmdb_id)}
      etat={filmographies.get(entite.tmdb_id)}
      masquerIntrouvables={masquerIntrouvables}
      aujourdHui={aujourdHui}
      bouclee={bouclee}
    />
  )

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
      <div className={styles.entete}>
        <h1 className={styles.titre}>Suivis</h1>
        {/* Absent tant qu'une des deux listes n'a pas répondu : pas de « 0 rétrospective » qui grimperait sous les yeux. */}
        {realisateurs.data && sagas.data ? (
          <p className={styles.compteSuivis}>{compteSuivis(realisateurs.data.length, sagas.data.length)}</p>
        ) : null}
      </div>

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

const DESCRIPTION_CASE: Record<EtatBande, string> = {
  vu: 'vu',
  prochain: 'prochain à voir',
  'pas-encore': 'pas encore',
  introuvable: 'introuvable',
}

/**
 * Une carte par rétrospective ou par cycle (reprise de `CarteSuivi`, `SuivisScreen.kt`) :
 * - le portrait (une rétrospective bouclée y porte le sceau « Rétrospective complète » ; un cycle
 *   bouclé n'en a pas, sa bande toute cochée le dit), le nom, la ligne sous le nom, « 4/12 » à
 *   droite — accentué une fois bouclée ;
 * - la bande de ses films pour un cycle (`casesBande`), en rangées de six ;
 * - « Ensuite » et le prochain film à voir, sauf une fois bouclée.
 * Filmographie en attente ou en panne : le nom, puis « … » ou « indisponible », rien d'autre.
 *
 * Toute la carte ouvre la page de l'entité (le lien s'étend sur elle), mais seul l'en-tête nomme ce
 * lien : la bande se lit case par case, pas en un seul nom de lien interminable.
 */
function CarteSuivi({
  source,
  nom,
  image,
  ajouteLe,
  lien,
  etat,
  masquerIntrouvables,
  aujourdHui,
  bouclee,
}: {
  source: SourceSuivi
  nom: string
  image: string | null
  ajouteLe: string
  lien: string
  etat: EtatFilmographie<FilmCarte> | undefined
  masquerIntrouvables: boolean
  aujourdHui: string
  bouclee: boolean
}) {
  const films = etat?.statut === 'pret' ? etat.films : null
  const cycle = source === 'sagas'
  const { vus, total } = films ? compteCarte(source, films, masquerIntrouvables) : { vus: 0, total: 0 }
  const prochain = films && !bouclee ? prochainAVoir(films) : undefined

  return (
    <li className={bouclee ? `${styles.carte} ${styles.carteBouclee}` : styles.carte}>
      <Link to={lien} className={styles.entite}>
        <span className={styles.portrait}>
          <Affiche src={image} titre={nom} taille="ligne" />
          {bouclee && !cycle ? <Sceau icone={IconAward} libelle="Rétrospective complète" className={styles.sceau} /> : null}
        </span>
        <span className={styles.texteEntite}>
          <span className={styles.nomEntite}>{nom}</span>
          <span className={styles.sousLigne}>
            {films
              ? sousLigneCarte(source, vus, total, dernierVisionnage(films), ajouteLe, aujourdHui, bouclee)
              : etat?.statut === 'indisponible'
                ? 'indisponible'
                : '…'}
          </span>
        </span>
        {films ? (
          <span role="img" aria-label={`${vus} sur ${total}`} className={bouclee ? `${styles.compte} ${styles.compteBoucle}` : styles.compte}>
            {vus}
            <span className={styles.denominateur}>/{total}</span>
          </span>
        ) : null}
      </Link>

      {films && cycle ? (
        <ul className={styles.bande} aria-label={`Les films de ${nom}`}>
          {casesBande(films, masquerIntrouvables).map(({ film, etat: etatCase }) => (
            <li key={film.tmdb_id} aria-label={`${film.title}, ${DESCRIPTION_CASE[etatCase]}`} data-etat={etatCase} className={styles.case}>
              <span className={styles.afficheCase}>
                <Affiche src={film.cover_url} titre={film.title} />
                {etatCase === 'vu' ? (
                  <span className={styles.coche} aria-hidden="true">
                    <IconCheck className={styles.iconeCoche} />
                  </span>
                ) : null}
                {etatCase === 'introuvable' ? (
                  <span className={styles.perdu} aria-hidden="true">
                    Perdu
                  </span>
                ) : null}
              </span>
              <span className={styles.anneeCase} aria-hidden="true">
                {film.year ?? '—'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {prochain ? (
        <p className={styles.ensuite}>
          <Affiche src={prochain.cover_url} titre={prochain.title} taille="ligne" />
          <span className={styles.texteEntite}>
            <span className={styles.etiquetteEnsuite}>Ensuite</span>
            <span className={styles.titreEnsuite}>
              {prochain.year != null ? `${prochain.title} (${prochain.year})` : prochain.title}
            </span>
          </span>
        </p>
      ) : null}
    </li>
  )
}
