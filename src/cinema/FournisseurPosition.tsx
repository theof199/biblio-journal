import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Coordonnees } from './distance'
import { ContextePosition, type Position, type StatutPosition } from './usePosition'

/** Une position récente suffit pour classer des salles, et un cache de quelques minutes épargne la puce GPS. */
const OPTIONS_POSITION: PositionOptions = { maximumAge: 5 * 60_000, timeout: 10_000 }

/**
 * Tient la position du membre pour toute l'app connectée, en mémoire : l'onglet Au ciné la demande,
 * la fiche d'un film ouverte depuis lui la relit ici sans rien redemander. Elle n'est ni stockée
 * (`localStorage`, cookie) ni jamais mise dans une requête : l'API ne reçoit rien de la position, les
 * distances se font sur le téléphone (`cinema/distance.ts`).
 */
export function FournisseurPosition({ children }: { children: ReactNode }) {
  const [statut, setStatut] = useState<StatutPosition>('verification')
  const [coordonnees, setCoordonnees] = useState<Coordonnees | null>(null)
  const verifiee = useRef(false)

  const lire = useCallback(() => {
    setStatut('en_attente')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCoordonnees({ latitude: coords.latitude, longitude: coords.longitude })
        setStatut('connue')
      },
      () => {
        // Refus, délai ou panne du capteur : la liste reste triée par heure, sans rien redemander.
        setStatut('indisponible')
      },
      OPTIONS_POSITION,
    )
  }, [])

  const verifier = useCallback(() => {
    if (verifiee.current) return
    verifiee.current = true
    if (!('geolocation' in navigator)) {
      setStatut('indisponible')
      return
    }
    if (!navigator.permissions?.query) {
      // Impossible de savoir à l'avance : le bouton reste offert, et le toucher tranche.
      setStatut('a_demander')
      return
    }
    navigator.permissions.query({ name: 'geolocation' }).then(
      ({ state }) => {
        if (state === 'granted') lire()
        else setStatut(state === 'denied' ? 'indisponible' : 'a_demander')
      },
      // Même raison : la permission est illisible, pas refusée.
      () => setStatut('a_demander'),
    )
  }, [lire])

  const demander = useCallback(() => {
    if (statut === 'a_demander') lire()
  }, [statut, lire])

  const valeur = useMemo<Position>(
    () => ({ statut, coordonnees, verifier, demander }),
    [statut, coordonnees, verifier, demander],
  )
  return <ContextePosition.Provider value={valeur}>{children}</ContextePosition.Provider>
}
