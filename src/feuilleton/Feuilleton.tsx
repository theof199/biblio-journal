import { Suspense } from 'react'
import { Link, Navigate, useLocation, useOutlet } from 'react-router-dom'
import PageEnAttente from '../session/PageEnAttente'
import { ESPACES, autreEspace, espaceDeLHeure, espaceDuChemin } from './espaces'
import styles from './Feuilleton.module.css'

/**
 * La mise en page du Feuilleton, l'onglet qui a pris la place d'« Au ciné » : au-dessus de la page de
 * l'espace ouvert, le bouton qui passe de l'autre côté. Le Feuilleton n'est pas un endroit du cinéma
 * (`docs/identite.md`) : son univers viendra de ses deux espaces, et ce socle reste sobre, sur les
 * jetons du thème.
 *
 * `/feuilleton` seul n'a pas de page : il mène à l'espace de l'heure (`espaceDeLHeure`), relue à chaque
 * arrivée. Le bouton est un lien vers l'autre espace, rien de plus : aucun choix n'est gardé nulle part.
 */
export default function Feuilleton() {
  const page = useOutlet()
  const { pathname } = useLocation()
  const espace = espaceDuChemin(pathname)

  if (!page || !espace) return <Navigate to={ESPACES[espaceDeLHeure(new Date())].chemin} replace />

  const autre = ESPACES[autreEspace(espace)]
  return (
    <div className={styles.feuilleton}>
      <nav className={styles.passage} aria-label="Espaces du Feuilleton">
        <Link to={autre.chemin} className={styles.autreCote}>
          {autre.passer} <span aria-hidden="true">→</span>
        </Link>
      </nav>
      {/* Le repli est ici : le bouton reste à l'écran pendant que le morceau d'un espace se charge. */}
      <Suspense fallback={<PageEnAttente />}>{page}</Suspense>
    </div>
  )
}
