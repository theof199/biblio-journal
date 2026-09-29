import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import Formulaire from './Formulaire'
import { createQueryClient } from '../api/queryClient'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import type { CandidatFilm } from '../formulaire/candidat'
import type { AddMediaResponse, JournalItem, JournalPage } from '../api/journal'
import type { ReactionsCatalogue } from '../api/reactions'

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
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

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

    fireEvent.change(screen.getByLabelText('Vu le'), { target: { value: '2026-09-20' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Note 7 sur 10' }))
    fireEvent.click(screen.getByRole('button', { name: `${reaction.emoji} ${reaction.phrase}` }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Revu en salle.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

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

    const date = screen.getByLabelText('Vu le')
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
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'Corriger' }))

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

    fireEvent.click(screen.getByRole('button', { name: 'Corriger' }))

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

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
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

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
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
