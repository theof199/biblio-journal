import { afterEach, describe, expect, it, vi } from 'vitest'
import { contexteFactice } from '../../test/contexteFactice'
import { vueFactice } from '../../test/vueFactice'
import { creerFour, finesseDeCuisson, PLAFOND, type ToileHorsEcran } from './cuisson'
import { ARRETS, B1 } from './trace'

/** Une fabrique de toiles pour le four : elle note ce qu'on lui demande, et rend des toiles qui ne dessinent rien. */
function fabriqueTemoin() {
  const toiles: Array<{ width: number; height: number; scale: ReturnType<typeof vi.fn> }> = []
  const fabrique = (w: number, h: number): ToileHorsEcran => {
    const scale = vi.fn()
    const toile = { width: Math.ceil(w), height: Math.ceil(h), scale }
    toiles.push(toile)
    return { toile: toile as unknown as HTMLCanvasElement, g: { scale } as unknown as CanvasRenderingContext2D }
  }
  return { toiles, fabrique }
}

describe('la finesse d’une toile cuite', () => {
  // Mutations : la densité ignorée (`return 1`) ; le plancher retiré (une densité de 0,5 cuirait
  // plus grossier qu'avant) ; la photographie cuite à la densité quoi qu'elle porte ; son plafond
  // lu à l'envers (`pose / natif`).
  it('est la densité de l’écran, jamais moins de 1, et pour une photographie jamais plus que ses pixels', () => {
    expect(finesseDeCuisson(2)).toBe(2)
    expect(finesseDeCuisson(1.5)).toBe(1.5)
    expect(finesseDeCuisson(0.5)).toBe(1)
    expect(finesseDeCuisson(0)).toBe(1)
    // 941 pixels posés sur 530 : pas plus fin que 941 / 530.
    expect(finesseDeCuisson(2, 941, 530)).toBeCloseTo(941 / 530, 9)
    expect(finesseDeCuisson(1.5, 941, 530)).toBe(1.5)
    // 469 pixels posés sur 540 : déjà agrandie, elle reste à 1.
    expect(finesseDeCuisson(2, 469, 540)).toBe(1)
    expect(finesseDeCuisson(3, 1200, 300)).toBe(3)
  })
})

