import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { cles } from '../api/cles'
import { creerVisionnage } from '../api/journal'
import { INTERVALLE_SUIVI, cleLigne, lancerImport, lireImport } from '../api/letterboxd'
import { fichiersDepuisExport } from '../profil/letterboxd'
import { ecrireResolutions, lireResolutions, type Resolution, type Resolutions } from '../profil/resolutions'
import Affiche from '../ui/Affiche'
import BoutonRetour from '../ui/BoutonRetour'
import { formatDateVisionnage } from '../ui/format'
import styles from './ImportLetterboxd.module.css'
import type { CandidatImport, LigneNonReconnue, TacheImport } from '../api/letterboxd'

const titreAnnee = (titre: string, annee: number | null) => (annee != null ? `${titre} (${annee})` : titre)

/**
 * L'import Letterboxd (reprise de `RapportImportScreen.kt`) : le fichier choisi au profil arrive
 * par l'état de navigation ; la page l'ouvre (ZIP ou `diary.csv`), l'envoie, suit l'avancement de
 * la tâche puis montre le rapport. Une erreur — lue avant tout réseau ou rendue par l'API —
 * s'affiche par son `message`.
 *
 * **Une tâche suivie** (correctif du 29 septembre 2026) : l'envoi rend la tâche aussitôt, et la
 * page la relit toutes les deux secondes.
 *
 * **La tâche dans l'adresse** (correctif du 30 septembre 2026). Une fois lancée, son identifiant
 * remplace le fichier dans l'historique (`?tache=`) : un retour arrière ou un rechargement relit
 * le rapport chez l'API, qui le garde 24 heures, sans rien renvoyer.
 *
 * **Un candidat se choisit dans le rapport** (même correctif). Le toucher enregistre le visionnage
 * avec la date et la note de sa ligne — `POST /media` puis `POST /me/journal`, comme le formulaire —
 * et la ligne passe à « ajouté », le rapport restant à l'écran. Il ouvrait le formulaire, qui
 * revenait à l'accueil : le rapport était perdu. « Corriger » rouvre le formulaire sur le
 * visionnage enregistré.
 */
