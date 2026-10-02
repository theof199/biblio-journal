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
import { apercuLitLaFiche } from '../voyage/regles'
import Affiche from '../ui/Affiche'
import Attente, { Barre } from '../ui/Attente'
import BoutonRetour from '../ui/BoutonRetour'
import Etoiles from '../ui/Etoiles'
import { sousTitre } from '../ui/format'
import styles from './Recherche.module.css'
import type { JournalPage } from '../api/journal'
import type { MovieSearchResult } from '../api/recherche'

/** Deux rangées de la grille, trois affiches chacune. */
const AFFICHES_EN_ATTENTE = 6

/** L'étiquette de papier collée sur une affiche déjà vue : ses étoiles si elle est notée, le mot « vu » au crayon sinon. */
function EtiquetteVu({ note }: { note: number | null }) {
  return (
    <span className={styles.vu}>
      {note != null ? <Etoiles note={note} libelle={`vu, noté ${note} sur 10`} className={styles.etoilesVu} /> : <span className={styles.motVu}>vu</span>}
    </span>
  )
}

/** Une affiche de résultat — recherche, « Tes Ensuite », « à voir cette année » (reprise de `LigneResultat`, `SearchScreen.kt`) : le titre et « réalisateur, année » dessous. */
function AfficheResultat({
  candidat,
  vu,
  onChoisir,
}: {
  candidat: CandidatFilm
  vu: number | null | undefined
  onChoisir: () => void
}) {
  return (
    <li>
      <button type="button" onClick={onChoisir} className={styles.resultat}>
        {/* Sans affiche, le titre est imprimé sur le cadre : le bouton le dit déjà, d'où `aria-hidden`. */}
        <Affiche
          src={candidat.cover_url}
          titre={candidat.title}
          substitut={
            <span className={styles.sansAffiche} aria-hidden="true">
              {candidat.title}
            </span>
          }
        />
        <span className={styles.infosResultat}>
          <span className={styles.titreResultat}>{candidat.title}</span>
          <span className={styles.sousTitreResultat}>{sousTitre(candidat.director, candidat.year)}</span>
        </span>
        {vu !== undefined ? <EtiquetteVu note={vu} /> : null}
      </button>
    </li>
  )
}

/**
 * Le guichet : la recherche d'un film à journaliser (reprise de `SearchScreen.kt`), des affiches à
 * toucher, trois par rangée. Un champ débouncé, les dernières recherches avant la saisie, puis
 * « Tes Ensuite » et les films à voir cette année du Voyage en cours. L'étiquette « vu » (ses étoiles,
 * ou le mot quand le film n'a pas de note) relit le journal déjà en cache — pas de second appel.
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
  // La fiche de l'année en cours, seulement déjà écrite et ouverte (`apercuLitLaFiche`, le jumeau de
  // l'aperçu de la carte et du guichet) : sur une année non visitée, la lire enfilerait son ouverture
  // chez le chroniqueur, et ouvrir la recherche ne doit jamais coûter un appel IA.
  const caseEnCours = voyage.data?.annees.find((a) => a.annee === anneeEnCours)
  const annee = useQuery({
    queryKey: anneeEnCours ? cles.annee(anneeEnCours) : ['voyage', 'annee', 'aucune'],
    queryFn: ({ signal }) => lireAnnee(anneeEnCours!, signal),
    enabled: !!caseEnCours && apercuLitLaFiche(caseEnCours),
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
      <header className={styles.guichet}>
        <BoutonRetour vers="/" />
        <p className={styles.kicker}>Le guichet</p>
        <h1 className={styles.titre}>Quel film as-tu vu ?</h1>
      </header>

      <div className={styles.demande}>
        <IconSearch aria-hidden="true" className={styles.loupe} />
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
          <button type="button" onClick={() => setSaisie('')} aria-label="Effacer" className={styles.effacer}>
            <IconX aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {recherche.error ? (
        <p role="alert" className={styles.erreur}>
          {recherche.error.message}
        </p>
      ) : null}

      {termeNormalise ? (
        recherche.isPending ? (
          <Attente libelle="Recherche…" className={styles.liste}>
            <ul className={styles.affiches}>
              {Array.from({ length: AFFICHES_EN_ATTENTE }, (_, affiche) => (
                <li key={affiche} className={styles.enAttente} data-testid="affiche-en-attente">
                  <Affiche src={null} titre="" />
                  <div className={styles.infosResultat}>
                    <div className={styles.titreResultat}>
                      <Barre largeur="longue" />
                    </div>
                    <div className={styles.sousTitreResultat}>
                      <Barre largeur="courte" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Attente>
        ) : resultats.length === 0 && !recherche.error ? (
          <p className={styles.vide}>Rien trouvé pour « {termeNormalise} ».</p>
        ) : (
          <div className={styles.liste}>
            <ul className={styles.affiches}>
              {resultats.map((resultat) => (
                <AfficheResultat
                  key={resultat.external_id}
                  candidat={candidatDepuisResultat(resultat)}
                  vu={vuPour(resultat.external_id)}
                  onChoisir={() => ouvrirFormulaire(candidatDepuisResultat(resultat))}
                />
              ))}
            </ul>
          </div>
        )
      ) : (
        <>
          {recentes.length > 0 ? (
            <div className={styles.recentes}>
              <p className={styles.legendeRecentes}>Dernières recherches</p>
              {recentes.map((terme) => (
                <button key={terme} type="button" className={styles.motCrayon} onClick={() => setSaisie(terme)}>
                  {terme}
                </button>
              ))}
              <button type="button" onClick={effacerRecentes} aria-label="Effacer les dernières recherches" className={styles.corbeille}>
                <IconTrash aria-hidden="true" />
              </button>
            </div>
          ) : null}

          {ensuite.length > 0 ? (
            <section className={styles.liste}>
              <h2 className={styles.rubrique}>Tes « Ensuite »</h2>
              <ul className={styles.affiches}>
                {ensuite.map((candidat) => (
                  <AfficheResultat
                    key={`ensuite:${candidat.external_id}`}
                    candidat={candidat}
                    vu={undefined}
                    onChoisir={() => ouvrirFormulaire(candidat)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {aVoirCetteAnnee.length > 0 ? (
            <section className={styles.liste}>
              <h2 className={styles.rubrique}>Pas encore vus, cette année du Voyage</h2>
              <ul className={styles.affiches}>
                {aVoirCetteAnnee.map((candidat) => (
                  <AfficheResultat
                    key={`voyage:${candidat.external_id}`}
                    candidat={candidat}
                    vu={undefined}
                    onChoisir={() => ouvrirFormulaire(candidat)}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
