import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Abonnement } from '../../../api/abonnements'
import type { CartePostaleEnvoyee, CartePostaleRecue, Courrier, Malle, RubriqueVue, Voyageur } from '../../../api/voyage'
import { exemple } from '../../../test/contrat'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { voyage1890 } from '../../../test/voyage'
import { imageDu1900 } from '../images'
import { MOTS_DU_COURRIER as M, adresseDe, carteAEcrireDe, ceQueDitLaCarte, ceQueDitLaPostee, compteDuMot, enteteDeLEnvoyee, enteteDeLaRecue, rectoDe, tamponADate } from './courrier'

/**
 * Le courrier dans la sacoche des années 1900 (plan des écrans des lots, briefs 13 et 14 ; maquette,
 * écrans 15 et 19) : ce que le dessin dit de ma boîte, la carte ouverte, et la carte à écrire
 * (`pages/VoyageSacoche.ecrire.test.tsx` tient son envoi, son verrou et ce que le cache apprend). La page est montée dans l'app
 * entière, le monde n'y arrive que par le registre. `pages/VoyageSacoche.courrier.test.tsx` tient le
 * bloc lecteur (ce qu'il lit, ce qu'il marque, quand) ; ce fichier tient les mots et ce qui se rend.
 * Aucun test sur le tracé du timbre ni du tampon.
 */
const SACOCHE = '/voyage/sacoche'
const BOITE = 'GET /api/me/voyage/cartes-postales'
const LUE = (id: string) => `POST /api/me/voyage/cartes-postales/${id}/lue`
const VUE = (rubrique: string) => `POST /api/me/voyage/rubriques/${rubrique}/vue`

const EN_1903 = voyage1890(
  1903,
  [
    ...[1895, 1896, 1897, 1898, 1899, 1900, 1901, 1902].map((a) => ({ annee: a, statut: 'ouverte' as const, visitee: true, recompense: 'ours' as const })),
    { annee: 1903, statut: 'en_cours', visitee: true, recompense: null },
  ],
  { ia: true, source: null },
)
/** L'exemple du contrat : alice reçoit de bob (parti de sa gare de 1900, adressé à la gare de 1902, déjà lue) et lui a écrit de 1901. */
const EXEMPLE = exemple<Courrier>('/me/voyage/cartes-postales', 'get', 200)
const DEJA_LUE: CartePostaleRecue = EXEMPLE.recues[0]!
const ENVOYEE: CartePostaleEnvoyee = EXEMPLE.envoyees[0]!
const recue = (id: string, surcharge: Partial<CartePostaleRecue>): CartePostaleRecue => ({ ...DEJA_LUE, id: `${id}-2b6e-4f93-a0d8-9e3b1c6f7a54`, lue_le: null, ...surcharge })
/** Partie de la gare de 1903 de bob, adressée à ma gare de 1901 (où j'étais alors : je suis en 1903), postée un soir d'été à Paris, le lendemain en UTC. */
const NEUVE = recue('5d1c7a40', { annee: 1903, gare_destinataire: 1901, mot: 'Bien arrivé à Longueville.', postee_le: '2026-07-31T22:30:00.000Z' })
/** Partie d'une gare de la foire : aucune photographie. */
const DE_LA_FOIRE = recue('6e2d8b51', { annee: 1898, gare_destinataire: 1899, mot: 'La foire ferme, je prends le train.', postee_le: '2026-07-30T10:00:00.000Z' })
const LA_BOITE: Courrier = { recues: [NEUVE, DE_LA_FOIRE, DEJA_LUE], envoyees: [ENVOYEE], en_attente: [1900] }

/** Écrire une carte (brief 14) : mes abonnements sur deux pages (camille n'est que sur la seconde), et la carte que le serveur rend. */
const POSTER = 'POST /api/me/voyage/cartes-postales'
const ABONNEMENTS = 'GET /api/users/me/following?limit=100'
const SUITE = 'GET /api/users/me/following?limit=100&cursor=suite'
type Page = { items: { user: Abonnement }[]; next_cursor: string | null }
const [LIGNE_DE_BOB, LIGNE_DE_CAMILLE] = exemple<Page>('/users/{id}/following', 'get', 200).items as [Page['items'][number], Page['items'][number]]
const CAMILLE = LIGNE_DE_CAMILLE.user
const MOT = 'Bien arrivé à Paris.'
/** Postée de ma gare de 1900 à camille, que le serveur a trouvée en gare de 1904 : ni la date ni la gare ne viennent de l'appli. */
const POSTEE: CartePostaleEnvoyee = { ...ENVOYEE, id: '7f3e9c62-2b6e-4f93-a0d8-9e3b1c6f7a54', annee: 1900, destinataire: CAMILLE, gare_destinataire: 1904, mot: MOT, postee_le: '2026-10-09T08:00:00.000Z' }
const DEUX_GARES: Courrier = { ...LA_BOITE, en_attente: [1900, 1902] }

