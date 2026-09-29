import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router-dom'
import { cles } from '../api/cles'
import { lireReactions } from '../api/reactions'
import Affiche from '../ui/Affiche'
import BoutonRetour from '../ui/BoutonRetour'
import { sousTitre } from '../ui/format'
import styles from './Fiche.module.css'
import type { JournalItem } from '../api/journal'

/**
 * La fiche d'un visionnage (reprise de `FicheEntreeScreen.kt`) : l'affiche, la note, les réactions,
 * le réalisateur, et « Corriger ». Aucun appel réseau sur l'entrée elle-même — elle vient de l'état
 * de navigation (la grille de l'accueil, un résultat « Ensuite »…), comme sur l'appli. **La remarque
 * privée n'apparaît jamais ici**, décision reprise de la fiche Android : elle ne se lit et ne se
 * corrige que dans le formulaire.
 */
export default function Fiche() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const etat = location.state as { item?: JournalItem; depuis?: string } | null
  const item = etat?.item
  // La page qui a ouvert la fiche (« Mes films » la pose) ; l'accueil sinon, par défaut. Transmise à
  // « Corriger », pour que le retour du formulaire puis celui de la fiche y ramènent encore.
  const depuis = etat?.depuis ?? '/'

  const reactions = useQuery({ queryKey: cles.reactions, queryFn: ({ signal }) => lireReactions(signal) })
  const phrase = (cle: string) => reactions.data?.reactions.find((r) => r.cle === cle)?.phrase ?? cle
  const emoji = (cle: string) => reactions.data?.reactions.find((r) => r.cle === cle)?.emoji ?? ''

  if (!item) {
    return (
      <div className={styles.page}>
        <div className={styles.entete}>
          <BoutonRetour vers="/" />
        </div>
        <p>Ce visionnage n’est plus disponible. Repars de l’accueil.</p>
        <Link to="/">Retour à l’accueil</Link>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.entete}>
        <BoutonRetour vers={depuis} />
      </div>

      <div className={styles.film}>
        <Affiche src={item.media.cover_url} titre={item.media.title} className={styles.affiche} />
        <div className={styles.infos}>
          <h1 className={styles.titre}>{item.media.title}</h1>
          <p className={styles.sousTitre}>{sousTitre(item.media.director, item.media.year)}</p>
          {item.entry.rating != null ? <p className={styles.note}>Noté {item.entry.rating} / 10</p> : null}
        </div>
      </div>

      {item.carnet.reactions.length > 0 ? (
        <div className={styles.puces}>
          {item.carnet.reactions.map((cle) => (
            <span key={cle} className={styles.puce}>
              {emoji(cle)} {phrase(cle)}
            </span>
          ))}
        </div>
      ) : null}

      <Link to={`/journal/${id}/corriger`} state={{ item, depuis }} className={styles.bouton}>
        Corriger
      </Link>
    </div>
  )
}
