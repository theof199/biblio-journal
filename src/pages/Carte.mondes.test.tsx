import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { createQueryClient } from '../api/queryClient'
import { FabriqueMoteurContexte } from '../carte/CarteCanvas'
import { exemple } from '../test/contrat'
import { moteurFactice } from '../test/moteurFactice'
import { json, servir } from '../test/serveur'
import { voyage1890 } from '../test/voyage'

/**
 * Le registre de la page est une constante de module : ce fichier le double pour avoir deux mondes à
 * bobines. 1890 reste le vrai (trois bobines) ; 1900 est le monde « à venir » avec deux bobines
 * d'essai ; 1910 reste « à venir », sans bobine. `Carte.test.tsx` garde le vrai registre.
 */
const essai = vi.hoisted(() => ({
  bobines1900: [
    { cle: 'essai-1900-a', titre: 'Essai A', qui: 'Personne, 1900' },
    { cle: 'essai-1900-b', titre: 'Essai B', qui: 'Personne, 1902' },
  ],
  /** Les rendus de la page : `useMouvementReduit` y est appelé une fois par rendu. */
  rendus: 0,
}))
vi.mock('../mondes', async (original) => {
  const vrai = await original<typeof import('../mondes')>()
  return {
    ...vrai,
    creerRegistre: () => {
      const registre = vrai.creerRegistre()
      const de1900 = { ...registre(1900), bobines: essai.bobines1900 }
      return (decennie: number) => (decennie === 1900 ? de1900 : registre(decennie))
    },
  }
})
vi.mock('../ui/mouvement', async (original) => {
  const vrai = await original<typeof import('../ui/mouvement')>()
  return {
    ...vrai,
    useMouvementReduit: () => {
      essai.rendus += 1
      return vrai.useMouvementReduit()
    },
  }
})

const SESSION = exemple<{ user: { id: string; pseudo: string } }>('/auth/me', 'get', 200)
const CLE_BOBINES = `journal.carte.bobines.${SESSION.user.id}`

/** Un Voyage de 1895 à 1912 : trois décennies, dont la dernière sans bobine. */
const voyage = (enCours: number) =>
  voyage1890(
    enCours,
    Array.from({ length: 1912 - 1895 + 1 }, (_, i) => {
      const annee = 1895 + i
      return annee < enCours
        ? { annee, statut: 'ouverte' as const, visitee: true, recompense: null, progression: null }
        : { annee, statut: annee === enCours ? ('en_cours' as const) : ('verrouillee' as const), visitee: false, recompense: null, progression: null, profondeur: 0 }
    }),
  )

async function monter(enCours: number) {
  const f = moteurFactice()
  servir({
    'GET /api/auth/me': () => json(SESSION),
    'GET /api/me/voyage': () => json(voyage(enCours)),
    'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
  })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <FabriqueMoteurContexte.Provider value={f.fabrique}>
        <MemoryRouter initialEntries={['/voyage']}>
          <App />
        </MemoryRouter>
      </FabriqueMoteurContexte.Provider>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(f.etats.length).toBeGreaterThan(0))
  /** Une image du moteur : la décennie à l'écran, dite avec les présences. */
  const aLEcran = (decennie: number | null) => act(() => f.rappels().presences([], decennie))
  const trouver = (cle: string) =>
    act(() => {
      f.rappels().bobine(cle)
      f.rappels().bobineArrivee(cle)
    })
  return { ...f, aLEcran, trouver }
}

const compteur = () => screen.getByText(/^Bobines retrouvées/)

