import { Suspense, useLayoutEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  IconArmchair,
  IconBuildingPavilion,
  IconChairDirector,
  IconDeviceTvOld,
  IconRoute,
  type TablerIcon,
} from '@tabler/icons-react'
import PageEnAttente from '../session/PageEnAttente'
import { useDefilementMemorise } from './defilement'
import { Filet } from './Filet'
import styles from './Coque.module.css'

export interface Onglet {
  /** Chemin sous `/journal` ; les pages d'un onglet vivent sous ce préfixe (`/voyage/…`). */
  chemin: string
  libelle: string
  Icone: TablerIcon
  /** Les préfixes qui, sans être sous `chemin`, marquent aussi cet onglet. */
  aussi?: readonly string[]
}

/**
 * Les cinq onglets, dans l'ordre de la barre. « Au ciné » n'en est plus un : sa page (`/au-cine`)
 * s'ouvre du billet de l'accueil (`accueil/BilletAuCine.tsx`), et sa place revient au Feuilleton.
 * Ajouter un onglet ici ne suffit pas : sa route se déclare aussi dans `App.tsx`, sous `<Coque />`.
 */
export const ONGLETS: readonly Onglet[] = [
  // « Au ciné » (`au-cine`) et la fiche d'un film qu'on y ouvre (`au-cine/films/:tmdbId`) sont des
  // pages de l'accueil : on y entre par lui, et son onglet y reste marqué.
  { chemin: '/', libelle: 'Accueil', Icone: IconBuildingPavilion, aussi: ['/au-cine'] },
  { chemin: '/voyage', libelle: 'Voyage', Icone: IconRoute },
  { chemin: '/suivis', libelle: 'Suivis', Icone: IconChairDirector },
  { chemin: '/feuilleton', libelle: 'Feuilleton', Icone: IconDeviceTvOld },
  { chemin: '/profil', libelle: 'Profil', Icone: IconArmchair },
]

const sous = (pathname: string, prefixe: string) => pathname === prefixe || pathname.startsWith(`${prefixe}/`)

/**
 * Un onglet est marqué sur sa page et sur ses sous-pages (`/voyage/…`), et sur celles de ses préfixes
 * `aussi`. `/` n'a pas de sous-page : tout chemin en serait une.
 */
export function estMarque({ chemin, aussi = [] }: Onglet, pathname: string): boolean {
  return (chemin === '/' ? pathname === '/' : sous(pathname, chemin)) || aussi.some((prefixe) => sous(pathname, prefixe))
}

/**
 * La coque de l'app connectée : la page de l'onglet courant (`<Outlet />`), et la barre d'onglets
 * en bas. Une page s'y branche en devenant une route enfant de `<Route element={<Coque />}>`
 * dans `App.tsx` (voir le README, « La coque à onglets »).
 */
export default function Coque() {
  const contenu = useRef<HTMLElement>(null)
  const { key, pathname } = useLocation()
  useDefilementMemorise(contenu, key)

  // Le Voyage a son propre fond : sans cet attribut sur `<html>`, `theme.css` peint le ciel du bâtiment.
  const auVoyage = pathname === '/voyage' || pathname.startsWith('/voyage/')
  useLayoutEffect(() => {
    if (!auVoyage) return
    document.documentElement.dataset.lieu = 'ecran'
    return () => {
      delete document.documentElement.dataset.lieu
    }
  }, [auVoyage])

  return (
    <div className={styles.coque}>
      <main ref={contenu} className={styles.contenu}>
        {/* Le repli est ici et non plus haut : la barre reste à l'écran pendant qu'un morceau (le Voyage) se charge. */}
        <Filet key={pathname}>
          <Suspense fallback={<PageEnAttente />}>
            <Outlet />
          </Suspense>
        </Filet>
      </main>

      <nav className={styles.barre} aria-label="Onglets">
        <ul className={styles.liste}>
          {ONGLETS.map((onglet) => (
            <li key={onglet.chemin} className={styles.element}>
              {/* Un `Link` et non un `NavLink` : c'est `estMarque` qui dit l'onglet courant, pour qu'une
                  page puisse appartenir à un onglet sans vivre sous son chemin. */}
              <Link to={onglet.chemin} className={styles.onglet} aria-current={estMarque(onglet, pathname) ? 'page' : undefined}>
                <onglet.Icone aria-hidden="true" className={styles.icone} />
                <span className={styles.libelle}>{onglet.libelle}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
