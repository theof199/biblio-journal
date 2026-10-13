import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { ApiError } from '../../api/client'
import { cocherLEpisode, cocherUnePortee, confirmerLeVuADeux, lireLesSaisons, refuserLeVuADeux, type CarteDeSerie, type Telecommande } from '../../api/feuilleton'
import type { EpisodeCoche } from '../retourDuVu'
import { avancer, direQuand, direQuandLaSerie, jourEnLettres, poserLaCarte, retirerLInvitation, seriesEnCours, useLaTelecommande } from './donnees'
import type { Avis, EtatDeLEcran, InvitationALEcran, PropsVueTelecommande, SerieALEcran } from './VueTelecommande'

/**
 * La vue télécommande, vivante : ce que montre le petit écran, et ses écritures. Chargé avec le panneau.
 *
 * **La règle d'une mutation optimiste** (la première du dépôt ; `CLAUDE.md`, « Le Feuilleton ») :
 * 1. `onMutate` : `cancelQueries` sur la clé (une lecture en vol n'écrase pas ce qu'on va poser), la
 *    photo du cache, puis l'écriture d'avance ; la photo est rendue en contexte ;
 * 2. `onError` : la photo est reposée telle quelle, et l'échec se dit (le message d'`ApiError`) ;
 * 3. `onSettled` : la clé est relue, réussite ou non : le serveur a le dernier mot. Quand une autre
 *    écriture de la même file attend, c'est elle qui relira (sinon la relecture rendrait un état que
 *    l'écriture suivante n'a pas encore changé).
 * Les écritures de la télécommande partagent une file (`scope`) : elles partent une à une, dans l'ordre
 * des gestes ; « Annuler » touché avant la réponse du « Vu » part après elle. Rien de cela ne tient au
 * composant : ces rappels sont ceux de `useMutation`, qui survivent à la fermeture du panneau.
 */
const ECRITURE = [...cles.telecommande, 'ecriture'] as const
const FILE = { id: 'feuilleton-telecommande' }

const SAISON_INTROUVABLE = 'Cette saison est introuvable. Réessaie depuis la fiche.'
const messageDe = (erreur: unknown) => (erreur instanceof Error ? erreur.message : 'Une erreur inattendue est survenue. Réessaie.')
/** L'invitation n'est plus : retirée par son inviteur (`404`), déjà traitée ou expirée (`409`). */
const nEstPlus = (erreur: unknown) => erreur instanceof ApiError && (erreur.status === 404 || erreur.status === 409)

const direLeLot = (combien: number) => (combien === 0 ? 'Rien de plus à noter' : combien === 1 ? '1 épisode noté' : `${combien} épisodes notés`)

interface Coche {
  /** Pour « Vu » : la carte à avancer. Pour « Annuler » : la carte d'avant le « Vu », à reposer. */
  carte: CarteDeSerie
  episodeId: string
  vu: boolean
}

function aLEcran(carte: CarteDeSerie, maintenant: Date): SerieALEcran {
  return {
    id: carte.id,
    titre: carte.titre,
    affiche: carte.vignette,
    episode: carte.prochain ? { saison: carte.prochain.saison, numero: carte.prochain.numero, titre: carte.prochain.titre } : null,
    quand: direQuandLaSerie(carte, maintenant),
    diffusion: carte.prochaine_diffusion_le ? jourEnLettres(carte.prochaine_diffusion_le) : null,
  }
}

