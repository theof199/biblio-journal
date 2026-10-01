import { describe, expect, it } from 'vitest'
import theme from './theme.css?raw'
import voyage from './voyage.css?raw'
import coque from '../coque/Coque.module.css?raw'
import affiche from './Affiche.module.css?raw'
import auCine from '../pages/AuCine.module.css?raw'
import suivis from '../pages/Suivis.module.css?raw'

/** Tous les `*.module.css` de l'app, par chemin (`/src/…`). */
const MODULES = import.meta.glob<string>('/src/**/*.module.css', { query: '?raw', import: 'default', eager: true })

/** Le Voyage a son habillage à lui (`voyage.css`) : ses styles vivent sous ces dossiers ou ces noms. */
const DU_VOYAGE = /\/(carte|mondes|voyage)\/|\/Voyage[^/]*\.module\.css$/

const HORS_VOYAGE = Object.entries(MODULES).filter(([chemin]) => !DU_VOYAGE.test(chemin))

const sansCommentaires = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Les déclarations `propriété: valeur` d'une feuille, commentaires ôtés. */
function declarations(css: string) {
  return [...sansCommentaires(css).matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)].map(([, prop, valeur]) => ({
    prop: prop!,
    valeur: valeur!.trim(),
  }))
}

/** Les variables lues par `var(--…)`. */
const lues = (css: string) => [...sansCommentaires(css).matchAll(/var\(\s*(--[\w-]+)/g)].map(([, nom]) => nom!)

/** Les variables définies (`--nom:`). */
const definies = (css: string) => new Set([...sansCommentaires(css).matchAll(/(--[\w-]+)\s*:/g)].map(([, nom]) => nom!))

/** Le corps de la règle d'un sélecteur, tel qu'écrit. */
function regle(css: string, selecteur: string) {
  const debut = sansCommentaires(css).indexOf(`${selecteur} {`)
  if (debut < 0) throw new Error(`règle absente : ${selecteur}`)
  const reste = sansCommentaires(css).slice(debut)
  return reste.slice(reste.indexOf('{') + 1, reste.indexOf('}'))
}

/** Ce qu'une valeur a le droit de porter en dur : la mise en page, pas l'habillage. */
const PERMIS = new Set(['0', '100%', '100dvh'])

describe('le thème', () => {
  it('trouve les feuilles qu’il garde', () => {
    // Sans ce plancher, un glob qui ne trouverait plus rien rendrait les gardes suivantes muettes.
    expect(HORS_VOYAGE.map(([chemin]) => chemin)).toEqual(
      expect.arrayContaining(['/src/coque/Coque.module.css', '/src/pages/Connexion.module.css', '/src/pages/Accueil.module.css']),
    )
  })

  it.each(HORS_VOYAGE)('%s ne porte ni couleur ni taille en dur', (_chemin, css) => {
    const fautes = declarations(css).flatMap(({ prop, valeur }) => {
      // Ce qui passe par une variable ou par la zone sûre du téléphone ne compte pas.
      const nue = valeur.replace(/var\([^()]*\)/g, '').replace(/env\([^()]*\)/g, '')
      const couleurs = nue.match(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|lab)\(|\b(white|black|red|blue|green|gr[ae]y)\b/gi) ?? []
      const nombres = (nue.match(/-?\d*\.?\d+[a-z%]*/gi) ?? []).filter((n) => !PERMIS.has(n) && !(prop === 'flex' && n === '1'))
      return [...couleurs, ...nombres].map((faute) => `${prop}: ${valeur} (${faute})`)
    })
    expect(fautes).toEqual([])
  })

  it.each(HORS_VOYAGE)('%s ne lit que des variables de theme.css', (_chemin, css) => {
    // Attrape la faute de frappe, qui retombe en silence sur la valeur héritée, et la palette du
    // Voyage (`--papier`…), qui n'est pas définie dans theme.css.
    const connues = definies(theme)
    expect(lues(css).filter((nom) => !connues.has(nom))).toEqual([])
  })

  it('theme.css ne lit rien du Voyage', () => {
    const duVoyage = definies(voyage)
    expect(duVoyage.size).toBeGreaterThan(0)
    expect(lues(theme).filter((nom) => duVoyage.has(nom))).toEqual([])
  })
})

describe('la zone sûre du téléphone', () => {
  it('la barre d’onglets s’écarte du bas de l’écran', () => {
    expect(regle(coque, '.barre')).toMatch(/padding:[^;]*env\(safe-area-inset-bottom\)/)
  })

  it('le contenu laisse libre la barre et la zone sûre', () => {
    expect(regle(theme, ':root')).toMatch(/--coque-bas:[^;]*env\(safe-area-inset-bottom\)/)
    // Ancrée : `min-height` passerait sinon, et la zone, grandie avec sa page, ne défilerait plus.
    expect(regle(coque, '.contenu')).toMatch(/(^|[\s;])height:\s*calc\(100% - var\(--coque-bas\)\)/)
  })
})

describe('le défilement', () => {
  it('seule la zone de contenu de la coque défile, bornée au-dessus de la barre', () => {
    expect(regle(coque, '.coque')).toMatch(/position:\s*fixed/)
    expect(regle(coque, '.coque')).toMatch(/(^|[\s;])bottom:\s*0;/)
    expect(regle(coque, '.contenu')).toMatch(/overflow-y:\s*auto/)
    expect(regle(coque, '.contenu')).toMatch(/overflow-x:\s*hidden/)
  })

  it('le rebond reste dans la zone : ni la zone ni le document ne le passent à la page', () => {
    expect(regle(coque, '.contenu')).toMatch(/overscroll-behavior:\s*contain/)
    expect(regle(theme, 'html,\nbody')).toMatch(/overscroll-behavior:\s*none/)
  })

  it('le corps ne dépasse pas l’écran du téléphone (100vh compte sous la barre d’adresse)', () => {
    expect(sansCommentaires(theme)).toMatch(/\nbody \{[^}]*min-height:\s*100dvh/)
  })
})

describe('les grilles', () => {
  // `1fr` vaut `minmax(auto, 1fr)` : le minimum est le contenu, un titre long ou une image gonfle la
  // piste et la page défile de côté. `minmax(0, 1fr)` la borne.
  it.each(['--grille-sorties-colonnes', '--grille-bande-colonnes'])(
    '%s borne ses pistes à zéro',
    (jeton) => {
      const valeur = regle(theme, ':root').match(new RegExp(`${jeton}:\\s*([^;]+);`))?.[1]
      expect(valeur).toMatch(/^repeat\(\d+, minmax\(0, 1fr\)\)/)
    },
  )

  it('aucune feuille n’écrit de piste `1fr` nue', () => {
    const fautes = HORS_VOYAGE.flatMap(([chemin, css]) =>
      declarations(css)
        .filter(({ prop, valeur }) => /^grid-template-(columns|rows)$/.test(prop) && /(^|[\s,(])1fr\b/.test(valeur.replace(/minmax\(0, 1fr\)/g, '')))
        .map(({ valeur }) => `${chemin} : ${valeur}`),
    )
    expect(fautes).toEqual([])
  })

  /** Chaque grille de l'app et la classe de ses éléments, qui doivent pouvoir rétrécir sous leur contenu. */
  const ELEMENTS_DE_GRILLE = [
    ['/src/pages/AuCine.module.css', auCine, '.tuile'],
    ['/src/pages/Suivis.module.css', suivis, '.case'],
  ] as const

  it('chaque feuille qui pose une grille d’affiches a son élément dans la table', () => {
    const grilles = HORS_VOYAGE.filter(([, css]) => /var\(--grille-[a-z-]+-colonnes\)/.test(sansCommentaires(css))).map(([chemin]) => chemin)
    expect(grilles.sort()).toEqual(ELEMENTS_DE_GRILLE.map(([chemin]) => chemin).sort())
  })

  it.each(ELEMENTS_DE_GRILLE)('l’élément de grille de %s peut rétrécir sous son contenu', (_chemin, css, selecteur) => {
    expect(regle(css, selecteur)).toMatch(/min-width:\s*0/)
  })
})

describe('l’affiche', () => {
  it('le cadre tient son ratio, image ou non', () => {
    expect(regle(affiche, '.cadre')).toMatch(/aspect-ratio:\s*var\(--ratio-affiche\)/)
    expect(regle(affiche, '.cadre')).toMatch(/overflow:\s*hidden/)
    // Le repère de l'image posée en absolu : sans lui, elle prendrait la taille du premier ancêtre positionné.
    expect(regle(affiche, '.cadre')).toMatch(/(^|[\s;])position:\s*relative/)
  })

  it('l’image remplit le cadre sans le dimensionner', () => {
    const image = regle(affiche, '.image')
    expect(image).toMatch(/position:\s*absolute/)
    expect(image).toMatch(/object-fit:\s*cover/)
  })
})
