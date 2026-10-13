import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { DUREE_DU_RETOUR, fournirLeRetourDuVu, type EpisodeCoche } from '../retourDuVu'
import VueTelecommande, { type EtatDeLEcran, type PropsVueTelecommande } from './VueTelecommande'
import type { Vue } from './vues'

const DARK = { id: 'm-dark', titre: 'Dark', affiche: null, episode: { saison: 2, numero: 5, titre: 'Perdus et retrouvés' }, quand: 'Regardée hier soir' }
const SERIE: EtatDeLEcran = { etat: 'serie', serie: DARK, rang: 1, sur: 4 }
const INVITATION: EtatDeLEcran = {
  etat: 'invitation',
  invitation: { id: 'i1', de: 'Alycia', couleur: '#c2571a', serie: 'Dark', episode: { saison: 2, numero: 5, titre: null }, quand: 'Proposé hier soir' },
  sur: 4,
}
const COCHE: EpisodeCoche = { serieId: 'm-dark', serie: 'Dark', saison: 2, numero: 5, titre: 'Perdus et retrouvés' }

function monter(props: Partial<PropsVueTelecommande> = {}) {
  const allerA = vi.fn<(vue: Vue) => void>()
  const onVu = vi.fn<(coche: EpisodeCoche) => void>()
  const onAnnulerLeVu = vi.fn<(coche: EpisodeCoche) => void>()
  render(<VueTelecommande ecran={SERIE} enCours={4} allerA={allerA} onVu={onVu} onAnnulerLeVu={onAnnulerLeVu} onPrecedente={() => {}} onSuivante={() => {}} {...props} />)
  return { allerA, onVu, onAnnulerLeVu }
}

const rangeePrincipale = () => document.querySelector<HTMLElement>('[data-piece="rangee-principale"]')!
const touche = (name: string | RegExp) => screen.getByRole('button', { name })

describe('la vue télécommande', () => {
  // Mutation : le libellé rendu à « Jusqu’ici ».
  it('les trois touches de « Cet épisode » : « Vu à deux », « Tout jusqu’ici », « Toute la saison »', () => {
    monter()
    const groupe = screen.getByRole('group', { name: 'Cet épisode' })
    expect(within(groupe).getAllByRole('button').map((b) => b.textContent)).toEqual(['Vu à deux', 'Tout jusqu’ici', 'Toute la saison'])
    expect(screen.queryByText('Jusqu’ici')).toBeNull()
  })

  // Mutation : l'écran qui ne rend pas `serie.titre`, le code de l'épisode, ou « rang sur sur ».
  it('l’écran montre la série, son prochain épisode et son rang', () => {
    monter()
    const ecran = document.querySelector<HTMLElement>('[data-piece="ecran"]')!
    expect(within(ecran).getByRole('heading', { name: 'Dark' })).toBeInTheDocument()
    expect(ecran).toHaveTextContent('S2 E5')
    expect(ecran).toHaveTextContent('Perdus et retrouvés')
    expect(ecran).toHaveTextContent('1 sur 4')
    expect(touche('Vu : Dark, S2 E5')).toBeEnabled()
  })

  // Mutations : `disabled` ôté de « Vu » ; les touches de « Cet épisode » laissées allumées sans série.
  it.each([
    ['en attente', { etat: 'attente' }],
    ['sans série', { etat: 'vide' }],
  ] as [string, EtatDeLEcran][])('%s, « Vu », les flèches et « Cet épisode » sont éteints ; « En cours » et « Ajouter » restent', (_quand, ecran) => {
    const { allerA } = monter({ ecran, onVuADeux: () => {}, onToutJusquIci: () => {}, onTouteLaSaison: () => {} })

    expect(touche('Vu')).toBeDisabled()
    expect(touche('Série précédente')).toBeDisabled()
    expect(touche('Série suivante')).toBeDisabled()
    for (const b of within(screen.getByRole('group', { name: 'Cet épisode' })).getAllByRole('button')) expect(b).toBeDisabled()
    expect(touche('Fiche')).toBeDisabled()

    fireEvent.click(touche(/^En cours/))
    fireEvent.click(touche('Ajouter'))
    expect(allerA.mock.calls).toEqual([[{ nom: 'en-cours' }], [{ nom: 'ajouter' }]])
  })

  // Mutation : la carte fantôme ôtée de l'attente (l'écran resterait vide, sans forme ni annonce).
  it('en attente, l’écran garde sa forme et le dit à qui ne voit pas', () => {
    monter({ ecran: { etat: 'attente' } })
    const ecran = document.querySelector<HTMLElement>('[data-piece="ecran"][data-etat="attente"]')!
    expect(within(ecran).getByRole('status')).toHaveTextContent('La télécommande s’allume…')
  })

  // Mutation : « Fiche » qui mène à une fiche sans identifiant, ou à la liste.
  it('« Fiche » mène à la fiche de la série à l’écran', () => {
    const { allerA } = monter()
    fireEvent.click(touche('Fiche'))
    expect(allerA).toHaveBeenCalledWith({ nom: 'fiche', serie: 'm-dark' })
  })

  // Mutations : la branche `invitation` ôtée de la rangée principale ; les touches de « Cet épisode »
  // laissées allumées devant une invitation.
  it('une invitation passe en premier : « Refuser » et « Confirmer » à la place de « Vu », « Cet épisode » éteint', () => {
    const onConfirmer = vi.fn()
    const onRefuser = vi.fn()
    monter({ ecran: INVITATION, onConfirmer, onRefuser, onVuADeux: () => {}, onToutJusquIci: () => {}, onTouteLaSaison: () => {} })

    expect(document.querySelector('[data-piece="ecran"]')).toHaveTextContent('Alycia a vu Dark S2 E5 avec toi')
    expect(screen.queryByRole('button', { name: /^Vu($| :)/ })).toBeNull()
    for (const b of within(screen.getByRole('group', { name: 'Cet épisode' })).getAllByRole('button')) expect(b).toBeDisabled()

    fireEvent.click(within(rangeePrincipale()).getByRole('button', { name: 'Confirmer' }))
    fireEvent.click(within(rangeePrincipale()).getByRole('button', { name: 'Refuser' }))
    expect(onConfirmer).toHaveBeenCalledWith(INVITATION.etat === 'invitation' ? INVITATION.invitation : null)
    expect(onRefuser).toHaveBeenCalledTimes(1)
  })
})

