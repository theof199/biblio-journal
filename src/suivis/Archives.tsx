import { useId, type ReactNode } from 'react'
import styles from './Archives.module.css'

/**
 * Les archives d'un intercalaire : ses suivis bouclés, repliés derrière un bouton « Archives · 3 »
 * (dépliés, il se lit « Refermer les archives »). Absentes quand rien n'est bouclé.
 */
export default function Archives({
  nombre,
  ouvertes,
  onBasculer,
  children,
}: {
  nombre: number
  ouvertes: boolean
  onBasculer: () => void
  children: ReactNode
}) {
  const idContenu = useId()
  if (nombre === 0) return null

  return (
    <>
      <button type="button" className={styles.archives} aria-expanded={ouvertes} aria-controls={idContenu} onClick={onBasculer}>
        {ouvertes ? 'Refermer les archives' : `Archives · ${nombre}`}
      </button>
      {ouvertes ? (
        <div id={idContenu} className={styles.contenu}>
          {children}
        </div>
      ) : null}
    </>
  )
}
