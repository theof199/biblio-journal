import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import Tampons from './Tampons'

const reactions = [
  { cle: 'adore', emoji: '❤️', phrase: 'J’ai adoré' },
  { cle: 'sympa', emoji: '👍', phrase: 'Sympa' },
]

function monter(options: { cachees?: number; depliees?: boolean; cochees?: string[] } = {}) {
  const surBascule = vi.fn()
  const surDeploiement = vi.fn()
  render(
    <Tampons
      reactions={reactions}
      cochees={options.cochees ?? []}
      onBasculer={surBascule}
      cachees={options.cachees ?? 0}
      depliees={options.depliees ?? false}
      onDeplier={surDeploiement}
    />,
  )
  return { surBascule, surDeploiement }
}

describe('Tampons', () => {
  it('pose chaque réaction en tampon, pressé quand elle est cochée', () => {
    monter({ cochees: ['sympa'] })

    expect(screen.getByRole('button', { name: '❤️ J’ai adoré' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '👍 Sympa' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('annonce la clé de la réaction touchée', () => {
    const { surBascule } = monter()

    fireEvent.click(screen.getByRole('button', { name: '👍 Sympa' }))

    expect(surBascule).toHaveBeenCalledWith('sympa')
  })

  it('propose « + 10 autres » au pluriel, « + 1 autre » au singulier', () => {
    const { unmount } = render(<Tampons reactions={reactions} cochees={[]} onBasculer={vi.fn()} cachees={10} depliees={false} onDeplier={vi.fn()} />)
    expect(screen.getByRole('button', { name: '+ 10 autres' })).toBeInTheDocument()
    unmount()

    monter({ cachees: 1 })
    expect(screen.getByRole('button', { name: '+ 1 autre' })).toBeInTheDocument()
  })

  it('propose « − replier » une fois déplié, et annonce le geste', () => {
    const { surDeploiement } = monter({ cachees: 3, depliees: true })

    fireEvent.click(screen.getByRole('button', { name: '− replier' }))

    expect(surDeploiement).toHaveBeenCalledTimes(1)
  })

  it('n’a pas de bouton quand il n’y a rien à cacher', () => {
    monter({ cachees: 0 })

    expect(screen.queryByRole('button', { name: /autre|replier/ })).toBeNull()
  })
})
