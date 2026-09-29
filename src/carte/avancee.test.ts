import { describe, expect, it, vi } from 'vitest'
import { jouerAvancee, type Scene } from './avancee'
import type { FrontiereAvancee } from '../voyage/regles'

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

describe('la frontière qui avance, chaque étape attend la précédente', () => {
  async function jouerEnDetail(avancee: FrontiereAvancee, vers: number, tampons: number[]) {
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

  // Mutation : l’`await` retiré devant la marche dans une décennie.
  it('dans une décennie, le clap attend la fin de la marche', async () => {
    expect(await jouerEnDetail({ anneeQuittee: 1897, decennieQuittee: null }, 1898, [])).toEqual([
      'début marche', 'fin marche',
      'clap',
      'fini',
    ])
  })
})
