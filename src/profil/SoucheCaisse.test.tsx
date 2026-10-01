import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SoucheCaisse from './SoucheCaisse'

describe('SoucheCaisse', () => {
  it('est un lien vers les réglages, qui annonce ce qu’on y trouve', () => {
    render(
      <MemoryRouter>
        <SoucheCaisse />
      </MemoryRouter>,
    )

    const lien = screen.getByRole('link', { name: /^Journal, la caisse/ })
    expect(lien).toHaveAttribute('href', '/profil/reglages')
    expect(lien).toHaveTextContent('Jour ou nuit · Letterboxd · doublons · se déconnecter')
  })
})
