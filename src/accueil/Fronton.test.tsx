import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import Fronton from './Fronton'
import styles from './Fronton.module.css'
import type { EtatFronton } from './fronton'

const SEANCE: EtatFronton = {
  genre: 'seance',
  decennie: 1920,
  lignes: [
    { role: 'jour', texte: 'Mercredi 30 septembre' },
    { role: 'etiquette', texte: 'Ce soir' },
    { role: 'titre', texte: 'Metropolis' },
    { role: 'detail', texte: 'Voyage 1927' },
  ],
  cible: { to: '/voyage' },
}

const PROCHAINEMENT: EtatFronton = {
  genre: 'prochainement',
  decennie: 1920,
  lignes: [
    { role: 'jour', texte: 'Mercredi 30 septembre' },
    { role: 'etiquette', texte: 'Prochainement' },
    { role: 'titreCompact', texte: 'Le Mécano de' },
    { role: 'titreCompact', texte: 'la « General »' },
    { role: 'accent', texte: 'Buster Keaton · 1926' },
  ],
  cible: {
    to: '/journal/nouveau',
    state: { candidat: { source: 'tmdb', external_id: '2', title: 'Le Mécano de la « General »', year: 1926, cover_url: null, director: 'Buster Keaton' } },
  },
}

function monter(etat: EtatFronton) {
  return render(
    <MemoryRouter>
      <Fronton etat={etat} />
    </MemoryRouter>,
  )
}

/** Une page d'arrivée qui dit ce que le lien lui a passé. */
function Arrivee() {
  const { state } = useLocation() as { state: { candidat: { title: string } } | null }
  return <p>Arrivée avec {state?.candidat.title ?? 'rien'}</p>
}

describe('le fronton', () => {
  it('écrit le jour dans le titre de la page', () => {
    monter(SEANCE)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mercredi 30 septembre')
  })

  it('écrit les autres lignes dans l’ordre du panneau', () => {
    const { container } = monter(SEANCE)
    const lignes = [...container.querySelectorAll(`.${styles.ligne}`)].map((ligne) => ligne.textContent)
    expect(lignes).toEqual(['Mercredi 30 septembre', 'Ce soir', 'Metropolis', 'Voyage 1927'])
  })

  it('range chaque ligne selon son rôle', () => {
    const { container } = monter(PROCHAINEMENT)
    const classes = [...container.querySelectorAll(`.${styles.ligne}`)].map((ligne) => ligne.className)
    expect(classes[2]).toContain(styles.titreCompact!)
    expect(classes[4]).toContain(styles.accent!)
  })

  it('est un seul lien, qui mène à ce que le panneau annonce', () => {
    monter(SEANCE)
    const liens = screen.getAllByRole('link')
    expect(liens).toHaveLength(1)
    expect(liens[0]).toHaveAttribute('href', '/voyage')
  })

  it('passe au formulaire le film annoncé', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Fronton etat={PROCHAINEMENT} />} />
          <Route path="/journal/nouveau" element={<Arrivee />} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('link'))
    expect(screen.getByText('Arrivée avec Le Mécano de la « General »')).toBeInTheDocument()
  })

  it('dit à chaque ligne combien de lettres elle porte, pour que ses lettres tiennent dans le panneau', () => {
    const { container } = monter(SEANCE)
    const titre = container.querySelector(`.${styles.titre}`) as HTMLElement
    expect(titre.style.getPropertyValue('--longueur')).toBe('10')
  })

  it('garde la casse du texte dans le document : les capitales sont l’affaire de la feuille', () => {
    monter(SEANCE)
    expect(screen.getByText('Metropolis')).toBeInTheDocument()
  })

  it('pose la décennie du film annoncé sur le lien, d’où la feuille tire l’enseigne', () => {
    monter(SEANCE)
    expect(screen.getByRole('link')).toHaveAttribute('data-decennie', '1920')
  })

  it('relit le titre dans data-texte pour sa face, sur les lignes de titre seulement', () => {
    const { container } = monter(PROCHAINEMENT)
    const relus = [...container.querySelectorAll('[data-texte]')].map((ligne) => ligne.getAttribute('data-texte'))
    expect(relus).toEqual(['Le Mécano de', 'la « General »'])
  })

  it('ne double aucun texte dans le lien : la face du titre n’est pas un second texte', () => {
    monter(SEANCE)
    expect(screen.getByRole('link').textContent).toBe('Mercredi 30 septembreCe soirMetropolisVoyage 1927')
  })

  it('lit les deux lignes d’un titre coupé à la taille de la plus longue', () => {
    const { container } = monter(PROCHAINEMENT)
    const longueurs = [...container.querySelectorAll(`.${styles.titreCompact}`)].map((ligne) => (ligne as HTMLElement).style.getPropertyValue('--longueur'))
    expect(longueurs).toEqual(['14', '14'])
  })
})
