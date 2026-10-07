import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { JournalItem, JournalPage } from '../../../api/journal'
import type { ReactionsCatalogue } from '../../../api/reactions'
import { exemple } from '../../../test/contrat'
import { visionnage } from '../../../test/journal'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { fichePrete, filmDeSalle, salle, voyage1890 } from '../../../test/voyage'
import { formatDateVisionnage, jourLocal } from '../../../ui/format'
import { DUREE_DU_COMPOSTAGE, FRAPPE, VIBRATION, decalerJour } from '../../../voyage/billet'
import { oublierLeBillet } from '../../../voyage/billet/range'
import { oublierLeRetour } from '../../../voyage/annee/retour'
import { TEMPO } from '../../../voyage/tempo'
import { PAGES_1900 } from '../pages'
import { MOTS_DU_COMPOSTEUR as M, compteDesCoupons, datePressee, ligneDuFilm, molettesDeLaPresse, noteDuCarton, trousDuCarton } from './carton'
import { libelleDeLaVoiture } from './hale'
import FEUILLE_DU_CARTON from './Carton.module.css?raw'

/**
 * Le composteur et le billet Edmondson (plan des pages 1900, brief 6) : le billet de séance d'une
 * année 1900. La page se monte dans l'app entière, le monde n'y arrive que par le registre ; elle
 * garde ses lectures, ses écritures et la séquence du compostage, que ces tests retrouvent sous le
 * carton. Les tests de `pages/VoyageBillet.test.tsx`, montés sur 1890, tiennent le défaut.
 */
const VOYAGE = voyage1890(
  1903,
  [
    { annee: 1902, statut: 'ouverte', visitee: true, recompense: 'lion' },
    { annee: 1903, statut: 'en_cours', visitee: true, recompense: null },
    { annee: 1904, statut: 'verrouillee', visitee: false, recompense: null },
  ],
  { ia: false, source: { id: '22222222-2222-4222-8222-222222222222', pseudo: 'theo', annee_en_cours: 1903 }, rattrape_la_source: false },
)
const VOL = filmDeSalle({ id: 'f-vol', tmdb_id: 5698, title: 'Le Vol du grand rapide', year: 1903, realisateur: 'Edwin S. Porter', etat: 'a_demander', note: null, plex_url: null })
const FEES = filmDeSalle({ id: 'f-fees', tmdb_id: 775, title: 'Le Royaume des fées', year: 1903, realisateur: 'Georges Méliès', etat: 'vu', note: 9, plex_url: null })
const FICHE = fichePrete({ annee: 1903, salles: [salle({ id: 's-ess', nom: 'Les essentiels', films: [VOL, FEES] })], podium: [null, null, null], ticket: null, maturite: null, seances: [], demande_salle: null })

const CARTE = 'GET /api/me/voyage'
const ANNEE = 'GET /api/me/voyage/annees/1903'
const REACTIONS = 'GET /api/reference/reactions'
const MEDIA = 'POST /api/media'
const JOURNAL = 'POST /api/me/journal'
/** Mes films des années 1900 : le casier, où le billet lit son numéro. */
const BOITE = 'GET /api/me/journal?limit=100&sortie_min=1900&sortie_max=1909'
const CATALOGUE = exemple<ReactionsCatalogue>('/reference/reactions', 'get', 200)
const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)

const vu = (id: string, annee: number, date: string) => visionnage({ id, media: `m-${id}`, annee, date })
/** L'entrée que rend le compostage : un film de 1903 (vue le 12 juillet 2026, l'exemple du contrat). */
const NEUVE = (() => {
  const e = exemple<JournalItem>('/me/journal', 'post', 201)
  e.media.year = 1903
  return e
})()
/** Le casier après ce compostage : deux billets avant lui, et un film de 1897 qu'il ne compte pas. Le billet neuf y porte le N° 0003. */
const CASIER = [NEUVE, vu('e-b', 1901, '2026-06-01'), vu('e-x', 1897, '2026-05-15'), vu('e-a', 1900, '2026-05-01')]

