import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { createQueryClient } from '../../api/queryClient'
import type { FichePrete, Voyage } from '../../api/voyage'
import { creerRegistre } from '../../mondes'
import type { GabaritsDesPages, Monde } from '../../mondes/types'
import { json, servir } from '../../test/serveur'
import { annee, fichePrete, filmDeSalle, salle, voyage1890 } from '../../test/voyage'
import { arriveesDeLAnnee } from '../annee'
import type { PropsFeteDuBadge } from './BadgeColle'
import Celebrations from './Celebrations'
import type { PropsFeteDeLAnnee } from './DessinDeLAnnee'
import type { PropsFeteDeLaRecompense } from './DessinDeLaRecompense'
import type { PropsFeteDeLaSalle } from './DessinDeLaSalle'
import { ANNEE, BADGE, PAS_DE_L_ANNEE, RECOMPENSE, SALLE } from './deroule'
import { arriveesFetees, recompensesDAvant, salleFetee } from './lues'
import type { Scene } from './scenes'

// Le dessin de chaque fête est une section qu'un monde peut composer (`GabaritsDesPages` :
// `feteDeLaSalle`, `feteDeLaRecompense`, `feteDeLAnnee`). Sans gabarit, le défaut reste : tous les
// tests de `Celebrations.test.tsx`, que ce fichier ne retouche pas. Le monde de test est 1890, auquel
// on prête des dessins qui disent ce qu'ils reçoivent.
const MONDE = creerRegistre()(1890)
const preter = (gabarits: Partial<GabaritsDesPages>): Monde => ({ ...MONDE, pages: { ...MONDE.pages, gabarits } })
const somme = (durees: readonly number[]) => durees.reduce((a, b) => a + b, 0)
const passer = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
const calme = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

const ticket = (a: number) => ({ annee: a, motif: `Vers ${a}.`, emis_le: '2026-09-21T21:00:00.000Z', montre_le: null, utilise_le: null })
// Dans la réponse, la salle de rang 5 vient avant celle de rang 2 : un numéro n'est pas une place.
const CINQ = salle({ id: 's-cinq', rang: 5, nom: 'La cinquième', films: [filmDeSalle({ id: 'f1', tmdb_id: 1, title: 'Le premier', cover_url: '/a.jpg', etat: 'vu' }), filmDeSalle({ id: 'f2', tmdb_id: 2, title: 'Le second', cover_url: null, etat: 'vu' })] })
const DEUX = salle({ id: 's-deux', rang: 2, nom: 'La deuxième', films: [filmDeSalle({ id: 'f3', tmdb_id: 3, etat: 'a_demander' })] })
const ESSENTIELS = salle({ id: 's-ess', rang: 1, cle: 'essentiels', nom: 'Les essentiels', films: [filmDeSalle({ id: 'f4', tmdb_id: 4, etat: 'vu' })] })
const PROGRESSION = { essentiels_vus: 1, essentiels_total: 1, salles_completes: 1, salles_autres: 2 }
const FICHE = fichePrete({ annee: 1896, profondeur: 4, progression: PROGRESSION, recompense: 'lion', ticket: ticket(1897), salles: [ESSENTIELS, CINQ, DEUX] })
/** 1889 et 1900 sont d'autres décennies, 1893 n'a rien gagné, 1896 est l'année fêtée, 1897 vient après. */
const CARTE: Voyage = voyage1890(1896, [
  { annee: 1894, recompense: 'ours' },
  { annee: 1892, recompense: 'palme' },
  { annee: 1893, recompense: null },
  { annee: 1896, recompense: 'lion' },
  { annee: 1897, recompense: 'ours' },
])
const AVEC_VOISINES: Voyage = { ...CARTE, annees: [annee({ annee: 1889, recompense: 'lion' }), ...CARTE.annees, annee({ annee: 1900, recompense: 'ours' })] }

