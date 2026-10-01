import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { chercherRealisateurs, chercherSagas } from '../api/personnes'
import { suivreRealisateur } from '../api/realisateurs'
import { suivreSaga } from '../api/sagas'
import Affiche from '../ui/Affiche'
import { useValeurDebouncee } from '../recherche/useValeurDebouncee'
import styles from './RechercheSuivi.module.css'

interface Resultat {
  tmdb_id: number
  name: string
  image_url: string | null
}

const message = (erreur: unknown) => (erreur instanceof Error ? erreur.message : String(erreur))

/**
 * `chercherRealisateurs`/`chercherSagas` rendent `profile_url`/`cover_url` — deux noms pour la
 * même idée d'image — ramenés ici à `image_url`, seul champ que la liste lit.
 */
const realisateursTrouves = async (q: string, signal?: AbortSignal): Promise<Resultat[]> => {
  const { results } = await chercherRealisateurs(q, signal)
  return results.map((r) => ({ tmdb_id: r.tmdb_id, name: r.name, image_url: r.profile_url }))
}
const sagasTrouvees = async (q: string, signal?: AbortSignal): Promise<Resultat[]> => {
  const { results } = await chercherSagas(q, signal)
  return results.map((r) => ({ tmdb_id: r.tmdb_id, name: r.name, image_url: r.cover_url }))
}

/**
 * La recherche pour suivre quelqu'un (reprise de `ChercherSuiviScreen.kt`) : un seul champ, qui
 * cherche les réalisateurs et les sagas en même temps, et les montre en deux groupes — un groupe
 * sans résultat n'y figure pas. Suivre invalide la liste de ce qu'on vient de suivre (rien d'autre),
 * et le panneau reste ouvert : on peut en suivre un autre. Monté à l'ouverture, il prend le focus.
 */
export default function RechercheSuivi({
  realisateursSuivis,
  sagasSuivies,
}: {
  realisateursSuivis: ReadonlySet<number>
  sagasSuivies: ReadonlySet<number>
}) {
  const [saisie, setSaisie] = useState('')
  const requete = useValeurDebouncee(saisie, 300).trim()
  const champ = useRef<HTMLInputElement>(null)
  useEffect(() => champ.current?.focus(), [])

  const realisateurs = useQuery({
    queryKey: [...cles.realisateurs, 'recherche', requete],
    queryFn: ({ signal }) => realisateursTrouves(requete, signal),
    enabled: requete.length > 0,
  })
  const sagas = useQuery({
    queryKey: [...cles.sagas, 'recherche', requete],
    queryFn: ({ signal }) => sagasTrouvees(requete, signal),
    enabled: requete.length > 0,
  })

  // Les deux ont répondu et ni l'une ni l'autre n'a trouvé personne : une recherche en attente ou en
  // erreur n'a pas de `data`, elle ne compte pas pour vide.
  const aucunResultat = requete !== '' && realisateurs.data?.length === 0 && sagas.data?.length === 0

  return (
    <div className={styles.recherche}>
      <input
        ref={champ}
        type="search"
        value={saisie}
        onChange={(event) => setSaisie(event.target.value)}
        placeholder="Un réalisateur ou une saga"
        aria-label="Un réalisateur ou une saga"
        className={styles.champ}
      />

      {requete ? (
        <>
          <Groupe titre="Réalisateurs" requete={realisateurs} deja={realisateursSuivis} cle={cles.realisateurs} suivre={suivreRealisateur} />
          <Groupe titre="Sagas" requete={sagas} deja={sagasSuivies} cle={cles.sagas} suivre={suivreSaga} />
          {realisateurs.isPending || sagas.isPending ? <p role="status">Recherche…</p> : null}
          {aucunResultat ? <p className={styles.vide}>Rien trouvé pour « {requete} ».</p> : null}
        </>
      ) : null}
    </div>
  )
}

/**
 * Un groupe de résultats : son titre et ses lignes, ou l'erreur de sa recherche telle quelle. Rien
 * tant que la recherche n'a pas répondu, rien quand elle ne trouve personne.
 */
function Groupe({
  titre,
  requete,
  deja,
  cle,
  suivre,
}: {
  titre: string
  requete: { data: Resultat[] | undefined; error: unknown }
  deja: ReadonlySet<number>
  cle: readonly unknown[]
  suivre: (tmdbId: number) => Promise<unknown>
}) {
  const client = useQueryClient()
  const suivi = useMutation({
    mutationFn: suivre,
    onSuccess: () => void client.invalidateQueries({ queryKey: cle }),
  })

  const resultats = requete.data ?? []
  if (resultats.length === 0 && !requete.error) return null

  let contenu: ReactNode
  if (requete.error) {
    contenu = <p role="alert">{message(requete.error)}</p>
  } else {
    contenu = (
      <ul className={styles.liste}>
        {resultats.map((resultat) => {
          const dejaSuivi = deja.has(resultat.tmdb_id)
          return (
            <li key={resultat.tmdb_id} className={styles.resultat}>
              <Affiche src={resultat.image_url} titre={resultat.name} taille="ligne" />
              <span className={styles.nom}>{resultat.name}</span>
              <button
                type="button"
                className={styles.boutonSuivre}
                disabled={dejaSuivi || suivi.isPending}
                onClick={() => suivi.mutate(resultat.tmdb_id)}
              >
                {dejaSuivi ? 'Suivi' : 'Suivre'}
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <section className={styles.groupe}>
      <h3 className={styles.titreGroupe}>{titre}</h3>
      {contenu}
      {suivi.error ? <p role="alert">{message(suivi.error)}</p> : null}
    </section>
  )
}
