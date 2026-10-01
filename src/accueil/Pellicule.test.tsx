import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import Pellicule from './Pellicule'
import { visionnage } from '../test/journal'
import feuille from './Pellicule.module.css?raw'
import page from '../pages/Accueil.module.css?raw'
import theme from '../ui/theme.css?raw'
import type { JournalItem } from '../api/journal'
import type { MoisDuJournal } from './journalParMois'

function film(id: string, o: { titre: string; date: string; note?: number | null; annee?: number | null; realisateur?: string | null; affiche?: string | null }): JournalItem {
  const base = visionnage({ id, titre: o.titre, date: o.date, note: o.note ?? null, annee: o.annee })
  return { ...base, media: { ...base.media, director: o.realisateur === undefined ? 'Fritz Lang' : o.realisateur, cover_url: o.affiche === undefined ? `/covers/${id}.jpg` : o.affiche } }
}

const SEPTEMBRE: MoisDuJournal = {
  cle: '2026-09',
  libelle: 'Septembre 2026',
  items: [
    film('a', { titre: 'Metropolis', date: '2026-09-28', note: 9, annee: 1927 }),
    film('b', { titre: 'Le Kid', date: '2026-09-19', note: 8, annee: 1921, realisateur: 'Charlie Chaplin' }),
    film('c', { titre: 'Sunrise', date: '2026-09-04', note: null, annee: 1927, realisateur: null }),
  ],
}

function monter(mois: MoisDuJournal = SEPTEMBRE) {
  return render(
    <MemoryRouter>
      <Pellicule mois={mois} />
    </MemoryRouter>,
  )
}

const vignettes = () => screen.getAllByRole('listitem')