describe('le retour du « Vu » dans la télécommande', () => {
  afterEach(() => vi.useRealTimers())

  const cocher = () => fireEvent.click(touche('Vu : Dark, S2 E5'))
  const message = () => screen.queryByRole('status')

  // Mutations : `onVu` appelé sans la coche ; le message monté sous la rangée au lieu d'y remplacer les touches.
  it('« Vu » coche l’épisode à l’écran, et le message neutre REMPLACE les touches dans la même rangée', () => {
    const { onVu } = monter()
    const rangee = rangeePrincipale()
    expect(message()).toBeNull()

    cocher()

    expect(onVu).toHaveBeenCalledWith(COCHE)
    expect(message()).toHaveTextContent('Épisode noté')
    // À hauteur égale, par la structure : la rangée est le même élément, de la même classe, et le
    // message est son seul enfant ; « Vu » et ses flèches n'y sont plus.
    expect(rangeePrincipale()).toBe(rangee)
    expect(message()!.parentElement).toBe(rangee)
    expect(rangee.children).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /^Vu : / })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Série suivante' })).toBeNull()
  })

  // Mutation : `lireLeRetourDuVu(coche)` remplacé par `RETOUR_NEUTRE` dans la vue.
  it('un fournisseur d’essai donne son message, et son retrait rend le neutre', () => {
    const retrait = fournirLeRetourDuVu((coche) => `Clap : ${coche.serie} S${coche.saison} E${coche.numero}`)
    monter()

    cocher()
    expect(message()).toHaveTextContent('Clap : Dark S2 E5')

    fireEvent.click(within(message()!).getByRole('button', { name: 'Annuler' }))
    retrait()
    cocher()
    expect(message()).toHaveTextContent('Épisode noté')
  })

  // Mutations : `onAnnulerLeVu` non appelé ; le message laissé en place après « Annuler ».
  it('« Annuler » défait la coche et rend les touches', () => {
    const { onAnnulerLeVu } = monter()
    cocher()

    fireEvent.click(within(message()!).getByRole('button', { name: 'Annuler' }))

    expect(onAnnulerLeVu).toHaveBeenCalledWith(COCHE)
    expect(message()).toBeNull()
    expect(touche('Vu : Dark, S2 E5')).toBeInTheDocument()
  })

  // Mutations : la minuterie ôtée ; `DUREE_DU_RETOUR` descendue à une seconde (« quelques secondes » : trois au moins).
  it('il s’en va seul après quelques secondes, sans annuler', () => {
    vi.useFakeTimers()
    const { onAnnulerLeVu } = monter()
    cocher()

    act(() => void vi.advanceTimersByTime(DUREE_DU_RETOUR - 1))
    expect(message()).not.toBeNull()
    act(() => void vi.advanceTimersByTime(1))

    expect(message()).toBeNull()
    expect(onAnnulerLeVu).not.toHaveBeenCalled()
    expect(DUREE_DU_RETOUR).toBeGreaterThanOrEqual(3000)
  })

  // Mutations : l'écoute de `pointerdown` ôtée ; le test `contains` ôté (toucher le message le ferait partir).
  it('toucher ailleurs le fait partir plus tôt ; le toucher lui-même, non', () => {
    monter()
    cocher()

    fireEvent.pointerDown(message()!)
    expect(message()).not.toBeNull()

    fireEvent.pointerDown(touche('Ajouter'))
    expect(message()).toBeNull()
  })
})
