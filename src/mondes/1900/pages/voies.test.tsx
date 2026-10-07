import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { FichePrete, Voyage } from '../../../api/voyage'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { filmDeSalle, fichePrete, salle, voyage1890 } from '../../../test/voyage'
import { RELECTURES } from '../../../voyage/relecture'
import { PAGES_1900 } from '../pages'
import { MOTS_DES_VOIES, lettreDuCompartiment, mentionDeLaVoie, phraseDeLaVoiture, plaqueDuCompartiment } from './voies'

/**
 * Les voies et la voiture (plan des pages 1900, brief 3) : les salles d'une année 1900 sont des voies
 * de correspondance, et une salle ouverte, une voiture dont chaque film est un compartiment. La page
 * se monte dans l'app entière : le monde n'y arrive que par le registre.
 */
const SOURCE = { id: '22222222-2222-4222-8222-222222222222', pseudo: 'theo', annee_en_cours: 1903 }
const VOYAGE = voyage1890(
  1903,
  [
    { annee: 1902, statut: 'ouverte', visitee: true, recompense: 'palme' },
    { annee: 1903, statut: 'en_cours', visitee: true, recompense: null },
    { annee: 1904, statut: 'verrouillee', visitee: false, recompense: null },
  ],
  { ia: true, source: null, rattrape_la_source: false },
)
const HORS_IA: Voyage = { ...VOYAGE, ia: false, source: SOURCE }
const FICHE = 'GET /api/me/voyage/annees/1903'

const LUNE = filmDeSalle({ id: 'f-lune', tmdb_id: 775, rang: 1, title: 'Le Voyage dans la Lune', year: 1902, etat: 'vu', note: 9, cover_url: 'https://images.test/lune.jpg' })
const FEES = filmDeSalle({ id: 'f-fees', tmdb_id: 776, rang: 2, title: 'Le Royaume des fées', year: 1903, etat: 'sur_le_plex', cover_url: null })
const PERDU = filmDeSalle({ id: 'f-perdu', tmdb_id: 777, rang: 3, title: 'Une vue perdue', year: null, etat: 'introuvable', cover_url: null })
const BOBINES = filmDeSalle({
  id: 'f-prog',
  tmdb_id: 778,
  rang: 4,
  title: 'Trois vues Lumière',
  year: 1903,
  etat: 'a_demander',
  cover_url: null,
  programme: {
    duree_min: 3,
    bobines: [
      { tmdb_id: 901, title: 'La première vue', duree_min: 1, cover_url: null, plex_url: null, etat: 'vu' },
      { tmdb_id: 902, title: 'La seconde vue', duree_min: 2, cover_url: null, plex_url: null, etat: 'a_demander' },
    ],
  },
})
const CONTEXTE = 'Un contexte déjà écrit, que rien ne redemande.'
// Dans la réponse, la voie 3 vient avant la voie 1 : un numéro n'est pas une place.
const MELIES = salle({ id: 's-mel', rang: 3, nom: 'Méliès, toujours', raison_d_etre: 'Quatre films pour comprendre l’atelier de Montreuil.', contexte: CONTEXTE, films: [LUNE, FEES, PERDU, BOBINES] })
const ESSENTIELS = salle({ id: 's-ess', rang: 1, nom: 'Les essentiels', raison_d_etre: 'Ce qu’il ne fallait pas manquer.', contexte: null, films: [LUNE, PERDU] })

