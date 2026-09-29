import { describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useCalque } from './calque'

function Page() {
  const feuille = useCalque('feuille')
  const { pathname, search } = useLocation()
  const naviguer = useNavigate()
  return (
    <div>
      <p data-testid="adresse">{`${pathname}${search}`}</p>
      <button type="button" onClick={() => feuille.ouvrir('ouverture')}>
        Ouvrir
      </button>
      <button type="button" onClick={() => naviguer(-1)}>
        Retour du téléphone
      </button>
      {feuille.valeur ? (
        <div role="dialog" aria-label={feuille.valeur}>
          <button type="button" onClick={feuille.fermer}>
            Fermer
          </button>
        </div>
      ) : null}
    </div>
  )
}

const monter = (entrees: string[]) =>
  render(
    <MemoryRouter initialEntries={entrees} initialIndex={entrees.length - 1}>
      <Routes>
        <Route path="/voyage" element={<p>La carte</p>} />
        <Route path="/voyage/:annee" element={<Page />} />
      </Routes>
    </MemoryRouter>,
  )

describe('un calque dans l’adresse', () => {
  // Mutation : `fermer` qui retire toujours le paramètre (sans reculer) : l'entrée du calque
  // resterait dans l'historique, et le retour du téléphone, après la fermeture, resterait sur la page.
  it('ouvert par la page, se ferme en reculant d’une entrée', () => {
    monter(['/voyage', '/voyage/1897'])
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect(screen.getByRole('dialog', { name: 'ouverture' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('adresse')).toHaveTextContent(/^\/voyage\/1897$/)
    fireEvent.click(screen.getByRole('button', { name: 'Retour du téléphone' }))
    expect(screen.getByText('La carte')).toBeInTheDocument()
  })

  // Mutation : `fermer` qui recule toujours : ouvert d'un lien, il quitterait la page pour la carte.
  it('arrivé avec l’adresse, se ferme sans quitter la page', () => {
    monter(['/voyage', '/voyage/1897?feuille=ouverture'])
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('adresse')).toHaveTextContent(/^\/voyage\/1897$/)
  })

  // Les jumeaux, sur ce que l'adresse porte d'autre (la bobine d'un billet). Mutations : `ouvrir` qui
  // part d'une adresse vide (`new URLSearchParams()`) ; `fermer`, arrivé d'un lien, qui retire tout.
  it('garde les autres paramètres de l’adresse, à l’ouverture comme à la fermeture', () => {
    monter(['/voyage', '/voyage/1897?bobine=12'])
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect(screen.getByTestId('adresse')).toHaveTextContent(/^\/voyage\/1897\?bobine=12&feuille=ouverture$/)
    cleanup()
    monter(['/voyage', '/voyage/1897?bobine=12&feuille=ouverture'])
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(screen.getByTestId('adresse')).toHaveTextContent(/^\/voyage\/1897\?bobine=12$/)
  })

  // Mutation : `ouvertIci` qui ne regarde pas le nom du calque (`state.calque !== undefined`) : la
  // feuille arrivée d'un lien reculerait, et fermerait la marche ouverte par la page à sa place.
  it('ne recule que pour le calque que la page a ouvert', () => {
    function DeuxCalques() {
      const feuille = useCalque('feuille')
      const marche = useCalque('marche')
      const { search } = useLocation()
      return (
        <div>
          <p data-testid="adresse">{search}</p>
          <button type="button" onClick={() => marche.ouvrir('2')}>
            Ouvrir la marche
          </button>
          <button type="button" onClick={feuille.fermer}>
            Fermer la feuille
          </button>
        </div>
      )
    }
    render(
      <MemoryRouter initialEntries={['/voyage', '/voyage/1897?feuille=ouverture']} initialIndex={1}>
        <Routes>
          <Route path="/voyage" element={<p>La carte</p>} />
          <Route path="/voyage/:annee" element={<DeuxCalques />} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la marche' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la feuille' }))
    expect(screen.getByTestId('adresse')).toHaveTextContent(/^\?marche=2$/)
  })
})
