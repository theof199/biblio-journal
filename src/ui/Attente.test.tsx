import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Attente, { Barre } from './Attente'

describe('Attente', () => {
  it('annonce « Chargement… » comme un statut, par défaut', () => {
    render(<Attente>{null}</Attente>)

    expect(screen.getByRole('status')).toHaveTextContent('Chargement…')
  })

  it('annonce le libellé donné', () => {
    render(<Attente libelle="Recherche…">{null}</Attente>)

    expect(screen.getByRole('status')).toHaveTextContent('Recherche…')
  })

  it('cache ses formes aux lecteurs d’écran', () => {
    render(
      <Attente>
        <p>une forme</p>
      </Attente>,
    )

    expect(screen.getByText('une forme').closest('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.queryByRole('paragraph')).toBeNull()
  })

  it('muet, n’a ni rôle ni libellé', () => {
    const { container } = render(
      <Attente muet>
        <p>une forme</p>
      </Attente>,
    )

    // `hidden` : sans lui, l'`aria-hidden` du dessus suffirait seul à faire taire la requête.
    expect(screen.queryByRole('status', { hidden: true })).toBeNull()
    expect(container).not.toHaveTextContent('Chargement…')
  })

  it('muet, est caché tout entier aux lecteurs d’écran', () => {
    const { container } = render(
      <Attente muet>
        <p>une forme</p>
      </Attente>,
    )

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('porte la classe de la page qui l’emploie', () => {
    render(
      <Attente className="mise-en-page">
        <p>une forme</p>
      </Attente>,
    )

    expect(screen.getByRole('status')).toHaveClass('mise-en-page')
  })
})

describe('Barre', () => {
  it('prend la largeur demandée', () => {
    const { container: courte } = render(<Barre largeur="courte" />)
    const { container: longue } = render(<Barre largeur="longue" />)

    expect(courte.firstElementChild!.className).not.toBe(longue.firstElementChild!.className)
  })
})
