import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import Formulaire from './Formulaire'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import { visionnage } from '../test/journal'
import type { CandidatFilm } from '../formulaire/candidat'
import type { AddMediaResponse, JournalItem, JournalPage } from '../api/journal'
import type { ReactionsCatalogue } from '../api/reactions'
import type { Stats } from '../api/stats'

const CATALOGUE = exemple<ReactionsCatalogue>('/reference/reactions', 'get', 200)
const ITEM = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!
const MEDIA = exemple<AddMediaResponse>('/media', 'post', 201)
const CANDIDAT: CandidatFilm = {
  source: 'tmdb',
  external_id: '27205',
  title: 'Inception',
  year: 2010,
  cover_url: 'https://image.tmdb.org/t/p/w500/9gk7adZmeSSuQfZBtWWLIcVcSY.jpg',
  director: 'Christopher Nolan',
}

function monterCreation(client = createQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/journal/nouveau', state: { candidat: CANDIDAT } }]}>
        <Routes>
          <Route path="/journal/nouveau" element={<Formulaire />} />
          <Route path="/" element={<p>Accueil</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function monterCorrection(item: JournalItem = ITEM, client = createQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: `/journal/${item.entry.id}/corriger`, state: { item } }]}>
        <Routes>
          <Route path="/journal/:id/corriger" element={<Formulaire />} />
          <Route path="/" element={<p>Accueil</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('le formulaire, en création', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('appelle les deux routes dans l’ordre : le média, puis le journal', async () => {
    const requetes = servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      'POST /api/media': () => json(MEDIA, 201),
      'POST /api/me/journal': (init) =>
        json(
          { ...exemple<JournalItem>('/me/journal', 'post', 201), media_id: JSON.parse(String(init.body)).media_id },
          201,
        ),
    })
    monterCreation()

    await screen.findByText('Inception')
    fireEvent.click(screen.getByRole('button', { name: 'Rendre mon papier' }))

    await screen.findByText('Accueil')
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual(['POST /api/media', 'POST /api/me/journal'])
  })

  it('envoie au journal ce que porte le formulaire : la note, les réactions, la remarque', async () => {
    let corps: Record<string, unknown> | undefined
    servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      'POST /api/media': () => json(MEDIA, 201),
      'POST /api/me/journal': (init) => {
        corps = JSON.parse(String(init.body)) as Record<string, unknown>
        return json(exemple<JournalItem>('/me/journal', 'post', 201), 201)
      },
    })
    monterCreation()
    const reaction = CATALOGUE.reactions[0]!
    await screen.findByRole('button', { name: `${reaction.emoji} ${reaction.phrase}` })

    fireEvent.change(screen.getByLabelText('Séance du'), { target: { value: '2026-09-20' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Note 7 sur 10' }))
    fireEvent.click(screen.getByRole('button', { name: `${reaction.emoji} ${reaction.phrase}` }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Revu en salle.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rendre mon papier' }))

    await screen.findByText('Accueil')
    // Mutation : un champ du brouillon oublié dans `creerVisionnage` (la note, les réactions, la
    // remarque) ou la remarque envoyée sans `trim()` fait tomber cette égalité.
    expect(corps).toEqual({
      media_id: MEDIA.media.id,
      finished_at: '2026-09-20',
      rating: 7,
      reactions: [reaction.cle],
      comment: 'Revu en salle.',
    })
  })

  it('n’envoie ni réactions ni remarque quand il n’y en a pas', async () => {
    let corps: Record<string, unknown> | undefined
    servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      'POST /api/media': () => json(MEDIA, 201),
      'POST /api/me/journal': (init) => {
        corps = JSON.parse(String(init.body)) as Record<string, unknown>
        return json(exemple<JournalItem>('/me/journal', 'post', 201), 201)
      },
    })
    monterCreation()
    await screen.findByText('Inception')

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rendre mon papier' }))

    await screen.findByText('Accueil')
    // Mutation : une remarque blanche envoyée telle quelle poserait un carnet vide mais non nul.
    expect(corps).not.toHaveProperty('comment')
    expect(corps).not.toHaveProperty('reactions')
    expect(corps).toHaveProperty('rating', null)
  })

  it('date du jour du téléphone, et ne permet pas de choisir demain', async () => {
    // 0 h 30 à Paris, encore la veille à Greenwich (fuseau figé dans `vite.config.ts`).
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 30, 0, 30))
    servir({ 'GET /api/reference/reactions': () => json(CATALOGUE) })
    monterCreation()
    await screen.findByText('Inception')

    const date = screen.getByLabelText('Séance du')
    // Mutation, sur l'un ou l'autre site : `toISOString().slice(0, 10)` rend '2026-09-29'.
    expect(date).toHaveValue('2026-09-30')
    expect(date).toHaveAttribute('max', '2026-09-30')
  })

  it('sans film choisi (accès direct), renvoie vers la recherche plutôt que de planter', () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/journal/nouveau']}>
          <Routes>
            <Route path="/journal/nouveau" element={<Formulaire />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByRole('link', { name: 'Retour à la recherche' })).toHaveAttribute('href', '/recherche')
  })

  it('affiche une erreur de l’API telle quelle', async () => {
    const message = 'Le commentaire dépasse la longueur autorisée.'
    servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      'POST /api/media': () => json(MEDIA, 201),
      'POST /api/me/journal': () => json({ code: 'VALIDATION', message, retryable: false }, 400),
    })
    monterCreation()

    await screen.findByText('Inception')
    fireEvent.click(screen.getByRole('button', { name: 'Rendre mon papier' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('la note se coche puis se décoche — jamais de valeur hors 1 à 10', async () => {
    servir({ 'GET /api/reference/reactions': () => json(CATALOGUE) })
    monterCreation()
    await screen.findByText('Inception')

    const note8 = screen.getByRole('radio', { name: 'Note 8 sur 10' })
    fireEvent.click(note8)
    expect(note8).toHaveAttribute('aria-checked', 'true')

    // Mutation : sans le bascule (même clé décoche), la note resterait bloquée sur 8 pour toujours.
    fireEvent.click(note8)
    expect(note8).toHaveAttribute('aria-checked', 'false')
    for (let n = 1; n <= 10; n += 1) {
      expect(screen.getByRole('radio', { name: `Note ${n} sur 10` })).toHaveAttribute('aria-checked', 'false')
    }
  })

  it('les réactions se plafonnent à 12, la treizième n’a plus d’effet', async () => {
    servir({ 'GET /api/reference/reactions': () => json(CATALOGUE) })
    monterCreation()
    const premiere = CATALOGUE.reactions[0]!
    await screen.findByRole('button', { name: `${premiere.emoji} ${premiere.phrase}` })
    // Trois réactions d'emblée : pour les poser toutes, il faut déplier le reste.
    fireEvent.click(screen.getByRole('button', { name: '+ 10 autres' }))

    for (const r of CATALOGUE.reactions) {
      fireEvent.click(screen.getByRole('button', { name: `${r.emoji} ${r.phrase}` }))
    }

    const cochees = CATALOGUE.reactions.filter(
      (r) => screen.getByRole('button', { name: `${r.emoji} ${r.phrase}` }).getAttribute('aria-pressed') === 'true',
    )
    expect(CATALOGUE.reactions.length).toBe(13)
    expect(cochees).toHaveLength(12)
  })
})

describe('le formulaire, en correction', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('ne corrige que ce qui a changé', async () => {
    let corpsEnvoye: unknown
    servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      [`PATCH /api/me/journal/${ITEM.entry.id}`]: (init) => {
        corpsEnvoye = JSON.parse(String(init.body))
        return json(ITEM)
      },
    })
    monterCorrection()
    await screen.findByText(ITEM.media.title)

    // Seule la note change.
    const nouvelleNote = ITEM.entry.rating === 10 ? 1 : (ITEM.entry.rating ?? 0) + 1
    fireEvent.click(screen.getByRole('radio', { name: `Note ${nouvelleNote} sur 10` }))
    fireEvent.click(screen.getByRole('button', { name: 'Corriger mon papier' }))

    await screen.findByText('Accueil')
    expect(corpsEnvoye).toEqual({ rating: nouvelleNote })
  })

  it('affiche une erreur de la correction telle quelle, sans quitter la page', async () => {
    const message = 'Ce visionnage n’existe plus.'
    servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      [`PATCH /api/me/journal/${ITEM.entry.id}`]: () => json({ code: 'NOT_FOUND', message, retryable: false }, 404),
    })
    monterCorrection()
    await screen.findByText(ITEM.media.title)

    fireEvent.click(screen.getByRole('button', { name: 'Corriger mon papier' }))

    // Mutation : une erreur lue sur la seule mutation de création (`creation.error`) resterait muette ici.
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByText('Accueil')).not.toBeInTheDocument()
  })

  it('affiche une erreur de la suppression telle quelle, sans quitter la page', async () => {
    const message = 'Ce visionnage n’existe plus.'
    servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      [`DELETE /api/me/journal/${ITEM.entry.id}`]: () => json({ code: 'NOT_FOUND', message, retryable: false }, 404),
    })
    monterCorrection()
    await screen.findByText(ITEM.media.title)

    fireEvent.click(screen.getByRole('button', { name: 'Déchirer ce billet' }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    // Mutation : sans l'alerte de la confirmation, un échec de suppression ne se disait nulle part.
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByText('Accueil')).not.toBeInTheDocument()
  })

  it('sans entrée (rechargement direct), renvoie vers l’accueil plutôt que de planter', () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[`/journal/${ITEM.entry.id}/corriger`]}>
          <Routes>
            <Route path="/journal/:id/corriger" element={<Formulaire />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/')
  })

  it('exige une confirmation avant de supprimer — jamais `confirm()`', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const requetes = servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      [`DELETE /api/me/journal/${ITEM.entry.id}`]: () => new Response(null, { status: 204 }),
    })
    monterCorrection()
    await screen.findByText(ITEM.media.title)

    fireEvent.click(screen.getByRole('button', { name: 'Déchirer ce billet' }))
    // Mutation : sans la confirmation en page, ce premier clic supprimerait déjà.
    expect(requetes.filter((r) => r.startsWith('DELETE'))).toHaveLength(0)
    expect(confirmSpy).not.toHaveBeenCalled()

    // Le bouton d'origine a cédé la place à celui de la confirmation, en page — un seul « Supprimer » à l'écran.
    expect(screen.getAllByRole('button', { name: 'Supprimer' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    await screen.findByText('Accueil')
    expect(requetes.filter((r) => r.startsWith('DELETE'))).toHaveLength(1)
    expect(confirmSpy).not.toHaveBeenCalled()
  })
})

