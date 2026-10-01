import { describe, expect, it } from 'vitest'
import theme from '../ui/theme.css?raw'
import polices from '../ui/polices.ts?raw'
import module from './Fronton.module.css?raw'
import { DECENNIES } from './fronton'

/** La police du titre de chaque décennie, telle que son bloc de `theme.css` la nomme, et le paquet qui la porte. */
const POLICES = {
  1890: ['Rye', 'rye/latin-400'],
  1900: ['Ribeye', 'ribeye/latin-400'],
  1910: ['Abril Fatface', 'abril-fatface/latin-400'],
  1920: ['Rammetto One', 'rammetto-one/latin-400'],
  1930: ['Bowlby One SC', 'bowlby-one-sc/latin-400'],
  1940: ['League Gothic', 'league-gothic/latin-400'],
  1950: ['Lobster', 'lobster/latin-400'],
  1960: ['Shrikhand', 'shrikhand/latin-400'],
  1970: ['Caprasimo', 'caprasimo/latin-400'],
  1980: ['Russo One', 'russo-one/latin-400'],
  1990: ['Cinzel', 'cinzel/latin-900'],
  2000: ['Orbitron', 'orbitron/latin-900'],
  2010: ['Montserrat', 'montserrat/latin-900'],
  2020: ['Unbounded', 'unbounded/latin-900'],
} as const

const sansCommentaires = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Le corps du bloc `[data-decennie='…']`. */
function bloc(decennie: number): string | undefined {
  return sansCommentaires(theme).match(new RegExp(`\\[data-decennie='${decennie}'\\]\\s*\\{([^}]*)\\}`))?.[1]
}

describe('les enseignes du fronton', () => {
  it('nomme une police pour chaque décennie que fronton.ts connaît', () => {
    expect(Object.keys(POLICES).map(Number)).toEqual([...DECENNIES])
  })

  it.each(DECENNIES)('la décennie %i a son bloc dans theme.css', (decennie) => {
    expect(bloc(decennie)).toBeDefined()
  })

  it.each(DECENNIES)('le bloc de %i pose la police de son titre', (decennie) => {
    expect(bloc(decennie)).toContain(`--police-enseigne: '${POLICES[decennie][0]}'`)
  })

  it.each(DECENNIES)('la police de %i est embarquée, en latin et dans la seule graisse posée', (decennie) => {
    expect(polices).toContain(`import '@fontsource/${POLICES[decennie][1]}.css'`)
  })

  it('n’a pas de bloc pour une décennie que fronton.ts ne connaît pas', () => {
    const blocs = [...sansCommentaires(theme).matchAll(/\[data-decennie='(\d+)'\]/g)].map(([, decennie]) => Number(decennie))
    expect(blocs).toEqual([...DECENNIES])
  })

  it('n’allume les lettres qu’une fois, et pas du tout quand le mouvement est réduit', () => {
    expect(module).toMatch(/animation:\s*allumage var\(--enseigne-allumage-duree\) steps\(var\(--longueur\)\) backwards;/)
    expect(module).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*animation:\s*none;/)
  })

  it('n’allume que l’enseigne de 1940', () => {
    const durees = [...sansCommentaires(theme).matchAll(/--enseigne-allumage-duree:\s*([^;]+);/g)].map(([, duree]) => duree)
    expect(durees.filter((duree) => duree !== '0s')).toEqual(['0.9s'])
    expect(bloc(1940)).toMatch(/--enseigne-allumage-duree:\s*0\.9s/)
  })

  it('éteint les lueurs le jour : elles ne se posent que dans les deux blocs sombres', () => {
    const css = sansCommentaires(theme)
    const sombres = [css.match(/:root:not\(\[data-theme='clair'\]\)\s*\{[^}]*\}/)?.[0], css.match(/:root\[data-theme='sombre'\]\s*\{[^}]*\}/)?.[0]]
    for (const jeton of ['--enseigne-nuit-1910', '--enseigne-nuit-1940', '--enseigne-nuit-1950', '--enseigne-nuit-1950-lettre', '--enseigne-nuit-1980']) {
      for (const sombre of sombres) expect(sombre).toMatch(new RegExp(`${jeton}:\\s*(0 0|drop-shadow)`))
      expect(css.match(new RegExp(`${jeton}:\\s*(0 0 0 transparent|none);`))).not.toBeNull()
    }
  })
})
