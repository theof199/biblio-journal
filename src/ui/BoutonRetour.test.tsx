import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BrowserRouter, Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import BoutonRetour from './BoutonRetour'

/** La page d'arrivée dit où elle est et l'état qu'elle a reçu : une navigation se constate. */
function Page({ nom }: { nom: string }) {
  const { state } = useLocation()
  return <h1>{`${nom} ${JSON.stringify(state)}`}</h1>
}

/** Le vrai historique de jsdom, sous le routeur de l'app : c'est lui que `idx` renseigne. */
function monter() {
  render(
    <BrowserRouter>
      <Routes>
        <Route path="/liste" element={<Link to="/fiche">ouvrir</Link>} />
        <Route path="/fiche" element={<BoutonRetour vers="/repli" etat={{ item: 1 }} />} />
        <Route path="/repli" element={<Page nom="repli" />} />
        <Route path="/dehors" element={<Page nom="dehors" />} />
      </Routes>
    </BrowserRouter>,
  )
}

describe('le bouton Retour', () => {
  // L'historique de jsdom dure tout le fichier : chaque test pose une entrée neuve, sans état.
  beforeEach(() => window.history.pushState(null, '', '/dehors'))

  it('avec une page de l’app derrière, il recule dans l’historique plutôt que d’aller à `vers`', async () => {
    window.history.pushState(null, '', '/liste')
    monter()
    fireEvent.click(screen.getByRole('link', { name: 'ouvrir' }))

    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))

    expect(await screen.findByRole('link', { name: 'ouvrir' })).toBeInTheDocument()
  })

  it('ouverte d’un lien, sans rien de l’app derrière, la page mène à `vers` avec son état', async () => {
    window.history.pushState(null, '', '/fiche')
    monter()

    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))

    expect(await screen.findByRole('heading', { name: 'repli {"item":1}' })).toBeInTheDocument()
  })

  it('première entrée remplacée par une redirection de l’app : `vers` encore, jamais la page d’avant l’app', async () => {
    // Ce que React Router écrit quand il remplace la première entrée : une clé, mais `idx` à 0.
    window.history.pushState({ usr: null, key: 'redirigee', idx: 0 }, '', '/fiche')
    monter()

    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))

    expect(await screen.findByRole('heading', { name: 'repli {"item":1}' })).toBeInTheDocument()
  })

  it('sous un routeur en mémoire (les tests des pages), la première entrée mène à `vers`', async () => {
    window.history.replaceState(null, '', '/')
    render(
      <MemoryRouter initialEntries={['/fiche']}>
        <Routes>
          <Route path="/fiche" element={<BoutonRetour vers="/repli" />} />
          <Route path="/repli" element={<Page nom="repli" />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))

    expect(await screen.findByRole('heading', { name: 'repli null' })).toBeInTheDocument()
  })
})
