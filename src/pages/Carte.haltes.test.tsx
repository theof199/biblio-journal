import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import type { AnneeCarte, Voyage, Voyageur } from '../api/voyage'
import { FabriqueMoteurContexte } from '../carte/CarteCanvas'
import { exemple } from '../test/contrat'
import { moteurFactice } from '../test/moteurFactice'
import { json, servir } from '../test/serveur'
import { malleVide, voyage1890 } from '../test/voyage'

/**
 * La carte en sait plus (plan des écrans des lots, brief 9), côté page : ce que `GET /me/voyage` sert
 * de l'horaire d'une année et des haltes, et que la page donne au moteur dans l'état de la carte.
 * Le moteur est factice : le test lit les états reçus. Rien ne se dessine, rien ici ne regarde un écran.
 */
const SESSION = exemple<{ user: { id: string; pseudo: string } }>('/auth/me', 'get', 200)
const ETAT: Voyageur = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
const MELIES = exemple<Voyage>('/me/voyage', 'get', 200).haltes[0]!
const TENU: NonNullable<AnneeCarte['horaire']> = { echeance: '2026-10-04', accepte_le: '2026-09-28T08:00:00.000Z', etat: 'tenu' }
const ACCEPTE: NonNullable<AnneeCarte['horaire']> = { echeance: '2026-10-14', accepte_le: '2026-10-08T08:00:00.000Z', etat: 'accepte' }
const MANQUE: NonNullable<AnneeCarte['horaire']> = { echeance: '2026-09-20', accepte_le: '2026-09-14T08:00:00.000Z', etat: 'manque' }
const HORAIRES: Record<number, AnneeCarte['horaire']> = { 1899: MANQUE, 1902: TENU, 1903: ACCEPTE }

/** Un Voyage de 1895 à 1909, toutes les années ouvertes jusqu'à `enCours` ; trois d'entre elles portent un horaire. */
const voyage = (enCours: number, surcharge: Partial<Voyage> = {}) =>
  voyage1890(
    enCours,
    Array.from({ length: 1909 - 1895 + 1 }, (_, i) => {
      const annee = 1895 + i
      const horaire = HORAIRES[annee] ?? null
      return annee < enCours
        ? { annee, statut: 'ouverte' as const, visitee: true, recompense: null, progression: null, horaire }
        : { annee, statut: annee === enCours ? ('en_cours' as const) : ('verrouillee' as const), visitee: false, recompense: null, progression: null, profondeur: 0, horaire }
    }),
    surcharge,
  )

async function monter(servi: () => Voyage) {
  const f = moteurFactice()
  const client = createQueryClient()
  const requetes = servir({
    'GET /api/auth/me': () => json(SESSION),
    'GET /api/me/voyage': () => json(servi()),
    'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
    'GET /api/me/voyage/voyageur': () => json(ETAT),
    'GET /api/me/voyage/decennies/1900/etiquettes': () => json(malleVide(1900)),
  })
  render(
    <QueryClientProvider client={client}>
      <FabriqueMoteurContexte.Provider value={f.fabrique}>
        <MemoryRouter initialEntries={['/voyage']}>
          <App />
        </MemoryRouter>
      </FabriqueMoteurContexte.Provider>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(f.etats.length).toBeGreaterThan(0))
  await waitFor(() => expect(client.isFetching()).toBe(0))
  const dernier = () => f.etats[f.etats.length - 1]!
  return { ...f, client, requetes, dernier }
}

