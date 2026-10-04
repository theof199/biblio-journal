import { useEffect, useState } from 'react'

/** Assez fin pour qu'une séance commencée quitte l'écran dans la demi-minute, assez lâche pour ne rien coûter. */
const PAS_MS = 30_000

/**
 * L'horloge de la page, en millisecondes, relue toutes les trente secondes. Elle ne fait que refiltrer
 * ce que l'API a déjà donné (`cinema/seances.ts`) : aucune requête ne part avec elle.
 */
export function useMaintenant(): number {
  const [maintenant, setMaintenant] = useState(() => Date.now())
  useEffect(() => {
    const minuterie = setInterval(() => setMaintenant(Date.now()), PAS_MS)
    return () => clearInterval(minuterie)
  }, [])
  return maintenant
}
