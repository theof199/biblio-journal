import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { useDialogue } from './dialogue'

/** Un calque réduit à son dialogue : son bouton « Fermer » prend le focus, Échap le ferme. */
function Calque({ nom, onFermer }: { nom: string; onFermer: () => void }) {
  const fermer = useDialogue<HTMLButtonElement>(onFermer)
  return (
    <div role="dialog" aria-label={nom}>
      <button ref={fermer} type="button" onClick={onFermer}>
        Fermer
      </button>
    </div>
  )
}

const echap = () => fireEvent.keyDown(document.body, { key: 'Escape' })

describe('le dialogue d’un calque', () => {
  // Mutation : le démontage qui ne retire ni l'écoute d'Échap ni la place du calque dans la pile :
  // un calque refermé fermerait encore (un `naviguer(-1)` de plus) à l'Échap suivant, sur la page
  // ou sur un autre calque. (L'écoute seule gardée ne ferme plus rien : la pile ne la nomme plus.)
  it('n’écoute plus Échap une fois refermé', () => {
    const onFermer = vi.fn()
    const { unmount } = render(<Calque nom="feuille" onFermer={onFermer} />)
    unmount()
    echap()
    expect(onFermer).not.toHaveBeenCalled()
  })

  // Mutations : chaque dialogue ferme à Échap sans regarder s'il est le dernier ouvert (un seul
  // Échap fermerait les deux calques, et reculerait deux fois dans l'historique) ; la place d'un
  // calque refermé gardée dans la pile (celui d'en dessous ne se fermerait plus).
  it('ne ferme à Échap que le dernier calque ouvert, puis celui d’en dessous', () => {
    const dessous = vi.fn()
    const dessus = vi.fn()
    const vue = (deux: boolean) => (
      <>
        <Calque nom="feuille" onFermer={dessous} />
        {deux ? <Calque nom="marche" onFermer={dessus} /> : null}
      </>
    )
    const { rerender } = render(vue(true))
    echap()
    expect(dessus).toHaveBeenCalledOnce()
    expect(dessous).not.toHaveBeenCalled()
    rerender(vue(false))
    echap()
    expect(dessous).toHaveBeenCalledOnce()
    expect(dessus).toHaveBeenCalledOnce()
  })
})
