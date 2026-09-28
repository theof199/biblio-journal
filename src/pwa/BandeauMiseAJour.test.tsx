import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import BandeauMiseAJour from './BandeauMiseAJour'

describe('le bandeau de mise à jour', () => {
  it('ne dit rien tant qu’aucune version n’attend', () => {
    render(<BandeauMiseAJour visible={false} onRecharger={() => undefined} />)

    expect(screen.queryByText('Nouvelle version')).not.toBeInTheDocument()
  })

  it('annonce la version et ne recharge qu’à la demande', () => {
    const onRecharger = vi.fn()
    render(<BandeauMiseAJour visible onRecharger={onRecharger} />)

    expect(screen.getByText('Nouvelle version')).toBeInTheDocument()
    expect(onRecharger).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Recharger' }))
    expect(onRecharger).toHaveBeenCalledTimes(1)
  })
})
