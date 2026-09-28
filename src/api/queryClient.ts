import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'
import { cles } from './cles'

/**
 * La configuration du cache, séparée de l'amorçage.
 *
 * `main.tsx` monte l'application dans le document : rien de ce qu'il contient
 * ne s'importe depuis un test. Or ce qui est réglé ici — quand on réessaie,
 * quand on abandonne, et ce qu'on fait d'une session expirée — est du
 * comportement, pas du câblage, et mérite d'être éprouvé. D'où cette fabrique :
 * `main.tsx` l'appelle une fois, un test peut l'appeler autant qu'il veut.
 */
export function createQueryClient() {
  /**
   * Session expirée : on la remet à zéro une fois pour toutes plutôt que de
   * laisser chaque écran gérer son propre 401.
   *
   * Il en faut **deux** — lectures et écritures ont chacune leur cache. Avec la
   * seule des lectures, un 401 reçu en cochant un épisode laissait la coquille
   * authentifiée à l'écran jusqu'à ce qu'une lecture quelconque repasse : on
   * continuait à cliquer dans une application où l'on n'était plus.
   */
  const surErreur = (error: unknown) => {
    if (error instanceof ApiError && error.isUnauthenticated) {
      client.setQueryData(cles.session, null)
    }
  }

  const client = new QueryClient({
    queryCache: new QueryCache({ onError: surErreur }),
    mutationCache: new MutationCache({ onError: surErreur }),
    defaultOptions: {
      queries: {
        // `retryable` du back tranche : réessayer une erreur de validation ou un
        // service non configuré ne sert à rien.
        retry: (failureCount, error) =>
          error instanceof ApiError && error.retryable && failureCount < 2,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return client
}
