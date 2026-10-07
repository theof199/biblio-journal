import { describe, expect, it } from 'vitest'

/**
 * L'inventaire de la caméra (`meneur.ts`) : la page n'apprend que du meneur où le moteur la veut.
 * Un `defilerVers` appelé du moteur écrirait la caméra hors de celui qui arbitre ses glissements,
 * et son écho ne serait reconnu par personne. Les comportements du meneur, eux, se prouvent sur le
 * banc du moteur (`moteur.test.ts`), qui le commande.
 */
const SOURCES = import.meta.glob<string>(['/src/carte/moteur.ts', '/src/carte/meneur.ts'], { query: '?raw', import: 'default', eager: true })
const MOTEUR = '/src/carte/moteur.ts'
const MENEUR = '/src/carte/meneur.ts'

const sansCommentaires = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const code = (chemin: string) => sansCommentaires(SOURCES[chemin] ?? '')
/** `defilerVers` lu sur un objet, quel qu'il soit : `this.rappels.defilerVers(…)`, `rappels.defilerVers`. */
const APPEL = /\.\s*defilerVers\b/
/** Le nom, où qu'il soit écrit : lu sur un objet, destructuré (`const { defilerVers } = this.rappels`), renommé, entre crochets. */
const NOM = /\bdefilerVers\b/g
/** Le seul endroit de `moteur.ts` où le nom a sa place : sa déclaration dans `Rappels`. */
const DECLARATION = /^\s*defilerVers: \(y: number\) => void$/

describe('la caméra ne s’écrit que dans le meneur', () => {
  // Le plancher, sans lequel un fichier déplacé ou vidé passerait l'inventaire sans rien garder.
  // Mutation : `MENEUR` pointé sur un fichier absent.
  it('trouve le moteur et le meneur, et le meneur appelle bien defilerVers', () => {
    expect(Object.keys(SOURCES).sort()).toEqual([MENEUR, MOTEUR])
    expect(code(MOTEUR)).toContain('class MoteurCarte')
    expect(code(MENEUR)).toMatch(APPEL)
  })

  // Le nom n'y paraît qu'une fois, à sa déclaration : chercher `.defilerVers` seul laissait passer
  // l'appel par un nom destructuré. Mutations : `this.rappels.defilerVers(…)` remis dans `allerIci`
  // à la place de `demanderALaPage` ; `const { defilerVers } = this.rappels` puis `defilerVers(y)`
  // au même endroit.
  it('moteur.ts ne nomme defilerVers qu’à sa déclaration dans Rappels', () => {
    const lignes = code(MOTEUR).split('\n').filter((l) => l.match(NOM))
    expect(lignes.flatMap((l) => l.match(NOM))).toHaveLength(1)
    expect(lignes[0]).toMatch(DECLARATION)
  })
})
