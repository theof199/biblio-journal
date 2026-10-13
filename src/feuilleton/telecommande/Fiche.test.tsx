import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import type { EpisodeDeSaison, FicheDeSerie, ReponseDePortee, Telecommande } from '../../api/feuilleton'
import { exemple } from '../../test/contrat'
import { json } from '../../test/serveur'
import { adresse, DARK, DEUX, ecran, historique, LIRE, message, monter, refus, retenue, SOIR, touche } from '../../test/telecommande'

await import('../Feuilleton')
await import('../../maison/Maison')
await import('./Panneau')

const MODELE = exemple<FicheDeSerie>('/media/{id}', 'get', 200)
const UN = exemple<{ items: EpisodeDeSaison[] }>('/seasons/{id}/episodes', 'get', 200).items[0]!
const COCHE = exemple<unknown>('/episodes/{id}/watched', 'put', 200)
const PORTEE = exemple<ReponseDePortee>('/me/feuilleton/episodes', 'put', 200)

const saison = (number: number, checked: number, total: number) => ({ ...MODELE.seasons![0]!, id: `bbbbbbbb-0000-4000-8000-00000000000${number}`, number, title: `Chapitre ${number}`, episode_count: total, progress: { me: { checked, total } } })
const S0 = saison(0, 0, 1)
const S1 = saison(1, 10, 10)
/** La saison 2 de Dark : celle de son prochain épisode (`DARK.prochain.saison_id`). */
const S2 = saison(2, 3, 6)
const episode = (numero: number, title: string | null, air_date: string | null, vu: boolean, id = `aaaaaaaa-0000-4000-8000-0000000000e${numero}`): EpisodeDeSaison => ({ ...UN, id, number: numero, title, air_date, watched: { me: vu, others: 0 } })
/** Trois vus, le prochain (E4, celui de la carte), un sans date connue, un à venir (le 16, on est le 14). */
const E4 = episode(4, 'Perdus et trouvés', '2019-06-21', false, DARK.prochain!.id)
const PAGE_1 = [episode(1, 'Débuts et fins', '2019-06-21', true), episode(2, 'Matière noire', '2019-06-21', true), episode(3, 'Fantômes', '2019-06-21', true)]
const PAGE_2 = [E4, episode(5, null, null, false), episode(6, 'Fins et débuts', '2026-10-16', false)]
/** La fiche de Dark : les saisons servies dans l'ordre de leur numéro, la saison 0 en tête. */
const FICHE: FicheDeSerie = {
  ...MODELE,
  id: DARK.id,
  title: 'Dark',
  year: 2017,
  summary: 'Quatre familles, une grotte, et le temps qui se referme.',
  metadata: { ...MODELE.metadata, status: 'Ended' },
  seasons: [S0, S1, S2],
  next_up: { kind: 'episode', id: E4.id, season_id: S2.id, season_number: 2, number: 4, title: E4.title },
}