describe('la carte en sait plus : l’horaire et les haltes, de la page au moteur', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  // Mutations : le champ oublié dans la case ; l'horaire servi passé tel quel (`accepte_le` irait au
  // monde, qui n'en a pas l'usage) ; `undefined` au lieu de nul pour une année sans horaire.
  it('chaque case porte l’horaire de son année, son état et son échéance tels que servis, ou nul', async () => {
    const banc = await monter(() => voyage(1903))
    const horaires = new Map(banc.dernier().cases.map((c) => [c.annee, c.horaire]))
    expect(horaires.get(1899)).toEqual({ etat: 'manque', echeance: '2026-09-20' })
    expect(horaires.get(1902)).toEqual({ etat: 'tenu', echeance: '2026-10-04' })
    // Un mercredi : l'échéance est celle du serveur, jamais un dimanche calculé ici.
    expect(horaires.get(1903)).toEqual({ etat: 'accepte', echeance: '2026-10-14' })
    expect(horaires.get(1901)).toBeNull()
    expect(horaires.get(1904)).toBeNull()
  })

  // Le compte se fait sur ce qui est servi. Mutations : `total: 3` en dur ; un film « sur le Plex »
  // compté comme vu ; la halte servie passée telle quelle (ses films iraient au moteur).
  it('les haltes servies vont au moteur par leur clé, leur année d’embranchement et le compte de leurs films vus', async () => {
    const deux = { ...MELIES, cle: 'zecca', apres: 1901, films: [MELIES.films[0]!, { ...MELIES.films[2]!, etat: 'vu' as const }] }
    const banc = await monter(() => voyage(1903, { haltes: [deux, MELIES] }))
    expect(MELIES.films.map((f) => f.etat)).toEqual(['vu', 'sur_le_plex', 'a_demander'])
    expect(banc.dernier().haltes).toEqual([
      { cle: 'zecca', apres: 1901, vus: 2, total: 2 },
      { cle: 'melies', apres: 1902, vus: 1, total: 3 },
    ])
  })

  // 1900 est caché à qui est en 1899 (`premiereDecennieCachee`) : une halte que le serveur servirait
  // quand même n'a pas de tronçon à l'écran. Mutation : `v.haltes` passé sans le filtre.
  it('une halte d’une décennie cachée n’est pas passée au moteur', async () => {
    const banc = await monter(() => voyage(1899, { haltes: [MELIES] }))
    expect(banc.dernier().cases.map((c) => c.annee)).toEqual([1895, 1896, 1897, 1898, 1899])
    expect(banc.dernier().haltes).toEqual([])
    // Le témoin : la même, 1900 atteint.
    const ouvert = await monter(() => voyage(1902, { haltes: [MELIES] }))
    expect(ouvert.dernier().haltes).toEqual([{ cle: 'melies', apres: 1902, vus: 1, total: 3 }])
  })

  // Chaque `majEtat` vide les tuiles du sol : la carte relue sans changement ne refait pas son état,
  // et un horaire ou une halte qui change, si. Mutations : les haltes calculées au rendu et mises aux
  // dépendances de l'état ; `v` remplacé par ses seules années dans les dépendances.
  it('la carte relue à l’identique ne refait pas l’état, un horaire accepté ou un film de halte vu le refont', async () => {
    let servi = voyage(1903, { haltes: [MELIES] })
    const banc = await monter(() => servi)
    const relire = async () => {
      await act(() => banc.client.refetchQueries({ queryKey: cles.voyage, exact: true }))
      await waitFor(() => expect(banc.client.isFetching()).toBe(0))
    }
    const avant = banc.etats.length
    const lues = () => banc.requetes.filter((r) => r === 'GET /api/me/voyage').length
    const lectures = lues()
    await relire()
    expect(lues()).toBe(lectures + 1)
    expect(banc.etats).toHaveLength(avant)
    servi = voyage(1903, { haltes: [{ ...MELIES, films: MELIES.films.map((f) => ({ ...f, etat: 'vu' as const })) }] })
    await relire()
    expect(banc.etats).toHaveLength(avant + 1)
    expect(banc.dernier().haltes).toEqual([{ cle: 'melies', apres: 1902, vus: 3, total: 3 }])
    HORAIRES[1904] = ACCEPTE
    try {
      servi = voyage(1903, { haltes: servi.haltes })
      await relire()
      expect(banc.etats).toHaveLength(avant + 2)
      expect(banc.dernier().cases.find((c) => c.annee === 1904)!.horaire).toEqual({ etat: 'accepte', echeance: '2026-10-14' })
    } finally {
      delete HORAIRES[1904]
    }
  })
})
