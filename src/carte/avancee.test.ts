import { describe, expect, it } from 'vitest'
import { jouerAvancee, type Scene } from './avancee'

function sceneNotee() {
  const journal: string[] = []
  const scene: Scene = {
    passerLaPorte: async () => void journal.push('porte'),
    marcher: async (v) => void journal.push(`marcher ${v}`),
    montrerTampon: async (d) => void journal.push(`tampon ${d}`),
    montrerCarton: async (a) => void journal.push(`carton ${a}`),
    claquer: () => void journal.push('clap'),
  }
  return { journal, scene }
}

describe('la frontière qui avance, mise en scène', () => {
  it('dans une décennie : marcher, puis claquer', async () => {
    const { journal, scene } = sceneNotee()
    await jouerAvancee({ anneeQuittee: 1897, decennieQuittee: null }, 1898, [], scene)
    expect(journal).toEqual(['marcher 1898', 'clap'])
  })

  it('d’une décennie bouclée à la suivante : la porte, le tampon, la marche, le carton', async () => {
    const { journal, scene } = sceneNotee()
    await jouerAvancee({ anneeQuittee: 1899, decennieQuittee: 1890 }, 1900, [1890], scene)
    expect(journal).toEqual(['porte', 'tampon 1890', 'marcher 1900', 'clap', 'carton 1900'])
  })

  // Mutation : montrer le tampon dès qu'on change de décennie.
  it('pas de tampon sans décennie bouclée au passeport', async () => {
    const { journal, scene } = sceneNotee()
    await jouerAvancee({ anneeQuittee: 1899, decennieQuittee: 1890 }, 1900, [], scene)
    expect(journal).not.toContain('tampon 1890')
  })
})
