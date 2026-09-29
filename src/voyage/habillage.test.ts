import { describe, expect, it } from 'vitest'
import { creerRegistre } from '../mondes'
import { JETONS_DE_PAGE } from '../mondes/types'

/** Les feuilles des pages du Voyage : sous `src/voyage/`, ou nommées `Voyage*.module.css` sous `src/pages/`. */
const FEUILLES = {
  ...import.meta.glob<string>('/src/voyage/**/*.module.css', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>('/src/pages/Voyage*.module.css', { query: '?raw', import: 'default', eager: true }),
}

/** Les polices embarquées, telles que `ui/polices.ts` les importe. */
const POLICES = Object.values(import.meta.glob<string>('/src/ui/polices.ts', { query: '?raw', import: 'default', eager: true }))[0] ?? ''

const sansCommentaires = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const lues = (css: string) => [...sansCommentaires(css).matchAll(/var\(\s*(--[\w-]+)/g)].map(([, nom]) => nom!)

/**
 * Ce qu'une feuille du Voyage lit hors des jetons de son monde : le corail, commun à tous les mondes
 * et jamais teinté (`ui/voyage.css`), la zone sûre au-dessus de la barre d'onglets et les étages
 * (`ui/theme.css`). Jamais le reste de `voyage.css` : c'est la palette de la carte, pas celle du monde.
 */
const PERMISES = (nom: string) => nom === '--corail' || nom === '--coque-bas' || nom.startsWith('--z-')

/** Les mots du raccourci `font` qui ne nomment pas une famille : style, variante, graisse, chasse, taille. */
const MOTS_DU_RACCOURCI = new Set([
  'inherit', 'initial', 'unset', 'revert', 'normal', 'italic', 'oblique', 'small-caps', 'bold', 'bolder', 'lighter',
  'ultra-condensed', 'extra-condensed', 'condensed', 'semi-condensed', 'semi-expanded', 'expanded', 'extra-expanded',
  'ultra-expanded', 'xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large', 'xxx-large', 'larger', 'smaller',
])

describe('l’habillage des pages du Voyage', () => {
  it('trouve les feuilles qu’il garde', () => {
    // Sans ce plancher, un glob qui ne trouverait plus rien rendrait les gardes suivantes muettes.
    // Chaque tâche qui ajoute une feuille l'ajoute ici.
    expect(Object.keys(FEUILLES)).toEqual(expect.arrayContaining(['/src/voyage/Toile.module.css']))
  })

  // Mutation : retirer un jeton d'un monde (le monde « à venir » d'abord : on l'oublie).
  it.each([1890, 1900, 1950])('le monde de %i pose tous les jetons des pages, et rien d’autre', (decennie) => {
    const { jetons } = creerRegistre()(decennie).pages
    expect(Object.keys(jetons).sort()).toEqual([...JETONS_DE_PAGE].sort())
    expect(Object.values(jetons).every((v) => v.trim().length > 0)).toBe(true)
  })

  // Le jumeau des dates du monde 1890 (`monde1890.test.ts`) : les mots s'affichent tels quels.
  // Mutations : une apostrophe droite (`Boniment d'ouverture`), un mot vide.
  it.each([1890, 1900])('le monde de %i donne des mots complets, en français typographique', (decennie) => {
    const textes = (valeur: unknown): string[] =>
      typeof valeur === 'string' ? [valeur] : Object.values(valeur as Record<string, unknown>).flatMap(textes)
    const mots = textes(creerRegistre()(decennie).pages.mots)
    expect(mots.length).toBeGreaterThan(20)
    for (const mot of mots) {
      expect(mot.trim()).not.toBe('')
      expect(mot).not.toContain("'")
    }
  })

  // Le jumeau des jetons posés : une police nommée par un monde doit être embarquée (`ui/polices.ts`,
  // décision D4), sinon elle retombe sans bruit sur la suivante de la liste, ou se cherche en ligne.
  // Seule la première de chaque liste est la police voulue ; les suivantes sont celles du système.
  // Mutations : retirer `@fontsource/im-fell-english-sc/latin-400.css` de `ui/polices.ts` ; nommer en
  // tête, sans guillemets, une police qu'aucun paquet ne livre (`IM Fell DW Pica SC, Georgia, serif`).
  it.each([1890, 1900])('le monde de %i n’annonce que des polices embarquées', (decennie) => {
    const embarquees = new Set([...POLICES.matchAll(/^import '@fontsource\/([\w-]+)\//gm)].map(([, paquet]) => paquet!))
    const voulues = JETONS_DE_PAGE.filter((j) => j.startsWith('--m-f-')).map((j) => creerRegistre()(decennie).pages.jetons[j])
    const manquantes = voulues
      .map((liste) => liste.split(',')[0]!.trim().replace(/^(['"])(.*)\1$/, '$2'))
      .filter((famille) => !/^(serif|sans-serif|system-ui|monospace|cursive|fantasy)$/i.test(famille))
      .filter((famille) => !embarquees.has(famille.toLowerCase().replace(/\s+/g, '-')))
    expect(embarquees.size).toBeGreaterThan(0)
    expect(manquantes).toEqual([])
  })

  // Mutation : une feuille qui lit `var(--papier)` (la palette de la carte) ou un jeton mal orthographié.
  it.each(Object.entries(FEUILLES))('%s ne lit que les jetons du monde', (_chemin, css) => {
    const jetons = new Set<string>(JETONS_DE_PAGE)
    expect(lues(css).filter((nom) => !jetons.has(nom) && !PERMISES(nom))).toEqual([])
  })

  // Mutation : une couleur de la maquette recopiée en dur (`#decaac`) dans une feuille.
  it.each(Object.entries(FEUILLES))('%s ne porte aucune couleur en dur', (_chemin, css) => {
    const nue = sansCommentaires(css).replace(/var\([^()]*\)/g, '')
    expect(nue.match(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|lab)\(|:\s*(white|black|red|blue|green|gr[ae]y)\b/gi) ?? []).toEqual([])
  })

  // Le jumeau des couleurs : les polices sont aussi des jetons du monde (`--m-f-*`). Mutations : une
  // police de la maquette recopiée en dur (`font-family: 'IM Fell English', Georgia, serif`), puis
  // dans le raccourci (`font: 14px Georgia, serif`), puis sans guillemets ni famille générique
  // (`font: italic 14px Georgia`) : les années 1900 la garderaient.
  it.each(Object.entries(FEUILLES))('%s ne porte aucune police en dur', (_chemin, css) => {
    const nue = sansCommentaires(css).replace(/var\([^()]*\)/g, '')
    const valeurs = (propriete: string) =>
      [...nue.matchAll(new RegExp(`(?:^|[;{\\s])${propriete}\\s*:\\s*([^;}]*)`, 'gi'))].map(([, v]) => v!.trim())
    const familles = valeurs('font-family').filter((v) => v !== '' && v !== 'inherit')
    // Dans le raccourci, ce qui n'est ni une taille (ou `calc(…)`) ni un mot de style, de graisse ou de
    // taille est une famille.
    const raccourcis = valeurs('font').filter((v) =>
      v
        .replace(/[\w-]+\([^()]*\)/g, '')
        .split(/[\s/,]+/)
        .some((mot) => mot !== '' && !/^-?[\d.]+[a-z%]*$/i.test(mot) && !MOTS_DU_RACCOURCI.has(mot.toLowerCase())),
    )
    expect([...familles, ...raccourcis]).toEqual([])
  })
})
