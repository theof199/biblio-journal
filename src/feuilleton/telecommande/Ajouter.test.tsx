import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import type { Ajout, SerieTrouvee, Telecommande } from '../../api/feuilleton'
import { exemple } from '../../test/contrat'
import { json } from '../../test/serveur'
import { adresse, DARK, DEUX, ecran, historique, LIRE, monter, refus, retenue, serie, SEVERANCE, SOIR, touche } from '../../test/telecommande'

await import('../Feuilleton')
await import('../../maison/Maison')
await import('./Panneau')

const TROUVEE = exemple<{ items: SerieTrouvee[] }>('/search', 'get', 200).items.find((resultat) => resultat.type === 'tv')!
const AJOUT = exemple<Ajout>('/media', 'post', 201)
const trouvee = (externe: string, title: string, year: number | null, media_id: string | null): SerieTrouvee => ({ ...TROUVEE, external_id: externe, title, year, cover_url: null, in_library: media_id !== null, media_id })
const WIRE_ID = 'd0000000-0000-4000-8000-0000000000c1'
/** Dark : en cours. Severance : en pause. Lost : en bibliothèque, mais plus dans la télécommande (finie). The Wire : jamais ajoutée. */
const RESULTATS = [trouvee('70523', 'Dark', 2017, DARK.id), trouvee('95396', 'Severance', 2022, SEVERANCE.id), trouvee('4607', 'Lost', 2004, 'd0000000-0000-4000-8000-0000000000f1'), trouvee('1438', 'The Wire', 2002, null), trouvee('65494', 'The Crown', null, null)]
const page = (items: SerieTrouvee[]) => json({ items, next_cursor: null, total: items.length })
/** The Wire, jamais commencée : ce que la télécommande en dit après l'ajout. */
const WIRE = serie(WIRE_ID, 'The Wire', '2026-10-14T08:00:00.000Z', { repere: 'suivi', prochain: { ...DARK.prochain!, id: 'aaaaaaaa-0000-4000-8000-0000000000c1', saison: 1, numero: 1, titre: 'La cible' }, ensuite: null })

