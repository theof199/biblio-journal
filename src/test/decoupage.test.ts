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
