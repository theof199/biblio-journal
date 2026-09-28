import { describe, expect, it } from 'vitest'
import { ApiError } from './client'
import { createQueryClient } from './queryClient'
import { cles } from './cles'

const expire = () =>
  new ApiError({ code: 'UNAUTHENTICATED', message: 'Session expirée.', retryable: false }, 401)

/**
 * Ce que le cache fait d'une session expirée.
 *
 * Le cas des **écritures** est celui qui manquait : lectures et écritures ont
 * chacune leur cache, et seule la première était branchée. Un 401 reçu en
 * cochant un épisode laissait donc la coquille authentifiée à l'écran — on
 * continuait à cliquer dans une application où l'on n'était plus, jusqu'à ce
 * qu'une lecture quelconque repasse par là.
 */
describe('createQueryClient — la session expirée se remet à zéro', () => {
  it('remet la session à zéro sur un 401 de lecture', async () => {
    const client = createQueryClient()
    client.setQueryData(cles.session, { user: { id: 'u1' } })

    await client
      .fetchQuery({ queryKey: ['epreuve'], queryFn: () => Promise.reject(expire()) })
      .catch(() => undefined)

    expect(client.getQueryData(cles.session)).toBeNull()
  })

  it('remet la session à zéro sur un 401 d’écriture', async () => {
    const client = createQueryClient()
    client.setQueryData(cles.session, { user: { id: 'u1' } })

    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(expire()) })
      .execute(undefined)
      .catch(() => undefined)

    expect(client.getQueryData(cles.session)).toBeNull()
  })

  /** Une panne ordinaire ne déconnecte personne — sans quoi la moindre coupure
      réseau renverrait à l'écran de connexion. */
  it('ne touche pas à la session sur une erreur qui n’est pas un 401', async () => {
    const client = createQueryClient()
    const session = { user: { id: 'u1' } }
    client.setQueryData(cles.session, session)

    await client
      .getMutationCache()
      .build(client, {
        mutationFn: () =>
          Promise.reject(
            new ApiError({ code: 'NETWORK', message: 'Injoignable.', retryable: true }, 0),
          ),
      })
      .execute(undefined)
      .catch(() => undefined)

    expect(client.getQueryData(cles.session)).toBe(session)
  })
})
