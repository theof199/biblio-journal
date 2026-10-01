import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Vumetre from './Vumetre'

const parts = (conteneur: HTMLElement) => [...conteneur.querySelectorAll<HTMLElement>('[style]')].map((e) => e.style.getPropertyValue('--part'))

describe('Vumetre', () => {
  it('liste le compte de chaque note, de 1 à 10', () => {
    render(<Vumetre comptes={[1, 0, 2, 3, 6, 14, 31, 38, 22, 11]} />)

    expect(screen.getByRole('img', { name: 'Films par note, de 1 à 10 : 1, 0, 2, 3, 6, 14, 31, 38, 22, 11' })).toBeInTheDocument()
  })

  it('lève chaque colonne à proportion de son compte, la plus fournie étant pleine', () => {
    const { container } = render(<Vumetre comptes={[1, 0, 2, 4, 0, 0, 0, 0, 0, 0]} />)

    expect(parts(container).slice(0, 4)).toEqual(['0.25', '0', '0.5', '1'])
  })

  it('une note jamais donnée n’allume aucune diode', () => {
    const { container } = render(<Vumetre comptes={[0, 3, 0, 0, 0, 0, 0, 0, 0, 0]} />)

    expect(parts(container)[0]).toBe('0')
  })

  it('marque en rouge la colonne la plus fournie, et elle seule', () => {
    const { container } = render(<Vumetre comptes={[1, 5, 2, 0, 0, 0, 0, 0, 0, 0]} />)

    const pics = container.querySelectorAll('[data-pic]')
    expect(pics).toHaveLength(1)
    expect(pics[0]).toHaveTextContent('5')
  })

  it('sans aucun compte, ne marque aucun pic et ne divise pas par zéro', () => {
    const { container } = render(<Vumetre comptes={new Array<number>(10).fill(0)} />)

    expect(container.querySelectorAll('[data-pic]')).toHaveLength(0)
    expect(new Set(parts(container))).toEqual(new Set(['0']))
  })

  it('numérote les dix colonnes', () => {
    const { container } = render(<Vumetre comptes={new Array<number>(10).fill(0)} />)

    const notes = [...container.querySelectorAll('li')].map((colonne) => colonne.lastElementChild?.textContent)
    expect(notes).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
  })
})