const CHERCHER = (q: string) => `GET /api/search?type=tv&q=${q}`
const AJOUTER = 'POST /api/media'
const champ = () => screen.findByRole('searchbox', { name: 'Chercher une série' })
const taper = async (texte: string) => fireEvent.change(await champ(), { target: { value: texte } })
const resultat = async (titre: string) => (await screen.findByRole('heading', { level: 3, name: titre })).closest('li')!

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(SOIR)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ajouter une série : la recherche', () => {
  // Mutation, dans `VueAjouter.tsx` : la phrase ôtée ; dans `donnees.ts` : `enabled` ôté de `useLaRecherche`.
  it('rien de tapé : une phrase, et aucune recherche ne part', async () => {
    const { requetes } = monter({ [LIRE]: () => json(DEUX) }, 'ajouter')

    await champ()
    expect(screen.getByText(/Tape le titre d’une série/)).toBeInTheDocument()
    await taper('   ')
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(requetes).toEqual(['GET /api/auth/me', LIRE])
  })

  // Mutations, dans `VueAjouter.tsx` : `useValeurDebouncee(tape)` remplacé par `tape` (trois requêtes) ;
  // dans `api/feuilleton.ts` : `type: 'movie'` ; le titre ou l'année ôtés d'un résultat.
  it('la frappe est retardée : trois frappes, une seule requête, `type=tv` ; chaque résultat dit son titre et son année', async () => {
    const { requetes } = monter({ [LIRE]: () => json(DEUX), [CHERCHER('the')]: () => page(RESULTATS) }, 'ajouter')

    await taper('t')
    await taper('th')
    await taper('the')

    const wire = await resultat('The Wire')
    expect(wire).toHaveTextContent('2002')
    expect(within(screen.getByRole('list', { name: 'Résultats' })).getAllByRole('heading', { level: 3 }).map((titre) => titre.textContent)).toEqual(['Dark', 'Severance', 'Lost', 'The Wire', 'The Crown'])
    expect(requetes.filter((requete) => requete.startsWith('GET /api/search'))).toEqual([CHERCHER('the')])
  })

  // Mutations, dans `VueAjouter.tsx` : `suivies.has(…)` remplacé par `resultat.in_library` (Lost dirait
  // « déjà suivie ») ; dans `vivante.ts` : `suivies` tiré de `seriesEnCours` (Severance offrirait « Ajouter »).
  it('« déjà suivie » pour une série de la télécommande, en cours ou en pause ; « Ajouter » pour toute autre, déjà en bibliothèque ou non', async () => {
    monter({ [LIRE]: () => json(DEUX), [CHERCHER('the')]: () => page(RESULTATS) }, 'ajouter')
    await taper('the')

    for (const titre of ['Dark', 'Severance']) {
      const ligne = await resultat(titre)
      expect(ligne).toHaveTextContent('déjà suivie')
      expect(within(ligne).queryByRole('button')).toBeNull()
    }
    expect(within(await resultat('Lost')).getByRole('button', { name: 'Ajouter Lost (2004)' })).toBeEnabled()
    expect(within(await resultat('The Wire')).getByRole('button', { name: 'Ajouter The Wire (2002)' })).toBeEnabled()
    expect(within(await resultat('The Crown')).getByRole('button', { name: 'Ajouter The Crown' })).toBeEnabled()
  })

  // Mutation, dans `VueAjouter.tsx` : `enAttente` forcé à faux (« Aucune série à ce nom » pendant la frappe).
  it('pendant la frappe et la requête : des résultats fantômes, pas « Aucune série »', async () => {
    const lente = retenue()
    monter({ [LIRE]: () => json(DEUX), [CHERCHER('the')]: () => lente.promesse }, 'ajouter')

    await taper('the')

    expect(screen.getByText('La recherche est en cours…')).toBeInTheDocument()
    expect(screen.queryByText('Aucune série à ce nom')).toBeNull()
    await vi.waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([entree]) => String(entree).includes('/search'))).toBe(true))
    expect(screen.getByText('La recherche est en cours…')).toBeInTheDocument()
    lente.rendre(page([]))
    expect(await screen.findByText('Aucune série à ce nom')).toBeInTheDocument()
  })

  // Mutation, dans `VueAjouter.tsx` : la branche `resultats.length === 0` ôtée (une liste vide, muette).
  it('sans résultat : « Aucune série à ce nom », et quoi essayer', async () => {
    monter({ [LIRE]: () => json(DEUX), [CHERCHER('legandes')]: () => page([]) }, 'ajouter')
    await taper('legandes')

    expect(await screen.findByRole('heading', { level: 3, name: 'Aucune série à ce nom' })).toBeInTheDocument()
    expect(screen.getByText('Essaie un autre titre, ou son titre d’origine.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Résultats' })).toBeNull()
  })

  // Mutations, dans `VueAjouter.tsx` : `isSearchUnavailable` ôté (le titre resterait « Sans signal ») ; `onReessayer` ôté.
  it.each([
    ['la source est en panne', 'Recherche indisponible', 'UPSTREAM_UNAVAILABLE'],
    ['une erreur quelconque', 'Sans signal', 'INTERNAL'],
  ])('la panne (%s) : le message de l’API sous « %s », et « Réessayer » relance', async (_cas, titre, code) => {
    let essais = 0
    monter({ [LIRE]: () => json(DEUX), [CHERCHER('the')]: () => (++essais === 1 ? refus(503, 'La source est indisponible. Réessaie plus tard.', code) : page(RESULTATS)) }, 'ajouter')
    await taper('the')

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent(titre)
    expect(alerte).toHaveTextContent('La source est indisponible. Réessaie plus tard.')

    fireEvent.click(within(alerte).getByRole('button', { name: 'Réessayer' }))

    expect(await resultat('The Wire')).toBeInTheDocument()
    expect(essais).toBe(2)
  })
})

