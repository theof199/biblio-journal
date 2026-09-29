import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import Toile, { FabriqueContexteToile, type Dessin } from './Toile'
import { contexteFactice } from '../test/contexteFactice'

/** `matchMedia` manque à jsdom : le test pose la réponse de « moins d'animations ». */
const calme = (oui: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: oui, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

function monter(dessiner: Dessin, options: { hauteur?: number; onToucher?: () => void } = {}) {
  const { ctx, appels } = contexteFactice()
  const vue = render(
    <FabriqueContexteToile.Provider value={() => ctx}>
      <Toile hauteur={options.hauteur ?? 250} dessiner={dessiner} libelle="La baraque" onToucher={options.onToucher} />
    </FabriqueContexteToile.Provider>,
  )
  const toile = vue.container.querySelector('canvas')!
  return { ...vue, appels, ctx, toile }
}

/** Un `IntersectionObserver` de test : `signaler(oui)` dit la toile dans l'écran ou hors de lui. */
function guetteur() {
  const etat = { rappel: null as IntersectionObserverCallback | null, deconnecte: false }
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(rappel: IntersectionObserverCallback) {
        etat.rappel = rappel
      }
      observe() {}
      disconnect() {
        etat.deconnecte = true
      }
    },
  )
  const signaler = (oui: boolean) =>
    etat.rappel?.([{ isIntersecting: oui } as IntersectionObserverEntry], null as unknown as IntersectionObserver)
  return { etat, signaler }
}

describe('la toile d’une page', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] }))
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // Mutation : la garde `if (calme …) return` de la boucle retirée : l'image bougerait au calme.
  it('au calme, pose une image immobile et ne lance aucune boucle', () => {
    calme(true)
    const dessiner = vi.fn<Dessin>()
    monter(dessiner)
    vi.advanceTimersByTime(1000)
    expect(dessiner.mock.calls.map(([, t, vivant]) => [t, vivant])).toEqual([[0, false]])
  })

  // Mutation : l'effet du calme borné à `[calme]` : de nouvelles données ne se verraient plus.
  it('au calme, repeint quand la page change ce qu’elle dessine', () => {
    calme(true)
    const premier = vi.fn<Dessin>()
    const second = vi.fn<Dessin>()
    const { rerender } = monter(premier)
    const { ctx } = contexteFactice()
    rerender(
      <FabriqueContexteToile.Provider value={() => ctx}>
        <Toile hauteur={250} dessiner={second} libelle="La baraque" />
      </FabriqueContexteToile.Provider>,
    )
    expect(second).toHaveBeenCalledWith(expect.anything(), 0, false)
  })

  // Mutation : `cancelAnimationFrame` retiré du nettoyage : la boucle survivrait à la page.
  it('anime tant qu’elle est montée, plus rien après', () => {
    calme(false)
    const dessiner = vi.fn<Dessin>()
    const { unmount } = monter(dessiner)
    vi.advanceTimersByTime(100)
    const avant = dessiner.mock.calls.length
    expect(avant).toBeGreaterThan(0)
    expect(dessiner.mock.calls.every(([, , vivant]) => vivant)).toBe(true)
    unmount()
    vi.advanceTimersByTime(100)
    expect(dessiner.mock.calls.length).toBe(avant)
    // Rien ne reste en attente d'une image : la boucle elle-même est arrêtée, pas seulement muette.
    expect(vi.getTimerCount()).toBe(0)
  })

  // Mutation : dessiner sans `setTransform` : le monde dessinerait en pixels, pas en 390 unités.
  it('met le repère à l’échelle de la largeur réelle', () => {
    calme(true)
    const { appels } = monter(vi.fn<Dessin>())
    // jsdom n'a pas de mise en page : `clientWidth` y vaut 0, la toile retombe sur 390, échelle 1.
    expect(appels.find((a) => a.nom === 'setTransform')?.args).toEqual([1, 0, 0, 1, 0, 0])
  })

  // Mutations : `echelle` retirée de `setTransform`, puis de la hauteur de la toile ; la densité
  // non bornée (`Math.min(2, …)` retiré). Le test précédent tourne à l'échelle 1 et ne les voit pas.
  it('à 780 px de large sur un écran de densité 3, dessine à l’échelle 2 et borne la densité à 2', () => {
    calme(true)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(780)
    vi.stubGlobal('devicePixelRatio', 3)
    const { appels, toile } = monter(vi.fn<Dessin>())
    expect(appels.find((a) => a.nom === 'setTransform')?.args).toEqual([4, 0, 0, 4, 0, 0])
    expect([toile.width, toile.height]).toEqual([1560, 1000])
  })

  // Mutation : l'effet du repère borné à `[fabrique]` : une toile qui change de hauteur garderait l'ancienne.
  it('suit la hauteur que la page lui donne', () => {
    calme(true)
    const { ctx } = contexteFactice()
    // La même fabrique d'un rendu à l'autre : seule la hauteur change.
    const fabrique = () => ctx
    const toile = (hauteur: number) => (
      <FabriqueContexteToile.Provider value={fabrique}>
        <Toile hauteur={hauteur} dessiner={vi.fn<Dessin>()} libelle="La baraque" />
      </FabriqueContexteToile.Provider>
    )
    const { rerender, container } = render(toile(250))
    expect(container.querySelector('canvas')!.height).toBe(250)
    rerender(toile(300))
    expect(container.querySelector('canvas')!.height).toBe(300)
  })

  // Mutations : `t` en millisecondes (sans `/ 1000`), puis compté depuis le chargement de la page
  // (sans `- debut`) : le monde n'animerait plus à la vitesse de la maquette.
  it('compte son temps en secondes depuis qu’elle est montée', () => {
    calme(false)
    vi.advanceTimersByTime(5000)
    const dessiner = vi.fn<Dessin>()
    monter(dessiner)
    vi.advanceTimersByTime(1000)
    const t = dessiner.mock.calls[dessiner.mock.calls.length - 1]![1]
    expect(t).toBeGreaterThan(0.9)
    expect(t).toBeLessThanOrEqual(1)
  })

  // Mutations : `if (visible)` retiré de la boucle ; `guet?.disconnect()` retiré du nettoyage.
  it('ne peint plus hors de l’écran, reprend quand elle y revient, et lâche son guetteur démontée', () => {
    calme(false)
    const { etat, signaler } = guetteur()
    const dessiner = vi.fn<Dessin>()
    const { unmount } = monter(dessiner)
    vi.advanceTimersByTime(100)
    signaler(false)
    const avant = dessiner.mock.calls.length
    vi.advanceTimersByTime(500)
    expect(dessiner.mock.calls.length).toBe(avant)
    signaler(true)
    vi.advanceTimersByTime(100)
    expect(dessiner.mock.calls.length).toBeGreaterThan(avant)
    unmount()
    expect(etat.deconnecte).toBe(true)
  })

  // Mutations : `aria-label` retiré ; `onPointerDown` retiré (le bandeau et la scène relancent au toucher).
  it('se nomme pour un lecteur d’écran, et rend le toucher à la page', () => {
    calme(true)
    const onToucher = vi.fn()
    monter(vi.fn<Dessin>(), { onToucher })
    fireEvent.pointerDown(screen.getByRole('img', { name: 'La baraque' }))
    expect(onToucher).toHaveBeenCalledTimes(1)
  })
})
