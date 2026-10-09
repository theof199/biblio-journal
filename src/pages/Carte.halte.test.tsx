import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate, type Location, type NavigateFunction } from 'react-router-dom'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import type { Halte, Voyage, Voyageur } from '../api/voyage'
import { FabriqueMoteurContexte } from '../carte/CarteCanvas'
import { PAGES_1890 } from '../mondes/1890/pages'
import type { HabillagePages } from '../mondes/types'
import { exemple } from '../test/contrat'
import { moteurFactice } from '../test/moteurFactice'
import { json, servir } from '../test/serveur'
import { COURRIER_VIDE, malleVide, voyage1890 } from '../test/voyage'
import type { PropsControleurDeLaCarte } from '../voyage/controleur/Controleur'
import type { PropsHalteDeLaCarte } from '../voyage/halte/Halte'

// Une halte s'ouvre sur la carte (plan des écrans des lots, brief 12) par une clé de gabarit **sans
// défaut**, `halteDeLaCarte`, lue au monde de la décennie de la halte, qui est aussi la mienne : sorti
// de sa décennie, je ne l'ouvre plus (`voyage/regles.ts`, `halteEnService`). Aucun monde ne la remplit dans
// ce fichier : il tient le bloc lecteur et les gardes de la page sur un 1890 auquel on prête un
// dessin qui dit ce qu'il reçoit, et une halte que le test sert sur la foire (l'API n'en sert
// aucune avant 1902). Le moteur est factice : le test joue le rappel `aiguillage` lui-même.
const SESSION = exemple<{ user: { id: string; pseudo: string } }>('/auth/me', 'get', 200)
const VOYAGE = 'GET /api/me/voyage'
const TICKETS = 'GET /api/me/voyage/tickets'
const LIRE = 'GET /api/me/voyage/voyageur'
const MONTRE = 'POST /api/me/voyage/tickets/1899/montre'
const MELIES = exemple<Voyage>('/me/voyage', 'get', 200).haltes[0]!
/** Une halte de deux films sur la foire, après 1897 : un vu, un introuvable sans affiche. */
const BARAQUE: Halte = {
  cle: 'baraque',
  nom: 'Halte de la baraque',
  apres: 1897,
  films: [
    { ...MELIES.films[0]!, title: 'Le Manoir du diable', year: 1896 },
    { ...MELIES.films[2]!, title: 'La Fée aux choux', year: 1896, etat: 'introuvable' },
  ],
}
const en = (enCours: number, haltes: Halte[] = [BARAQUE]): Voyage =>
  voyage1890(
    enCours,
    [1895, 1896, 1897, 1898, 1899].map((annee) =>
      annee < enCours
        ? { annee, statut: 'ouverte' as const, visitee: true, recompense: null, progression: null }
        : { annee, statut: annee === enCours ? ('en_cours' as const) : ('verrouillee' as const), visitee: false, recompense: null, progression: null, profondeur: 0 },
    ),
    { haltes },
  )
const EN_1898 = en(1898)
const BASE = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
const IL_ATTEND: Voyageur = { ...BASE, controleur: { attend: true, billet: { log_entry_id: 'b0000000-0000-4000-8000-000000000002', media_id: 'd0000000-0000-4000-8000-000000000007' } } }

/** Chaque rendu du dessin prêté : un dialogue posé le temps d'un seul rendu ne se voit pas autrement. */
const rendus = vi.fn()
/** Le dessin prêté : ce qu'il reçoit, ligne par ligne, et son seul geste. */
const Dessin = ({ halte, compte, premier, fermer }: PropsHalteDeLaCarte) => (
  <div role="dialog" aria-modal="true" aria-label={halte.nom}>
    {void rendus()}
    <p data-testid="compte">{`${compte.vus} sur ${compte.total}`}</p>
    <ul>
      {halte.films.map((f) => (
        <li key={f.tmdb_id}>{`${f.title}, ${f.year}, ${f.etat}, ${f.cover_url ?? 'sans affiche'}, ${f.plex_url ?? 'sans Plex'}`}</li>
      ))}
    </ul>
    <button ref={premier} type="button" onClick={fermer}>
      Revenir
    </button>
  </div>
)
const Portiere = (p: PropsControleurDeLaCarte) => (
  <div role="dialog" aria-modal="true" aria-label="Le contrôleur">
    <button ref={p.premier} type="button" onClick={p.fermer}>
      Laisser
    </button>
  </div>
)

