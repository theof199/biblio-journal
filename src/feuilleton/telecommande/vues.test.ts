import { describe, expect, it } from 'vitest'
import { ecrireLaVue, lireLaVue, rechercheAvec, type Vue } from './vues'

const VUES: [string, Vue][] = [
  ['telecommande', { nom: 'telecommande' }],
  ['en-cours', { nom: 'en-cours' }],
  ['ajouter', { nom: 'ajouter' }],
  ['a-deux', { nom: 'a-deux' }],
  ['fiche-0b1f6a52-9d0c-4f8e-8a53-2f6c1f0e7a11', { nom: 'fiche', serie: '0b1f6a52-9d0c-4f8e-8a53-2f6c1f0e7a11' }],
]

describe('les vues de la télécommande dans l’adresse', () => {
  // Mutations : une vue ôtée de `SIMPLES` ; le préfixe de la fiche changé d'un seul côté.
  it.each(VUES)('`?telecommande=%s` se lit et se réécrit', (valeur, vue) => {
    expect(lireLaVue(`?telecommande=${valeur}`)).toEqual(vue)
    expect(ecrireLaVue(vue)).toBe(valeur)
  })

  // Mutation : `if (valeur === null) return null` ôté (toute adresse ouvrirait le panneau).
  it('sans le paramètre, le panneau est fermé', () => {
    expect(lireLaVue('')).toBeNull()
    expect(lireLaVue('?autre=1')).toBeNull()
  })

  // Mutation : `: VUE_D_OUVERTURE` devenu `: null`, ou le filtre `IDENTIFIANT` ôté.
  it.each(['', 'grenier', 'fiche-', 'fiche-a/b'])('une valeur inconnue (%j) ouvre la télécommande, pas une vue inventée', (valeur) => {
    expect(lireLaVue(`?telecommande=${encodeURIComponent(valeur)}`)).toEqual({ nom: 'telecommande' })
  })

  // Mutations : `new URLSearchParams()` vide à la place de celle de l'adresse ; `delete` oublié.
  it('écrire ou ôter la vue garde les autres paramètres de l’adresse', () => {
    expect(rechercheAvec('?a=1', { nom: 'en-cours' })).toBe('?a=1&telecommande=en-cours')
    expect(rechercheAvec('?a=1&telecommande=en-cours', null)).toBe('?a=1')
    expect(rechercheAvec('?telecommande=en-cours', null)).toBe('')
  })
})
