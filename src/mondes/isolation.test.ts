import { describe, expect, it } from 'vitest'

/**
 * Un monde ne se touche que par son dossier et sa ligne du registre (décision du 28 septembre
 * 2026) : aucun fichier hors de `src/mondes/` n'importe un monde précis. Sinon, ajouter les
 * années 1900 obligerait à retoucher le moteur ou les pages.
 */
const sources = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('l’isolation des mondes', () => {
  it('se vérifie sur de vrais fichiers', () => {
    expect(Object.keys(sources)).toContain('../carte/moteur.ts')
  })

  // Mutation : `import { … } from '../mondes/avenir'` dans `carte/moteur.ts`.
  it('hors de src/mondes/, personne n’importe un monde précis', () => {
    // Vite rend les fichiers de ce dossier en `./…`, les autres en `../…`. Les tests peuvent
    // monter un monde précis ; le code, jamais : `mondes/types`, `mondes/trace` et le registre
    // (`mondes`, sans rien derrière) sont les seules portes.
    const fautifs = Object.entries(sources)
      .filter(([chemin]) => !chemin.startsWith('./') && !/\.test\.tsx?$/.test(chemin))
      .filter(([, texte]) => /from '[^']*mondes\/(?!types'|trace')[^']*'/.test(texte))
      .map(([chemin]) => chemin)
    expect(fautifs).toEqual([])
  })
})
