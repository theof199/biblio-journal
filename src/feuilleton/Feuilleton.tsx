import { Suspense, useEffect, useRef } from 'react'
import { Link, Navigate, useLocation, useOutlet } from 'react-router-dom'
import { paresseux } from '../pwa/morceau'
import PageEnAttente from '../session/PageEnAttente'
import { ESPACES, autreEspace, espaceDeLHeure, espaceDuChemin } from './espaces'
import { HABILLAGES, habillageActif } from './habillages'
import { useTelecommande } from './telecommande/adresse'
import Bouton from './telecommande/Bouton'
import { useInvitationEnAttente } from './telecommande/donnees'
import styles from './Feuilleton.module.css'

/** Le panneau de la télécommande ne se charge qu'à l'ouverture (`test/decoupage.test.ts`). */
const Panneau = paresseux(() => import('./telecommande/Panneau'))

/**
 * La mise en page du Feuilleton, l'onglet qui a pris la place d'« Au ciné » : au-dessus de la page de
 * l'espace ouvert, le bouton qui passe de l'autre côté ; par-dessus, la télécommande (le suivi des
 * séries), commune aux deux espaces : son bouton rond, et son panneau quand l'adresse le dit
 * (`?telecommande=<vue>`, `telecommande/adresse.ts`). Le Feuilleton n'est pas un endroit du cinéma
 * (`docs/identite.md`) : son univers viendra de ses deux espaces, et ce socle reste sobre, sur les
 * jetons du thème.
 *
 * `/feuilleton` seul n'a pas de page : il mène à l'espace de l'heure (`espaceDeLHeure`), relue à chaque
 * arrivée, en gardant ce que l'adresse portait (la télécommande ouverte). Le bouton « Passer à… » est un
 * lien vers l'autre espace, rien de plus : aucun choix n'est gardé nulle part.
 */
export default function Feuilleton() {
  const page = useOutlet()
  const { pathname, search } = useLocation()
  const espace = espaceDuChemin(pathname)
  const { vue, ouvrir } = useTelecommande()
  const invitation = useInvitationEnAttente()
  const boutonRond = useRef<HTMLButtonElement>(null)
  const dessous = useRef<HTMLDivElement>(null)
  const ouvert = vue !== null

  // Sous le panneau, la page est inerte : ni toucher, ni focus, ni lecture. La barre d'onglets, elle, reste.
  useEffect(() => {
    dessous.current?.toggleAttribute('inert', ouvert)
  }, [ouvert])

  if (!page || !espace) return <Navigate to={{ pathname: ESPACES[espaceDeLHeure(new Date())].chemin, search }} replace />

  const autre = ESPACES[autreEspace(espace)]
  // Le seul appel : le bouton et le panneau portent l'habillage du même chapitre.
  const chapitre = habillageActif()
  const habillage = HABILLAGES[chapitre]
  return (
    <>
      <div ref={dessous} className={styles.feuilleton}>
        <nav className={styles.passage} aria-label="Espaces du Feuilleton">
          <Link to={autre.chemin} className={styles.autreCote}>
            {autre.passer} <span aria-hidden="true">→</span>
          </Link>
        </nav>
        {/* Le repli est ici : le bouton reste à l'écran pendant que le morceau d'un espace se charge. */}
        <Suspense fallback={<PageEnAttente />}>{page}</Suspense>
      </div>
      <Bouton ref={boutonRond} habillage={habillage} chapitre={chapitre} invitation={invitation} ouvert={ouvert} onOuvrir={ouvrir} />
      {ouvert ? (
        <Suspense fallback={null}>
          <Panneau habillage={habillage} chapitre={chapitre} boutonRond={boutonRond} invitation={invitation} />
        </Suspense>
      ) : null}
    </>
  )
}
