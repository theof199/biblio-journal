import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cles } from '../api/cles'
import { importerLetterboxd } from '../api/letterboxd'
import { candidatDepuisImport } from '../formulaire/candidat'
import { csvDepuisFichier, lireLignesDiary } from '../profil/letterboxd'
import BoutonRetour from '../ui/BoutonRetour'
import styles from './ImportLetterboxd.module.css'
import type { CandidatImport } from '../api/letterboxd'

const titreAnnee = (titre: string, annee: number | null) => (annee != null ? `${titre} (${annee})` : titre)

/**
 * L'import Letterboxd (reprise de `RapportImportScreen.kt`) : le fichier choisi au profil arrive
 * par l'état de navigation ; la page l'ouvre (ZIP ou `diary.csv`), l'envoie, montre l'attente puis
 * le rapport. Toucher un candidat ouvre le formulaire pré-rempli de la date et de la note de sa
 * ligne. Une erreur — lue avant tout réseau ou rendue par l'API — s'affiche par son `message`.
 */
export default function ImportLetterboxd() {
  const location = useLocation()
  const naviguer = useNavigate()
  const client = useQueryClient()
  const fichier = (location.state as { fichier?: unknown } | null)?.fichier
  const fichierValide = fichier instanceof File ? fichier : null

  const importer = useMutation({
    mutationFn: async (f: File) => {
      const csv = await csvDepuisFichier(new Uint8Array(await f.arrayBuffer()))
      const lignes = lireLignesDiary(csv)
      return { rapport: await importerLetterboxd(csv), lignes }
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: cles.journal })
      void client.invalidateQueries({ queryKey: cles.stats })
      void client.invalidateQueries({ queryKey: cles.voyage })
    },
  })

  // Une seule fois, même sous StrictMode : un second envoi refairait deux minutes de recherches.
  const lance = useRef(false)
  useEffect(() => {
    if (fichierValide && !lance.current) {
      lance.current = true
      importer.mutate(fichierValide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  if (importer.error) {
    return (
      <div className={styles.page}>
        {entete}
        <p role="alert" className={styles.erreur}>
          {importer.error.message}
        </p>
      </div>
    )
  }

  if (!importer.data) {
    return (
      <div className={styles.page}>
        {entete}
        <p role="status" className={styles.doux}>
          Import en cours…
        </p>
      </div>
    )
  }

  const { rapport, lignes } = importer.data
  const choisir = (candidat: CandidatImport, ligne: number) =>
    naviguer('/journal/nouveau', { state: { candidat: candidatDepuisImport(candidat, lignes.get(ligne)) } })

  return (
    <div className={styles.page}>
      {entete}
      <p>
        {rapport.importes} importés · {rapport.deja_presents} déjà présents
      </p>

      {rapport.non_reconnus.length > 0 ? (
        <>
          <h2 className={styles.section}>Non reconnus</h2>
          {rapport.non_reconnus.map((l) => (
            <div key={l.ligne}>
              <p>{titreAnnee(l.name, l.year)}</p>
              {l.candidats.length === 0 ? (
                <p className={styles.doux}>Aucun candidat</p>
              ) : (
                l.candidats.map((c) => (
                  <button key={c.tmdb_id} type="button" className={styles.candidat} onClick={() => choisir(c, l.ligne)}>
                    {titreAnnee(c.title, c.year)}
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
