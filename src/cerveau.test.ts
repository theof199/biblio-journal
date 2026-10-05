import { afterEach, describe, expect, it } from 'vitest'

// Les fiches de `docs/cerveau/` disent à un agent où vit quoi. Une fiche qui
// cite un fichier disparu ou une fonction renommée est pire que pas de fiche :
// ce test refuse qu'elle le fasse. Il ne monte ni page ni moteur.
//
// La seule forme vérifiée d'un renvoi : `chemin` › `symbole`, ou une
// énumération `chemin` › `A`, `B` et `C`, dont chaque symbole est vérifié.
//
// Ce que ce test ne garde pas : le symbole est cherché comme un mot n'importe
// où dans le fichier. Un mot courant (`scene`, `image`, `monde`) s'y trouve
// presque toujours, donc son renvoi ne garde rien : une fiche cite un symbole
// distinctif, ou le dit en prose.
//
// La même règle vit dans `bibliotheque-back` (`apps/api/test/cerveau.test.ts`),
// réécrite et non importée : les deux dépôts ne partagent pas de code.

// Le dépôt n'a pas les types de Node (`reference1890.test.ts` fait de même) : les modules se
// chargent par leur nom, hors de portée de Vite, et ne déclarent que ce que ce test emploie.
interface Entree {
  name: string
  isDirectory: () => boolean
}
interface Fichiers {
  existsSync: (chemin: string) => boolean
  mkdirSync: (dossier: string, options: { recursive: boolean }) => void
  mkdtempSync: (prefixe: string) => string
  readdirSync: (dossier: string, options: { withFileTypes: true }) => Entree[]
  readFileSync: (fichier: string, encodage: 'utf8') => string
  rmSync: (chemin: string, options?: { recursive?: boolean; force?: boolean }) => void
  statSync: (chemin: string) => { isFile: () => boolean }
  writeFileSync: (fichier: string, texte: string) => void
}
interface Chemins {
  dirname: (chemin: string) => string
  join: (...morceaux: string[]) => string
  resolve: (...morceaux: string[]) => string
  sep: string
}
const modules = ['node:fs', 'node:path', 'node:os']
const fs: Fichiers = await import(/* @vite-ignore */ modules[0]!)
const chemins: Chemins = await import(/* @vite-ignore */ modules[1]!)
const os: { tmpdir: () => string } = await import(/* @vite-ignore */ modules[2]!)
const { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } = fs
const { dirname, join, resolve, sep } = chemins

/** La racine du dépôt, d'après l'adresse de ce fichier : Vite réécrit `new URL(…, import.meta.url)` en adresse de ressource. */
const RACINE = decodeURIComponent(import.meta.url.replace(/^file:\/\//, '').replace(/\/src\/[^/]+$/, ''))

const DOSSIER = 'docs/cerveau'
const LIGNES_MAX = 60
/** L'en-tête de la table d'index de `CLAUDE.md`, à l'identique. */
const EN_TETE_INDEX = '| Fiche | Quand la lire |'
const LIGNE_INDEX = /^\| `(docs\/cerveau\/[a-z0-9-]+\.md)` \| (.*) \|$/
const RENVOI = /`([^`]+)` › `([^`]+)`/g
const ENTRE_ACCENTS_GRAVES = /`([^`]+)`/g
const FORME_DE_CHEMIN = /^[\w.@-]+(\/[\w.@-]+)+\/?$/
/** La suite d'une énumération : un identifiant de plus, qui n'ouvre pas un autre renvoi. */
const SUITE_D_ENUMERATION = /(?:, et |, | et | ?… ?)`([\w$-]+)`(?! ›)/y
/** Un chemin nu n'est exigé que s'il désigne un fichier (une extension) ou un dossier (`/` final). */
const FICHIER_OU_DOSSIER = /(\.[A-Za-z0-9]+|\/)$/

/** Les symboles d'un renvoi : le premier, puis ceux que la même ligne enchaîne. */
function symbolesDuRenvoi(prose: string, renvoi: RegExpMatchArray): string[] {
  const symboles = [renvoi[2]!]
  const suite = new RegExp(SUITE_D_ENUMERATION.source, 'y')
  suite.lastIndex = renvoi.index! + renvoi[0].length
  for (let suivant = suite.exec(prose); suivant; suivant = suite.exec(prose)) {
    symboles.push(suivant[1]!)
  }
  return symboles
}

function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Le chemin absolu, ou `null` s'il sort du dépôt : la CI n'a que ce dépôt. */
function dansLeDepot(racine: string, chemin: string): string | null {
  const base = resolve(racine)
  const absolu = resolve(base, chemin)
  return absolu.startsWith(base + sep) ? absolu : null
}

/** Les dossiers de premier niveau (`src`, `docs`, `scripts`…) : ce par quoi commence un chemin du dépôt. */
function dossiersDePremierNiveau(racine: string): string[] {
  return readdirSync(racine, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'node_modules' && e.name !== '.git' && e.name !== 'dist' && e.name !== 'dev-dist')
    .map((e) => e.name)
}

/** Le texte hors des blocs de code : une commande n'est ni un renvoi ni un chemin cité. */
function horsBlocsDeCode(texte: string): string {
  let dedans = false
  return texte
    .split('\n')
    .filter((ligne) => {
      if (ligne.trimStart().startsWith('```')) {
        dedans = !dedans
        return false
      }
      return !dedans
    })
    .join('\n')
}