export function useTelecommandeVivante(): Omit<PropsVueTelecommande, 'allerA' | 'onVuADeux'> {
  const client = useQueryClient()
  const lecture = useLaTelecommande()
  /** La série choisie par les flèches : son identifiant, qu'on suit où qu'elle aille, et son rang d'alors, où le parcours retombe si elle sort. Sans choix : la première. */
  const [choix, setChoix] = useState<{ id: string; rang: number } | null>(null)
  const [avis, setAvis] = useState<Avis | null>(null)
  const numero = useRef(0)
  /** Le verrou : une écriture à la fois par geste. Un second toucher avant la fin du premier ne part pas. */
  const verrou = useRef(false)
  /** Le dernier « Vu » : ce qu'« Annuler » défait. */
  const dernierVu = useRef<{ carte: CarteDeSerie; episodeId: string } | null>(null)

  const dire = (texte: string, alerte = false) => setAvis({ cle: ++numero.current, texte, alerte })
  const ecrire = (maj: (telecommande: Telecommande) => Telecommande) => client.setQueryData<Telecommande>(cles.telecommande, (telecommande) => (telecommande ? maj(telecommande) : telecommande))
  const relire = () => client.invalidateQueries({ queryKey: cles.telecommande })
  /** Poser ce qu'une réponse rend : une lecture en vol, partie avant l'écriture, ne doit pas repasser dessus. */
  const poser = async (maj: (telecommande: Telecommande) => Telecommande) => {
    await client.cancelQueries({ queryKey: cles.telecommande })
    ecrire(maj)
  }

  const coche = useMutation({
    mutationKey: ECRITURE,
    scope: FILE,
    mutationFn: ({ episodeId, vu }: Coche) => cocherLEpisode(episodeId, vu),
    onMutate: async ({ carte, vu }) => {
      await client.cancelQueries({ queryKey: cles.telecommande })
      const avant = client.getQueryData<Telecommande>(cles.telecommande)
      ecrire((telecommande) => (vu ? avancer(telecommande, carte.id, new Date()) : poserLaCarte(telecommande, carte)))
      return { avant }
    },
    onError: (erreur, _coche, contexte) => {
      if (contexte?.avant) client.setQueryData(cles.telecommande, contexte.avant)
      dire(messageDe(erreur), true)
    },
    onSettled: async (_reponse, _erreur, { vu }) => {
      try {
        if (client.isMutating({ mutationKey: ECRITURE }) === 1) await relire()
      } finally {
        if (vu) verrou.current = false
      }
    },
  })

  const lot = useMutation({
    mutationKey: ECRITURE,
    scope: FILE,
    mutationFn: async ({ carte, portee }: { carte: CarteDeSerie; portee: 'jusqu_ici' | 'saison' }) => {
      const episode = carte.prochain
      if (!episode) throw new Error(SAISON_INTROUVABLE)
      if (portee === 'jusqu_ici') return cocherUnePortee({ portee, episode_id: episode.id })
      // La carte dit le numéro de la saison, la route veut son identifiant : il se lit sur la fiche, au geste.
      const saisons = await client.fetchQuery({ queryKey: cles.saisonsDeSerie(carte.id), queryFn: ({ signal }) => lireLesSaisons(carte.id, signal) })
      const saison = saisons.find((candidate) => candidate.number === episode.saison)
      if (!saison) throw new Error(SAISON_INTROUVABLE)
      return cocherUnePortee({ portee, season_id: saison.id })
    },
    // La réponse porte la carte à jour : elle remplace celle du cache, sans relecture ; finie, elle sort.
    onSuccess: async (reponse) => {
      await poser((telecommande) => poserLaCarte(telecommande, reponse.serie))
      dire(direLeLot(reponse.episode_ids.length))
    },
    onError: (erreur) => dire(messageDe(erreur), true),
    onSettled: () => {
      verrou.current = false
    },
  })

  const reponse = useMutation({
    mutationKey: ECRITURE,
    scope: FILE,
    mutationFn: async ({ id, confirmer }: { id: string; confirmer: boolean }) => (confirmer ? (await confirmerLeVuADeux(id)).serie : (await refuserLeVuADeux(id), null)),
    onSuccess: async (carte, { id, confirmer }) => {
      await poser((telecommande) => {
        const sans = retirerLInvitation(telecommande, id)
        return carte ? poserLaCarte(sans, carte) : sans
      })
      dire(confirmer ? 'Vu à deux noté' : 'Invitation refusée')
    },
    onError: async (erreur, { id }) => {
      dire(messageDe(erreur), true)
      if (!nEstPlus(erreur)) return
      await poser((telecommande) => retirerLInvitation(telecommande, id))
      await relire()
    },
    onSettled: () => {
      verrou.current = false
    },
  })

  /** Prend le verrou, ou dit non : le second toucher d'un double toucher. */
  const prendre = () => {
    if (verrou.current) return false
    verrou.current = true
    return true
  }

  const maintenant = new Date()
  const telecommande = lecture.data
  const enCours = telecommande ? seriesEnCours(telecommande) : []
  const trouve = choix ? enCours.findIndex((serie) => serie.id === choix.id) : 0
  const rang = Math.max(0, Math.min(trouve === -1 ? (choix?.rang ?? 0) : trouve, enCours.length - 1))
  const carte = enCours[rang]
  const invitation = telecommande?.a_confirmer[0]

  let ecran: EtatDeLEcran
  if (!telecommande) ecran = lecture.isError && !lecture.isFetching ? { etat: 'panne', message: messageDe(lecture.error) } : { etat: 'attente' }
  else if (invitation)
    ecran = {
      etat: 'invitation',
      sur: enCours.length,
      invitation: {
        id: invitation.id,
        de: invitation.de.pseudo,
        couleur: invitation.de.identity_color,
        serie: invitation.serie.titre,
        episode: { saison: invitation.episode.saison, numero: invitation.episode.numero, titre: invitation.episode.titre },
        quand: direQuand('Proposé', invitation.invite_le, maintenant),
      },
    }
  else if (carte) ecran = { etat: 'serie', serie: aLEcran(carte, maintenant), rang: rang + 1, sur: enCours.length }
  else ecran = { etat: 'vide' }

  const allerAuRang = (suivant: number) => {
    const serie = enCours[suivant]
    return serie ? () => setChoix({ id: serie.id, rang: suivant }) : undefined
  }
  /** La carte de la série à l'écran, si c'est bien elle qu'on vient de toucher. */
  const carteDe = (serieId: string) => (carte?.id === serieId ? carte : undefined)

  const cocherUnLot = (portee: 'jusqu_ici' | 'saison') => (serie: SerieALEcran) => {
    const cible = carteDe(serie.id)
    if (!cible?.prochain || !prendre()) return
    lot.mutate({ carte: cible, portee })
  }
  const repondre = (confirmer: boolean) => (cible: InvitationALEcran) => {
    if (!prendre()) return
    reponse.mutate({ id: cible.id, confirmer })
  }

  return {
    ecran,
    enCours: telecommande ? enCours.length : null,
    onReessayer: () => void lecture.refetch(),
    avis,
    onAvisParti: () => setAvis(null),
    onPrecedente: allerAuRang(rang - 1),
    onSuivante: allerAuRang(rang + 1),
    onVu: (vu: EpisodeCoche) => {
      const cible = carteDe(vu.serieId)
      if (!cible?.prochain || !prendre()) return false
      dernierVu.current = { carte: cible, episodeId: cible.prochain.id }
      // Elle reste à l'écran : le choix la suit par son identifiant, et cochée elle passe en tête.
      setAvis(null)
      coche.mutate({ carte: cible, episodeId: cible.prochain.id, vu: true })
      return true
    },
    onAnnulerLeVu: (vu: EpisodeCoche) => {
      const dernier = dernierVu.current
      if (!dernier || dernier.carte.id !== vu.serieId) return
      dernierVu.current = null
      setChoix({ id: dernier.carte.id, rang })
      coche.mutate({ carte: dernier.carte, episodeId: dernier.episodeId, vu: false })
    },
    onToutJusquIci: cocherUnLot('jusqu_ici'),
    onTouteLaSaison: cocherUnLot('saison'),
    onConfirmer: repondre(true),
    onRefuser: repondre(false),
  }
}
