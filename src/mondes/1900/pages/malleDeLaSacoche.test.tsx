import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Malle, PlaceDeMalle, RubriqueVue, Tickets, Voyage, Voyageur } from '../../../api/voyage'
import { exemple } from '../../../test/contrat'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { voyage1890 } from '../../../test/voyage'
import { MOTS_DE_LA_MALLE as M, compteDeLaLigne, derniereCollee, nomLuDeLaPlace, nouvellesDites, teteDeLaFiche } from './malle'

/**
 * La malle aux étiquettes dans la sacoche des années 1900 (plan des écrans des lots, brief 2 ;
 * maquette, écrans 15 et 18) : la page montée dans l'app entière, le monde n'y arrive que par le
 * registre. Ce que le bloc lecteur lit, marque et garde dans l'adresse est tenu, sans monde, par
 * `pages/VoyageSacoche.malle.test.tsx` ; ici, ce que 1900 en dit. Aucun test sur le tracé d'un badge.
 */
const SACOCHE = '/voyage/sacoche'
const CARTE = 'GET /api/me/voyage'
const TICKETS = 'GET /api/me/voyage/tickets'
const MALLE = 'GET /api/me/voyage/decennies/1900/etiquettes'
const VOYAGEUR = 'GET /api/me/voyage/voyageur'
const VUE = 'POST /api/me/voyage/rubriques/etiquette/vue'

const EN_1903: Voyage = voyage1890(1903, [{ annee: 1903, statut: 'en_cours', visitee: true, recompense: null }], { ia: true, source: null })
const EN_1910: Voyage = { ...EN_1903, annee_en_cours: 1910 }
const TICKETS_LUS: Tickets = { tickets: [{ annee: 1904, motif: '1903 est bouclée, 1904 t’attend.', emis_le: '2026-09-01T18:00:00.000Z', montre_le: null, utilise_le: null }] }
const ETAT = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
const vuLe = (vueLe: string | null): Voyageur => ({ ...ETAT, rubriques: ETAT.rubriques.map((r) => (r.rubrique === 'etiquette' ? { ...r, vue_le: vueLe } : r)) })

const place = (numero: number, p: Partial<PlaceDeMalle> = {}): PlaceDeMalle => ({ numero, cachee: false, cle: null, nom: null, devise: null, regle: null, quoi: null, collee_le: null, progression: null, ...p })
/** Collée à 23 h 30 UTC le 28 septembre : à Paris, c'est déjà le 29. */
const CORRESPONDANCE = place(3, { cle: 'correspondance', nom: 'La Correspondance', devise: 'Deux gares · un soir', regle: 'Voir le même soir deux films de deux gares différentes.', quoi: 'soir à deux gares', collee_le: '2026-09-28T23:30:00.000Z' })
const TRAIN_DE_NUIT = place(8, { cle: 'train-de-nuit', nom: 'Le Train de nuit', devise: 'Après minuit', regle: 'Composter cinq séances après minuit.', quoi: 'séances après minuit', progression: { fait: 2, seuil: 5 } })
const CACHEE = place(15, { cachee: true })
/** Une malle de trois places : rien n'y vaut quinze. */
const TROIS_PLACES: Malle = { decennie: 1900, total: 3, collees: 1, etiquettes: [CORRESPONDANCE, TRAIN_DE_NUIT, CACHEE] }
const malleDe = (...etiquettes: PlaceDeMalle[]): Malle => ({ decennie: 1900, total: etiquettes.length, collees: etiquettes.filter((p) => p.collee_le !== null).length, etiquettes })

const ROUTES = {
  [CARTE]: () => json(EN_1903),
  [TICKETS]: () => json(TICKETS_LUS),
  [MALLE]: () => json(TROIS_PLACES),
  // Ma dernière visite de la malle, avant le collage : la Correspondance est nouvelle.
  [VOYAGEUR]: () => json(vuLe('2026-09-20T08:00:00.000Z')),
  [VUE]: () => json({ rubrique: 'etiquette', vue_le: '2026-09-29T12:00:00.000Z' } satisfies RubriqueVue),
}
// `retryable: false` : une panne relancée par TanStack attendrait trois secondes avant de se dire.
const panne = (message: string) => () => json({ code: 'VALIDATION_ERROR', message, retryable: false }, 400)

