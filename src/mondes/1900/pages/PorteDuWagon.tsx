import { Link } from 'react-router-dom'
import type { PropsPorteDuWagon } from '../../../voyage/wagon/tables'
import { MOTS_DU_WAGON as M, ceQueDitLaPorte } from './wagon'
import styles from './Wagon.module.css'

/**
 * La porte du wagon-restaurant sur la fiche de mon année en cours (maquette « Voyage immobile 1900 »,
 * écran 17 : `.lien-wr`, sous sa petite lampe), le gabarit `porteDuWagon` : un lien vers le wagon, qui
 * dit en une ligne ce qu'il en est de ma table de ce soir (`ceQueDitLaPorte`). `voyage/wagon/Porte.tsx`
 * lit et décide : il ne la monte que s'il y a une table ce soir que je n'ai pas déclinée. La lampe est
 * un tracé de la maquette : son pied est au laiton du monde (`--m-or`), ses cinq autres couleurs
 * (le halo, l'abat-jour, ses plis, son bord, sa frange) n'ont pas de jeton et restent sa donnée. Rien
 * n'y bouge.
 */
export default function PorteDuWagon({ tables, vers }: PropsPorteDuWagon) {
  return (
    <Link to={vers} className={styles.porte}>
      <svg viewBox="0 0 38 44" aria-hidden="true" focusable="false">
        <circle cx="19" cy="15" r="17" fill="#ffd98a" opacity=".14" />
        <path d="M8 22 L13 6 H25 L30 22 Z" fill="#f1c06c" />
        <path d="M12 22 L15.5 6 M16 22 L17.8 6 M19 22 V6 M22 22 L20.2 6 M26 22 L22.5 6" stroke="#a8642a" strokeWidth=".7" fill="none" />
        <path d="M8 22 H30" stroke="#8a4a1e" strokeWidth="2" />
        <path d="M8.5 24.5 H29.5" stroke="#c9853f" strokeWidth="2.6" strokeDasharray="1 1.5" />
        <path d="M19 23 V37 M12 39 H26" stroke="var(--m-or)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </svg>
      <span>
        <b>{M.porte}</b> <small>{ceQueDitLaPorte(tables)}</small>
      </span>
      <em aria-hidden="true">›</em>
    </Link>
  )
}
