import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request } from './client'

/**
 * Le module le plus central du dépôt — tout passe par lui — et celui dont les
 * pannes se voyaient le moins.
 *
 * Ce qui s'éprouve ici n'est pas le chemin heureux : c'est que **chaque façon
 * d'échouer se dise sous son vrai nom**. Une réponse illisible, un serveur
 * muet et une navigation ne se corrigent pas de la même manière, et les
 * confondre a coûté cher : un 200 non-JSON se résolvait en `null`, la requête
 * réussissait, et l'écran cassait plus loin dans l'`ErrorBoundary` — un
 * symptôme qui ne ressemblait pas à sa cause.
 */
const reponse = (corps: string, init: ResponseInit = {}) =>
  new Response(corps, { status: 200, ...init })

describe('request — chaque panne sous son vrai nom', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('rend la charge quand le corps est du JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse('{"id":"m1"}'))

    await expect(request('/media/m1')).resolves.toEqual({ id: 'm1' })
  })

  it('rend `undefined` sur un 204, sans lire de corps', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    await expect(request('/tracking/t1')).resolves.toBeUndefined()
  })

  it('rend `null` sur un corps vide — c’est légitime', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse(''))

    await expect(request('/auth/me')).resolves.toBeNull()
  })

  /**
   * Le cœur du lot. Le repli SPA sert `index.html` avec un **200** sur un
   * chemin d'API qui n'existe pas : le corps est du HTML, et il ne parse pas.
   */
  it('lève sur un 200 dont le corps n’est pas du JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(
      reponse('<!doctype html><title>Médiathèque</title>', {
        headers: { 'content-type': 'text/html' },
      }),
    )

    await expect(request('/media/m1')).rejects.toMatchObject({
      code: 'MALFORMED',
      retryable: true,
    })
  })

  /**
   * Et surtout : plus jamais `null`. C'est ce `null` qui se faisait passer
   * pour « personne n'est connecté » sur `/auth/me` et renvoyait à l'écran de
   * connexion un membre qui n'avait jamais été déconnecté.
   */
  it('ne rend jamais `null` pour un corps illisible', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse('<!doctype html>'))

    const issue = await request('/auth/me').then(
      (valeur) => ({ resolu: valeur }),
      (erreur: unknown) => ({ leve: erreur }),
    )

    expect(issue).not.toHaveProperty('resolu')
  })

  it('relaie le message du serveur sur une erreur métier', async () => {
    vi.mocked(fetch).mockResolvedValue(
      reponse(JSON.stringify({ code: 'NOT_FOUND', message: 'Cette œuvre n’existe pas.', retryable: false }), {
        status: 404,
      }),
    )

    await expect(request('/media/absent')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Cette œuvre n’existe pas.',
      status: 404,
    })
  })

  /** Un corps d'erreur illisible garde son statut : il en dit plus que `MALFORMED`. */
  it('garde le statut quand le corps d’erreur est illisible', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse('<html>502 Bad Gateway</html>', { status: 502 }))

    await expect(request('/media/m1')).rejects.toMatchObject({
      code: 'INTERNAL',
      status: 502,
    })
  })

  it('lit `Retry-After` sur un 429', async () => {
    vi.mocked(fetch).mockResolvedValue(
      reponse(JSON.stringify({ code: 'RATE_LIMITED', message: 'Trop d’essais.', retryable: true }), {
        status: 429,
        headers: { 'Retry-After': '42' },
      }),
    )

    await expect(request('/auth/login', { method: 'POST' })).rejects.toMatchObject({
      retryAfterSeconds: 42,
    })
  })

  it('dit `NETWORK` quand le proxy est injoignable', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(request('/media/m1')).rejects.toMatchObject({ code: 'NETWORK', status: 0 })
  })

  /**
   * L'annulation **n'est pas une panne**. React Query annule au démontage :
   * transformer ça en `NETWORK` ferait clignoter « L'API est injoignable » à
   * chaque navigation un peu rapide.
   */
  it('relaie l’annulation de l’appelant telle quelle, sans la déguiser', async () => {
    const controleur = new AbortController()
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')))
        }),
    )

    const promesse = request('/media/m1', { signal: controleur.signal })
    controleur.abort()

    const erreur = await promesse.catch((e: unknown) => e)
    expect(erreur).not.toBeInstanceOf(ApiError)
  })

  /**
   * Le délai de garde, lui, **est** une panne — et distincte de `NETWORK` : la
   * connexion a réussi, c'est la réponse qui n'est jamais venue. Sans lui, une
   * connexion pendue laissait l'écran sur « Chargement… » pour toujours.
   */
  it('dit `TIMEOUT` quand le serveur ne répond jamais', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')))
        }),
    )

    const promesse = request('/media/m1')
    const issue = promesse.catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(21_000)

    expect(await issue).toMatchObject({ code: 'TIMEOUT', retryable: true })
  })

  /** Une écriture a droit à plus de temps : verser une œuvre interroge la source. */
  it('laisse plus de temps à une écriture qu’à une lecture', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')))
        }),
    )

    const issue = request('/media', { method: 'POST', body: {} }).catch((e: unknown) => e)

    // À 21 s une lecture aurait déjà rendu les armes. La course contre un
    // témoin déjà résolu tranche sans ambiguïté : si l'écriture avait pris le
    // délai de lecture, c'est `issue` qui gagnerait ici.
    await vi.advanceTimersByTimeAsync(21_000)
    const temoin = Symbol('en cours')
    expect(await Promise.race([issue, Promise.resolve(temoin)])).toBe(temoin)

    await vi.advanceTimersByTimeAsync(25_000)
    expect(await issue).toMatchObject({ code: 'TIMEOUT' })
  })
})

describe('request — un délai propre à l’appel', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('`timeoutMs` remplace le délai d’écriture : rien à 60 s, `TIMEOUT` à l’échéance donnée', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')))
        }),
    )
    const issue = request('/x', { method: 'POST', body: {}, timeoutMs: 120_000 }).catch((e: unknown) => e)

    await vi.advanceTimersByTimeAsync(60_000)
    const temoin = Symbol('en cours')
    expect(await Promise.race([issue, Promise.resolve(temoin)])).toBe(temoin)

    await vi.advanceTimersByTimeAsync(61_000)
    expect(await issue).toMatchObject({ code: 'TIMEOUT' })
  })
})

describe('request — ce que le Journal envoie et accepte', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('se présente comme le Journal et joint le cookie', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }))

    await request('/auth/me')

    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'X-Mediatheque-Client': 'mediatheque-journal' }),
      }),
    )
  })

  // Le Voyage répond 202 « en préparation » avec un corps : ce n'est pas une panne.
  it('rend le corps d’un 202', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('{"statut":"en_preparation"}', { status: 202 }),
    )

    await expect(request('/me/voyage/annees/1950')).resolves.toEqual({ statut: 'en_preparation' })
  })

  it('rend l’enveloppe d’erreur de l’API telle quelle', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        '{"code":"UNAUTHENTICATED","message":"Pseudo ou mot de passe incorrect.","retryable":false}',
        { status: 401 },
      ),
    )

    const erreur = await request('/auth/login', { method: 'POST', body: {} }).catch((e: unknown) => e)

    expect(erreur).toBeInstanceOf(ApiError)
    expect(erreur).toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Pseudo ou mot de passe incorrect.',
      status: 401,
    })
    // Un accesseur du prototype : `toMatchObject` ne le garantit pas, on le lit.
    expect((erreur as ApiError).isUnauthenticated).toBe(true)
  })
})
