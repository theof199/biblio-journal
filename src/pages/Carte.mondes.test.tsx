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

  // Une bobine ramassée à une frontière, devant un autre monde que le sien.
  // Mutation : le compteur laissé sur la décennie à l'écran pendant le vol (« 1/3 » sous une bobine
  // de 1900, et un message qui dirait « 1/2 »).
  it('montre, pendant le vol d’une bobine d’une autre décennie, le compte de cette décennie-là, et le message dit le même', async () => {
    localStorage.setItem(CLE_BOBINES, JSON.stringify(['les-quatre-diables']))
    const { aLEcran, trouver, rappels } = await monter(1903)
    aLEcran(1890)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/3')
    act(() => rappels().bobine('essai-1900-a'))
    expect(compteur()).toHaveTextContent('Bobines retrouvées 0/2')
    act(() => rappels().bobineArrivee('essai-1900-a'))
    expect(screen.getByRole('status')).toHaveTextContent('Bobine retrouvée 1/2« Essai A », Personne, 1900 : un film perdu.')
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    trouver('essai-1900-b')
    expect(screen.getByRole('status')).toHaveTextContent('Bobine retrouvée 2/2')
    expect(compteur()).toHaveTextContent('Bobines retrouvées 2/2')
    expect(await screen.findByText('Toutes les bobines perdues sont retrouvées.', {}, { timeout: 4500 })).toBeInTheDocument()
  }, 15000)

  // Le compteur est caché tant que la décennie montrée n'a aucune trouvaille. Mutations : la
  // décennie de la bobine oubliée à son arrivée (le compteur, apparu pour le vol, disparaît devant un
  // 1890 sans trouvaille) ; `decennieVueRef` écrite elle aussi à l'arrivée (à l'image suivante, le
  // moteur redit 1890 et le compteur disparaît de même).
  it('n’apparaît jamais pour une bobine en vol pour disparaître à son arrivée', async () => {
    const { aLEcran, rappels } = await monter(1903)
    aLEcran(1890)
    expect(compteur()).not.toBeVisible()
    act(() => rappels().bobine('essai-1900-a'))
    expect(compteur()).toBeVisible()
    expect(compteur()).toHaveTextContent('Bobines retrouvées 0/2')
    act(() => rappels().bobineArrivee('essai-1900-a'))
    expect(compteur()).toBeVisible()
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    // Les images suivantes : le moteur redit la même décennie, le compteur garde celle de la bobine.
    for (let i = 0; i < 100; i++) aLEcran(1890)
    expect(compteur()).toBeVisible()
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
  })

  // Mutations : la décennie posée par une bobine arrivée gardée pour de bon (l'état jamais remplacé
  // une fois posé) ; le compte ou le total du message pris au compteur du dernier rendu (ramassée et
  // arrivée d'un coup, comme au calme, la bobine n'a pas eu de rendu en vol : ce compteur-là est
  // encore celui de 1890).
  it('revient, après le vol, à la décennie à l’écran dès que le moteur en dit une autre', async () => {
    localStorage.setItem(CLE_BOBINES, JSON.stringify(['les-quatre-diables', 'la-tete-de-janus']))
    const { aLEcran, trouver } = await monter(1903)
    aLEcran(1890)
    trouver('essai-1900-a')
    expect(screen.getByRole('status')).toHaveTextContent('Bobine retrouvée 1/2')
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    // Devant un monde sans bobines, il garde ce qu'il montre ; le moteur dit 1900 puis 1890 : il suit.
    aLEcran(1910)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    aLEcran(1900)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 1/2')
    aLEcran(1890)
    expect(compteur()).toHaveTextContent('Bobines retrouvées 2/3')
  })

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

  // Mutation : `setDecennieVue` sans comparaison à la dernière décennie dite. Le moteur dit la
  // décennie à chaque image : la page ne se rend que lorsqu'elle change. La mutation ne tombe que
  // d'un rendu (N + 1 contre N) : React écarte de lui-même un `setState` à valeur égale, sauf le
  // premier après un changement, pour lequel il rend le composant une fois avant de renoncer. Si
  // React cessait de le faire, la mutation deviendrait équivalente et ce test ne la verrait plus.
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
