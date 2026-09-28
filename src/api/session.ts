import { ApiError, api } from './client'
import type { Session } from './schema'

/** Un 401 n'est pas une panne ici : c'est « personne n'est connecté ». */
export const lireSession = async (): Promise<Session | null> => {
  try {
    return await api.get<Session>('/auth/me')
  } catch (erreur) {
    if (erreur instanceof ApiError && erreur.isUnauthenticated) return null
    throw erreur
  }
}

export const seConnecter = (pseudo: string, password: string) =>
  api.post<Session>('/auth/login', { pseudo, password })

/** Idempotent, 204. */
export const seDeconnecter = () => api.post<void>('/auth/logout')

/**
 * Outil de développement : l'API ne monte la route que si `ENABLE_DEV_LOGIN`
 * le dit, par défaut hors production (404 sinon). Seul `ConnexionDev`, rendu
 * sous `import.meta.env.DEV`, l'appelle ;
 * `scripts/verifier-dist.mjs` (tâche 4) prouve qu'elle ne part pas en ligne.
 */
export const connexionDev = (pseudo: string) => api.post<Session>('/auth/dev-login', { pseudo })
