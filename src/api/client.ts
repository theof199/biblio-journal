import type { ApiErrorBody } from './schema'

/**
 * Toujours un chemin, jamais une adresse : c'est le proxy de Vite qui relaie
 * vers l'API (voir `vite.config.ts`). Appeler l'API en direct ferait réussir la
 * connexion puis répondre 401 partout — le cookie de session est en SameSite=Lax
 * et ne repart jamais en inter-sites.
 */
const BASE = '/api'

/**
 * Erreur normalisée. Le back renvoie toujours `{ code, message, retryable }`
 * avec un `message` déjà rédigé en français, destiné à être affiché tel quel :
 * on ne réécrit pas de catalogue de messages par-dessus.
 */
export class ApiError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly status: number
  readonly retryAfterSeconds: number | null

  constructor(body: ApiErrorBody, status: number, retryAfterSeconds: number | null = null) {
    super(body.message)
    this.name = 'ApiError'
    this.code = body.code
    this.retryable = body.retryable
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }

  get isUnauthenticated() {
    return this.code === 'UNAUTHENTICATED'
  }

  /** Source externe absente ou non configurée : seule la recherche est concernée. */
  get isSearchUnavailable() {
    return this.code === 'SERVICE_UNCONFIGURED' || this.code === 'UPSTREAM_UNAVAILABLE'
  }
}

/** Le proxy est injoignable (machine éteinte, IP changée) : ce n'est pas une erreur métier. */
const networkError = () =>
  new ApiError(
    {
      code: 'NETWORK',
      message: 'L’API est injoignable. Vérifie ta connexion, puis réessaie.',
      retryable: true,
    },
    0,
  )

/**
 * Le délai de garde a tranché. Distinct de `NETWORK` : la connexion a réussi,
 * c'est la réponse qui n'est jamais venue — et les deux ne se corrigent pas de
 * la même façon.
 */
const timeoutError = () =>
  new ApiError(
    {
      code: 'TIMEOUT',
      message: 'L’API n’a pas répondu à temps. Réessaie dans un instant.',
      retryable: true,
    },
    0,
  )

/**
 * Un 200 dont le corps n'est pas du JSON.
 *
 * Le rendre `null` en silence — ce que faisait ce module — transformait une
 * panne de transport en succès : la requête se résolvait, aucune branche
 * d'erreur ne pouvait se déclencher, et l'écran cassait au premier
 * déréférencement, dans l'`ErrorBoundary`. Le symptôme ne ressemblait pas à sa
 * cause. Le cas réel est le repli SPA (`nginx.conf`), qui sert `index.html`
 * avec un 200 sur un chemin d'API qui n'existe pas.
 */
const malformedError = () =>
  new ApiError(
    {
      code: 'MALFORMED',
      message: 'L’API a répondu autre chose que du JSON. Réessaie, et signale-le si ça se répète.',
      retryable: true,
    },
    0,
  )

/**
 * Combien de temps on attend avant de déclarer la panne.
 *
 * Une écriture a droit à plus : verser une œuvre va chercher la fiche complète
 * chez la source, et `Search` annonce déjà « plusieurs secondes » à l'écran.
 * Sans ces deux valeurs, une connexion pendue laissait `isPending` à `true`
 * pour toujours — et l'écran restait sur son « Chargement… », sans issue.
 */
const DELAI_LECTURE = 20_000
const DELAI_ECRITURE = 45_000

const parseRetryAfter = (value: string | null): number | null => {
  if (!value) return null
  const seconds = Number(value)
  return Number.isFinite(seconds) ? seconds : null
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
  signal?: AbortSignal
  /** Remplace le délai de garde par défaut (lecture 20 s, écriture 45 s) : l'import Letterboxd attend des minutes. */
  timeoutMs?: number
}

const buildUrl = (path: string, query?: RequestOptions['query']) => {
  if (!query) return `${BASE}${path}`
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${BASE}${path}?${qs}` : `${BASE}${path}`
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, timeoutMs } = options

  // Deux signaux distincts, et il faut savoir lequel a tranché : une navigation
  // annule la requête, et une annulation n'est pas une panne à montrer.
  const garde = AbortSignal.timeout(timeoutMs ?? (method === 'GET' ? DELAI_LECTURE : DELAI_ECRITURE))
  const combine = signal ? AbortSignal.any([signal, garde]) : garde

  let response: Response
  let raw: string
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      signal: combine,
      // Inutile en même origine, mais garde le code valable le jour où l'API
      // sera réellement en ligne.
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        // Sans effet en mode proxy (SameSite=Lax), exigé sur les écritures dès
        // que l'API passe en SameSite=None. Le poser toujours coûte une ligne.
        'X-Mediatheque-Client': 'mediatheque-journal',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (response.status === 204) return undefined as T

    // La lecture du corps s'annule aussi : elle est dans le même `try` pour que
    // les trois issues ci-dessous la couvrent.
    raw = await response.text()
  } catch (error) {
    // L'appelant a annulé — React Query au démontage. On relaie tel quel : la
    // requête doit être traitée comme annulée, jamais comme échouée.
    if (signal?.aborted) throw error
    if (garde.aborted) throw timeoutError()
    throw networkError()
  }

  let payload: unknown = null
  let illisible = false
  if (raw) {
    try {
      payload = JSON.parse(raw)
    } catch {
      illisible = true
    }
  }

  if (!response.ok) {
    const envelope = payload as Partial<ApiErrorBody> | null
    const body: ApiErrorBody =
      envelope && typeof envelope.code === 'string' && typeof envelope.message === 'string'
        ? { code: envelope.code, message: envelope.message, retryable: envelope.retryable === true }
        : {
            code: 'INTERNAL',
            message: "Une erreur inattendue est survenue. Réessaie, et signale-la si elle persiste.",
            retryable: false,
          }
    throw new ApiError(body, response.status, parseRetryAfter(response.headers.get('Retry-After')))
  }

  // Un corps vide est légitime — il vaut `null`. Un corps non vide qui ne parse
  // pas ne l'est pas : c'est une panne, et elle se dit.
  if (illisible) throw malformedError()

  return payload as T
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown, timeoutMs?: number) =>
    request<T>(path, { method: 'POST', body, timeoutMs }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
