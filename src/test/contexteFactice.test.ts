import { describe, expect, it } from 'vitest'
import { contexteFactice } from './contexteFactice'

describe('le contexte factice', () => {
  it('note les appels avec le style courant, et tient la pile et la matrice', () => {
    const { ctx, appels } = contexteFactice()
    ctx.save()
    ctx.translate(10, 5)
    ctx.scale(2, 2)
    ctx.fillStyle = '#FF6B57'
    ctx.fillRect(0, 0, 1, 1)
    expect(ctx.getTransform()).toMatchObject({ a: 2, d: 2, e: 10, f: 5 })
    ctx.restore()
    expect(ctx.getTransform()).toMatchObject({ a: 1, e: 0 })
    expect(ctx.fillStyle).toBe('#000')
    expect(appels.find((a) => a.nom === 'fillRect')).toMatchObject({ fillStyle: '#FF6B57' })
    expect(ctx.createImageData(2, 3).data).toHaveLength(24)
  })
})
