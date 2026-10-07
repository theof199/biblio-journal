import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { AnneeCarte } from '../../../api/voyage'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { fichePrete, filmDeSalle, salle, voyage1890 } from '../../../test/voyage'
import { A_L_AFFICHE } from '../../../voyage/catalogue'
import { LES_FILMS_DU_CATALOGUE, LE_CATALOGUE_SE_CHARGE, phraseDesPannes } from '../../../voyage/recherche/lisible'
import { numeroDeLaSalle } from '../../../voyage/salles'
import { PAGES_1900 } from '../pages'
import { ENTRE_DEUX_REGLETTES, ENTRE_LE_NOM_ET_L_ETAT, MOTS_DU_GUICHET as M, REGLETTES_ECHELONNEES, frontonDuGuichet } from './guichet'
import styles from './Guichet.module.css'

/**
 * Le guichet des années 1900 (plan des pages 1900, brief 9) : la recherche du Voyage à une grille de
 * laiton, la réponse sur un tableau des départs. La page se monte dans l'app entière, le monde n'y
 * arrive que par le registre ; elle garde ses lectures, la saisie, sa mémoire et le champ au doigt.
 * Les tests de `pages/VoyageRecherche.test.tsx`, montés sur 1890, tiennent le défaut.
 */
const m = PAGES_1900.mots
const ANNEES: Partial<AnneeCarte>[] = [
  { annee: 1901, statut: 'ouverte', visitee: true, recompense: 'ours' },
  { annee: 1902, statut: 'ouverte', visitee: true, recompense: null },
  { annee: 1903, statut: 'en_cours', visitee: true, recompense: null },
  // Écrite, jamais ouverte : la lire enfilerait son ouverture chez le chroniqueur.
  { annee: 1904, statut: 'ouverte', visitee: false, recompense: null },
  { annee: 1905, statut: 'verrouillee', visitee: false, recompense: null },
]
const VOYAGE = voyage1890(1903, ANNEES, { ia: true, source: null, rattrape_la_source: false, depart: 1895 })

const SWALLOW = filmDeSalle({ id: 'f-swallow', tmdb_id: 11, title: 'The Big Swallow', realisateur: 'James Williamson', etat: 'a_demander' })
const LUNE = filmDeSalle({ id: 'f-lune', tmdb_id: 12, title: 'Le Voyage dans la Lune', realisateur: 'Georges Méliès', etat: 'vu', note: 8 })
const FEES = filmDeSalle({ id: 'f-fees', tmdb_id: 13, title: 'Le Royaume des fées', realisateur: 'Georges Méliès', etat: 'sur_le_plex' })
const ROBBERY = filmDeSalle({ id: 'f-rob', tmdb_id: 14, title: 'The Great Train Robbery', realisateur: 'Edwin S. Porter', etat: 'introuvable' })
const VUES = filmDeSalle({
  id: 'f-vues',
  tmdb_id: 15,
  title: 'Trois vues Lumière',
  realisateur: 'Louis Lumière',
  etat: 'demande',
  programme: { duree_min: 2, bobines: [{ tmdb_id: 16, title: 'Le Repas de bébé', duree_min: 1, cover_url: null, plex_url: null, etat: 'vu' }] },
})
// Les rangs ne suivent pas l'ordre de la réponse, et aucune première salle n'a le rang 1 : la voie
// d'un départ ne peut pas se confondre avec la place de sa salle.
const S1901 = salle({ id: 's-01', rang: 4, cle: 'essentiels', films: [SWALLOW] })
const S1902 = salle({ id: 's-02', rang: 2, cle: 'essentiels', films: [LUNE] })
const S1903A = salle({ id: 's-03a', rang: 6, cle: 'essentiels', films: [ROBBERY, VUES] })
const S1903B = salle({ id: 's-03b', rang: 3, cle: null, films: [FEES] })
const FICHE = (a: number) => `GET /api/me/voyage/annees/${a}`
const CARTE = 'GET /api/me/voyage'
const ROUTES = {
  [CARTE]: () => json(VOYAGE),
  [FICHE(1901)]: () => json(fichePrete({ annee: 1901, salles: [S1901] })),
  [FICHE(1902)]: () => json(fichePrete({ annee: 1902, salles: [S1902] })),
  [FICHE(1903)]: () => json(fichePrete({ annee: 1903, salles: [S1903A, S1903B] })),
}
const PAGE = '/voyage/decennies/1900/recherche'