/** Le témoin de l'adresse : où l'on est, et de quoi reculer comme le fait le retour du téléphone. */
const adresse: { ou: Location | null; aller: NavigateFunction | null } = { ou: null, aller: null }
function Temoin() {
  adresse.ou = useLocation()
  adresse.aller = useNavigate()
  return null
}
const ou = () => `${adresse.ou!.pathname}${adresse.ou!.search}`
const reculer = () => act(async () => void adresse.aller!(-1))

interface Options {
  voyage?: Voyage
  depuis?: string
  client?: QueryClient
  moteur?: ReturnType<typeof moteurFactice>
  routes?: Record<string, () => Response | Promise<Response>>
}
async function monter({ voyage = EN_1898, depuis = '/voyage', client = createQueryClient(), moteur: f = moteurFactice(), routes = {} }: Options = {}) {
  const requetes = servir({
    'GET /api/auth/me': () => json(SESSION),
    [VOYAGE]: () => json(voyage),
    [TICKETS]: () => json({ tickets: [] }),
    ...routes,
  })
  render(
    <QueryClientProvider client={client}>
      <FabriqueMoteurContexte.Provider value={f.fabrique}>
        <MemoryRouter initialEntries={[depuis]}>
          <Temoin />
          <App />
        </MemoryRouter>
      </FabriqueMoteurContexte.Provider>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(f.etats.length).toBeGreaterThan(0))
  const calme = () => waitFor(() => expect(client.isFetching() + client.isMutating()).toBe(0))
  await calme()
  return { ...f, client, requetes, calme }
}
const toucher = (banc: { rappels: () => { aiguillage?: (cle: string) => void } }, cle = 'baraque') => act(async () => banc.rappels().aiguillage?.(cle))
const halte = () => screen.findByRole('dialog', { name: 'Halte de la baraque' })
const aucunDialogue = () => expect(screen.queryByRole('dialog')).toBeNull()
const inertes = () => screen.getByRole('heading', { level: 1, hidden: true }).parentElement!.querySelectorAll(':scope > [inert]').length
function retenue<T>() {
  let lacher!: (valeur: T) => void
  const promesse = new Promise<T>((fin) => (lacher = fin))
  return { promesse, lacher }
}