const LA_FICHE = `GET /api/media/${DARK.id}`
const EPISODES = (saisonId: string) => `GET /api/seasons/${saisonId}/episodes?limit=100`
const COCHER = (episodeId: string) => `PUT /api/episodes/${episodeId}/watched`
const LOT = 'PUT /api/me/feuilleton/episodes'
/** Les lectures de la fiche, la saison 2 servie en deux pages. */
const lectures = () => ({ [LIRE]: () => json(DEUX), [LA_FICHE]: () => json(FICHE), [EPISODES(S2.id)]: () => json({ items: PAGE_1, next_cursor: 'c1' }), [`${EPISODES(S2.id)}&cursor=c1`]: () => json({ items: PAGE_2, next_cursor: null }) })
const VUE = `fiche-${DARK.id}`
const repli = (nom: string | RegExp) => screen.findByRole('button', { name: nom, expanded: undefined })
const caseDe = (nom: string | RegExp) => screen.findByRole('checkbox', { name: nom })
/** « Fiche », une fois la série à l'écran (avant, la touche est éteinte). */
const versLaFiche = async () => {
  await screen.findByRole('heading', { level: 3, name: 'Dark' })
  fireEvent.click(touche('Fiche'))
}
const ligneDe = async (nom: string | RegExp) => (await screen.findByText(nom)).closest('li')!

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(SOIR)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('la fiche d’une série : ce qu’elle montre', () => {
  // Mutations, dans `VueFiche.tsx` : `combien` compté avec la saison 0 (« 3 saisons ») ; `DIFFUSIONS[…]`
  // remplacé par le statut brut (« Ended ») ; le synopsis ôté.
  it('l’en-tête : le titre, l’année, le nombre de saisons hors épisodes spéciaux, l’état de diffusion en clair, le synopsis', async () => {
    monter(lectures(), VUE)

    expect(await screen.findByRole('heading', { level: 2, name: 'Dark' })).toBeInTheDocument()
    expect(ecran()).toHaveTextContent('2017 · 2 saisons')
    expect(ecran()).toHaveTextContent('Terminée')
    expect(ecran()).not.toHaveTextContent('Ended')
    expect(screen.getByText('Quatre familles, une grotte, et le temps qui se referme.')).toBeInTheDocument()
  })

  // Mutations, dans `VueFiche.tsx` : le tri ôté de `rangerLesSaisons` ; la saison 0 laissée à sa place ;
  // `nomDeLaSaison` sans le cas de la saison 0 ; `dAbord` posé sur la première saison ; `progress.me.total` deux fois.
  it('les saisons : la dernière d’abord, « Épisodes spéciaux » en dernier, chacune sa progression ; seule la saison du prochain épisode est dépliée, et lue', async () => {
    const { requetes } = monter(lectures(), VUE)
    await caseDe(/^E1 /)

    const saisons = within(screen.getByRole('list', { name: 'Saisons' })).getAllByRole('button', { expanded: undefined }).filter((bouton) => bouton.hasAttribute('aria-expanded'))
    expect(saisons.map((bouton) => bouton.textContent)).toEqual(['Saison 23 sur 6', 'Saison 110 sur 10', 'Épisodes spéciaux0 sur 1'])
    expect(saisons.map((bouton) => bouton.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false'])
    expect(requetes.filter((requete) => requete.includes('/seasons/'))).toEqual([EPISODES(S2.id), `${EPISODES(S2.id)}&cursor=c1`])
  })

  // Mutations, dans `api/feuilleton.ts` : la boucle de `lireLesEpisodes` arrêtée à la première page ; le curseur non renvoyé.
  it('les épisodes d’une saison se lisent en entier, page après page, dans l’ordre servi', async () => {
    monter(lectures(), VUE)

    const liste = await screen.findByRole('list', { name: 'Épisodes : Saison 2' })
    expect(within(liste).getAllByRole('listitem').map((ligne) => ligne.textContent!.slice(0, 2))).toEqual(['E1', 'E2', 'E3', 'E4', 'E5', 'E6'])
  })

  // Mutations, dans `VueFiche.tsx` : `aVenir` toujours faux (une case sur E6) ; `>` remplacé par `>=` sur
  // la date du jour ; une date nulle tenue pour à venir (E5 sans case) ; « Le prochain » posé sur le premier non vu… de la liste entière (ici le même : d'où `next_up` vérifié sur son identifiant) ; un titre nul laissé vide.
  it('« Le prochain » est marqué ; un épisode pas encore diffusé n’a pas de case mais sa date ; un épisode sans date connue se coche', async () => {
    monter(lectures(), VUE)

    const prochain = await ligneDe('Perdus et trouvés')
    expect(prochain).toHaveTextContent('Le prochain')
    expect(prochain).toHaveAttribute('data-prochain')
    expect(screen.getAllByText('Le prochain')).toHaveLength(1)

    const aVenir = await ligneDe('Fins et débuts')
    expect(aVenir).toHaveTextContent('Pas encore diffusé')
    expect(aVenir).toHaveTextContent('le 16 octobre')
    expect(within(aVenir).queryByRole('checkbox')).toBeNull()

    const sansDate = await ligneDe('Épisode 5')
    expect(within(sansDate).getByRole('checkbox', { name: 'E5 · Épisode 5' })).toHaveAttribute('aria-checked', 'false')
    expect(sansDate).not.toHaveTextContent('Pas encore diffusé')
    expect(screen.getAllByRole('checkbox')).toHaveLength(5)
  })

  // Mutation, dans `VueFiche.tsx` : `air_date > aujourdHui` comparé au jour UTC… ne se voit pas ici ; celle-ci : le jour même tenu pour à venir.
  it('un épisode diffusé aujourd’hui a sa case', async () => {
    const duJour = episode(6, 'Fins et débuts', '2026-10-14', false)
    monter({ ...lectures(), [`${EPISODES(S2.id)}&cursor=c1`]: () => json({ items: [E4, duJour], next_cursor: null }) }, VUE)

    expect(await caseDe('E6 · Fins et débuts')).toBeInTheDocument()
  })

  // Mutations, dans `VueFiche.tsx` : `enabled: depliee` ôté de `useLesEpisodes` (toutes les saisons lues à
  // l'ouverture) ; la garde `saison.number === 0` ôtée (« Toute la saison » aux épisodes spéciaux).
  it('déplier une saison lit ses épisodes ; « Toute la saison » est absente des épisodes spéciaux, où l’on coche un par un', async () => {
    const special = episode(1, 'Le making-of', '2019-01-01', false, 'aaaaaaaa-0000-4000-8000-0000000000f1')
    const { requetes, corps, ecritures } = monter({ ...lectures(), [EPISODES(S0.id)]: () => json({ items: [special], next_cursor: null }), [COCHER(special.id)]: () => json(COCHE) }, VUE)
    await caseDe(/^E1 /)
    expect(requetes).not.toContain(EPISODES(S0.id))
    expect(screen.getByRole('button', { name: 'Toute la saison : Saison 2' })).toBeInTheDocument()

    fireEvent.click(await repli(/^Épisodes spéciaux/))

    const liste = await screen.findByRole('list', { name: 'Épisodes : Épisodes spéciaux' })
    expect(screen.getAllByRole('button', { name: /^Toute la saison/ })).toHaveLength(1)
    fireEvent.click(within(liste).getByRole('checkbox', { name: 'E1 · Le making-of' }))
    await vi.waitFor(() => expect(ecritures()).toEqual([COCHER(special.id)]))
    expect(corps).toEqual([{ watched: true }])
  })

  // Mutation, dans `VueFiche.tsx` : la branche `fiche.isError` ôtée.
  it('la fiche ne se lit pas : le message de l’API et « Réessayer », dans le boîtier', async () => {
    let essais = 0
    monter({ [LIRE]: () => json(DEUX), [LA_FICHE]: () => (++essais === 1 ? refus(404, 'Cette œuvre est introuvable.') : json({ ...FICHE, next_up: null })) }, VUE)

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent('Cette œuvre est introuvable.')
    fireEvent.click(within(alerte).getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Dark' })).toBeInTheDocument()
  })
})

describe('la fiche d’une série : cocher et décocher', () => {
  // Mutations, dans `fiche.ts` : `poser(geste, geste.vu)` ôté d'`onMutate` (rien avant la réponse) ;
  // `vu: !episode.watched.me` remplacé par `true` (décocher enverrait `watched: true`) ; `compter` sans effet.
  it.each([
    ['cocher', /^E4 /, E4.id, true, '4 sur 6'],
    ['décocher', /^E2 /, PAGE_1[1]!.id, false, '2 sur 6'],
  ] as [string, RegExp, string, boolean, string][])('%s un épisode : la requête exacte, la case et la progression changent avant la réponse', async (_geste, nom, id, vu, progression) => {
    const reponse = retenue()
    const { corps, ecritures } = monter({ ...lectures(), [COCHER(id)]: () => reponse.promesse }, VUE)
    const laCase = await caseDe(nom)
    expect(laCase).toHaveAttribute('aria-checked', String(!vu))

    fireEvent.click(laCase)

    await vi.waitFor(() => expect(laCase).toHaveAttribute('aria-checked', String(vu)))
    expect(await repli(/^Saison 2/)).toHaveTextContent(progression)
    await vi.waitFor(() => expect(ecritures()).toEqual([COCHER(id)]))
    expect(corps).toEqual([{ watched: vu }])
    reponse.rendre(json(COCHE))
  })

  // Mutations, dans `fiche.ts` : `poser(geste, !geste.vu)` ôté d'`onError` (la case resterait cochée) ;
  // `setEchecs` ôté d'`onError` (aucun message).
  it('la coche échoue : la case et la progression reviennent en arrière, le message de l’API se dit sur la ligne', async () => {
    const reponse = retenue()
    // Les relectures qui suivent l'échec ne répondent pas : ce qu'on voit revenir est le retour arrière, pas elles.
    let fiches = 0
    let pages = 0
    const { combien } = monter(
      {
        ...lectures(),
        [LA_FICHE]: () => (++fiches === 1 ? json(FICHE) : retenue().promesse),
        [EPISODES(S2.id)]: () => (++pages === 1 ? json({ items: PAGE_1, next_cursor: 'c1' }) : retenue().promesse),
        [COCHER(E4.id)]: () => reponse.promesse,
      },
      VUE,
    )
    const laCase = await caseDe(/^E4 /)
    fireEvent.click(laCase)
    await vi.waitFor(() => expect(laCase).toHaveAttribute('aria-checked', 'true'))

    reponse.rendre(refus(500, 'Le service est indisponible. Réessaie plus tard.'))
    await vi.waitFor(() => expect(combien(LA_FICHE)).toBe(2))

    const ligne = await ligneDe('Perdus et trouvés')
    expect(await within(ligne).findByRole('alert')).toHaveTextContent('Le service est indisponible. Réessaie plus tard.')
    expect(await caseDe(/^E4 /)).toHaveAttribute('aria-checked', 'false')
    expect(await repli(/^Saison 2/)).toHaveTextContent('3 sur 6')
  })

  // Mutations, dans `fiche.ts` : le verrou ôté de `cocher` (deux écritures pour E4) ; le verrou rendu commun
  // à la fiche (E5 ne partirait pas).
  it('le verrou est par épisode : un second toucher du même ne part pas, un autre épisode se coche', async () => {
    const reponse = retenue()
    const e5 = PAGE_2[1]!
    const { ecritures } = monter({ ...lectures(), [COCHER(E4.id)]: () => reponse.promesse, [COCHER(e5.id)]: () => json(COCHE) }, VUE)
    const laCase = await caseDe(/^E4 /)

    fireEvent.click(laCase)
    fireEvent.click(laCase)
    fireEvent.click(await caseDe(/^E5 /))
    await vi.waitFor(() => expect(ecritures()).toEqual([COCHER(E4.id)]))
    reponse.rendre(json(COCHE))

    await vi.waitFor(() => expect(ecritures()).toEqual([COCHER(E4.id), COCHER(e5.id)]))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(ecritures()).toEqual([COCHER(E4.id), COCHER(e5.id)])
  })
})

describe('la fiche et la télécommande se tiennent à jour', () => {
  // Mutations, dans `fiche.ts` : la télécommande ôtée de `relire` ; la fiche ôtée de `relire` (la progression
  // et « Le prochain » resteraient ceux d'avant).
  it('une coche de la fiche relit la télécommande, et la fiche avec ses épisodes', async () => {
    let fiches = 0
    const apres: FicheDeSerie = { ...FICHE, seasons: [S0, S1, { ...S2, progress: { me: { checked: 4, total: 6 } } }], next_up: { ...FICHE.next_up!, id: PAGE_2[1]!.id, number: 5, title: null } as FicheDeSerie['next_up'] }
    const { combien } = monter({ ...lectures(), [LA_FICHE]: () => json(++fiches === 1 ? FICHE : apres), [COCHER(E4.id)]: () => json(COCHE) }, VUE)

    fireEvent.click(await caseDe(/^E4 /))

    await vi.waitFor(() => expect(combien(LIRE)).toBe(2))
    await vi.waitFor(() => expect(combien(LA_FICHE)).toBe(2))
    await vi.waitFor(() => expect(combien(EPISODES(S2.id))).toBe(2))
    expect(await ligneDe('Épisode 5')).toHaveTextContent('Le prochain')
  })

  // Mutations, dans `fiche.ts` : `setQueryData` ôté d'`onSuccess` du lot (la télécommande montrerait encore
  // S2 E5) ; `season_id` remplacé par l'identifiant de la série ; l'avis ôté.
  it('« Toute la saison » : la portée exacte, « 2 épisodes notés » à la place de la touche, et la carte rendue entre à la télécommande sans relecture', async () => {
    const { corps, ecritures, combien } = monter({ ...lectures(), [LOT]: () => json(PORTEE) }, 'telecommande')
    await versLaFiche()

    fireEvent.click(await screen.findByRole('button', { name: 'Toute la saison : Saison 2' }))

    await vi.waitFor(() => expect(message()).toHaveTextContent('2 épisodes notés'))
    expect(screen.queryByRole('button', { name: /^Toute la saison/ })).toBeNull()
    expect(ecritures()).toEqual([LOT])
    expect(corps).toEqual([{ portee: 'saison', season_id: S2.id }])
    await vi.waitFor(() => expect(combien(LA_FICHE)).toBe(2))

    fireEvent.click(touche('Retour : Télécommande'))

    await vi.waitFor(() => expect(ecran()).toHaveTextContent(`S${PORTEE.serie.prochain!.saison} E${PORTEE.serie.prochain!.numero}`))
    expect(combien(LIRE)).toBe(1)
  })

  // Mutation, dans `vivante.ts` : `perimerLaFiche` ôté d'`onSettled` de la coche (la fiche, lue il y a moins
  // de trente secondes, resterait celle d'avant le « Vu »).
  it('un « Vu » de la télécommande périme la fiche déjà ouverte : rouverte, elle se relit, et l’épisode y est coché', async () => {
    let fiches = 0
    let pages = 0
    const cochee = { ...E4, watched: { me: true, others: 0 } }
    const apres: Telecommande = { ...DEUX, series: [{ ...DARK, prochain: DARK.ensuite, ensuite: null, dernier_visionnage_le: SOIR.toISOString() }, ...DEUX.series.slice(1)] }
    let lues = 0
    const { combien } = monter(
      {
        ...lectures(),
        [LIRE]: () => json(++lues === 1 ? DEUX : apres),
        [LA_FICHE]: () => json(++fiches === 1 ? FICHE : { ...FICHE, next_up: null }),
        [`${EPISODES(S2.id)}&cursor=c1`]: () => json({ items: ++pages === 1 ? PAGE_2 : [cochee, ...PAGE_2.slice(1)], next_cursor: null }),
        [COCHER(E4.id)]: () => json(COCHE),
      },
      'telecommande',
    )
    await versLaFiche()
    expect(await caseDe(/^E4 /)).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(touche('Retour : Télécommande'))

    fireEvent.click(await screen.findByRole('button', { name: 'Vu : Dark, S2 E5' }))
    await vi.waitFor(() => expect(combien(LIRE)).toBe(2))
    expect(combien(LA_FICHE)).toBe(1)
    await versLaFiche()

    await vi.waitFor(() => expect(combien(LA_FICHE)).toBe(2))
    await vi.waitFor(async () => expect(await caseDe(/^E4 /)).toHaveAttribute('aria-checked', 'true'))
  })
})

describe('la fiche : le retour', () => {
  // Mutations, dans `Panneau.tsx` : `precedente ?? PARENTES[…]` réduit à `PARENTES[…]` (« Retour : En cours ») ;
  // dans `adresse.ts` : `revenir` qui pousse au lieu de reculer (il n'y aurait rien devant).
  it('ouverte depuis la télécommande, « ‹ » y ramène en reculant dans l’historique : rien n’est empilé, avancer retrouve la fiche', async () => {
    monter(lectures(), 'telecommande')
    await versLaFiche()
    await vi.waitFor(() => expect(adresse()).toBe(`/feuilleton/maison?telecommande=${VUE}`))
    await screen.findByRole('heading', { level: 2, name: 'Dark' })

    fireEvent.click(touche('Retour : Télécommande'))

    await vi.waitFor(() => expect(adresse()).toBe('/feuilleton/maison?telecommande=telecommande'))
    act(() => historique(1))
    await vi.waitFor(() => expect(adresse()).toBe(`/feuilleton/maison?telecommande=${VUE}`))
  })

  // Mutation, dans `Coquille.tsx` : `PARENTES.fiche` menée à la télécommande.
  it('ouverte depuis la liste (la télécommande réglée par « ⋯ », puis « Fiche »), « ‹ » ramène à la télécommande réglée, d’où « ‹ » ramène à la liste', async () => {
    monter(lectures(), 'en-cours')
    fireEvent.click(await screen.findByRole('button', { name: 'Régler la télécommande sur Dark' }))
    await versLaFiche()
    await screen.findByRole('heading', { level: 2, name: 'Dark' })

    fireEvent.click(touche('Retour : Télécommande'))
    await vi.waitFor(() => expect(adresse()).toBe(`/feuilleton/maison?telecommande=serie-${DARK.id}`))
    fireEvent.click(touche('Retour : En cours'))
    await vi.waitFor(() => expect(adresse()).toBe('/feuilleton/maison?telecommande=en-cours'))
  })
})
