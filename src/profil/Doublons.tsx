import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apercuDoublons, retirerDoublons } from '../api/doublons'
import { cles } from '../api/cles'
import cartes from '../ui/Page.module.css'
import styles from './Doublons.module.css'

const doublons = (n: number, participe: string) => (n === 1 ? `1 doublon ${participe}` : `${n} doublons ${participe}s`)

/**
 * « Retirer les doublons » (correctif du 29 septembre 2026) : des relances de l'import Letterboxd
 * ont pu écrire deux fois la même ligne. D'abord l'aperçu — combien, et lesquels —, puis une
 * confirmation **dans la page**, jamais `confirm()` : l'API retire alors ce qu'elle trouve à ce
 * moment-là, et un second passage ne retire rien.
 */
export default function Doublons() {
  const client = useQueryClient()
  const apercu = useMutation({ mutationFn: apercuDoublons })
  const retrait = useMutation({
    mutationFn: retirerDoublons,
    onSuccess: () => {
      // Les mêmes clés qu'après un import : le journal (et tout ce qui vit sous son préfixe), les
      // chiffres, le Voyage, les filmographies suivies.
      void client.invalidateQueries({ queryKey: cles.journal })
      void client.invalidateQueries({ queryKey: cles.stats })
      void client.invalidateQueries({ queryKey: cles.voyage })
      void client.invalidateQueries({ queryKey: cles.realisateurs })
      void client.invalidateQueries({ queryKey: cles.sagas })
    },
  })

  const annuler = () => {
    apercu.reset()
    retrait.reset()
  }

  if (retrait.data) {
    return (
      <div className={styles.bloc}>
        <p role="status">{retrait.data.total === 0 ? 'Aucun doublon à retirer.' : `${doublons(retrait.data.total, 'retiré')}.`}</p>
        <button type="button" className={cartes.bouton} onClick={annuler}>
          Fermer
        </button>
      </div>
    )
  }

  const erreur = apercu.error ?? retrait.error
  if (apercu.data) {
    const { total } = apercu.data
    return (
      <div className={styles.bloc}>
        {total === 0 ? (
          <p role="status">Aucun doublon dans ton journal.</p>
        ) : (
          <>
            <p role="status">{doublons(total, 'trouvé')}</p>
            <ul className={styles.liste}>
              {apercu.data.doublons.map((d) => (
                <li key={d.id}>
                  {d.media.title} · {d.finished_at}
                </li>
              ))}
            </ul>
            <p className={styles.aide}>
              La plus ancienne entrée de chaque jour est gardée ; une entrée qui porte une réaction ou une remarque ne part
              jamais.
            </p>
          </>
        )}
        {erreur ? (
          <p role="alert" className={styles.erreur}>
            {erreur.message}
          </p>
        ) : null}
        <div className={styles.actions}>
          {total > 0 ? (
            <button
              type="button"
              className={cartes.bouton}
              disabled={retrait.isPending}
              onClick={() => retrait.mutate()}
            >
              {retrait.isPending ? 'Retrait en cours…' : total === 1 ? 'Retirer le doublon' : `Retirer les ${total} doublons`}
            </button>
          ) : null}
          <button type="button" className={styles.secondaire} onClick={annuler} disabled={retrait.isPending}>
            {total > 0 ? 'Annuler' : 'Fermer'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.bloc}>
      <button type="button" className={styles.entree} disabled={apercu.isPending} onClick={() => apercu.mutate()}>
        <span className={styles.entreeTitre}>Retirer les doublons</span>
        <span className={styles.aide}>
          {apercu.isPending ? 'Recherche des doublons…' : 'Les visionnages écrits deux fois par un import'}
        </span>
      </button>
      {erreur ? (
        <p role="alert" className={styles.erreur}>
          {erreur.message}
        </p>
      ) : null}
    </div>
  )
}
