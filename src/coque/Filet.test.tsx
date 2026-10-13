import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Coque from './Coque'

function PageCassee(): never {
  throw new Error('rendu impossible')
}

function monter() {
  return render(
    <MemoryRouter initialEntries={['/profil']}>
      <Routes>
        <Route element={<Coque />}>
          <Route path="profil" element={<PageCassee />} />
          <Route path="suivis" element={<h1>Suivis</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const barre = () => screen.getByRole('navigation', { name: 'Onglets' })

describe('le filet de la coque', () => {
  const locationOrigine = window.location

  beforeEach(() => {
    // React journalise l'erreur de rendu attendue : ce bruit n'est pas celui qu'on veut lire.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: vi.fn() },
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: locationOrigine,
    })
  })

  it('une page qui plante au rendu montre la panne, la barre d’onglets reste', () => {
    monter()

    expect(screen.getByRole('alert')).toHaveTextContent('Une erreur inattendue est survenue.')
    expect(within(barre()).getAllByRole('link')).toHaveLength(5)
  })

  it('« Réessayer » recharge la page', () => {
    monter()

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(window.location.reload).toHaveBeenCalledTimes(1)
  })

  it('un autre onglet, après l’erreur, montre sa page et non la panne', () => {
    monter()

    fireEvent.click(within(barre()).getByRole('link', { name: 'Suivis' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Suivis' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