const region = () => screen.findByRole('region', { name: 'Malle' })
/** La ligne de la sacoche : le seul bouton de la région tant que la malle est fermée. */
const ligne = async () => within(await region()).findByRole('button')
const ouvrir = async () => {
  fireEvent.click(await ligne())
  return screen.findByRole('dialog', { name: M.ouverte.titre })
}
const places = (malle: HTMLElement) => within(malle).getAllByRole('button', { pressed: undefined }).filter((b) => b.hasAttribute('aria-pressed'))
const touchee = (malle: HTMLElement) => places(malle).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('aria-label'))
const fiche = (malle: HTMLElement) => within(malle).getByRole('status')
/** Le mot posé sur une place, hors de son badge (dont le dessin porte son nom court et sa devise). */
const motSurLaPlace = (b: HTMLElement) => b.querySelector('span')?.textContent ?? ''

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-29T12:00:00.000Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  // Rend `TZ` tel qu'il était : Node le relit à chaque affectation.
  vi.unstubAllEnvs()
})

describe('les mots de la malle', () => {
  // Mutations : le pluriel retiré de `compteDeLaLigne` ou de `nouvellesDites` ; « nouvelle » dit d'une
  // trace de colle dans `teteDeLaFiche` (la précision lue sur `nouvelle` avant l'état).
  it('s’accordent, et la tête d’une fiche dit l’état de sa place', () => {
    expect([0, 1, 2].map((collees) => compteDeLaLigne({ collees, total: 15 }))).toEqual(['0 étiquette sur 15', '1 étiquette sur 15', '2 étiquettes sur 15'])
    expect([1, 2].map(nouvellesDites)).toEqual(['1 nouvelle', '2 nouvelles'])
    expect([teteDeLaFiche(CORRESPONDANCE, true), teteDeLaFiche(CORRESPONDANCE, false), teteDeLaFiche(TRAIN_DE_NUIT, true), teteDeLaFiche(CACHEE, true)]).toEqual([
      'Étiquette nº 3 · nouvelle',
      'Étiquette nº 3',
      'Étiquette nº 8 · trace de colle',
      'Étiquette nº 15 · cachée',
    ])
  })

  // Deux instants, jamais deux chaînes : `…:00Z` se range après `…:00.500Z` dans l'ordre du texte.
  // Mutations : `p.collee_le > derniere.collee_le` sur les chaînes ; la dernière servie prise (sans
  // comparer) ; une trace de colle au seuil comptée comme collée.
  it('l’étiquette collée en dernier l’est par l’instant, ni par le texte de sa date, ni par son numéro', () => {
    const tot = place(9, { cle: 'express', nom: 'L’Express', collee_le: '2026-09-29T09:00:00Z' })
    const tard = place(2, { cle: 'coloriste', nom: 'Le Coloriste', collee_le: '2026-09-29T09:00:00.500Z' })
    const pleine = place(12, { cle: 'pionniere', nom: 'La Pionnière', progression: { fait: 3, seuil: 3 } })
    expect(derniereCollee([tard, tot, pleine])?.numero).toBe(2)
    expect(derniereCollee([tot, tard, pleine])?.numero).toBe(2)
    expect(derniereCollee([pleine, TRAIN_DE_NUIT, CACHEE])).toBeNull()
  })
})

