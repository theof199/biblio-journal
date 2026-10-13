import { describe, expect, it } from 'vitest'
import { HABILLAGES, habillageActif } from './index'

/** Les feuilles et les composants de la télécommande, et les habillages, tels qu'écrits. */
const FEUILLES = import.meta.glob<string>('/src/feuilleton/telecommande/*.module.css', { query: '?raw', import: 'default', eager: true })
const COMPOSANTS = import.meta.glob<string>(['/src/feuilleton/telecommande/*.{ts,tsx}', '!**/*.test.*'], { query: '?raw', import: 'default', eager: true })
const CHAPITRES = import.meta.glob<string>('/src/feuilleton/habillages/*.module.css', { query: '?raw', import: 'default', eager: true })
const TOUT_LE_SOCLE = import.meta.glob<string>(['/src/feuilleton/**/*.{ts,tsx}', '!**/*.test.*'], { query: '?raw', import: 'default', eager: true })

const sansCommentaires = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const sansCommentairesDeCode = (source: string) => source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
const lues = (css: string) => [...new Set([...sansCommentaires(css).matchAll(/var\(\s*(--[\w-]+)/g)].map(([, nom]) => nom!))]
const definies = (css: string) => [...new Set([...sansCommentaires(css).matchAll(/(--[\w-]+)\s*:/g)].map(([, nom]) => nom!))]

/**
 * Ce qu'une feuille de composant a le droit de lire au thème : des mesures et des graisses, jamais une
 * couleur, une police, un rayon, une ombre ni un trait. Tout le reste passe par une variable `--h-*`.
 */
const MESURES = /^--(espace-\d|taille-(xs|s|m|l|xl)|graisse-(normale|moyenne|forte)|interligne(-serre|-titre)?|interlettre-capitales|cible-tactile|bouton-hauteur|largeur-affiche-(ligne|fiche)|taille-meta|largeur-page|gouttiere-page|coque-bas|opacite-inactif|z-telecommande|telecommande-(bouton|hauteur|largeur|duree|touche-grande|sujet-hauteur|interlettre-marque|interlettre-code))$/

/** Les variables `--h-*` que les composants lisent : le contrat d'un chapitre. */
const CONTRAT = [...new Set(Object.values(FEUILLES).flatMap(lues))].filter((nom) => nom.startsWith('--h-')).sort()

describe('l’habillage de la télécommande : séparé de la logique', () => {
  it('trouve ce qu’il garde', () => {
    expect(Object.keys(FEUILLES).sort()).toEqual(['/src/feuilleton/telecommande/Bouton.module.css', '/src/feuilleton/telecommande/Panneau.module.css'])
    expect(Object.keys(COMPOSANTS)).toEqual(expect.arrayContaining(['/src/feuilleton/telecommande/Panneau.tsx', '/src/feuilleton/telecommande/VueTelecommande.tsx', '/src/feuilleton/telecommande/Bouton.tsx']))
    expect(Object.keys(CHAPITRES)).toEqual(['/src/feuilleton/habillages/chapitre-1.module.css'])
    expect(CONTRAT.length).toBeGreaterThan(20)
  })

  // Mutations : `color: var(--couleur-texte)`, `font-family: var(--police-titre)`, `border-radius: var(--rayon-m)`
  // ou `box-shadow: var(--ombre-m)` dans `Panneau.module.css`.
  it.each(Object.entries(FEUILLES))('%s ne lit au thème que des mesures : ni couleur, ni police, ni rayon, ni ombre', (_chemin, css) => {
    expect(lues(css).filter((nom) => !nom.startsWith('--h-') && !MESURES.test(nom))).toEqual([])
  })

  // Mutation : `color: #fff`, `background: red`, `font-family: Georgia` ou `currentColor` forcé en `white` dans une feuille.
  it.each(Object.entries(FEUILLES))('%s ne porte ni couleur ni police en dur', (_chemin, css) => {
    const nue = sansCommentaires(css)
    expect(nue.match(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|lab|color-mix)\(|(?<![\w-])(white|black|red|blue|green|gr[ae]y|transparent)(?![\w-])/gi) ?? []).toEqual([])
    const polices = [...nue.matchAll(/font(-family)?\s*:\s*([^;]+);/g)].map(([, , valeur]) => valeur!.trim()).filter((valeur) => !/^var\(--h-police-[a-z]+\)$/.test(valeur))
    expect(polices).toEqual([])
  })

  // Mutations : `style={{ color: '#fff' }}` dans un composant ; `import chapitre from '../habillages/chapitre-1.module.css'`
  // dans `Panneau.tsx` ; une classe du thème du Voyage.
  it.each(Object.entries(COMPOSANTS))('%s ne porte ni couleur, ni police, ni jeton de couleur, et n’importe aucun chapitre', (_chemin, source) => {
    const code = sansCommentairesDeCode(source)
    expect(code.match(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(|--(couleur|police|rayon|ombre|fond|ticket|h)-[\w-]*|fontFamily|\bstyle=/gi) ?? []).toEqual([])
    expect(code).not.toMatch(/habillages\/chapitre-/)
    expect(code).not.toMatch(/from '[^']*\/(voyage|mondes|carte|studio|maison)\//)
  })

  // Mutation : `import chapitre1 from './habillages/chapitre-1.module.css'` dans `Feuilleton.tsx`.
  it('seul `habillages/index.ts` importe un chapitre', () => {
    const importeurs = Object.entries(TOUT_LE_SOCLE)
      .filter(([, source]) => /chapitre-\d+\.module\.css/.test(sansCommentairesDeCode(source)))
      .map(([chemin]) => chemin)
    expect(importeurs).toEqual(['/src/feuilleton/habillages/index.ts'])
  })

  // Mutation : un second `habillageActif()` dans `Panneau.tsx` ou `Bouton.tsx`.
  it('l’habillage se choisit en un seul endroit : un seul appel de `habillageActif()`, dans la mise en page', () => {
    const appelants = Object.entries(TOUT_LE_SOCLE)
      .filter(([chemin]) => chemin !== '/src/feuilleton/habillages/index.ts')
      .flatMap(([chemin, source]) => [...source.matchAll(/habillageActif\(\)/g)].map(() => chemin))
    expect(appelants).toEqual(['/src/feuilleton/Feuilleton.tsx'])
  })
})

describe('un chapitre', () => {
  // Mutation : `habillageActif` qui rend un autre nom.
  it('`habillageActif()` rend « chapitre-1 », qui est dans la table', () => {
    expect(habillageActif()).toBe('chapitre-1')
    expect(Object.keys(HABILLAGES)).toContain(habillageActif())
    expect(HABILLAGES['chapitre-1']).toMatchObject({ marque: 'Feuilleton', modele: 'chapitre 1' })
  })

  // Mutation : une ligne `--h-touche-fond` ôtée de `chapitre-1.module.css` (la touche n'aurait plus de
  // fond, en silence : une variable absente ne casse rien à l'écran d'un test).
  it.each(Object.entries(CHAPITRES))('%s définit toutes les variables que les composants lisent, sur sa classe `.habillage`', (_chemin, css) => {
    expect(sansCommentaires(css)).toMatch(/^\s*\.habillage \{/m)
    expect(CONTRAT.filter((nom) => !definies(css).includes(nom))).toEqual([])
  })

  // Mutation : `--h-touche-fond: #223` dans un chapitre ; `--h-police-titre: Georgia`.
  it.each(Object.entries(CHAPITRES))('%s ne tire ses valeurs que des jetons du thème, ou de ses propres variables', (_chemin, css) => {
    const valeurs = [...sansCommentaires(css).matchAll(/(--h-[\w-]+)\s*:\s*([^;]+);/g)].map(([, nom, valeur]) => ({ nom: nom!, nue: valeur!.replace(/var\([^()]*\)/g, '') }))
    expect(valeurs.length).toBeGreaterThan(20)
    expect(valeurs.filter(({ nue }) => /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(|[a-z]{3,}/i.test(nue.replace(/\binset\b/g, ''))).map(({ nom }) => nom)).toEqual([])
  })

  // Mutation : une variable `--h-*` définie par un chapitre et lue par personne (une faute de frappe
  // dans un composant la laisserait orpheline).
  it.each(Object.entries(CHAPITRES))('%s ne définit rien que personne ne lit', (_chemin, css) => {
    const lecteurs = new Set([...CONTRAT, ...lues(css)])
    expect(definies(css).filter((nom) => !lecteurs.has(nom))).toEqual([])
  })
})
