import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { creerRegistre } from '../..'
import type { DemandeSalle, Voyage } from '../../../api/voyage'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { fichePrete, salle, voyage1890 } from '../../../test/voyage'
import type { PropsNouvelleSalle } from '../../../voyage/salles/TenteALouer'
import { PAGES_1890 } from '../../1890/pages'
import { PAGES_1900 } from '../pages'
import { MOTS_DES_VOIES as M } from './voies'

/**
 * La voie à ouvrir des années 1900 (les derniers écrans de 1900, brief 4) : le dessin seul, monté avec
 * ce que `NouvelleSalle` lui passerait, puis la page, où le monde n'arrive que par le registre. Ce que
 * le conteneur garde (le calque, le guet, le refus marqué vu, le feuillet) est tenu par
 * `voyage/salles/NouvelleSalle.test.tsx` et, sans retouche, par `Salles.test.tsx` ; le compte IA par
 * `voies.test.tsx`.
 */
const MONDE = creerRegistre()(1900)
const Voie = PAGES_1900.gabarits.nouvelleSalle!
const OUVRIR = PAGES_1900.mots.salleNeuve.ouvrir
const DEMANDE: DemandeSalle = { id: 'd-1', demande: 'Les féeries de Chomón', statut: 'en_cours', motif: null, salle_id: null }
const REFUS: DemandeSalle = { ...DEMANDE, statut: 'refusee', motif: 'Trop peu de féeries en 1903.' }

function monter(p: Partial<PropsNouvelleSalle>) {
  const onOuvrir = vi.fn()
  const onReessayer = vi.fn()
  render(<Voie monde={MONDE} annee={1903} zone="bouton" demande={null} abandon={false} onOuvrir={onOuvrir} onReessayer={onReessayer} {...p} />)
  return { onOuvrir, onReessayer }
}
const boutons = () => screen.queryAllByRole('button').map((b) => b.textContent)
/** La tente du défaut : son tracé, que rien d'autre ne dessine. */
const tente = () => document.querySelector('svg path[d^="M8 50V22L45 4"]')

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('la voie à ouvrir des années 1900', () => {
  // Mutations : `onOuvrir` non posé sur le bouton ; la phrase du monde tue ; le mot du geste en dur.
  it('au repos : une voie vide, la phrase du monde, et le geste d’ouvrir, au mot du monde', () => {
    const { onOuvrir, onReessayer } = monter({})
    const voie = screen.getByRole('region', { name: M.aOuvrir })
    expect(voie).toHaveTextContent(PAGES_1900.mots.nouvelleSalle)
    expect(boutons()).toEqual([OUVRIR])
    expect(OUVRIR).toBe('Ouvrir une voie')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.click(within(voie).getByRole('button', { name: OUVRIR }))
    expect(onOuvrir).toHaveBeenCalledTimes(1)
    expect(onReessayer).not.toHaveBeenCalled()
  })

  // Mutations : « Ouvrir » offert dans toute zone ; la demande tue ; l'état « s'écrit » tu ou hors
  // `role="status"` ; « Réessayer » offert sans abandon.
  it('pendant que la salle s’écrit : la voie est en travaux, dit la demande, et n’offre rien', () => {
    monter({ zone: 'fantome', demande: DEMANDE })
    const voie = screen.getByRole('region', { name: M.travaux })
    expect(voie).toHaveTextContent('Les féeries de Chomón')
    expect(voie).toHaveTextContent(M.enTravaux)
    expect(screen.getByRole('status')).toHaveTextContent(PAGES_1900.mots.salleNeuve.sEcrit)
    expect(boutons()).toEqual([])
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('region', { name: M.aOuvrir })).toBeNull()
  })

  // Mutations : « Réessayer » retiré ; `abandon` ignoré (la voie promet encore que la salle s'écrit) ;
  // `onReessayer` non posé ; l'abandon hors `role="alert"`.
  it('le guet abandonné : la voie le dit en alerte, ne promet plus rien, et offre « Réessayer », lui seul', () => {
    const { onOuvrir, onReessayer } = monter({ zone: 'fantome', demande: DEMANDE, abandon: true })
    expect(screen.getByRole('alert')).toHaveTextContent(M.sansReponse)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('region', { name: M.travaux })).toHaveTextContent('Les féeries de Chomón')
    expect(boutons()).toEqual([M.reessayer])
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(onReessayer).toHaveBeenCalledTimes(1)
    expect(onOuvrir).not.toHaveBeenCalled()
  })

  // Mutations : le motif remplacé par la phrase du repos ; hors `role="alert"` ; le repli retiré (un
  // refus sans motif ne dirait rien) ; « Ouvrir » retiré d'une voie refusée.
  it('refusée : la voie porte le motif du refus, en alerte, et offre d’en demander une autre', () => {
    monter({ zone: 'refus', demande: REFUS })
    expect(screen.getByRole('alert')).toHaveTextContent(/^Trop peu de féeries en 1903\.$/)
    expect(screen.getByRole('region', { name: M.aOuvrir })).toHaveTextContent(M.refusee)
    expect(screen.getByRole('region', { name: M.aOuvrir })).not.toHaveTextContent(PAGES_1900.mots.nouvelleSalle)
    expect(boutons()).toEqual([OUVRIR])
    cleanup()
    monter({ zone: 'refus', demande: { ...REFUS, motif: null } })
    expect(screen.getByRole('alert')).toHaveTextContent(M.sansMotif)
  })
})

describe('la voie à ouvrir dans la page', () => {
  const voyage = (annee: number): Voyage => voyage1890(annee, [{ annee, statut: 'en_cours', visitee: true, recompense: null }], { ia: true, source: null, rattrape_la_source: false })
  const routes = (annee: number) => ({
    'GET /api/me/voyage': () => json(voyage(annee)),
    'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
    [`GET /api/me/voyage/annees/${annee}`]: () =>
      json(fichePrete({ annee, ticket: null, maturite: null, generique: null, seances: [], seance_en_cours: false, salles: [salle({ id: 's-ess', nom: 'Les essentiels', films: [] })], demande_salle: null })),
  })

  // Mutations : `nouvelleSalle` retirée des gabarits de 1900 (la tente revient) ; le geste du dessin
  // qui n'ouvrirait plus le feuillet du conteneur.
  it('en 1900, la voie remplace la tente, et son bouton ouvre le feuillet « Quelle salle ? »', async () => {
    monterVoyage('/voyage/1903', routes(1903))
    const voie = await screen.findByRole('region', { name: M.aOuvrir })
    expect(tente()).toBeNull()
    expect(screen.queryByRole('button', { name: PAGES_1890.mots.salleNeuve.ouvrir })).toBeNull()
    fireEvent.click(within(voie).getByRole('button', { name: OUVRIR }))
    expect(await screen.findByRole('dialog', { name: 'Quelle salle ?' })).toBeInTheDocument()
  })

  // Mutation : `nouvelleSalle: VoieAOuvrir` posée dans les gabarits de 1890.
  it('en 1890, la tente reste, et aucune voie ne se dessine', async () => {
    expect(PAGES_1890.gabarits).toEqual({})
    monterVoyage('/voyage/1897', routes(1897))
    expect(await screen.findByRole('button', { name: 'Ouvrir une nouvelle salle' })).toBeInTheDocument()
    expect(tente()).not.toBeNull()
    expect(screen.queryByRole('region', { name: M.aOuvrir })).toBeNull()
    expect(screen.queryByRole('button', { name: OUVRIR })).toBeNull()
  })
})
