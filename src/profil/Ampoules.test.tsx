import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Ampoules, { AMPOULES_VISIBLES } from './Ampoules'

const COMPTES = [4, 6, 3, 8, 5, 11, 7, 2, 9, 1, 0, 0]

const colonnes = (conteneur: HTMLElement) => [...conteneur.querySelectorAll('li')]
/** Les ampoules d'une colonne : le deuxième enfant, entre le compte et le nom du mois. */
const ampoulesDe = (colonne: HTMLElement) => [...colonne.children[1]!.children]

describe('Ampoules', () => {
  it('liste les douze mois et leur compte', () => {
    render(<Ampoules annee={2026} comptes={COMPTES} moisCourant={9} />)

    expect(screen.getByRole('img', { name: /^Films par mois en 2026 : janvier 4, février 6,.*novembre 0, décembre 0$/ })).toBeInTheDocument()
  })

  it('allume une ampoule par film', () => {
    const { container } = render(<Ampoules annee={2026} comptes={COMPTES} moisCourant={9} />)

    const allumees = colonnes(container).map((colonne) => colonne.querySelectorAll('[data-allumee]').length)
    expect(allumees).toEqual(COMPTES)
  })

  it('laisse voir les logements vides : chaque colonne a ses onze ampoules', () => {
    const { container } = render(<Ampoules annee={2026} comptes={COMPTES} moisCourant={9} />)

    expect(colonnes(container).map((colonne) => ampoulesDe(colonne).length)).toEqual(new Array(12).fill(AMPOULES_VISIBLES))
  })

  it('allume les ampoules du bas, pas celles du haut', () => {
    const { container } = render(<Ampoules annee={2026} comptes={COMPTES} moisCourant={9} />)

    const mars = ampoulesDe(colonnes(container)[2]!)
    expect(mars.slice(-3).every((ampoule) => ampoule.hasAttribute('data-allumee'))).toBe(true)
    expect(mars[0]).not.toHaveAttribute('data-allumee')
  })

  it('plafonne la colonne à onze ampoules et imprime le vrai compte au-dessus', () => {
    const { container } = render(<Ampoules annee={2026} comptes={[15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]} moisCourant={9} />)

    const janvier = colonnes(container)[0]!
    expect(janvier.querySelectorAll('[data-allumee]')).toHaveLength(AMPOULES_VISIBLES)
    expect(janvier.firstElementChild).toHaveTextContent('15')
  })

  it('souligne le mois courant, et lui seul', () => {
    const { container } = render(<Ampoules annee={2026} comptes={COMPTES} moisCourant={9} />)

    expect(container.querySelectorAll('[data-courant]')).toHaveLength(1)
    expect(colonnes(container)[9]).toHaveAttribute('data-courant')
    expect(colonnes(container)[9]).toHaveTextContent('OCT')
  })

  it('nomme les mois en trois lettres', () => {
    const { container } = render(<Ampoules annee={2026} comptes={COMPTES} moisCourant={9} />)

    expect(colonnes(container).map((colonne) => colonne.children[2]!.textContent)).toEqual([
      'JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC',
    ])
  })
})