function defautsDeLaFiche(racine: string, fiche: string, texte: string): string[] {
  const defauts: string[] = []
  const lignes = texte.replace(/\n$/, '').split('\n').length
  if (lignes > LIGNES_MAX) {
    defauts.push(`${fiche} : ${lignes} lignes, ${LIGNES_MAX} au plus`)
  }

  const prose = horsBlocsDeCode(texte)
  const renvois = [...prose.matchAll(RENVOI)]
  if (renvois.length === 0) {
    defauts.push(`${fiche} : aucun renvoi vérifiable de la forme \`chemin\` › \`symbole\``)
  }
  // Un `›` coupé par un retour à la ligne ne serait vérifié par personne.
  for (const ligne of prose.split('\n')) {
    if (ligne.split('›').length - 1 !== [...ligne.matchAll(RENVOI)].length) {
      defauts.push(`${fiche} : un « › » hors de la forme \`chemin\` › \`symbole\` : ${ligne.trim()}`)
    }
  }
  for (const renvoi of renvois) {
    const chemin = renvoi[1]!
    const absolu = dansLeDepot(racine, chemin)
    if (absolu === null) {
      defauts.push(`${fiche} : ${renvoi[0]} sort du dépôt`)
    } else if (!existsSync(absolu)) {
      defauts.push(`${fiche} : ${renvoi[0]} cite un chemin qui n’existe pas`)
    } else if (!statSync(absolu).isFile()) {
      defauts.push(`${fiche} : ${renvoi[0]} cite un dossier, pas un fichier`)
    } else {
      const contenu = readFileSync(absolu, 'utf8')
      for (const symbole of symbolesDuRenvoi(prose, renvoi)) {
        if (!new RegExp(`(?<![\\w])${echapper(symbole)}(?![\\w])`).test(contenu)) {
          defauts.push(`${fiche} : \`${chemin}\` › \`${symbole}\` cite un symbole absent du fichier`)
        }
      }
    }
  }

  // Un chemin seul, sans `›`, est de la prose. Mais s'il a la forme d'un
  // chemin de ce dépôt (il commence par un de ses dossiers) et désigne un
  // fichier ou un dossier, il doit exister. Sans extension ni `/` final
  // (`src/mondes/avenir`), il passe : un dossier se cite avec son `/`.
  const premiers = dossiersDePremierNiveau(racine)
  for (const cite of prose.replace(RENVOI, '').matchAll(ENTRE_ACCENTS_GRAVES)) {
    const chemin = cite[1]!
    if (!FORME_DE_CHEMIN.test(chemin) || !premiers.includes(chemin.split('/')[0]!)) continue
    if (!FICHIER_OU_DOSSIER.test(chemin)) continue
    const absolu = dansLeDepot(racine, chemin)
    if (absolu === null || !existsSync(absolu)) {
      defauts.push(`${fiche} : \`${chemin}\` cite un chemin qui n’existe pas`)
    }
  }
  return defauts
}

