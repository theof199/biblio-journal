import styles from './Version.module.css'

/**
 * La version livrée, lue dans les variables que `livrer.yml` fige au build (`VITE_VERSION`, `VITE_COMMIT`).
 * Hors livraison elles manquent : « dev », jamais une valeur vide. Aucun appel réseau.
 */
export function Version() {
  const version = import.meta.env.VITE_VERSION || 'dev'
  const commit = import.meta.env.VITE_COMMIT
  return <p className={styles.version}>{commit ? `Version ${version} · ${commit}` : `Version ${version}`}</p>
}
