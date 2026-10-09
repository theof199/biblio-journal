import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { PAGES_1890 } from '../../mondes/1890/pages'
import { monterVoyage } from '../../test/pageVoyage'
import { json } from '../../test/serveur'
import { fichePrete, voyage1890 } from '../../test/voyage'
import type { PropsLigneDuBas } from './LigneDuBas'

/**
 * La clé `ligneDuBas` (les derniers écrans de 1900, brief 3) : la page lit la ligne du bas au monde, et
 * lui passe ce que le défaut recevait. Le défaut lui-même est tenu, sans retouche, par
 * `pages/VoyageAnnee.test.tsx` ; le dessin de 1900 par `mondes/1900/pages/ligneDuBas.test.tsx`.
 */
const VOYAGE = voyage1890(
  1897,
  [
    { annee: 1896, statut: 'ouverte', visitee: true, recompense: 'lion' },
    { annee: 1897, statut: 'en_cours', visitee: true, recompense: null },
    { annee: 1898, statut: 'verrouillee', visitee: false, recompense: null },
  ],
  { ia: true, source: null, rattrape_la_source: false },
)
const HORS_IA = { ...VOYAGE, ia: false, source: { id: '22222222-2222-4222-8222-222222222222', pseudo: 'theo', annee_en_cours: 1897 } }
const VERDICT = { mure: false, motif: 'il manque encore deux essentiels.', jugee_le: '2026-09-21T21:00:00.000Z' }
const TICKET = { annee: 1898, emis_le: '2026-09-21T21:00:00.000Z', utilise_le: null }
const UTILISER = 'POST /api/me/voyage/tickets/1898/utiliser'
const routes = (s: Parameters<typeof fichePrete>[0], voyage = VOYAGE) => ({
  'GET /api/me/voyage': () => json(voyage),
  'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
  'GET /api/me/voyage/annees/1897': () => json(fichePrete({ annee: 1897, ticket: null, maturite: null, generique: null, seances: [], demande_salle: null, ...s })),
})

/** Une ligne du bas de monde, qui dit ce qu'elle a reçu. */
const LigneDuMonde = (p: PropsLigneDuBas) => (
  <section aria-label="La ligne du monde">
    {`${p.monde.nom}, ${p.annee}, ${JSON.stringify(p.ligne)}, ${p.occupe ? 'occupé' : 'libre'}, ${p.erreur ?? 'sans refus'}`}
    <button type="button" onClick={() => p.ligne?.type === 'ticket' && p.onUtiliser(p.ligne.annee)}>
      Le geste du monde
    </button>
  </section>
)

describe('la ligne du bas, section qu’un monde peut composer', () => {
  let remettre = () => undefined as void
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
    const avant = PAGES_1890.gabarits
    PAGES_1890.gabarits = { ligneDuBas: LigneDuMonde }
    remettre = () => void (PAGES_1890.gabarits = avant)
  })
  afterEach(() => {
    remettre()
    vi.unstubAllGlobals()
  })

  // Mutations : la page qui monte `LigneDuBas` sans passer par `gabaritDe` ; l'année ou la ligne que la
  // page ne passerait plus ; `onUtiliser` non branché ; le refus de l'API non passé.
  it('la page monte la ligne du monde à la place du défaut, lui passe la ligne, le geste et le refus', async () => {
    const { requetes } = monterVoyage('/voyage/1897', {
      ...routes({ ticket: TICKET }),
      [UTILISER]: () => json({ code: 'NOT_FOUND', message: 'Ce ticket a déjà servi.', retryable: false }, 404),
    })
    const ligne = await screen.findByRole('region', { name: 'La ligne du monde' })
    expect(ligne).toHaveTextContent(/, 1897, \{"type":"ticket","annee":1898\}, libre, sans refus/)
    expect(screen.queryByRole('region', { name: 'Ton ticket' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Utiliser' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Le geste du monde' }))
    await waitFor(() => expect(ligne).toHaveTextContent('libre, Ce ticket a déjà servi.'))
    expect(requetes.filter((r) => r === UTILISER)).toHaveLength(1)
  })

  // Le jury n'entre dans la ligne qu'au compte IA : c'est la page qui le retient, le dessin ne reçoit
  // rien. Mutation, dans la page : `fiche.maturite` passée telle quelle à `ligneDuBas`.
  it('la page ne passe le jury à la ligne du monde qu’au compte IA', async () => {
    const ia = monterVoyage('/voyage/1897', routes({ maturite: VERDICT }))
    expect(await screen.findByRole('region', { name: 'La ligne du monde' })).toHaveTextContent('{"type":"jury","motif":"il manque encore deux essentiels."}')
    ia.unmount()
    monterVoyage('/voyage/1897', routes({ maturite: VERDICT }, HORS_IA))
    expect(await screen.findByRole('region', { name: 'La ligne du monde' })).toHaveTextContent(', 1897, null, libre')
  })
})