const SALLE_BOUCLEE: Scene = { type: 'salle', noms: ['La cinquième'], combien: 1 }
const LION: Scene = { type: 'recompense', annee: 1896, recompense: 'lion' }
const ANNEE_BOUCLEE: Scene = { type: 'annee', annee: 1896, recompense: 'lion', ticket: 1897 }

describe('ce que le séquenceur lit pour le dessin d’une fête', () => {
  // Mutations : le filtre de la décennie retiré (1889 et 1900 entreraient) ; `a.annee < annee` retiré
  // (l'année fêtée et 1897) ; une année sans récompense gardée ; le tri retiré.
  it('les récompenses d’avant sont celles de la décennie, avant l’année fêtée, dans l’ordre', () => {
    expect(recompensesDAvant(AVEC_VOISINES, 1896)).toEqual([
      { annee: 1892, recompense: 'palme' },
      { annee: 1894, recompense: 'ours' },
    ])
    expect(recompensesDAvant(undefined, 1896)).toEqual([])
  })

  // Mutations : le numéro pris à la place dans la liste ; le filtre des essentiels ou de la salle
  // complète retiré ; une salle rendue quand la scène en compte deux.
  it('la salle fêtée est la seule que la scène nomme, complète, hors essentiels, à son numéro', () => {
    expect(salleFetee(FICHE, SALLE_BOUCLEE)).toEqual({
      numero: 5,
      nom: 'La cinquième',
      films: [
        { id: 'f1', titre: 'Le premier', affiche: '/a.jpg' },
        { id: 'f2', titre: 'Le second', affiche: null },
      ],
    })
    expect(salleFetee(FICHE, { type: 'salle', noms: ['La deuxième'], combien: 1 })).toBeNull()
    expect(salleFetee(FICHE, { type: 'salle', noms: ['Les essentiels'], combien: 1 })).toBeNull()
    expect(salleFetee(FICHE, { type: 'salle', noms: ['La cinquième', 'La deuxième'], combien: 2 })).toBeNull()
    expect(salleFetee(null, SALLE_BOUCLEE)).toBeNull()
  })

  // Une seule règle calcule les arrivées. Mutations : l'année de la fiche ignorée (la fiche de 1896
  // dirait les arrivées de 1895) ; une liste recomptée ici.
  it('les arrivées sont celles de la fiche de l’année fêtée, par sa règle, et de nulle autre', () => {
    expect(arriveesFetees(FICHE, 1896)).toEqual(arriveesDeLAnnee(4, PROGRESSION, 'lion', FICHE.ticket))
    expect(arriveesFetees(FICHE, 1895)).toBeNull()
    expect(arriveesFetees(null, 1896)).toBeNull()
  })
})

