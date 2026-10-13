import { describe, expect, it } from 'vitest'

/**
 * Le Voyage (moteur de la carte, mondes, pages) pèse plus de 40 % du code de l'app : `App.tsx` ne le
 * charge qu'à la demande (`paresseux`). Un seul `import Carte from './pages/Carte'` le remet dans
 * le morceau d'entrée, sans qu'aucun autre test ne s'en aperçoive.
 */
const sources = import.meta.glob('../App.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('le découpage du Voyage', () => {
  it('se vérifie sur le vrai App.tsx', () => {
    expect(Object.keys(sources)).toEqual(['../App.tsx'])
  })

  // Mutation : remettre `import Carte from './pages/Carte'` dans `App.tsx`.
  it('App.tsx n’importe statiquement ni la carte ni une page du Voyage', () => {
    const [texte] = Object.values(sources)
    const statiques = [...texte!.matchAll(/^import\s[^\n]*from\s+'\.\/pages\/(Carte|Voyage\w*)'/gm)].map((trouve) => trouve[1])
    expect(statiques).toEqual([])
  })

  it('App.tsx charge bien ces pages à la demande', () => {
    const [texte] = Object.values(sources)
    const paresseuses = [...texte!.matchAll(/paresseux\(\(\) => import\('\.\/pages\/(Carte|Voyage\w*)'\)\)/g)].map((trouve) => trouve[1])
    expect(paresseuses).toHaveLength(9)
  })
})

/**
 * Le Feuilleton et ses deux espaces se chargent chacun à la demande : le Studio et la Maison
 * grossiront sans peser sur le morceau d'entrée, ni l'un sur l'autre.
 */
describe('le découpage du Feuilleton', () => {
  const [texte] = Object.values(sources)

  // Mutation : `import Studio from './studio/Studio'` dans `App.tsx`.
  it('App.tsx n’importe statiquement rien du Feuilleton, du Studio ni de la Maison', () => {
    const statiques = [...texte!.matchAll(/^import\s[^\n]*from\s+'\.\/(feuilleton|studio|maison)\/[^']*'/gm)].map((trouve) => trouve[0])
    expect(statiques).toEqual([])
  })

  // Mutation : la même, `import Studio from './studio/Studio'` : il manque un morceau à la liste.
  it('la mise en page et chaque espace ont leur morceau', () => {
    const paresseuses = [...texte!.matchAll(/paresseux\(\(\) => import\('\.\/((?:feuilleton|studio|maison)\/\w+)'\)\)/g)].map((trouve) => trouve[1])
    expect(paresseuses).toEqual(['feuilleton/Feuilleton', 'studio/Studio', 'maison/Maison'])
  })
})

/**
 * Le panneau de la télécommande ne se charge qu'à son ouverture : le bouton rond, lui, vient avec la
 * mise en page du Feuilleton.
 */
describe('le découpage de la télécommande', () => {
  const [feuilleton] = Object.values(import.meta.glob('../feuilleton/Feuilleton.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)

  // Mutation : `import Panneau from './telecommande/Panneau'` dans `Feuilleton.tsx`.
  it('Feuilleton.tsx n’importe statiquement ni le panneau ni une de ses vues', () => {
    const statiques = [...feuilleton!.matchAll(/^import\s[^\n]*from\s+'\.\/telecommande\/(\w+)'/gm)].map((trouve) => trouve[1])
    expect(statiques.sort()).toEqual(['Bouton', 'adresse', 'donnees'])
  })

  // Mutation : la même : le morceau manque à la liste.
  it('le panneau a son morceau', () => {
    const paresseuses = [...feuilleton!.matchAll(/paresseux\(\(\) => import\('\.\/(telecommande\/\w+)'\)\)/g)].map((trouve) => trouve[1])
    expect(paresseuses).toEqual(['telecommande/Panneau'])
  })
})