/** Mon visionnage du Royaume des fées, sa remarque privée comprise : l'état de navigation de la correction. */
function feesVu(): JournalItem {
  const v = visionnage({ id: 'e-fees', media: 'm-fees', titre: 'Le Royaume des fées', annee: 1903, date: '2026-09-01', note: 9, reactions: ['adore'] })
  v.media.external_id = '775'
  v.media.source = 'tmdb'
  v.media.type = 'movie'
  v.media.director = 'Georges Méliès'
  v.carnet.comment = 'Une remarque privée, rien qu’à moi.'
  return v
}

function serveur(o: { boite?: JournalItem[]; journal?: () => Response } = {}) {
  const etat = { creations: 0, envoye: null as Record<string, unknown> | null }
  const routes = {
    [CARTE]: () => json(VOYAGE),
    [ANNEE]: () => json(FICHE),
    [REACTIONS]: () => json(CATALOGUE),
    [MEDIA]: () => json(exemple('/media', 'post', 201), 201),
    [BOITE]: () => json({ ...PAGE, items: o.boite ?? [], next_cursor: null }),
    [JOURNAL]: (init: RequestInit) => {
      etat.creations += 1
      etat.envoye = JSON.parse(String(init.body)) as Record<string, unknown>
      return o.journal?.() ?? json(NEUVE, 201)
    },
  }
  return { etat, routes }
}

const billet = (film: { id: string }, suite = '') => `/voyage/1903/films/${film.id}/billet${suite}`
const composter = () => screen.findByRole('button', { name: /^Composter le billet/ })
const lAnnee = () => screen.findByRole('region', { name: 'L’année 1903' })
/** Le carton : il porte le titre de la page. */
const carton = async (titre = VOL.title) => (await screen.findByRole('heading', { level: 1, name: titre })).closest<HTMLElement>('[data-vivante]')!
const perces = (c: HTMLElement) => [...c.querySelectorAll('[data-perce]')].map((t) => t.getAttribute('data-perce') === 'true')
const tampon = () => screen.queryByRole('img', { name: /^VU : / })

/** `matchMedia` manque à jsdom : le test pose la réponse de « moins d'animations ». */
const calme = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

function vibreur() {
  const vibrate = vi.fn(() => true)
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
  return vibrate
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  localStorage.clear()
  oublierLeRetour(1903)
  oublierLeBillet()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
  delete (navigator as { vibrate?: unknown }).vibrate
})

describe('les règles du carton', () => {
  // Mutations : `i < note + 1` (un trou de plus) ; `i < note - 1` ; `i <= note` ; neuf places ; une
  // note nulle qui percerait.
  it('perce un trou par point, ni plus ni moins, des dix places, et aucun sans note', () => {
    for (let note = 1; note <= 10; note += 1) {
      const trous = trousDuCarton(note)
      expect(trous).toHaveLength(10)
      expect(trous.filter(Boolean)).toHaveLength(note)
      // Les premiers, sans lacune.
      expect(trous.indexOf(false)).toBe(note === 10 ? -1 : note)
    }
    expect(trousDuCarton(null)).toEqual(Array.from({ length: 10 }, () => false))
    expect([noteDuCarton(8), noteDuCarton(10), noteDuCarton(null)]).toEqual(['8 / 10', '10 / 10', 'sans note'])
  })

  // Mutations : le mois décalé d'un cran ; l'année sur quatre chiffres ; le jour sans son zéro ; deux
  // mois au même code (« MA » pour mars et mai).
  it('presse la date en trois molettes : le jour, le mois en deux lettres, l’année en deux chiffres', () => {
    expect(datePressee('2026-09-30')).toBe('30 SE 26')
    expect(datePressee('2026-01-02')).toBe('02 JA 26')
    expect(molettesDeLaPresse('2027-12-09')).toEqual(['09', 'DE', '27'])
    const mois = Array.from({ length: 12 }, (_, i) => molettesDeLaPresse(`2026-${String(i + 1).padStart(2, '0')}-15`)[1])
    expect(mois).toEqual(['JA', 'FE', 'MR', 'AV', 'MA', 'JN', 'JL', 'AO', 'SE', 'OC', 'NO', 'DE'])
    expect(new Set(mois).size).toBe(12)
  })

  // Mutations : la gare oubliée ; un réalisateur vide écrit quand même (« · gare de 1903 ») ; le
  // pluriel des coupons.
  it('dit le film et sa gare, et compte les coupons', () => {
    expect(ligneDuFilm('Edwin S. Porter', 1903)).toBe('Edwin S. Porter · gare de 1903')
    expect([ligneDuFilm(null, 1903), ligneDuFilm('  ', 1903)]).toEqual(['gare de 1903', 'gare de 1903'])
    expect([compteDesCoupons(0), compteDesCoupons(1), compteDesCoupons(3)]).toEqual(['aucun coupon', '1 coupon détaché', '3 coupons détachés'])
  })
})

