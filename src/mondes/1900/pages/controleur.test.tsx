import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import App from '../../../App'
import { cles } from '../../../api/cles'
import { createQueryClient } from '../../../api/queryClient'
import type { JournalPage } from '../../../api/journal'
import type { PassageDuControleur, Voyageur } from '../../../api/voyage'
import { FabriqueMoteurContexte } from '../../../carte/CarteCanvas'
import { exemple } from '../../../test/contrat'
import { visionnage } from '../../../test/journal'
import { moteurFactice } from '../../../test/moteurFactice'
import { SESSION } from '../../../test/pageVoyage'
import { json, servir } from '../../../test/serveur'
import { ROUTES_DU_JEU, voyage1890 } from '../../../test/voyage'
import { MOTS_DU_CONTROLEUR as M, bulleDuControleur, ceQuiSePasse, ligneDuBilletDemande } from './controleur'
import feuille from './Controleur.module.css'

/**
 * Le contrôleur des billets sur la carte des années 1900 (plan des écrans des lots, brief 7 ;
 * maquette, `#controle`) : ses mots et ses règles, puis la carte montée dans l'app entière, où le
 * monde n'arrive que par le registre. Quand il entre, ce que le bloc lecteur lit et écrit, ses gardes
 * et le `409` sont tenus, sans monde, par `pages/Carte.controleur.test.tsx` ; ici, ce que 1900 en dit.
 * Aucun test sur le tracé du personnage ni sur celui du poinçon.
 */
const LIRE = 'GET /api/me/voyage/voyageur'
const JOURNAL = 'GET /api/me/journal?limit=20'
const REPONDRE = 'POST /api/me/voyage/controleur/reponse'

const EN_1903 = voyage1890(
  1903,
  Array.from({ length: 15 }, (_, i) => {
    const annee = 1895 + i
    return annee < 1903
      ? { annee, statut: 'ouverte' as const, visitee: true, recompense: null, progression: null }
      : { annee, statut: annee === 1903 ? ('en_cours' as const) : ('verrouillee' as const), visitee: false, recompense: null, progression: null, profondeur: 0 }
  }),
)
const BILLET = { log_entry_id: 'b0000000-0000-4000-8000-000000000002', media_id: 'd0000000-0000-4000-8000-000000000007' }
const BASE = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
const IL_ATTEND: Voyageur = { ...BASE, controleur: { attend: true, billet: BILLET } }
const PRESENTE: PassageDuControleur = { reponse: 'presente', poincon: { ...BILLET, poinconne_le: '2026-10-08T18:00:00.000Z' } }
const REFUSE: PassageDuControleur = { reponse: 'refuse', poincon: null }

const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
const MODELE = visionnage({ id: BILLET.log_entry_id, media: BILLET.media_id, titre: 'The Great Train Robbery', annee: 1903, date: '2026-09-30', note: 8 })
const LE_BILLET = { ...MODELE, media: { ...MODELE.media, director: 'Edwin S. Porter' } }
const UN_PLUS_ANCIEN = visionnage({ id: 'b0000000-0000-4000-8000-000000000001', titre: 'Le Voyage dans la Lune', annee: 1902, date: '2026-09-12' })
const journal = (items = [LE_BILLET, UN_PLUS_ANCIEN]): JournalPage => ({ ...PAGE, items, next_cursor: null })

type Routes = Record<string, (init: RequestInit) => Response | Promise<Response>>

/** La carte d'un membre en 1903, où le contrôleur attend ; `client` porte ce qui est déjà en cache. */
async function monter(routes: Routes = {}, client: QueryClient = createQueryClient()) {
  const f = moteurFactice()
  const requetes = servir({
    'GET /api/auth/me': () => json(SESSION),
    'GET /api/me/voyage': () => json(EN_1903),
    'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
    ...ROUTES_DU_JEU,
    [LIRE]: () => json(IL_ATTEND),
    [JOURNAL]: () => json(journal()),
    ...routes,
  })
  render(
    <QueryClientProvider client={client}>
      <FabriqueMoteurContexte.Provider value={f.fabrique}>
        <MemoryRouter initialEntries={['/voyage']}>
          <App />
        </MemoryRouter>
      </FabriqueMoteurContexte.Provider>
    </QueryClientProvider>,
  )
  const portiere = await screen.findByRole('dialog', { name: M.nom })
  await waitFor(() => expect(client.isFetching() + client.isMutating()).toBe(0))
  return { requetes, client, portiere }
}

/** La boîte des années 1900 déjà lue : le billet demandé y est le deuxième vu. */
const avecLaBoite = () => {
  const client = createQueryClient()
  client.setQueryData(cles.journalDesAnnees(1900, 1909), [LE_BILLET, UN_PLUS_ANCIEN])
  return client
}
const etat = (portiere: HTMLElement) => within(portiere).getByRole('status').textContent
const boutons = (portiere: HTMLElement) => within(portiere).getAllByRole('button').map((b) => b.textContent)
const poincons = (portiere: HTMLElement) => portiere.querySelectorAll(`.${feuille.poincon}`).length
const corps = (init: RequestInit) => JSON.parse(String(init.body)) as unknown

