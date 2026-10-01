import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Jauge from './Jauge'

describe('Jauge', () => {
  it('dit la note moyenne avec la virgule du français', () => {
    render(<Jauge moyenne={7.4} />)

    expect(screen.getByRole('img', { name: 'Note moyenne 7,4 sur 10' })).toBeInTheDocument()
  })

  it('dit « Aucun film noté » quand il n’y a pas de moyenne', () => {
    render(<Jauge moyenne={null} />)

    expect(screen.getByRole('img', { name: 'Aucun film noté' })).toBeInTheDocument()
  })

  it('pose l’aiguille à droite du cadran pour un 10 et à gauche pour un 1', () => {
    const { container, rerender } = render(<Jauge moyenne={10} />)
    const aiguille = () => container.querySelector('line[stroke-linecap="round"]')

    expect(aiguille()).toHaveAttribute('x2', '254.0')
    expect(aiguille()).toHaveAttribute('y2', '150.0')

    rerender(<Jauge moyenne={1} />)
    expect(aiguille()).toHaveAttribute('x2', '46.0')
  })

  it('pose l’aiguille à la verticale pour un 5,5', () => {
    const { container } = render(<Jauge moyenne={5.5} />)

    expect(container.querySelector('line[stroke-linecap="round"]')).toHaveAttribute('x2', '150.0')
  })

  it('n’a ni aiguille ni pivot sans moyenne', () => {
    const { container } = render(<Jauge moyenne={null} />)

    expect(container.querySelector('line[stroke-linecap="round"]')).toBeNull()
    expect(container.querySelectorAll('circle')).toHaveLength(0)
  })

  it('grave les dix notes sur le cadran', () => {
    const { container } = render(<Jauge moyenne={7.4} />)

    expect([...container.querySelectorAll('text')].map((texte) => texte.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
  })
})
