import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import RangeeDeNote, { noteSousLeDoigt } from './RangeeDeNote'

describe('noteSousLeDoigt', () => {
  // Une rangée de 100 px, de x = 20 à x = 120 : dix tranches de 10 px.
  it.each([
    [20, 1],
    [29, 1],
    [30, 2],
    [74, 6],
    [119, 10],
  ])('à x = %i, le doigt est sur le trou %i', (x, note) => {
    expect(noteSousLeDoigt(x, 20, 100)).toBe(note)
  })

  it('tient le premier trou à gauche de la rangée et le dernier à droite', () => {
    expect(noteSousLeDoigt(-300, 20, 100)).toBe(1)
    expect(noteSousLeDoigt(900, 20, 100)).toBe(10)
  })

  it('tient le premier trou d’une rangée sans largeur plutôt que de rendre NaN', () => {
    expect(noteSousLeDoigt(50, 20, 0)).toBe(1)
  })
})

/** La rangée avec la note dont elle est l'état, et les notes qu'elle a annoncées. */
function monter(noteDepart: number | null = null) {
  const annoncees: (number | null)[] = []
  function Rangee() {
    const [note, setNote] = useState(noteDepart)
    return (
      <RangeeDeNote
        note={note}
        onChoisir={(choisie) => {
          annoncees.push(choisie)
          setNote(choisie)
        }}
      />
    )
  }
  render(<Rangee />)
  const groupe = screen.getByRole('radiogroup', { name: 'Note sur 10' })
  // jsdom ne dispose rien : la rangée occupe de x = 0 à x = 100.
  groupe.getBoundingClientRect = () => ({ left: 0, width: 100, right: 100, top: 0, bottom: 52, height: 52, x: 0, y: 0, toJSON: () => ({}) })
  return { annoncees, groupe }
}

describe('RangeeDeNote', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('est un radiogroupe de dix radios, aux libellés « Note n sur 10 »', () => {
    monter()

    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('aria-label'))).toEqual(
      Array.from({ length: 10 }, (_, rang) => `Note ${rang + 1} sur 10`),
    )
  })

  it('un toucher choisit la note, un second sur la même l’efface', () => {
    const { annoncees } = monter()

    fireEvent.click(screen.getByRole('radio', { name: 'Note 8 sur 10' }))
    expect(screen.getByRole('radio', { name: 'Note 8 sur 10' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'Note 8 sur 10' }))

    // Mutation : le bascule retiré (`note === n ? null : n` devenu `n`).
    expect(annoncees).toEqual([8, null])
  })

  it('un doigt qui glisse le long de la rangée pose la note du trou qu’il survole', () => {
    const { annoncees, groupe } = monter()

    fireEvent.pointerDown(groupe, { clientX: 5 })
    fireEvent.pointerMove(groupe, { clientX: 25 })
    fireEvent.pointerMove(groupe, { clientX: 85 })

    // Mutation : le glissé retiré, ou la tranche calculée sur une autre largeur.
    expect(annoncees).toEqual([3, 9])
    expect(screen.getByRole('radio', { name: 'Note 9 sur 10' })).toHaveAttribute('aria-checked', 'true')
  })

  it('ne répète pas une note que le doigt tient déjà', () => {
    const { annoncees, groupe } = monter()

    fireEvent.pointerDown(groupe, { clientX: 5 })
    fireEvent.pointerMove(groupe, { clientX: 85 })
    fireEvent.pointerMove(groupe, { clientX: 87 })
    fireEvent.pointerMove(groupe, { clientX: 89 })

    expect(annoncees).toEqual([9])
  })

  it('ne change rien quand la souris survole la rangée sans appuyer', () => {
    const { annoncees, groupe } = monter()

    fireEvent.pointerMove(groupe, { clientX: 85 })

    // Mutation : le glissé qui ne vérifie plus qu'un geste est en cours.
    expect(annoncees).toEqual([])
  })

  it('le toucher qui suit un glissé ne décoche pas la note que le doigt vient de poser', () => {
    const { annoncees, groupe } = monter()

    fireEvent.pointerDown(groupe, { clientX: 5 })
    fireEvent.pointerMove(groupe, { clientX: 85 })
    fireEvent.pointerUp(groupe)
    fireEvent.click(screen.getByRole('radio', { name: 'Note 9 sur 10' }))

    // Mutation : le `click` du relâchement pris pour un toucher (il enverrait `null` ici).
    expect(annoncees).toEqual([9])
    expect(screen.getByRole('radio', { name: 'Note 9 sur 10' })).toHaveAttribute('aria-checked', 'true')
  })

  it('le geste suivant est un toucher comme un autre : le glissé d’avant ne le retient pas', () => {
    const { annoncees, groupe } = monter()
    fireEvent.pointerDown(groupe, { clientX: 5 })
    fireEvent.pointerMove(groupe, { clientX: 85 })
    fireEvent.pointerUp(groupe)
    act(() => {
      vi.runAllTimers()
    })

    fireEvent.click(screen.getByRole('radio', { name: 'Note 9 sur 10' }))

    // Mutation : le geste qui ne se ferme jamais (le délai du relâchement retiré).
    expect(annoncees).toEqual([9, null])
  })

  it('un geste interrompu (le navigateur prend le défilement) se ferme sans rien poser', () => {
    const { annoncees, groupe } = monter()
    fireEvent.pointerDown(groupe, { clientX: 5 })
    fireEvent.pointerCancel(groupe)

    fireEvent.pointerMove(groupe, { clientX: 85 })

    expect(annoncees).toEqual([])
  })
})
