import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { IconSearch, IconTrash, IconX } from '@tabler/icons-react'
import { cles } from '../api/cles'
import { chercherFilms } from '../api/recherche'
import { dejaAuJournal } from '../api/journal'
import { lirePlex } from '../api/plex'
import { estPrete, lireAnnee, lireVoyage } from '../api/voyage'
import {
  candidatDepuisPlex,
  candidatDepuisResultat,
  candidatDepuisVoyageFilm,
  type CandidatFilm,
} from '../formulaire/candidat'
import { ajouterRechercheRecente, ecrireRecherchesRecentes, lireRecherchesRecentes } from '../recherche/recentes'
import { useValeurDebouncee } from '../recherche/useValeurDebouncee'
import Affiche from '../ui/Affiche'
import BoutonRetour from '../ui/BoutonRetour'
import { sousTitre } from '../ui/format'
import styles from './Recherche.module.css'
import type { JournalPage } from '../api/journal'
import type { MovieSearchResult } from '../api/recherche'

/** Une ligne de résultat — recherche, « Tes Ensuite », « à voir cette année » (reprise de `LigneResultat`, `SearchScreen.kt`). */
function LigneResultat({
  candidat,
  vu,
  onChoisir,
}: {
  candidat: CandidatFilm
  vu: number | null | undefined
  onChoisir: () => void
}) {
  return (
    <button type="button" onClick={onChoisir} className={styles.resultat}>
      <Affiche src={candidat.cover_url} titre={candidat.title} taille="ligne" />
      <div className={styles.infosResultat}>
        <p className={styles.titreResultat}>{candidat.title}</p>
        <p className={styles.sousTitreResultat}>{sousTitre(candidat.director, candidat.year)}</p>
      </div>
      {vu !== undefined ? (
        <span className={styles.vuResultat}>{vu != null ? `vu · ${vu}` : 'vu'}</span>
      ) : null}
    </button>
  )
}

/**
 * La recherche d'un film à journaliser (reprise de `SearchScreen.kt`) : un champ débouncé, les
 * dernières recherches avant la saisie, puis « Tes Ensuite » et les films à voir cette année du
 * Voyage en cours. Le repère « vu · note » relit le journal déjà en cache — pas de second appel.
 */
export default function Recherche() {
  const naviguer = useNavigate()
  const client = useQueryClient()
  const [saisie, setSaisie] = useState('')
  const [recentes, setRecentes] = useState<string[]>(() => lireRecherchesRecentes())
  const requete = useValeurDebouncee(saisie, 300)
  const termeNormalise = requete.trim()

  const recherche = useQuery({
    queryKey: ['recherche', 'movie', termeNormalise],
    queryFn: ({ signal }) => chercherFilms(termeNormalise, signal),
    enabled: termeNormalise.length > 0,
  })

  // Mémorisée dès l'envoi de la requête — une recherche sans résultat reste une recherche qu'on a
  // faite (reprise du point 6 de la revue Android du 24 septembre 2026).
  useEffect(() => {
    if (!termeNormalise) return
    setRecentes((existantes) => {
      const misesAJour = ajouterRechercheRecente(existantes, termeNormalise)
      ecrireRecherchesRecentes(misesAJour)
      return misesAJour
    })
  }, [termeNormalise])

  const effacerRecentes = () => {
    setRecentes([])
    ecrireRecherchesRecentes([])
  }

  const plex = useQuery({ queryKey: cles.plex, queryFn: ({ signal }) => lirePlex(signal) })
  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const anneeEnCours = voyage.data?.annee_en_cours
  const annee = useQuery({
    queryKey: anneeEnCours ? cles.annee(anneeEnCours) : ['voyage', 'annee', 'aucune'],
    queryFn: ({ signal }) => lireAnnee(anneeEnCours!, signal),
    enabled: anneeEnCours != null,
  })

  const ensuite = plex.data?.films[0] ? [candidatDepuisPlex(plex.data.films[0])] : []
  const aVoirCetteAnnee = useMemo(() => {
    const fiche = annee.data
    if (!estPrete(fiche)) return []
    return fiche.salles
      .flatMap((salle) => salle.films)
      .filter((film) => film.etat !== 'vu')
      .map(candidatDepuisVoyageFilm)
  }, [annee.data])

  const table = dejaAuJournal(client.getQueryData<{ pages: JournalPage[] }>(cles.journal)?.pages ?? [])
  const vuPour = (externalId: string): number | null | undefined => table.get(externalId)

  const ouvrirFormulaire = (candidat: CandidatFilm) =>
    naviguer('/journal/nouveau', { state: { candidat } })

  const resultats = (recherche.data?.items ?? []).filter(
    (r): r is MovieSearchResult => r.type === 'movie',
  )

  return (
    <div className={styles.page}>
      <div className={styles.entete}>
        <BoutonRetour vers="/" />
        <input
          type="search"
          value={saisie}
          onChange={(event) => setSaisie(event.target.value)}
          placeholder="Un titre de film"
          aria-label="Rechercher un film"
          className={styles.champ}
          autoFocus
        />
        {saisie ? (
          <button type="button" onClick={() => setSaisie('')} aria-label="Effacer">
            <IconX aria-hidden="true" />
          </button>
        ) : (
          <IconSearch aria-hidden="true" />
        )}
      </div>

      <div className={styles.corps}>
        {recherche.error ? <p role="alert">{recherche.error.message}</p> : null}

        {termeNormalise ? (
          recherche.isPending ? (
            <p role="status">Recherche…</p>
          ) : resultats.length === 0 && !recherche.error ? (
            <p className={styles.vide}>Rien trouvé pour « {termeNormalise} ».</p>
          ) : (
            <div className={styles.resultats}>
              {resultats.map((resultat) => (
                <LigneResultat
                  key={resultat.external_id}
                  candidat={candidatDepuisResultat(resultat)}
                  vu={vuPour(resultat.external_id)}
                  onChoisir={() => ouvrirFormulaire(candidatDepuisResultat(resultat))}
                />
              ))}
            </div>
          )
        ) : (
          <>
            {recentes.length > 0 ? (
              <div className={styles.section}>
                <div className={styles.enteteSection}>
                  <p className={styles.titreSection}>Tes dernières recherches</p>
                  <button type="button" onClick={effacerRecentes} aria-label="Effacer les dernières recherches">
                    <IconTrash aria-hidden="true" />
                  </button>
                </div>
                <div className={styles.puces}>
                  {recentes.map((terme) => (
                    <button key={terme} type="button" className={styles.puce} onClick={() => setSaisie(terme)}>
                      {terme}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {ensuite.length > 0 ? (
              <div className={styles.section}>
                <p className={styles.titreSection}>Tes « Ensuite »</p>
                <div className={styles.resultats}>
                  {ensuite.map((candidat) => (
                    <LigneResultat
                      key={`ensuite:${candidat.external_id}`}
                      candidat={candidat}
                      vu={undefined}
                      onChoisir={() => ouvrirFormulaire(candidat)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {aVoirCetteAnnee.length > 0 ? (
              <div className={styles.section}>
                <p className={styles.titreSection}>Pas encore vus, cette année du Voyage</p>
                <div className={styles.resultats}>
                  {aVoirCetteAnnee.map((candidat) => (
                    <LigneResultat
                      key={`voyage:${candidat.external_id}`}
                      candidat={candidat}
                      vu={undefined}
                      onChoisir={() => ouvrirFormulaire(candidat)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