describe('le four des toiles cuites', () => {
  // Mutations : la finesse ignorée par `cuire` (la toile à sa taille logique : le flou d'avant) ;
  // l'échelle non posée sur le contexte (le dessin tiendrait dans un quart de la toile) ; le
  // peintre servi en pixels de toile au lieu de px du dessin.
  it('cuit une toile de la taille du dessin multipliée par la finesse, et le peintre dessine toujours dans la taille du dessin', () => {
    const { toiles, fabrique } = fabriqueTemoin()
    const cuire = creerFour(fabrique)
    const peindre = vi.fn()
    const cuite = cuire('fond', 800, 388, peindre, 2)
    expect(toiles).toHaveLength(1)
    expect([toiles[0]!.width, toiles[0]!.height]).toEqual([1600, 776])
    expect(cuite).toBe(toiles[0])
    expect(toiles[0]!.scale.mock.calls).toEqual([[2, 2]])
    expect(peindre.mock.calls[0]!.slice(1)).toEqual([800, 388])
    // Sans finesse : la taille demandée, le contexte laissé tel quel.
    cuire('gare', 760, 716, peindre)
    expect([toiles[1]!.width, toiles[1]!.height]).toEqual([760, 716])
    expect(toiles[1]!.scale).not.toHaveBeenCalled()
    expect(peindre.mock.calls[1]!.slice(1)).toEqual([760, 716])
  })

  // Mutations : la finesse non comparée (`if (deja)` : la toile cuite à la densité d'avant resservie,
  // étirée) ; la toile d'avant non rendue (`width = 0` retiré) ; gardée en mémoire à côté de la neuve.
  it('ne ressert pas une toile cuite à une autre finesse : elle la rend et en cuit une autre', () => {
    const { toiles, fabrique } = fabriqueTemoin()
    const cuire = creerFour(fabrique, 1)
    const peindre = vi.fn()
    const a = cuire('fond', 800, 388, peindre, 1)
    expect(cuire('fond', 800, 388, peindre, 1)).toBe(a)
    expect(peindre).toHaveBeenCalledTimes(1)
    // L'écran passe à la densité 2 (une rotation, un zoom).
    const b = cuire('fond', 800, 388, peindre, 2)
    expect(b).not.toBe(a)
    expect(peindre).toHaveBeenCalledTimes(2)
    expect([toiles[1]!.width, toiles[1]!.height]).toEqual([1600, 776])
    expect(toiles[0]!.width).toBe(0)
    // Une seule toile sous cette clé : au plafond de 1, la neuve n'a évincé personne et se ressert.
    expect(cuire('fond', 800, 388, peindre, 2)).toBe(b)
    expect(toiles[1]!.width).toBe(1600)
    expect(toiles).toHaveLength(2)
  })

  // Mutations : la borne retirée (`cuites.size > plafond` jamais vrai) ; `>=` (une toile de moins) ;
  // la toile évincée non rendue ; la plus récente évincée ; une toile resservie non remise en tête
  // (la plus anciennement cuite sortirait, pas la moins récemment servie).
  it('garde au plus son plafond de toiles : la moins récemment servie est rendue, et se recuit si on la redemande', () => {
    const { toiles, fabrique } = fabriqueTemoin()
    const cuire = creerFour(fabrique, 3)
    const peindre = vi.fn()
    for (const cle of ['a', 'b', 'c']) cuire(cle, 10, 10, peindre)
    expect(toiles.map((t) => t.width)).toEqual([10, 10, 10])
    // « a » resservie : « b » devient la moins récemment servie.
    cuire('a', 10, 10, peindre)
    cuire('d', 10, 10, peindre)
    expect(toiles.map((t) => t.width)).toEqual([10, 0, 10, 10])
    expect(peindre).toHaveBeenCalledTimes(4)
    // « a », « c » et « d » sont là ; « b » se recuit, et « c » sort à son tour.
    for (const cle of ['a', 'c', 'd']) cuire(cle, 10, 10, peindre)
    expect(peindre).toHaveBeenCalledTimes(4)
    cuire('b', 10, 10, peindre)
    expect(peindre).toHaveBeenCalledTimes(5)
    expect(toiles.map((t) => t.width)).toEqual([0, 0, 10, 10, 10])
  })

  // Mutations : la toile d'avant rendue avant de savoir si la fabrique en donne une autre ; rien de
  // resservi quand la recuisson est refusée (le fond serait repeint à chaque image).
  it('sans toile neuve, ne peint rien, ne rend rien pour une clé qu’il ne tient pas, et ressert celle qu’il tient à l’autre finesse', () => {
    const { toiles, fabrique } = fabriqueTemoin()
    let refus = false
    const cuire = creerFour((w, h) => (refus ? null : fabrique(w, h)))
    const peindre = vi.fn()
    const a = cuire('a', 10, 10, peindre)
    refus = true
    expect(cuire('b', 10, 10, peindre, 2)).toBeNull()
    expect(cuire('a', 10, 10, peindre, 2)).toBe(a)
    expect(peindre).toHaveBeenCalledTimes(1)
    expect(cuire('a', 10, 10, peindre)).toBe(a)
    expect(toiles[0]!.width).toBe(10)
  })
})

