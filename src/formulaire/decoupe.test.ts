import { describe, expect, it } from 'vitest'
import { decoupe } from './decoupe'

/** Les rentrées en pixels d'un contour, dans l'ordre de ses points. */
const rentrees = (contour: string) => [...contour.matchAll(/(\d+\.\d)px/g)].map(([, px]) => Number(px))

describe('decoupe', () => {
  it('est le même contour pour la même graine, à chaque appel', () => {
    expect(decoupe('e0000000-0000-4000-8000-000000000002')).toBe(decoupe('e0000000-0000-4000-8000-000000000002'))
  })

  it('n’est pas le même contour pour deux graines : deux coupures ne se ressemblent pas', () => {
    expect(decoupe('e0000000-0000-4000-8000-000000000002')).not.toBe(decoupe('e0000000-0000-4000-8000-000000000003'))
    expect(decoupe('une-entree')).not.toBe(decoupe('une-entree:bref'))
  })

  it('est un polygone de dix-huit points, qui fait le tour de la coupure', () => {
    const contour = decoupe('une-entree')

    expect(contour).toMatch(/^polygon\(.+\)$/)
    expect(contour.slice('polygon('.length, -1).split(', ')).toHaveLength(18)
    // Le haut part de la gauche, le bas finit à gauche : chaque bord a sa place dans la liste.
    expect(contour).toMatch(/^polygon\(0\.0% [\d.]+px, 25\.0% [\d.]+px, 50\.0% [\d.]+px, 75\.0% [\d.]+px, 100\.0% [\d.]+px, calc\(100% - [\d.]+px\) 20\.0%/)
    expect(contour).toMatch(/calc\(100% - [\d.]+px\) 100\.0%, 75\.0% calc\(100% - [\d.]+px\)/)
    expect(contour).toMatch(/0\.0% calc\(100% - [\d.]+px\), [\d.]+px 80\.0%, [\d.]+px 60\.0%, [\d.]+px 40\.0%, [\d.]+px 20\.0%\)$/)
  })

  it('ne rentre jamais un bord de plus de sept pixels : le texte reste entier', () => {
    for (const graine of ['a', 'b', 'une-entree', 'e0000000-0000-4000-8000-000000000002', '']) {
      for (const px of rentrees(decoupe(graine))) {
        expect(px).toBeGreaterThanOrEqual(0)
        expect(px).toBeLessThanOrEqual(7)
      }
    }
  })

  it('n’est pas un contour droit : les bords sont rentrés de longueurs différentes', () => {
    expect(new Set(rentrees(decoupe('une-entree'))).size).toBeGreaterThan(5)
  })
})
