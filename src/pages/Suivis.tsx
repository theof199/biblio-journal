import { useId, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { lireRealisateurs, type Realisateur } from '../api/realisateurs'
import { lireSagas, type Saga } from '../api/sagas'
import { filmsEnsuite } from '../suivis/affichettes'
import Affichette from '../suivis/Affichette'
import AffichetteEnAttente from '../suivis/AffichetteEnAttente'
import Archives from '../suivis/Archives'
import Intercalaires, { idIntercalaire } from '../suivis/Intercalaires'
import { compteSuivis, repartirSuivis, type SourceSuivi } from '../suivis/liste'
import { useMasquerIntrouvables } from '../suivis/masquer'
import PlancheCycle from '../suivis/PlancheCycle'
import PlancheCycleEnAttente from '../suivis/PlancheCycleEnAttente'
import RangeeEnsuite from '../suivis/RangeeEnsuite'
import RechercheSuivi from '../suivis/RechercheSuivi'
import { useFilmographiesRealisateurs, useFilmographiesSagas } from '../suivis/useFilmographies'
import { useMemoireSuivis } from '../suivis/useMemoireSuivis'
import Attente from '../ui/Attente'
import Panne from '../ui/Panne'
import styles from './Suivis.module.css'

/** Ce que montre un intercalaire dont la liste n'est pas arrivée : de quoi remplir un écran, pas plus. */
const AFFICHETTES_EN_ATTENTE = 4
const PLANCHES_EN_ATTENTE = 2

/**
 * L'onglet Suivis (reprise de `SuivisScreen.kt`) : le bureau de la programmation, dont le mur porte
 * les suivis en affichettes. En haut, « + Suivre » ouvre la recherche (réalisateurs et sagas d'un
 * coup), puis « Ensuite » : le prochain film de chaque suivi en cours. Dessous, deux intercalaires :
 * les rétrospectives (une affichette par réalisateur) et les cycles (une planche par saga), chacun
 * avec ses archives repliées. Un clic sur un suivi ouvre sa page (`PageRealisateur`/`PageSaga`), qui
 * porte le bouton pour ne plus le suivre : la page ne fait qu'afficher et chercher.
 *
 * L'intercalaire choisi et les archives dépliées se retiennent le temps de la session
 * (`useMemoireSuivis`) ; la recherche, non.
 */
export default function Suivis() {
  const realisateurs = useQuery({ queryKey: cles.realisateurs, queryFn: ({ signal }) => lireRealisateurs(signal) })
  const sagas = useQuery({ queryKey: cles.sagas, queryFn: ({ signal }) => lireSagas(signal) })

  // Leurs films, une entité après l'autre — jamais toutes d'un coup (`useFilmographies`). Les deux
  // listes se chargent même quand un seul intercalaire est ouvert : le compte de l'en-tête et la
  // rangée « Ensuite » ont besoin des deux.
  const filmsRealisateurs = useFilmographiesRealisateurs(realisateurs.data)
  const filmsSagas = useFilmographiesSagas(sagas.data)
  const masquerIntrouvables = useMasquerIntrouvables()
  const { onglet, archivesOuvertes, choisirOnglet, basculerArchives } = useMemoireSuivis()
  const [rechercheOuverte, setRechercheOuverte] = useState(false)

  const idRecherche = useId()
  const idIntercalaires = useId()
  const idPanneau = useId()

  const ensuite = useMemo(
    () => filmsEnsuite(realisateurs.data ?? [], filmsRealisateurs, sagas.data ?? [], filmsSagas),
    [realisateurs.data, filmsRealisateurs, sagas.data, filmsSagas],
  )
  const realisateursSuivis = useMemo(() => new Set((realisateurs.data ?? []).map((r) => r.tmdb_id)), [realisateurs.data])
  const sagasSuivies = useMemo(() => new Set((sagas.data ?? []).map((s) => s.tmdb_id)), [sagas.data])

  // En cours d'abord, bouclées aux archives, chacune de la plus récemment active à la plus ancienne :
  // un ordre d'affichage seulement, la liste du back reste celle du cache.
  const retrospectives = useMemo(() => repartirSuivis(realisateurs.data ?? [], filmsRealisateurs), [realisateurs.data, filmsRealisateurs])
  const cycles = useMemo(() => repartirSuivis(sagas.data ?? [], filmsSagas), [sagas.data, filmsSagas])

  const mur = (entites: Realisateur[], bouclee: boolean) =>
    entites.length > 0 ? (
      <ul className={styles.mur}>
        {entites.map((entite) => (
          <Affichette
            key={entite.tmdb_id}
            nom={entite.name}
            image={entite.profile_url}
            lien={`/suivis/realisateurs/${entite.tmdb_id}`}
            ajouteLe={entite.ajoute_le}
            etat={filmsRealisateurs.get(entite.tmdb_id)}
            bouclee={bouclee}
          />
        ))}
      </ul>
    ) : null
  const planches = (entites: Saga[], bouclee: boolean) =>
    entites.length > 0 ? (
      <ul className={styles.planches}>
        {entites.map((entite) => (
          <PlancheCycle
            key={entite.tmdb_id}
            nom={entite.name}
            lien={`/suivis/sagas/${entite.tmdb_id}`}
            ajouteLe={entite.ajoute_le}
            etat={filmsSagas.get(entite.tmdb_id)}
            masquerIntrouvables={masquerIntrouvables}
            bouclee={bouclee}
          />
        ))}
      </ul>
    ) : null
  const archives = (source: SourceSuivi, nombre: number, bouclees: ReactNode) => (
    <Archives nombre={nombre} ouvertes={archivesOuvertes.has(source)} onBasculer={() => basculerArchives(source)}>
      {bouclees}
    </Archives>
  )

  return (
    <div className={styles.page}>
      <header className={styles.entete}>
        <div className={styles.intitule}>
          <h1 className={styles.titre}>Suivis</h1>
          {/* Absent tant qu'une des deux listes n'a pas répondu : pas de « 0 rétrospective » qui grimperait sous les yeux. */}
          {realisateurs.data && sagas.data ? (
            <p className={styles.compteSuivis}>{compteSuivis(realisateurs.data.length, sagas.data.length)}</p>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.suivre}
          aria-expanded={rechercheOuverte}
          aria-controls={idRecherche}
          onClick={() => setRechercheOuverte((ouverte) => !ouverte)}
        >
          + Suivre
        </button>
      </header>

      {rechercheOuverte ? (
        <div id={idRecherche}>
          <RechercheSuivi realisateursSuivis={realisateursSuivis} sagasSuivies={sagasSuivies} />
        </div>
      ) : null}

      <RangeeEnsuite films={ensuite} />

      <div className={styles.classeur}>
        <Intercalaires
          base={idIntercalaires}
          idPanneau={idPanneau}
          ouvert={onglet}
          comptes={{ realisateurs: realisateurs.data?.length, sagas: sagas.data?.length }}
          onChoisir={choisirOnglet}
        />
        <div role="tabpanel" id={idPanneau} aria-labelledby={idIntercalaire(idIntercalaires, onglet)} className={styles.panneau}>
          {onglet === 'realisateurs' ? (
            <Panneau
              enAttente={realisateurs.isPending}
              squelette={
                <ul className={styles.mur}>
                  {Array.from({ length: AFFICHETTES_EN_ATTENTE }, (_, rang) => (
                    <AffichetteEnAttente key={rang} />
                  ))}
                </ul>
              }
              erreur={realisateurs.error}
              onReessayer={() => void realisateurs.refetch()}
              libelleVide="Tu ne suis aucun réalisateur."
              nombre={realisateurs.data?.length ?? 0}
            >
              {mur(retrospectives.enCours, false)}
              {archives('realisateurs', retrospectives.bouclees.length, mur(retrospectives.bouclees, true))}
            </Panneau>
          ) : (
            <Panneau
              enAttente={sagas.isPending}
              squelette={
                <ul className={styles.planches}>
                  {Array.from({ length: PLANCHES_EN_ATTENTE }, (_, rang) => (
                    <PlancheCycleEnAttente key={rang} />
                  ))}
                </ul>
              }
              erreur={sagas.error}
              onReessayer={() => void sagas.refetch()}
              libelleVide="Tu ne suis aucune saga."
              nombre={sagas.data?.length ?? 0}
            >
              {planches(cycles.enCours, false)}
              {archives('sagas', cycles.bouclees.length, planches(cycles.bouclees, true))}
            </Panneau>
          )}
        </div>
      </div>
    </div>
  )
}

/** Le contenu d'un intercalaire : son squelette, la panne et son retry, le message d'une liste vide, sinon ses suivis. */
function Panneau({
  enAttente,
  squelette,
  erreur,
  onReessayer,
  libelleVide,
  nombre,
  children,
}: {
  enAttente: boolean
  squelette: ReactNode
  erreur: unknown
  onReessayer: () => void
  libelleVide: string
  nombre: number
  children: ReactNode
}) {
  if (enAttente) return <Attente>{squelette}</Attente>
  if (erreur) return <Panne erreur={erreur} onReessayer={onReessayer} />
  if (nombre === 0) return <p className={styles.vide}>{libelleVide}</p>
  return <>{children}</>
}