describe('le composteur', () => {
  // Mutations : `billetDeSeance` retiré de `PAGES_1900` (le billet de la foire revient) ; la mention de
  // classe de la maquette (« 1ʳᵉ cl. ») écrite sur le carton ; le titre du carton rendu en ligne (la
  // page perd son titre) ; le tampon posé avant le compostage ; « Le modèle » retiré.
  it('le billet d’une année 1900 est un carton sous son composteur, avec son modèle dessous', async () => {
    const { routes } = serveur()
    monterVoyage(billet(VOL), routes)
    const c = await carton()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(within(c).getByText(M.compagnie)).toBeInTheDocument()
    expect(within(c).getByText('Edwin S. Porter · gare de 1903')).toBeInTheDocument()
    expect(within(c).getByText('N° ····')).toBeInTheDocument()
    expect(within(c).getByText('sans note')).toBeInTheDocument()
    expect(within(c).getByText(datePressee(jourLocal()))).toBeInTheDocument()
    // Ni classe (décision 6), ni tampon avant d'avoir composté.
    expect(c.textContent).not.toMatch(/cl\./)
    expect(tampon()).toBeNull()
    expect(await composter()).toHaveAccessibleName(`${PAGES_1900.mots.billet.valider} ${PAGES_1900.mots.billet.validerSous}`)
    // Le billet de la foire n'y est plus.
    expect(screen.queryByText('Enregistrer un visionnage')).toBeNull()
    expect(screen.queryByRole('button', { name: /Tamponner/ })).toBeNull()
    expect(screen.queryByText('poinçonnez')).toBeNull()
    // Hors correction, ni « Ton billet » ni « Supprimer ».
    expect(screen.queryByText(M.tonBillet)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Supprimer' })).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: `${M.modele} ${M.modeleSous}` })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: M.modeleDit })).toHaveAttribute('src', expect.stringContaining('billets-metro'))
    expect(screen.getByText(M.legende)).toBeInTheDocument()
  })

  // Mutations : `note + 1` dans `trousDuCarton`, ou dans le carton qui l'appelle ; la note du carton
  // prise ailleurs que dans le brouillon ; « sans note » qui laisserait les trous percés ; « sans
  // note » retiré du composteur.
  it('la note se perce sur le carton : un trou par point, et « sans note » les rebouche', async () => {
    const { routes } = serveur()
    monterVoyage(billet(VOL), routes)
    const c = await carton()
    expect(perces(c)).toEqual(trousDuCarton(null))
    fireEvent.click(screen.getByRole('button', { name: '7 sur 10' }))
    expect(perces(c).filter(Boolean)).toHaveLength(7)
    expect(perces(c)).toEqual([true, true, true, true, true, true, true, false, false, false])
    expect(within(c).getByText('7 / 10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '7 sur 10' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '3 sur 10' }))
    expect(perces(c).filter(Boolean)).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: '10 sur 10' }))
    expect(perces(c).filter(Boolean)).toHaveLength(10)
    fireEvent.click(screen.getByRole('button', { name: M.sansNote }))
    expect(perces(c).filter(Boolean)).toHaveLength(0)
    expect(within(c).getByText('sans note')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: M.sansNote })).toHaveAttribute('aria-pressed', 'true')
  })

  // Mutations : la date du carton figée à aujourd'hui ; « ‹ » ou « › » retirés (un geste du billet par
  // défaut perdu) ; « › » offert au-delà d'aujourd'hui ; la date en toutes lettres oubliée.
  it('la date se presse sur la tranche : « Hier », « ‹ », « › » éteinte à aujourd’hui', async () => {
    const { routes } = serveur()
    monterVoyage(billet(VOL), routes)
    const c = await carton()
    const aujourdhui = jourLocal()
    const dateur = within(screen.getByRole('group', { name: 'Date du visionnage' }))
    expect(dateur.getByRole('button', { name: 'Jour suivant' })).toBeDisabled()
    expect(dateur.getByRole('button', { name: M.aujourdhui })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(dateur.getByRole('button', { name: M.hier }))
    expect(within(c).getByText(datePressee(decalerJour(aujourdhui, -1)))).toBeInTheDocument()
    expect(dateur.getByRole('button', { name: M.hier })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(dateur.getByRole('button', { name: 'Jour précédent' }))
    expect(within(c).getByText(datePressee(decalerJour(aujourdhui, -2)))).toBeInTheDocument()
    expect(dateur.getByText(formatDateVisionnage(decalerJour(aujourdhui, -2)))).toBeInTheDocument()
    expect(dateur.getByRole('button', { name: M.hier })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(dateur.getByRole('button', { name: 'Jour suivant' }))
    fireEvent.click(dateur.getByRole('button', { name: 'Jour suivant' }))
    expect(within(c).getByText(datePressee(aujourdhui))).toBeInTheDocument()
    expect(dateur.getByRole('button', { name: 'Jour suivant' })).toBeDisabled()
  })

  // Mutations : le plafond des douze réactions levé dans le composteur ; un coupon qui ne se reprend
  // pas ; la remarque, la note, la date ou les coupons que le composteur n'écrirait pas dans le
  // brouillon ; les coupons envoyés dans l'ordre du toucher.
  it('douze coupons au plus, et le corps envoyé porte la date, la note, les coupons et la remarque', async () => {
    calme()
    const { etat, routes } = serveur()
    monterVoyage(billet(VOL), routes)
    await carton()
    await screen.findByRole('button', { name: new RegExp(CATALOGUE.reactions[0]!.phrase) })
    const coupon = (i: number) => screen.getByRole('button', { name: new RegExp(`${CATALOGUE.reactions[i]!.phrase}$`) })
    expect(CATALOGUE.reactions.length).toBeGreaterThan(12)
    CATALOGUE.reactions.forEach((_, i) => fireEvent.click(coupon(i)))
    expect(screen.getByText(compteDesCoupons(12))).toBeInTheDocument()
    expect(coupon(12)).toHaveAttribute('aria-pressed', 'false')
    // Tous repris, puis deux, choisis à rebours : ils partent dans l'ordre du catalogue.
    for (let i = 0; i < 12; i += 1) fireEvent.click(coupon(i))
    expect(screen.getByText(compteDesCoupons(0))).toBeInTheDocument()
    fireEvent.click(coupon(2))
    fireEvent.click(coupon(0))
    fireEvent.click(screen.getByRole('button', { name: M.hier }))
    fireEvent.click(screen.getByRole('button', { name: '8 sur 10' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Remarque privée' }), { target: { value: '  Le coup de feu vers la salle.  ' } })
    fireEvent.click(await composter())
    expect(await lAnnee()).toBeInTheDocument()
    expect(etat.creations).toBe(1)
    expect(etat.envoye).toEqual({
      media_id: exemple<{ media: { id: string } }>('/media', 'post', 201).media.id,
      finished_at: decalerJour(jourLocal(), -1),
      rating: 8,
      reactions: [CATALOGUE.reactions[0]!.cle, CATALOGUE.reactions[2]!.cle],
      comment: 'Le coup de feu vers la salle.',
    })
  })

  /** Le geste tenté comme un navigateur le livrerait : jsdom donne le focus à un élément inerte, un navigateur non. */
  const prendLeFocus = (e: HTMLElement) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    if (!e.closest('[inert]')) e.focus()
    return document.activeElement === e
  }

  // Mutations : une étape sans son geste (`pose: null`) ; le tampon posé dès que le carton est avalé ;
  // le numéro qui ne viendrait pas du casier de la décennie (« N° 0004 », le film de 1897 compté) ;
  // le formulaire resté vivant sous le compostage (`INERTE` retiré) ; `support` non posé (rien n'est
  // amené à l'écran).
  it('le composteur avale le carton, le frappe, le rend, le numéro roule, le carton part, puis l’année', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const vibrate = vibreur()
    const amener = vi.fn()
    Object.defineProperty(Element.prototype, 'scrollIntoView', { value: amener, configurable: true, writable: true })
    const { etat, routes } = serveur({ boite: CASIER })
    monterVoyage(billet(VOL), routes)
    const c = await carton()
    fireEvent.click(screen.getByRole('button', { name: '7 sur 10' }))
    const remarque = screen.getByRole('textbox', { name: 'Remarque privée' })
    expect(prendLeFocus(remarque)).toBe(true)
    fireEvent.click(await composter())
    await waitFor(() => expect(c).toHaveAttribute('data-geste', 'avale'))
    expect(tampon()).toBeNull()
    expect(amener).toHaveBeenCalled()
    expect(vibrate).not.toHaveBeenCalled()
    // Sous le composteur, rien du formulaire ne répond.
    expect(prendLeFocus(remarque)).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '2 sur 10' }))
    expect(perces(c).filter(Boolean)).toHaveLength(7)
    await vi.advanceTimersByTimeAsync(FRAPPE.descend + 10)
    expect(c).toHaveAttribute('data-geste', 'frappe')
    expect(tampon()).toHaveAccessibleName(`VU : ${PAGES_1900.mots.billet.tamponAutour} ${formatDateVisionnage(jourLocal())}`)
    expect(vibrate).toHaveBeenCalledWith(VIBRATION)
    expect(within(c).getByText('N° ····')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(FRAPPE.pause)
    expect(c).toHaveAttribute('data-geste', 'rendu')
    await vi.advanceTimersByTimeAsync(FRAPPE.remonte + FRAPPE.tirage * 3)
    // Le numéro roule : ni l'attente, ni le numéro ; le carton est rendu, tamponné.
    expect(c).not.toHaveAttribute('data-geste')
    expect(within(c).queryByText('N° ····')).toBeNull()
    expect(within(c).queryByText('N° 0003')).toBeNull()
    await vi.advanceTimersByTimeAsync(FRAPPE.tirage * FRAPPE.tirages)
    expect(within(c).getByText('N° 0003')).toBeInTheDocument()
    expect(tampon()).not.toBeNull()
    expect(screen.queryByRole('region', { name: 'L’année 1903' })).toBeNull()
    await vi.advanceTimersByTimeAsync(FRAPPE.avantTalon)
    expect(c).toHaveAttribute('data-geste', 'part')
    expect(screen.queryByRole('region', { name: 'L’année 1903' })).toBeNull()
    await vi.advanceTimersByTimeAsync(FRAPPE.talon)
    expect(await lAnnee()).toBeInTheDocument()
    expect(etat.creations).toBe(1)
    expect(etat.envoye).toMatchObject({ rating: 7 })
  })

  // La garde reste à la page (`CLAUDE.md` : « une séquence lancée d'un rappel de `mutate` vérifie que
  // la page est montée ») ; le composteur n'y change rien. Mutations : la garde « montée » retirée de
  // `tamponner` ; sa dernière lecture seule retirée (parti pendant que le carton part).
  it.each([
    ['le composteur frappe', FRAPPE.pause / 2],
    ['le carton part', FRAPPE.pause + FRAPPE.remonte + FRAPPE.tirage * FRAPPE.tirages + FRAPPE.avantTalon + FRAPPE.talon / 2],
  ] as const)('ne ramène pas à l’année un membre parti pendant que %s', async (_moment, apres) => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { routes } = serveur({ boite: CASIER })
    monterVoyage([`/voyage/1903/films/${VOL.id}`, billet(VOL)], { ...routes, 'GET /api/reference/films/5698/realisateurs': () => json({ realisateurs: [] }) })
    await carton()
    fireEvent.click(await composter())
    await waitFor(() => expect(tampon()).not.toBeNull())
    await vi.advanceTimersByTimeAsync(apres)
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
    // La fiche du film : sa fausse voiture, que le billet n'a pas.
    expect(await screen.findByRole('img', { name: libelleDeLaVoiture(VOL.title) })).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(DUREE_DU_COMPOSTAGE)
    expect(screen.getByRole('img', { name: libelleDeLaVoiture(VOL.title) })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'L’année 1903' })).toBeNull()
  })

  // Mutations : `calme` ignoré dans le carton (la confetti tombe, `data-vivante` reste à « oui ») ou
  // dans le composteur ; la confetti lâchée pour tous les trous, ou pour aucun.
  it('au calme, rien ne bouge : ni confetti, ni compostage, et l’année revient aussitôt ; sinon un trou percé lâche la sienne', async () => {
    const { routes } = serveur({ boite: CASIER })
    const vue = monterVoyage(billet(VOL), routes)
    let c = await carton()
    expect(c).toHaveAttribute('data-vivante', 'oui')
    expect(screen.getByRole('group', { name: 'Date du visionnage' }).closest('[data-vivante]')).toHaveAttribute('data-vivante', 'oui')
    expect(c.querySelectorAll('[data-perce] > *')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: '3 sur 10' }))
    expect(c.querySelectorAll('[data-perce] > *')).toHaveLength(3)
    // De trois à cinq : seuls les deux trous neufs.
    fireEvent.click(screen.getByRole('button', { name: '5 sur 10' }))
    expect(c.querySelectorAll('[data-perce] > *')).toHaveLength(2)
    expect(c.querySelectorAll('[data-neuf="oui"]')).toHaveLength(2)
    vue.unmount()

    calme()
    const vibrate = vibreur()
    monterVoyage(billet(VOL), routes)
    c = await carton()
    expect(c).toHaveAttribute('data-vivante', 'non')
    expect(screen.getByRole('group', { name: 'Date du visionnage' }).closest('[data-vivante]')).toHaveAttribute('data-vivante', 'non')
    fireEvent.click(screen.getByRole('button', { name: '8 sur 10' }))
    expect(perces(c).filter(Boolean)).toHaveLength(8)
    expect(c.querySelectorAll('[data-perce] > *')).toHaveLength(0)
    fireEvent.click(await composter())
    expect(await lAnnee()).toBeInTheDocument()
    expect(vibrate).not.toHaveBeenCalled()
  })

  // Mutations : le refus de l'API que le composteur ne montrerait plus ; le formulaire resté inerte
  // après lui.
  it('un refus s’affiche tel que l’API l’a écrit, et le carton se recomposte', async () => {
    const { etat, routes } = serveur({ journal: () => json({ code: 'CONFLICT', message: 'Déjà noté aujourd’hui.', retryable: false }, 409) })
    monterVoyage(billet(VOL), routes)
    const c = await carton()
    fireEvent.click(await composter())
    expect(await screen.findByRole('alert')).toHaveTextContent('Déjà noté aujourd’hui.')
    expect(c).not.toHaveAttribute('data-geste')
    expect(tampon()).toBeNull()
    expect(prendLeFocus(screen.getByRole('textbox', { name: 'Remarque privée' }))).toBe(true)
    fireEvent.click(await composter())
    await waitFor(() => expect(etat.creations).toBe(2))
  })

  // Mutation : la panne des réactions que le composteur ne dirait plus, ou sans son « Réessayer ».
  it('dit la panne des réactions dans le formulaire, et « Réessayer » les relit', async () => {
    const { routes } = serveur()
    let essais = 0
    monterVoyage(billet(VOL), { ...routes, [REACTIONS]: () => ((essais += 1) === 1 ? json({ code: 'INTERNAL', message: 'Les réactions ne répondent pas.', retryable: false }, 500) : json(CATALOGUE)) })
    await carton()
    expect(await screen.findByText('Les réactions ne répondent pas.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('button', { name: new RegExp(`${CATALOGUE.reactions[0]!.phrase}$`) })).toBeInTheDocument()
  })
})

