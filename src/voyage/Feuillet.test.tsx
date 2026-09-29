import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import Feuillet from './Feuillet'
import { creerRegistre } from '../mondes'
import feuille from './Feuillet.module.css?raw'

const monde = creerRegistre()(1890)

function monter(onFermer = vi.fn(), choisir = vi.fn()) {
  const vue = render(
    <Feuillet monde={monde} titre="Deuxième marche" onFermer={onFermer}>
      <button type="button" onClick={choisir}>
        Nosferatu
      </button>
    </Feuillet>,
  )
  return { ...vue, onFermer, choisir }
}

/** Le corps d'une règle de la feuille, tel qu'écrit. */
function regle(css: string, selecteur: string) {
  const debut = css.indexOf(`${selecteur} {`)
  if (debut < 0) throw new Error(`règle absente : ${selecteur}`)
  const reste = css.slice(debut)
  return reste.slice(reste.indexOf('{') + 1, reste.indexOf('}'))
}

// Le jumeau de la feuille du chroniqueur : le même dialogue, jusqu'au focus rendu.
describe('un feuillet', () => {
  // Mutation : le dialogue sans nom, ou nommé par autre chose que son titre.
  it('est un dialogue nommé par son titre, qui porte ses choix', () => {
    monter()
    expect(screen.getByRole('dialog', { name: 'Deuxième marche' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Nosferatu' })).toBeInTheDocument()
  })

  // Mutations : Échap non écouté ; le focus laissé à la page.
  it('prend le focus et se ferme à Échap', () => {
    const { onFermer } = monter()
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onFermer).toHaveBeenCalledOnce()
  })

  // Le jumeau d'Échap, le geste du téléphone. Mutation : le bouton « Fermer » sans son `onClick`.
  it('se ferme d’un toucher sur « Fermer »', () => {
    const { onFermer } = monter()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onFermer).toHaveBeenCalledOnce()
  })

  // Mutation : le focus non rendu à la fermeture.
  it('rend le focus, à la fermeture, à l’élément qui l’avait', () => {
    const vue = (ouvert: boolean) => (
      <>
        <button type="button">La deuxième marche</button>
        {ouvert ? (
          <Feuillet monde={monde} titre="Deuxième marche" onFermer={vi.fn()}>
            <p>Rien</p>
          </Feuillet>
        ) : null}
      </>
    )
    const { rerender } = render(vue(false))
    screen.getByRole('button', { name: 'La deuxième marche' }).focus()
    rerender(vue(true))
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus()
    rerender(vue(false))
    expect(screen.getByRole('button', { name: 'La deuxième marche' })).toHaveFocus()
  })

  // Mutations : un toucher sur le voile qui ne ferme pas ; un choix qui ferme aussi (le voile
  // posé autour du feuillet plutôt qu'à côté : le clic d'un choix y remonterait).
  it('se ferme d’un toucher sur le voile, jamais d’un choix', () => {
    const { onFermer, choisir, container } = monter()
    fireEvent.click(screen.getByRole('button', { name: 'Nosferatu' }))
    expect(choisir).toHaveBeenCalledOnce()
    expect(onFermer).not.toHaveBeenCalled()
    fireEvent.click(container.querySelector('[aria-hidden="true"]')!)
    expect(onFermer).toHaveBeenCalledOnce()
  })

  // Mutation : les jetons du monde oubliés : le papier retomberait sur les valeurs héritées.
  it('pose les jetons de son monde', () => {
    const { container } = monter()
    expect(container.querySelector<HTMLElement>(':scope > div')!.style.getPropertyValue('--m-papier')).toBe(monde.pages.jetons['--m-papier'])
  })

  // Mutations : la hauteur des choix retirée, ou abaissée ; le bouton « Fermer » sous la cible tactile.
  it('fait 44 px au moins à chaque ligne touchable et à « Fermer »', () => {
    expect(regle(feuille, '.choix :is(button, a)')).toMatch(/min-height:\s*44px/)
    expect(regle(feuille, '.fermer')).toMatch(/min-height:\s*44px/)
    expect(regle(feuille, '.fermer')).toMatch(/min-width:\s*44px/)
  })
})
