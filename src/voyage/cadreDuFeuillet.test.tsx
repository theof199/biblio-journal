import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { creerRegistre } from '../mondes'
import { PAGES_1890 } from '../mondes/1890/pages'
import Feuillet, { type PropsCadreDuFeuillet } from './Feuillet'

/**
 * La clé `feuillet` (les derniers écrans de 1900, brief 2) : `Feuillet` lit son cadre au monde, et
 * garde le dialogue. Le cadre par défaut est tenu, sans retouche, par `Feuillet.test.tsx` ; celui de
 * 1900 par `mondes/1900/pages/feuillet.test.tsx`.
 */
const monde = creerRegistre()(1890)

/** Un cadre de monde, nu : ni rôle ni nom, seulement ce que `Feuillet` lui demande de poser. */
const CadreDuMonde = (p: PropsCadreDuFeuillet) => (
  <div data-testid="cadre">
    <h3 id={p.idDuTitre}>{`${p.monde.pages.mots.parade.titre} : ${p.titre}`}</h3>
    <button ref={p.fermer} type="button" onClick={p.onFermer}>
      Ranger
    </button>
    {p.children}
  </div>
)

describe('le cadre d’un feuillet, section qu’un monde peut composer', () => {
  let remettre = () => undefined as void
  beforeEach(() => {
    const avant = PAGES_1890.gabarits
    PAGES_1890.gabarits = { feuillet: CadreDuMonde }
    remettre = () => void (PAGES_1890.gabarits = avant)
  })
  afterEach(() => remettre())

  // Mutations : `Feuillet` qui monte `Cadre` sans passer par `gabaritDe` ; le rôle, `aria-modal` ou
  // `aria-labelledby` laissés au cadre (ce cadre-ci n'en pose aucun : le dialogue n'existerait plus) ;
  // le titre, l'identifiant du titre ou les enfants que `Feuillet` ne passerait plus.
  it('monte le cadre du monde autour des choix, et reste le dialogue, nommé par le titre du cadre', () => {
    const choisir = vi.fn()
    render(
      <Feuillet monde={monde} titre="Deuxième marche" onFermer={vi.fn()}>
        <button type="button" onClick={choisir}>
          Nosferatu
        </button>
      </Feuillet>,
    )
    const dialogue = screen.getByRole('dialog', { name: `${PAGES_1890.mots.parade.titre} : Deuxième marche` })
    expect(dialogue).toHaveAttribute('aria-modal', 'true')
    expect(dialogue).toContainElement(screen.getByTestId('cadre'))
    expect(screen.getByTestId('cadre')).not.toHaveAttribute('role')
    expect(screen.queryByRole('button', { name: 'Fermer' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Nosferatu' }))
    expect(choisir).toHaveBeenCalledOnce()
  })

  // Mutations : la référence du focus ou `onFermer` que `Feuillet` ne passerait plus au cadre ; Échap
  // ou le voile confiés au cadre (celui-ci n'écoute rien et n'a pas de voile).
  it('garde le focus, Échap, le voile et la fermeture, quel que soit le cadre', () => {
    const onFermer = vi.fn()
    const vue = (ouvert: boolean) => (
      <>
        <button type="button">La deuxième marche</button>
        {ouvert ? (
          <Feuillet monde={monde} titre="Deuxième marche" onFermer={onFermer}>
            <p>Rien</p>
          </Feuillet>
        ) : null}
      </>
    )
    const { rerender, container } = render(vue(false))
    screen.getByRole('button', { name: 'La deuxième marche' }).focus()
    rerender(vue(true))
    expect(screen.getByRole('button', { name: 'Ranger' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Ranger' }))
    expect(onFermer).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onFermer).toHaveBeenCalledTimes(2)
    fireEvent.click(container.querySelector('[aria-hidden="true"]')!)
    expect(onFermer).toHaveBeenCalledTimes(3)
    expect(container.querySelector<HTMLElement>('[aria-hidden="true"]')!.parentElement!.style.getPropertyValue('--m-papier')).toBe(monde.pages.jetons['--m-papier'])
    rerender(vue(false))
    expect(screen.getByRole('button', { name: 'La deuxième marche' })).toHaveFocus()
  })
})