/** Les fiches que la table d'index de `CLAUDE.md` annonce, et ses défauts de forme. */
function lireIndex(racine: string): { fiches: string[]; defauts: string[] } {
  const lignes = readFileSync(join(racine, 'CLAUDE.md'), 'utf8').split('\n')
  const debuts = lignes.flatMap((ligne, i) => (ligne === EN_TETE_INDEX ? [i] : []))
  if (debuts.length !== 1) {
    return { fiches: [], defauts: [`CLAUDE.md : ${debuts.length} table(s) d’index « ${EN_TETE_INDEX} », une attendue`] }
  }
  const fiches: string[] = []
  const defauts: string[] = []
  // La ligne qui suit l'en-tête est le séparateur `|---|---|`.
  for (let i = debuts[0]! + 2; i < lignes.length && lignes[i]!.startsWith('|'); i++) {
    const ligne = LIGNE_INDEX.exec(lignes[i]!)
    if (!ligne) {
      defauts.push(`CLAUDE.md : ligne d’index illisible : ${lignes[i]!}`)
    } else if (ligne[2]!.trim() === '') {
      defauts.push(`CLAUDE.md : la ligne d’index de ${ligne[1]!} ne dit pas quand la lire`)
    } else if (fiches.includes(ligne[1]!)) {
      defauts.push(`CLAUDE.md : ${ligne[1]!} est deux fois dans l’index`)
    } else {
      fiches.push(ligne[1]!)
    }
  }
  return { fiches, defauts }
}

/** Tout ce qui cloche, une phrase par défaut ; vide quand les fiches disent vrai. */
function defautsDuCerveau(racine: string): string[] {
  const dossier = join(racine, DOSSIER)
  const fiches = existsSync(dossier)
    ? readdirSync(dossier, { withFileTypes: true })
        .map((e) => e.name)
        .filter((nom) => nom.endsWith('.md'))
        .sort()
        .map((nom) => `${DOSSIER}/${nom}`)
    : []
  const index = lireIndex(racine)
  const defauts = [...index.defauts]
  if (fiches.length === 0) {
    defauts.push(`${DOSSIER}/ : aucune fiche, ce test ne vérifierait rien`)
  }
  for (const fiche of fiches) {
    if (!index.fiches.includes(fiche)) {
      defauts.push(`${fiche} : absente de la table d’index de CLAUDE.md`)
    }
    defauts.push(...defautsDeLaFiche(racine, fiche, readFileSync(join(racine, fiche), 'utf8')))
  }
  for (const annoncee of index.fiches) {
    if (!fiches.includes(annoncee)) {
      defauts.push(`CLAUDE.md : la ligne d’index de ${annoncee} n’a pas de fiche`)
    }
  }
  return defauts
}

describe('les fiches de docs/cerveau', () => {
  it('se lisent dans le vrai dépôt', () => {
    expect(RACINE.startsWith('/')).toBe(true)
    expect(existsSync(join(RACINE, 'src/cerveau.test.ts'))).toBe(true)
  })

  it('disent vrai : chaque renvoi existe, chaque fiche est courte et indexée', () => {
    expect(defautsDuCerveau(RACINE)).toEqual([])
  })
})

