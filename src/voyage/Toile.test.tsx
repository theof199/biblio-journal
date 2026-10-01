import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import Toile, { FabriqueContexteToile, type Dessin } from './Toile'
import { contexteFactice } from '../test/contexteFactice'

/** `matchMedia` manque à jsdom : le test pose la réponse de « moins d'animations ». */
const calme = (oui: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: oui, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

type Point = { x: number; y: number }

function monter(dessiner: Dessin, options: { hauteur?: number; onToucher?: (p: Point) => void; onChoisir?: (p: Point) => void } = {}) {
  const { ctx, appels } = contexteFactice()
  const vue = render(
    <FabriqueContexteToile.Provider value={() => ctx}>
      <Toile hauteur={options.hauteur ?? 250} dessiner={dessiner} libelle="La baraque" onToucher={options.onToucher} onChoisir={options.onChoisir} />
    </FabriqueContexteToile.Provider>,
  )
  const toile = vue.container.querySelector('canvas')!
  return { ...vue, appels, ctx, toile }
}

/** Un `IntersectionObserver` de test : `signaler(oui)` dit la toile dans l'écran ou hors de lui. */
function guetteur() {
  const etat = { rappel: null as IntersectionObserverCallback | null, observees: [] as Element[], deconnecte: false }
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(rappel: IntersectionObserverCallback) {
        etat.rappel = rappel
      }
      observe(cible: Element) {
        etat.observees.push(cible)
      }
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

  // Mutations : l'écoute des polices retirée (au calme, une police du monde qui finit de charger
  // après la première image, IM Fell ou Limelight, laisserait le dessin en police de repli) ; son
  // retrait oublié au démontage.
  it('au calme, repeint quand une police finit de charger, et lâche l’écoute démontée', () => {
    calme(true)
    const polices = new EventTarget()
    const ecouter = vi.spyOn(polices, 'addEventListener')
    const lacher = vi.spyOn(polices, 'removeEventListener')
    Object.defineProperty(document, 'fonts', { value: polices, configurable: true })
    try {
      const dessiner = vi.fn<Dessin>()
      const { unmount } = monter(dessiner)
      expect(dessiner).toHaveBeenCalledTimes(1)
      polices.dispatchEvent(new Event('loadingdone'))
      expect(dessiner).toHaveBeenCalledTimes(2)
      expect(dessiner).toHaveBeenLastCalledWith(expect.anything(), 0, false)
      unmount()
      const ecoute = ecouter.mock.calls.find(([type]) => type === 'loadingdone')?.[1]
      expect(ecoute).toBeDefined()
      expect(lacher).toHaveBeenCalledWith('loadingdone', ecoute)
    } finally {
      Reflect.deleteProperty(document, 'fonts')
    }
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

  // Mutations : l'effet du repère borné à `[fabrique]` : une toile qui change de hauteur garderait
  // l'ancienne ; le rapport de la feuille figé (`390 / 250`) : sur un `<canvas>`, `aspect-ratio`
  // l'emporte sur les dimensions de la toile, le dessin serait écrasé.
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
    expect(container.querySelector('canvas')!.getAttribute('style')).toContain('aspect-ratio: 390 / 250')
    rerender(toile(300))
    expect(container.querySelector('canvas')!.height).toBe(300)
    expect(container.querySelector('canvas')!.getAttribute('style')).toContain('aspect-ratio: 390 / 300')
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

  // Mutations : `if (visible)` retiré de la boucle ; `guet?.observe(…)` retiré (le navigateur ne
  // dirait jamais la toile sortie, elle peindrait hors de l'écran) ; `guet?.disconnect()` retiré du nettoyage.
  it('ne peint plus hors de l’écran, reprend quand elle y revient, et lâche son guetteur démontée', () => {
    calme(false)
    const { etat, signaler } = guetteur()
    const dessiner = vi.fn<Dessin>()
    const { unmount, toile } = monter(dessiner)
    expect(etat.observees).toEqual([toile])
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

  // Mutations : le toucher rendu en pixels de l'écran (sans l'échelle), ou sans retirer le coin de la
  // toile : un cheval du manège se chercherait ailleurs que sous le doigt.
  it('rend le toucher en unités de la toile, depuis son coin', () => {
    calme(true)
    const onToucher = vi.fn()
    const { toile } = monter(vi.fn<Dessin>(), { hauteur: 250, onToucher })
    // Une toile affichée à moitié de sa largeur logique et à sa hauteur logique (deux échelles
    // différentes : la hauteur lue sur la largeur tombe aussi), décalée de (10, 20).
    vi.spyOn(toile, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 195, height: 250, right: 205, bottom: 270, x: 10, y: 20, toJSON: () => ({}) })
    fireEvent.pointerDown(toile, { clientX: 107.5, clientY: 145 })
    expect(onToucher).toHaveBeenCalledWith({ x: 195, y: 125 })
  })

  // Le jumeau du toucher bref de la carte (`carte/geste.ts` : bouger annule tout, c'est un
  // défilement). Un défilement commence par un `pointerdown` : ouvrir une année dès le premier
  // contact ouvrirait celle du cheval sous le doigt qui voulait faire défiler la page. Le choix
  // attend le `click`, que le navigateur ne donne pas après avoir pris le geste pour défiler.
  // Mutations : `onChoisir` branché sur `onPointerDown` ; le choix rendu sans l'échelle ; sa hauteur
  // lue sur la largeur.
  it('ne choisit qu’au toucher achevé, en unités de la toile', () => {
    calme(true)
    const onChoisir = vi.fn()
    const { toile } = monter(vi.fn<Dessin>(), { hauteur: 250, onChoisir })
    vi.spyOn(toile, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 195, height: 250, right: 205, bottom: 270, x: 10, y: 20, toJSON: () => ({}) })
    fireEvent.pointerDown(toile, { clientX: 107.5, clientY: 145 })
    fireEvent.pointerCancel(toile, { clientX: 107.5, clientY: 60 })
    expect(onChoisir).not.toHaveBeenCalled()
    fireEvent.click(toile, { clientX: 107.5, clientY: 145 })
    expect(onChoisir).toHaveBeenCalledTimes(1)
    expect(onChoisir).toHaveBeenCalledWith({ x: 195, y: 125 })
  })

  // Mutation : l'échelle prise sans garder la toile de taille nulle (une division par zéro) : sans
  // mise en page, chaque toucher partirait à l'infini et aucune figure ne serait jamais touchée.
  it('rend le toucher tel quel quand la toile n’a pas de taille', () => {
    calme(true)
    const onToucher = vi.fn()
    const { toile } = monter(vi.fn<Dessin>(), { hauteur: 250, onToucher })
    fireEvent.pointerDown(toile, { clientX: 120, clientY: 80 })
    expect(onToucher).toHaveBeenCalledWith({ x: 120, y: 80 })
  })
})
