import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import Affiche from './Affiche'
import styles from './Affiche.module.css'

describe('Affiche', () => {
  it('sans image, le cadre existe encore : il porte la classe qui fixe son ratio', () => {
    const { container } = render(<Affiche src={null} titre="Alien" />)

    const cadre = container.firstElementChild!
    expect(cadre).toHaveClass(styles.cadre!)
    expect(container.querySelector('img')).toBeNull()
  })

  it('avec image, le cadre est le même et l’image y est posée', () => {
    const { container } = render(<Affiche src="/a.jpg" titre="Alien" />)

    expect(container.firstElementChild).toHaveClass(styles.cadre!)
    expect(container.querySelector('img')).toHaveClass(styles.image!)
  })
})