export default function ImportLetterboxd() {
  const location = useLocation()
  const naviguer = useNavigate()
  const client = useQueryClient()
  const [parametres] = useSearchParams()
  const idDansLAdresse = parametres.get('tache')
  const fichier = (location.state as { fichier?: unknown } | null)?.fichier
  const fichierValide = idDansLAdresse === null && fichier instanceof File ? fichier : null

  // Une requête plutôt qu'une mutation, rangée sous la clé de cette entrée d'historique : même
  // sous StrictMode, un seul envoi part — le second montage rejoint celui qui court. Une erreur
  // reste affichée au retour, elle ne relance rien : on repart d'un autre fichier.
  const lancement = useQuery({
    queryKey: ['import-letterboxd', 'lancement', location.key],
    queryFn: async () => lancerImport(await fichiersDepuisExport(new Uint8Array(await fichierValide!.arrayBuffer()))),
    enabled: fichierValide !== null,
    retry: false,
    retryOnMount: false,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  // Lancée : la tâche prend la place du fichier dans l'historique.
  const lancee = lancement.data?.id
  useEffect(() => {
    if (lancee) naviguer({ search: `?tache=${lancee}` }, { replace: true })
  }, [lancee, naviguer])

  const id = idDansLAdresse ?? lancee
  const suivi = useQuery({
    queryKey: ['import-letterboxd', 'tache', id],
    queryFn: async ({ signal }) => {
      const tache = await lireImport(id!, signal)
      // Fini, même interrompu : des films ont pu entrer. Les mêmes clés que `apresEcriture`
      // (Formulaire.tsx).
      if (tache.etat !== 'en_cours') invaliderApresEcriture(client)
      return tache
    },
    enabled: id != null,
    // Relue tant qu'elle tourne, plus jamais ensuite : le rapport fini se garde tel quel. Une
    // erreur définitive (tâche introuvable, session perdue) arrête aussi la relecture : la dernière
    // donnée reçue dit encore `en_cours`, et l'intervalle continuerait derrière le message. Une
    // erreur passagère (réseau, API qui redémarre) la laisse courir : la relecture suivante
    // retrouve la tâche, ou la dit interrompue.
    refetchInterval: (requete) => {
      const { data, error } = requete.state
      if (error && !(error instanceof ApiError && error.retryable)) return false
      return data?.etat === 'en_cours' ? INTERVALLE_SUIVI : false
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const entete = (
    <div className={styles.entete}>
      <BoutonRetour vers="/profil" />
      <h1 className={styles.titre}>Import Letterboxd</h1>
    </div>
  )

  if (!fichierValide && id == null) {
    return (
      <div className={styles.page}>
        {entete}
        <p>Aucun fichier choisi. Repars du profil.</p>
        <Link to="/profil">Retour au profil</Link>
      </div>
    )
  }

  const erreur = lancement.error ?? suivi.error
  if (erreur) {
    return (
      <div className={styles.page}>
        {entete}
        <p role="alert" className={styles.erreur}>
          {erreur.message}
        </p>
      </div>
    )
  }

  const tache: TacheImport | undefined = suivi.data ?? lancement.data
  if (!tache || tache.etat === 'en_cours') {
    return (
      <div className={styles.page}>
        {entete}
        <p role="status" className={styles.doux}>
          {tache && tache.lignes_total > 0
            ? `Import en cours… ${tache.lignes_traitees} / ${tache.lignes_total} lignes`
            : 'Import en cours…'}
        </p>
        {tache && tache.lignes_total > 0 ? (
          <progress className={styles.progression} value={tache.lignes_traitees} max={tache.lignes_total} />
        ) : null}
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {entete}
      {/* Une clé par tâche : l'état des lignes tranchées se relit sous la sienne, jamais sous une autre. */}
      <Rapport key={tache.id} tache={tache} />
      <button type="button" className={styles.bouton} onClick={() => naviguer('/profil')}>
        Terminé
      </button>
    </div>
  )
}

/** Les mêmes clés qu'après le formulaire : le journal, les chiffres, le Voyage, les filmographies suivies. */
function invaliderApresEcriture(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: cles.journal })
  void client.invalidateQueries({ queryKey: cles.stats })
  void client.invalidateQueries({ queryKey: cles.voyage })
  void client.invalidateQueries({ queryKey: cles.realisateurs })
  void client.invalidateQueries({ queryKey: cles.sagas })
}

function Rapport({ tache }: { tache: TacheImport }) {
  const { rapport } = tache
  const vus = rapport.vus_sans_date
  const [resolues, setResolues] = useState<Resolutions>(() => lireResolutions(tache.id))

  const resoudre = (cle: string, resolution: Resolution) =>
    setResolues((avant) => {
      const apres = { ...avant, [cle]: resolution }
      ecrireResolutions(tache.id, apres)
      return apres
    })

  return (
    <>
      {tache.etat === 'echoue' && tache.message ? (
        <p role="alert" className={styles.erreur}>
          {tache.message}
        </p>
      ) : null}
      <p>
        {rapport.importes} importés · {rapport.deja_presents} déjà présents
      </p>
      {vus.lignes > 0 ? (
        // Les films de `watched.csv` qui ne sont pas dans `diary.csv` : vus, sans date de visionnage.
        <p>
          Films vus sans date précise : {vus.lignes} — {vus.importes} importés à la date où tu les as marqués vus ·{' '}
          {vus.deja_presents} déjà au journal
        </p>
      ) : null}

      {rapport.non_reconnus.length > 0 ? (
        <>
          <h2 className={styles.section}>Non reconnus</h2>
          {rapport.non_reconnus.map((ligne) => {
            const cle = cleLigne(ligne)
            return <LigneRapport key={cle} ligne={ligne} tacheId={tache.id} resolution={resolues[cle]} onResolue={(r) => resoudre(cle, r)} />
          })}
        </>
      ) : null}

      {rapport.erreurs.length > 0 ? (
        <>
          <h2 className={styles.section}>Erreurs</h2>
          {rapport.erreurs.map((e) => (
            <p key={cleLigne(e)} className={styles.doux}>
              {e.fichier === 'watched' ? 'watched.csv, ligne' : 'Ligne'} {e.ligne} : {e.message}
            </p>
          ))}
        </>
      ) : null}
    </>
  )
}

interface PropsLigne {
  ligne: LigneNonReconnue
  tacheId: string
  resolution: Resolution | undefined
  onResolue: (resolution: Resolution) => void
}

function LigneRapport({ ligne, tacheId, resolution, onResolue }: PropsLigne) {
  const client = useQueryClient()
  const naviguer = useNavigate()
  const enregistrement = useMutation({
    mutationFn: (candidat: CandidatImport) =>
      creerVisionnage(
        { source: 'tmdb', external_id: candidat.tmdb_id, type: 'movie' },
        { finished_at: ligne.date, ...(ligne.rating != null ? { rating: ligne.rating } : {}) },
      ),
    onSuccess: (item, candidat) => {
      invaliderApresEcriture(client)
      onResolue({ tmdb_id: candidat.tmdb_id, titre: candidat.title, annee: candidat.year, item })
    },
  })

  const quand =
    ligne.fichier === 'watched'
      ? `Vu sans date précise, marqué vu le ${formatDateVisionnage(ligne.date)}`
      : `Vu le ${formatDateVisionnage(ligne.date)}`

  return (
    <div className={styles.ligne}>
      <p className={styles.nom}>{titreAnnee(ligne.name, ligne.year)}</p>
      <p className={styles.doux}>
        {quand}
        {ligne.rating != null ? ` · ${ligne.rating}/10` : ''}
      </p>
      {resolution ? (
        <div className={styles.resolue}>
          <p role="status">Ajouté : {titreAnnee(resolution.titre, resolution.annee)}</p>
          <button
            type="button"
            className={styles.secondaire}
            onClick={() =>
              naviguer(`/journal/${resolution.item.entry.id}/corriger`, {
                state: { item: resolution.item, retour: `/profil/import-letterboxd?tache=${tacheId}` },
              })
            }
          >
            Corriger
          </button>
        </div>
      ) : ligne.candidats.length === 0 ? (
        <p className={styles.doux}>Aucun candidat</p>
      ) : (
        <>
          {ligne.candidats.map((c) => (
            <button
              key={c.tmdb_id}
              type="button"
              className={styles.candidat}
              aria-label={titreAnnee(c.title, c.year)}
              disabled={enregistrement.isPending}
              onClick={() => enregistrement.mutate(c)}
            >
              <Affiche src={c.cover_url} titre={c.title} taille="ligne" />
              <span className={styles.candidatTexte}>
                <span>{titreAnnee(c.title, c.year)}</span>
                {c.original_title && c.original_title !== c.title ? (
                  <span className={styles.doux}>{c.original_title}</span>
                ) : null}
              </span>
            </button>
          ))}
          {enregistrement.isPending ? (
            <p role="status" className={styles.doux}>
              Ajout en cours…
            </p>
          ) : null}
          {enregistrement.error ? (
            <p role="alert" className={styles.erreur}>
              {enregistrement.error.message}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