const champ = () => screen.getByRole('searchbox', { name: m.recherche.champ })
const taper = (texte: string) => fireEvent.change(champ(), { target: { value: texte } })
const lu = async () => {
  await screen.findByRole('heading', { level: 1, name: m.recherche.catalogue })
  await waitFor(() => expect(screen.queryByText(LE_CATALOGUE_SE_CHARGE)).not.toBeInTheDocument())
}
const tableau = () => screen.getByRole('list', { name: LES_FILMS_DU_CATALOGUE })
const departs = () => within(tableau()).getAllByRole('link')
/** Un départ en trois cases : l'année, le film (son titre, puis ce qui se dit dessous), la voie. */
const cases = (d: HTMLElement) => [...d.children].map((c) => c.textContent)
const tout = () => departs().map(cases)
const annee = (a: number) => within(screen.getByRole('group', { name: M.annees })).getByRole('button', { name: String(a) })
const calme = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.sessionStorage.clear()
})

describe('les mots du guichet', () => {
  // Les mots de l'écran 11 de la maquette. Mutations : « Chercher partout », repris du monde « à
  // venir » ; le fronton qui s'arrête à la décennie.
  it('parle comme la maquette', () => {
    expect([m.recherche.champ, m.recherche.catalogue, m.recherche.vide, m.recherche.partout]).toEqual(['Quel film ?', 'Le guichet', 'Aucun départ pour ce nom. Essayez un réalisateur.', 'Chercher hors du Voyage'])
    expect(frontonDuGuichet(1900)).toBe('Billets · 1900 à 1909')
    expect([M.annee, M.film, M.voie]).toEqual(['Année', 'Film', 'Voie'])
  })
})

