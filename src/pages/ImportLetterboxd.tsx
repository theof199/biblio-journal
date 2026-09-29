import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cles } from '../api/cles'
import { INTERVALLE_SUIVI, lancerImport, lireImport } from '../api/letterboxd'
import { candidatDepuisImport } from '../formulaire/candidat'
import { csvDepuisFichier, lireLignesDiary } from '../profil/letterboxd'
import Affiche from '../ui/Affiche'
import BoutonRetour from '../ui/BoutonRetour'
import styles from './ImportLetterboxd.module.css'
import type { CandidatImport, TacheImport } from '../api/letterboxd'

const titreAnnee = (titre: string, annee: number | null) => (annee != null ? `${titre} (${annee})` : titre)

/**
 * L'import Letterboxd (reprise de `RapportImportScreen.kt`) : le fichier choisi au profil arrive
 * par l'état de navigation ; la page l'ouvre (ZIP ou `diary.csv`), l'envoie, suit l'avancement de
 * la tâche puis montre le rapport. Toucher un candidat — sa vignette, son titre, son année — ouvre
 * le formulaire pré-rempli de la date et de la note de sa ligne. Une erreur — lue avant tout
 * réseau ou rendue par l'API — s'affiche par son `message`.
 *
 * **Une tâche suivie** (correctif du 29 septembre 2026) : l'envoi rend la tâche aussitôt, et la
 * page la relit toutes les deux secondes. L'envoi attendait le rapport, et le relais du NAS
 * coupait à 75 s un import qui continuait côté API.
 */
export default function ImportLetterboxd() {
  const location = useLocation()
  const naviguer = useNavigate()
  const client = useQueryClient()
  const fichier = (location.state as { fichier?: unknown } | null)?.fichier
  const fichierValide = fichier instanceof File ? fichier : null

  // Une requête plutôt qu'une mutation, rangée sous la clé de cette entrée d'historique : revenir
  // ici (retour depuis le formulaire d'un candidat, depuis le profil) retrouve la tâche, en cours
  // ou finie, au lieu de renvoyer tout le fichier. Même sous StrictMode, un seul envoi part : le
  // second montage rejoint celui qui court.
  const lancement = useQuery({
    queryKey: ['import-letterboxd', location.key],
    queryFn: async () => {
      const csv = await csvDepuisFichier(new Uint8Array(await fichierValide!.arrayBuffer()))
      const lignes = lireLignesDiary(csv)
      const tache = await lancerImport(csv)
      return { tache, lignes }
    },
    enabled: fichierValide !== null,
    // Une erreur reste affichée au retour, elle ne relance rien : on repart d'un autre fichier.
    retry: false,
    retryOnMount: false,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const id = lancement.data?.tache.id
  const suivi = useQuery({
    queryKey: ['import-letterboxd', location.key, 'suivi'],
    queryFn: async ({ signal }) => {
      const tache = await lireImport(id!, signal)
      // Fini, même interrompu : des films ont pu entrer. Les mêmes clés que `apresEcriture`
      // (Formulaire.tsx).
      if (tache.etat !== 'en_cours') {
        void client.invalidateQueries({ queryKey: cles.journal })
        void client.invalidateQueries({ queryKey: cles.stats })
        void client.invalidateQueries({ queryKey: cles.voyage })
        void client.invalidateQueries({ queryKey: cles.realisateurs })
        void client.invalidateQueries({ queryKey: cles.sagas })
      }
      return tache
    },
    enabled: id !== undefined,
    // Relue tant qu'elle tourne, plus jamais ensuite : le rapport fini se garde tel quel.
    refetchInterval: (requete) => (requete.state.data?.etat === 'en_cours' ? INTERVALLE_SUIVI : false),
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const entete = (
    <div className={styles.entete}>
      <BoutonRetour vers="/profil" />
      <h1 className={styles.titre}>Import Letterboxd</h1>
    </div>
  )

  if (!fichierValide) {
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

  const tache: TacheImport | undefined = suivi.data ?? lancement.data?.tache
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

  const { rapport } = tache
  const lignes = lancement.data!.lignes
  const choisir = (candidat: CandidatImport, ligne: number) =>
    naviguer('/journal/nouveau', { state: { candidat: candidatDepuisImport(candidat, lignes.get(ligne)) } })

  return (
    <div className={styles.page}>
      {entete}
      {tache.etat === 'echoue' && tache.message ? (
        <p role="alert" className={styles.erreur}>
          {tache.message}
        </p>
      ) : null}
      <p>
        {rapport.importes} importés · {rapport.deja_presents} déjà présents
      </p>

      {rapport.non_reconnus.length > 0 ? (
        <>
          <h2 className={styles.section}>Non reconnus</h2>
          {rapport.non_reconnus.map((l) => (
            <div key={l.ligne} className={styles.ligne}>
              <p>{titreAnnee(l.name, l.year)}</p>
              {l.candidats.length === 0 ? (
                <p className={styles.doux}>Aucun candidat</p>
              ) : (
                l.candidats.map((c) => (
                  <button
                    key={c.tmdb_id}
                    type="button"
                    className={styles.candidat}
                    aria-label={titreAnnee(c.title, c.year)}
                    onClick={() => choisir(c, l.ligne)}
                  >
                    <Affiche src={c.cover_url} titre={c.title} taille="ligne" />
                    <span className={styles.candidatTexte}>
                      <span>{titreAnnee(c.title, c.year)}</span>
                      {c.original_title && c.original_title !== c.title ? (
                        <span className={styles.doux}>{c.original_title}</span>
                      ) : null}
                    </span>
                  </button>
                ))
              )}
            </div>
          ))}
        </>
      ) : null}

      {rapport.erreurs.length > 0 ? (
        <>
          <h2 className={styles.section}>Erreurs</h2>
          {rapport.erreurs.map((e) => (
            <p key={e.ligne} className={styles.doux}>
              Ligne {e.ligne} : {e.message}
            </p>
          ))}
        </>
      ) : null}

      <button type="button" className={styles.bouton} onClick={() => naviguer('/profil')}>
        Terminé
      </button>
    </div>
  )
}