const fiche = (s: Partial<FichePrete> = {}) => fichePrete({ annee: 1903, ticket: null, maturite: null, generique: null, seances: [], demande_salle: null, salles: [MELIES, ESSENTIELS], ...s })
const routes = (v: Voyage = VOYAGE, f: FichePrete = fiche()) => ({ 'GET /api/me/voyage': () => json(v), 'GET /api/me/voyage/tickets': () => json({ tickets: [] }), [FICHE]: () => json(f) })
const voies = async () => within(await screen.findByRole('region', { name: 'Les correspondances' })).getAllByRole('button')
/** La voiture ouverte : le dialogue qui porte la vue prise du train. La feuille du chroniqueur, par-dessus, est l'autre. */
const estVoiture = (d: HTMLElement) => within(d).queryByRole('img', { name: MOTS_DES_VOIES.photo }) !== null
const voiture = () => screen.queryAllByRole('dialog').find(estVoiture) ?? null
const feuille = () => screen.queryAllByRole('dialog').find((d) => !estVoiture(d)) ?? null

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  localStorage.clear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('les règles des voies', () => {
  // Mutations : `65 + rang` (le premier compartiment serait le B) ; la borne à 26 retirée (« [ »).
  it('un compartiment porte la lettre du rang de son film, de A à Z, puis le rang', () => {
    expect([1, 2, 26, 27, 0].map(lettreDuCompartiment)).toEqual(['A', 'B', 'Z', '27', '0'])
  })

  // Mutations : un introuvable tenu pour occupé ; le mot du monde remplacé par « libre » ; les deux
  // mots échangés.
  it('une plaque dit occupé pour un film vu, libre sinon, et le mot du monde pour un introuvable', () => {
    expect((['vu', 'sur_le_plex', 'demande', 'a_demander', 'introuvable'] as const).map((e) => plaqueDuCompartiment(e, 'perdu'))).toEqual([
      { mot: 'occupé', occupe: true },
      { mot: 'libre', occupe: false },
      { mot: 'libre', occupe: false },
      { mot: 'libre', occupe: false },
      { mot: 'perdu', occupe: false },
    ])
  })

  // Mutations : `!acquis` remplacé par « pas vu » (un introuvable retiendrait la voiture) ; le
  // singulier figé ; une voiture vide dite prête à partir.
  it('la voiture part quand plus aucun compartiment n’attend, un introuvable n’attendant plus', () => {
    expect([phraseDeLaVoiture(MELIES), phraseDeLaVoiture(ESSENTIELS), phraseDeLaVoiture({ films: [FEES] }), phraseDeLaVoiture({ films: [] })]).toEqual([
      'Encore 2 compartiments libres : la voiture partira quand ils seront occupés.',
      'Plus un compartiment libre : la voiture peut partir.',
      'Encore un compartiment libre : la voiture partira quand il sera occupé.',
      null,
    ])
  })

  // Mutations : la voiture qui se remplit dite complète ; une salle vide dite complète.
  it('une voie dit qu’elle est complète ou qu’elle se remplit, et rien sinon', () => {
    expect([mentionDeLaVoie(ESSENTIELS, false), mentionDeLaVoie({ ...ESSENTIELS, fournee_en_cours: true }, false), mentionDeLaVoie(MELIES, false), mentionDeLaVoie({ films: [], fournee_en_cours: false }, false)]).toEqual([
      MOTS_DES_VOIES.complete,
      MOTS_DES_VOIES.seRemplit,
      null,
      null,
    ])
  })

  // Mutation : `abandon` ignoré (une fournée abandonnée se promettrait sans fin).
  it('une voie dont la fournée est restée sans réponse ne dit plus qu’elle se remplit', () => {
    expect([mentionDeLaVoie({ ...MELIES, fournee_en_cours: true }, true), mentionDeLaVoie({ ...ESSENTIELS, fournee_en_cours: true }, true), mentionDeLaVoie(MELIES, true)]).toEqual([null, MOTS_DES_VOIES.complete, null])
  })
})

