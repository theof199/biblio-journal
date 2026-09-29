import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { lireVoyage, regler } from '../api/voyage'
import styles from './Rattrapage.module.css'

/**
 * « Rattraper » le Voyage que je suis : pour un membre qui n'a pas l'IA du Voyage, ouvrir toutes
 * les années jusqu'à celle du compte suivi (jamais au-delà). Un réglage, réversible : la
 * progression propre du membre n'est jamais effacée côté API.
 *
 * L'interrupteur n'existe que si `GET /me/voyage` porte une `source` : le compte IA n'en a pas
 * (`source: null`), et l'API le refuserait de toute façon (`409`). Tant que la carte n'a pas
 * répondu, ou si elle échoue, rien ne s'affiche : le reste du profil ne dépend pas de lui.
 */
export default function Rattrapage() {
  const client = useQueryClient()
  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const reglage = useMutation({
    mutationFn: regler,
    onSuccess: () => {
      // Le Voyage entier (carte, fiches, tickets sont sous son préfixe), et les pages de
      // réalisateur, qui disent quelles années sont ouvertes.
      void client.invalidateQueries({ queryKey: cles.voyage })
      void client.invalidateQueries({ queryKey: cles.realisateurs })
    },
  })

  const source = voyage.data?.source
  if (!voyage.data || !source) return null

  return (
    <div className={styles.bloc}>
      <label className={styles.entree}>
        <input
          type="checkbox"
          role="switch"
          className={styles.interrupteur}
          checked={voyage.data.rattrape_la_source}
          disabled={reglage.isPending}
          onChange={(event) => reglage.mutate(event.target.checked)}
        />
        <span className={styles.texte}>
          <span className={styles.titre}>Ouvrir toutes les années jusqu’à celle de {source.pseudo}</span>
          <span className={styles.aide}>
            Tu lis ce qu’il a déjà écrit, sans rien perdre : décoche, et ta propre progression revient telle que tu l’avais laissée.
          </span>
        </span>
      </label>
      {reglage.error ? (
        <p role="alert" className={styles.erreur}>
          {reglage.error.message}
        </p>
      ) : null}
    </div>
  )
}
