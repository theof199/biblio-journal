import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apercuDoublons, retirerDoublons, type CasLimite } from '../api/doublons'
import { cles } from '../api/cles'
import { supprimerVisionnage } from '../api/journal'
import { formatDateVisionnage } from '../ui/format'
import cartes from '../ui/Page.module.css'
import styles from './Doublons.module.css'

const doublons = (n: number, participe: string) => (n === 1 ? `1 doublon ${participe}` : `${n} doublons ${participe}s`)

const RAISONS: Record<CasLimite['raison'], string> = {
  autre_note: 'le même jour, avec une autre note',
  autre_debut_ou_commentaire: 'le même jour, même note, mais un autre début ou un autre commentaire',
  jour_voisin: 'la veille ou le lendemain',
}

const avecNote = (date: string, note: number | null) =>
  note != null ? `${formatDateVisionnage(date)} (${note}/10)` : formatDateVisionnage(date)

/**
 * « Retirer les doublons » (correctif du 29 septembre 2026) : des relances de l'import Letterboxd
 * ont pu écrire deux fois la même ligne. D'abord l'aperçu — combien, et lesquels —, puis une
 * confirmation **dans la page**, jamais `confirm()` : l'API retire alors ce qu'elle trouve à ce
 * moment-là, et un second passage ne retire rien.
 *
 * **Les cas limites** (correctif du 30 septembre 2026) : ce qui ressemble à un doublon sans l'être
 * sûrement — une autre note le même jour, le même film la veille ou le lendemain — se montre à
 * part. Le retrait d'ensemble n'y touche jamais ; chacun se retire à la main, un par un.
 */
export default function Doublons() {
  const client = useQueryClient()
  const apercu = useMutation({ mutationFn: apercuDoublons })
  const retrait = useMutation({
    mutationFn: retirerDoublons,
    onSuccess: () => invaliderApresRetrait(client),
  })

  const annuler = () => {
    apercu.reset()
    retrait.reset()
  }

  if (retrait.data) {
    return (
      <div className={styles.bloc}>
        <p role="status">{retrait.data.total === 0 ? 'Aucun doublon à retirer.' : `${doublons(retrait.data.total, 'retiré')}.`}</p>
        <CasLimites cas={retrait.data.cas_limites} />
        <button type="button" className={cartes.bouton} onClick={annuler}>
          Fermer
        </button>
      </div>
    )
  }

  const erreur = apercu.error ?? retrait.error
  if (apercu.data) {
    const { total, cas_limites: casLimites } = apercu.data
    return (
      <div className={styles.bloc}>
        {total === 0 ? (
          <p role="status">{casLimites.length === 0 ? 'Aucun doublon dans ton journal.' : 'Aucun doublon sûr dans ton journal.'}</p>
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
              Une entrée qui porte une réaction ou une remarque ne part jamais : c’est elle qui est gardée, sinon la plus
              ancienne.
            </p>
          </>
        )}
        <CasLimites cas={casLimites} />
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

/** Les mêmes clés qu'après un import : le journal (et tout ce qui vit sous son préfixe), les chiffres, le Voyage, les filmographies suivies. */
function invaliderApresRetrait(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: cles.journal })
  void client.invalidateQueries({ queryKey: cles.stats })
  void client.invalidateQueries({ queryKey: cles.voyage })
  void client.invalidateQueries({ queryKey: cles.realisateurs })
  void client.invalidateQueries({ queryKey: cles.sagas })
}

function CasLimites({ cas }: { cas: CasLimite[] }) {
  if (cas.length === 0) return null
  return (
    <div className={styles.bloc}>
      <h3 className={styles.sousTitre}>À vérifier toi-même</h3>
      <p className={styles.aide}>
        Ces visionnages ressemblent à un autre sans en être sûrement la copie : ils ne partent pas avec les doublons.
      </p>
      <ul className={styles.cas}>
        {cas.map((c) => (
          <UnCasLimite key={c.id} cas={c} />
        ))}
      </ul>
    </div>
  )
}

function UnCasLimite({ cas }: { cas: CasLimite }) {
  const client = useQueryClient()
  const [retire, setRetire] = useState(false)
  const suppression = useMutation({
    mutationFn: () => supprimerVisionnage(cas.id),
    onSuccess: () => {
      setRetire(true)
      invaliderApresRetrait(client)
    },
  })

  return (
    <li className={styles.unCas}>
      <span>
        {cas.media.title} · {avecNote(cas.finished_at, cas.rating)}
      </span>
      <span className={styles.aide}>
        Ressemble à celui du {avecNote(cas.autre_finished_at, cas.autre_rating)} : {RAISONS[cas.raison]}.
      </span>
      {retire ? (
        <span role="status">Retiré.</span>
      ) : (
        <button
          type="button"
          className={styles.secondaire}
          disabled={suppression.isPending}
          onClick={() => suppression.mutate()}
          aria-label={`Retirer ${cas.media.title} du ${formatDateVisionnage(cas.finished_at)}`}
        >
          Retirer celui-ci
        </button>
      )}
      {suppression.error ? (
        <span role="alert" className={styles.erreur}>
          {suppression.error.message}
        </span>
      ) : null}
    </li>
  )
}