const marque = (rubrique: string) => () => json({ rubrique, vue_le: '2026-10-08T10:00:00.000Z' } satisfies RubriqueVue)
const ROUTES = {
  'GET /api/me/voyage': () => json(EN_1903),
  'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
  'GET /api/me/voyage/decennies/1900/etiquettes': () => json(exemple<Malle>('/me/voyage/decennies/{decennie}/etiquettes', 'get', 200)),
  'GET /api/me/voyage/voyageur': () => json(exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)),
  [VUE('etiquette')]: marque('etiquette'),
  [VUE('objet')]: marque('objet'),
  [VUE('courrier')]: marque('courrier'),
  [BOITE]: () => json(LA_BOITE),
  [ABONNEMENTS]: () => json({ items: [LIGNE_DE_BOB], next_cursor: 'suite' }),
  [SUITE]: () => json({ items: [LIGNE_DE_CAMILLE], next_cursor: null }),
}
// `retryable: false` : une panne relancée par TanStack attendrait trois secondes avant de se dire.
const panne = (message: string) => () => json({ code: 'VALIDATION_ERROR', message, retryable: false }, 400)

const region = () => screen.findByRole('region', { name: 'Courrier' })
const plis = (liste: HTMLElement) => within(liste).getAllByRole('button').map((b) => b.textContent)
/** La sacoche de 1903 montée, sa boîte servie et rendue : la rubrique est là, avec ce qu'elle a à dire. */
async function monter(boite: Courrier = LA_BOITE, routes: Record<string, (init: RequestInit) => Response | Promise<Response>> = {}, entree: string | string[] = SACOCHE) {
  const banc = monterVoyage(entree, { ...ROUTES, [BOITE]: () => json(boite), ...routes })
  const courrier = await region()
  await within(courrier).findByRole('heading', { level: 2, name: `${M.titre} ${M.sous}` })
  return { ...banc, courrier }
}
/** Ouvre une carte de la rubrique par un mot de son pli, et rend son dialogue. */
async function ouvrir(courrier: HTMLElement, pli: RegExp) {
  fireEvent.click(within(courrier).getByRole('button', { name: pli }))
  return screen.findByRole('dialog', { name: M.ouverte.titre })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('les règles du courrier 1900', () => {
  // Mutations : `gare_destinataire` ignorée (`carte.annee` dans `adresseDe` ou `enteteDeLEnvoyee` :
  // l'adresse dirait la gare d'où la carte part) ; l'en-tête d'une reçue adressé au destinataire ; le
  // lieu d'une gare que 1900 ne connaît pas inventé (`LIEU[…] ?? 'gare'`).
  it('l’adresse est celle que le serveur a figée : le pseudo, `gare_destinataire`, et son lieu si 1900 le connaît', () => {
    expect([NEUVE.annee, NEUVE.gare_destinataire]).toEqual([1903, 1901])
    expect(adresseDe(NEUVE)).toEqual(['alice', 'gare de 1901', 'Creil'])
    expect(adresseDe({ ...NEUVE, gare_destinataire: 1899 })).toEqual(['alice', 'gare de 1899'])
    expect(adresseDe({ ...NEUVE, gare_destinataire: 1912 })).toEqual(['alice', 'gare de 1912'])
    expect(enteteDeLaRecue(NEUVE)).toBe('De bob · gare de 1903')
    expect(enteteDeLEnvoyee({ ...ENVOYEE, annee: 1901, gare_destinataire: 1902 })).toBe('À bob · gare de 1902')
  })

  // Décision 8 : sans photographie, le verso seul. Mutations : l'image posée sans regarder si elle
  // existe (`image: imageDu1900(…) ?? ''`, une image cassée pour 1898) ; la photographie de mon année
  // en cours à la place de celle de la gare de la carte.
  it('le recto est la photographie de la gare d’où la carte part, et n’existe ni pour une gare de la foire ni après 1909', () => {
    expect(imageDu1900('g1903')).toBeTruthy()
    expect(rectoDe(1903)).toEqual({ image: imageDu1900('g1903'), legende: 'Longueville. — La gare', libelle: 'Longueville, la gare vers 1900, au recto de la carte' })
    expect(rectoDe(1900)!.image).toBe(imageDu1900('g1900'))
    expect([1898, 1899, 1910, 1912].map(rectoDe)).toEqual([null, null, null, null])
  })

  // Règle commune 7 : un jour se dit à Paris. Posté le 31 juillet à 22 h 30 UTC, c'est le 1er août à
  // Paris. Mutations : le jour pris dans le fuseau de l'appareil ; la gare du destinataire sur le tampon.
  it('le tampon à date porte la gare d’où la carte part et le jour de l’envoi à Paris, où que soit l’appareil', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    expect(tamponADate(NEUVE)).toEqual({ gare: 'GARE DE 1903', jour: '1 AOÛT', annee: '2026', libelle: 'Tampon à date : gare de 1903, 1er août 2026' })
    expect(ceQueDitLaCarte({ sens: 'recue', carte: NEUVE })).toBe('bob te l’a postée de la gare de 1903, le 1er août 2026.')
    expect(ceQueDitLaCarte({ sens: 'envoyee', carte: ENVOYEE })).toBe('Postée de ta gare de 1901, le 5 octobre 2026.')
  })
})