describe('les mots et les règles du contrôleur', () => {
  // Mutations : une bulle pour les trois états ; les deux réponses échangées.
  it('dit dans sa bulle ce que la maquette lui fait dire, à chaque état', () => {
    expect(bulleDuControleur('demande')).toBe('« Contrôle des billets, s’il vous plaît. »')
    expect(bulleDuControleur('presente')).toBe('« En règle. Bon voyage ! »')
    expect(bulleDuControleur('refuse')).toBe('« Bonne soirée. »')
  })

  // Mutations : le numéro écrit en dur (« N° 0413 », celui de la maquette) ; « le billet N° ···· » dit
  // sans numéro ; la phrase du refus dite au présenté.
  it('dit ce qui se passe, et ne nomme le billet par son numéro que si la boîte l’a donné', () => {
    expect(ceQuiSePasse('demande', 7)).toBe('Il demande ton dernier billet. Rien n’oblige à le montrer.')
    expect(ceQuiSePasse('presente', 7)).toBe('Un coup de poinçon doré sur le billet N° 0007. Le contrôleur ne repassera pas de la semaine.')
    expect(ceQuiSePasse('presente', null)).toBe('Un coup de poinçon doré sur ton billet. Le contrôleur ne repassera pas de la semaine.')
    expect(ceQuiSePasse('refuse', 7)).toBe('Pas de poinçon, pas de pénalité : rien ne se perd. Il repassera une autre semaine.')
  })

  // Le contrôleur demande mon dernier billet de film, de quelque année qu'il soit. Mutations : « gare
  // de » dit de toute année (`ligneDuFilm` sans la garde de la décennie) ; la borne à 1909 oubliée
  // (1910 passerait pour une gare) ; une ligne vide rendue au lieu de rien.
  it('ne dit « gare de » que d’une année de la ligne', () => {
    expect(ligneDuBilletDemande('Edwin S. Porter', 1903)).toBe('Edwin S. Porter · gare de 1903')
    expect(ligneDuBilletDemande(null, 1900)).toBe('gare de 1900')
    expect(ligneDuBilletDemande('Edwin S. Porter', 1909)).toBe('Edwin S. Porter · gare de 1909')
    expect(ligneDuBilletDemande('Louis Feuillade', 1910)).toBe('Louis Feuillade · 1910')
    expect(ligneDuBilletDemande('Louis Lumière', 1899)).toBe('Louis Lumière · 1899')
    expect(ligneDuBilletDemande('Christopher Nolan', null)).toBe('Christopher Nolan')
    expect(ligneDuBilletDemande('  ', null)).toBeNull()
  })
})