/** Le nom accessible d'une réaction du catalogue, comme un tampon l'écrit. */
const nomDe = (cle: string) => {
  const r = CATALOGUE.reactions.find((reaction) => reaction.cle === cle)!
  return `${r.emoji} ${r.phrase}`
}
const stats = (total: number) =>
  ({ dashboard: { periods: { all: { counts: { finished_by_type: { movie: total } } } } } }) as unknown as Stats
/** Le journal de l'accueil, déjà en cache : une page, ses entrées, sans suite. */
const journalEnCache = (client: ReturnType<typeof createQueryClient>, items: JournalItem[], suite: string | null = null) =>
  client.setQueryData(cles.journal, { pages: [{ items, next_cursor: suite }], pageParams: [undefined] })
/** Inception (`CANDIDAT`) déjà vu : l'entrée d'exemple du contrat porte le même `external_id`. */
const dejaVu = (jour: string, note: number | null): JournalItem => ({
  ...ITEM,
  entry: { ...ITEM.entry, finished_at: jour, rating: note },
})

describe('le billet du critique', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  const servirLeCatalogue = () => servir({ 'GET /api/reference/reactions': () => json(CATALOGUE) })

  it('est un billet de presse : « Presse » et « Projection » en tête', async () => {
    servirLeCatalogue()
    monterCreation()
    await screen.findByText('Inception')

    expect(screen.getByText('Presse')).toBeInTheDocument()
    expect(screen.getByText('Projection', { exact: false })).toBeInTheDocument()
  })

  it('ne fait aucun appel de plus que le catalogue des réactions', async () => {
    const requetes = servirLeCatalogue()
    monterCreation()
    await screen.findByText('Inception')
    await screen.findByRole('button', { name: nomDe('adore') })

    // Mutation : une lecture du journal ou des stats ajoutée au billet.
    expect(requetes).toEqual(['GET /api/reference/reactions'])
  })

  describe('son numéro', () => {
    it('est le total du journal, d’après les stats déjà en cache, plus un', async () => {
      servirLeCatalogue()
      const client = createQueryClient()
      client.setQueryData(cles.stats, stats(412))
      monterCreation(client)

      // Mutation : le total lu sans `+ 1`, ou sans les quatre chiffres.
      expect(await screen.findByText('N° 0413')).toBeInTheDocument()
    })

    it('manque quand les stats ne sont pas en cache : il n’en demande pas', async () => {
      servirLeCatalogue()
      monterCreation()
      await screen.findByText('Inception')

      expect(screen.queryByText(/^N° /)).toBeNull()
    })

    it('manque quand les stats sont périmées : le journal a bougé depuis', async () => {
      servirLeCatalogue()
      const client = createQueryClient()
      client.setQueryData(cles.stats, stats(412))
      void client.invalidateQueries({ queryKey: cles.stats })
      monterCreation(client)
      await screen.findByText('Inception')

      expect(screen.queryByText(/^N° /)).toBeNull()
    })

    it('manque en correction : le billet existe déjà', async () => {
      servirLeCatalogue()
      const client = createQueryClient()
      client.setQueryData(cles.stats, stats(412))
      monterCorrection(ITEM, client)
      await screen.findByText(ITEM.media.title)

      expect(screen.queryByText(/^N° /)).toBeNull()
    })
  })

  describe('le rappel d’une séance passée', () => {
    it('dit le jour et la note de la dernière séance, et que la prochaine sera la deuxième', async () => {
      servirLeCatalogue()
      const client = createQueryClient()
      journalEnCache(client, [dejaVu('2024-03-14', 9)])
      monterCreation(client)

      // Mutation : la date ou la note retirée du rappel, ou « 2ᵉ » écrit en dur d'un autre rang.
      expect(await screen.findByText('Déjà vu le 14 mars 2024, noté 9. Ce sera une 2ᵉ séance.')).toBeInTheDocument()
    })

    it('omet la note quand la séance passée n’en avait pas', async () => {
      servirLeCatalogue()
      const client = createQueryClient()
      journalEnCache(client, [dejaVu('2024-03-14', null)])
      monterCreation(client)

      expect(await screen.findByText('Déjà vu le 14 mars 2024. Ce sera une 2ᵉ séance.')).toBeInTheDocument()
    })

    it('compte les séances d’avant : la troisième, quand le film a déjà été vu deux fois', async () => {
      servirLeCatalogue()
      const client = createQueryClient()
      journalEnCache(client, [dejaVu('2025-01-02', 7), dejaVu('2024-03-14', 9)])
      monterCreation(client)

      expect(await screen.findByText('Déjà vu le 2 janvier 2025, noté 7. Ce sera une 3ᵉ séance.')).toBeInTheDocument()
    })

    it('ne dit rien d’un film que le journal en cache ne connaît pas', async () => {
      servirLeCatalogue()
      const client = createQueryClient()
      journalEnCache(client, [{ ...dejaVu('2024-03-14', 9), media: { ...ITEM.media, external_id: 'autre' } }])
      monterCreation(client)
      await screen.findByText('Inception')

      expect(screen.queryByText(/Déjà vu/)).toBeNull()
    })

    it('ne dit rien d’un journal en cache que l’écriture d’un visionnage a déjà périmé', async () => {
      servirLeCatalogue()
      const client = createQueryClient()
      journalEnCache(client, [dejaVu('2024-03-14', 9)])
      void client.invalidateQueries({ queryKey: cles.journal })
      monterCreation(client)
      await screen.findByText('Inception')

      expect(screen.queryByText(/Déjà vu/)).toBeNull()
    })

    it('ne dit rien en correction : la séance qu’on corrige est celle du journal', async () => {
      servirLeCatalogue()
      const client = createQueryClient()
      journalEnCache(client, [ITEM])
      monterCorrection(ITEM, client)
      await screen.findByText(ITEM.media.title)

      expect(screen.queryByText(/Déjà vu/)).toBeNull()
    })
  })

  describe('son avis', () => {
    it('écrit le verdict et la note au crayon, et le retire quand la note se décoche', async () => {
      servirLeCatalogue()
      monterCreation()
      await screen.findByText('Inception')
      expect(screen.queryByText(/\/10$/)).toBeNull()

      fireEvent.click(screen.getByRole('radio', { name: 'Note 8 sur 10' }))
      // Mutation : le verdict d'un autre rang (note - 1), ou la note sans son verdict.
      expect(screen.getByText('Très bien · 8/10')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('radio', { name: 'Note 8 sur 10' }))
      expect(screen.queryByText('Très bien · 8/10')).toBeNull()
    })

    it('garde les dix notes d’un radiogroupe nommé « Note sur 10 »', async () => {
      servirLeCatalogue()
      monterCreation()
      await screen.findByText('Inception')

      const groupe = screen.getByRole('radiogroup', { name: 'Note sur 10' })
      expect(within(groupe).getAllByRole('radio')).toHaveLength(10)
    })
  })

  describe('ses réactions', () => {
    const posees = (...lots: string[][]) => lots.map((reactions, rang) => visionnage({ id: `v${rang}`, date: '2026-09-01', reactions }))

    it('ne montrent d’abord que les trois les plus posées du journal en cache, le reste replié', async () => {
      servirLeCatalogue()
      const client = createQueryClient()
      journalEnCache(client, posees(['visuel', 'en_salle', 'touche'], ['visuel', 'en_salle'], ['visuel', 'nul']))
      monterCreation(client)

      // Mutation : le classement ignoré (les trois premières du catalogue), ou une quatrième montrée.
      await screen.findByRole('button', { name: nomDe('visuel') })
      const montrees = CATALOGUE.reactions.filter((r) => screen.queryByRole('button', { name: nomDe(r.cle) }))
      // « visuel » trois fois, « en_salle » deux, puis « nul » et « touche » à égalité : l'ordre du catalogue les départage.
      expect(montrees.map((r) => r.cle)).toEqual(['nul', 'visuel', 'en_salle'])
      expect(screen.getByRole('button', { name: '+ 10 autres' })).toBeInTheDocument()
    })

    it('à défaut de journal en cache, montrent les trois premières du catalogue', async () => {
      servirLeCatalogue()
      monterCreation()

      await screen.findByRole('button', { name: nomDe('adore') })
      const montrees = CATALOGUE.reactions.filter((r) => screen.queryByRole('button', { name: nomDe(r.cle) }))
      expect(montrees.map((r) => r.cle)).toEqual(['adore', 'sympa', 'nul'])
    })

    it('classent aussi d’après un journal en cache déjà périmé', async () => {
      servirLeCatalogue()
      const client = createQueryClient()
      journalEnCache(client, posees(['en_salle'], ['en_salle'], ['visuel'], ['touche']))
      void client.invalidateQueries({ queryKey: cles.journal })
      monterCreation(client)

      await screen.findByRole('button', { name: nomDe('en_salle') })
      expect(screen.getByRole('button', { name: nomDe('visuel') })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: nomDe('adore') })).toBeNull()
    })

    it('gardent visible une réaction cochée qui n’est pas parmi les trois, même replié', async () => {
      servirLeCatalogue()
      monterCreation()
      await screen.findByRole('button', { name: nomDe('adore') })
      fireEvent.click(screen.getByRole('button', { name: '+ 10 autres' }))
      fireEvent.click(screen.getByRole('button', { name: nomDe('flippe') }))

      fireEvent.click(screen.getByRole('button', { name: '− replier' }))

      // Mutation : le repli qui cache aussi les réactions cochées.
      expect(screen.getByRole('button', { name: nomDe('flippe') })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.queryByRole('button', { name: nomDe('long') })).toBeNull()
      expect(screen.getByRole('button', { name: '+ 9 autres' })).toBeInTheDocument()
    })

    it('se déplient d’un bouton « + 10 autres » et se replient d’un « − replier »', async () => {
      servirLeCatalogue()
      monterCreation()
      await screen.findByRole('button', { name: nomDe('adore') })
      expect(screen.queryByRole('button', { name: nomDe('long') })).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: '+ 10 autres' }))
      expect(screen.getByRole('button', { name: nomDe('long') })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^\+ / })).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: '− replier' }))
      expect(screen.queryByRole('button', { name: nomDe('long') })).toBeNull()
    })

    it('comptent celles qui sont choisies', async () => {
      servirLeCatalogue()
      monterCreation()
      await screen.findByRole('button', { name: nomDe('adore') })
      expect(screen.queryByText('1 choisie')).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: nomDe('adore') }))
      expect(screen.getByText('1 choisie')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: nomDe('sympa') }))
      expect(screen.getByText('2 choisies')).toBeInTheDocument()
    })
  })

  it('écrit la remarque dans « Mes notes », rien qu’à toi', async () => {
    servirLeCatalogue()
    monterCreation()
    await screen.findByText('Inception')

    expect(screen.getByText('rien qu’à toi')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Mes notes/), { target: { value: 'Une claque.' } })
    expect(screen.getByRole('textbox')).toHaveValue('Une claque.')
  })

  it('nomme son bouton « Rendre mon papier » en création et « Corriger mon papier » en correction', async () => {
    servirLeCatalogue()
    const { unmount } = monterCreation()
    await screen.findByText('Inception')
    expect(screen.getByRole('button', { name: 'Rendre mon papier' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Déchirer ce billet' })).toBeNull()
    unmount()

    monterCorrection()
    await screen.findByText(ITEM.media.title)
    expect(screen.getByRole('button', { name: 'Corriger mon papier' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Déchirer ce billet' })).toBeInTheDocument()
  })
})

/**
 * « Tes séances » (Au ciné) a sa propre clé, `cles.seances` : une écriture du formulaire qui ne la
 * marquerait pas périmée laisserait l'onglet montrer une séance supprimée, ou taire la nouvelle,
 * jusqu'à la fin de son `staleTime`. Mutation : sortir `cles.seances` du préfixe `cles.journal`
 * (`['seances']`), sans l'invalider à part dans `apresEcriture`, casse ces trois assertions.
 */
describe('le formulaire, après une écriture, périme « Tes séances »', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  const avecSeances = () => {
    const client = createQueryClient()
    client.setQueryData(cles.seances, { pages: [{ items: [ITEM], next_cursor: null }], pageParams: [undefined] })
    // Jumeaux de « Tes séances » : les filmographies et sagas suivies portent aussi le « vu ».
    client.setQueryData(cles.pageRealisateur(525), { films: [] })
    client.setQueryData(cles.filmsSaga(8091), { films: [] })
    expect(client.getQueryState(cles.seances)?.isInvalidated).toBe(false)
    return client
  }
  /** Mutation : retirer `cles.realisateurs` ou `cles.sagas` d'`apresEcriture` casse ces trois tests. */
  const suivisPerimes = (client: ReturnType<typeof createQueryClient>) => {
    expect(client.getQueryState(cles.pageRealisateur(525))?.isInvalidated).toBe(true)
    expect(client.getQueryState(cles.filmsSaga(8091))?.isInvalidated).toBe(true)
  }

  it('après une création', async () => {
    servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      'POST /api/media': () => json(MEDIA, 201),
      'POST /api/me/journal': () => json(exemple<JournalItem>('/me/journal', 'post', 201), 201),
    })
    const client = avecSeances()
    monterCreation(client)

    await screen.findByText('Inception')
    fireEvent.click(screen.getByRole('button', { name: 'Rendre mon papier' }))

    await screen.findByText('Accueil')
    expect(client.getQueryState(cles.seances)?.isInvalidated).toBe(true)
    suivisPerimes(client)
  })

  it('après une correction', async () => {
    servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      [`PATCH /api/me/journal/${ITEM.entry.id}`]: () => json(ITEM),
    })
    const client = avecSeances()
    monterCorrection(ITEM, client)
    await screen.findByText(ITEM.media.title)

    const nouvelleNote = ITEM.entry.rating === 10 ? 1 : (ITEM.entry.rating ?? 0) + 1
    fireEvent.click(screen.getByRole('radio', { name: `Note ${nouvelleNote} sur 10` }))
    fireEvent.click(screen.getByRole('button', { name: 'Corriger mon papier' }))

    await screen.findByText('Accueil')
    expect(client.getQueryState(cles.seances)?.isInvalidated).toBe(true)
    suivisPerimes(client)
  })

  it('après une suppression', async () => {
    servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      [`DELETE /api/me/journal/${ITEM.entry.id}`]: () => new Response(null, { status: 204 }),
    })
    const client = avecSeances()
    monterCorrection(ITEM, client)
    await screen.findByText(ITEM.media.title)

    fireEvent.click(screen.getByRole('button', { name: 'Déchirer ce billet' }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    await screen.findByText('Accueil')
    expect(client.getQueryState(cles.seances)?.isInvalidated).toBe(true)
    suivisPerimes(client)
  })
})
