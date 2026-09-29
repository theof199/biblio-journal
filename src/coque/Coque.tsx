import { useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  IconArmchair,
  IconBuildingPavilion,
  IconChairDirector,
  IconRoute,
  IconTicket,
  type TablerIcon,
} from '@tabler/icons-react'
import { useDefilementMemorise } from './defilement'
import styles from './Coque.module.css'

export interface Onglet {
  /** Chemin sous `/journal` ; les pages d'un onglet vivent sous ce préfixe (`/voyage/…`). */
  chemin: string
  libelle: string
  Icone: TablerIcon
}

/**
 * Les cinq onglets, dans l'ordre de la barre de l'appli Android (`Navigation.kt`, `BottomTab`).
 * Ajouter un onglet ici ne suffit pas : sa route se déclare aussi dans `App.tsx`, sous `<Coque />`.
 */
export const ONGLETS: readonly Onglet[] = [
  { chemin: '/', libelle: 'Accueil', Icone: IconBuildingPavilion },
  { chemin: '/voyage', libelle: 'Voyage', Icone: IconRoute },
  { chemin: '/suivis', libelle: 'Suivis', Icone: IconChairDirector },
  { chemin: '/au-cine', libelle: 'Au ciné', Icone: IconTicket },
  { chemin: '/profil', libelle: 'Profil', Icone: IconArmchair },
]

/**
 * La coque de l'app connectée : la page de l'onglet courant (`<Outlet />`), et la barre d'onglets
 * en bas. Une page s'y branche en devenant une route enfant de `<Route element={<Coque />}>`
 * dans `App.tsx` (voir le README, « La coque à onglets »).
 */
export default function Coque() {
  const contenu = useRef<HTMLElement>(null)
  useDefilementMemorise(contenu, useLocation().key)

  return (
    <div className={styles.coque}>
      <main ref={contenu} className={styles.contenu}>
        <Outlet />
      </main>

      <nav className={styles.barre} aria-label="Onglets">
        <ul className={styles.liste}>
          {ONGLETS.map(({ chemin, libelle, Icone }) => (
            <li key={chemin} className={styles.element}>
              {/* Sans `end` : un onglet reste marqué sur ses sous-pages (`/voyage/…`). `/` n'en
                  a pas besoin, React Router ne le marque que sur `/` même (6.30). */}
              <NavLink to={chemin} className={styles.onglet}>
                <Icone aria-hidden="true" className={styles.icone} />
                <span className={styles.libelle}>{libelle}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
