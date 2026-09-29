import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '../api/queryClient'
import type { Reglages, Voyage } from '../api/voyage'
import { exemple } from '../test/contrat'
import { json, servir } from '../test/serveur'
import Rattrapage from './Rattrapage'

const CARTE = 'GET /api/me/voyage'
const REGLER = 'PATCH /api/me/voyage/reglages'

const base = exemple<Voyage>('/me/voyage', 'get', 200)
const source = { id: base.source?.id ?? 'a9f1b1c6-0000-4000-8000-000000000001', pseudo: 'Théo', annee_en_cours: 1958 }
/** La carte d'un membre qui suit Théo, et celle du compte IA (aucune source). */
const membre = (rattrape: boolean): Voyage => ({ ...base, ia: false, source, rattrape_la_source: rattrape })
const compteIa: Voyage = { ...base, ia: true, source: null, rattrape_la_source: false }

function monter() {
  const client = createQueryClient()
  const invalidations = vi.spyOn(client, 'invalidateQueries')
  render(
    <QueryClientProvider client={client}>
      <Rattrapage />
    </QueryClientProvider>,
  )
  return invalidations
}

describe('« Rattraper » le Voyage suivi, au profil', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  // Mutation : retirer le garde `!source` (l'interrupteur s'afficherait aussi pour le compte IA).
  it('n’existe pas pour le compte IA, qui ne suit personne', async () => {
    const requetes = servir({ [CARTE]: () => json(compteIa) })
    monter()
    await waitFor(() => expect(requetes).toContain(CARTE))
    // Le témoin : la même page, pour un membre qui suit Théo, l'affiche (test suivant) ; ici on
    // laisse la réponse s'installer avant de constater l'absence.
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  // Mutation : lire un état en dur (`checked={false}`) au lieu de `rattrape_la_source`.
  it('montre l’état du réglage et le nom du compte suivi', async () => {
    servir({ [CARTE]: () => json(membre(true)) })
    monter()
    const interrupteur = await screen.findByRole('switch', { name: /Ouvrir toutes les années jusqu’à celle de Théo/ })
    expect(interrupteur).toBeChecked()
    expect(screen.getByText(/ta propre progression revient/)).toBeInTheDocument()
  })

  // Mutation : envoyer la valeur d'avant (`!checked`) ; ne pas invalider `voyage` (la carte
  // garderait l'ancienne année) ; oublier les réalisateurs (`annee_ouverte`).
  it('envoie le nouveau réglage puis périme le Voyage', async () => {
    let etat = false
    const requetes = servir({
      [CARTE]: () => json(membre(etat)),
      [REGLER]: (init) => {
        etat = JSON.parse(String(init.body)).rattrape_la_source
        return json({ rattrape_la_source: etat, annee_en_cours: 1958 } satisfies Reglages)
      },
    })
    const invalidations = monter()
    const interrupteur = await screen.findByRole('switch')
    expect(interrupteur).not.toBeChecked()

    fireEvent.click(interrupteur)
    await waitFor(() => expect(screen.getByRole('switch')).toBeChecked())
    expect(requetes.filter((r) => r === REGLER)).toHaveLength(1)
    expect(requetes.filter((r) => r === CARTE)).toHaveLength(2)
    const cles = invalidations.mock.calls.map(([filtre]) => JSON.stringify(filtre?.queryKey))
    expect(cles).toContain('["voyage"]')
    expect(cles).toContain('["realisateurs"]')

    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(screen.getByRole('switch')).not.toBeChecked())
  })

  // Mutation : avaler l'erreur au lieu de l'afficher.
  it('dit pourquoi l’API a refusé', async () => {
    servir({
      [CARTE]: () => json(membre(false)),
      [REGLER]: () => json({ code: 'CONFLICT', message: 'Ce réglage ne sert pas ici.', retryable: false }, 409),
    })
    monter()
    fireEvent.click(await screen.findByRole('switch'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce réglage ne sert pas ici.')
    expect(screen.getByRole('switch')).not.toBeChecked()
  })
})