describe('les voies d’une gare', () => {
  // Mutations : `Voie` ou `Correspondances` retiré des gabarits (la baraque par défaut reviendrait) ;
  // dans `Salles`, le numéro pris à la place dans la réponse (la voie 3 deviendrait la 1) ; dans
  // `Voie`, le compte ou la mention retiré ; la voiture montée sans attendre `ouverte`.
  it('les salles sont des voies numérotées par leur rang, avec leur nom et leur compte, à la place des baraques', async () => {
    const { requetes } = monterVoyage('/voyage/1903', routes())
    expect((await voies()).map((b) => b.getAttribute('aria-label'))).toEqual(['Voie 3, Méliès, toujours, 1 vu sur 4', 'Voie 1, Les essentiels, 1 vu sur 2, voiture complète'])
    expect((await voies()).map((b) => b.textContent)).toEqual(['voie3Méliès, toujours1 vu sur 4', 'voie1Les essentielsvoiture complète1 vu sur 2'])
    expect(screen.getByRole('heading', { level: 2, name: /^Les correspondances/ })).toHaveTextContent('Les correspondancestes salles')
    // Ni la baraque par défaut, ni une voiture ouverte, ni un film hors de sa voiture.
    expect(screen.queryByRole('region', { name: 'Salle Méliès, toujours' })).toBeNull()
    expect(screen.queryByRole('list', { name: /^L’étagère/ })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('link', { name: /Le Voyage dans la Lune/ })).toBeNull()
    // La nouvelle salle reste offerte au compte IA, sous les voies.
    expect(screen.getByRole('button', { name: 'Ouvrir une nouvelle salle' })).toBeInTheDocument()
    // Les gabarits ne lisent rien : la fiche, une fois.
    expect(requetes.filter((r) => r.startsWith('GET /api/me/voyage/annees/'))).toEqual([FICHE])
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([])
  })

  // Mutation : dans `Correspondances`, la garde d'une année sans salle retirée (un titre sur rien).
  it('une année sans salle ne montre pas la rubrique', async () => {
    monterVoyage('/voyage/1903', routes(VOYAGE, fiche({ salles: [] })))
    await screen.findByRole('region', { name: 'L’indicateur' })
    expect(screen.queryByRole('region', { name: 'Les correspondances' })).toBeNull()
    expect(screen.queryByText('Les correspondances')).toBeNull()
  })

  // Un défilement commence par un contact : la voiture ne s'ouvre qu'au `click`, que le navigateur
  // ne donne pas après un défilement. Mutation : dans `Voie`, l'ouverture sur `onPointerDown` (ou
  // `onTouchStart`, `onMouseDown`).
  it('une voiture ne s’ouvre pas au premier contact d’un défilement, seulement au toucher', async () => {
    monterVoyage('/voyage/1903', routes())
    const [melies] = await voies()
    fireEvent.pointerDown(melies!)
    fireEvent.touchStart(melies!, { touches: [{ clientY: 300 }] })
    fireEvent.mouseDown(melies!)
    fireEvent.touchMove(melies!, { touches: [{ clientY: 200 }] })
    await act(async () => undefined)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(melies!)
    expect(await screen.findByRole('dialog', { name: 'Méliès, toujours' })).toBeInTheDocument()
  })
})

