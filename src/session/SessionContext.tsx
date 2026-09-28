import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { lireSession, seConnecter, seDeconnecter } from '../api/session'
import type { Session } from '../api/schema'

interface SessionValue {
  user: Session['user']
  deconnecter: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

/** État de chargement de la session, avant de savoir s'il y a quelqu'un. */
export function useSessionQuery() {
  return useQuery<Session | null>({
    queryKey: cles.session,
    queryFn: lireSession,
    staleTime: Infinity,
    // Sans lui, une API injoignable fait patienter l'écran pendant les relances
    // au lieu de basculer tout de suite sur l'écran de panne.
    retry: false,
  })
}

export function useConnexion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ pseudo, password }: { pseudo: string; password: string }) =>
      seConnecter(pseudo, password),
    onSuccess: (session) => {
      client.setQueryData(cles.session, session)
    },
  })
}

export function SessionProvider({ session, children }: { session: Session; children: ReactNode }) {
  const client = useQueryClient()

  const deconnecter = useCallback(async () => {
    try {
      await seDeconnecter()
    } finally {
      // L'ordre compte. `setQueryData` notifie l'observateur de la garde, qui
      // bascule vers la connexion. `clear()` ne notifie personne : appelé
      // d'abord (l'ordre de Library), il laissait l'accueil à l'écran.
      client.setQueryData(cles.session, null)
      // Le reste du cache appartient à la session qui se ferme.
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== cles.session[0] })
    }
  }, [client])

  const value = useMemo<SessionValue>(
    () => ({ user: session.user, deconnecter }),
    [session, deconnecter],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession doit être utilisé sous un SessionProvider')
  return value
}