describe('les dessins des fêtes qu’un monde compose', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const SalleDuMonde = (p: PropsFeteDeLaSalle) => (
    <p data-testid="salle">{`${p.monde.decennie} | ${p.carton.sur} : ${p.carton.titre} | ${p.fini ? 'fini' : 'en cours'} | ${p.salle ? `voie ${p.salle.numero}, ${p.salle.films.map((f) => f.titre).join(' et ')}` : 'sans salle'}`}</p>
  )
  const RecompenseDuMonde = (p: PropsFeteDeLaRecompense) => (
    <p data-testid="recompense">{`${p.nom} : ${p.motif} | pas ${p.pas} | ${p.fini ? 'fini' : 'en cours'} | ${p.passees.map((x) => `${x.recompense} ${x.annee}`).join(', ') || 'rien avant'}`}</p>
  )
  const AnneeDuMonde = (p: PropsFeteDeLAnnee) => (
    <p data-testid="annee">{`${p.scene.annee} vers ${p.scene.ticket} | pas ${p.pas} | ${p.fini ? 'fini' : 'en cours'} | salve ${p.salve} | ${p.arrivees ? p.arrivees.map((a) => `${a.cle}${a.arrivee ? '*' : ''}`).join(' ') : 'sans arrivées'}`}</p>
  )
  const DU_MONDE = { feteDeLaSalle: SalleDuMonde, feteDeLaRecompense: RecompenseDuMonde, feteDeLAnnee: AnneeDuMonde }
  const dit = (quoi: string) => screen.getByTestId(quoi).textContent

  function monter(scenes: readonly Scene[], o: { gabarits?: Partial<GabaritsDesPages>; fiche?: FichePrete | null; carte?: Voyage; onUtiliser?: (a: number) => void } = {}) {
    const client = createQueryClient()
    if (o.carte) client.setQueryData<Voyage>(cles.voyage, o.carte)
    const requetes = servir({ 'POST /api/me/voyage/tickets/1897/montre': () => new Response(null, { status: 204 }), 'GET /api/me/voyage': () => json(CARTE) })
    const onFin = vi.fn()
    render(
      <QueryClientProvider client={client}>
        <Celebrations monde={preter(o.gabarits ?? DU_MONDE)} membre="membre-1" scenes={scenes} onFin={onFin} fiche={o.fiche} onUtiliser={o.onUtiliser} />
      </QueryClientProvider>,
    )
    return { requetes, onFin }
  }

  // Mutations : `gabaritDe` retiré d'une des trois scènes (son dessin par défaut resterait) ; la fiche
  // ou la carte non passées au dessin ; le cadre confié au dessin (le dialogue ou « Continuer »
  // disparaîtraient avec lui).
  it('chaque scène monte le dessin du monde dans son cadre, avec ce que la page a lu', async () => {
    const { requetes, onFin } = monter([SALLE_BOUCLEE, LION, ANNEE_BOUCLEE], { fiche: FICHE, carte: AVEC_VOISINES })
    expect(screen.getByRole('dialog', { name: 'Salle complète : La cinquième' })).toHaveFocus()
    expect(dit('salle')).toBe('1890 | Salle complète : La cinquième | en cours | voie 5, Le premier et Le second')
    await passer(somme(SALLE))
    expect(dit('salle')).toContain('| fini |')
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))

    expect(screen.getByRole('dialog', { name: 'Le Lion : les essentiels de 1896' })).toBeInTheDocument()
    expect(dit('recompense')).toBe('Le Lion : les essentiels de 1896 | pas 0 | en cours | palme 1892, ours 1894')
    await passer(RECOMPENSE[0])
    expect(dit('recompense')).toContain('| pas 1 | en cours |')
    await passer(RECOMPENSE[1] + RECOMPENSE[2])
    expect(dit('recompense')).toContain('| pas 3 | fini |')
    fireEvent.click(screen.getByTestId('recompense'))

    expect(screen.getByRole('dialog', { name: '1896 est bouclée' })).toBeInTheDocument()
    expect(dit('annee')).toBe('1896 vers 1897 | pas 0 | en cours | salve 0 | films* essentiels* salles ticket*')
    expect(screen.queryByRole('button')).toBeNull()
    expect(onFin).not.toHaveBeenCalled()
    // Aucune fiche, aucune carte n'est lue pour autant : la fête ne fait que montrer.
    expect(requetes).toEqual([])
  })

  // La carte (le rattrapage) ne tient pas de fiche : le dessin le sait, et rien ne s'invente.
  // Mutation : une fiche lue du cache quand la page n'en passe pas.
  it('sans fiche ni carte, le dessin reçoit des manques, pas des inventions', () => {
    const client = monter([SALLE_BOUCLEE])
    expect(dit('salle')).toContain('| sans salle')
    expect(client.requetes).toEqual([])
  })
  it('sans fiche, l’année bouclée n’a pas d’arrivées, et la récompense rien avant elle', () => {
    monter([LION])
    expect(dit('recompense')).toContain('| rien avant')
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.queryByTestId('recompense')).toBeNull()
  })
  it('la fiche d’une autre année ne prête pas ses arrivées', () => {
    monter([ANNEE_BOUCLEE], { fiche: { ...FICHE, annee: 1895 } })
    expect(dit('annee')).toContain('| sans arrivées')
  })

  // Ce qui éclate ne part que du pas de la médaille joué. Mutations : `setSalve` retiré (jamais de
  // salve) ; la salve posée à tout pas ; posée par `finir` (un toucher impatient ferait éclater).
  it('la salve ne part qu’au pas de la médaille, joué', async () => {
    monter([ANNEE_BOUCLEE], { fiche: FICHE })
    await passer(somme(ANNEE.slice(0, PAS_DE_L_ANNEE.medaille - 1)))
    expect(dit('annee')).toContain(`| pas ${PAS_DE_L_ANNEE.medaille - 1} | en cours | salve 0 |`)
    await passer(ANNEE[PAS_DE_L_ANNEE.medaille - 1]!)
    expect(dit('annee')).toContain(`| pas ${PAS_DE_L_ANNEE.medaille} | en cours | salve 1 |`)
  })
  it('un toucher impatient pose l’état final sans salve', async () => {
    monter([ANNEE_BOUCLEE], { fiche: FICHE })
    await passer(ANNEE[0])
    fireEvent.click(screen.getByRole('dialog'))
    await passer(somme(ANNEE))
    expect(dit('annee')).toContain(`| pas ${ANNEE.length} | fini | salve 0 |`)
  })
  it('au calme, le dessin reçoit l’état final d’emblée, sans salve', () => {
    calme()
    monter([ANNEE_BOUCLEE], { fiche: FICHE })
    expect(dit('annee')).toContain(`| pas ${ANNEE.length} | fini | salve 0 |`)
    expect(screen.getByRole('button', { name: 'Le garder' })).toHaveAttribute('aria-disabled', 'false')
  })

  // Le choix reste à la scène : un monde qui dessine l'année ne l'offre ni ne le garde. Mutation : le
  // pied confié au dessin (aucun bouton), ou le choix qui ne montre plus le ticket.
  it('le choix de l’année bouclée reste celui de la scène, et montre le ticket une fois', async () => {
    calme()
    const onUtiliser = vi.fn()
    const { requetes, onFin } = monter([ANNEE_BOUCLEE], { fiche: FICHE, carte: CARTE, onUtiliser })
    const utiliser = screen.getByRole('button', { name: 'L’utiliser' })
    act(() => {
      utiliser.click()
      utiliser.click()
    })
    await passer(0)
    expect(onUtiliser).toHaveBeenCalledTimes(1)
    expect(onUtiliser).toHaveBeenCalledWith(1897)
    expect(requetes.filter((r) => r.includes('/montre'))).toHaveLength(1)
    expect(onFin).toHaveBeenCalledTimes(1)
  })

  // Un monde peut ne composer qu'une fête : les deux autres gardent leur dessin par défaut.
  it('un monde qui ne dessine que la salle laisse la presse et le fronton par défaut', async () => {
    calme()
    monter([LION, ANNEE_BOUCLEE], { gabarits: { feteDeLaSalle: SalleDuMonde }, fiche: FICHE, carte: CARTE })
    expect(screen.getByText('Le Lion')).toHaveClass('celebration')
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.getByLabelText('Bon pour 1897')).toBeInTheDocument()
  })

  // La fête d'une étiquette de la malle (plan des écrans des lots, brief 6) : une clé **sans défaut**.
  describe('la scène d’une étiquette de la malle', () => {
    const place = (numero: number, nom: string) => ({ numero, cachee: false, cle: `cle-${numero}`, nom, devise: `Devise ${numero}`, regle: 'Une règle.', quoi: 'choses', collee_le: '2026-10-08T20:00:00.000Z', progression: null })
    const LA_7: Scene = { type: 'badge', place: place(7, 'La Correspondance'), deja: [place(2, 'Le Képi')] }
    const LA_12: Scene = { type: 'badge', place: place(12, 'La Pionnière'), deja: [place(2, 'Le Képi'), place(7, 'La Correspondance')] }
    const BadgeDuMonde = (p: PropsFeteDuBadge) => (
      <p data-testid="badge">{`${p.monde.decennie} | ${p.sur} : ${p.scene.place.nom} | pas ${p.pas} | ${p.fini ? 'fini' : 'en cours'} | avant : ${p.scene.deja.map((d) => d.numero).join(' ') || 'rien'}`}</p>
    )
    const AVEC = { ...DU_MONDE, feteDuBadge: BadgeDuMonde }
    afterEach(() => {
      delete (navigator as { vibrate?: unknown }).vibrate
    })
    const vibreur = () => {
      const vibrate = vi.fn(() => true)
      Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
      return vibrate
    }

    // Mutations : la vibration retirée, ou rejouée à chaque pas.
    it('monte le dessin du monde dans son cadre, pas à pas, et le téléphone vibre une fois quand l’étiquette tombe', async () => {
      const vibrate = vibreur()
      const { onFin } = monter([LA_7], { gabarits: AVEC })
      expect(screen.getByRole('dialog', { name: 'Étiquette collée : La Correspondance' })).toBeInTheDocument()
      expect(dit('badge')).toBe('1890 | Étiquette collée : La Correspondance | pas 0 | en cours | avant : 2')
      await passer(BADGE[0] - 1)
      expect(dit('badge')).toContain('pas 0')
      expect(vibrate).not.toHaveBeenCalled()
      await passer(1)
      expect(dit('badge')).toContain('pas 1 | en cours')
      expect(vibrate).toHaveBeenCalledTimes(1)
      await passer(BADGE[1] + BADGE[2])
      expect(dit('badge')).toContain(`pas ${BADGE.length} | fini`)
      expect(vibrate).toHaveBeenCalledTimes(1)
      fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(onFin).toHaveBeenCalledTimes(1)
    })

    // Mutations : `calme` non passé au déroulé de la scène (le pas 0, puis des minuteries) ; la
    // vibration jouée au montage.
    it('au calme, l’état final est posé d’emblée : ni attente, ni vibration', async () => {
      calme()
      const vibrate = vibreur()
      monter([LA_7], { gabarits: AVEC })
      expect(dit('badge')).toBe(`1890 | Étiquette collée : La Correspondance | pas ${BADGE.length} | fini | avant : 2`)
      await passer(somme(BADGE))
      expect(vibrate).not.toHaveBeenCalled()
    })

    // Mutation : la garde du séquenceur retirée (`setRang((r) => r + 1)`) : le toucher redoublé
    // passerait la seconde étiquette sans qu'elle ait été vue.
    it('un toucher redoublé ne passe qu’une scène : la seconde étiquette se voit', () => {
      calme()
      const { onFin } = monter([LA_7, LA_12, ANNEE_BOUCLEE], { gabarits: AVEC })
      const bouton = screen.getByRole('button', { name: 'Continuer' })
      act(() => {
        bouton.click()
        bouton.click()
      })
      expect(screen.getByRole('dialog', { name: 'Étiquette collée : La Pionnière' })).toBeInTheDocument()
      expect(dit('badge')).toContain('avant : 2 7')
      expect(onFin).not.toHaveBeenCalled()
    })

    // Mutations : le filtre du séquenceur retiré (la scène sans dessin ne rendrait rien, et la fête
    // resterait ouverte à vide) ; un dessin de repli à la place de `gabaritSeul`.
    it('un monde qui ne la dessine pas ne la joue pas : la fête passe aux scènes qu’il connaît', () => {
      calme()
      monter([LA_7, ANNEE_BOUCLEE], { gabarits: DU_MONDE, fiche: FICHE })
      expect(screen.getByRole('dialog', { name: '1896 est bouclée' })).toBeInTheDocument()
      expect(screen.queryByTestId('badge')).toBeNull()
      expect(screen.queryByText(/Étiquette collée/)).toBeNull()
    })
  })
})