describe('la pellicule d’un mois', () => {
  it('titre la bande du nom du mois', () => {
    monter()
    expect(screen.getByRole('heading', { level: 3, name: 'Septembre 2026' })).toBeInTheDocument()
  })

  it('dit combien de séances le mois compte', () => {
    monter()
    expect(screen.getByText('3 séances')).toBeInTheDocument()
  })

  it('accorde « séance » au singulier pour une seule', () => {
    monter({ ...SEPTEMBRE, items: [SEPTEMBRE.items[0]!] })
    expect(screen.getByText('1 séance')).toBeInTheDocument()
  })

  it('est une liste de films, un lien par film, dans l’ordre du mois', () => {
    monter()
    const liens = within(screen.getByRole('list')).getAllByRole('link')
    expect(liens.map((lien) => lien.getAttribute('href'))).toEqual(['/journal/a', '/journal/b', '/journal/c'])
  })

  it('passe à la fiche l’entrée déjà connue', () => {
    function Arrivee() {
      const { state } = useLocation() as { state: { item: JournalItem } | null }
      return <p>Arrivée avec {state?.item.media.title ?? 'rien'}</p>
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Pellicule mois={SEPTEMBRE} />} />
          <Route path="/journal/:id" element={<Arrivee />} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('link', { name: /Le Kid/ }))
    expect(screen.getByText('Arrivée avec Le Kid')).toBeInTheDocument()
  })

  it('nomme chaque lien du titre du film et de sa note, sans rien répéter', () => {
    monter()
    const liens = screen.getAllByRole('link')
    expect(liens[0]).toHaveAccessibleName(/^Metropolis\s?Noté 9 sur 10$/)
    expect(liens[1]).toHaveAccessibleName(/^Le Kid\s?Noté 8 sur 10$/)
    expect(liens[2]).toHaveAccessibleName('Sunrise')
  })

  it('imprime sur le bord du film le jour où chaque film a été vu', () => {
    monter()
    expect(vignettes().slice(0, 3).map((vignette) => vignette.firstElementChild?.firstElementChild?.textContent)).toEqual(['28 SEPT', '19 SEPT', '4 SEPT'])
  })

  it('numérote les vignettes par rang dans le mois, à partir de 1', () => {
    monter()
    expect(vignettes().slice(0, 3).map((vignette) => vignette.firstElementChild?.lastElementChild?.textContent)).toEqual(['1', '2', '3'])
  })

  it('écrit sous chaque film son réalisateur et son année', () => {
    monter()
    expect(screen.getByText('Fritz Lang · 1927')).toBeInTheDocument()
    expect(screen.getByText('Charlie Chaplin · 1921')).toBeInTheDocument()
  })

  it('n’écrit que l’année sous un film sans réalisateur', () => {
    monter()
    expect(screen.getByText('1927', { selector: 'p' })).toBeInTheDocument()
  })

  it('n’écrit rien sous un film sans réalisateur ni année', () => {
    monter({ ...SEPTEMBRE, items: [film('z', { titre: 'Sans date', date: '2026-09-01', annee: null, realisateur: null })] })
    expect(screen.queryByText(/·/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')[0]!.querySelector('p')).toBeNull()
  })

  it('pose la note sur la vignette, et rien pour un film non noté', () => {
    monter()
    expect(screen.getByLabelText('Noté 9 sur 10')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/Noté \d+ sur 10/)).toHaveLength(2)
  })

  it('termine la bande par l’amorce, cachée aux lecteurs d’écran', () => {
    monter()
    const amorce = screen.getByRole('list').lastElementChild!
    expect(amorce).toHaveAttribute('aria-hidden', 'true')
    expect(amorce).toHaveTextContent('3')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('cache aux lecteurs d’écran la date et le rang imprimés sur le bord', () => {
    monter()
    expect(screen.getByText('28 SEPT').parentElement).toHaveAttribute('aria-hidden', 'true')
  })

  it('montre l’affiche du film quand il en a une', () => {
    monter()
    expect(screen.getByAltText('Metropolis')).toHaveAttribute('src', '/covers/a.jpg')
  })

  it('montre, à défaut d’affiche, le titre en enseigne de la décennie du film', () => {
    monter({ ...SEPTEMBRE, items: [film('s', { titre: 'Sunrise', date: '2026-09-04', annee: 1927, affiche: null })] })
    const enseigne = screen.getByRole('img', { name: 'Sunrise' })
    expect(enseigne).toHaveAttribute('data-decennie', '1920')
    expect(screen.queryByRole('img', { name: 'Sunrise' })?.querySelector('img')).toBeNull()
  })

  it('nomme le film sans affiche par son titre, une fois', () => {
    monter({ ...SEPTEMBRE, items: [film('s', { titre: 'Sunrise', date: '2026-09-04', annee: 1927, affiche: null, note: 7 })] })
    expect(screen.getByRole('link', { name: /^Sunrise\s?Noté 7 sur 10$/ })).toBeInTheDocument()
  })
})

/** Le corps de la règle d'un sélecteur, tel qu'écrit. */
function regle(css: string, selecteur: string): string {
  const debut = css.indexOf(`${selecteur} {`)
  if (debut < 0) throw new Error(`règle absente : ${selecteur}`)
  return css.slice(css.indexOf('{', debut) + 1, css.indexOf('}', debut))
}

describe('la bande de la pellicule', () => {
  it('défile de côté et se cale sur ses vignettes', () => {
    const defilement = regle(feuille, '.defilement')
    expect(defilement).toMatch(/overflow-x:\s*auto;/)
    expect(defilement).toMatch(/scroll-snap-type:\s*x mandatory;/)
  })

  it('cache sa barre de défilement', () => {
    expect(regle(feuille, '.defilement')).toMatch(/scrollbar-width:\s*none;/)
    expect(regle(feuille, '.defilement::-webkit-scrollbar')).toMatch(/display:\s*none;/)
  })

  it('va jusqu’au bord droit de l’écran : elle dépasse de la marge que la page lui laisse', () => {
    expect(regle(feuille, '.defilement')).toMatch(/margin-right:\s*var\(--debord-page\);/)
    expect(theme).toMatch(/--debord-page:\s*calc\(-1 \* var\(--gouttiere-page\)\);/)
    expect(regle(page, '.page')).toMatch(/padding:[^;]*var\(--gouttiere-page\)/)
  })

  it('cale l’amorce à la fin de la bande, pour qu’on puisse y arriver', () => {
    expect(regle(feuille, '.amorce')).toMatch(/scroll-snap-align:\s*end;/)
  })

  it('déchire le bout de la bande', () => {
    expect(regle(feuille, '.film::before')).toMatch(/clip-path:\s*var\(--pellicule-fin\);/)
  })
})
