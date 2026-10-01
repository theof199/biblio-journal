import { describe, expect, it, vi } from 'vitest'
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

const QUATRE_FILMS: MoisDuJournal = {
  ...SEPTEMBRE,
  items: [...SEPTEMBRE.items, film('d', { titre: 'Faust', date: '2026-09-01', note: 7, annee: 1926, realisateur: 'F. W. Murnau' })],
}

function monter(mois: MoisDuJournal = SEPTEMBRE, { deroulee = false, onBasculer = () => {} }: { deroulee?: boolean; onBasculer?: () => void } = {}) {
  return render(
    <MemoryRouter>
      <Pellicule mois={mois} deroulee={deroulee} onBasculer={onBasculer} />
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
          <Route path="/" element={<Pellicule mois={SEPTEMBRE} deroulee={false} onBasculer={() => {}} />} />
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

describe('le bouton qui déroule un mois', () => {
  it('n’est pas proposé pour un mois de trois films ou moins', () => {
    monter()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('est proposé, enroulé, dès quatre films, et nomme son mois', () => {
    monter(QUATRE_FILMS)
    const bouton = screen.getByRole('button', { name: 'Dérouler Septembre 2026' })
    expect(bouton).toHaveAttribute('aria-expanded', 'false')
  })

  it('prévient l’appelant à chaque clic, une fois', () => {
    const onBasculer = vi.fn()
    monter(QUATRE_FILMS, { onBasculer })
    fireEvent.click(screen.getByRole('button', { name: /Dérouler/ }))
    expect(onBasculer).toHaveBeenCalledTimes(1)
  })

  it('propose de rembobiner un mois déroulé', () => {
    monter(QUATRE_FILMS, { deroulee: true })
    const bouton = screen.getByRole('button', { name: 'Rembobiner Septembre 2026' })
    expect(bouton).toHaveAttribute('aria-expanded', 'true')
  })

  it('désigne le conteneur de la liste des films', () => {
    monter(QUATRE_FILMS, { deroulee: true })
    const bouton = screen.getByRole('button')
    expect(screen.getByRole('list').parentElement).toHaveAttribute('id', bouton.getAttribute('aria-controls'))
  })
})

describe('la planche-contact d’un mois déroulé', () => {
  it('garde un lien par film, dans l’ordre du mois', () => {
    monter(QUATRE_FILMS, { deroulee: true })
    const liens = within(screen.getByRole('list')).getAllByRole('link')
    expect(liens.map((lien) => lien.getAttribute('href'))).toEqual(['/journal/a', '/journal/b', '/journal/c', '/journal/d'])
  })

  it('n’a pas d’amorce : une entrée de liste par film, pas une de plus', () => {
    monter(QUATRE_FILMS, { deroulee: true })
    expect(screen.getByRole('list').children).toHaveLength(QUATRE_FILMS.items.length)
  })

  it('n’imprime pas le jour où chaque film a été vu', () => {
    monter(QUATRE_FILMS, { deroulee: true })
    expect(screen.queryByText(/SEPT/)).not.toBeInTheDocument()
  })

  it('garde le rang de chaque vignette', () => {
    monter(QUATRE_FILMS, { deroulee: true })
    expect(vignettes().map((vignette) => vignette.firstElementChild?.textContent)).toEqual(['1', '2', '3', '4'])
  })

  it('garde sous chaque film son réalisateur et son année', () => {
    monter(QUATRE_FILMS, { deroulee: true })
    expect(screen.getByText('Fritz Lang · 1927')).toBeInTheDocument()
    expect(screen.getByText('F. W. Murnau · 1926')).toBeInTheDocument()
  })

  it('reste une bande, avec son amorce, quand le mois est tombé à trois films', () => {
    monter(SEPTEMBRE, { deroulee: true })
    expect(screen.getByRole('list').lastElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('reste une bande, avec son amorce, tant que le mois n’est pas déroulé', () => {
    monter(QUATRE_FILMS)
    expect(screen.getByRole('list').children).toHaveLength(QUATRE_FILMS.items.length + 1)
    expect(screen.getByText('28 SEPT')).toBeInTheDocument()
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

describe('la planche de la pellicule', () => {
  it('pose les vignettes à plat sur trois colonnes', () => {
    const film = regle(feuille, '.planche .film')
    expect(film).toMatch(/display:\s*grid;/)
    expect(film).toMatch(/grid-template-columns:\s*var\(--grille-planche-colonnes\);/)
  })

  it('ne déchire pas le bout de la base noire', () => {
    expect(regle(feuille, '.planche .film::before')).toMatch(/clip-path:\s*none;/)
  })

  it('pose sur toute la planche la base noire, sans les perforations de la bande', () => {
    expect(regle(feuille, '.planche .film::before')).toMatch(/background:\s*var\(--pellicule-base\);/)
    expect(theme).toMatch(/--pellicule-film:[^;]*var\(--pellicule-base\);/)
  })
})
