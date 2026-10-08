import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Halte, Voyage } from '../../../api/voyage'
import { creerRegistre } from '../..'
import { exemple } from '../../../test/contrat'
import { GARDE_DU_CHOIX } from '../../../voyage/celebrations/deroule'
import { compteDeLaHalte } from '../../../voyage/halte/compte'
import HalteDeLaCarte from './HalteDeLaCarte'
import { compteDit, compteLu, enteteDeLaHalte } from './halte'

// La halte ouverte sur la carte de 1900 (plan des écrans des lots, brief 12) : ce qu'elle dit et ce
// qu'elle offre, jamais son tracé. La page et le bloc lecteur sont tenus par `pages/Carte.halte.test.tsx`.
const monde = creerRegistre()(1900)
const MELIES = exemple<Voyage>('/me/voyage', 'get', 200).haltes[0]!
const film = (n: number, surcharge: Partial<Halte['films'][number]>) => ({ ...MELIES.films[0]!, tmdb_id: n, cover_url: null, plex_url: null, ...surcharge })

const calmer = (calme: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches: calme, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
function monter(halte: Halte, fermer = vi.fn()) {
  render(<HalteDeLaCarte monde={monde} halte={halte} compte={compteDeLaHalte(halte.films)} premier={createRef()} fermer={fermer} />)
  const dialogue = screen.getByRole('dialog', { name: halte.nom })
  return { dialogue, fermer, lignes: () => within(dialogue).getAllByRole('listitem') }
}

describe('la halte ouverte sur la carte de 1900', () => {
  beforeEach(() => calmer(true))
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Le compte se dit sur ce qui est servi. Mutations : « Halte · trois films » ou `3 films` en dur
  // dans `enteteDeLaHalte` ; « 2 sur 3 » en dur dans `compteDit` ; le nom écrit dans le dessin.
  it('une halte de deux films dit son nom servi, « hors ligne · embranchement », « 2 films » et « 1 sur 2 », jamais trois', () => {
    const deux: Halte = { cle: 'zecca', nom: 'Halte Zecca', apres: 1901, films: [film(1, { title: 'Histoire d’un crime', year: 1901, etat: 'vu' }), film(2, { title: 'Les Victimes de l’alcoolisme', year: 1902, etat: 'a_demander' })] }
    const { dialogue, lignes } = monter(deux)
    expect(dialogue).toHaveTextContent('Halte Zecca')
    expect(dialogue).toHaveTextContent('hors ligne · embranchement')
    expect(dialogue).toHaveTextContent('Halte · 2 films')
    expect(dialogue).toHaveTextContent('1 sur 2')
    expect(dialogue.textContent).not.toMatch(/trois|3|Méliès/)
    expect(lignes()).toHaveLength(2)
    expect(enteteDeLaHalte(1)).toBe('Halte · 1 film')
    expect(enteteDeLaHalte(0)).toBe('Halte · aucun film')
    expect(compteDit({ vus: 0, total: 3 })).toBe('0 sur 3')
    expect(compteDit({ vus: 3, total: 3 })).toBe('3 sur 3')
  })

  // Le compte se lit : « 1 vu sur 2 » pour qui ne voit pas l'indicateur, par un texte caché à l'œil
  // (un `aria-label` sur un `<b>` sans rôle ne se lit pas), et le chiffre visible ne se lit pas deux
  // fois. Mutations : le pluriel dit dès un film vu ; jamais dit ; le texte lu retiré (ou remis en
  // `aria-label` du `<b>`) ; `aria-hidden` retiré du chiffre ; posé sur le texte lu.
  it('le compte se lit « n vus sur N » dans un texte que le lecteur d’écran reçoit, et le chiffre visible lui est caché', () => {
    expect([0, 1, 2, 3].map((vus) => compteLu({ vus, total: 3 }))).toEqual(['0 vu sur 3', '1 vu sur 3', '2 vus sur 3', '3 vus sur 3'])
    const { dialogue } = monter(MELIES)
    const lu = within(dialogue).getByText('1 vu sur 3')
    expect(lu).toHaveClass('sr-only')
    expect(lu.closest('[aria-hidden="true"]')).toBeNull()
    expect(lu.closest('[aria-label]')).toBeNull()
    expect(within(dialogue).getByText('1 sur 3')).toHaveAttribute('aria-hidden', 'true')
  })

  // Les cinq états du contrat, par les mots d'un film de salle ; la maquette n'en avait que deux.
  // Mutations : deux états seulement (`etat === 'vu' ? 'vu' : 'à voir'`) ; le mot de l'introuvable
  // pris ailleurs qu'au monde (« perdu », celui de 1890).
  it('chaque film dit son titre, son année et son état, et un film introuvable ne se dit jamais « à voir »', () => {
    const cinq: Halte = {
      ...MELIES,
      films: [
        film(1, { title: 'Barbe-bleue', year: 1901, etat: 'vu' }),
        film(2, { title: 'Le Mélomane', year: 1903, etat: 'sur_le_plex' }),
        film(3, { title: 'Les Cartes vivantes', year: 1905, etat: 'demande' }),
        film(4, { title: 'Le Roi du maquillage', year: 1904, etat: 'a_demander' }),
        film(5, { title: 'La Sirène', year: 1904, etat: 'introuvable' }),
      ],
    }
    const { lignes, dialogue } = monter(cinq)
    expect(lignes().map((li) => [...li.querySelectorAll('.titre, small, em, [class*=titre]')].map((e) => e.textContent).filter((t, i, tous) => tous.indexOf(t) === i))).toEqual([
      ['Barbe-bleue', '1901', 'vu'],
      ['Le Mélomane', '1903', 'sur ton Plex'],
      ['Les Cartes vivantes', '1905', 'demandé'],
      ['Le Roi du maquillage', '1904', 'à voir'],
      ['La Sirène', '1904', 'introuvable'],
    ])
    expect(within(lignes()[4]!).queryByText('à voir')).toBeNull()
    expect(dialogue).toHaveTextContent('Halte · 5 films')
    expect(dialogue).toHaveTextContent('1 sur 5')
  })

  // Mutations : l'adresse posée sans la regarder (`<img src={film.cover_url ?? ''} />` : une image
  // cassée) ; « sans affiche » écrit sous toute affiche.
  it('une affiche nulle n’a pas d’image et dit « sans affiche » ; une affiche servie se montre à son adresse', () => {
    const { lignes, dialogue } = monter(MELIES)
    expect(MELIES.films.map((f) => f.cover_url === null)).toEqual([false, false, true])
    expect(lignes().map((li) => li.querySelector('img')?.getAttribute('src') ?? null)).toEqual([MELIES.films[0]!.cover_url, MELIES.films[1]!.cover_url, null])
    expect(lignes().map((li) => within(li).queryByText('sans affiche') !== null)).toEqual([false, false, true])
    expect(dialogue.querySelectorAll('img')).toHaveLength(2)
  })

  // Aucun geste n'y marque un film vu, aucun film ne s'y ouvre (décision 9). Mutations : le lien
  // Plex posé sans regarder `plex_url` ; un bouton « Vu » par film ; le titre rendu en lien.
  it('le seul lien d’un film est son Plex, s’il en a un, à l’adresse servie ; le seul bouton est « Revenir sur la ligne »', () => {
    const { dialogue } = monter(MELIES)
    const liens = within(dialogue).getAllByRole('link')
    expect(liens.map((a) => [a.getAttribute('aria-label'), a.getAttribute('href')])).toEqual([['Voir sur le Plex : Le Mélomane', MELIES.films[1]!.plex_url]])
    // Il quitte l'appli : un autre onglet, et le Plex n'apprend pas d'où l'on vient ni ne tient la
    // fenêtre du Journal (`noreferrer` vaut `noopener`). Mutations : `target` retiré (le Journal
    // serait remplacé par le Plex) ; `rel` retiré.
    expect(liens[0]).toHaveAttribute('target', '_blank')
    expect(liens[0]!.getAttribute('rel')?.split(' ')).toContain('noreferrer')
    // Un lien sans adresse n'a pas le rôle de lien : on compte les ancres.
    expect(dialogue.querySelectorAll('a')).toHaveLength(1)
    expect(within(dialogue).getAllByRole('button').map((b) => b.textContent)).toEqual(['Revenir sur la ligne'])
  })

  // Le dialogue s'ouvre sous le doigt qui vient de toucher le levier. Mutations : `useState(true)`
  // (le toucher redoublé referme aussitôt) ; la garde jamais levée ; `data-vivante` toujours « oui »
  // (l'entrée glisserait au calme).
  it('hors du calme, elle entre en glissant et « Revenir sur la ligne » reste inerte un instant ; au calme, rien ne bouge et il répond d’emblée', () => {
    vi.useFakeTimers()
    calmer(false)
    const vivante = monter(MELIES)
    expect(vivante.dialogue).toHaveAttribute('data-vivante', 'oui')
    const revenir = within(vivante.dialogue).getByRole('button', { name: 'Revenir sur la ligne' })
    expect(revenir).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(revenir)
    expect(vivante.fermer).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(GARDE_DU_CHOIX - 1))
    fireEvent.click(revenir)
    expect(vivante.fermer).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(revenir).toHaveAttribute('aria-disabled', 'false')
    fireEvent.click(revenir)
    expect(vivante.fermer).toHaveBeenCalledTimes(1)
  })
  it('au calme, rien ne glisse et « Revenir sur la ligne » répond d’emblée', () => {
    const posee = monter(MELIES)
    expect(posee.dialogue).toHaveAttribute('data-vivante', 'non')
    fireEvent.click(within(posee.dialogue).getByRole('button', { name: 'Revenir sur la ligne' }))
    expect(posee.fermer).toHaveBeenCalledTimes(1)
  })
})
