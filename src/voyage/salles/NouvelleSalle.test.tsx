import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { FichePrete, Voyage } from '../../api/voyage'
import { PAGES_1890 } from '../../mondes/1890/pages'
import { monterVoyage } from '../../test/pageVoyage'
import { json } from '../../test/serveur'
import { fichePrete, salle, voyage1890 } from '../../test/voyage'
import { RELECTURES } from '../relecture'
import type { PropsNouvelleSalle } from './TenteALouer'

/**
 * La clé `nouvelleSalle` (les derniers écrans de 1900, brief 4) : `NouvelleSalle` lit le dessin de sa
 * zone au monde et lui passe ce qu'il montre ; il garde le calque, le guet, le refus marqué vu et le
 * feuillet. Le défaut (`TenteALouer`) est tenu, sans retouche, par `Salles.test.tsx` ; le dessin de
 * 1900 par `mondes/1900/pages/voieAOuvrir.test.tsx`.
 */
const VOYAGE = voyage1890(1897, [{ annee: 1897, statut: 'en_cours', visitee: true, recompense: null }], { ia: true, source: null, rattrape_la_source: false })
const HORS_IA: Voyage = { ...VOYAGE, ia: false, source: { id: '22222222-2222-4222-8222-222222222222', pseudo: 'theo', annee_en_cours: 1897 } }
const ANNEE = 'GET /api/me/voyage/annees/1897'
const demande = (statut: 'en_cours' | 'refusee', motif: string | null = null) => ({ id: 'd-cle', demande: 'Les films de fantômes', statut, motif, salle_id: null })
const routes = (s: Partial<FichePrete> = {}, voyage: Voyage = VOYAGE) => ({
  'GET /api/me/voyage': () => json(voyage),
  [ANNEE]: () => json(fichePrete({ annee: 1897, ticket: null, maturite: null, generique: null, seances: [], seance_en_cours: false, salles: [salle({ id: 's-ess', nom: 'Les essentiels', films: [] })], demande_salle: null, ...s })),
})

/** Une zone de monde, qui dit ce qu'elle a reçu et offre les deux gestes. */
const ZoneDuMonde = (p: PropsNouvelleSalle) => (
  <section aria-label="La zone du monde">
    {`${p.monde.nom}, ${p.annee}, ${p.zone}, ${p.demande ? `${p.demande.demande} (${p.demande.motif ?? 'sans motif'})` : 'sans demande'}, ${p.abandon ? 'abandon' : 'le guet tient'}`}
    <button type="button" onClick={p.onOuvrir}>
      Le geste d’ouvrir
    </button>
    <button type="button" onClick={p.onReessayer}>
      Le geste de réessayer
    </button>
  </section>
)
const zone = () => screen.findByRole('region', { name: 'La zone du monde' })

describe('le dessin de la nouvelle salle, section qu’un monde peut composer', () => {
  let remettre = () => undefined as void
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
    const avant = PAGES_1890.gabarits
    PAGES_1890.gabarits = { nouvelleSalle: ZoneDuMonde }
    remettre = () => void (PAGES_1890.gabarits = avant)
  })
  afterEach(() => {
    remettre()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Mutations : `NouvelleSalle` qui monte `TenteALouer` sans passer par `gabaritDe` ; `onOuvrir` non
  // branché sur le calque ; le feuillet rendu par le dessin et plus par le conteneur.
  it('monte la zone du monde à la place de la tente, et son geste ouvre le feuillet que le conteneur garde', async () => {
    monterVoyage('/voyage/1897', routes())
    expect(await zone()).toHaveTextContent(/, 1897, bouton, sans demande, le guet tient/)
    expect(screen.queryByRole('button', { name: 'Ouvrir une nouvelle salle' })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Le geste d’ouvrir' }))
    expect(await screen.findByRole('dialog', { name: 'Quelle salle ?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Demander' })).toBeInTheDocument()
  })

  // Mutations : la demande non passée au dessin ; le refus que le conteneur ne marquerait plus vu.
  it('passe le refus et son motif, et le conteneur le marque vu', async () => {
    const { requetes } = monterVoyage('/voyage/1897', {
      ...routes({ demande_salle: demande('refusee', 'Le relief attendra 1903.') }),
      'POST /api/me/voyage/demandes-salles/d-cle/vue': () => new Response(null, { status: 204 }),
    })
    expect(await zone()).toHaveTextContent(', refus, Les films de fantômes (Le relief attendra 1903.), le guet tient')
    await waitFor(() => expect(requetes.filter((r) => r.includes('/vue'))).toHaveLength(1))
  })

  // Mutations : `abandon` passé faux en dur ; `onReessayer` non branché sur le guet ; le guet retiré du
  // conteneur (la fiche ne se relit plus).
  it('passe la salle qui s’écrit, puis l’abandon du guet, et son geste relance le guet', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { requetes } = monterVoyage('/voyage/1897', routes({ demande_salle: demande('en_cours') }))
    const lues = () => requetes.filter((r) => r === ANNEE).length
    expect(await zone()).toHaveTextContent(', fantome, Les films de fantômes (sans motif), le guet tient')
    for (let i = 0; i < 45; i += 1) await vi.advanceTimersByTimeAsync(5_000)
    await waitFor(async () => expect(await zone()).toHaveTextContent(', fantome, Les films de fantômes (sans motif), abandon'))
    expect(lues()).toBe(1 + RELECTURES.salle.plafond)
    fireEvent.click(screen.getByRole('button', { name: 'Le geste de réessayer' }))
    await waitFor(() => expect(lues()).toBe(2 + RELECTURES.salle.plafond))
    await waitFor(async () => expect(await zone()).toHaveTextContent('le guet tient'))
  })

  // Mutation, dans `Salles` : le garde `ia` de la nouvelle salle retiré.
  it('hors du compte IA, la zone du monde ne se monte pas', async () => {
    monterVoyage('/voyage/1897', routes({}, HORS_IA))
    await screen.findByRole('heading', { level: 1, name: '1897' })
    await screen.findAllByRole('region', { name: /^Salle / })
    expect(screen.queryByRole('region', { name: 'La zone du monde' })).toBeNull()
  })
})
