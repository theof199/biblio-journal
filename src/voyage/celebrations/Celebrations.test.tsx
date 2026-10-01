import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { createQueryClient } from '../../api/queryClient'
import type { Voyage } from '../../api/voyage'
import { ecrireSon } from '../../carte/memoire'
import { Ambiance, ambianceDeLaPage } from '../../carte/son'
import { creerRegistre } from '../../mondes'
import { DoublureAudio, oublierDoublures } from '../../test/audioFactice'
import { json, servir } from '../../test/serveur'
import { voyage1890 } from '../../test/voyage'
import Celebrations from './Celebrations'
import { ANNEE, GARDE_DU_CHOIX, RECOMPENSE, SALLE } from './deroule'
import type { Scene } from './scenes'

const MONDE = creerRegistre()(1890)
const MOI = 'membre-1'
const SALLE_BOUCLEE: Scene = { type: 'salle', noms: ['Les frères Lumière'], combien: 1 }
const LION: Scene = { type: 'recompense', annee: 1896, recompense: 'lion' }
const ANNEE_BOUCLEE: Scene = { type: 'annee', annee: 1896, recompense: 'lion', ticket: 1897 }
const MONTRE = 'POST /api/me/voyage/tickets/1897/montre'
const TICKET = { annee: 1897, motif: 'Tu as fait le tour.', emis_le: '2026-09-21T21:00:00.000Z' }
const somme = (durees: readonly number[]) => durees.reduce((a, b) => a + b, 0)

/** `matchMedia` manque à jsdom : le test pose la réponse de « moins d'animations ». */
const calme = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

function monter(scenes: readonly Scene[], props: { onUtiliser?: (annee: number) => void; horsCarte?: boolean } = {}) {
  const client = createQueryClient()
  client.setQueryData<Voyage>(cles.voyage, voyage1890(1896, [{ annee: 1896, recompense: 'lion' }], { ticket_a_montrer: TICKET }))
  const requetes = servir({
    [MONTRE]: () => new Response(null, { status: 204 }),
    'GET /api/me/voyage': () => json(voyage1890(1896, [{ annee: 1896, recompense: 'lion' }])),
  })
  const onFin = vi.fn()
  // Les attentes lancées depuis le montage, par leur durée : celles d'une scène sont ses pas.
  const minuterie = vi.spyOn(globalThis, 'setTimeout')
  const attentes = () => minuterie.mock.calls.map(([, ms]) => ms)
  const vue = render(
    <QueryClientProvider client={client}>
      <Celebrations monde={MONDE} membre={MOI} scenes={scenes} onFin={onFin} {...props} />
    </QueryClientProvider>,
  )
  return { ...vue, client, requetes, onFin, attentes }
}

const passer = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
/**
 * Des touchers dans le même instant, avant que React n'ait rendu : la scène n'a pas encore retiré ses
 * boutons. Un second `fireEvent` viendrait après le rendu, sur un bouton déjà parti, et ne prouverait rien.
 */
const toucher = (...boutons: HTMLElement[]) => act(() => boutons.forEach((b) => b.click()))
const montres = (requetes: string[]) => requetes.filter((r) => r === MONTRE)