describe('le compteur de bobines, par décennie', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  // Mutations : le compte et le total pris à toutes les bobines du Voyage (`bobinesDuVoyage`) à la
  // place de celles du monde montré ; un nouveau nom pour la clé de `carte/memoire.ts` (les bobines
  // trouvées avant le lot, écrites sous ce nom-ci, ne seraient plus comptées).
  it('ne mêle pas deux décennies : une trouvaille dans l’une ne monte pas le compte de l’autre, et celles d’avant le lot restent comptées', async () => {
    localStorage.setItem(CLE_BOBINES, JSON.stringify(['les-quatre-diables', 'la-tete-de-janus', 'essai-1900-a']))
    const { aLEcran, trouver } = await monter(1903)
    aLEcran(1900)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    aLEcran(1890)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 2/3')
    aLEcran(1900)
    trouver('essai-1900-b')
    expect(compteur()).toHaveTextContent('Bobines retrouvées 2/2')
    aLEcran(1890)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 2/3')
    expect(JSON.parse(localStorage.getItem(CLE_BOBINES)!)).toEqual(['les-quatre-diables', 'la-tete-de-janus', 'essai-1900-a', 'essai-1900-b'])
  })

  // Mutations : le total, ou le compte, du message pris à la décennie à l'écran ; « toutes
  // retrouvées » décidé sur la décennie à l'écran (jamais dit ici : 1890 n'en a aucune).
  it('compte le message d’une bobine dans la décennie de cette bobine, pas dans celle du compteur', async () => {
    localStorage.setItem(CLE_BOBINES, JSON.stringify(['les-quatre-diables']))
    const { aLEcran, trouver } = await monter(1903)
    aLEcran(1890)
    trouver('essai-1900-a')
    expect(screen.getByRole('status')).toHaveTextContent('Bobine retrouvée 1/2« Essai A », Personne, 1900 : un film perdu.')
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/3')
    trouver('essai-1900-b')
    expect(screen.getByRole('status')).toHaveTextContent('Bobine retrouvée 2/2')
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/3')
    expect(await screen.findByText('Toutes les bobines perdues sont retrouvées.', {}, { timeout: 4500 })).toBeInTheDocument()
  }, 15000)

  // Mutations : la décennie montrée suivie sans condition (devant 1910, « 0/0 », et le compteur
  // caché) ; une décennie nulle (une carte sans section) qui viderait le compteur.
  it('garde, devant un monde sans bobines, la décennie qu’il montrait', async () => {
    localStorage.setItem(CLE_BOBINES, JSON.stringify(['essai-1900-a']))
    const { aLEcran } = await monter(1911)
    aLEcran(1900)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    aLEcran(1910)
    expect(compteur()).toBeVisible()
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    aLEcran(null)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    // Et il la quitte pour la prochaine qui en porte.
    aLEcran(1890)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 0/3')
  })

  // Le moteur n'a encore rien dit. Mutations : la décennie de l'année en cours prise telle quelle
  // (1910 : « 0/0 ») ; la dernière décennie à bobines du Voyage, sans regarder l'année en cours
  // (1900 pour un membre encore en 1898) ; la première (1890 pour un membre en 1911).
  it.each([
    { enCours: 1898, texte: 'Bobines retrouvées 1/3' },
    { enCours: 1903, texte: 'Bobines retrouvées 2/2' },
    { enCours: 1911, texte: 'Bobines retrouvées 2/2' },
  ])('montre à l’ouverture la décennie de l’année en cours ($enCours), ou la dernière avant elle qui porte des bobines', async ({ enCours, texte }) => {
    localStorage.setItem(CLE_BOBINES, JSON.stringify(['les-quatre-diables', 'essai-1900-a', 'essai-1900-b']))
    const { aLEcran } = await monter(enCours)
    expect(compteur()).toBeVisible()
    expect(compteur()).toHaveTextContent(texte)
    // La première image devant un monde sans bobines n'y change rien.
    aLEcran(1910)
    expect(compteur()).toHaveTextContent(texte)
  })

  // Mutation : `setDecennieVue` sans comparaison à la décennie déjà montrée. Le moteur dit la
  // décennie à chaque image : la page ne se rend que lorsqu'elle change.
  it('ne rend pas la page une fois de plus pour cent images sans changement de décennie', async () => {
    const { aLEcran } = await monter(1903)
    aLEcran(1890)
    const avant = essai.rendus
    expect(avant).toBeGreaterThan(0)
    for (let i = 0; i < 100; i++) aLEcran(1890)
    for (let i = 0; i < 100; i++) aLEcran(1910)
    expect(essai.rendus).toBe(avant)
    // Le témoin : un changement de décennie, lui, rend la page.
    aLEcran(1900)
    expect(essai.rendus).toBeGreaterThan(avant)
  })
})