describe('le courrier dans la sacoche de 1900', () => {
  // Mutations, dans `CourrierDeLaSacoche.tsx` : « Nouvelle » sur toute carte reçue (`nouvelle` vrai) ;
  // « Nouvelle » sur une carte envoyée ; les reçues triées par gare ; l'en-tête d'une envoyée écrit
  // comme celui d'une reçue.
  it('montre les cartes reçues dans l’ordre servi, « Nouvelle » tant qu’elles ne sont pas lues, puis les envoyées, sans rien dire de leur lecture', async () => {
    const { courrier } = await monter()
    const [recues, envoyees] = within(courrier).getAllByRole('list')
    expect([recues!.getAttribute('aria-label'), envoyees!.getAttribute('aria-label')]).toEqual([M.recues, M.envoyees])
    expect(plis(recues!)).toEqual([
      `De bob · gare de 1903${NEUVE.mot}${M.nouvelle}`,
      `De bob · gare de 1898${DE_LA_FOIRE.mot}${M.nouvelle}`,
      `De bob · gare de 1900${DEJA_LUE.mot}`,
    ])
    expect(plis(envoyees!)).toEqual([`À bob · gare de 1902${ENVOYEE.mot}`])
    expect(envoyees).not.toHaveTextContent(/nouvelle|lue/i)
    // Les vignettes : la photographie de la gare d'où part la carte, et aucune image pour la foire.
    expect([...recues!.querySelectorAll('button')].map((b) => b.querySelector('img')?.getAttribute('src') ?? null)).toEqual([imageDu1900('g1903'), null, imageDu1900('g1900')])
    expect(within(courrier).queryByRole('dialog')).toBeNull()
  })

  // Mutations : la phrase du vide retirée ; une liste vide rendue quand même (deux titres sans carte) ;
  // « Reçues » montré au-dessus de rien quand je n'ai fait qu'envoyer.
  it.each([
    ['vide, elle le dit, sans liste', { recues: [], envoyees: [], en_attente: [1900] }, M.vide, []],
    ['sans carte reçue, elle ne montre que les envoyées', { recues: [], envoyees: [ENVOYEE], en_attente: [] }, null, [M.envoyees]],
    ['sans carte envoyée, elle ne montre que les reçues', { recues: [DEJA_LUE], envoyees: [], en_attente: [] }, null, [M.recues]],
  ] as const)('une boîte %s', async (_, boite, phrase, listes) => {
    const { courrier } = await monter(boite as unknown as Courrier)
    // **La règle a changé au brief 14** : une gare qui attend sa carte a son entrée, sous « À écrire »,
    // même dans une boîte sans carte ; sans gare en attente, rien ne l'annonce.
    const aEcrire = boite.en_attente.length > 0 ? [M.aEcrire] : []
    expect(within(courrier).queryAllByRole('list').map((l) => l.getAttribute('aria-label'))).toEqual([...listes, ...aEcrire])
    expect(within(courrier).queryByText(M.vide) !== null).toBe(phrase !== null)
    expect([M.recues, M.envoyees, M.aEcrire].filter((t) => within(courrier).queryByText(t) !== null)).toEqual([...listes, ...aEcrire])
    expect(within(courrier).queryAllByRole('button')).toHaveLength(boite.recues.length + boite.envoyees.length + boite.en_attente.length)
  })

  // Règle commune 3. Mutation : la branche de la panne retirée du dessin (la rubrique seule, muette).
  it('en panne, la rubrique le dit avec le message du serveur et « Réessayer », et les objets trouvés restent', async () => {
    let enPanne = true
    const { courrier } = await monter(LA_BOITE, { [BOITE]: () => (enPanne ? panne('Le courrier est en panne.')() : json(LA_BOITE)) })
    expect(await within(courrier).findByRole('alert')).toHaveTextContent('Le courrier est en panne.')
    expect(within(await screen.findByRole('region', { name: 'Objets trouvés' })).queryByRole('alert')).toBeNull()
    enPanne = false
    fireEvent.click(within(courrier).getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(within(courrier).queryAllByRole('list').map((l) => l.getAttribute('aria-label'))).toEqual([M.recues, M.envoyees, M.aEcrire]))
  })

  // Décisions 2 et 8, et « l'adresse servie, jamais recalculée » : je suis en 1903, la carte m'a été
  // adressée à la gare de 1901. Mutations : `adresseDe` retiré du verso ; l'adresse tirée de mon année
  // en cours ; le recto monté pour toute carte ; le tampon sans nom lu ; `useDialogue` retiré (ni
  // focus, ni Échap) ; le mot signé du destinataire.
  it('une carte reçue s’ouvre : le recto de sa gare, le mot signé, le tampon à date, l’adresse telle que servie ; Échap la referme et rend le focus à son pli', async () => {
    const { courrier } = await monter(LA_BOITE, { [LUE(NEUVE.id)]: () => json({ ...NEUVE, lue_le: '2026-10-08T10:00:05.000Z' }) })
    const pli = within(courrier).getByRole('button', { name: /Longueville/ })
    pli.focus()
    const carte = await ouvrir(courrier, /Longueville/)
    expect(carte).toHaveAttribute('aria-modal', 'true')
    expect(within(carte).getByRole('button', { name: M.ouverte.refermer })).toHaveFocus()
    expect(within(carte).getByRole('img', { name: 'Longueville, la gare vers 1900, au recto de la carte' })).toHaveAttribute('src', imageDu1900('g1903'))
    expect(within(carte).getByText('Longueville. — La gare')).toBeInTheDocument()
    expect(within(carte).getByText(NEUVE.mot)).toBeInTheDocument()
    expect(within(carte).getByText(NEUVE.mot).nextElementSibling).toHaveTextContent(/^bob$/)
    expect(within(carte).getByRole('img', { name: 'Tampon à date : gare de 1903, 1er août 2026' })).toBeInTheDocument()
    expect(within(carte).getByRole('img', { name: M.ouverte.timbre })).toBeInTheDocument()
    const adresse = within(carte).getByText(M.ouverte.adresse).parentElement!
    expect([...adresse.querySelectorAll('p span')].map((s) => s.textContent)).toEqual(['alice', 'gare de 1901', 'Creil'])
    expect(carte).not.toHaveTextContent(/gare de 1902|1904/)
    expect(within(carte).getByText('bob te l’a postée de la gare de 1903, le 1er août 2026.')).toBeInTheDocument()
    // « Nouvelle » est tombée dans la rubrique dès la réponse du serveur, la carte encore ouverte.
    await waitFor(() => expect(pli).not.toHaveTextContent(M.nouvelle))
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(pli).toHaveFocus()
    expect(within(courrier).getByRole('button', { name: /foire/ })).toHaveTextContent(M.nouvelle)
  })

  // Constat 16 du plan : une carte peut venir d'une gare de 1890. Mutations : le recto monté sans
  // regarder `rectoDe` (un cadre vide) ; `<img>` posée avec une adresse nulle.
  it('une carte partie d’une gare de la foire n’a que son verso : aucune image, cassée ou non', async () => {
    const { courrier } = await monter(LA_BOITE, { [LUE(DE_LA_FOIRE.id)]: () => json({ ...DE_LA_FOIRE, lue_le: '2026-10-08T10:00:05.000Z' }) })
    const carte = await ouvrir(courrier, /foire/)
    expect(carte.querySelectorAll('img, figure')).toHaveLength(0)
    expect(within(carte).getByText(DE_LA_FOIRE.mot)).toBeInTheDocument()
    expect(within(carte).getByRole('img', { name: 'Tampon à date : gare de 1898, 30 juillet 2026' })).toBeInTheDocument()
    expect([...within(carte).getByText(M.ouverte.adresse).parentElement!.querySelectorAll('p span')].map((s) => s.textContent)).toEqual(['alice', 'gare de 1899'])
  })

  // « Lue » ne se dit jamais d'une carte envoyée : le serveur ne sert `lue_le` qu'au destinataire.
  // Mutations : une mention de lecture ajoutée sous toute carte ouverte ; la phrase d'une reçue dite
  // d'une envoyée (« bob te l'a postée »).
  it('une carte envoyée s’ouvre sur son adresse et ne dit rien de sa lecture', async () => {
    const { courrier, requetes } = await monter()
    const carte = await ouvrir(courrier, /Chaperon/)
    expect([...within(carte).getByText(M.ouverte.adresse).parentElement!.querySelectorAll('p span')].map((s) => s.textContent)).toEqual(['bob', 'gare de 1902', 'Couville'])
    expect(within(carte).getByText(ENVOYEE.mot).nextElementSibling).toHaveTextContent(/^alice$/)
    expect(within(carte).getByText('Postée de ta gare de 1901, le 5 octobre 2026.')).toBeInTheDocument()
    expect(carte).not.toHaveTextContent(/\blue\b|nouvelle|te l’a postée/i)
    expect(requetes.filter((r) => r.includes('/lue'))).toEqual([])
  })

  // **Le mot est un texte d'un autre membre** : rendu en texte, en entier, tel que servi. Le serveur
  // refuse un saut de ligne et borne à 140 signes ; l'écran ne s'y fie pas. Mutations : le mot injecté
  // en HTML (`dangerouslySetInnerHTML` sur le pli ou sur le verso) ; le mot rogné dans la carte
  // ouverte (`slice(0, 80)`) ; ses retours à la ligne ou ses espaces de bord retirés (`trim`, `replace`).
  it.each([
    ['des balises', '<img src="x" onerror="alert(1)"><b>gras</b> &amp; <script>alert(2)</script>'],
    ['cent quarante signes sans une espace', 'm'.repeat(140)],
    ['des émojis et des retours à la ligne', ' Bons baisers 🚂🎬\nde Longueville\n\n— L. '],
  ])('un mot qui porte %s se rend en texte, en entier, dans la rubrique comme sur la carte', async (_, mot) => {
    const carteServie = { ...DE_LA_FOIRE, mot }
    const { courrier } = await monter({ recues: [carteServie], envoyees: [], en_attente: [] }, { [LUE(DE_LA_FOIRE.id)]: () => json({ ...carteServie, lue_le: '2026-10-08T10:00:05.000Z' }) })
    const pli = within(courrier).getByRole('button')
    expect(pli.querySelector('q')!.textContent).toBe(mot)
    expect(pli.querySelectorAll('q *')).toHaveLength(0)
    fireEvent.click(pli)
    const carte = await screen.findByRole('dialog', { name: M.ouverte.titre })
    const ecrit = carte.querySelector('p + p')!.previousElementSibling!
    expect(ecrit.textContent).toBe(mot)
    expect(ecrit.children).toHaveLength(0)
    expect(document.querySelectorAll('script, b[onerror], img[onerror], img[src="x"]')).toHaveLength(0)
  })

  // **Le mot d'une carte est privé** : il n'est écrit que comme texte de son pli et de sa carte. Ni
  // attribut (un nom lu, un titre, une clé), ni titre de page, ni adresse. Mutations : `aria-label`
  // du pli ou du dialogue composé avec le mot ; `title={carte.mot}` ; le mot posé dans l'adresse à
  // l'ouverture (`ouvrir(carte.mot)` : la carte ne s'ouvrirait pas non plus).
  it('le mot n’est dans aucun attribut, ni dans le titre de la page, ni dans l’adresse : la carte s’ouvre par son identifiant', async () => {
    const { courrier } = await monter(LA_BOITE, { [LUE(NEUVE.id)]: () => json({ ...NEUVE, lue_le: '2026-10-08T10:00:05.000Z' }) })
    const carte = await ouvrir(courrier, /Longueville/)
    const mots = LA_BOITE.recues.map((c) => c.mot).concat(ENVOYEE.mot)
    const attributs = [...document.querySelectorAll('*')].flatMap((e) => [...e.attributes].map((a) => a.value))
    expect(attributs.filter((v) => mots.some((m) => v.includes(m)))).toEqual([])
    expect(mots.filter((m) => document.title.includes(m))).toEqual([])
    expect(carte).toHaveAccessibleName(M.ouverte.titre)
  })

  // Un rechargement rouvre la carte : l'adresse porte son identifiant. Mutation : la carte ouverte
  // tenue par le dessin (un `useState`) et non par le calque du bloc.
  it('l’adresse qui porte l’identifiant d’une carte l’ouvre à l’arrivée', async () => {
    await monter(LA_BOITE, {}, `${SACOCHE}?carte=${ENVOYEE.id}`)
    const carte = await screen.findByRole('dialog', { name: M.ouverte.titre })
    expect(within(carte).getByText(ENVOYEE.mot)).toBeInTheDocument()
  })
})

