import type { components, paths } from './types'

/** Alias sur les types engendrés : on ne redéclare jamais une forme à la main. */
export type ApiErrorBody = components['schemas']['ApiError']
export type Session = paths['/auth/me']['get']['responses'][200]['content']['application/json']