describe('la halte sur la carte, une clé sans défaut', () => {
  let remettre: Array<() => void> = []
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Au calme : la fête du rattrapage offre son choix sans attendre ses pas.
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
    localStorage.clear()
    sessionStorage.clear()
    rendus.mockClear()
  })
  afterEach(() => {
    remettre.forEach((r) => r())
    remettre = []
    vi.unstubAllGlobals()
  })
  const preter = (gabarits: Partial<HabillagePages['gabarits']> = { halteDeLaCarte: Dessin }) => {
    const avant = PAGES_1890.gabarits
    PAGES_1890.gabarits = { ...avant, ...gabarits }
    remettre.push(() => void (PAGES_1890.gabarits = avant))
  }

  // Décision 1 du propriétaire : 1900 seulement. Le vrai 1890 ne compose pas la clé : un aiguillage
  // qui dirait la clé d'une halte servie n'ouvre rien, et l'adresse qui la porte non plus. `servir`
  // refuse toute route qu'il ne nomme pas. Mutations : un dessin de repli à la place de
  // `gabaritSeul` (dans le geste, puis dans le rendu) ; l'adresse écrite sans regarder la clé.
  it('sans la clé, ni le toucher ni l’adresse n’ouvrent rien, et la carte de 1898 ne lit que la session, la carte et les tickets', async () => {
    const banc = await monter()
    await toucher(banc)
    aucunDialogue()
    expect(ou()).toBe('/voyage')
    expect(inertes()).toBe(0)
    expect([...banc.requetes].sort()).toEqual(['GET /api/auth/me', VOYAGE, TICKETS])
  })
  it('sans la clé, l’adresse qui porte une halte servie n’ouvre rien et la carte reste vivante', async () => {
    await monter({ depuis: '/voyage?halte=baraque' })
    aucunDialogue()
    expect(inertes()).toBe(0)
  })

  // Le bloc ne lit rien : tout vient de `GET /me/voyage`. Mutations : dans `Halte.tsx`, le compte en
  // dur (`{ vus: 2, total: 3 }`) ; la référence du bouton remplacée par une neuve (le focus reste au
  // document) ; dans `Carte.tsx`, `dialogueOuvert` rendu à `portiereOuverte` sur une enveloppe, puis
  // sur l'autre ; la halte prise par son rang au lieu de sa clé (`v.haltes[0]`).
  it('la clé prêtée : le toucher ouvre la halte servie, telle que servie, le compte sur ses films, le focus sur son bouton, la carte inerte dessous, sans rien lire', async () => {
    preter()
    const banc = await monter({ voyage: en(1898, [{ ...MELIES, apres: 1896 }, BARAQUE]) })
    await toucher(banc)
    const dialogue = await halte()
    expect(ou()).toBe('/voyage?halte=baraque')
    expect(screen.getByTestId('compte').textContent).toBe('1 sur 2')
    expect(within(dialogue).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Le Manoir du diable, 1896, vu, https://image.tmdb.org/t/p/w500/barbe-bleue.jpg, sans Plex',
      'La Fée aux choux, 1896, introuvable, sans affiche, sans Plex',
    ])
    expect(screen.getByRole('button', { name: 'Revenir' })).toHaveFocus()
    expect(inertes()).toBe(2)
    expect([...banc.requetes].sort()).toEqual(['GET /api/auth/me', VOYAGE, TICKETS])
  })

  // Aucun catalogue dans l'appli. Mutations : la garde `!halte` retirée du geste (l'adresse
  // porterait une clé que rien ne sert) ; le rendu qui prend la première halte quand la clé manque.
  it('une clé que le serveur ne sert pas n’ouvre rien, par le toucher comme par l’adresse', async () => {
    preter()
    const banc = await monter()
    await toucher(banc, 'melies')
    aucunDialogue()
    expect(ou()).toBe('/voyage')
    await act(async () => void adresse.aller!('/voyage?halte=melies'))
    aucunDialogue()
    expect(inertes()).toBe(0)
  })

  // Le levier bascule (correction du 9 octobre 2026) : la page dit au moteur quelle halte le dialogue
  // courant montre, par sa clé, et nulle dès qu'elle se referme. C'est le fait d'état que le dessin
  // lit ; le trait n'est pas regardé. Mutations : `halteOuverte={null}` passé au canvas (le levier
  // jamais basculé) ; la première halte servie au lieu de celle ouverte (`etat.haltes[0].cle` : le
  // levier d'une autre halte) ; la clé de l'adresse passée sans regarder le dialogue courant (une
  // halte qui attend derrière la vue d'ensemble basculerait son levier).
  describe('le levier de la halte ouverte', () => {
    const dits = (banc: Awaited<ReturnType<typeof monter>>) => vi.mocked(banc.moteur.reglerHalte).mock.calls.map((a) => a[0])
    it('fermée, aucune halte n’est dite au moteur ; ouverte, la sienne et pas une autre ; refermée, plus aucune', async () => {
      preter()
      const banc = await monter({ voyage: en(1898, [{ ...MELIES, apres: 1896 }, BARAQUE]) })
      expect(dits(banc)).toEqual([null])
      await toucher(banc)
      await halte()
      expect(dits(banc)).toEqual([null, 'baraque'])
      fireEvent.click(screen.getByRole('button', { name: 'Revenir' }))
      await waitFor(aucunDialogue)
      expect(dits(banc)).toEqual([null, 'baraque', null])
      await toucher(banc, 'melies')
      await screen.findByRole('dialog', { name: 'Halte Méliès' })
      expect(dits(banc)).toEqual([null, 'baraque', null, 'melies'])
    })
    it('une halte que l’adresse porte derrière la vue d’ensemble n’est pas dite : son levier attend comme elle', async () => {
      preter()
      const banc = await monter()
      await act(async () => banc.rappels().ensemble(true))
      await act(async () => void adresse.aller!('/voyage?halte=baraque'))
      aucunDialogue()
      expect(dits(banc)).toEqual([null])
      await act(async () => banc.rappels().ensemble(false))
      await halte()
      expect(dits(banc)).toEqual([null, 'baraque'])
    })
  })

  describe('le dialogue est dans l’adresse', () => {
    // Mutation : l'état gardé hors de l'adresse (`useState` à la place de `useCalque` : rien n'est
    // empilé, le retour quitte la carte ou ne fait rien, et le dialogue reste).
    it('le retour du téléphone le ferme, et l’on reste sur la carte', async () => {
      preter()
      const banc = await monter()
      await toucher(banc)
      await halte()
      await reculer()
      aucunDialogue()
      expect(ou()).toBe('/voyage')
      expect(inertes()).toBe(0)
    })

    // Le moteur ne dédoublonne pas. Mutation : la référence `halteEnRoute` retirée (deux entrées
    // d'historique : un retour laisse la halte ouverte).
    it('deux touchers avant le rendu n’ouvrent qu’une fois : un seul retour referme', async () => {
      preter()
      const banc = await monter()
      await act(async () => {
        banc.rappels().aiguillage?.('baraque')
        banc.rappels().aiguillage?.('baraque')
      })
      await halte()
      await reculer()
      aucunDialogue()
      expect(ou()).toBe('/voyage')
    })

    // Mutation : la référence jamais rendue (l'effet retiré) : refermée, la halte ne se rouvre plus.
    it('refermée par son bouton, elle se rouvre au toucher suivant ; Échap la referme aussi', async () => {
      preter()
      const banc = await monter()
      await toucher(banc)
      fireEvent.click(await screen.findByRole('button', { name: 'Revenir' }))
      await waitFor(aucunDialogue)
      expect(ou()).toBe('/voyage')
      await toucher(banc)
      await halte()
      fireEvent.keyDown(document, { key: 'Escape' })
      await waitFor(aucunDialogue)
      expect(ou()).toBe('/voyage')
    })

    // Mutation : `dialogueOuvert` rendu à `portiereOuverte` dans l'effet du focus.
    it('refermée, le focus tombé au document revient au titre de la carte', async () => {
      preter()
      const banc = await monter()
      await toucher(banc)
      fireEvent.click(await screen.findByRole('button', { name: 'Revenir' }))
      await waitFor(aucunDialogue)
      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    })

    it('l’adresse qui la porte l’ouvre à l’arrivée', async () => {
      preter()
      await monter({ depuis: '/voyage?halte=baraque' })
      await halte()
      expect(inertes()).toBe(2)
    })
  })

  describe('jamais par-dessus autre chose', () => {
    // L'appareil a montré 1897, mon année en cours est 1898 : la marche joue. Mutations : la garde
    // `pleinEcranOccupe` retirée du geste (le toucher ouvrirait pendant la marche : l'adresse le
    // dirait) ; `anneeAvatar === v.annee_en_cours` retiré de `halteOuverte` (le dialogue se poserait
    // sur l'avancée).
    it('pendant une avancée, le toucher n’ouvre rien et l’adresse attend ; elle finie, la halte de l’adresse s’ouvre', async () => {
      preter()
      localStorage.setItem(`journal.carte.annee-vue.${SESSION.user.id}`, '1897')
      const f = moteurFactice()
      const marche = retenue<void>()
      vi.mocked(f.moteur.marcher).mockImplementationOnce(() => marche.promesse)
      const banc = await monter({ moteur: f })
      await waitFor(() => expect(f.moteur.marcher).toHaveBeenCalledWith(1898))
      await toucher(banc)
      expect(ou()).toBe('/voyage')
      aucunDialogue()
      await act(async () => void adresse.aller!('/voyage?halte=baraque'))
      aucunDialogue()
      await act(async () => marche.lacher())
      await halte()
    })

    // Mutation : `date !== null` n'est tenu que par `pleinEcranOccupe` : la garde du geste retirée.
    it('l’affiche d’une date ouverte : le toucher n’ouvre rien', async () => {
      preter()
      const banc = await monter()
      act(() => banc.rappels().date({ an: 1895, x: 38, y: 112, court: '22 mars', lieu: 'Paris', titre: 'La première projection', jour: 'Vendredi 22 mars 1895', texte: 'Un texte.', image: null }))
      await toucher(banc)
      expect(ou()).toBe('/voyage')
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
    })

    // Mutations : `fete === null` retiré de `halteOuverte` (deux dialogues) ; `!feteAVenir` retiré
    // (la halte se monterait le temps du rendu qui décide la fête, et prendrait le focus : le
    // compte des rendus du dessin le voit, aucun dialogue ne reste pour le dire).
    it('pendant la fête du rattrapage, la halte de l’adresse attend ; la fête finie, elle s’ouvre', async () => {
      preter()
      const aMontrer: Voyage = { ...EN_1898, ticket_a_montrer: { annee: 1899, motif: 'Tu as fait le tour de 1898.', emis_le: '2026-09-21T21:00:00.000Z' } }
      await monter({ voyage: aMontrer, depuis: '/voyage?halte=baraque', routes: { [MONTRE]: () => new Response(null, { status: 204 }) } })
      expect(await screen.findByRole('dialog', { name: '1898 est bouclée' })).toBeInTheDocument()
      await act(async () => undefined)
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
      expect(rendus).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Le garder' }))
      await halte()
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
    })

    // L'ordre des dialogues (`ORDRE_DES_DIALOGUES`) : ce qui tient l'écran seul passe avant la halte,
    // même quand c'est l'adresse qui la porte (l'historique avancé), et pas seulement sous le toucher.
    // Le dessin prêté compte ses rendus : la halte ne se pose pas même le temps d'un rendu. Mutations,
    // une par ligne : le prétendant mis à faux dans `dialogueCourant` (`affiche`, `ensemble`,
    // `passage`, `apercu`) ; la halte rangée avant lui dans l'ordre.
    const DATE = { an: 1895, x: 38, y: 112, court: '22 mars', lieu: 'Paris', titre: 'La première projection', jour: 'Vendredi 22 mars 1895', texte: 'Un texte.', image: null }
    type R = ReturnType<Awaited<ReturnType<typeof monter>>['rappels']>
    it.each<[string, (r: R) => void, (r: R) => void]>([
      ['l’affiche d’une date', (r) => r.date(DATE), () => fireEvent.click(screen.getByRole('button', { name: 'Refermer' }))],
      ['la vue d’ensemble', (r) => r.ensemble(true), (r) => r.ensemble(false)],
      ['un passage que le moteur joue', (r) => r.passage!(true), (r) => r.passage!(false)],
      ['l’aperçu d’une année', (r) => r.apercu(1896, { x: 100, y: 200 }), (r) => r.finApercu()],
    ])('%s à l’écran : la halte que l’adresse reçoit attend, sans se poser un instant ; l’écran rendu, elle s’ouvre', async (_, prendre, rendre) => {
      preter()
      const banc = await monter()
      act(() => prendre(banc.rappels()))
      await act(async () => void adresse.aller!('/voyage?halte=baraque'))
      expect(ou()).toBe('/voyage?halte=baraque')
      expect(rendus).not.toHaveBeenCalled()
      expect(inertes()).toBe(0)
      act(() => rendre(banc.rappels()))
      await halte()
      expect(inertes()).toBe(2)
    })

    describe('le levier touché pendant que quelque chose passe', () => {
      const passer = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))
      const simuler = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      afterEach(() => vi.useRealTimers())
      const AUTRE: Halte = { ...BARAQUE, cle: 'autre', nom: 'Halte d’à côté', apres: 1896 }

      // La phrase de la roulotte tient 3,1 s. Mutations : la demande jamais retenue (le refus sec
      // d'avant : rien ne s'ouvre) ; l'effet qui l'ouvre retiré ; la halte ouverte sans attendre
      // (`passager` ôté du geste : l'adresse la dirait pendant la phrase).
      it('la phrase de la roulotte dite : le toucher n’ouvre rien sur le moment, et la halte s’ouvre quand la phrase s’efface', async () => {
        preter()
        const banc = await monter()
        simuler()
        act(() => banc.rappels().roulotte())
        await toucher(banc)
        await passer(3099)
        expect(ou()).toBe('/voyage')
        expect(rendus).not.toHaveBeenCalled()
        await passer(1)
        expect(ou()).toBe('/voyage?halte=baraque')
        expect(screen.getByRole('dialog', { name: 'Halte de la baraque' })).toBeInTheDocument()
        // Une seule entrée d'historique : un retour referme.
        await reculer()
        expect(ou()).toBe('/voyage')
        aucunDialogue()
      })

      // Mutations : la première demande gardée (`??=`) ; les deux ouvertes l'une sur l'autre.
      it('une seule demande est retenue, la dernière', async () => {
        preter()
        const banc = await monter({ voyage: en(1898, [AUTRE, BARAQUE]) })
        simuler()
        act(() => banc.rappels().roulotte())
        await toucher(banc, 'autre')
        await toucher(banc, 'baraque')
        await passer(3100)
        expect(ou()).toBe('/voyage?halte=baraque')
        await reculer()
        expect(ou()).toBe('/voyage')
      })

      // Entre-temps le membre a fait autre chose : la demande ne lui saute pas au visage plus tard.
      // Mutation : la demande gardée sous un dialogue courant (la ligne qui l'abandonne retirée).
      it('la vue d’ensemble ouverte puis refermée entre-temps : la demande est abandonnée', async () => {
        preter()
        const banc = await monter()
        simuler()
        act(() => banc.rappels().roulotte())
        await toucher(banc)
        act(() => banc.rappels().ensemble(true))
        act(() => banc.rappels().ensemble(false))
        await passer(3100)
        // La phrase est effacée, l'écran est libre : un toucher neuf ouvre, la demande d'avant non.
        expect(ou()).toBe('/voyage')
        expect(rendus).not.toHaveBeenCalled()
        await toucher(banc)
        expect(ou()).toBe('/voyage?halte=baraque')
      })

      // Le refus sec reste pour ce qui tient l'écran seul. Mutation : la clé retenue sous tout ce qui
      // occupe l'écran (`pleinEcranOccupe` à la place de `passager` : refermée, la vue d'ensemble
      // ouvrirait une halte touchée sous elle).
      it('sous la vue d’ensemble, le toucher est refusé net : refermée, rien ne s’ouvre', async () => {
        preter()
        const banc = await monter()
        act(() => banc.rappels().ensemble(true))
        await toucher(banc)
        act(() => banc.rappels().ensemble(false))
        await act(async () => undefined)
        expect(ou()).toBe('/voyage')
        expect(rendus).not.toHaveBeenCalled()
        // Le témoin : l'écran est bien rendu, un toucher neuf ouvre.
        await toucher(banc)
        expect(ou()).toBe('/voyage?halte=baraque')
      })
    })

    // La halte ouverte tient l'écran : le contrôleur, qui entre seul, attend qu'elle se referme.
    // Mutation : `dialogueOuvert` rendu à `portiereOuverte` dans `pleinEcranOccupe`.
    it('la halte ouverte, le contrôleur qui attend n’entre pas ; refermée, il entre', async () => {
      preter({ halteDeLaCarte: Dessin, controleurDeLaCarte: Portiere })
      const client = createQueryClient()
      client.setQueryData(cles.voyage, EN_1898)
      client.setQueryData(cles.tickets, { tickets: [] })
      client.setQueryData(cles.voyageur, IL_ATTEND)
      const banc = await monter({ depuis: '/voyage?halte=baraque', client, routes: { [LIRE]: () => json(IL_ATTEND), 'GET /api/me/journal?limit=20': () => json({ items: [], next_cursor: null }) } })
      await halte()
      await banc.calme()
      await act(async () => undefined)
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: 'Revenir' }))
      expect(await screen.findByRole('dialog', { name: 'Le contrôleur' })).toBeInTheDocument()
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
    })

    // La portière est entrée seule ; l'adresse reçoit ensuite une halte (l'historique avancé).
    // Mutation : `!portiereOuverte` retiré de `halteOuverte` (deux dialogues).
    it('la portière ouverte, la halte de l’adresse attend ; refermée, elle s’ouvre', async () => {
      preter({ halteDeLaCarte: Dessin, controleurDeLaCarte: Portiere })
      const banc = await monter({ routes: { [LIRE]: () => json(IL_ATTEND), 'GET /api/me/journal?limit=20': () => json({ items: [], next_cursor: null }) } })
      await screen.findByRole('dialog', { name: 'Le contrôleur' })
      await banc.calme()
      await act(async () => void adresse.aller!('/voyage?halte=baraque'))
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
      expect(screen.queryByTestId('compte')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Laisser' }))
      await halte()
    })
  })
})

