import { describe, expect, it } from 'vitest'
import { creerRampe } from './rampe'

/** Les paliers de la maquette du 29 septembre 2026 (`SEP`) ; les attendus sont ceux de sa fonction `rgb`, rejouée en Node. */
const SEPIA = [[18, 12, 8], [92, 62, 36], [170, 126, 80], [247, 236, 214]] as const

describe('la rampe d’un monde', () => {
  // Mutation : `part` et `1 - part` inversés ; la luminance lue sans ses coefficients.
  it('rend les couleurs de la maquette', () => {
    const r = creerRampe(SEPIA, 0.64)
    expect(r.rgb('#3E5360')).toEqual([78, 67, 56])
    expect(r.rgb('#A8452F')).toEqual([121, 66, 41])
    expect(r.couleur('#A8452F')).toBe('rgb(121,66,41)')
    expect(r.couleur('#A8452F', 0.5)).toBe('rgba(121,66,41,0.5)')
    expect(r.couleur('#A8452F', -1)).toBe('rgba(121,66,41,0)')
  })
})
