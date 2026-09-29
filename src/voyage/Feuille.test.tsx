import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import Feuille from './Feuille'
import { FabriqueContexteToile } from './Toile'
import { creerRegistre } from '../mondes'
import type { Monde, VueEstrade } from '../mondes/types'
import { contexteFactice } from '../test/contexteFactice'
import feuille from './Feuille.module.css?raw'

const monde = creerRegistre()(1890)
const calme = (oui: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: oui, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
const TEXTE = 'Un premier paragraphe assez long pour être composé mot à mot par le chroniqueur, puis la suite qui arrive en fondu.\n\nUn second paragraphe.'
/**
 * Un premier paragraphe plus long que la part composée (140 caractères, prolongés jusqu'au blanc) :
 * 28 mots de plomb après la lettrine, jusqu'à « fondu, » ; sa suite, « bien après les mots. »,
 * arrive à 28 × 75 + 350 ms, le second paragraphe 420 ms plus tard.
 */
const LONG =
  'Un premier paragraphe assez long pour être composé mot à mot par le chroniqueur, qui prend son temps et sa plume ; puis la suite arrive en fondu, bien après les mots.\n\nUn second paragraphe.'
const PREMIERE_SUITE = 28 * 75 + 350
const SUITE = 'bien après les mots.'

type Etat = Parameters<typeof Feuille>[0]['etat']

function monter(etat: Etat, onFermer = vi.fn(), onReessayer = vi.fn()) {
  const vue = render(
    <Feuille monde={monde} quoi="ouverture" esp="Ouverture" titre="1897" sous="Les origines" etat={etat} onFermer={onFermer} onReessayer={onReessayer} />,
  )
  return { ...vue, onFermer, onReessayer }
}

/** Un monde 1890 dont l'estrade est épiée, sur une toile qui peint (contexte factice). */
function monterEpiee(etat: Etat) {
  const estrade = vi.fn<(v: VueEstrade) => void>()
  const epie: Monde = { ...monde, pages: { ...monde.pages, dessinerEstrade: estrade } }
  const { ctx } = contexteFactice()
  const feuille = (e: Etat) => (
    <FabriqueContexteToile.Provider value={() => ctx}>
      <Feuille monde={epie} quoi="film" esp="Le film" titre="L’Arrivée d’un train" sous="" etat={e} onFermer={vi.fn()} onReessayer={vi.fn()} />
    </FabriqueContexteToile.Provider>
  )
  const vue = render(feuille(etat))
  const parle = () => estrade.mock.calls[estrade.mock.calls.length - 1]?.[0].parle
  return { ...vue, parle, remonter: (e: Etat) => vue.rerender(feuille(e)) }
}

/** Le fondu d'un paragraphe : la page le cache par un `opacity: 0` en ligne tant qu'il n'est pas venu. */
const cache = (el: HTMLElement) => el.style.opacity === '0'

describe('la feuille du chroniqueur', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Mutation : la garde du calme retirée : les paragraphes attendraient leurs minuteries.
  it('au calme, pose tout le texte d’un coup', () => {
    calme(true)
    monter({ type: 'texte', texte: TEXTE })
    expect(screen.getByText('Un second paragraphe.')).toBeVisible()
  })

  // Le jumeau, sur la suite du premier paragraphe. Mutation : sa garde du calme retirée (elle
  // attendrait sa minuterie quand le second paragraphe, lui, est posé).
  it('au calme, pose aussi la suite du premier paragraphe', () => {
    calme(true)
    monter({ type: 'texte', texte: LONG })
    expect(screen.getByText(SUITE)).toBeVisible()
  })

  // « Au calme, tout est posé d'un coup, sans minuterie » (plan 2b, tâche 6), l'attente comprise.
  // Mutation : la garde `if (calme) return` de l'effet retirée (la page, posée d'un coup, ne le
  // montrerait pas ; les minuteries tourneraient pour rien).
  it('au calme, ne pose aucune minuterie, ni pour un texte ni pour l’attente', () => {
    calme(true)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { rerender, onFermer, onReessayer } = monter({ type: 'texte', texte: LONG })
    expect(vi.getTimerCount()).toBe(0)
    rerender(<Feuille monde={monde} quoi="ouverture" esp="Ouverture" titre="1897" sous="" etat={{ type: 'attente' }} onFermer={onFermer} onReessayer={onReessayer} />)
    expect(vi.getTimerCount()).toBe(0)
  })

  // Mutations : aucun fondu (tout posé d'emblée hors du calme) ; la suite qui n'attend pas ses mots
  // (`k × 75` oublié) ; le second paragraphe qui arrive avec le premier (`i × 420` oublié).
  it('hors du calme, fait venir la suite après les mots, puis chaque paragraphe à son tour', () => {
    calme(false)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    monter({ type: 'texte', texte: LONG })
    const suite = () => screen.getByText(SUITE)
    const second = () => screen.getByText('Un second paragraphe.')
    expect(cache(suite())).toBe(true)
    expect(cache(second())).toBe(true)
    act(() => void vi.advanceTimersByTime(PREMIERE_SUITE - 1))
    expect(cache(suite())).toBe(true)
    act(() => void vi.advanceTimersByTime(1))
    expect(cache(suite())).toBe(false)
    expect(cache(second())).toBe(true)
    act(() => void vi.advanceTimersByTime(420))
    expect(cache(second())).toBe(false)
  })

  // Mutations : la lettrine prise en double (`slice(0, n)`), un mot perdu à la coupe (`slice(n + 1)`
  // pour la suite) : le paragraphe composé ne serait plus le texte du chroniqueur.
  it.each([true, false])('compose le premier paragraphe sans perdre ni doubler une lettre (calme : %s)', (oui) => {
    calme(oui)
    monter({ type: 'texte', texte: LONG })
    const premier = screen.getByText(SUITE).closest('p')!
    expect(premier.textContent).toBe(LONG.split('\n\n')[0])
  })

  // Mutation : le retard compté sur les blancs aussi (le troisième mot tomberait à 300 ms).
  it('fait tomber les mots de plomb l’un après l’autre, à 75 ms d’écart', () => {
    calme(false)
    monter({ type: 'texte', texte: LONG })
    expect(screen.getByText('n').style.animationDelay).toBe('0ms')
    expect(screen.getByText('premier').style.animationDelay).toBe('75ms')
    expect(screen.getByText('paragraphe').style.animationDelay).toBe('150ms')
  })

  // Mutations : un tirage qui ne part pas du texte (`Math.random`) : la feuille changerait d'encre à
  // chaque ouverture ; l'encre ou le décalage hors de la plage de la maquette.
  it('tire l’encre et le décalage de chaque mot du texte, les mêmes à chaque ouverture', () => {
    calme(false)
    const lire = () => {
      const { container, unmount } = monter({ type: 'texte', texte: LONG })
      const plombs = [...container.querySelectorAll<HTMLElement>('p:first-child > span[style*="animation-delay"]')].map((s) => [
        s.style.opacity,
        s.style.transform,
      ])
      unmount()
      return plombs
    }
    const premiere = lire()
    expect(premiere).toHaveLength(28)
    expect(lire()).toEqual(premiere)
    for (const [o, t] of premiere) {
      expect(Number(o)).toBeGreaterThanOrEqual(0.74)
      expect(Number(o)).toBeLessThanOrEqual(1)
      expect(Math.abs(Number(/translateY\((-?[\d.]+)px\)/.exec(t!)![1]))).toBeLessThanOrEqual(0.6)
    }
    expect(new Set(premiere.map(([o]) => o)).size).toBeGreaterThan(1)
  })

  // Mutation : l'effet de la composition suivi sur l'objet `etat` : chaque relecture de la page, qui
  // rend un objet neuf pour le même texte, recomposerait la feuille et recacherait ce qui est venu.
  it('ne recompose pas un texte déjà là quand la page se relit', () => {
    calme(false)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const onFermer = vi.fn()
    const onReessayer = vi.fn()
    const { rerender } = monter({ type: 'texte', texte: LONG }, onFermer, onReessayer)
    act(() => void vi.advanceTimersByTime(PREMIERE_SUITE + 420))
    rerender(<Feuille monde={monde} quoi="ouverture" esp="Ouverture" titre="1897" sous="Les origines" etat={{ type: 'texte', texte: LONG }} onFermer={onFermer} onReessayer={onReessayer} />)
    expect(cache(screen.getByText('Un second paragraphe.'))).toBe(false)
  })

  // Mutation : la phrase d'attente sans son nom : un lecteur d'écran lirait des lettres une à une.
  it('dit que le chroniqueur écrit, d’un seul nom', () => {
    calme(false)
    monter({ type: 'attente' })
    expect(screen.getByRole('status', { name: 'Le chroniqueur écrit…' })).toBeInTheDocument()
  })

  // Le jumeau : la phrase tapée elle-même. Mutation : son `aria-hidden` retiré : la région vivante
  // annoncerait chaque lettre tapée, puis effacée.
  it('tait aux lecteurs d’écran les lettres tapées', () => {
    calme(false)
    monter({ type: 'attente' })
    const enfants = [...screen.getByRole('status').children]
    expect(enfants.length).toBeGreaterThan(0)
    for (const enfant of enfants) expect(enfant).toHaveAttribute('aria-hidden', 'true')
  })

  // Mutations : au calme, la phrase tapée comme ailleurs (elle resterait vide ou coupée) ; hors du
  // calme, la phrase posée d'un coup (rien ne se tape).
  it('tape la phrase d’attente, sauf au calme où elle est entière et immobile', () => {
    calme(true)
    const { unmount } = monter({ type: 'attente' })
    expect(screen.getByRole('status')).toHaveTextContent(/^Le chroniqueur écrit…$/)
    unmount()
    calme(false)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    monter({ type: 'attente' })
    // Une lettre d'emblée, puis une toutes les 65 ms.
    act(() => void vi.advanceTimersByTime(65 * 3))
    expect(screen.getByRole('status')).toHaveTextContent(/^Le c$/)
  })

  // Mutations : la phrase qui reste tapée (aucun effacement) ; qui ne recommence pas une fois effacée.
  it('efface la phrase d’attente après une pause, puis la recommence', () => {
    calme(false)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    monter({ type: 'attente' })
    const tape = () => screen.getByRole('status').textContent
    // 21 lettres : la première d'emblée, la dernière à 20 × 65 ms ; 1,1 s de pause ; 26 ms la lettre effacée.
    act(() => void vi.advanceTimersByTime(20 * 65))
    expect(tape()).toBe('Le chroniqueur écrit…')
    act(() => void vi.advanceTimersByTime(1100 + 2 * 26))
    expect(tape()).toBe('Le chroniqueur écr')
    act(() => void vi.advanceTimersByTime(18 * 26 + 26))
    expect(tape()).toBe('L')
  })

  // Mutation : le corps sans `aria-live` : le texte, puis l'erreur, arriveraient en silence.
  it('annonce le texte venu, comme l’erreur, sans voler la parole', () => {
    calme(true)
    const { rerender, onFermer, onReessayer } = monter({ type: 'texte', texte: TEXTE })
    expect(screen.getByText('Un second paragraphe.').closest('[aria-live="polite"]')).not.toBeNull()
    rerender(<Feuille monde={monde} quoi="ouverture" esp="Ouverture" titre="1897" sous="" etat={{ type: 'erreur', message: 'Non.' }} onFermer={onFermer} onReessayer={onReessayer} />)
    expect(screen.getByText('Non.').closest('[aria-live="polite"]')).not.toBeNull()
  })

  // Mutation : un message réécrit à la place de celui de l'API.
  it('montre l’erreur telle que l’API l’a écrite, et réessaie', () => {
    const { onReessayer } = monter({ type: 'erreur', message: 'Le chroniqueur ne répond pas. Réessaie plus tard.' })
    expect(screen.getByText('Le chroniqueur ne répond pas. Réessaie plus tard.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(onReessayer).toHaveBeenCalledOnce()
  })

  // Mutation : Échap non écouté ; le focus laissé à la page.
  it('prend le focus et se ferme à Échap', () => {
    const { onFermer } = monter({ type: 'texte', texte: TEXTE })
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onFermer).toHaveBeenCalledOnce()
  })

  // Le jumeau d'Échap, le geste du téléphone. Mutation : le bouton « Fermer » sans son `onClick`.
  it('se ferme d’un toucher sur « Fermer »', () => {
    const { onFermer } = monter({ type: 'texte', texte: TEXTE })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onFermer).toHaveBeenCalledOnce()
  })

  // Mutation : une autre touche qui ferme (la garde `Escape` retirée).
  it('ne se ferme pas à une autre touche', () => {
    const { onFermer } = monter({ type: 'texte', texte: TEXTE })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })
    expect(onFermer).not.toHaveBeenCalled()
  })

  // Mutation : le focus non rendu à la fermeture : le membre repartirait du haut de la page.
  it('rend le focus, à la fermeture, à l’élément qui l’avait', () => {
    const { rerender } = render(<button type="button">Lire l’ouverture</button>)
    const lire = screen.getByRole('button', { name: 'Lire l’ouverture' })
    lire.focus()
    const feuille = (ouverte: boolean) => (
      <>
        <button type="button">Lire l’ouverture</button>
        {ouverte ? (
          <Feuille monde={monde} quoi="ouverture" esp="Ouverture" titre="1897" sous="" etat={{ type: 'attente' }} onFermer={vi.fn()} onReessayer={vi.fn()} />
        ) : null}
      </>
    )
    rerender(feuille(true))
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus()
    rerender(feuille(false))
    expect(screen.getByRole('button', { name: 'Lire l’ouverture' })).toHaveFocus()
  })

  // Mutations : le dialogue nommé par autre chose que sa rubrique et son titre ; le numéro de la
  // feuille figé ; les mots d'un monde écrits en dur.
  it('se nomme par sa rubrique et son titre, porte les mots du monde et le numéro de sa feuille', () => {
    render(<Feuille monde={monde} quoi="generique" esp="Générique" titre="Le générique de fin" sous="1895" etat={{ type: 'attente' }} onFermer={vi.fn()} onReessayer={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Générique Le générique de fin' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Feuille n° 4')).toBeInTheDocument()
    const avenir = creerRegistre()(1900)
    for (const mot of Object.values(monde.pages.mots.feuille)) expect(screen.getAllByText(mot).length).toBeGreaterThan(0)
    const { container } = render(
      <Feuille monde={avenir} quoi="salle" esp="Salle" titre="Le monde en vues" sous="1906" etat={{ type: 'attente' }} onFermer={vi.fn()} onReessayer={vi.fn()} />,
    )
    expect(container).toHaveTextContent('Feuille n° 2')
    // Chaque mot de la feuille vient du monde : aucun de ceux de 1890 ne reste sur une feuille de 1906.
    for (const cle of ['tete', 'titre', 'sous', 'pied', 'imprimeur'] as const) {
      const mot = avenir.pages.mots.feuille[cle]
      expect(container).toHaveTextContent(mot)
      const de1890 = monde.pages.mots.feuille[cle]
      if (de1890 !== mot) expect(container).not.toHaveTextContent(de1890)
    }
  })

  // Le jumeau du feuillet. Mutations : « Fermer » ou « Réessayer » sous la cible tactile.
  it('fait 44 px au moins à « Fermer » et à « Réessayer »', () => {
    const regle = (selecteur: string) => {
      const reste = feuille.slice(feuille.indexOf(`${selecteur} {`))
      return reste.slice(reste.indexOf('{') + 1, reste.indexOf('}'))
    }
    expect(regle('.fermer')).toMatch(/\bwidth:\s*44px/)
    expect(regle('.fermer')).toMatch(/\bheight:\s*44px/)
    expect(regle('.bouton')).toMatch(/min-height:\s*44px/)
  })

  // Mutation : les jetons du monde oubliés sur la racine : la feuille retomberait sur les valeurs héritées.
  it('pose les jetons de son monde sur sa racine', () => {
    monter({ type: 'attente' })
    expect(screen.getByRole('dialog').style.getPropertyValue('--m-papier')).toBe(monde.pages.jetons['--m-papier'])
  })

  // Mutations : l'estrade qui ne tape pas pendant l'attente ; qui ne parle pas pendant la
  // composition ; qui parle encore une fois le texte posé.
  it('fait taper le chroniqueur pendant l’attente, parler pendant la composition, se taire ensuite', () => {
    calme(false)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    // React ne rend qu'à la sortie d'`act` : une image de plus, ensuite, peint ce qu'il a rendu.
    const attendre = (ms: number) => {
      act(() => void vi.advanceTimersByTime(ms))
      act(() => void vi.advanceTimersByTime(20))
    }
    const { parle, remonter } = monterEpiee({ type: 'attente' })
    attendre(0)
    expect(parle()).toBe('tape')
    remonter({ type: 'texte', texte: LONG })
    attendre(0)
    expect(parle()).toBe('parle')
    // Il parle jusqu'au dernier paragraphe venu (la suite, puis le second), pas au-delà.
    attendre(PREMIERE_SUITE + 2 * 420 - 60)
    expect(parle()).toBe('parle')
    attendre(40)
    expect(parle()).toBe('non')
  })

  // Mutation : au calme, l'estrade qui parle (l'image immobile serait celle d'un chroniqueur bouche ouverte).
  it('au calme, tape pendant l’attente et se tait sur un texte posé', () => {
    calme(true)
    const { parle, remonter } = monterEpiee({ type: 'attente' })
    expect(parle()).toBe('tape')
    remonter({ type: 'texte', texte: TEXTE })
    expect(parle()).toBe('non')
  })

  // Mutation : les minuteries de la composition gardées au démontage.
  it('n’a plus rien en attente une fois démontée', () => {
    calme(false)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { unmount } = render(<Feuille monde={monde} quoi="ouverture" esp="Ouverture" titre="1897" sous="" etat={{ type: 'texte', texte: TEXTE }} onFermer={vi.fn()} onReessayer={vi.fn()} />)
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  // Le jumeau : la boucle de l'attente, qui se relance d'elle-même. Mutation : ses minuteries gardées au démontage.
  it('n’a plus rien en attente une fois démontée pendant l’attente', () => {
    calme(false)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { unmount } = monter({ type: 'attente' })
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  // Mutation : les minuteries d'un état gardées quand il change (la suite d'un texte parti viendrait
  // se poser sur l'erreur).
  it('annule les minuteries d’un état quand il change', () => {
    calme(false)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { rerender } = monter({ type: 'texte', texte: TEXTE })
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    rerender(<Feuille monde={monde} quoi="ouverture" esp="Ouverture" titre="1897" sous="" etat={{ type: 'erreur', message: 'Non.' }} onFermer={vi.fn()} onReessayer={vi.fn()} />)
    expect(vi.getTimerCount()).toBe(0)
  })
})
