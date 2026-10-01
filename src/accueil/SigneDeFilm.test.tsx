import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import SigneDeFilm from './SigneDeFilm'
import styles from './SigneDeFilm.module.css'

const rangees = (container: HTMLElement) => [...container.querySelectorAll('[data-texte]')]

describe('le signe d’un film sans affiche', () => {
  it('prend l’enseigne de la décennie de l’année du film', () => {
    render(<SigneDeFilm titre="Metropolis" annee={1927} />)
    expect(screen.getByRole('img', { name: 'Metropolis' })).toHaveAttribute('data-decennie', '1920')
  })

  it('prend l’enseigne de la maison sans année', () => {
    render(<SigneDeFilm titre="Metropolis" annee={null} />)
    expect(screen.getByRole('img')).toHaveAttribute('data-decennie', '1940')
  })

  it('garde un titre court sur une seule ligne de grandes lettres', () => {
    const { container } = render(<SigneDeFilm titre="Alien" annee={1979} />)
    expect(rangees(container).map((ligne) => ligne.className)).toEqual([expect.stringContaining(styles.grande!)])
  })

  it('passe un titre plus long sur deux lignes compactes', () => {
    const { container } = render(<SigneDeFilm titre="King Kong" annee={1933} />)
    expect(rangees(container).map((ligne) => ligne.textContent)).toEqual(['King', 'Kong'])
    expect(rangees(container).every((ligne) => ligne.className.includes(styles.compacte!))).toBe(true)
  })

  it('lit les deux lignes à la taille de la plus longue', () => {
    const { container } = render(<SigneDeFilm titre="Le Mécano de la General" annee={1926} />)
    expect(rangees(container).map((ligne) => (ligne as HTMLElement).style.getPropertyValue('--longueur'))).toEqual(['12', '12'])
  })

  it('relit chaque ligne dans data-texte pour sa face, sans la doubler dans le document', () => {
    const { container } = render(<SigneDeFilm titre="King Kong" annee={1933} />)
    expect(rangees(container).map((ligne) => ligne.getAttribute('data-texte'))).toEqual(['King', 'Kong'])
    expect(screen.getByRole('img').textContent).toBe('KingKong')
  })
})