describe('les célébrations du Voyage', () => {
  let vibrate: ReturnType<typeof vi.fn>
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('AudioContext', DoublureAudio)
    oublierDoublures()
    localStorage.clear()
    vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
  })
  afterEach(() => {
    delete (navigator as { vibrate?: unknown }).vibrate
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // Mutations : `suite` qui n'avance pas, ou qui rend la page dès la première scène ; la scène
  // choisie par un autre rang que le sien.
  it('joue les scènes une à une, un toucher passant à la suivante, puis rend la page', async () => {
    const { onFin } = monter([SALLE_BOUCLEE, LION, ANNEE_BOUCLEE])
    expect(screen.getByRole('dialog', { name: 'Salle complète : Les frères Lumière' })).toBeInTheDocument()
    await passer(somme(SALLE))
    expect(screen.getByText('Les frères Lumière')).toHaveClass('celebration')
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(screen.getByRole('dialog', { name: 'Le Lion : les essentiels de 1896' })).toBeInTheDocument()
    expect(onFin).not.toHaveBeenCalled()
    await passer(somme(RECOMPENSE))
    expect(screen.getByText('Le Lion')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.getByRole('dialog', { name: '1896 est bouclée' })).toBeInTheDocument()
    expect(onFin).not.toHaveBeenCalled()
  })

  // Mutation : `setRang((r) => r + 1)`, sans regarder d'où part le toucher (deux touchers avant le
  // rendu sauteraient la récompense, jamais vue).
  it('deux touchers dans le même instant ne sautent pas la scène suivante', () => {
    monter([SALLE_BOUCLEE, LION, ANNEE_BOUCLEE])
    const continuer = screen.getByRole('button', { name: 'Continuer' })
    toucher(continuer, continuer)
    expect(screen.getByRole('dialog', { name: 'Le Lion : les essentiels de 1896' })).toBeInTheDocument()
  })

  // Le toucher impatient arrête le déroulé : ses attentes en cours ne ramènent pas la scène en
  // arrière, et les pas sautés ne vibrent pas. Mutation : `arrete.current` retiré de `useDeroule`.
  it('une scène finie d’un toucher ne reprend pas son déroulé', async () => {
    const { container } = monter([ANNEE_BOUCLEE])
    await passer(ANNEE[0] + ANNEE[1])
    fireEvent.click(screen.getByRole('dialog'))
    await passer(somme(ANNEE))
    expect(container.querySelectorAll('[data-allumee="true"]')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Le garder' })).toBeInTheDocument()
    expect(vibrate).not.toHaveBeenCalled()
  })

  // Le toucher qui termine la scène fait apparaître le choix ; redoublé au même endroit, il ne doit
  // pas dépenser le billet. Mutation : le choix armé dès son apparition (`useState(true)`).
  it('le choix reste inerte un instant après être apparu, puis répond', async () => {
    const onUtiliser = vi.fn()
    const { requetes, onFin } = monter([ANNEE_BOUCLEE], { onUtiliser })
    fireEvent.click(screen.getByRole('dialog'))
    const utiliser = screen.getByRole('button', { name: 'L’utiliser' })
    expect(utiliser).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(utiliser)
    fireEvent.click(screen.getByRole('button', { name: 'Le garder' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    await passer(GARDE_DU_CHOIX - 1)
    fireEvent.click(utiliser)
    expect(onUtiliser).not.toHaveBeenCalled()
    expect(onFin).not.toHaveBeenCalled()
    expect(montres(requetes)).toEqual([])
    await passer(1)
    expect(utiliser).toHaveAttribute('aria-disabled', 'false')
    fireEvent.click(utiliser)
    expect(onUtiliser).toHaveBeenCalledWith(1897)
    expect(montres(requetes)).toHaveLength(1)
  })

  // Le focus reste dans le calque : la page couverte ne se parcourt pas au clavier. Mutation :
  // `onKeyDown` retiré du cadre (Tab ne serait plus retenu, et sortirait du dialogue).
  it('le dialogue prend le focus, et Tab tourne entre ses boutons sans en sortir', () => {
    calme()
    monter([ANNEE_BOUCLEE], { onUtiliser: () => undefined })
    const dialogue = screen.getByRole('dialog')
    const garder = screen.getByRole('button', { name: 'Le garder' })
    const utiliser = screen.getByRole('button', { name: 'L’utiliser' })
    expect(dialogue).toHaveFocus()
    expect(fireEvent.keyDown(dialogue, { key: 'Tab' })).toBe(false)
    expect(garder).toHaveFocus()
    fireEvent.keyDown(garder, { key: 'Tab' })
    expect(utiliser).toHaveFocus()
    expect(fireEvent.keyDown(utiliser, { key: 'Tab' })).toBe(false)
    expect(garder).toHaveFocus()
    fireEvent.keyDown(garder, { key: 'Tab', shiftKey: true })
    expect(utiliser).toHaveFocus()
  })

  // Le jumeau : sans bouton encore (l'année bouclée en cours de scène), Tab reste sur le dialogue.
  it('sans bouton, Tab ne quitte pas le dialogue', () => {
    monter([ANNEE_BOUCLEE])
    const dialogue = screen.getByRole('dialog')
    expect(screen.queryByRole('button')).toBeNull()
    expect(fireEvent.keyDown(dialogue, { key: 'Tab' })).toBe(false)
    expect(dialogue).toHaveFocus()
  })

  // L'année bouclée ne se quitte que par un choix, offert au bout de la scène ; un toucher impatient
  // pose son état final. Mutations : le toucher qui passe à la suite sans choix (le ticket ne serait
  // jamais montré) ; les boutons offerts avant le guichet.
  it('l’année bouclée allume ses cinq ampoules, puis tend le billet et offre le choix', async () => {
    const { container, onFin } = monter([ANNEE_BOUCLEE], { onUtiliser: () => undefined })
    const allumees = () => container.querySelectorAll('[data-allumee="true"]').length
    expect(allumees()).toBe(0)
    expect(screen.queryByRole('button', { name: 'Le garder' })).toBeNull()
    await passer(ANNEE[0] + ANNEE[1] + ANNEE[2])
    expect(allumees()).toBe(3)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onFin).not.toHaveBeenCalled()
    expect(allumees()).toBe(5)
    expect(screen.getByRole('img', { name: 'Lion' })).toBeInTheDocument()
    expect(screen.getByLabelText('Bon pour 1897')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Le garder' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'L’utiliser' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('dialog'))
    expect(onFin).not.toHaveBeenCalled()
  })

  // Mutations : la garde de `useMontrerLeTicket` retirée (deux touchers, deux `/montre`) ; `/montre`
  // oublié de « Le garder » ; « Le garder » qui encaisse.
  it('« Le garder » montre le ticket une seule fois, ferme, et n’encaisse rien', async () => {
    calme()
    const onUtiliser = vi.fn()
    const { requetes, onFin, client } = monter([ANNEE_BOUCLEE], { onUtiliser })
    const garder = screen.getByRole('button', { name: 'Le garder' })
    toucher(garder, garder)
    await passer(0)
    expect(montres(requetes)).toHaveLength(1)
    expect(onUtiliser).not.toHaveBeenCalled()
    expect(onFin).toHaveBeenCalled()
    // La carte en cache ne le rejouera pas : son ticket à montrer est retiré sans attendre la réponse.
    expect(client.getQueryData<Voyage>(cles.voyage)?.ticket_a_montrer).toBeNull()
  })

  // Mutations : `/montre` oublié de « L’utiliser » ; l'encaissement d'une autre année que celle du
  // ticket ; « Le garder » touché dans la foulée qui montrerait une seconde fois.
  it('« L’utiliser » montre le ticket une seule fois, puis l’encaisse', async () => {
    calme()
    const onUtiliser = vi.fn()
    const { requetes, onFin } = monter([ANNEE_BOUCLEE], { onUtiliser })
    const garder = screen.getByRole('button', { name: 'Le garder' })
    const utiliser = screen.getByRole('button', { name: 'L’utiliser' })
    toucher(utiliser, utiliser, garder)
    await passer(0)
    expect(montres(requetes)).toHaveLength(1)
    expect(onUtiliser).toHaveBeenCalledTimes(1)
    expect(onUtiliser).toHaveBeenCalledWith(1897)
    expect(onFin).toHaveBeenCalled()
  })

  // Mutation : « L’utiliser » offert sans de quoi encaisser (un ticket qui n'ouvre pas l'année suivante).
  it('sans encaissement possible, seul « Le garder » s’offre', () => {
    calme()
    monter([ANNEE_BOUCLEE])
    expect(screen.getByRole('button', { name: 'Le garder' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'L’utiliser' })).toBeNull()
  })

  // Mutation : `useDeroule` qui ignore le calme (la scène partirait de son premier pas, minuteries
  // lancées, et vibrerait à la médaille).
  it.each([
    ['la salle bouclée', SALLE_BOUCLEE, 'Les frères Lumière', 'Continuer', SALLE],
    ['la récompense', LION, 'Le Lion', 'Continuer', RECOMPENSE],
    ['l’année bouclée', ANNEE_BOUCLEE, 'est bouclée', 'Le garder', ANNEE],
  ] as const)('au calme, %s pose son état final sans animation : le carton et son bouton', async (_nom, scene, carton, bouton, durees) => {
    calme()
    const { container, attentes } = monter([scene])
    expect(container.querySelector('[data-calme="true"]')).not.toBeNull()
    expect(screen.getByText(carton)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: bouton })).toBeInTheDocument()
    expect(attentes()).not.toContain(durees[0])
    await passer(somme(ANNEE))
    expect(vibrate).not.toHaveBeenCalled()
  })

  // Le jumeau : sans le réglage, la scène s'anime et vibre. Sans lui, le test du calme ne prouverait
  // pas que la vibration existe.
  it('hors du calme, le carton attend la fin du rideau, et le téléphone vibre', async () => {
    const { container, attentes } = monter([SALLE_BOUCLEE])
    expect(container.querySelector('[data-calme="false"]')).not.toBeNull()
    expect(attentes()).toContain(SALLE[0])
    expect(screen.queryByText('Les frères Lumière')).toBeNull()
    await passer(somme(SALLE))
    expect(screen.getByText('Les frères Lumière')).toBeInTheDocument()
    expect(vibrate).toHaveBeenCalledTimes(1)
  })

  describe('le son', () => {
    const allumer = () => {
      ecrireSon(MOI, true)
      expect(ambianceDeLaPage(MOI).allumer()).toBe(true)
    }

    // Mutation : `sonDeLaFete` qui rend l'ambiance sans regarder le réglage ni sa marche.
    it('ne part pas quand le son de la carte n’est pas allumé', async () => {
      const clap = vi.spyOn(Ambiance.prototype, 'clap')
      const carillon = vi.spyOn(Ambiance.prototype, 'carillon')
      const taire = vi.spyOn(Ambiance.prototype, 'taire')
      monter([LION], { horsCarte: true })
      await passer(somme(RECOMPENSE))
      expect(clap).not.toHaveBeenCalled()
      expect(carillon).not.toHaveBeenCalled()
      expect(taire).not.toHaveBeenCalled()
      expect(DoublureAudio.crees).toHaveLength(0)
      // Le téléphone, lui, a vibré : la scène s'est bien jouée.
      expect(vibrate).toHaveBeenCalled()
    })

    // Le réglage seul ne suffit pas : après un rechargement, l'ambiance n'est pas en marche, et seul
    // le bouton « Son » la recrée. Mutation : la marche de l'ambiance ignorée.
    it('ne part pas sur le seul réglage retenu, l’ambiance n’étant pas en marche', async () => {
      ecrireSon(MOI, true)
      const clap = vi.spyOn(Ambiance.prototype, 'clap')
      monter([LION], { horsCarte: true })
      await passer(somme(RECOMPENSE))
      expect(clap).not.toHaveBeenCalled()
      expect(DoublureAudio.crees).toHaveLength(0)
    })

    // Mutation : le réglage du membre ignoré (une ambiance en marche, son réglage coupé).
    it('ne part pas quand le réglage du membre est coupé, même l’ambiance en marche', async () => {
      allumer()
      ecrireSon(MOI, false)
      const clap = vi.spyOn(Ambiance.prototype, 'clap')
      monter([LION], { horsCarte: true })
      await passer(somme(RECOMPENSE))
      expect(clap).not.toHaveBeenCalled()
    })

    // Hors de la carte, l'ambiance est tue : la fête la réveille, puis la rend au silence. Mutations :
    // le réveil retiré (le clap resterait muet : aucun oscillateur de plus) ; le silence non rendu.
    it('allumé, le clap et le carillon de la carte sonnent, l’ambiance réveillée le temps de la fête', async () => {
      allumer()
      const ambiance = ambianceDeLaPage(MOI)
      ambiance.taire(true)
      const ctx = DoublureAudio.crees[0]!
      const avant = ctx.oscillateurs
      const { unmount } = monter([LION], { horsCarte: true })
      await passer(RECOMPENSE[0])
      // Le clap : un oscillateur ; le carillon : trois notes.
      expect(ctx.oscillateurs).toBe(avant + 1)
      await passer(RECOMPENSE[1])
      expect(ctx.oscillateurs).toBe(avant + 4)
      expect(DoublureAudio.crees).toHaveLength(1)
      unmount()
      expect(ctx.state).toBe('suspended')
    })

    // La page de l'année ne tait pas l'ambiance d'elle-même (la carte le fait pour elle-même) : la
    // fête la tait en arrière-plan, et la reprend au retour. Mutation : l'écouteur de
    // `visibilitychange` retiré (l'orgue jouerait téléphone verrouillé).
    it('réveillée hors de la carte, l’ambiance se tait quand la page passe en arrière-plan', () => {
      allumer()
      const ctx = DoublureAudio.crees[0]!
      monter([LION], { horsCarte: true })
      expect(ctx.state).toBe('running')
      const cacher = (cachee: boolean) => {
        Object.defineProperty(document, 'hidden', { value: cachee, configurable: true })
        act(() => void document.dispatchEvent(new Event('visibilitychange')))
      }
      try {
        cacher(true)
        expect(ctx.state).toBe('suspended')
        cacher(false)
        expect(ctx.state).toBe('running')
      } finally {
        delete (document as { hidden?: boolean }).hidden
      }
    })
  })

  // `CLAUDE.md` : une séquence relit son drapeau après chaque attente. Mutation : `if (!monte) return`
  // retiré de `useDeroule` (le téléphone vibrerait et le clap sonnerait pour une page quittée).
  it('un calque démonté en cours de scène n’écrit plus rien', async () => {
    ecrireSon(MOI, true)
    ambianceDeLaPage(MOI).allumer()
    const clap = vi.spyOn(Ambiance.prototype, 'clap')
    const carillon = vi.spyOn(Ambiance.prototype, 'carillon')
    const { unmount, requetes, onFin } = monter([LION, ANNEE_BOUCLEE])
    await passer(RECOMPENSE[0] / 2)
    unmount()
    await passer(somme(RECOMPENSE) + somme(ANNEE))
    expect(vibrate).not.toHaveBeenCalled()
    expect(clap).not.toHaveBeenCalled()
    expect(carillon).not.toHaveBeenCalled()
    expect(onFin).not.toHaveBeenCalled()
    expect(requetes).toEqual([])
  })
})
