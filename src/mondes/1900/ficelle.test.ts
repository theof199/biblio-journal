import { describe, expect, it } from 'vitest'
import type { CaseVue } from '../types'
import { AFFICHES_D_UN_MONDE } from '../../carte/CarteCanvas'
import { affichesDeLaFicelle, cleDeLaFicelle, PENCHES, PLAFOND_DE_LA_FICELLE } from './ficelle'

type Case = Pick<CaseVue, 'annee' | 'etat' | 'attente' | 'affiches'>
const a = (annee: number, etat: CaseVue['etat'], affiches: string[] = [`/covers/thumb/${annee}.webp`], attente = false): Case => ({ annee, etat, attente, affiches })
const de = (annee: number): string => `/covers/thumb/${annee}.webp`

describe('la ficelle du compartiment (idée 72)', () => {
  // Mutations : `estFermee` retirée de la règle (1903, verrouillée avec son affiche, se pince) ; le
  // tri retiré (l'ordre des cases l'emporte) ; `affiches[0]` remplacé par toutes les affiches.
  it('pince la première affiche de chaque année ouverte, dans l’ordre des années et non des cases', () => {
    const cases = [a(1902, 'encours'), a(1900, 'lion', ['/covers/thumb/podium.webp', '/covers/thumb/autre.webp']), a(1903, 'verrou'), a(1901, 'passee')]
    expect(affichesDeLaFicelle(cases)).toEqual(['/covers/thumb/podium.webp', de(1901), de(1902)])
  })

  // Mutation : la garde `!k.affiches[0]` retirée : une place vide (`undefined`) entre deux affiches.
  it('ne laisse pas de place à une année sans affiche', () => {
    expect(affichesDeLaFicelle([a(1900, 'lion'), a(1901, 'lion', []), a(1902, 'encours')])).toEqual([de(1900), de(1902)])
  })

  // Une année en attente du Voyage suivi se montre fermée partout (`estFermee`), affiche comprise.
  // Mutation : `estFermee` remplacée par le seul `etat === 'verrou'`.
  it('ne pince ni l’affiche d’une année verrouillée, ni celle d’une année en attente du Voyage suivi', () => {
    expect(affichesDeLaFicelle([a(1900, 'lion'), a(1901, 'encours', [de(1901)], true), a(1902, 'verrou')])).toEqual([de(1900)])
  })

  it('reste vide sans film vu, et à la première montée, toutes les années fermées', () => {
    expect(affichesDeLaFicelle([])).toEqual([])
    expect(affichesDeLaFicelle([a(1900, 'encours', []), a(1901, 'verrou', [])])).toEqual([])
    expect(affichesDeLaFicelle(Array.from({ length: 10 }, (_, i) => a(1900 + i, 'verrou')))).toEqual([])
  })

  // Mutations : le plafond retiré (dix affiches) ; `slice(0, PLAFOND)` (les plus anciennes restent).
  it('ne garde que les plus récentes au-delà du plafond, toujours dans l’ordre des années', () => {
    const toutes = Array.from({ length: 10 }, (_, i) => a(1909 - i, 'lion'))
    const lues = affichesDeLaFicelle(toutes)
    expect(lues).toHaveLength(PLAFOND_DE_LA_FICELLE)
    expect(lues).toEqual([1905, 1906, 1907, 1908, 1909].map(de))
    // Une année sans affiche ne prend pas la place d'une autre sous le plafond.
    expect(affichesDeLaFicelle(toutes.map((k) => (k.annee === 1908 ? { ...k, affiches: [] } : k)))).toEqual([1904, 1905, 1906, 1907, 1909].map(de))
  })

  // La mémoire des affiches (`CarteCanvas.tsx`) compte ce qu'un monde demande dans une image : la
  // ficelle doit y tenir, et chaque place a sa penche. Mutation : le plafond porté à onze.
  it('tient dans ce que la mémoire des affiches réserve à un monde, et a une penche par place', () => {
    expect(PLAFOND_DE_LA_FICELLE).toBeGreaterThan(0)
    expect(PLAFOND_DE_LA_FICELLE).toBeLessThanOrEqual(AFFICHES_D_UN_MONDE)
    expect(PENCHES.length).toBeGreaterThanOrEqual(PLAFOND_DE_LA_FICELLE)
  })

  // La toile de la ficelle est cuite sous cette clé (`accroches.ts`) : une clé qui ne change pas
  // quand une affiche arrive laisserait pour toujours le papier nu de la première image.
  // Mutations : l'état de chargement sorti de la clé (les adresses seules) ; un seul état pour toute
  // la ficelle (`chargees.some(Boolean)`) ; les adresses triées dans la clé ; le séparateur retiré.
  it('se recuit quand une affiche arrive : la clé change avec le chargement, et avec l’ordre des adresses', () => {
    const adresses = [de(1900), de(1901), de(1902)]
    const rien = cleDeLaFicelle(adresses, [false, false, false])
    const une = cleDeLaFicelle(adresses, [false, true, false])
    const deux = cleDeLaFicelle(adresses, [true, true, false])
    const autre = cleDeLaFicelle(adresses, [true, false, false])
    expect(new Set([rien, une, deux, autre]).size).toBe(4)
    // Le même état donne la même clé : rien ne se recuit d'une image à l'autre.
    expect(cleDeLaFicelle([...adresses], [false, true, false])).toBe(une)
    // L'ordre des adresses est celui des places : deux ficelles des mêmes affiches rangées autrement ne sont pas la même toile.
    expect(cleDeLaFicelle([de(1901), de(1900), de(1902)], [true, true, true])).not.toBe(cleDeLaFicelle(adresses, [true, true, true]))
    // Deux ficelles ne se confondent pas quand une adresse est le début d'une autre.
    expect(cleDeLaFicelle(['/a', '/b'], [true, true])).not.toBe(cleDeLaFicelle(['/a+/b'], [true]))
  })
})
