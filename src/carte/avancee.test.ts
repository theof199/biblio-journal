import { describe, expect, it, vi } from 'vitest'
import { jouerAvancee, type Scene } from './avancee'
import type { FrontiereAvancee } from '../voyage/regles'

/** `passages` : les décennies dont le monde a un passage d'entrée. */
function sceneNotee(passages: readonly number[] = []) {
  const journal: string[] = []
  const scene: Scene = {
    passerLaPorte: async () => void journal.push('porte'),
    marcher: async (v) => void journal.push(`marcher ${v}`),
    montrerTampon: async (d) => void journal.push(`tampon ${d}`),
    montrerCarton: async (a) => void journal.push(`carton ${a}`),
    claquer: () => void journal.push('clap'),
    aUnPassage: (d) => passages.includes(d),
    direBonjour: async (d) => void journal.push(`bonjour ${d}`),
  }
  return { journal, scene }
}

describe('la frontière qui avance, mise en scène', () => {
  it('dans une décennie : marcher, puis claquer', async () => {
    const { journal, scene } = sceneNotee()
    await jouerAvancee({ anneeQuittee: 1897, decennieQuittee: null }, 1898, [], scene)
    expect(journal).toEqual(['marcher 1898', 'clap'])
  })

  // Mutation : `aUnPassage` qui rend toujours vrai (le monde sans passage se verrait dire bonjour,
  // et perdrait son carton).
  it('d’une décennie bouclée à la suivante : la porte, le tampon, la marche, le carton', async () => {
    const { journal, scene } = sceneNotee()
    await jouerAvancee({ anneeQuittee: 1899, decennieQuittee: 1890 }, 1900, [1890], scene)
    expect(journal).toEqual(['porte', 'tampon 1890', 'marcher 1900', 'clap', 'carton 1900'])
  })

  // Plan 3b, tâche 13. Mutations : `aUnPassage` qui rend toujours faux (la marche et le carton
  // reviendraient) ; `aUnPassage` lu sur la décennie quittée.
  it('vers un monde qui a un passage : la porte, le tampon, le bonjour, le clap ; ni marche ni carton quand on arrive à sa première année', async () => {
    const { journal, scene } = sceneNotee([1900])
    await jouerAvancee({ anneeQuittee: 1899, decennieQuittee: 1890 }, 1900, [1890], scene)
    expect(journal).toEqual(['porte', 'tampon 1890', 'bonjour 1900', 'clap'])
  })

  // Le rattrapage du Voyage suivi (vigilance 2) : de 1898 à 1903 sans ticket. Mutation : `marcher`
  // retiré de la suite (le membre resterait en gare de 1900).
  it('vers une année plus loin dans un monde à passage : le bonjour, le clap, puis la marche jusqu’à elle', async () => {
    const { journal, scene } = sceneNotee([1900])
    await jouerAvancee({ anneeQuittee: 1898, decennieQuittee: 1890 }, 1903, [], scene)
    expect(journal).toEqual(['porte', 'bonjour 1900', 'clap', 'marcher 1903'])
  })

  // Mutation : le passage joué dans une même décennie (`aUnPassage` lu hors du changement de décennie).
  it('dans une décennie qui a un passage, une année à la suivante : marcher, puis claquer, sans bonjour', async () => {
    const { journal, scene } = sceneNotee([1900])
    await jouerAvancee({ anneeQuittee: 1901, decennieQuittee: null }, 1902, [], scene)
    expect(journal).toEqual(['marcher 1902', 'clap'])
  })

  // Mutation : montrer le tampon dès qu'on change de décennie.
  it('pas de tampon sans décennie bouclée au passeport', async () => {
    const { journal, scene } = sceneNotee()
    await jouerAvancee({ anneeQuittee: 1899, decennieQuittee: 1890 }, 1900, [], scene)
    expect(journal).not.toContain('tampon 1890')
  })
})

describe('la frontière qui avance, chaque étape attend la précédente', () => {
  async function jouerEnDetail(avancee: FrontiereAvancee, vers: number, tampons: number[], passages: readonly number[] = []) {
    const journal: string[] = []
    const etape = (nom: string) => async () => {
      journal.push(`début ${nom}`)
      await new Promise<void>((fini) => setTimeout(fini, 10))
      journal.push(`fin ${nom}`)
    }
    const scene: Scene = {
      passerLaPorte: etape('porte'),
      marcher: etape('marche'),
      montrerTampon: etape('tampon'),
      montrerCarton: etape('carton'),
      claquer: () => void journal.push('clap'),
      aUnPassage: (d) => passages.includes(d),
      direBonjour: etape('bonjour'),
    }
    vi.useFakeTimers()
    try {
      const fin = jouerAvancee(avancee, vers, tampons, scene).then(() => void journal.push('fini'))
      await vi.runAllTimersAsync()
      await fin
    } finally {
      vi.useRealTimers()
    }
    return journal
  }

  // Mutation : un `await` retiré devant une étape de la scène.
  it('d’une décennie à l’autre, aucune étape ne commence avant la fin de la précédente', async () => {
    expect(await jouerEnDetail({ anneeQuittee: 1899, decennieQuittee: 1890 }, 1900, [1890])).toEqual([
      'début porte', 'fin porte',
      'début tampon', 'fin tampon',
      'début marche', 'fin marche',
      'clap',
      'début carton', 'fin carton',
      'fini',
    ])
  })

  // Plan 3b, tâche 13. Mutations : l'`await` retiré devant `direBonjour` (le clap, puis la marche,
  // partiraient pendant le passage) ; devant le tampon ; devant la marche d'après.
  it('vers un monde à passage, le bonjour attend le tampon, le clap attend la fin du bonjour, la marche vient après', async () => {
    expect(await jouerEnDetail({ anneeQuittee: 1898, decennieQuittee: 1890 }, 1903, [1890], [1900])).toEqual([
      'début porte', 'fin porte',
      'début tampon', 'fin tampon',
      'début bonjour', 'fin bonjour',
      'clap',
      'début marche', 'fin marche',
      'fini',
    ])
  })

  // Mutation : l’`await` retiré devant la marche dans une décennie.
  it('dans une décennie, le clap attend la fin de la marche', async () => {
    expect(await jouerEnDetail({ anneeQuittee: 1897, decennieQuittee: null }, 1898, [])).toEqual([
      'début marche', 'fin marche',
      'clap',
      'fini',
    ])
  })
})
