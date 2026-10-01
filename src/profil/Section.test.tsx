import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Section from './Section'

describe('Section', () => {
  it('est une région nommée par son étiquette, qui porte son objet', () => {
    render(
      <Section titre="Notes">
        <p>l’objet</p>
      </Section>,
    )

    const region = screen.getByRole('region', { name: 'Notes' })
    expect(region).toHaveTextContent('l’objet')
    expect(screen.getByRole('heading', { level: 2, name: 'Notes' })).toBeInTheDocument()
  })
})