describe('ajouter une série : l’ajout', () => {
  // Mutations, dans `api/feuilleton.ts` : `external_id` remplacé par le titre, `type: 'movie'` ; dans
  // `VueAjouter.tsx` : le verrou et `disabled` ôtés ensemble (deux `POST`) ; le verrou rendu commun à tous
  // les résultats (The Crown s'éteindrait) ; « Ajout… » ôté.
  it('« Ajouter » : un seul `POST /media`, son corps exact ; la touche dit l’attente et se verrouille, résultat par résultat', async () => {
    const import_ = retenue()
    const { corps, ecritures } = monter({ [LIRE]: () => json(DEUX), [CHERCHER('the')]: () => page(RESULTATS), [AJOUTER]: () => import_.promesse }, 'ajouter')
    await taper('the')
    const wire = await resultat('The Wire')

    fireEvent.click(within(wire).getByRole('button', { name: 'Ajouter The Wire (2002)' }))
    fireEvent.click(within(wire).getByRole('button', { name: 'Ajouter The Wire (2002)' }))

    const occupee = within(wire).getByRole('button', { name: 'Ajouter The Wire (2002)' })
    expect(occupee).toHaveTextContent('Ajout…')
    expect(occupee).toBeDisabled()
    expect(occupee).toHaveAttribute('aria-busy', 'true')
    expect(within(await resultat('The Crown')).getByRole('button')).toBeEnabled()
    expect(within(await resultat('The Crown')).getByRole('button')).toHaveTextContent('Ajouter')
    await vi.waitFor(() => expect(ecritures()).toEqual([AJOUTER]))
    expect(corps).toEqual([{ source: 'tmdb', external_id: '1438', type: 'tv' }])
    expect(adresse()).toBe('/feuilleton/maison?telecommande=ajouter')
    import_.rendre(json({ ...AJOUT, media: { ...AJOUT.media, id: WIRE_ID } }, 201))
    await vi.waitFor(() => expect(adresse()).not.toContain('ajouter'))
    expect(ecritures()).toEqual([AJOUTER])
  })

  // Mutations, dans `VueAjouter.tsx` : `invalidateQueries` ôté d'`onSuccess` (la télécommande ne connaît pas
  // la série : l'écran montrerait Dark) ; dans `Panneau.tsx` : `remplacer` remplacé par `allerA` (le retour
  // du téléphone ramènerait à la recherche) ; `serie` ôté de la vue (l'écran montrerait la première, par chance la même : d'où Dark en tête ci-dessous).
  it.each([
    ['`201`, créée', 201, true],
    ['`200`, elle y était déjà', 200, false],
  ])('au succès (%s) : la télécommande est relue, puis réglée sur la série ajoutée, à la place de l’ajout', async (_cas, statut, created) => {
    let lectures = 0
    const apres: Telecommande = { ...DEUX, series: [DARK, { ...WIRE, dernier_visionnage_le: '2026-10-11T08:00:00.000Z' }, ...DEUX.series.slice(1)] }
    const { combien } = monter({ [LIRE]: () => json(++lectures === 1 ? DEUX : apres), [CHERCHER('the')]: () => page(RESULTATS), [AJOUTER]: () => json({ created, media: { ...AJOUT.media, id: WIRE_ID } }, statut) }, 'telecommande')
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }))
    await taper('the')

    fireEvent.click(within(await resultat('The Wire')).getByRole('button'))

    await vi.waitFor(() => expect(adresse()).toBe(`/feuilleton/maison?telecommande=serie-${WIRE_ID}`))
    expect(combien(LIRE)).toBe(2)
    expect(ecran()).toHaveTextContent('The Wire')
    expect(ecran()).toHaveTextContent('S1 E1')
    expect(ecran()).toHaveTextContent('Ajoutée il y a 3 jours')
    expect(touche('Vu : The Wire, S1 E1')).toBeEnabled()

    act(() => historique(-1))
    await vi.waitFor(() => expect(adresse()).toBe('/feuilleton/maison?telecommande=telecommande'))
  })

  // Mutations, dans `VueAjouter.tsx` : le `catch` ôté (la touche resterait sur « Ajout… », sans message) ;
  // `onAjoutee` appelé dans `finally` (un échec mènerait à la télécommande).
  it.each([
    ['`429`', () => refus(429, 'Trop de requêtes. Patiente un instant.', 'RATE_LIMITED'), 'Trop de requêtes. Patiente un instant.'],
    ['`503`', () => refus(503, 'La source est indisponible. Réessaie plus tard.', 'UPSTREAM_UNAVAILABLE'), 'La source est indisponible. Réessaie plus tard.'],
    ['une panne de réseau', () => Promise.reject(new TypeError('Failed to fetch')), /.+/],
  ] as [string, () => Response | Promise<Response>, string | RegExp][])('l’ajout tombe sur %s : le message de l’erreur sous le résultat, la touche revient, on reste sur la recherche', async (_cas, reponse, texte) => {
    const { combien } = monter({ [LIRE]: () => json(DEUX), [CHERCHER('the')]: () => page(RESULTATS), [AJOUTER]: reponse }, 'ajouter')
    await taper('the')
    const wire = await resultat('The Wire')

    fireEvent.click(within(wire).getByRole('button'))

    const alerte = await within(wire).findByRole('alert')
    expect(alerte).toHaveTextContent(texte)
    const revenue = within(wire).getByRole('button', { name: 'Ajouter The Wire (2002)' })
    expect(revenue).toBeEnabled()
    expect(revenue).toHaveTextContent('Ajouter')
    expect(adresse()).toBe('/feuilleton/maison?telecommande=ajouter')
    expect(combien(LIRE)).toBe(1)
  })
})
