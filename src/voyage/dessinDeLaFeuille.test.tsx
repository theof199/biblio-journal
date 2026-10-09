import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { creerRegistre } from '../mondes'
import { PAGES_A_VENIR } from '../mondes/avenir/pages'
import { PAGES_1890 } from '../mondes/1890/pages'
import Feuille, { type PropsFeuilleDuChroniqueur } from './Feuille'

/**
 * La clé `feuilleDuChroniqueur` (les derniers écrans de 1900, brief 5) : `Feuille` lit son dessin au
 * monde, et garde le dialogue, les cadences et le calme. Le dessin par défaut (`Prospectus`) est tenu,
 * sans retouche, par `Feuille.test.tsx` ; celui de 1900 par `mondes/1900/pages/feuilleDuGuide.test.tsx`.
 */
const monde = creerRegistre()(1890)
const calme = (oui: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: oui, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
/** 28 mots de plomb après la lettrine ; la suite à 28 × 75 + 350 ms, le second paragraphe 420 ms plus tard. */
const LONG =
  'Un premier paragraphe assez long pour être composé mot à mot par le chroniqueur, qui prend son temps et sa plume ; puis la suite arrive en fondu, bien après les mots.\n\nUn second paragraphe.'
const PREMIERE_SUITE = 28 * 75 + 350

type Etat = Parameters<typeof Feuille>[0]['etat']

/** Un dessin de monde, nu : ni rôle ni nom, ni horloge. Il écrit ce qu'on lui passe, et rien d'autre. */
const recus: PropsFeuilleDuChroniqueur[] = []
const DessinDuMonde = (p: PropsFeuilleDuChroniqueur) => {
  recus.push(p)
  const c = p.corps
  return (
    <div data-testid="dessin" data-quoi={p.quoi} data-calme={String(p.calme)} data-parle={p.parle}>
      <span id={p.idDeLEsp}>{`Rubrique : ${p.esp}`}</span>
      <h3 id={p.idDuTitre}>{`${p.monde.pages.mots.feuille.titre} : ${p.titre}`}</h3>
      <small>{p.sous}</small>
      <button ref={p.fermer} type="button" onClick={p.onFermer}>
        Ranger
      </button>
      {c.type === 'erreur' ? (
        <button type="button" onClick={p.onReessayer}>
          {`Encore : ${c.message}`}
        </button>
      ) : c.type === 'attente' ? (
        <output>{`${c.tapee}|${c.phrase}`}</output>
      ) : c.type === 'texte' ? (
        <output>
          {[c.pose ? 'posé' : 'en plomb', c.lettrine, c.debut, c.mots.filter(Boolean).length, c.suite.vue ? c.suite.texte : '(suite)', ...c.paragraphes.map((x) => (x.vu ? x.texte : '(paragraphe)'))].join(' / ')}
        </output>
      ) : null}
    </div>
  )
}

const feuille = (etat: Etat, onFermer = vi.fn(), onReessayer = vi.fn()) => (
  <Feuille monde={monde} quoi="salle" esp="Salle" titre="Les essentiels" sous="1897" etat={etat} onFermer={onFermer} onReessayer={onReessayer} />
)
const dernier = () => recus[recus.length - 1]!

describe('le dessin de la feuille du chroniqueur, section qu’un monde peut composer', () => {
  let remettre = () => undefined as void
  beforeEach(() => {
    recus.length = 0
    const avant = PAGES_1890.gabarits
    PAGES_1890.gabarits = { feuilleDuChroniqueur: DessinDuMonde }
    remettre = () => void (PAGES_1890.gabarits = avant)
  })
  afterEach(() => {
    remettre()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Mutations : `Feuille` qui monte `Prospectus` sans passer par `gabaritDe` (l'estrade resterait) ; le
  // rôle, `aria-modal` ou `aria-labelledby` laissés au dessin (celui-ci n'en pose aucun) ; l'un des deux
  // identifiants, `quoi`, `titre` ou `sous` que `Feuille` ne passerait plus.
  it('monte le dessin du monde à la place du prospectus, et reste le dialogue, nommé par la rubrique et le titre du dessin', () => {
    calme(true)
    render(feuille({ type: 'attente' }))
    const dialogue = screen.getByRole('dialog', { name: `Rubrique : Salle ${PAGES_1890.mots.feuille.titre} : Les essentiels` })
    expect(dialogue).toHaveAttribute('aria-modal', 'true')
    expect(dialogue).toContainElement(screen.getByTestId('dessin'))
    expect(screen.getByTestId('dessin')).not.toHaveAttribute('role')
    expect(screen.getByTestId('dessin')).toHaveAttribute('data-quoi', 'salle')
    expect(screen.getByText('1897')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Le chroniqueur sur son estrade.' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Fermer' })).toBeNull()
    expect(dialogue.style.getPropertyValue('--m-papier')).toBe(monde.pages.jetons['--m-papier'])
  })

  // Mutations : la référence du focus, `onFermer` ou `onReessayer` que `Feuille` ne passerait plus ;
  // Échap confié au dessin (celui-ci n'écoute rien) ; le message de l'erreur réécrit en route.
  it('garde le focus, Échap et la fermeture, et passe l’erreur telle quelle avec son geste', () => {
    calme(true)
    const onFermer = vi.fn()
    const onReessayer = vi.fn()
    const vue = (ouvert: boolean) => (
      <>
        <button type="button">Le contexte de la salle</button>
        {ouvert ? feuille({ type: 'erreur', message: 'Le chroniqueur est souffrant.' }, onFermer, onReessayer) : null}
      </>
    )
    const { rerender } = render(vue(false))
    screen.getByRole('button', { name: 'Le contexte de la salle' }).focus()
    rerender(vue(true))
    expect(screen.getByRole('button', { name: 'Ranger' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Ranger' }))
    expect(onFermer).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onFermer).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'Encore : Le chroniqueur est souffrant.' }))
    expect(onReessayer).toHaveBeenCalledOnce()
    rerender(vue(false))
    expect(screen.getByRole('button', { name: 'Le contexte de la salle' })).toHaveFocus()
  })

  // Les cadences restent à `Feuille` : le dessin, qui n'a pas d'horloge, apprend ce qui est vu au moment
  // où les minuteries de `Feuille` le disent. Mutations : `vue` ou `vu` passés toujours vrais ; `pose`
  // passé vrai hors du calme ; le délai d'un mot figé à zéro ; `parle` figé.
  it('hors du calme, ne dit vus la suite puis chaque paragraphe qu’à leur tour, et donne à chaque mot son moment', () => {
    calme(false)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    render(feuille({ type: 'texte', texte: LONG }))
    const corps = () => {
      const c = dernier().corps
      if (c.type !== 'texte') throw new Error('pas un texte')
      return c
    }
    expect(corps().pose).toBe(false)
    expect(corps().lettrine).toBe('U')
    expect(corps().mots.filter(Boolean).map((m) => m!.delai)).toEqual(Array.from({ length: 28 }, (_, k) => k * 75))
    expect([corps().suite.vue, ...corps().paragraphes.map((p) => p.vu)]).toEqual([false, false])
    expect(dernier().parle).toBe('parle')
    act(() => void vi.advanceTimersByTime(PREMIERE_SUITE - 1))
    expect(corps().suite.vue).toBe(false)
    act(() => void vi.advanceTimersByTime(1))
    expect([corps().suite.vue, ...corps().paragraphes.map((p) => p.vu)]).toEqual([true, false])
    act(() => void vi.advanceTimersByTime(420))
    expect([corps().suite.vue, ...corps().paragraphes.map((p) => p.vu)]).toEqual([true, true])
    act(() => void vi.advanceTimersByTime(420))
    expect(dernier().parle).toBe('non')
    expect(dernier().calme).toBe(false)
  })

  // Mutations : `pose` qui ne suivrait pas le calme ; au calme, un paragraphe laissé non vu ; la phrase
  // de l'attente passée à moitié ; hors du calme, la phrase entière passée d'emblée.
  it('au calme, dit tout posé et tout vu d’emblée, l’attente entière ; hors du calme, l’attente lettre à lettre', () => {
    calme(true)
    const vue = render(feuille({ type: 'texte', texte: LONG }))
    expect(screen.getByRole('status')).toHaveTextContent('posé / U / n premier paragraphe')
    expect(screen.getByRole('status')).toHaveTextContent('bien après les mots. / Un second paragraphe.')
    expect(dernier().calme).toBe(true)
    vue.rerender(feuille({ type: 'attente' }))
    const phrase = PAGES_1890.mots.chroniqueur.ecrit
    expect(screen.getByRole('status')).toHaveTextContent(`${phrase}|${phrase}`)
    vue.unmount()

    calme(false)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    render(feuille({ type: 'attente' }))
    expect(screen.getByRole('status')).toHaveTextContent(`${phrase.slice(0, 1)}|${phrase}`)
    expect(dernier().parle).toBe('tape')
    act(() => void vi.advanceTimersByTime(65 * 3))
    expect(screen.getByRole('status')).toHaveTextContent(`${phrase.slice(0, 4)}|${phrase}`)
  })
})

describe('le prospectus par défaut, sans dessin de monde', () => {
  afterEach(() => vi.unstubAllGlobals())

  // Les trois mots sortis du composant gardent, en 1890 et dans le monde « à venir », ce qu'ils étaient
  // en dur. Mutations : un mot de 1890 changé (`relache: 'FERMÉ'`) ; la bande remise en dur dans
  // `Prospectus` (le mot du monde ne serait plus lu) ; l'estrade ou son libellé retirés du défaut.
  it.each([
    ['1890', creerRegistre()(1890)],
    ['à venir', creerRegistre()(1910)],
  ])('en %s, garde l’estrade, « RELÂCHE », « Le chroniqueur écrit… » et « Feuille n° »', (_nom, m) => {
    calme(true)
    expect([m.pages.mots.chroniqueur.ecrit, m.pages.mots.chroniqueur.relache, m.pages.mots.chroniqueur.numero(3)]).toEqual(['Le chroniqueur écrit…', 'RELÂCHE', 'Feuille n° 3'])
    const vue = render(<Feuille monde={m} quoi="film" esp="Le film" titre="Nosferatu" sous="" etat={{ type: 'erreur', message: 'Le chroniqueur est souffrant.' }} onFermer={vi.fn()} onReessayer={vi.fn()} />)
    expect(screen.getByRole('img', { name: 'Le chroniqueur sur son estrade.' })).toBeInTheDocument()
    expect(screen.getByText('RELÂCHE')).toBeInTheDocument()
    expect(screen.getByText('Feuille n° 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
    vue.unmount()
    // Le mot vient bien du monde : prêté, c'est lui que la bande porte.
    const prete = { ...m, pages: { ...m.pages, mots: { ...m.pages.mots, chroniqueur: { ...m.pages.mots.chroniqueur, relache: 'CLÔTURE' } } } }
    render(<Feuille monde={prete} quoi="film" esp="Le film" titre="Nosferatu" sous="" etat={{ type: 'erreur', message: 'Le chroniqueur est souffrant.' }} onFermer={vi.fn()} onReessayer={vi.fn()} />)
    expect(screen.getByText('CLÔTURE')).toBeInTheDocument()
    expect(screen.queryByText('RELÂCHE')).toBeNull()
  })

  it('le monde « à venir » est bien celui de 1910', () => {
    expect(creerRegistre()(1910).pages).toBe(PAGES_A_VENIR)
  })
})
