import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CarteAdherent from './CarteAdherent'

const monter = (surcharge: Partial<Parameters<typeof CarteAdherent>[0]> = {}) =>
  render(
    <MemoryRouter>
      <CarteAdherent pseudo="léa" films={412} heures={213} cetteAnnee={8} sansDuree={12} depuis={2019} {...surcharge} />
    </MemoryRouter>,
  )

describe('CarteAdherent', () => {
  it('est un lien vers Mes films, nommé par le pseudo et les chiffres', () => {
    monter()

    const lien = screen.getByRole('link', { name: 'Mes films, carte de léa : 412 films · 213 h' })
    expect(lien).toHaveAttribute('href', '/profil/mes-films')
  })

  it('met en capitale la première lettre du pseudo dans le sceau', () => {
    monter()

    expect(screen.getByText('L')).toBeInTheDocument()
  })

  it('met au singulier un seul film', () => {
    monter({ films: 1, cetteAnnee: 1, sansDuree: 1 })

    expect(screen.getByText('1 film · 213 h')).toBeInTheDocument()
    expect(screen.getByText('1 film cette année')).toBeInTheDocument()
    expect(screen.getByText('1 film sans durée')).toBeInTheDocument()
  })

  it('met au pluriel dès deux films', () => {
    monter({ films: 2, cetteAnnee: 2, sansDuree: 2 })

    expect(screen.getByText('2 films · 213 h')).toBeInTheDocument()
    expect(screen.getByText('2 films sans durée')).toBeInTheDocument()
  })

  it('dit les films sans durée au pluriel', () => {
    monter()

    expect(screen.getByText('12 films sans durée')).toBeInTheDocument()
  })

  it('ne dit rien des durées quand aucune ne manque', () => {
    monter({ sansDuree: 0 })

    expect(screen.queryByText(/sans durée/)).not.toBeInTheDocument()
  })

  it('n’imprime que les films tant que les heures manquent', () => {
    monter({ heures: null })

    expect(screen.getByText('412 films')).toBeInTheDocument()
  })

  it('n’imprime aucun chiffre tant que /stats manque', () => {
    monter({ films: null, heures: null, cetteAnnee: null })

    expect(screen.getByRole('link', { name: 'Mes films, carte de léa' })).toBeInTheDocument()
    expect(screen.queryByText(/ · /)).not.toBeInTheDocument()
    expect(screen.queryByText(/cette année/)).not.toBeInTheDocument()
  })

  it('n’écrit pas « membre depuis » sans année', () => {
    monter({ depuis: null })

    expect(screen.queryByText(/Membre depuis/)).not.toBeInTheDocument()
  })

  it('écrit « membre depuis » avec l’année', () => {
    monter()

    expect(screen.getByText('Membre depuis 2019')).toBeInTheDocument()
  })

  it('en attendant les chiffres, tient leur place d’une barre muette', () => {
    monter({ films: null, heures: null, cetteAnnee: null, sansDuree: 0, enAttente: true })

    expect(screen.getByTestId('chiffres-en-attente')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('sans les chiffres et sans attente (une panne), ne dessine rien à leur place', () => {
    monter({ films: null, heures: null, cetteAnnee: null, sansDuree: 0 })

    expect(screen.queryByTestId('chiffres-en-attente')).not.toBeInTheDocument()
  })

  it('une fois les chiffres arrivés, la barre s’en va même si l’attente n’est pas retombée', () => {
    monter({ enAttente: true })

    expect(screen.queryByTestId('chiffres-en-attente')).not.toBeInTheDocument()
    expect(screen.getByText('412 films · 213 h')).toBeInTheDocument()
  })
})