describe('écrire une carte postale en 1900', () => {
  const adresse = (carte: HTMLElement) => [...within(carte).getByText(M.ouverte.adresse).parentElement!.querySelectorAll('p span')].map((s) => s.textContent)
  const entrees = (courrier: HTMLElement) => within(within(courrier).getByRole('list', { name: M.aEcrire })).getAllByRole('button').map((b) => b.textContent)
  /** La sacoche montée, la carte à écrire de la gare de 1900 ouverte, mes abonnements lus ; `corps` garde ce que chaque envoi a porté. */
  async function ecrire(routes: Record<string, (init: RequestInit) => Response | Promise<Response>> = {}) {
    const corps: unknown[] = []
    const poster = routes[POSTER] ?? (() => json(POSTEE, 201))
    const banc = await monter(DEUX_GARES, {
      ...routes,
      [POSTER]: (init) => {
        corps.push(JSON.parse(String(init.body)))
        return poster(init)
      },
    })
    fireEvent.click(within(banc.courrier).getByRole('button', { name: carteAEcrireDe(1900) }))
    const carte = await screen.findByRole('dialog', { name: M.ecrire.titre })
    return { ...banc, corps, carte }
  }
  const remplir = async (carte: HTMLElement, mot = MOT) => {
    const champ = await within(carte).findByRole('textbox', { name: M.ecrire.mot })
    fireEvent.change(champ, { target: { value: mot } })
    fireEvent.click(within(carte).getByRole('radio', { name: 'camille' }))
    return champ as HTMLInputElement
  }
  const poster = (carte: HTMLElement) => within(carte).getByRole('button', { name: M.ecrire.poster })

  // Je suis en 1903 : huit gares sont bouclées chez moi, deux attendent leur carte. Mutations, dans
  // `CourrierDeLaSacoche.tsx` : une entrée par gare d'une carte envoyée ou reçue en plus ; la liste
  // « À écrire » montrée vide ; l'entrée qui n'ouvre rien (`ecrire` jamais appelé).
  it('une entrée par gare de `en_attente`, et pour elles seules, sous « À écrire »', async () => {
    const { courrier, requetes } = await monter(DEUX_GARES)
    expect(entrees(courrier)).toEqual(['Écrire la carte de la gare de 1900', 'Écrire la carte de la gare de 1902'])
    expect(requetes.filter((r) => r.includes('/following'))).toEqual([])
  })
  it('sans gare en attente, rien ne propose d’écrire', async () => {
    const { courrier } = await monter({ ...LA_BOITE, en_attente: [] })
    expect(within(courrier).queryByRole('list', { name: M.aEcrire })).toBeNull()
    expect(within(courrier).queryByText(M.aEcrire)).toBeNull()
    expect(within(courrier).queryByRole('button', { name: /Écrire/ })).toBeNull()
  })

  // Constat 14 du plan : la maquette a un `textarea`, le serveur refuse un saut de ligne ; son
  // adresse dit « gare de 1902 » avant l'envoi, que le serveur ne sert qu'après. Mutations : le champ
  // en `textarea` ; `maxLength` retiré ; le compte figé ; la première page de mes abonnements seule
  // (pas de camille) ; l'adresse complétée d'une gare avant l'envoi (mon année en cours, ou celle de
  // la carte) ; le tampon frappé avant l'envoi (`postee` passée au dessin commun) ; la signature d'un autre.
  it('la carte à écrire : le recto de sa gare, un champ d’une ligne de 140 signes et son compte, mes abonnements des deux pages, et une adresse qui ne dit que le pseudo, sans tampon', async () => {
    const { carte } = await ecrire()
    expect(within(carte).getByRole('button', { name: M.ouverte.refermer })).toHaveFocus()
    expect(within(carte).getByRole('img', { name: /Paris.*au recto de la carte/ })).toHaveAttribute('src', imageDu1900('g1900'))
    const champ = await within(carte).findByRole('textbox', { name: M.ecrire.mot })
    expect([champ.tagName, champ.getAttribute('type'), champ.getAttribute('maxlength')]).toEqual(['INPUT', 'text', '140'])
    expect(carte.querySelectorAll('textarea')).toHaveLength(0)
    expect(within(carte).getByRole('group', { name: M.ecrire.aQui })).toBeInTheDocument()
    expect(within(carte).getAllByRole('radio').map((r) => r.closest('label')!.textContent)).toEqual(['bob', 'camille'])
    expect(within(carte).getByText('0 sur 140 signes')).toBeInTheDocument()
    expect(adresse(carte)).toEqual([])
    await remplir(carte)
    expect(within(carte).getByText(compteDuMot(MOT))).toHaveTextContent('20 sur 140 signes')
    expect(champ).toHaveAccessibleDescription('20 sur 140 signes')
    expect(adresse(carte)).toEqual(['camille'])
    // Le brouillon se lit à la plume sur le dos de la carte, signé de moi, en texte.
    expect(carte.querySelector('p + p')!.previousElementSibling!.textContent).toBe(MOT)
    expect(carte.querySelector('p + p')).toHaveTextContent(/^alice$/)
    expect(within(carte).queryByRole('img', { name: /Tampon/ })).toBeNull()
    expect(within(carte).getByRole('img', { name: M.ouverte.timbre })).toBeInTheDocument()
  })

  // « L'appli borne la longueur et refuse le vide. » Mutations : `disabled` retiré de « Poster la
  // carte » et la garde de la demande avec (un mot d'espaces, ou sans destinataire, arrive à la
  // confirmation) ; `motPostable` remplacé par `mot !== ''`.
  it.each([
    ['sans mot', '', true],
    ['avec un mot fait d’espaces', '   ', true],
    ['sans destinataire', MOT, false],
  ])('%s, « Poster la carte » ne s’offre pas', async (_, mot, choisir) => {
    const { carte, corps } = await ecrire()
    const champ = await within(carte).findByRole('textbox', { name: M.ecrire.mot })
    fireEvent.change(champ, { target: { value: mot } })
    if (choisir) fireEvent.click(within(carte).getByRole('radio', { name: 'bob' }))
    expect(poster(carte)).toBeDisabled()
    fireEvent.submit(champ.closest('form')!)
    expect(within(carte).queryByText(M.ecrire.avertir)).toBeNull()
    expect(corps).toEqual([])
  })

  // **Une carte ne se corrige ni ne se retire** : poster demande une confirmation. Mutations, dans
  // `CarteAEcrire.tsx` : « Poster la carte » qui poste (`carte.poster` à la soumission) ; « Pas
  // encore » qui poste ; la confirmation gardée après une retouche du mot (elle posterait un mot
  // qu'on n'a pas relu) ; un champ de plus au corps, ou le pseudo à la place de l'identifiant.
  it('« Poster la carte » ne poste rien : il demande ; « Pas encore » non plus ; retoucher le mot redemande ; seul « La poster pour de bon » l’envoie, avec `annee`, `destinataire_id` et `mot`', async () => {
    const { carte, corps } = await ecrire()
    const champ = await remplir(carte)
    fireEvent.click(poster(carte))
    expect(within(carte).getByText(M.ecrire.avertir)).toBeInTheDocument()
    expect(within(carte).queryByRole('button', { name: M.ecrire.poster })).toBeNull()
    fireEvent.click(within(carte).getByRole('button', { name: M.ecrire.attendre }))
    expect(within(carte).queryByText(M.ecrire.avertir)).toBeNull()
    fireEvent.click(poster(carte))
    fireEvent.change(champ, { target: { value: `${MOT} À bientôt.` } })
    expect(within(carte).queryByRole('button', { name: M.ecrire.confirmer })).toBeNull()
    fireEvent.change(champ, { target: { value: MOT } })
    expect(corps).toEqual([])
    fireEvent.click(poster(carte))
    fireEvent.click(within(carte).getByRole('button', { name: M.ecrire.confirmer }))
    await screen.findByRole('dialog', { name: M.ouverte.titre })
    expect(corps).toEqual([{ annee: 1900, destinataire_id: CAMILLE.id, mot: MOT }])
  })

  // `201` : le tampon se frappe, la carte passe aux envoyées, sa gare quitte la liste. L'adresse est
  // alors celle que le serveur sert (constat 14). Mutations : le tampon absent de la carte postée ; la
  // gare du destinataire tue ; la phrase d'une carte ancienne à la place (`vientDePartir` ignoré) ; la
  // carte postée jamais montrée (le dialogue se ferme) ; dans le bloc, ni cache mis à jour ni
  // relecture (l'entrée de 1900 reste, la carte n'est pas aux envoyées).
  it('postée, la carte montre son tampon à date et l’adresse servie, dit où elle part, passe aux envoyées, et sa gare n’est plus proposée', async () => {
    const { carte, courrier, requetes } = await ecrire()
    await remplir(carte)
    fireEvent.click(poster(carte))
    fireEvent.click(within(carte).getByRole('button', { name: M.ecrire.confirmer }))
    const postee = await screen.findByRole('dialog', { name: M.ouverte.titre })
    expect(screen.queryByRole('dialog', { name: M.ecrire.titre })).toBeNull()
    expect(within(postee).getByRole('img', { name: 'Tampon à date : gare de 1900, 9 octobre 2026' })).toBeInTheDocument()
    expect(adresse(postee)).toEqual(['camille', 'gare de 1904', 'Allaman'])
    expect(within(postee).getByRole('status')).toHaveTextContent(ceQueDitLaPostee(POSTEE))
    expect(ceQueDitLaPostee(POSTEE)).toBe('Le tampon à date est frappé : la carte part pour la gare de 1904, chez camille.')
    expect(within(postee).getByRole('button', { name: M.ouverte.refermer })).toHaveFocus()
    expect(postee.querySelectorAll('input, form')).toHaveLength(0)
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(entrees(courrier)).toEqual(['Écrire la carte de la gare de 1902'])
    expect(plis(within(courrier).getByRole('list', { name: M.envoyees }))).toEqual([`À bob · gare de 1902${ENVOYEE.mot}`, `À camille · gare de 1904${MOT}`])
    expect(requetes.filter((r) => r === BOITE)).toHaveLength(1)
  })

  // Règle commune 4 : un `400` (un mot que le serveur refuse) montre son message tel quel, et la carte
  // reste à écrire, son brouillon et son destinataire intacts. Mutations : un message de repli
  // (« Réessaie. ») ; la carte fermée sur un refus ; le brouillon vidé à l'envoi ; le refus rendu hors
  // d'une alerte.
  it('un `400` se dit avec le message du serveur, sans repli, et la carte reste à écrire, son brouillon intact', async () => {
    const { carte } = await ecrire({ [POSTER]: panne('Le mot tient sur une ligne, sans caractère de contrôle.') })
    const champ = await remplir(carte)
    fireEvent.click(poster(carte))
    fireEvent.click(within(carte).getByRole('button', { name: M.ecrire.confirmer }))
    expect(await within(carte).findByRole('alert')).toHaveTextContent(/^Le mot tient sur une ligne, sans caractère de contrôle\.$/)
    expect(carte).not.toHaveTextContent(/réessa/i)
    expect(screen.getByRole('dialog', { name: M.ecrire.titre })).toBe(carte)
    expect(champ.value).toBe(MOT)
    expect(within(carte).getByRole('radio', { name: 'camille' })).toBeChecked()
    await waitFor(() => expect(poster(carte)).toBeEnabled())
  })

  // Un `409` n'est pas une panne. Mutations : le refus de la rubrique jamais rendu ; rendu en alerte
  // avec « Réessayer » (une panne) .
  it('un `409` referme la carte et dit le message du serveur sous la rubrique, sans « Réessayer »', async () => {
    const { carte, courrier } = await ecrire({ [POSTER]: () => json({ code: 'CONFLICT', message: 'Tu ne suis plus ce membre.', retryable: false }, 409) })
    await remplir(carte)
    fireEvent.click(poster(carte))
    fireEvent.click(within(carte).getByRole('button', { name: M.ecrire.confirmer }))
    expect(await within(courrier).findByRole('status')).toHaveTextContent(/^Tu ne suis plus ce membre\.$/)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(within(courrier).queryByRole('alert')).toBeNull()
    expect(within(courrier).queryByRole('button', { name: 'Réessayer' })).toBeNull()
  })

  // Mutations : le champ offert quand même ; la phrase tue (une carte sans rien) ; la phrase dite
  // pendant que mes abonnements se lisent (avant leur réponse).
  it('sans abonnement, la carte le dit et n’offre ni champ, ni destinataire, ni envoi', async () => {
    let servir = (_: unknown) => undefined as void
    const { carte } = await ecrire({ [ABONNEMENTS]: () => new Promise<Response>((r) => void (servir = () => r(json({ items: [], next_cursor: null })))) })
    expect(carte).not.toHaveTextContent(M.ecrire.personne)
    servir(null)
    expect(await within(carte).findByText(M.ecrire.personne)).toBeInTheDocument()
    expect(carte.querySelectorAll('input, form, fieldset')).toHaveLength(0)
    expect(within(carte).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([M.ouverte.refermer])
  })

  // « Le brouillon ne se garde pas sur l'appareil. » Mutations : le brouillon écrit dans
  // `sessionStorage` (ou `localStorage`) à chaque frappe et relu à l'ouverture ; le brouillon tenu par
  // le bloc lecteur, qui survit à la fermeture.
  it('le brouillon ne se garde pas : refermée puis rouverte, la carte est blanche, et rien n’est écrit sur l’appareil', async () => {
    const { carte, courrier, corps } = await ecrire()
    await remplir(carte)
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(JSON.stringify([{ ...localStorage }, { ...sessionStorage }])).not.toContain(MOT)
    fireEvent.click(within(courrier).getByRole('button', { name: carteAEcrireDe(1900) }))
    const rouverte = await screen.findByRole('dialog', { name: M.ecrire.titre })
    expect(((await within(rouverte).findByRole('textbox', { name: M.ecrire.mot })) as HTMLInputElement).value).toBe('')
    expect(within(rouverte).getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toEqual([])
    expect(corps).toEqual([])
  })
})
