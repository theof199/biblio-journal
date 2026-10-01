import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Perforations from './Perforations'

const COMPTES = [0, 0, 0, 3, 12, 41, 58, 37, 0, 22, 19, 0, 88, 0]

describe('Perforations', () => {
  it('liste le compte de chacune des quatorze décennies', () => {
    render(<Perforations comptes={COMPTES} />)

    const nom = screen.getByRole('img').getAttribute('aria-label')
    expect(nom).toMatch(/^Films par décennie : 1890 : 0, 1900 : 0,/)
    expect(nom).toMatch(/1920 : 3,.*2010 : 88, 2020 : 0$/)
  })

  it('allume un repère par décennie où un film est sorti, et lui seul', () => {
    const { container } = render(<Perforations comptes={COMPTES} />)

    expect(container.querySelectorAll('li')).toHaveLength(14)
    expect(container.querySelectorAll('[data-allume]')).toHaveLength(8)
    expect(container.querySelectorAll('li')[3]).toHaveAttribute('data-allume')
    expect(container.querySelectorAll('li')[0]).not.toHaveAttribute('data-allume')
  })

  it('imprime l’année en deux morceaux, pour que la feuille puisse ôter le siècle', () => {
    const { container } = render(<Perforations comptes={COMPTES} />)

    const annee = container.querySelectorAll('li')[3]!.lastElementChild!
    expect(annee.children[0]).toHaveTextContent('19')
    expect(annee.children[1]).toHaveTextContent('20')
  })
})
