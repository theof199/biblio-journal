import { describe, expect, it } from 'vitest'
import feuille from './Palissade.module.css?raw'

/** La déclaration `propriete` de la règle `selecteur`, en pixels (ou le rapport `a / b` d'un `aspect-ratio`). */
function valeur(selecteur: string, propriete: string): number {
  const regle = new RegExp(`(?:^|\\n)${selecteur.replace(/[.()]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(feuille)?.[1]
  if (regle === undefined) throw new Error(`règle introuvable : ${selecteur}`)
  const brute = new RegExp(`(?:^|[;\\s])${propriete}:\\s*([^;]+);`).exec(regle)?.[1]?.trim()
  if (brute === undefined) throw new Error(`${selecteur} ne dit pas ${propriete}`)
  const rapport = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(brute)
  if (rapport) return Number(rapport[1]) / Number(rapport[2])
  if (brute === '0') return 0
  return Number(/^(-?\d+(?:\.\d+)?)px/.exec(brute)?.[1] ?? NaN)
}

/**
 * La maquette colle des vues de 76 px en 3:4 (101 px de haut, 3 px de papier autour) : la plus
 * basse, à 64 px, finit à 171 px du haut du panneau, et le millésime au pochoir se lit dessous. Le
 * Journal colle des affiches TMDB en 2:3 : à la même largeur, elles finiraient à 184 px et
 * couvriraient le millésime.
 */
const BAS_DE_LA_MAQUETTE = 64 + (76 * 4) / 3 + 2 * 3

describe('la palissade', () => {
  // Mutation : les affiches remises à 76 px de large, la largeur des vues de la maquette.
  it('laisse lire le millésime sous les affiches, comme la maquette', () => {
    const largeur = valeur('.colle img', 'width')
    const hauteur = largeur / valeur('.colle img', 'aspect-ratio')
    const papier = valeur('.colle img', 'border')
    for (const n of [1, 2, 3, 4]) {
      const bas = valeur(`.colle img:nth-child(${n})`, 'top') + hauteur + 2 * papier
      expect(bas, `l’affiche n° ${n}`).toBeLessThanOrEqual(BAS_DE_LA_MAQUETTE)
    }
  })
})
