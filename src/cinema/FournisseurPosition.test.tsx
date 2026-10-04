import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FournisseurPosition } from './FournisseurPosition'
import { usePosition } from './usePosition'
import { simulerNavigateur } from '../test/navigateur'

function Sonde() {
  const { statut, coordonnees, demander } = usePosition()
  return (
    <div>
      <p>statut : {statut}</p>
      <p>coordonnées : {coordonnees ? `${coordonnees.latitude} ${coordonnees.longitude}` : 'aucune'}</p>
      <button type="button" onClick={demander}>
        Autoriser
      </button>
    </div>
  )
}

const monter = (enfants = <Sonde />) => render(<FournisseurPosition>{enfants}</FournisseurPosition>)
const POSITION = { reponse: 'position', latitude: 48.8606, longitude: 2.3376 } as const

describe('la position du membre', () => {
  let navigateur: ReturnType<typeof simulerNavigateur> | undefined
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    navigateur?.retirer()
    navigateur = undefined
    vi.unstubAllGlobals()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('permission « prompt » : rien n’est lu avant le geste, le toucher lit la position', async () => {
    navigateur = simulerNavigateur({ permission: 'prompt', geolocation: POSITION })
    monter()

    expect(await screen.findByText('statut : a_demander')).toBeInTheDocument()
    // Mutation : lire la position dès la vérification ferait ouvrir la fenêtre du navigateur sans geste.
    expect(navigateur.getCurrentPosition).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Autoriser' }))

    expect(await screen.findByText('statut : connue')).toBeInTheDocument()
    expect(screen.getByText('coordonnées : 48.8606 2.3376')).toBeInTheDocument()
    expect(navigateur.getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('permission déjà accordée : la position se lit sans aucun toucher (aucune fenêtre ne s’ouvre alors)', async () => {
    navigateur = simulerNavigateur({ permission: 'granted', geolocation: POSITION })
    monter()

    expect(await screen.findByText('statut : connue')).toBeInTheDocument()
    expect(navigateur.getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('permission refusée : indisponible, et même un toucher ne redemande rien', async () => {
    navigateur = simulerNavigateur({ permission: 'denied', geolocation: POSITION })
    monter()

    expect(await screen.findByText('statut : indisponible')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Autoriser' }))
    expect(navigateur.getCurrentPosition).not.toHaveBeenCalled()
    expect(screen.getByText('statut : indisponible')).toBeInTheDocument()
  })

  it('un navigateur sans géolocalisation : indisponible, et la permission n’est même pas interrogée', () => {
    navigateur = simulerNavigateur({ permission: 'prompt' })
    monter()

    expect(screen.getByText('statut : indisponible')).toBeInTheDocument()
    expect(navigateur.query).not.toHaveBeenCalled()
  })

  it('sans API Permissions : on ne peut pas savoir, le geste reste offert et tranche', async () => {
    navigateur = simulerNavigateur({ geolocation: POSITION })
    monter()

    expect(screen.getByText('statut : a_demander')).toBeInTheDocument()
    expect(navigateur.getCurrentPosition).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Autoriser' }))
    expect(await screen.findByText('statut : connue')).toBeInTheDocument()
  })

  it('une permission illisible (la requête échoue) n’est pas un refus : le geste reste offert', async () => {
    navigateur = simulerNavigateur({ permission: 'erreur', geolocation: POSITION })
    monter()

    expect(await screen.findByText('statut : a_demander')).toBeInTheDocument()
  })

  it('un refus au toucher (ou un capteur en panne) : indisponible, sans coordonnées', async () => {
    navigateur = simulerNavigateur({ permission: 'prompt', geolocation: { reponse: 'refus' } })
    monter()

    fireEvent.click(await screen.findByRole('button', { name: 'Autoriser' }))

    expect(await screen.findByText('statut : indisponible')).toBeInTheDocument()
    expect(screen.getByText('coordonnées : aucune')).toBeInTheDocument()
  })

  it('deux touchers pendant la lecture : une seule demande au navigateur', async () => {
    navigateur = simulerNavigateur({ permission: 'prompt', geolocation: { reponse: 'jamais' } })
    monter()

    const bouton = await screen.findByRole('button', { name: 'Autoriser' })
    fireEvent.click(bouton)
    fireEvent.click(bouton)

    expect(await screen.findByText('statut : en_attente')).toBeInTheDocument()
    expect(navigateur.getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('plusieurs pages qui la lisent ne vérifient la permission qu’une fois', async () => {
    navigateur = simulerNavigateur({ permission: 'prompt', geolocation: POSITION })
    monter(
      <>
        <Sonde />
        <Sonde />
      </>,
    )

    await screen.findAllByText('statut : a_demander')
    expect(navigateur.query).toHaveBeenCalledTimes(1)
  })

  it('la position reste en mémoire : ni stockée, ni envoyée', async () => {
    navigateur = simulerNavigateur({ permission: 'prompt', geolocation: POSITION })
    monter()

    fireEvent.click(await screen.findByRole('button', { name: 'Autoriser' }))
    await screen.findByText('statut : connue')

    // Mutation : écrire les coordonnées dans `localStorage` (ou `sessionStorage`) ferait tomber l'une de ces lignes.
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(document.cookie).toBe('')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sans fournisseur (une page montée seule) : indisponible, rien n’est lu', () => {
    navigateur = simulerNavigateur({ permission: 'granted', geolocation: POSITION })
    render(<Sonde />)

    expect(screen.getByText('statut : indisponible')).toBeInTheDocument()
    expect(navigateur.getCurrentPosition).not.toHaveBeenCalled()
  })
})
