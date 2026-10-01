import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BandeVoyage from './BandeVoyage'
import styles from './BandeVoyage.module.css'
import { annee, voyage1890 } from '../test/voyage'
import type { Progression, Voyage } from '../api/voyage'

const progression = (vus: number, total: number): Progression => ({
  essentiels_vus: vus,
  essentiels_total: total,
  salles_completes: 0,
  salles_autres: 0,
})

function voyageA1927(progressionDeLAnnee: Progression | null, surcharge: Partial<Voyage> = {}): Voyage {
  return voyage1890(1927, [annee({ annee: 1926, progression: progression(9, 9) }), annee({ annee: 1927, progression: progressionDeLAnnee })], surcharge)
}

function monter(voyage: Voyage) {
  return render(
    <MemoryRouter>
      <BandeVoyage voyage={voyage} />
    </MemoryRouter>,
  )
}

describe('la bande du Voyage', () => {
  it('mène au Voyage, nommé de l’année où il en est', () => {
    monter(voyageA1927(progression(3, 5), { source: null }))
    const lien = screen.getByRole('link')
    expect(lien).toHaveAttribute('href', '/voyage')
    expect(lien).toHaveTextContent('Le Voyage1927')
  })

  it('compte les essentiels vus de l’année en cours sur leur total', () => {
    monter(voyageA1927(progression(3, 5)))
    expect(screen.getByText('3 essentiels sur 5')).toBeInTheDocument()
  })

  it('ne compte pas ceux d’une autre année', () => {
    monter(voyageA1927(progression(3, 5)))
    expect(screen.queryByText('9 essentiels sur 9')).not.toBeInTheDocument()
  })

  it('accorde « essentiel » au singulier pour un seul vu', () => {
    monter(voyageA1927(progression(1, 5)))
    expect(screen.getByText('1 essentiel sur 5')).toBeInTheDocument()
  })

  it('accorde « essentiels » au pluriel dès deux vus', () => {
    monter(voyageA1927(progression(2, 5)))
    expect(screen.getByText('2 essentiels sur 5')).toBeInTheDocument()
  })

  it('accorde « essentiel » au singulier aussi quand aucun n’est encore vu', () => {
    monter(voyageA1927(progression(0, 5)))
    expect(screen.getByText('0 essentiel sur 5')).toBeInTheDocument()
  })

  it('pose une case par essentiel, pleine pour ceux qui sont vus', () => {
    const { container } = monter(voyageA1927(progression(3, 5)))
    expect(container.querySelectorAll(`.${styles.pleine}`)).toHaveLength(3)
    expect(container.querySelectorAll(`.${styles.vide}`)).toHaveLength(2)
  })

  it('n’écrit ni cases ni total sans progression', () => {
    const { container } = monter(voyageA1927(null))
    expect(screen.queryByText(/essentiel/)).not.toBeInTheDocument()
    expect(container.querySelectorAll(`.${styles.pleine}, .${styles.vide}`)).toHaveLength(0)
  })

  it('n’écrit pas d’année suivie quand le Voyage n’en suit aucun', () => {
    monter(voyageA1927(progression(3, 5), { source: null }))
    expect(screen.queryByText(/ est en /)).not.toBeInTheDocument()
  })

  it('dit où en est le membre dont on suit le Voyage', () => {
    monter(voyageA1927(progression(3, 5), { source: { id: 'a0000000-0000-4000-8000-000000000002', pseudo: 'Camille', annee_en_cours: 1931 } }))
    expect(screen.getByText('Camille est en 1931')).toBeInTheDocument()
  })
})