describe('la voiture d’une salle', () => {
  const ouverte = (v: Voyage = VOYAGE, f: FichePrete = fiche(), autres: Parameters<typeof monterVoyage>[1] = {}) => monterVoyage('/voyage/1903?voiture=s-mel', { ...routes(v, f), ...autres })

  // Mutations, dans `Voiture` : le lien d'un compartiment sans son adresse ; « sans affiche » retiré ;
  // l'état du film (`etiquetteEtat`) retiré ; le mot d'un introuvable en dur ; la lettre prise à
  // l'indice ; les bobines oubliées ; le numéro de la voie retiré du panneau ; la photographie retirée.
  it('montre sa tête, son panneau, sa raison d’être, un compartiment par film et les bobines d’un programme', async () => {
    ouverte()
    const v = await screen.findByRole('dialog', { name: 'Méliès, toujours' })
    expect(within(v).getByRole('img', { name: MOTS_DES_VOIES.photo })).toBeInTheDocument()
    expect(within(v).getByRole('heading', { level: 2, name: 'Méliès, toujours' }).parentElement).toHaveTextContent('Voie 3Méliès, toujours')
    expect(within(v).getByText('Quatre films pour comprendre l’atelier de Montreuil.')).toBeInTheDocument()
    expect(within(v).getByText('La composition').parentElement).toHaveTextContent('La composition1 vu sur 4')
    const compartiments = within(within(v).getByRole('list', { name: 'Les compartiments de la voiture Méliès, toujours' })).getAllByRole('link')
    expect(compartiments.map((c) => `${c.getAttribute('href')} | ${c.getAttribute('aria-label')}`)).toEqual([
      '/voyage/1903/films/f-lune | Le Voyage dans la Lune, vu · 9/10',
      '/voyage/1903/films/f-fees | Le Royaume des fées, sur ton Plex',
      '/voyage/1903/films/f-perdu | Une vue perdue, introuvable',
      '/voyage/1903/films/f-prog | Trois vues Lumière, à voir',
    ])
    // Ce qui se lit dans chaque compartiment : la fenêtre, le film, sa place, son état, sa plaque.
    expect(compartiments.map((c) => [...c.querySelectorAll('span, small')].filter((e) => e.children.length === 0).map((e) => e.textContent).join(' | '))).toEqual([
      `1902 · compartiment A | vu · 9/10 | occupé`,
      `sans affiche | 1903 · compartiment B | sur ton Plex | libre`,
      `sans affiche | compartiment C | ${PAGES_1900.mots.introuvable} | ${PAGES_1900.mots.introuvable}`,
      `sans affiche | 1903 · compartiment D | à voir | libre`,
    ])
    expect(compartiments[0]!.querySelector('img')).toHaveAttribute('src', 'https://images.test/lune.jpg')
    expect(within(within(v).getByRole('list', { name: 'Les bobines de Trois vues Lumière' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['La première vue1 min · vu', 'La seconde vue2 min · à voir'])
    expect(within(v).getByText('Programme · 3 min')).toBeInTheDocument()
    expect(within(v).getByText('Encore 2 compartiments libres : la voiture partira quand ils seront occupés.')).toBeInTheDocument()
    // Une seule voiture : celle que l'adresse nomme.
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  // Le calque vit dans l'adresse : un rechargement rouvre la voiture, Échap et son retour la ferment
  // sans quitter l'année, et une adresse qui ne nomme aucune salle n'ouvre rien. Mutations : dans
  // `Salles`, l'état gardé hors de l'adresse ; dans `Voiture`, `onFermer` non branché au retour, ou
  // `useDialogue` retiré (Échap ne fermerait plus) ; dans `Voie`, la voiture montée pour toute voie.
  it('s’ouvre de l’adresse, et le retour comme Échap la referment sans quitter la gare', async () => {
    const rechargee = ouverte()
    expect(await screen.findByRole('dialog', { name: 'Méliès, toujours' })).toBeInTheDocument()
    // Le dialogue prend le focus sur son retour.
    expect(screen.getByRole('button', { name: MOTS_DES_VOIES.fermer })).toHaveFocus()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    await waitFor(() => expect(voiture()).toBeNull())
    expect(screen.getByRole('region', { name: 'L’année 1903' })).toBeInTheDocument()
    // Rouverte par la page, elle se referme en reculant dans l'historique : la gare, pas la carte.
    fireEvent.click((await voies())[0]!)
    fireEvent.click(await screen.findByRole('button', { name: MOTS_DES_VOIES.fermer }))
    await waitFor(() => expect(voiture()).toBeNull())
    expect(screen.getByRole('region', { name: 'L’année 1903' })).toBeInTheDocument()
    rechargee.unmount()
    monterVoyage('/voyage/1903?voiture=inconnue', routes())
    await voies()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // Un geste que l'API refuserait ne s'affiche pas. Mutations, dans `Voiture` : `ia` remplacé par
  // `true` dans `porteDeLEtagere` (« En voir plus » offert à tous) ou dans `contexteLisible` (un
  // contexte à écrire offert à tous) ; dans `Salles`, le garde de la nouvelle salle retiré.
  it('hors du compte IA : ni « En voir plus », ni contexte à écrire, ni salle nouvelle ; le contexte écrit se lit', async () => {
    const { requetes, unmount } = ouverte(HORS_IA)
    const v = await screen.findByRole('dialog', { name: 'Méliès, toujours' })
    expect(within(v).queryByRole('button', { name: 'En voir plus' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ouvrir une nouvelle salle' })).toBeNull()
    // Le contexte écrit se lit, sans appel.
    fireEvent.click(within(v).getByRole('button', { name: /Le contexte de la salle/ }))
    await waitFor(() => expect(feuille()).toHaveTextContent(CONTEXTE))
    await act(async () => undefined)
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([])
    unmount()
    // Une voiture dont le contexte n'est pas écrit : sa raison d'être se lit, sans geste.
    monterVoyage('/voyage/1903?voiture=s-ess', routes(HORS_IA))
    const essentiels = await screen.findByRole('dialog', { name: 'Les essentiels' })
    expect(within(essentiels).getByText('Ce qu’il ne fallait pas manquer.')).toBeInTheDocument()
    expect(within(essentiels).queryByRole('button', { name: /Le contexte de la salle/ })).toBeNull()
    expect(within(essentiels).queryByRole('button', { name: 'En voir plus' })).toBeNull()
  })

  // Mutations : dans `Salles`, la requête du contexte lancée sans condition (`enabled: true`) ; dans
  // `Voiture`, `onContexte` non branché.
  it('au compte IA, un contexte écrit se lit sans être redemandé, et un contexte manquant s’écrit une fois', async () => {
    let appels = 0
    const contexte = { 'POST /api/me/voyage/annees/1903/salles/s-mel/contexte': () => ((appels += 1), json({ contexte: 'Redemandé à tort.' })), 'POST /api/me/voyage/annees/1903/salles/s-ess/contexte': () => ((appels += 1), json({ contexte: 'Ce que la voiture raconte de 1903.' })) }
    const ecrit = ouverte(VOYAGE, fiche(), contexte)
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Méliès, toujours' })).getByRole('button', { name: /Le contexte de la salle/ }))
    await waitFor(() => expect(feuille()).toHaveTextContent(CONTEXTE))
    await act(async () => undefined)
    expect(appels).toBe(0)
    // La feuille par-dessus la voiture : Échap ne ferme qu'elle.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    await waitFor(() => expect(feuille()).toBeNull())
    expect(voiture()).not.toBeNull()
    ecrit.unmount()
    monterVoyage('/voyage/1903?voiture=s-ess', { ...routes(), ...contexte })
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Les essentiels' })).getByRole('button', { name: /Le contexte de la salle/ }))
    await waitFor(() => expect(feuille()).toHaveTextContent('Ce que la voiture raconte de 1903.'))
    expect(appels).toBe(1)
  })

  // Mutations, dans `Voiture` : `fournee.demander` non branché à la porte ; l'erreur de la fournée
  // tue ; une porte fermée rendue en bouton (`porte.geste` ignoré).
  it('« En voir plus » enfile une fournée, la voiture se remplit et le dit sur sa voie ; un refus s’affiche', async () => {
    const { requetes, unmount } = ouverte(VOYAGE, fiche(), { 'POST /api/me/voyage/salles/s-mel/plus': () => json({ statut: 'en_cours' }, 202) })
    const v = await screen.findByRole('dialog', { name: 'Méliès, toujours' })
    fireEvent.click(within(v).getByRole('button', { name: 'En voir plus' }))
    expect(await within(v).findByText('La salle se remplit…')).toBeInTheDocument()
    expect(within(v).queryByRole('button', { name: 'En voir plus' })).toBeNull()
    // Une porte fermée n'est pas un geste : la toucher ne redemanderait rien.
    expect(within(v).queryByRole('button', { name: 'La salle se remplit…' })).toBeNull()
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual(['POST /api/me/voyage/salles/s-mel/plus'])
    expect(within(v).getByText(`Voie 3 · ${MOTS_DES_VOIES.seRemplit}`)).toBeInTheDocument()
    expect((await voies())[0]).toHaveAttribute('aria-label', `Voie 3, Méliès, toujours, 1 vu sur 4, ${MOTS_DES_VOIES.seRemplit}`)
    unmount()
    ouverte(VOYAGE, fiche(), { 'POST /api/me/voyage/salles/s-mel/plus': () => json({ code: 'CONFLICT', message: 'Cette salle se remplit déjà.', retryable: false }, 409) })
    fireEvent.click(await screen.findByRole('button', { name: 'En voir plus' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Cette salle se remplit déjà.')
  })

  // Le guet d'une voiture qui se remplit court à la page, voiture fermée : la fiche se relit, et la
  // voie cesse de dire qu'elle se remplit. Mutation : dans `Salles`, `useFournee` appelé dans la
  // seule salle dépliée (le guet tenu par la voiture ouverte).
  it('une voiture fermée qui se remplit se relit quand même, jusqu’à la fournée', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let lectures = 0
      const { requetes } = monterVoyage('/voyage/1903', { ...routes(), [FICHE]: () => json((lectures += 1) === 1 ? fiche({ salles: [{ ...MELIES, fournee_en_cours: true }, ESSENTIELS] }) : fiche()) })
      await waitFor(async () => expect((await voies())[0]).toHaveAttribute('aria-label', expect.stringContaining(MOTS_DES_VOIES.seRemplit)))
      expect(screen.queryByRole('dialog')).toBeNull()
      await vi.advanceTimersByTimeAsync(3_000)
      await waitFor(() => expect(requetes.filter((r) => r === FICHE)).toHaveLength(2))
      await waitFor(async () => expect((await voies())[0]).toHaveAttribute('aria-label', 'Voie 3, Méliès, toujours, 1 vu sur 4'))
    } finally {
      vi.useRealTimers()
    }
  })

  // Le guet d'une fournée s'arrête au plafond : la voiture le dit, et « Réessayer » le reprend sans
  // rien redemander au chroniqueur. Sur le modèle du défaut (`Salles.test.tsx`). Mutations, dans
  // `Voiture` : l'abandon tu (le bloc `fournee.abandon` retiré) ; « Réessayer » non branché ;
  // l'abandon non passé à `mentionDeLaVoie`, dans `Voie` ou dans `Voiture`.
  it('une fournée restée sans réponse le dit dans la voiture, et « Réessayer » reprend le guet', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { requetes } = ouverte(VOYAGE, fiche({ salles: [{ ...MELIES, fournee_en_cours: true }, ESSENTIELS] }))
      const lectures = () => requetes.filter((r) => r === FICHE).length
      const v = await screen.findByRole('dialog', { name: 'Méliès, toujours' })
      expect(within(v).queryByRole('alert')).toBeNull()
      const laVoie = async () => (await voies())[0]!.getAttribute('aria-label')
      expect(await laVoie()).toBe(`Voie 3, Méliès, toujours, 1 vu sur 4, ${MOTS_DES_VOIES.seRemplit}`)
      for (let i = 0; i < RELECTURES.fournee.plafond + 4; i += 1) await vi.advanceTimersByTimeAsync(RELECTURES.fournee.ms)
      expect(await within(v).findByRole('alert')).toHaveTextContent('Le chroniqueur n’a pas répondu, reviens plus tard.')
      expect(lectures()).toBe(1 + RELECTURES.fournee.plafond)
      // Le guet abandonné, ni la voie ni le panneau ne promettent plus que la voiture se remplit.
      expect(await laVoie()).toBe('Voie 3, Méliès, toujours, 1 vu sur 4')
      expect(within(v).getByRole('heading', { level: 2 }).parentElement).toHaveTextContent(/^Voie 3Méliès, toujours$/)
      fireEvent.click(within(v).getByRole('button', { name: 'Réessayer' }))
      await waitFor(() => expect(lectures()).toBe(2 + RELECTURES.fournee.plafond))
      expect(within(v).queryByRole('alert')).toBeNull()
      expect(await laVoie()).toBe(`Voie 3, Méliès, toujours, 1 vu sur 4, ${MOTS_DES_VOIES.seRemplit}`)
      await vi.advanceTimersByTimeAsync(RELECTURES.fournee.ms)
      expect(lectures()).toBe(3 + RELECTURES.fournee.plafond)
      expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })
})
