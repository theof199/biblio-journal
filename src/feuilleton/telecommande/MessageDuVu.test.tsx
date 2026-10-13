import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import MessageDuVu from './MessageDuVu'

const annonce = () => document.querySelector('[data-piece="annonce"]')!

describe('le message s’annonce', () => {
  // Mutation, dans `MessageDuVu.tsx` : l'état `dit` posé d'emblée à `texte` (la région vivante arriverait
  // déjà remplie : un lecteur d'écran ne la dirait pas).
  it.each([
    ['status', false],
    ['alert', true],
  ] as const)('la région `%s` est montée sans son texte, qui y entre ensuite ; ce qui se voit est là d’emblée, caché aux lecteurs d’écran', async (role, alerte) => {
    render(<MessageDuVu texte="Épisode noté" alerte={alerte} onPartir={() => {}} />)

    const region = screen.getByRole(role)
    expect(region.contains(annonce())).toBe(true)
    expect(annonce()).toBeEmptyDOMElement()
    const visible = screen.getByText('Épisode noté')
    expect(visible).toHaveAttribute('aria-hidden', 'true')

    await waitFor(() => expect(annonce()).toHaveTextContent('Épisode noté'))
    expect(region.contains(annonce())).toBe(true)
  })
})
