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
 * Ce qu'une feuille de composant a le droit de lire au thème : des mesures, jamais une couleur, une
 * police, une graisse, un rayon, une ombre ni un trait. Tout le reste passe par une variable `--h-*`.
 */
const MESURES = /^--(espace-\d|taille-(xs|s|m|l|xl)|interligne(-serre|-titre)?|interlettre-capitales|cible-tactile|bouton-hauteur|largeur-affiche-(ligne|fiche)|taille-meta|largeur-page|gouttiere-page|coque-bas|opacite-inactif|z-telecommande|telecommande-(bouton|hauteur|largeur|duree|touche-grande|sujet-hauteur|interlettre-marque|interlettre-code))$/

/** Les propriétés où une couleur peut s'écrire, et les seuls mots qu'une feuille y pose hors d'une variable. */
const PEUT_PORTER_UNE_COULEUR = /^(color|background(-color|-image)?|border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?|outline(-color)?|box-shadow|text-shadow|fill|stroke|caret-color|accent-color|text-decoration(-color)?|column-rule(-color)?)$/
const MOTS_PERMIS = new Set(['solid', 'none', 'inherit', 'inset'])
/** Une valeur sans ses `var(…)` ni ses `calc(…)`, parenthèses imbriquées comprises. */
const sansVariables = (valeur: string) => {
  let nue = valeur
  for (let avant = ''; avant !== nue; ) {
    avant = nue
    nue = nue.replace(/\b(var|calc|env)\([^()]*\)/g, ' ')
  }
  return nue
}

/** Les variables `--h-*` que les composants lisent : le contrat d'un chapitre. */
const CONTRAT = [...new Set(Object.values(FEUILLES).flatMap(lues))].filter((nom) => nom.startsWith('--h-')).sort()

describe('l’habillage de la télécommande : séparé de la logique', () => {
  it('trouve ce qu’il garde', () => {
    expect(Object.keys(FEUILLES).sort()).toEqual(['/src/feuilleton/telecommande/Bouton.module.css', '/src/feuilleton/telecommande/Panneau.module.css'])
    expect(Object.keys(COMPOSANTS)).toEqual(expect.arrayContaining(['/src/feuilleton/telecommande/Panneau.tsx', '/src/feuilleton/telecommande/VueTelecommande.tsx', '/src/feuilleton/telecommande/Bouton.tsx']))
    // Autant de fichiers que de lignes dans la table, quel que soit le nombre de chapitres.
    expect(Object.keys(CHAPITRES).sort()).toEqual(Object.keys(HABILLAGES).map((nom) => `/src/feuilleton/habillages/${nom}.module.css`).sort())
    expect(Object.keys(CHAPITRES)).toContain('/src/feuilleton/habillages/chapitre-1.module.css')
    expect(CONTRAT.length).toBeGreaterThan(20)
  })

  // Mutations : `color: var(--couleur-texte)`, `font-family: var(--police-titre)`, `border-radius: var(--rayon-m)`,
  // `box-shadow: var(--ombre-m)` ou `font-weight: var(--graisse-forte)` dans `Panneau.module.css`.
  it.each(Object.entries(FEUILLES))('%s ne lit au thème que des mesures : ni couleur, ni police, ni rayon, ni ombre', (_chemin, css) => {
    expect(lues(css).filter((nom) => !nom.startsWith('--h-') && !MESURES.test(nom))).toEqual([])
  })

  // Mutations : `color: #fff`, `background: red`, `color: orange`, `border-color: navy`, `fill: currentColor`
  // ou `font-family: Georgia` dans une feuille ; aussi : `text-transform: uppercase`, `font-weight: bold`,
  // `border-style: dashed` (l'ambiance passe par l'habillage).
  it.each(Object.entries(FEUILLES))('%s ne porte ni couleur ni police en dur', (_chemin, css) => {
    const nue = sansCommentaires(css)
    expect(nue.match(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|lab|color-mix)\(|(?<![\w-])(white|black|red|blue|green|gr[ae]y|transparent)(?![\w-])/gi) ?? []).toEqual([])
    // Une couleur nommée, quelle qu'elle soit (`orange`, `navy`, `currentColor`…) : là où une couleur peut
    // s'écrire, rien d'autre qu'une variable et les mots de `MOTS_PERMIS`.
    const nommees = [...nue.matchAll(/(?<![\w-])([a-z-]+)\s*:\s*([^;{}]+);/g)]
      .filter(([, prop]) => PEUT_PORTER_UNE_COULEUR.test(prop!))
      .flatMap(([, prop, valeur]) => (sansVariables(valeur!).match(/[a-z][a-z-]*/gi) ?? []).filter((mot) => !MOTS_PERMIS.has(mot.toLowerCase())).map((mot) => `${prop}: ${mot}`))
    expect(nommees).toEqual([])
    const polices = [...nue.matchAll(/font(-family)?\s*:\s*([^;]+);/g)].map(([, , valeur]) => valeur!.trim()).filter((valeur) => !/^var\(--h-police-[a-z]+\)$/.test(valeur))
    expect(polices).toEqual([])
    // L'ambiance (capitales, graisses, pointillés) ne s'écrit pas en dur non plus : elle est du chapitre.
    const ambiance = [...nue.matchAll(/(?<![\w-])(text-transform|font-weight|font-style|border(?:-[a-z]+)*-style)\s*:\s*([^;{}]+);/g)].filter(([, , valeur]) => !/^var\(--h-[a-z-]+\)$/.test(valeur!.trim())).map(([entier]) => entier)
    expect(ambiance).toEqual([])
    expect(nue.match(/\b(dashed|dotted|double|groove|ridge)\b/g) ?? []).toEqual([])
  })

  // Mutations : `import Maison from '../maison/Maison'` ou `import '../maison/Maison'` dans `Feuilleton.tsx` ;
  // `import('../studio/Studio')` dans `espaces.ts`.
  it.each(Object.entries(TOUT_LE_SOCLE))('%s n’importe ni le Travail ni la Maison : le socle est commun', (_chemin, source) => {
    expect(sansCommentairesDeCode(source)).not.toMatch(/\b(from|import)\s*\(?\s*['"][^'"]*\/(studio|maison)\//)
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
  // Mutations : `habillageActif` qui rend un nom hors de la table ; une ligne de la table sans classe (le
  // fichier du chapitre n'aurait pas de `.habillage`), sans marque ou sans modèle.
  it('`habillageActif()` rend un chapitre de la table, et chaque ligne de la table est complète', () => {
    expect(Object.keys(HABILLAGES)).toContain(habillageActif())
    for (const habillage of Object.values(HABILLAGES)) {
      expect(habillage.classe).not.toBe('')
      expect(habillage.marque).not.toBe('')
      expect(habillage.modele).not.toBe('')
    }
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
