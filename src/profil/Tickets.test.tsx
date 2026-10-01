import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import Tickets from './Tickets'

const REACTIONS = [
  { cle: 'en_salle', emoji: '🍿', phrase: 'Vu en salle', nombre: 61 },
  { cle: 'adore', emoji: '😍', phrase: 'Coup de cœur', nombre: 30 },
]

describe('Tickets', () => {
  it('dessine un billet par réaction, dans l’ordre reçu', () => {
    render(<Tickets reactions={REACTIONS} />)

    const billets = screen.getAllByRole('listitem')
    expect(billets).toHaveLength(2)
    expect(billets[0]).toHaveTextContent('Vu en salle')
    expect(billets[1]).toHaveTextContent('Coup de cœur')
  })

  it('porte le compte et « fois » sur la souche', () => {
    render(<Tickets reactions={REACTIONS} />)

    const billet = screen.getAllByRole('listitem')[0]!
    expect(within(billet).getByText('61')).toBeInTheDocument()
    expect(within(billet).getByText('fois')).toBeInTheDocument()
  })

  it('allonge le billet à proportion du compte, le plus posé étant le plus long', () => {
    render(<Tickets reactions={REACTIONS} />)

    const [premier, second] = screen.getAllByRole('listitem')
    expect(premier!.style.getPropertyValue('--part')).toBe('1')
    expect(Number(second!.style.getPropertyValue('--part'))).toBeCloseTo(30 / 61)
  })

  it('cache l’emoji aux lecteurs d’écran : la phrase suffit', () => {
    render(<Tickets reactions={REACTIONS} />)

    expect(screen.getByText('🍿')).toHaveAttribute('aria-hidden', 'true')
  })
})
