import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { cles } from '../api/cles'
import { journalComplet } from '../api/journal'
import { lireStats } from '../api/stats'
import { BilanCarte, GraphiquesCarte } from '../profil/Cartes'
import { useSession } from '../session/SessionContext'
import Panne from '../ui/Panne'
import { jourLocal } from '../ui/format'
import cartes from '../ui/Page.module.css'
import styles from './Profil.module.css'

/**
 * Le profil (reprise de `ProfileScreen.kt`) : le pseudo, les deux chiffres de `GET /stats`, le
 * bilan et les graphiques calculés depuis le journal entier, « Mes films », l'import Letterboxd,
 * la déconnexion et la mention TMDB. Le Passeport, le Portefeuille et les Coulisses (dépenses,
 * crédits des images) sont ceux du Voyage : ils viendront avec lui. SensCritique n'est pas repris.
 */
export default function Profil() {
  const { user, deconnecter } = useSession()
  const naviguer = useNavigate()
  const stats = useQuery({ queryKey: cles.stats, queryFn: ({ signal }) => lireStats(signal) })
  // Une panne du journal entier se tait : elle ne prive que ces deux cartes, jamais le reste du profil.
  const journal = useQuery({ queryKey: cles.journalComplet, queryFn: ({ signal }) => journalComplet(signal) })

  const total = stats.data?.dashboard.periods.all.counts.finished_by_type.movie
  const cetteAnnee = stats.data?.dashboard.periods.year.counts.finished_by_type.movie

  return (
    <div className={cartes.page}>
      <h1 className={cartes.titre}>{user.pseudo}</h1>

      {stats.error ? (
        <Panne erreur={stats.error} onReessayer={() => void stats.refetch()} />
      ) : total != null && cetteAnnee != null ? (
        <p className={styles.chiffres}>
          <span className={styles.chiffre}>{total}</span> films vus, <span className={styles.chiffre}>{cetteAnnee}</span> cette
          année
        </p>
      ) : null}

      <BilanCarte journal={journal.data} anneeCourante={Number(jourLocal().slice(0, 4))} />
      <GraphiquesCarte journal={journal.data} />

      <Link to="/profil/mes-films" className={styles.entree}>
        <span className={styles.entreeTitre}>Mes films</span>
      </Link>

      {/* Le fichier se choisit ici, se lit et s'envoie sur la page suivante, qui montre l'attente puis le rapport. */}
      <label className={styles.entree}>
        <span className={styles.entreeTitre}>Importer Letterboxd</span>
        <span className={styles.entreeAide}>Le fichier d’export de Letterboxd, ZIP ou diary.csv</span>
        <input
          type="file"
          className="sr-only"
          accept=".zip,.csv,application/zip,text/csv"
          aria-label="Fichier d’export Letterboxd"
          onChange={(event) => {
            const fichier = event.target.files?.[0]
            event.target.value = ''
            if (fichier) naviguer('/profil/import-letterboxd', { state: { fichier } })
          }}
        />
      </label>

      <button type="button" className={cartes.bouton} onClick={() => void deconnecter()}>
        Se déconnecter
      </button>

      {/* Une condition d'utilisation de l'API de TMDB (§3 « Attribution »), pas une politesse : la phrase est la leur, en anglais, non traduite. */}
      <div className={styles.mentionTmdb}>
        <img src={`${import.meta.env.BASE_URL}tmdb.svg`} alt="TMDB" className={styles.logoTmdb} />
        <p>This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.</p>
      </div>
    </div>
  )
}