describe('le billet Edmondson, en correction', () => {
  const corriger = (routes: Record<string, (init: RequestInit) => Response | Promise<Response>>) =>
    monterVoyage([`/voyage/1903/films/${FEES.id}`, { pathname: billet(FEES, '/corriger'), state: { item: feesVu() } }], {
      ...routes,
      'GET /api/reference/films/775/realisateurs': () => json({ realisateurs: [] }),
      'GET /api/me/journal?limit=20': () => json({ ...PAGE, items: [], next_cursor: null }),
    })

  // Mutations : le tampon retiré d'un billet déjà composté ; le numéro pris dans tout le journal
  // (« N° 0003 ») ; le compostage joué en correction (l'année n'arriverait qu'après lui) ; le mot de
  // la correction pris au bouton du compostage ; « Ton billet » montré hors correction (test plus haut).
  it('le carton est déjà tamponné, dit son numéro en tête, part de l’entrée, et corriger ne composte rien', async () => {
    const vibrate = vibreur()
    const { routes } = serveur({ boite: [vu('e-c', 1905, '2026-09-15'), feesVu(), vu('e-x', 1897, '2026-08-20'), vu('e-a', 1900, '2026-08-01')] })
    let patch: Record<string, unknown> | null = null
    corriger({
      ...routes,
      'PATCH /api/me/journal/e-fees': (init) => {
        patch = JSON.parse(String(init.body)) as Record<string, unknown>
        return json(feesVu())
      },
    })
    const c = await carton(FEES.title)
    expect(await within(c).findByText('N° 0002')).toBeInTheDocument()
    expect(within(c).getByText('Georges Méliès · gare de 1903')).toBeInTheDocument()
    expect(within(c).getByText('9 / 10')).toBeInTheDocument()
    expect(perces(c).filter(Boolean)).toHaveLength(9)
    expect(within(c).getByText(datePressee('2026-09-01'))).toBeInTheDocument()
    expect(within(c).getByRole('img', { name: `VU : ${PAGES_1900.mots.billet.tamponAutour} ${formatDateVisionnage('2026-09-01')}` })).toBeInTheDocument()
    expect(screen.getByText(M.tonBillet)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Remarque privée' })).toHaveValue('Une remarque privée, rien qu’à moi.')
    expect(screen.queryByRole('button', { name: /^Composter le billet/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '6 sur 10' }))
    const bouton = screen.getByRole('button', { name: `${M.corriger} ${M.corrigerSous}` })
    fireEvent.click(bouton)
    // Hors du calme, et pourtant sans attendre : rien ne se joue.
    expect(await lAnnee()).toBeInTheDocument()
    expect(patch).toEqual({ rating: 6 })
    expect(vibrate).not.toHaveBeenCalled()
  })

  // Mutation : la suppression que la page lui passe, non rendue par le composteur.
  it('« Supprimer » reste offert sous le bouton, avec sa confirmation', async () => {
    const { routes } = serveur({ boite: [feesVu()] })
    let effacements = 0
    corriger({ ...routes, 'DELETE /api/me/journal/e-fees': () => ((effacements += 1), new Response(null, { status: 204 })) })
    await carton(FEES.title)
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(screen.getByText(/Supprimer ce visionnage \?/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByRole('img', { name: libelleDeLaVoiture(FEES.title) })).toBeInTheDocument()
    expect(effacements).toBe(1)
  })

  // Le poinçon doré du contrôleur attend son lot (plan des pages 1900, brief 6, « laisse de côté »).
  // Mutation : l'élément de la maquette porté tel quel dans le carton
  // (`<span class="poincon-or" aria-hidden="true"><svg viewBox="-10 -10 20 20">…</svg></span>`).
  it('ne porte aucun poinçon doré, composté ou non', async () => {
    const { routes } = serveur({ boite: [feesVu()] })
    const vue = corriger(routes)
    const sansPoincon = (c: HTMLElement) => {
      expect(c.querySelector('svg')).toBeNull()
      expect([...c.querySelectorAll('*')].filter((e) => /poincon|dor/i.test(e.getAttribute('class') ?? ''))).toEqual([])
      // Tout ce que le carton cache au lecteur d'écran : la date pressée et les dix places.
      expect([...c.querySelectorAll('[aria-hidden="true"]')].map((e) => e.textContent)).toEqual([datePressee('2026-09-01'), ''])
    }
    const composte = await carton(FEES.title)
    expect(within(composte).getByRole('img', { name: /^VU : / })).toBeInTheDocument()
    sansPoincon(composte)
    vue.unmount()
    monterVoyage(billet(FEES), routes)
    const neuf = await carton(FEES.title)
    fireEvent.click(screen.getByRole('button', { name: 'Hier' }))
    fireEvent.click(screen.getByRole('button', { name: 'Jour précédent' }))
    expect(neuf.querySelector('svg')).toBeNull()
    expect([...neuf.querySelectorAll('[aria-hidden="true"]')]).toHaveLength(2)
  })
})

describe('les durées du carton', () => {
  const CSS = FEUILLE_DU_CARTON.replace(/\/\*[\s\S]*?\*\//g, '')
  /** La durée d'une animation nommée, en millisecondes, telle que la feuille la joue au tempo. */
  const duree = (nom: string) => {
    const m = new RegExp(`animation:\\s*${nom}\\s+calc\\(\\s*(\\d+)ms\\s*\\*\\s*var\\(--tempo\\)\\s*\\)`).exec(CSS)
    return m ? Number(m[1]) * TEMPO : Number.NaN
  }
  /** Le sélecteur de la règle qui lance une animation. */
  const selecteur = (nom: string) => {
    const i = CSS.search(new RegExp(`animation:\\s*${nom}\\s`))
    return i < 0 ? '' : CSS.slice(CSS.lastIndexOf('}', i) + 1, CSS.lastIndexOf('{', i))
  }

  // Le jumeau de `voyage/billet.test.ts` : la page attend `FRAPPE`, la feuille du carton joue ses
  // propres durées. Mutations : `avale calc(300ms …)`, `rendu` ou `part` changés dans la feuille
  // seulement (une durée en dur, `360ms`, rougit `voyage/tempo.test.ts`).
  it('le carton joue les durées que la page attend', () => {
    expect(duree('avale')).toBe(FRAPPE.descend)
    expect(duree('rendu')).toBe(FRAPPE.remonte)
    expect(duree('part')).toBe(FRAPPE.talon)
  })

  // La frappe du tampon dure plus que la pause : sa règle doit tenir quand le composteur rend le
  // carton, sans quoi elle s'arrêterait net. Mutations : la règle réduite au geste `frappe` ; la
  // frappe allongée au-delà de la pause et de la remontée.
  it('la frappe du tampon n’est pas coupée quand le composteur rend le carton', () => {
    expect(selecteur('frappe')).toMatch(/'frappe'/)
    expect(selecteur('frappe')).toMatch(/'rendu'/)
    expect(duree('frappe')).toBeLessThanOrEqual(FRAPPE.pause + FRAPPE.remonte)
  })
})
