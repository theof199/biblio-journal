import { describe, expect, it } from 'vitest'

/**
 * Toute image ou vidéo d'un dossier `assets/` a son entrée dans le `CREDITS.md` du même dossier :
 * d'où elle vient, sous quelle licence, comment elle a été traitée (consigne du propriétaire du
 * 29 septembre 2026). Un fichier sans entrée ne part pas.
 */
const fichiers = Object.keys(import.meta.glob('../**/assets/*.{webp,png,webm}'))
const credits = import.meta.glob('../**/assets/CREDITS.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('les crédits des images', () => {
  it('se lisent dans les vrais fichiers', () => {
    expect(Object.keys(credits)).toContain('../carte/assets/CREDITS.md')
  })

  // Mutation : déposer un fichier sans son entrée, ou une entrée sans sa licence.
  it('nomment, pour chaque fichier, son œuvre, sa source, sa licence et son traitement', () => {
    for (const f of fichiers) {
      const dossier = f.slice(0, f.lastIndexOf('/') + 1)
      const nom = f.slice(dossier.length)
      const texte = credits[`${dossier}CREDITS.md`]
      expect(texte, `${dossier} n’a pas de CREDITS.md`).toBeDefined()
      const entree = texte!.split(/^## /m).find((e) => e.startsWith(`\`${nom}\``))
      expect(entree, `${f} n’a pas d’entrée`).toBeDefined()
      for (const champ of ['Œuvre', 'Source', 'Licence', 'Traitement']) expect(entree, `${f} : ${champ}`).toMatch(new RegExp(`^- ${champ} : \\S`, 'm'))
    }
  })
})
