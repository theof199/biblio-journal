import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { CartePostaleEnvoyee, CartePostaleRecue, Courrier, Malle, RubriqueVue, Voyageur } from '../../../api/voyage'
import { exemple } from '../../../test/contrat'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { voyage1890 } from '../../../test/voyage'
import { imageDu1900 } from '../images'
import { MOTS_DU_COURRIER as M, adresseDe, ceQueDitLaCarte, enteteDeLEnvoyee, enteteDeLaRecue, rectoDe, tamponADate } from './courrier'

/**
 * Le courrier dans la sacoche des années 1900 (plan des écrans des lots, brief 13 ; maquette, écrans 15
 * et 19) : ce que le dessin dit de ma boîte, et la carte ouverte. La page est montée dans l'app
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
    expect(within(courrier).queryAllByRole('list').map((l) => l.getAttribute('aria-label'))).toEqual(listes)
    expect(within(courrier).queryByText(M.vide) !== null).toBe(phrase !== null)
    expect([M.recues, M.envoyees].filter((t) => within(courrier).queryByText(t) !== null)).toEqual(listes)
    // Rien n'annonce encore une carte à écrire (brief 14), même avec une gare qui l'attend.
    expect(within(courrier).queryAllByRole('button')).toHaveLength(boite.recues.length + boite.envoyees.length)
  })

  // Règle commune 3. Mutation : la branche de la panne retirée du dessin (la rubrique seule, muette).
  it('en panne, la rubrique le dit avec le message du serveur et « Réessayer », et les objets trouvés restent', async () => {
    let enPanne = true
    const { courrier } = await monter(LA_BOITE, { [BOITE]: () => (enPanne ? panne('Le courrier est en panne.')() : json(LA_BOITE)) })
    expect(await within(courrier).findByRole('alert')).toHaveTextContent('Le courrier est en panne.')
    expect(within(await screen.findByRole('region', { name: 'Objets trouvés' })).queryByRole('alert')).toBeNull()
    enPanne = false
    fireEvent.click(within(courrier).getByRole('button', { name: 'Réessayer' }))
    expect(await within(courrier).findAllByRole('list')).toHaveLength(2)
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