describe('le tableau des départs', () => {
  // La voie d'un départ est le numéro que la fiche d'année donne à sa salle (`numeroDeLaSalle`), jamais
  // un rang recompté : ni la place de la salle dans la réponse, ni celle du départ dans le tableau.
  // Mutations : `{i + 1}` à la place de `vue.voie` dans la réglette ; un numéro recalculé dans
  // `catalogue.ts` (la place de la salle) ; l'année retirée ; l'en-tête des colonnes lu lui aussi.
  it('donne à chaque départ son année, son film et la voie de sa salle, celle de la fiche d’année', async () => {
    monterVoyage(PAGE, ROUTES)
    await lu()
    fireEvent.click(annee(1903))
    await waitFor(() => expect(departs()).toHaveLength(4))
    const voie = (s: { rang: number }) => `${M.voie} ${numeroDeLaSalle(s)}`
    expect(tout().map(([an, film, v]) => [an, film!.split(' ')[0], v])).toEqual([
      ['1903', 'The', voie(S1903A)],
      ['1903', 'Trois', voie(S1903A)],
      ['1903', 'Le', voie(S1903A)],
      ['1903', 'Le', voie(S1903B)],
    ])
    expect([voie(S1903A), voie(S1903B)]).toEqual(['Voie 6', 'Voie 3'])
    fireEvent.click(annee(1903))
    taper('swallow')
    await waitFor(() => expect(tout()).toEqual([['1901', `The Big Swallow James Williamson${ENTRE_LE_NOM_ET_L_ETAT}à demander`, 'Voie 4']]))
    // L'en-tête des colonnes ne se lit pas deux fois : la voie se nomme dans sa case.
    expect(screen.getByText(M.film).parentElement).toHaveAttribute('aria-hidden', 'true')
  })

  // Une bobine n'a pas de réalisateur au contrat : son état se dit seul. Mutation : le séparateur
  // inconditionnel (« — vu » sous « Le Repas de bébé »).
  it('ne pose aucun tiret sous une bobine sans réalisateur', async () => {
    monterVoyage(PAGE, ROUTES)
    await lu()
    taper('repas')
    await waitFor(() => expect(departs()).toHaveLength(1))
    const [, film] = cases(departs()[0]!)
    expect(film).toBe('Le Repas de bébé vu')
    expect(film).not.toContain(ENTRE_LE_NOM_ET_L_ETAT.trim())
    // Son programme, lui, a son réalisateur, et le tiret.
    taper('trois vues')
    await waitFor(() => expect(cases(departs()[0]!)[1]).toBe(`Trois vues Lumière Louis Lumière${ENTRE_LE_NOM_ET_L_ETAT}demandé`))
  })

  // Mutations : le titre ou le réalisateur écrits tels quels (`{vue.titre}`) ; l'état écrit par sa clé.
  it('souligne le passage trouvé, dans le titre comme sous lui, et dit l’état et la note', async () => {
    monterVoyage(PAGE, ROUTES)
    await lu()
    taper('melies')
    await waitFor(() => expect(departs()).toHaveLength(2))
    expect(tout().map(([, film]) => film)).toEqual([`Le Voyage dans la Lune Georges Méliès${ENTRE_LE_NOM_ET_L_ETAT}vu · ★ 8`, `Le Royaume des fées Georges Méliès${ENTRE_LE_NOM_ET_L_ETAT}sur ton Plex`])
    for (const d of departs()) expect([...d.querySelectorAll('mark')].map((x) => x.textContent)).toEqual(['Méliès'])
    taper('royaume des fee')
    await waitFor(() => expect(departs()).toHaveLength(1))
    expect([...departs()[0]!.querySelectorAll('mark')].map((x) => x.textContent)).toEqual(['Royaume des fée'])
    taper('robbery')
    await waitFor(() => expect(cases(departs()[0]!)[1]).toBe(`The Great Train Robbery Edwin S. Porter${ENTRE_LE_NOM_ET_L_ETAT}${m.introuvable}`))
  })

  // Un départ ouvre la fiche du film, celle de son programme pour une bobine. Mutation : le lien vers
  // `vue.tmdbId`.
  it('un départ mène à la fiche de son film, une bobine à celle de son programme', async () => {
    monterVoyage(PAGE, ROUTES)
    await lu()
    taper('repas')
    await waitFor(() => expect(departs()).toHaveLength(1))
    expect(departs()[0]).toHaveAttribute('href', '/voyage/1903/films/f-vues')
  })

  // Sans saisie, « les plus demandées » : les essentiels pas vus, six au plus, sous le mot du monde ;
  // dès qu'on cherche, le compte. Mutations : `m.recherche.affiche` dit en cherchant ; le compte tu ;
  // les années qui ne se cochent plus (`aria-pressed` figé, `onBasculer` oublié).
  it('sans saisie montre les plus demandées, six au plus, et filtre par années', async () => {
    const beaucoup = Array.from({ length: A_L_AFFICHE + 3 }, (_, i) => filmDeSalle({ id: `f-${i}`, tmdb_id: 100 + i, title: `Vue ${i}`, realisateur: 'Anonyme', etat: 'a_demander' }))
    monterVoyage(PAGE, { ...ROUTES, [FICHE(1902)]: () => json(fichePrete({ annee: 1902, salles: [salle({ id: 's-02', rang: 2, cle: 'essentiels', films: beaucoup })] })) })
    await lu()
    expect(screen.getByText(m.recherche.affiche)).toBeInTheDocument()
    expect(departs()).toHaveLength(A_L_AFFICHE)
    // Les années prêtes, et elles seules : ni 1904, jamais ouverte, ni 1905, verrouillée.
    expect(within(screen.getByRole('group', { name: M.annees })).getAllByRole('button').map((b) => `${b.textContent}:${b.getAttribute('aria-pressed')}`)).toEqual(['1901:false', '1902:false', '1903:false'])
    fireEvent.click(annee(1901))
    await waitFor(() => expect(tout()).toEqual([['1901', `The Big Swallow James Williamson${ENTRE_LE_NOM_ET_L_ETAT}à demander`, 'Voie 4']]))
    expect(annee(1901)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1 résultat')).toBeInTheDocument()
    expect(screen.queryByText(m.recherche.affiche)).toBeNull()
  })

  // Mutations : la phrase du vide retirée, ou dite pendant la lecture ; la panne d'une année tue ;
  // l'attente tue ; l'en-tête des colonnes montré sur un tableau vide.
  it('dit l’attente, la panne d’une année et le départ introuvable, sans en-tête sur un tableau vide', async () => {
    let lire: (r: Response) => void = () => undefined
    const routes = {
      ...ROUTES,
      [FICHE(1901)]: () => json({ code: 'VALIDATION', message: 'La fiche s’est égarée.', retryable: false }, 400),
      [FICHE(1903)]: () => new Promise<Response>((resolve) => (lire = resolve)),
    }
    monterVoyage(PAGE, routes)
    await screen.findByRole('heading', { level: 1, name: m.recherche.catalogue })
    expect(await screen.findByRole('status')).toHaveTextContent(LE_CATALOGUE_SE_CHARGE)
    taper('zzz')
    await waitFor(() => expect(screen.getByText('0 résultat')).toBeInTheDocument())
    expect(screen.queryByText(m.recherche.vide)).toBeNull()
    await act(async () => lire(json(fichePrete({ annee: 1903, salles: [S1903A, S1903B] }))))
    expect(await screen.findByText(m.recherche.vide)).toBeInTheDocument()
    expect(screen.queryByText(LE_CATALOGUE_SE_CHARGE)).toBeNull()
    expect(screen.queryByText(M.film)).toBeNull()
    expect(screen.queryByRole('list', { name: LES_FILMS_DU_CATALOGUE })).toBeNull()
    expect(screen.getByText(phraseDesPannes(1))).toBeInTheDocument()
    taper('lune')
    await waitFor(() => expect(departs()).toHaveLength(1))
  })

  // Le tableau ne lit rien : la page ne lit que la carte et les fiches déjà écrites et ouvertes (1904,
  // écrite et jamais ouverte, ne l'est pas), et rien ne part à la frappe. Le compte est celui du guichet
  // par défaut (`pages/VoyageRecherche.test.tsx`, où `anneesDuCatalogue` contourné rougit).
  it('ne fait partir aucune requête de plus que le guichet par défaut, ni à la frappe', async () => {
    const { requetes } = monterVoyage(PAGE, ROUTES)
    await lu()
    for (const mot of ['m', 'me', 'mel', 'melies']) taper(mot)
    await waitFor(() => expect(departs()).toHaveLength(2))
    fireEvent.click(annee(1902))
    await waitFor(() => expect(departs()).toHaveLength(1))
    await new Promise((fin) => setTimeout(fin, 50))
    expect(requetes.filter((r) => r !== 'GET /api/auth/me').sort()).toEqual([CARTE, FICHE(1901), FICHE(1902), FICHE(1903)].sort())
  })
})

describe('la grille du guichet', () => {
  // La tête est celle de l'écran 11 : ni toile, ni enseigne du défaut. Le titre de la page reste le
  // seul de niveau 1. Mutations : `Grille` retirée de `PAGES_1900.gabarits` ; le fronton en dur ;
  // l'étiquette retirée ; le retour que la tête ne poserait plus.
  it('porte le fronton de la décennie, l’étiquette du champ et le retour de la page', async () => {
    monterVoyage(['/voyage/decennies/1900', PAGE], { ...ROUTES, 'GET /api/me/journal?limit=100&sortie_min=1900&sortie_max=1909': () => json({ items: [], next_cursor: null }), 'GET /api/me/voyage/tickets': () => json({ tickets: [] }) })
    await lu()
    expect(screen.getByText(frontonDuGuichet(1900))).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Le guichet des années 1900.' })).toBeNull()
    expect(screen.queryByText('Guichet')).toBeNull()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByLabelText(m.recherche.champ, { selector: 'input' })).toBe(champ())
    expect(screen.getByText(m.recherche.champ, { selector: 'label' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: m.recherche.partout })).toHaveAttribute('href', '/recherche')
    expect(screen.getByRole('link', { name: 'Retour aux années 1900' })).toHaveAttribute('href', '/voyage/decennies/1900')
  })

  // Le champ garde son comportement au doigt : c'est la tablette qui monte au-dessus du clavier, une
  // fois, et la page lui fait la place de ce qui tient au-dessus d'elle. Mutations : le formulaire de
  // la page posé ailleurs que sur la tablette, ou pas du tout ; `onFocus` ou `onBlur` avalés par la
  // tête ; `onChange` avalé (la saisie figée).
  it('la tablette monte au-dessus du clavier quand le champ prend le doigt, et la saisie reste à la page', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(pointer: coarse)', media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
    const amener = vi.fn()
    Object.defineProperty(Element.prototype, 'scrollIntoView', { value: amener, configurable: true, writable: true })
    try {
      monterVoyage(PAGE, ROUTES)
      await lu()
      fireEvent.focus(champ())
      taper('lu')
      taper('lune')
      await waitFor(() => expect(departs()).toHaveLength(1))
      expect(champ()).toHaveValue('lune')
      expect(amener).toHaveBeenCalledTimes(1)
      const tablette = screen.getByRole('search')
      expect(amener.mock.contexts[0]).toBe(tablette)
      expect(tablette).toContainElement(champ())
      expect(tablette).toHaveClass(styles.tablette!)
      expect(screen.getByTestId('place-du-clavier')).toHaveStyle({ height: `${PAGES_1900.hauteurs.guichet}px` })
      fireEvent.blur(champ())
      expect(screen.queryByTestId('place-du-clavier')).not.toBeInTheDocument()
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
    }
  })

  const buste = () => document.querySelector(`.${styles.buste!}`)!
  const racines = () => [...document.querySelectorAll('[data-vivante]')].filter((e) => e.matches(`.${styles.tete!}, .${styles.racine!}`))

  // L'employé hoche la tête à chaque lettre, les réglettes glissent l'une après l'autre, les dernières
  // ensemble. Mutations : le hochement jamais rejoué (la clé retirée) ; l'écart en dur, ou sans plafond.
  it('l’employé hoche la tête à chaque lettre et les réglettes glissent, échelonnées', async () => {
    const beaucoup = Array.from({ length: REGLETTES_ECHELONNEES + 3 }, (_, i) => filmDeSalle({ id: `f-${i}`, tmdb_id: 100 + i, title: `Zootrope ${i}`, realisateur: 'Anonyme', etat: 'a_demander' }))
    monterVoyage(PAGE, { ...ROUTES, [FICHE(1902)]: () => json(fichePrete({ annee: 1902, salles: [salle({ id: 's-02', rang: 2, cle: null, films: beaucoup })] })) })
    await lu()
    expect(racines().map((r) => r.getAttribute('data-vivante'))).toEqual(['oui', 'oui'])
    for (const r of racines()) expect((r as HTMLElement).style.getPropertyValue('--tempo')).not.toBe('')
    expect(buste()).not.toHaveAttribute('data-ecoute')
    const avant = buste()
    taper('z')
    expect(buste()).toHaveAttribute('data-ecoute', 'oui')
    const apres = buste()
    expect(apres).not.toBe(avant)
    taper('zo')
    expect(buste()).not.toBe(apres)
    await waitFor(() => expect(departs()).toHaveLength(beaucoup.length))
    const ecarts = within(tableau()).getAllByRole('listitem').map((li) => li.style.animationDelay)
    expect(ecarts).toEqual(beaucoup.map((_, i) => `${Math.min(i, REGLETTES_ECHELONNEES) * ENTRE_DEUX_REGLETTES}ms`))
    expect(ecarts[REGLETTES_ECHELONNEES + 2]).toBe(ecarts[REGLETTES_ECHELONNEES])
  })

  // Mutations : `data-vivante` posé sans regarder le calme, sur la tête ou sur le tableau ; le
  // hochement compté au calme ; l'écart posé au calme.
  it('au calme, rien ne bouge : ni l’employé, ni les réglettes', async () => {
    calme()
    monterVoyage(PAGE, ROUTES)
    await lu()
    expect(racines().map((r) => r.getAttribute('data-vivante'))).toEqual(['non', 'non'])
    const avant = buste()
    taper('melies')
    await waitFor(() => expect(departs()).toHaveLength(2))
    expect(buste()).toBe(avant)
    expect(buste()).not.toHaveAttribute('data-ecoute')
    expect(within(tableau()).getAllByRole('listitem').map((li) => li.style.animationDelay)).toEqual(['', ''])
  })
})
