import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { useHauteurAuto } from './useHauteurAuto'

function Champ() {
  const [texte, setTexte] = useState('')
  const champ = useRef<HTMLTextAreaElement>(null)
  useHauteurAuto(champ, texte)
  return <textarea ref={champ} aria-label="Remarque" value={texte} onChange={(event) => setTexte(event.target.value)} />
}

/**
 * jsdom ne dispose rien. Comme un navigateur, `scrollHeight` n'est jamais plus petit que la hauteur
 * posée sur le champ : sans la remise à `auto`, un champ qui a grandi ne rétrécirait pas. Le
 * contenu, lui, fait 28 px par ligne.
 */
function simulerLaMesure() {
  vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLTextAreaElement) {
    return Math.max(this.value.split('\n').length * 28, Number.parseFloat(this.style.height) || 0)
  })
}

describe('useHauteurAuto', () => {
  afterEach(() => vi.restoreAllMocks())

  it('donne au champ la hauteur de son contenu, et la reprend à chaque frappe', () => {
    simulerLaMesure()
    render(<Champ />)
    const champ = screen.getByLabelText('Remarque')
    expect(champ).toHaveStyle({ height: '28px' })

    fireEvent.change(champ, { target: { value: 'un\ndeux\ntrois' } })
    expect(champ).toHaveStyle({ height: '84px' })
  })

  it('rétrécit quand on efface : la hauteur n’est jamais celle d’avant', () => {
    simulerLaMesure()
    render(<Champ />)
    const champ = screen.getByLabelText('Remarque')
    fireEvent.change(champ, { target: { value: 'un\ndeux\ntrois' } })

    fireEvent.change(champ, { target: { value: 'un' } })
    expect(champ).toHaveStyle({ height: '28px' })
  })
})
