import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Tampon from './Tampon'

describe('le tampon du billet', () => {
  // L'anneau court sur un cercle de rayon 47 (295 unités). « CINÉMATOGRAPHE · SÉANCE DU 28 SEPTEMBRE
  // 2026 · » en mesure 335 dans sa police (Chromium, 390 px) : la fin du texte, l'année comprise,
  // tombait du cercle. Mutation : l'anneau sans `textLength` (le texte reprend sa longueur naturelle).
  it('tient l’anneau dans son cercle, quelle que soit la longueur de la date', () => {
    render(<Tampon mot="VU" autour="Cinématographe · séance du" date="28 septembre 2026" frappe="fini" />)
    const anneau = screen.getByRole('img', { name: /^VU : / }).querySelector('textPath')!
    expect(anneau).toHaveTextContent('CINÉMATOGRAPHE · SÉANCE DU 28 SEPTEMBRE 2026 ·')
    const longueur = Number(anneau.getAttribute('textLength'))
    expect(longueur).toBeGreaterThan(0)
    expect(longueur).toBeLessThanOrEqual(2 * Math.PI * 47)
    expect(anneau).toHaveAttribute('lengthAdjust', 'spacing')
  })
})
