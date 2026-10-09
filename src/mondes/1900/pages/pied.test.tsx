import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { creerRegistre } from '../..'
import type { LigneDuBas } from '../../../voyage/annee'
import type { PropsLigneDuBas } from '../../../voyage/annee/LigneDuBas'
import { PAGES_1900 } from '../pages'
import { MOTS_DU_PIED, dosDuBillet, libelleDuTicket } from './pied'

/**
 * Le bas d'une gare des années 1900 (les derniers écrans de 1900, brief 3) : le dessin seul, monté avec
 * ce que la page lui passerait. Il ne lit ni n'écrit rien : ce que la page garde (la règle, le jury au
 * compte IA seulement, l'encaissement) est tenu par `pages1900.test.tsx`, `voyage/annee/LigneDuBas.test.tsx`
 * et `pages/VoyageAnnee.test.tsx`, ce dernier sans retouche.
 */
const MONDE = creerRegistre()(1900)
const Pied = PAGES_1900.gabarits.ligneDuBas!
const TICKET: LigneDuBas = { type: 'ticket', annee: 1904 }
const BILLET: LigneDuBas = { type: 'billet', annee: 1903, utiliseLe: '2026-10-02T08:00:00.000Z' }
const JURY: LigneDuBas = { type: 'jury', motif: 'il manque encore deux essentiels.' }

function monter(ligne: LigneDuBas, plus: Partial<PropsLigneDuBas> = {}) {
  const onUtiliser = vi.fn()
  const annee = ligne?.type === 'billet' ? 1902 : 1903
  const rendu = render(<Pied monde={MONDE} annee={annee} ligne={ligne} onUtiliser={onUtiliser} occupe={false} erreur={null} {...plus} />)
  return { ...rendu, onUtiliser }
}

/** Ce que chaque état montre, et lui seul. */
const montre = () => ({
  ticket: screen.queryByRole('region', { name: MOTS_DU_PIED.region }) !== null,
  utiliser: screen.queryAllByRole('button', { name: /utiliser/i }).length,
  billet: document.querySelectorAll('button[aria-pressed]').length,
  jury: screen.queryByText(/Pas encore mûre/) !== null,
  depeche: screen.queryByText(MOTS_DU_PIED.depeche) !== null,
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('le bas d’une gare des années 1900', () => {
  it('le monde 1900 compose la ligne du bas', () => {
    expect(MONDE.pages).toBe(PAGES_1900)
  })

  // Mutations : la branche du ticket ouverte au billet (`ligne.type !== 'jury'` : le billet utilisé
  // offrirait « Utiliser ») ; la dépêche rendue pour un billet ; la garde `if (!ligne)` qui rendrait la
  // dépêche (le jury inventé par le dessin, hors du compte IA, où la page passe `null`).
  it('chacun des quatre états ne montre que le sien : le billet utilisé n’offre pas « Utiliser », et sans ligne rien ne paraît', () => {
    const rien = monter(null)
    expect(rien.container).toBeEmptyDOMElement()
    rien.unmount()
    monter(TICKET)
    expect(montre()).toEqual({ ticket: true, utiliser: 1, billet: 0, jury: false, depeche: false })
    cleanup()
    monter(BILLET)
    expect(montre()).toEqual({ ticket: false, utiliser: 0, billet: 1, jury: false, depeche: false })
    cleanup()
    monter(JURY)
    expect(montre()).toEqual({ ticket: false, utiliser: 0, billet: 0, jury: true, depeche: true })
    expect(screen.queryAllByRole('button')).toEqual([])
  })

  // Mutations : `onUtiliser(annee)` (l'année de la fiche au lieu de celle du ticket) ; le carton sans
  // le millésime du ticket ; le libellé du bouton sans l'année.
  it('le ticket qui attend est un « Bon pour » et son bouton encaisse l’année du ticket', () => {
    const { onUtiliser } = monter(TICKET)
    const region = screen.getByRole('region', { name: 'Ton ticket' })
    expect(region).toHaveTextContent('Bon pour 1904')
    expect(region).toHaveTextContent('de 1903 à')
    fireEvent.click(within(region).getByRole('button', { name: libelleDuTicket(1904) }))
    expect(onUtiliser.mock.calls).toEqual([[1904]])
    expect(libelleDuTicket(1904)).toBe('Utiliser le ticket de 1904')
  })

  // Le verrou vient de la page : le dessin ne l'ignore pas. Mutation : `disabled={occupe}` retiré.
  it('pendant l’encaissement, un second toucher n’utilise rien', () => {
    const { onUtiliser } = monter(TICKET, { occupe: true })
    const bouton = screen.getByRole('button', { name: libelleDuTicket(1904) })
    expect(bouton).toBeDisabled()
    fireEvent.click(bouton)
    expect(onUtiliser).not.toHaveBeenCalled()
  })

  // Mutations : le refus non rendu ; rendu sans `role="alert"` ; réécrit par le dessin.
  it('le refus de l’API se dit tel quel, en alerte, et le ticket reste', () => {
    monter(TICKET, { erreur: 'Ce ticket a déjà servi.' })
    expect(screen.getByRole('alert')).toHaveTextContent(/^Ce ticket a déjà servi\.$/)
    expect(screen.getByRole('button', { name: libelleDuTicket(1904) })).toBeEnabled()
    cleanup()
    monter(TICKET)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  // Mutations : le billet qui ne se retourne pas (`setRetourne` retiré) ; le dos montré avec le recto
  // (`aria-hidden` retiré d'une face) ; le jour pris en UTC ; le dos de la foire (« salles et séances »).
  it('le billet utilisé dit son année et son jour, celui du téléphone, se retourne, et son dos ne parle plus de foire', () => {
    vi.stubEnv('TZ', 'Europe/Paris')
    monter({ type: 'billet', annee: 1903, utiliseLe: '2026-10-01T22:30:00.000Z' })
    const billet = screen.getByRole('button', { pressed: false })
    expect(billet).toHaveAccessibleName(/^Ticket pour ?1903 ?utilisé le 2 octobre 2026 ?Entrée$/)
    fireEvent.click(billet)
    expect(billet).toHaveAttribute('aria-pressed', 'true')
    expect(billet).toHaveAccessibleName(dosDuBillet(1902, 1903))
    expect(dosDuBillet(1902, 1903)).toMatch(/Délivré en 1902, tamponné à l’entrée de 1903\./)
    expect(dosDuBillet(1902, 1903)).not.toMatch(/salle|séance|baraque|foire/i)
    fireEvent.click(billet)
    expect(billet).toHaveAccessibleName(/^Ticket pour/)
  })

  // Mutations : le motif tu (`ligne.motif` retiré) ; la dépêche sans le nom du jury ; `calme` inversé.
  it('le mot du jury est une dépêche qui dit son motif ; au calme, le billet ne glisse pas', () => {
    monter(JURY)
    const depeche = screen.getByRole('region', { name: MONDE.pages.mots.jury })
    expect(within(depeche).getByText('Pas encore mûre : il manque encore deux essentiels.')).toBeInTheDocument()
    expect(depeche).toHaveTextContent(/^Dépêche télégraphique/)
    cleanup()
    monter(BILLET)
    expect(document.querySelector('button[aria-pressed]')).toHaveAttribute('data-vivante', 'oui')
    cleanup()
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
    monter(BILLET)
    expect(document.querySelector('button[aria-pressed]')).toHaveAttribute('data-vivante', 'non')
  })
})
