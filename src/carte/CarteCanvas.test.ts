import { createElement } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CarteCanvas, { FabriqueMoteurContexte, fabriqueReelle } from './CarteCanvas'
import type { Dependances, EtatCarte } from './moteur'
import { moteurFactice } from '../test/moteurFactice'

const vu = vi.hoisted(() => ({ deps: null as unknown }))

vi.mock('./moteur', () => ({
  MoteurCarte: class {
    constructor(_canvas: unknown, _rappels: unknown, deps: unknown) {
      vu.deps = deps
    }
  },
}))

describe('le vrai moteur', () => {
  afterEach(() => vi.useRealTimers())

  // Relecture de la tâche 9 (idée 3, le jour et la nuit de l'heure réelle). Mutations : une heure
  // fixe (`heure: () => 12`) ; les minutes oubliées ; l'heure lue une fois pour toutes à la
  // fabrication du moteur au lieu de l'être à chaque image.
  it('lit l’heure de l’appareil, minutes comprises, à chaque demande', () => {
    fabriqueReelle(document.createElement('canvas'), {} as never)
    const deps = vu.deps as Dependances
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 29, 21, 30))
    expect(deps.heure()).toBe(21.5)
    vi.setSystemTime(new Date(2026, 8, 30, 6, 45))
    expect(deps.heure()).toBe(6.75)
  })
})

describe('le pont entre le DOM et le moteur', () => {
  afterEach(() => vi.restoreAllMocks())

  const ETAT: EtatCarte = { cases: [], anneeAvatar: 0, tampons: [], roulotte: null }
  const monter = () => {
    const banc = moteurFactice()
    const ecoutes = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    const rappels = { toucherAnnee() {}, apercu() {}, finApercu() {}, ensemble() {}, date() {}, roulotte() {}, avatarVisible() {}, bobine() {}, bobineArrivee() {}, cibleBobines: () => ({ x: 0, y: 0 }), clap() {}, presences() {}, entreeProche: vi.fn() }
    const { container } = render(
      createElement(FabriqueMoteurContexte.Provider, { value: banc.fabrique }, createElement(CarteCanvas, { etat: ETAT, calme: false, bobines: [], rappels, surMoteur: () => undefined })),
    )
    return { ...banc, vue: container.firstElementChild as HTMLElement, ecoutes, page: rappels }
  }

  // Plan 3a : le navigateur relève le pointeur (`pointercancel`) dès qu'il prend le geste pour
  // défiler ; les événements tactiles, eux, durent jusqu'au lever. Le compte est celui des doigts
  // posés sur la carte (`targetTouches`) : un doigt posé ailleurs (`touches` le compte aussi) ne se
  // lèvera jamais ici. Mutations : le relais retiré de `touchstart`, de `touchend` ou de
  // `touchcancel` ; un nombre fixe ; `touches.length` à la place de `targetTouches.length`.
  it('relaie au moteur le nombre de doigts posés sur la carte, au poser, au lever et à l’annulation', () => {
    const { moteur, vue } = monter()
    const ici = { clientX: 10, clientY: 10 }
    const ailleurs = { clientX: 300, clientY: 900 }
    fireEvent.touchStart(vue, { touches: [ailleurs, ici], targetTouches: [ici] })
    expect(moteur.doigtsPoses).toHaveBeenLastCalledWith(1)
    fireEvent.touchStart(vue, { touches: [ailleurs, ici, { clientX: 90, clientY: 90 }], targetTouches: [ici, { clientX: 90, clientY: 90 }] })
    expect(moteur.doigtsPoses).toHaveBeenLastCalledWith(2)
    fireEvent.touchEnd(vue, { touches: [ailleurs, ici], targetTouches: [ici] })
    expect(moteur.doigtsPoses).toHaveBeenLastCalledWith(1)
    // Le doigt posé ailleurs reste : le compte de la carte tombe quand même à zéro.
    fireEvent.touchCancel(vue, { touches: [ailleurs], targetTouches: [] })
    expect(moteur.doigtsPoses).toHaveBeenLastCalledWith(0)
    expect(moteur.doigtsPoses).toHaveBeenCalledTimes(4)
    fireEvent.touchStart(vue, { touches: [ailleurs, ici], targetTouches: [ici] })
    fireEvent.touchEnd(vue, { touches: [ailleurs], targetTouches: [] })
    expect(moteur.doigtsPoses).toHaveBeenLastCalledWith(0)
    expect(moteur.doigtsPoses).toHaveBeenCalledTimes(6)
  })

  // Un écouteur tactile non passif retient le défilement natif tant qu'il n'a pas rendu la main.
  // Mutation : `passive: false` (ou aucune option) sur un écouteur du relais.
  it('n’écoute les doigts posés que par des écouteurs passifs', () => {
    const { moteur, vue, ecoutes } = monter()
    const duRelais = ecoutes.mock.calls.filter(([type, ecouteur]) => {
      if (!['touchstart', 'touchend', 'touchcancel'].includes(type) || typeof ecouteur !== 'function') return false
      vi.mocked(moteur.doigtsPoses).mockClear()
      ecouteur.call(vue, { touches: [], targetTouches: [] } as unknown as Event)
      return vi.mocked(moteur.doigtsPoses).mock.calls.length > 0
    })
    expect(duRelais.map(([type]) => type).sort()).toEqual(['touchcancel', 'touchend', 'touchstart'])
    for (const [, , options] of duRelais) expect(options).toEqual({ passive: true })
  })

  // Plan 3a : le rappel neuf du moteur arrive à la page. Mutation : la ligne `entreeProche` retirée
  // du relais (la page n'offrirait jamais « Prendre le train »).
  it('relaie à la page l’entrée à portée de geste que dit le moteur', () => {
    const banc = monter()
    banc.rappels().entreeProche?.(1900)
    banc.rappels().entreeProche?.(null)
    expect(banc.page.entreeProche.mock.calls).toEqual([[1900], [null]])
  })
})