// Le vérificateur lui-même, sur un dépôt de poche : sans ces cas, une
// interdiction retirée de `defautsDuCerveau` ne ferait rien échouer tant que
// les vraies fiches sont justes.
describe('le vérificateur des fiches', () => {
  const FICHE = 'docs/cerveau/sujet.md'
  const JUSTE = 'Voir `src/outil.ts` › `faireLeGeste`, dans `src/`.\n'
  const depots: string[] = []

  function depot(fichiers: Record<string, string>): string {
    const racine = mkdtempSync(join(os.tmpdir(), 'cerveau-'))
    depots.push(racine)
    const tous: Record<string, string> = {
      'CLAUDE.md': `## Les fiches\n\n${EN_TETE_INDEX}\n|---|---|\n| \`${FICHE}\` | Avant de toucher au sujet. |\n\nSuite.\n`,
      'src/outil.ts': 'export function faireLeGeste() {}\n',
      [FICHE]: JUSTE,
      ...fichiers,
    }
    for (const [chemin, contenu] of Object.entries(tous)) {
      mkdirSync(dirname(join(racine, chemin)), { recursive: true })
      writeFileSync(join(racine, chemin), contenu)
    }
    return racine
  }

  afterEach(() => {
    for (const racine of depots.splice(0)) rmSync(racine, { recursive: true, force: true })
  })

  it('ne dit rien d’un dépôt juste', () => {
    expect(defautsDuCerveau(depot({}))).toEqual([])
  })

  it('refuse un renvoi dont le chemin n’existe pas', () => {
    expect(defautsDuCerveau(depot({ [FICHE]: 'Voir `src/parti.ts` › `faireLeGeste`.\n' }))).toEqual([
      `${FICHE} : \`src/parti.ts\` › \`faireLeGeste\` cite un chemin qui n’existe pas`,
    ])
  })

  it('refuse un symbole absent du fichier cité, même s’il en préfixe un autre', () => {
    expect(defautsDuCerveau(depot({ [FICHE]: 'Voir `src/outil.ts` › `faireLe`.\n' }))).toEqual([
      `${FICHE} : \`src/outil.ts\` › \`faireLe\` cite un symbole absent du fichier`,
    ])
  })

  it('vérifie chaque symbole d’une énumération, pas seulement le premier', () => {
    const outil = 'export function faireLeGeste() {}\nexport function defaire() {}\nexport const BUDGET = 3\n// tout-doux\n'
    const fiche = (ligne: string) => depot({ 'src/outil.ts': outil, 'src/autre.ts': 'export const cible = 1\n', [FICHE]: ligne })
    expect(defautsDuCerveau(fiche('Voir `src/outil.ts` › `faireLeGeste`, `defaire`, `tout-doux` et `BUDGET`.\n'))).toEqual([])
    expect(defautsDuCerveau(fiche('Voir `src/outil.ts` › `faireLeGeste`, `parti` et `BUDGET`.\n'))).toEqual([
      `${FICHE} : \`src/outil.ts\` › \`parti\` cite un symbole absent du fichier`,
    ])
    expect(defautsDuCerveau(fiche('Voir `src/outil.ts` › `faireLeGeste`, `defaire`… `perdu`, et `tout-parti`.\n'))).toEqual([
      `${FICHE} : \`src/outil.ts\` › \`perdu\` cite un symbole absent du fichier`,
      `${FICHE} : \`src/outil.ts\` › \`tout-parti\` cite un symbole absent du fichier`,
    ])
    // L'énumération s'arrête à la prose, et au renvoi suivant de la même ligne.
    expect(
      defautsDuCerveau(fiche('`src/outil.ts` › `defaire`, `src/autre.ts` › `cible` appelle `ailleurs`, `perdu`, dans `src/`.\n')),
    ).toEqual([])
  })

  it('refuse un renvoi qui sort du dépôt, même vers un fichier qui existe', () => {
    const racine = depot({})
    const voisin = `../${racine.split(sep).pop()!}/src/outil.ts`
    expect(defautsDuCerveau(depot({ [FICHE]: `Voir \`${voisin}\` › \`faireLeGeste\`.\n` }))).toEqual([
      `${FICHE} : \`${voisin}\` › \`faireLeGeste\` sort du dépôt`,
    ])
  })

  it('refuse un renvoi vers un dossier', () => {
    expect(defautsDuCerveau(depot({ [FICHE]: 'Voir `src` › `outil`.\n' }))).toEqual([
      `${FICHE} : \`src\` › \`outil\` cite un dossier, pas un fichier`,
    ])
  })

  it('refuse une fiche de plus de 60 lignes, pas une de 60', () => {
    expect(defautsDuCerveau(depot({ [FICHE]: JUSTE + 'ligne\n'.repeat(59) }))).toEqual([])
    expect(defautsDuCerveau(depot({ [FICHE]: JUSTE + 'ligne\n'.repeat(60) }))).toEqual([
      `${FICHE} : 61 lignes, 60 au plus`,
    ])
  })

  it('refuse une fiche sans aucun renvoi vérifiable', () => {
    expect(defautsDuCerveau(depot({ [FICHE]: 'Voir `src/outil.ts`, quelque part.\n' }))).toEqual([
      `${FICHE} : aucun renvoi vérifiable de la forme \`chemin\` › \`symbole\``,
    ])
  })

  it('refuse un renvoi coupé par un retour à la ligne, que personne ne vérifierait', () => {
    expect(defautsDuCerveau(depot({ [FICHE]: JUSTE + 'Voir `src/outil.ts` ›\n`parti`.\n' }))).toEqual([
      `${FICHE} : un « › » hors de la forme \`chemin\` › \`symbole\` : Voir \`src/outil.ts\` ›`,
    ])
  })

  it('refuse une fiche absente de l’index', () => {
    expect(defautsDuCerveau(depot({ 'docs/cerveau/autre.md': JUSTE }))).toEqual([
      'docs/cerveau/autre.md : absente de la table d’index de CLAUDE.md',
    ])
  })

  it('refuse une ligne d’index sans fiche, et un dossier sans fiche', () => {
    const racine = depot({})
    rmSync(join(racine, FICHE))
    expect(defautsDuCerveau(racine)).toEqual([
      'docs/cerveau/ : aucune fiche, ce test ne vérifierait rien',
      `CLAUDE.md : la ligne d’index de ${FICHE} n’a pas de fiche`,
    ])
    rmSync(join(racine, DOSSIER), { recursive: true })
    expect(defautsDuCerveau(racine)).toContain('docs/cerveau/ : aucune fiche, ce test ne vérifierait rien')
  })

  it('refuse un CLAUDE.md sans table d’index, ou dont une ligne ne se lit pas', () => {
    expect(defautsDuCerveau(depot({ 'CLAUDE.md': '## Les fiches\n' }))).toEqual([
      `CLAUDE.md : 0 table(s) d’index « ${EN_TETE_INDEX} », une attendue`,
      `${FICHE} : absente de la table d’index de CLAUDE.md`,
    ])
    const bancale = `${EN_TETE_INDEX}\n|---|---|\n| ${FICHE} | Sans accents graves. |\n| \`${FICHE}\` |  |\n`
    expect(defautsDuCerveau(depot({ 'CLAUDE.md': bancale }))).toEqual([
      `CLAUDE.md : ligne d’index illisible : | ${FICHE} | Sans accents graves. |`,
      `CLAUDE.md : la ligne d’index de ${FICHE} ne dit pas quand la lire`,
      `${FICHE} : absente de la table d’index de CLAUDE.md`,
    ])
    const doublee = `${EN_TETE_INDEX}\n|---|---|\n| \`${FICHE}\` | Une fois. |\n| \`${FICHE}\` | Deux fois. |\n`
    expect(defautsDuCerveau(depot({ 'CLAUDE.md': doublee }))).toEqual([`CLAUDE.md : ${FICHE} est deux fois dans l’index`])
  })

  it('refuse un chemin seul qui a la forme d’un chemin du dépôt et n’existe pas', () => {
    expect(defautsDuCerveau(depot({ [FICHE]: JUSTE + 'Et `src/parti.ts`.\n' }))).toEqual([
      `${FICHE} : \`src/parti.ts\` cite un chemin qui n’existe pas`,
    ])
  })

  it('exige un dossier cité avec son `/` final, pas un nom sans extension', () => {
    expect(defautsDuCerveau(depot({ [FICHE]: JUSTE + 'Et `src/parti/`, `src/mondes/avenir`.\n' }))).toEqual([
      `${FICHE} : \`src/parti/\` cite un chemin qui n’existe pas`,
    ])
  })

  it('laisse passer ce qui n’est pas un chemin du dépôt : commande, autre dépôt, bloc de code', () => {
    const prose =
      JUSTE +
      'Lancer `npx vitest run src/parti.test.ts`, lire `bibliotheque-back/docs/openapi.json`,\n' +
      '`voyage/tempo.ts`, `/tmp/reference avant/parti`, `src/mondes/avenir` et `src/*.ts`.\n\n```bash\nsrc/parti.ts\n`src/parti.ts`\n```\n'
    expect(defautsDuCerveau(depot({ [FICHE]: prose }))).toEqual([])
  })
})
