import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Eventail from './Eventail'
import styles from './Eventail.module.css'
import feuille from './Eventail.module.css?raw'
import type { CarteEventail } from './eventail'

const SEANCE: CarteEventail = {
  cle: 'seance-1',
  etiquette: 'Ce soir',
  titre: 'Metropolis',
  meta: 'Voyage 1927',
  afficheUrl: 'https://exemple.test/metropolis.jpg',
  ceSoir: true,
  cible: { to: '/voyage' },
}

const carteEnsuite = (cle: string, titre: string, surcharge: Partial<CarteEventail> = {}): CarteEventail => ({
  cle,
  etiquette: 'Sur Plex',
  titre,
  meta: '1942',
  afficheUrl: null,
  ceSoir: false,
  cible: { to: '/journal/nouveau', state: { candidat: { source: 'tmdb', external_id: cle, title: titre, year: 1942, cover_url: null, director: null } } },
  ...surcharge,
})

const CASABLANCA = carteEnsuite('ensuite-1', 'Casablanca')
const KEATON = carteEnsuite('ensuite-2', 'Le Mécano de la « General »', { etiquette: 'Buster Keaton', meta: 'Buster Keaton · 1926' })
const KONG = carteEnsuite('ensuite-3', 'King Kong', { etiquette: 'Saga King Kong', meta: '1933' })

function monter(cartes: CarteEventail[]) {
  return render(
    <MemoryRouter>
      <Eventail cartes={cartes} />
    </MemoryRouter>,
  )
}

const legende = (container: HTMLElement) => container.querySelector(`.${styles.legende}`) as HTMLElement

describe('l’éventail', () => {
  it('ne rend rien sans carte', () => {
    const { container } = monter([])
    expect(container).toBeEmptyDOMElement()
  })

  it('rend une seule carte, sans rien à toucher', () => {
    monter([SEANCE])
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('rend quatre cartes : celle de face est un lien, les trois autres se touchent', () => {
    monter([SEANCE, CASABLANCA, KEATON, KONG])
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('mène la carte de face à son film, l’affiche pour nom', () => {
    monter([SEANCE, CASABLANCA])
    expect(screen.getByRole('link', { name: 'Metropolis' })).toHaveAttribute('href', '/voyage')
  })

  it('nomme chaque carte du fond par ce que toucher en fait', () => {
    monter([SEANCE, CASABLANCA, KEATON])
    expect(screen.getByRole('button', { name: 'Mettre en avant : Casablanca' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mettre en avant : Le Mécano de la « General »' })).toBeInTheDocument()
  })

  it('légende la carte de face : pastille, titre et ligne du dessous', () => {
    const { container } = monter([SEANCE, CASABLANCA])
    expect(legende(container)).toHaveTextContent('Ce soirMetropolisVoyage 1927')
  })

  it('passe devant la carte touchée, qui devient le lien vers son film', () => {
    monter([SEANCE, CASABLANCA, KEATON])
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en avant : Casablanca' }))
    expect(screen.getByRole('link', { name: 'Casablanca' })).toHaveAttribute('href', '/journal/nouveau')
    expect(screen.queryByRole('link', { name: 'Metropolis' })).not.toBeInTheDocument()
  })

  it('rend la place à l’ancienne carte de face, qui se touche à son tour', () => {
    monter([SEANCE, CASABLANCA])
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en avant : Casablanca' }))
    expect(screen.getByRole('button', { name: 'Mettre en avant : Metropolis' })).toBeInTheDocument()
  })

  it('change la légende avec la carte de face', () => {
    const { container } = monter([SEANCE, CASABLANCA])
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en avant : Casablanca' }))
    expect(legende(container)).toHaveTextContent('Sur PlexCasablanca1942')
  })

  it('n’écrit pas de ligne du dessous quand la carte n’en a pas', () => {
    const { container } = monter([{ ...CASABLANCA, meta: '' }])
    expect(legende(container).querySelectorAll('p')).toHaveLength(1)
  })

  it('met un point par carte quand il y en a plusieurs, pour le regard seul', () => {
    const { container } = monter([SEANCE, CASABLANCA, KEATON, KONG])
    const points = container.querySelector(`.${styles.points}`)
    expect(points).toHaveAttribute('aria-hidden', 'true')
    expect(points?.children).toHaveLength(4)
  })

  it('marque d’un point plein la carte de face', () => {
    const { container } = monter([SEANCE, CASABLANCA])
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en avant : Casablanca' }))
    const points = [...(container.querySelector(`.${styles.points}`)?.children ?? [])]
    expect(points.map((point) => point.classList.contains(styles.actif!))).toEqual([false, true])
  })

  it('ne met aucun point pour une seule carte', () => {
    const { container } = monter([SEANCE])
    expect(container.querySelector(`.${styles.points}`)).toBeNull()
  })

  it('remet la première carte devant quand celle de face disparaît de la liste', () => {
    const { rerender } = monter([SEANCE, CASABLANCA, KEATON])
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en avant : Le Mécano de la « General »' }))
    rerender(
      <MemoryRouter>
        <Eventail cartes={[SEANCE, CASABLANCA]} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Metropolis' })).toBeInTheDocument()
  })

  it('garde devant la carte choisie quand une autre arrive en tête de liste', () => {
    const { rerender } = monter([CASABLANCA, KEATON])
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en avant : Le Mécano de la « General »' }))
    rerender(
      <MemoryRouter>
        <Eventail cartes={[SEANCE, CASABLANCA, KEATON]} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Le Mécano de la « General »' })).toBeInTheDocument()
  })

  it('range les cartes de deux à part : la première ne se place pas comme pour trois', () => {
    const { container } = monter([SEANCE, CASABLANCA])
    expect(container.querySelector(`.${styles.scene}`)).toHaveClass(styles.duo!)
  })

  it('ne met pas la scène en duo à trois cartes', () => {
    const { container } = monter([SEANCE, CASABLANCA, KEATON])
    expect(container.querySelector(`.${styles.scene}`)).not.toHaveClass(styles.duo!)
  })

  it('arrête les déplacements sous mouvement réduit', () => {
    expect(feuille).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.carte\s*\{\s*transition:\s*none/)
  })
})