describe('le contrôleur sur la carte de 1903', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  // Mutations : 1900 ne remplit plus `controleurDeLaCarte` (aucune portière) ; le carton rempli sans
  // sa ligne, sans son numéro ou sans sa note ; « Refermer la portière » offert avant la réponse ; le
  // poinçon posé avant la réponse ; la note « sans titre de transport » de la maquette portée.
  it('il entre et demande mon dernier billet : sa bulle, le carton de mon journal numéroté par la boîte, les deux réponses', async () => {
    const { portiere } = await monter({}, avecLaBoite())
    expect(within(portiere).getByText('« Contrôle des billets, s’il vous plaît. »')).toBeInTheDocument()
    expect(etat(portiere)).toBe('Il demande ton dernier billet. Rien n’oblige à le montrer.')
    expect(within(portiere).getByText('The Great Train Robbery')).toBeInTheDocument()
    expect(within(portiere).getByText('Edwin S. Porter · gare de 1903')).toBeInTheDocument()
    expect(within(portiere).getByText('N° 0002')).toBeInTheDocument()
    expect(within(portiere).getByText('8 / 10')).toBeInTheDocument()
    expect(within(portiere).getByText('30 SE 26')).toBeInTheDocument()
    expect(boutons(portiere)).toEqual(['Présenter le billet', 'Pas ce soir'])
    expect(within(portiere).getByRole('button', { name: 'Présenter le billet' })).toHaveFocus()
    expect(poincons(portiere)).toBe(0)
    expect(portiere.textContent).not.toMatch(/sans titre de transport|clandestin/i)
    expect(within(portiere).queryByRole('alert')).toBeNull()
    // La carte ne pose pas les jetons des pages : la portière les porte elle-même, sans quoi sa feuille
    // n'a ni couleur ni police. Mutation : les jetons du monde retirés de son style.
    expect(portiere.style.getPropertyValue('--m-papier')).not.toBe('')
    expect(portiere.style.getPropertyValue('--m-f-texte')).not.toBe('')
  })

  // Mutations : la phrase du refus au présenté ; le poinçon jamais posé ; les deux réponses laissées
  // sous « Refermer la portière » ; le numéro de la maquette en dur ; le bouton branché sur le refus.
  it('présenté : « En règle. Bon voyage ! », le poinçon doré sur le carton, puis « Refermer la portière »', async () => {
    const envoyes: unknown[] = []
    const { portiere } = await monter({ [REPONDRE]: (init) => (envoyes.push(corps(init)), json(PRESENTE)) }, avecLaBoite())
    fireEvent.click(within(portiere).getByRole('button', { name: 'Présenter le billet' }))
    expect(await within(portiere).findByText('« En règle. Bon voyage ! »')).toBeInTheDocument()
    expect(envoyes).toEqual([{ reponse: 'presente' }])
    expect(etat(portiere)).toBe('Un coup de poinçon doré sur le billet N° 0002. Le contrôleur ne repassera pas de la semaine.')
    expect(poincons(portiere)).toBe(1)
    expect(within(portiere).getByText('The Great Train Robbery')).toBeInTheDocument()
    expect(boutons(portiere)).toEqual(['Refermer la portière'])
    expect(within(portiere).getByRole('button', { name: 'Refermer la portière' })).toHaveFocus()
    fireEvent.click(within(portiere).getByRole('button', { name: 'Refermer la portière' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // Mutations : un poinçon posé au refus ; « En règle » dit au refus ; le bouton branché sur « présenter ».
  it('« Pas ce soir » : « Bonne soirée. », rien ne se perd, aucun poinçon, puis « Refermer la portière »', async () => {
    const envoyes: unknown[] = []
    const { portiere, requetes } = await monter({ [REPONDRE]: (init) => (envoyes.push(corps(init)), json(REFUSE)) })
    fireEvent.click(within(portiere).getByRole('button', { name: 'Pas ce soir' }))
    expect(await within(portiere).findByText('« Bonne soirée. »')).toBeInTheDocument()
    expect(etat(portiere)).toBe('Pas de poinçon, pas de pénalité : rien ne se perd. Il repassera une autre semaine.')
    expect(poincons(portiere)).toBe(0)
    expect(boutons(portiere)).toEqual(['Refermer la portière'])
    expect(requetes.filter((r) => r === REPONDRE)).toHaveLength(1)
    expect(envoyes).toEqual([{ reponse: 'refuse' }])
  })

  // Décision 6 : sans la boîte en cache, le carton n'a pas de numéro ; sans le billet sur la première
  // page du journal, la portière n'a pas de carton, et le poinçon n'a rien où se poser. Mutations : un
  // numéro en attente (« N° ···· ») écrit sans la boîte ; un carton vide dessiné sans billet ; le
  // poinçon posé hors du carton.
  it('sans la boîte en cache, le carton n’a pas de numéro ; sans le billet au journal, pas de carton, et la réponse se fait quand même', async () => {
    const sansBoite = await monter()
    expect(within(sansBoite.portiere).getByText('The Great Train Robbery')).toBeInTheDocument()
    expect(sansBoite.portiere.textContent).not.toMatch(/N°/)
    cleanup()
    const { portiere } = await monter({ [JOURNAL]: () => json(journal([UN_PLUS_ANCIEN])), [REPONDRE]: () => json(PRESENTE) })
    expect(within(portiere).queryByText('The Great Train Robbery')).toBeNull()
    expect(within(portiere).queryByText('Le Voyage dans la Lune')).toBeNull()
    expect(portiere.textContent).not.toMatch(/Ch\. de fer du Voyage|N°/)
    expect(boutons(portiere)).toEqual(['Présenter le billet', 'Pas ce soir'])
    fireEvent.click(within(portiere).getByRole('button', { name: 'Présenter le billet' }))
    expect(await within(portiere).findByText('« En règle. Bon voyage ! »')).toBeInTheDocument()
    expect(etat(portiere)).toBe('Un coup de poinçon doré sur ton billet. Le contrôleur ne repassera pas de la semaine.')
    expect(poincons(portiere)).toBe(0)
  })

  // Une panne se dit dans le dialogue, en alerte, sous ce qui se passe ; les réponses restent.
  // Mutation : la panne reçue et non montrée.
  it('une panne se dit dans la portière, en alerte, et les deux réponses restent', async () => {
    const { portiere } = await monter({ [REPONDRE]: () => json({ code: 'INTERNAL', message: 'Le serveur est en panne.', retryable: false }, 500) })
    fireEvent.click(within(portiere).getByRole('button', { name: 'Présenter le billet' }))
    expect(await within(portiere).findByRole('alert')).toHaveTextContent('Le serveur est en panne.')
    expect(within(portiere).getByText('« Contrôle des billets, s’il vous plaît. »')).toBeInTheDocument()
    expect(boutons(portiere)).toEqual(['Présenter le billet', 'Pas ce soir'])
  })

  // Règle 9 du plan : rien ne bouge au calme. La feuille n'anime que sous `data-vivante='oui'`.
  // Mutation : `data-vivante` posé à « oui » sans regarder le réglage.
  it.each([
    [true, 'non'],
    [false, 'oui'],
  ])('« réduire les animations » à %s : la portière se dit vivante « %s »', async (reduit, attendu) => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduit, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
    const { portiere } = await monter()
    expect(portiere).toHaveAttribute('data-vivante', attendu)
  })
})
