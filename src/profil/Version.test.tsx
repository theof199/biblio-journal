import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Version } from './Version'

afterEach(() => vi.unstubAllEnvs())

describe('Version', () => {
  it('montre le tag et le SHA injectés au build', () => {
    vi.stubEnv('VITE_VERSION', 'v1.23.0')
    vi.stubEnv('VITE_COMMIT', 'a1b2c3d')
    render(<Version />)
    expect(screen.getByText('Version v1.23.0 · a1b2c3d')).toBeInTheDocument()
  })

  it('montre « dev » sans les variables, jamais une valeur vide', () => {
    vi.stubEnv('VITE_VERSION', '')
    vi.stubEnv('VITE_COMMIT', '')
    render(<Version />)
    expect(screen.getByText('Version dev')).toBeInTheDocument()
  })
})