describe('la malle dans la sacoche de 1900', () => {
  // Mutations : le total écrit en dur dans `compteDeLaLigne` (`sur 15`) ; le jour de `derniereDite`
  // coupé dans la date (`collee_le.slice(0, 10)` : le 28) ; « n nouvelle » retiré de la ligne ; la
  // malle lue à la décennie du départ (1890 : la requête de 1900 ne part pas).
  it('sa ligne dit le compte que le serveur sert, jamais quinze en dur, l’étiquette collée en dernier au jour de Paris, et ce qui est nouveau', async () => {
    vi.stubEnv('TZ', 'UTC')
    const { requetes } = monterVoyage(SACOCHE, ROUTES)
    const bouton = await ligne()
    await waitFor(() => expect(bouton).toHaveTextContent('1 nouvelle'))
    expect(bouton).toHaveTextContent('1 étiquette sur 3')
    expect(bouton).toHaveTextContent('La Correspondance, collée le 29 septembre 2026')
    expect(bouton).not.toHaveTextContent(/15|28 septembre/)
    expect(within(await region()).getByRole('heading', { level: 2 })).toHaveTextContent(`${M.titre} ${M.sous}`)
    expect(requetes).toContain(MALLE)
    expect(requetes.filter((r) => r.includes('/etiquettes'))).toEqual([MALLE])
  })

  // Décision 1 : 1900 seulement. Dix ans plus loin, la sacoche est celle du monde « à venir », qui ne
  // compose pas la malle. Mutation : dans `voyage/sacoche/Malle.tsx`, le bloc monté sans regarder la clé.
  it('en 1910, dans la sacoche d’un autre monde, ni malle ni lecture', async () => {
    const { requetes, client } = monterVoyage(SACOCHE, { ...ROUTES, [CARTE]: () => json(EN_1910), 'GET /api/me/voyage/decennies/1910/etiquettes': () => json(TROIS_PLACES) })
    await within(await screen.findByRole('region', { name: 'Portefeuille' })).findByRole('list')
    await waitFor(() => expect(client.isFetching() + client.isMutating()).toBe(0))
    expect(screen.queryByRole('region', { name: 'Malle' })).toBeNull()
    expect(requetes.filter((r) => /\/etiquettes|\/voyageur|\/rubriques\//.test(r))).toEqual([])
  })

  // Mutations, dans le dessin de 1900 : la branche `panne` retirée (la rubrique resterait seule, sans
  // rien dire) ; la ligne montée malgré la panne.
  it('en panne, elle le dit sous sa rubrique, et le portefeuille garde ses tickets', async () => {
    monterVoyage(SACOCHE, { ...ROUTES, [MALLE]: panne('La malle est en panne.') })
    const malle = await region()
    expect(await within(malle).findByRole('alert')).toHaveTextContent('La malle est en panne.')
    expect(within(malle).getAllByRole('button').map((b) => b.textContent)).toEqual(['Réessayer'])
    expect(within(malle).getByRole('heading', { level: 2 })).toHaveTextContent(M.titre)
    const portefeuille = await screen.findByRole('region', { name: 'Portefeuille' })
    expect(await within(portefeuille).findAllByRole('listitem')).toHaveLength(1)
    expect(within(portefeuille).queryByRole('alert')).toBeNull()
  })

  // Mutations : `muet` retiré d'un `BadgeDeMalle` (une place aurait deux noms : celui du bouton et
  // celui de l'image) ; `aria-label` du bouton d'une place retiré (aucun) ; les places rangées par état
  // et non servies telles quelles ; `aria-pressed` posé sur toutes.
  it('ouverte, elle montre ses places par numéro, chacune un seul nom, et la dernière collée est choisie', async () => {
    monterVoyage(SACOCHE, ROUTES)
    const malle = await ouvrir()
    expect(within(malle).getByRole('heading', { level: 2 })).toHaveTextContent(`${M.ouverte.titre} 1 sur 3`)
    expect(places(malle).map((b) => b.getAttribute('aria-label'))).toEqual(TROIS_PLACES.etiquettes.map(nomLuDeLaPlace))
    expect(touchee(malle)).toEqual([nomLuDeLaPlace(CORRESPONDANCE)])
    // Un seul nom par place : aucune image nommée, ni dans la malle ouverte ni sur la ligne.
    expect(within(malle).queryAllByRole('img')).toEqual([])
    expect(within(await region()).queryAllByRole('img')).toEqual([])
    // La plaque dit la décennie que le serveur sert.
    expect(malle).toHaveTextContent(`${M.ouverte.compagnie}1900–1909`)
  })

  // Maquette, l. 3865-3870. Mutations : la fiche figée sur la place du départ (`setNumero` sans effet) ;
  // « Collée le » dit sans `jourDeParis` ; la jauge remplie jusqu'au seuil ; la règle ou le nom d'une
  // autre place gardés sur la fiche d'une cachée ; « nouvelle » dit de toute place collée.
  it('toucher une place donne son nom, sa règle, sa date ou ce qui manque avec sa jauge ; une cachée ne dit rien d’elle', async () => {
    vi.stubEnv('TZ', 'UTC')
    monterVoyage(SACOCHE, ROUTES)
    const malle = await ouvrir()
    await waitFor(() => expect(fiche(malle)).toHaveTextContent('Étiquette nº 3 · nouvelle'))
    expect(fiche(malle)).toHaveTextContent('La Correspondance')
    expect(fiche(malle)).toHaveTextContent(CORRESPONDANCE.regle!)
    expect(fiche(malle)).toHaveTextContent('Collée le 29 septembre 2026')
    expect(fiche(malle).querySelectorAll('[data-fait]')).toHaveLength(0)
    // « Nouvelle » se lit aussi sur la place, et sur elle seule.
    expect(places(malle).map(motSurLaPlace)).toEqual([M.nouvelle, '', ''])

    fireEvent.click(within(malle).getByRole('button', { name: nomLuDeLaPlace(TRAIN_DE_NUIT) }))
    expect(touchee(malle)).toEqual([nomLuDeLaPlace(TRAIN_DE_NUIT)])
    expect(fiche(malle)).toHaveTextContent('Étiquette nº 8 · trace de colle')
    expect(fiche(malle)).toHaveTextContent('Le Train de nuit')
    expect(fiche(malle)).toHaveTextContent(TRAIN_DE_NUIT.regle!)
    expect(fiche(malle)).toHaveTextContent('2 sur 5 · séances après minuit')
    expect(fiche(malle)).not.toHaveTextContent(/Collée le|Correspondance/)
    expect([...fiche(malle).querySelectorAll('[data-fait]')].map((i) => i.getAttribute('data-fait'))).toEqual(['oui', 'oui', 'non', 'non', 'non'])

    fireEvent.click(within(malle).getByRole('button', { name: M.cachee }))
    expect(fiche(malle)).toHaveTextContent(`Étiquette nº 15 · cachée${M.ouverte.nomDeLaCachee}${M.ouverte.regleDeLaCachee}`)
    expect(fiche(malle)).not.toHaveTextContent(/Train de nuit|minuit|Collée le| sur /)
    expect(fiche(malle).querySelectorAll('[data-fait]')).toHaveLength(0)
  })

  // Le point (a) laissé par le brief 1 : la fiche de la maquette écrirait « 0 sur 1 · … » ; la règle
  // du brief 1 l'emporte (un seuil de un se dit « à gagner », jamais « 0 sur 1 »), sur la fiche comme
  // sur le badge. Mutation : la fiche qui écrit `fait sur seuil · quoi` comme la maquette.
  it('pour un seuil de un, la fiche dit « à gagner », jamais « 0 sur 1 », et sa jauge n’a qu’une case', async () => {
    const chef = place(1, { cle: 'chef-de-gare', nom: 'Le Chef de gare', devise: 'Départ', regle: 'Boucler une année sans jamais utiliser « Ignorer » au train du soir.', quoi: 'année bouclée sans « Ignorer »', progression: { fait: 0, seuil: 1 } })
    monterVoyage(SACOCHE, { ...ROUTES, [MALLE]: () => json(malleDe(chef, TRAIN_DE_NUIT)) })
    const malle = await ouvrir()
    // Aucune collée : la première place est choisie, la fiche n'est jamais vide.
    expect(touchee(malle)).toEqual([nomLuDeLaPlace(chef)])
    expect(fiche(malle)).toHaveTextContent('à gagner · année bouclée sans « Ignorer »')
    expect(fiche(malle)).not.toHaveTextContent(/\d sur \d/)
    expect([...fiche(malle).querySelectorAll('[data-fait]')].map((i) => i.getAttribute('data-fait'))).toEqual(['non'])
  })

  // Mutations : le second texte de la ligne monté sans étiquette collée (« null, collée le … ») ;
  // `placeAuDepart` sans repli sur la première place (aucune fiche) ; « nouvelle » compté sur toutes
  // les places.
  it('sans aucune étiquette collée, la ligne ne dit que son compte, et la malle s’ouvre sur sa première place', async () => {
    monterVoyage(SACOCHE, { ...ROUTES, [MALLE]: () => json(malleDe(TRAIN_DE_NUIT, CACHEE)), [VOYAGEUR]: () => json(vuLe(null)) })
    const bouton = await ligne()
    expect(bouton).toHaveTextContent(/^0 étiquette sur 2$/)
    const malle = await ouvrir()
    expect(touchee(malle)).toEqual([nomLuDeLaPlace(TRAIN_DE_NUIT)])
    expect(fiche(malle)).toHaveTextContent('Étiquette nº 8 · trace de colle')
  })

  // Mutations : « nouvelle » borné à la dernière collée (comme la maquette, qui n'en a qu'une) ; dit
  // de toute place collée, sur la place ou sur sa fiche (le Coloriste, collé avant ma visite).
  it('deux étiquettes collées depuis ma dernière visite : « 2 nouvelles », chacune le porte, et celle d’avant ne le porte pas', async () => {
    const coloriste = place(2, { cle: 'coloriste', nom: 'Le Coloriste', devise: 'Au pochoir', regle: 'Voir cinq films coloriés au pochoir ou à la main.', quoi: 'films coloriés', collee_le: '2026-09-20T10:00:00.000Z' })
    const express = place(9, { cle: 'express', nom: 'L’Express', devise: '48 heures', regle: 'Passer une gare (cinq arrivées) en moins de 48 heures.', quoi: 'gare passée en moins de 48 heures', collee_le: '2026-09-27T10:00:00.000Z' })
    monterVoyage(SACOCHE, { ...ROUTES, [MALLE]: () => json(malleDe(coloriste, CORRESPONDANCE, TRAIN_DE_NUIT, express)), [VOYAGEUR]: () => json(vuLe('2026-09-26T08:00:00.000Z')) })
    const bouton = await ligne()
    await waitFor(() => expect(bouton).toHaveTextContent('2 nouvelles'))
    expect(bouton).toHaveTextContent('3 étiquettes sur 4')
    const malle = await ouvrir()
    expect(places(malle).map(motSurLaPlace)).toEqual(['', M.nouvelle, '', M.nouvelle])
    fireEvent.click(within(malle).getByRole('button', { name: nomLuDeLaPlace(coloriste) }))
    expect(within(fiche(malle)).getByText(/^Étiquette nº/)).toHaveTextContent(/^Étiquette nº 2$/)
    fireEvent.click(within(malle).getByRole('button', { name: nomLuDeLaPlace(express) }))
    expect(within(fiche(malle)).getByText(/^Étiquette nº/)).toHaveTextContent(/^Étiquette nº 9 · nouvelle$/)
  })

  // Un dialogue : « Refermer » et Échap ferment, et rendent le doigt à la ligne. Mutations : `onFermer`
  // non branché sur « Refermer » ; `useDialogue` retiré (Échap ne ferme plus, le focus reste au document).
  it.each([
    ['« Refermer »', (malle: HTMLElement) => fireEvent.click(within(malle).getByRole('button', { name: M.ouverte.refermer }))],
    ['Échap', () => fireEvent.keyDown(document, { key: 'Escape' })],
  ])('%s referme la malle, et la sacoche est toujours là', async (_, fermer) => {
    monterVoyage(['/voyage', SACOCHE], ROUTES)
    const malle = await ouvrir()
    expect(within(malle).getByRole('button', { name: M.ouverte.refermer })).toHaveFocus()
    fermer(malle)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await ligne()).toHaveTextContent('1 étiquette sur 3')
    expect(screen.getByRole('region', { name: 'La sacoche du voyageur' })).toBeInTheDocument()
  })
})
