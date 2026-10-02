import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Etoiles, { partsDesEtoiles } from './Etoiles'
import styles from './Etoiles.module.css'

describe('partsDesEtoiles', () => {
  it.each([
    [10, [1, 1, 1, 1, 1]],
    [8, [1, 1, 1, 1, 0]],
    [7, [1, 1, 1, 0.5, 0]],
    [1, [0.5, 0, 0, 0, 0]],
    [2, [1, 0, 0, 0, 0]],
    [0, [0, 0, 0, 0, 0]],
  ])('une note de %i sur 10 se lit %j', (note, attendu) => {
    expect(partsDesEtoiles(note)).toEqual(attendu)
  })

  it('borne une note hors de 0 à 10 : jamais plus que pleine, jamais moins que vide', () => {
    expect(partsDesEtoiles(14)).toEqual([1, 1, 1, 1, 1])
    expect(partsDesEtoiles(-3)).toEqual([0, 0, 0, 0, 0])
  })
})

describe('Etoiles', () => {
  it('se nomme « Noté 8 sur 10 » pour un lecteur d’écran, sans lire cinq dessins', () => {
    const { container } = render(<Etoiles note={8} />)

    expect(screen.getByRole('img', { name: 'Noté 8 sur 10' })).toBeInTheDocument()
    for (const dessin of container.querySelectorAll('svg')) expect(dessin).toHaveAttribute('aria-hidden', 'true')
  })

  it('prend le nom qu’on lui donne', () => {
    render(<Etoiles note={8} libelle="vu, noté 8 sur 10" />)

    expect(screen.getByRole('img', { name: 'vu, noté 8 sur 10' })).toBeInTheDocument()
  })

  it('dessine cinq étoiles, dont autant de pleines que la note en compte', () => {
    const { container } = render(<Etoiles note={7} />)

    expect(container.querySelectorAll('svg')).toHaveLength(5)
    // Trois pleines et une à demi : quatre remplissages.
    expect(container.querySelectorAll(`.${styles.plein}`)).toHaveLength(4)
  })

  it('coupe la demi-étoile en son milieu, par un clip que son remplissage désigne', () => {
    const { container } = render(<Etoiles note={7} />)

    const demi = container.querySelectorAll(`.${styles.plein}[clip-path]`)
    expect(demi).toHaveLength(1)
    const reference = demi[0]!.getAttribute('clip-path')!.match(/^url\(#(.+)\)$/)![1]!
    const clip = container.querySelector(`[id="${reference}"]`)!
    expect(clip.tagName.toLowerCase()).toBe('clippath')
    expect(clip.querySelector('rect')).toHaveAttribute('width', '12')
  })

  it('ne coupe pas une étoile pleine', () => {
    const { container } = render(<Etoiles note={8} />)

    expect(container.querySelectorAll('[clip-path]')).toHaveLength(0)
  })
})
