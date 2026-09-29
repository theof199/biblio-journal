import styles from './BandeauMiseAJour.module.css'

interface Props {
  visible: boolean
  onRecharger: () => void
}

/**
 * Rien tant qu'aucune version n'attend : jamais de rechargement forcé en
 * pleine partie (point de vigilance n° 4). `MiseAJour` fournit `visible` et
 * `onRecharger` depuis `useRegisterSW`.
 */
export default function BandeauMiseAJour({ visible, onRecharger }: Props) {
  if (!visible) return null

  return (
    <div role="status" className={styles.bandeau}>
      <span>Nouvelle version</span>
      <button type="button" onClick={onRecharger}>
        Recharger
      </button>
    </div>
  )
}