// Le vrai 1900, sans rien prêter : son monde compose la clé, celui de 1890 non.
describe('la halte sur la carte de 1900', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  const jusqua = (enCours: number, fin = 1909): Voyage =>
    voyage1890(
      enCours,
      Array.from({ length: fin - 1895 + 1 }, (_, i) => 1895 + i).map((annee) =>
        annee < enCours
          ? { annee, statut: 'ouverte' as const, visitee: true, recompense: null, progression: null }
          : { annee, statut: annee === enCours ? ('en_cours' as const) : ('verrouillee' as const), visitee: false, recompense: null, progression: null, profondeur: 0 },
      ),
      { haltes: [MELIES] },
    )
  const ROUTES = { [LIRE]: () => json({ ...BASE, controleur: { attend: false, billet: null } }), 'GET /api/me/voyage/decennies/1900/etiquettes': () => json(malleVide(1900)), 'GET /api/me/voyage/cartes-postales': () => json(COURRIER_VIDE) }

  // Un membre sorti de la décennie n'ouvre plus la halte (décision du propriétaire, 9 octobre 2026 ;
  // ce test tenait l'inverse, « rendu en 1910 elle s'ouvre encore » : la règle a changé). La ligne de
  // 1900 est toujours à l'écran, mais sa halte n'est plus passée au moteur (ni levier ni poteau, donc
  // rien à toucher), et ni un rappel `aiguillage` qui dirait encore sa clé ni l'adresse ne l'ouvrent.
  // Mutations : `halteEnService` retirée du filtre de `etat.haltes` (les trois tombent) ; la garde du
  // toucher seule (`ouvrirLaHalte` lisant `v.haltes` : l'adresse est écrite) ; la garde de l'adresse
  // seule (`halteDemandee` lisant `v.haltes` : le dialogue s'ouvre) ; la borne décalée d'un an
  // (`decennieDe(anneeEnCours - 1)`).
  it('rendu en 1910, la halte de la ligne de 1900 ne s’ouvre plus, ni par le toucher ni par l’adresse, et le moteur ne la reçoit plus', async () => {
    const banc = await monter({ voyage: jusqua(1910, 1910), routes: ROUTES })
    expect(banc.etats[banc.etats.length - 1]!.haltes).toEqual([])
    await toucher(banc, 'melies')
    aucunDialogue()
    expect(ou()).toBe('/voyage')
    await act(async () => void adresse.aller!('/voyage?halte=melies'))
    aucunDialogue()
    expect(inertes()).toBe(0)
  })
  it('arrivé en 1910 avec la halte dans l’adresse, rien ne s’ouvre non plus', async () => {
    await monter({ voyage: jusqua(1910, 1910), routes: ROUTES, depuis: '/voyage?halte=melies' })
    aucunDialogue()
    expect(inertes()).toBe(0)
  })

  // La dernière année de la décennie en est encore. Mutation : la borne décalée d'un an dans l'autre
  // sens (`decennieDe(anneeEnCours + 1)` : fermée dès 1909).
  it('en 1909, la halte s’ouvre toujours, par le toucher comme par l’adresse, et le moteur la reçoit', async () => {
    const banc = await monter({ voyage: jusqua(1909), routes: ROUTES })
    expect(banc.etats[banc.etats.length - 1]!.haltes).toEqual([{ cle: 'melies', nom: 'Halte Méliès', apres: 1902, vus: 1, total: 3 }])
    await toucher(banc, 'melies')
    expect(await screen.findByRole('dialog', { name: 'Halte Méliès' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Revenir sur la ligne' }))
    await waitFor(aucunDialogue)
    await act(async () => void adresse.aller!('/voyage?halte=melies'))
    expect(await screen.findByRole('dialog', { name: 'Halte Méliès' })).toBeInTheDocument()
  })

  // L'adresse n'ouvre que la halte que le toucher pourrait ouvrir : tant que la gare de 1902 est une
  // plaque à développer (je suis en 1900 ou en 1901), le monde ne dessine ni levier ni poteau, et
  // `?halte=melies` n'ouvre rien non plus. La page ne passe pas la halte au moteur : le toucher et
  // l'adresse lisent `etat.haltes`, la gare fermée s'y lit par `estFermee`, la règle de la plaque.
  // Mutations : `halteOfferte` sans sa garde `estFermee` (les trois tombent) ; `halteDemandee` lisant
  // `v.haltes` (l'adresse ouvre).
  it.each([1900, 1901])('en %i, la gare de 1902 à développer : l’adresse n’ouvre pas sa halte, le toucher non plus, et le moteur ne la reçoit pas', async (enCours) => {
    const banc = await monter({ voyage: jusqua(enCours), routes: ROUTES, depuis: '/voyage?halte=melies' })
    aucunDialogue()
    expect(inertes()).toBe(0)
    await toucher(banc, 'melies')
    aucunDialogue()
    expect(ou()).toBe('/voyage?halte=melies')
    expect(banc.etats[banc.etats.length - 1]!.haltes).toEqual([])
  })

  // La gare développée, dès l'année de l'embranchement : l'adresse ouvre toujours. Mutation :
  // `halteOfferte` toujours fausse (ce test, et ceux de 1903 et de 1909, tombent).
  it('en 1902, la gare développée : l’adresse ouvre la halte à l’arrivée, et le moteur la reçoit', async () => {
    const banc = await monter({ voyage: jusqua(1902), routes: ROUTES, depuis: '/voyage?halte=melies' })
    expect(banc.etats[banc.etats.length - 1]!.haltes).toEqual([{ cle: 'melies', nom: 'Halte Méliès', apres: 1902, vus: 1, total: 3 }])
    expect(await screen.findByRole('dialog', { name: 'Halte Méliès' })).toBeInTheDocument()
  })

  // Mutation : `halteDeLaCarte` retirée de `PAGES_1900`.
  it('en 1903, l’aiguillage touché ouvre la Halte Méliès telle que servie : son compte, ses trois films, sans rien lire de plus', async () => {
    const banc = await monter({ voyage: jusqua(1903), routes: ROUTES })
    const avant = [...banc.requetes]
    await toucher(banc, 'melies')
    const dialogue = await screen.findByRole('dialog', { name: 'Halte Méliès' })
    expect(ou()).toBe('/voyage?halte=melies')
    expect(dialogue).toHaveTextContent('Halte · 3 films')
    expect(dialogue).toHaveTextContent('1 sur 3')
    expect(within(dialogue).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Revenir sur la ligne' })).toHaveFocus()
    expect(banc.requetes).toEqual(avant)
  })

  // En gare de 1902, le parapluie et le levier sont sur le même écran : ramasser l'objet occupe
  // l'écran le temps de l'écriture, puis de son message (trois secondes). Le levier touché entre-temps
  // n'est pas jeté. Promesse retenue, minuteries simulées. Mutations : `ramasser.isPending` ou
  // `message !== null` rangés avec ce qui refuse net ; la demande ouverte dès la réponse, sous le message.
  it('en 1903, le levier touché pendant le ramassage du parapluie ouvre la halte quand son message s’efface', async () => {
    const RAMASSER = 'POST /api/me/voyage/objets/parapluie/ramasser'
    const reponse = retenue<Response>()
    const banc = await monter({
      voyage: jusqua(1903),
      routes: { ...ROUTES, [LIRE]: () => json({ ...BASE, objets: [], controleur: { attend: false, billet: null } }), [RAMASSER]: () => reponse.promesse },
    })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const passer = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))
      act(() => banc.rappels().objet!('parapluie', { x: 100, y: 300 }))
      await passer(0)
      expect(banc.requetes).toContain(RAMASSER)
      await toucher(banc, 'melies')
      expect(ou()).toBe('/voyage')
      await act(async () => reponse.lacher(json({ cle: 'parapluie', annee: 1902, ramasse_le: '2026-10-08T10:00:00.000Z' })))
      await passer(1)
      expect(screen.getByText('Objet trouvé 1 sur 10')).toBeInTheDocument()
      await passer(2990)
      expect(ou()).toBe('/voyage')
      aucunDialogue()
      await passer(20)
      expect(ou()).toBe('/voyage?halte=melies')
      expect(screen.getByRole('dialog', { name: 'Halte Méliès' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  // 1900 est caché à qui est en 1899 : la halte que le serveur servirait quand même n'a pas de
  // tronçon à l'écran, et l'adresse qui la porte n'ouvre rien. Mutation : `etat.haltes` (les haltes
  // montrées) remplacé par `v.haltes` dans `halteDemandee`.
  it('en 1899, la halte servie d’une décennie cachée ne s’ouvre pas, même portée par l’adresse, et la carte ne lit que la session, la carte et les tickets', async () => {
    const banc = await monter({ voyage: jusqua(1899), depuis: '/voyage?halte=melies' })
    await toucher(banc, 'melies')
    aucunDialogue()
    expect(inertes()).toBe(0)
    expect([...banc.requetes].sort()).toEqual(['GET /api/auth/me', VOYAGE, TICKETS])
  })
})