describe('les fonds de 1900, cuits à la densité de l’écran', () => {
  afterEach(() => vi.restoreAllMocks())

  /** Le ciel et le lointain dessinés en gare de 1900 avec de vraies toiles hors écran : la taille de chaque toile demandée. */
  const toilesDemandees = async (densites: readonly number[], photo: CanvasImageSource | null | ReadonlyArray<CanvasImageSource | null> = null, avance = B1) => {
    vi.resetModules()
    const { dessinerCiel } = await import('./ciel')
    const { dessinerLointain } = await import('./lointain')
    const toiles: Array<{ width: number; height: number }> = []
    const creer = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((nom: string) => {
      if (nom !== 'canvas') return creer(nom)
      const toile = { width: 0, height: 0, getContext: () => contexteFactice().ctx }
      toiles.push(toile)
      return toile
    }) as typeof document.createElement)
    const tailles: string[][] = []
    for (const [i, densite] of densites.entries()) {
      const avant = toiles.length
      const laPhoto = Array.isArray(photo) ? photo[i]! : (photo as CanvasImageSource | null)
      const { vue } = vueFactice({ W: 390, H: 844, avance, densite, image: () => laPhoto })
      dessinerCiel(vue)
      dessinerLointain(vue)
      tailles.push(toiles.slice(avant).map((t) => `${t.width}x${t.height}`))
    }
    return { tailles, toiles }
  }
  /** Le fond d'une ambiance sur un écran de 390 × 844 : 800 px de large, 46 % de la hauteur. */
  const FOND = { w: 800, h: 844 * 0.46 }

  // Mutations : `v.densite` non passée par `ciel.ts` (`1` en dur) ; `finesseDeCuisson(densite)`
  // retiré de `dessinerFond` (le fond cuit à sa taille logique, étiré : le flou signalé).
  it('le fond d’une ambiance se cuit à la taille posée multipliée par la densité', async () => {
    const { tailles } = await toilesDemandees([1])
    expect(tailles[0]).toEqual([`${FOND.w}x${Math.ceil(FOND.h)}`])
    const double = await toilesDemandees([2])
    expect(double.tailles[0]).toEqual([`${FOND.w * 2}x${Math.ceil(FOND.h * 2)}`])
  })

  // Mutation : la densité hors de ce que le four compare (la toile de la densité 1 resservie à 2).
  it('la densité qui change fait recuire le fond, et rend la toile d’avant', async () => {
    const { tailles, toiles } = await toilesDemandees([1, 1, 2, 2])
    expect(tailles.map((t) => t.length)).toEqual([1, 0, 1, 0])
    expect(tailles[2]).toEqual([`${FOND.w * 2}x${Math.ceil(FOND.h * 2)}`])
    expect(toiles[0]!.width).toBe(0)
  })

  // Une vue lointaine est une photographie de 469 à 493 pixels de haut, posée sur 540 px : déjà
  // agrandie, elle ne gagne rien à la densité. Mutation : `finesseDeCuisson(densite)` sans la
  // taille de la photographie dans `lointain.ts` (quatre fois la mémoire pour la même image).
  it('une vue lointaine ne se cuit pas plus fin que sa photographie', async () => {
    const photo = {} as CanvasImageSource
    const simple = await toilesDemandees([1], photo)
    const double = await toilesDemandees([2], photo)
    const lointaines = (t: string[]) => t.filter((x) => x.endsWith(`x${Math.ceil(844 * 0.64)}`))
    expect(lointaines(simple.tailles[0]!).length).toBeGreaterThan(0)
    expect(lointaines(double.tailles[0]!)).toEqual(lointaines(simple.tailles[0]!))
  })

  // La ville, la campagne et la mer sont des tracés : une photographie qui arrive ne les fait pas
  // recuire, et ne laisse pas leur toile d'avant dans la mémoire. Mutation : `const pic = photo`.
  it('seule la montagne recuit son fond quand la photographie arrive', async () => {
    const fond = `${FOND.w * 2}x${Math.ceil(FOND.h * 2)}`
    const ville = await toilesDemandees([2, 2], [null, {} as CanvasImageSource])
    expect(ville.tailles.map((t) => t.filter((x) => x === fond).length)).toEqual([1, 0])
    const montagne = await toilesDemandees([2, 2], [null, {} as CanvasImageSource], ARRETS[4]!)
    expect(montagne.tailles.map((t) => t.filter((x) => x === fond).length)).toEqual([1, 1])
  })

  // Le pic de la montagne est une photographie de 941 pixels posée sur 530 px. Mutations : cuit à
  // la densité sans égard à ses pixels (1060) ; laissé à sa taille logique (530).
  it('le pic de la montagne se cuit à ses propres pixels, pas au-delà', async () => {
    const { toiles } = await toilesDemandees([2], {} as CanvasImageSource, ARRETS[4]!)
    const pic = toiles.filter((t) => t.width >= 941 && t.width <= 942)
    expect(pic).toHaveLength(1)
    expect(toiles.filter((t) => t.width === 1060 || t.width === 530)).toEqual([])
  })

  // Mutation : la mémoire du monde montée sans son plafond (`creerFour(toileHorsEcran, 999)`).
  it('la mémoire du monde rend sa toile la moins récemment servie au-delà de son plafond', async () => {
    vi.resetModules()
    const { cuire } = await import('./cuisson')
    const toiles: Array<{ width: number; height: number }> = []
    const creer = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((nom: string) => {
      if (nom !== 'canvas') return creer(nom)
      const toile = { width: 0, height: 0, getContext: () => contexteFactice().ctx }
      toiles.push(toile)
      return toile
    }) as typeof document.createElement)
    for (let i = 0; i < PLAFOND; i++) cuire(`cle:${i}`, 10, 10, () => undefined)
    expect(toiles.map((t) => t.width)).toEqual(Array.from({ length: PLAFOND }, () => 10))
    cuire('une de plus', 10, 10, () => undefined)
    expect(toiles.map((t) => t.width)).toEqual([0, ...Array.from({ length: PLAFOND }, () => 10)])
  })
})
