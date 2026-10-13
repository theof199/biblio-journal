import { useRef, useState } from 'react'
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { ApiError } from '../../api/client'
import { cocherLEpisode, cocherUnePortee, confirmerLeVuADeux, inviterAVoirADeux, refuserLeVuADeux, type CarteDeSerie, type InvitationAConfirmer, type Membre, type Telecommande } from '../../api/feuilleton'
import type { EpisodeCoche } from '../retourDuVu'
import { avancer, direQuand, direQuandLaSerie, jourEnLettres, poserLaCarte, retirerLInvitation, seriesEnCours, seriesEnPause, useLaTelecommande } from './donnees'
import type { PropsVueADeux } from './VueADeux'
import type { PropsVueListe } from './VueListe'
import { codeDe, type Avis, type EtatDeLEcran, type InvitationALEcran, type PropsVueTelecommande, type SerieALEcran } from './VueTelecommande'
import type { Vue } from './vues'

/**
 * La télécommande, vivante : ce que montrent le petit écran, la liste et le « vu à deux », et leurs
 * écritures, les mêmes pour les trois vues (un seul appel, dans `Panneau.tsx`). Chargé avec le panneau.
 *
 * **La règle d'une mutation optimiste** (la première du dépôt ; `CLAUDE.md`, « Le Feuilleton ») :
 * 1. `onMutate` : `cancelQueries` sur la clé (une lecture en vol n'écrase pas ce qu'on va poser), puis
 *    l'écriture d'avance ;
 * 2. `onError` : **la seule carte en échec est défaite** (la carte d'avant de cette série, que le geste
 *    porte, est reposée), et l'échec se dit (le message d'`ApiError`). Jamais une photo du cache : une
 *    autre écriture de la file a pu avancer une autre carte depuis, et la photo d'une écriture prise
 *    pendant qu'une autre était d'avance repose cette avance après son échec. Un « Annuler » raté ne
 *    défait rien : la relecture seule dit où en est la série ;
 * 3. `onSettled` : la clé est relue, réussite ou non : le serveur a le dernier mot. Quand une autre
 *    écriture de la même file attend, c'est elle qui relira (sinon la relecture rendrait un état que
 *    l'écriture suivante n'a pas encore changé). Les fiches à périmer attendent de même la fin de la
 *    file (`perimerALaFin`) : relue plus tôt, une fiche décocherait un instant une case qui attend.
 * Les écritures de la télécommande partagent une file (`scope`) : elles partent une à une, dans l'ordre
 * des gestes ; « Annuler » touché avant la réponse du « Vu » part après elle. Rien de cela ne tient au
 * composant : ces rappels sont ceux de `useMutation`, qui survivent à la fermeture du panneau.
 *
 * La fiche (`fiche.ts`) écrit dans la même file, sous la même clé d'écriture : elle les prend ici.
 */
export const ECRITURE = [...cles.telecommande, 'ecriture'] as const
export const FILE = { id: 'feuilleton-telecommande' }

/** Les fiches que des écritures de la file ont périmées, par cache : elles se relisent à la fin de la file. */
const A_PERIMER = new WeakMap<QueryClient, Set<string>>()

/**
 * Une fiche déjà ouverte reflète ce qu'on vient d'écrire : la fiche de la série et ses saisons dépliées
 * sont périmées (relues si elles sont à l'écran, à leur retour sinon), **quand plus aucune écriture de la
 * file n'attend**. S'appelle dans `onSettled` (l'écriture qui finit compte encore pour une) ; `serieId`
 * absent : rien de plus à périmer, seulement la fin de la file à constater. Rend la fin des relectures.
 */
export async function perimerALaFin(client: QueryClient, serieId?: string): Promise<void> {
  const series = A_PERIMER.get(client) ?? new Set<string>()
  A_PERIMER.set(client, series)
  if (serieId) series.add(serieId)
  if (client.isMutating({ mutationKey: ECRITURE }) > 1) return
  const aRelire = [...series]
  series.clear()
  await Promise.all(aRelire.map((id) => client.invalidateQueries({ queryKey: cles.ficheDeSerie(id) })))
}

const SAISON_INTROUVABLE = 'Cette saison est introuvable. Réessaie depuis la fiche.'
export const messageDe = (erreur: unknown) => (erreur instanceof Error ? erreur.message : 'Une erreur inattendue est survenue. Réessaie.')
/** L'invitation n'est plus : retirée par son inviteur (`404`), déjà traitée ou expirée (`409`). */
const nEstPlus = (erreur: unknown) => erreur instanceof ApiError && (erreur.status === 404 || erreur.status === 409)
/** Le trio est déjà pris : une invitation attend, a été confirmée, ou refusée (un refus est définitif). */
const dejaRecu = (erreur: unknown) => erreur instanceof ApiError && erreur.status === 409

export const direLeLot = (combien: number) => (combien === 0 ? 'Rien de plus à noter' : combien === 1 ? '1 épisode noté' : `${combien} épisodes notés`)

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
    nouvelle: carte.repere === 'suivi',
    enPause: carte.en_pause,
  }
}

function invitationALEcran(invitation: InvitationAConfirmer, maintenant: Date): InvitationALEcran {
  return {
    id: invitation.id,
    de: invitation.de.pseudo,
    couleur: invitation.de.identity_color,
    serie: invitation.serie.titre,
    episode: { saison: invitation.episode.saison, numero: invitation.episode.numero, titre: invitation.episode.titre },
    quand: direQuand('Proposé', invitation.invite_le, maintenant),
  }
}

/** Ce que le panneau donne à chacune de ses vues vivantes ; ce qui manque (les passages d'une vue à l'autre) vient de l'adresse. */
export interface TelecommandeVivante {
  /** Les séries que la télécommande porte, en cours ou en pause (`media_id`) : « déjà suivie », dans l'ajout. */
  suivies: ReadonlySet<string>
  telecommande: Omit<PropsVueTelecommande, 'allerA' | 'onVuADeux'>
  liste: Omit<PropsVueListe, 'allerA'>
  aDeux: Omit<PropsVueADeux, 'onFait'>
}

/**
 * `vue` : la vue que dit l'adresse. Une télécommande **réglée sur une série** (`serie-<identifiant>`, la
 * touche « ⋯ » de la liste) montre cette série, en pause ou non, avant toute invitation : on l'a choisie.
 * **Réglée sur une série que la télécommande ne porte pas** (une adresse d'ailleurs, une série finie), elle
 * se comporte comme sans réglage : l'invitation d'abord, sinon la série regardée en dernier.
 */
export function useTelecommandeVivante(vue: Vue | null): TelecommandeVivante {
  const client = useQueryClient()
  const lecture = useLaTelecommande()
  const reglee = vue?.nom === 'telecommande' ? (vue.serie ?? null) : null
  /** La série choisie, par les flèches ou par l'adresse : son identifiant, qu'on suit où qu'elle aille, et son rang d'alors, où le parcours retombe si elle sort. Sans choix : la première. */
  const [choix, setChoix] = useState<{ id: string; rang: number } | null>(reglee ? { id: reglee, rang: 0 } : null)
  // Un autre réglage dans l'adresse l'emporte sur le choix des flèches (un état tiré d'une propriété, posé au rendu).
  const [dernierReglage, setDernierReglage] = useState(reglee)
  if (reglee !== dernierReglage) {
    setDernierReglage(reglee)
    if (reglee) setChoix({ id: reglee, rang: 0 })
  }
  const [avis, setAvis] = useState<Avis | null>(null)
  // Un avis part avec la vue où il s'est dit. Seule exception : le « vu à deux », qui dit « Proposé à… »
  // en rendant la main à la télécommande, où ce message se lit.
  const nomDeLaVue = vue?.nom ?? null
  const [vueDAvant, setVueDAvant] = useState(nomDeLaVue)
  if (nomDeLaVue !== vueDAvant) {
    setVueDAvant(nomDeLaVue)
    if (vueDAvant !== 'a-deux') setAvis(null)
  }
  const numero = useRef(0)
  /**
   * Les verrous : une écriture à la fois **par carte** (l'identifiant de la série, ou de l'invitation). Un
   * second toucher de la même carte avant la fin du premier ne part pas ; une autre carte, si.
   */
  const verrous = useRef(new Set<string>())
  /** Le dernier « Vu » : ce qu'« Annuler » défait. */
  const dernierVu = useRef<{ carte: CarteDeSerie; episodeId: string } | null>(null)
  /** Les épisodes qu'« Annuler » a déjà repris pendant que leur « vu à deux » partait : l'échec de l'invitation ne se dit plus. */
  const annules = useRef(new Set<string>())

  const dire = (texte: string, alerte = false, autres: Pick<Avis, 'sujet' | 'annuler'> = {}) => setAvis({ cle: ++numero.current, texte, alerte, ...autres })
  const ecrire = (maj: (telecommande: Telecommande) => Telecommande) => client.setQueryData<Telecommande>(cles.telecommande, (telecommande) => (telecommande ? maj(telecommande) : telecommande))
  const relire = () => client.invalidateQueries({ queryKey: cles.telecommande })
  const perimerLaFiche = (serieId: string) => void perimerALaFin(client, serieId)
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
      ecrire((telecommande) => (vu ? avancer(telecommande, carte.id, new Date()) : poserLaCarte(telecommande, carte)))
    },
    onError: (erreur, { carte, vu }) => {
      // La seule carte en échec, jamais une photo du cache. Un « Annuler » raté : la relecture seule.
      if (vu) ecrire((telecommande) => poserLaCarte(telecommande, carte))
      dire(messageDe(erreur), true, { sujet: carte.id })
    },
    onSettled: async (_reponse, _erreur, { carte, vu }) => {
      perimerLaFiche(carte.id)
      try {
        if (client.isMutating({ mutationKey: ECRITURE }) === 1) await relire()
      } finally {
        if (vu) verrous.current.delete(carte.id)
      }
    },
  })

  /**
   * Le « vu à deux » : la coche, **puis** l'invitation, en une seule écriture de la file, pour qu'un
   * « Annuler » touché entre-temps parte après les deux (décocher retire l'invitation, côté API). La
   * carte avance d'avance, comme pour « Vu ». La coche échoue : rien n'est proposé, la carte d'avant est reposée.
   * La coche passe et l'invitation échoue : l'épisode reste coché, la fonction rend l'échec au lieu de
   * le lever (rien n'est à défaire), et un avis le dit.
   */
  const aDeux = useMutation({
    mutationKey: ECRITURE,
    scope: FILE,
    mutationFn: async ({ episodeId, pour }: { carte: CarteDeSerie; episodeId: string; pour: Membre }): Promise<unknown> => {
      await cocherLEpisode(episodeId, true)
      try {
        await inviterAVoirADeux({ episode_id: episodeId, pour: pour.id })
        return null
      } catch (refus) {
        return refus
      }
    },
    onMutate: async ({ carte }) => {
      await client.cancelQueries({ queryKey: cles.telecommande })
      ecrire((telecommande) => avancer(telecommande, carte.id, new Date()))
    },
    onSuccess: (refus, { carte, episodeId, pour }) => {
      // « Annuler » est déjà passé : l'épisode va être décoché, dire « noté, mais… » serait faux.
      if (refus && !annules.current.has(episodeId)) dire(dejaRecu(refus) ? `Épisode noté, mais ${pour.pseudo} l’a déjà reçu` : messageDe(refus), true, { sujet: carte.id })
    },
    onError: (erreur, { carte }) => {
      ecrire((telecommande) => poserLaCarte(telecommande, carte))
      dire(messageDe(erreur), true, { sujet: carte.id })
    },
    onSettled: async (_reponse, _erreur, { carte, episodeId }) => {
      annules.current.delete(episodeId)
      perimerLaFiche(carte.id)
      try {
        if (client.isMutating({ mutationKey: ECRITURE }) === 1) await relire()
      } finally {
        verrous.current.delete(carte.id)
      }
    },
  })

  const lot = useMutation({
    mutationKey: ECRITURE,
    scope: FILE,
    mutationFn: async ({ carte, portee }: { carte: CarteDeSerie; portee: 'jusqu_ici' | 'saison' }) => {
      const episode = carte.prochain
      if (!episode) throw new Error(SAISON_INTROUVABLE)
      // L'épisode de la carte porte l'identifiant de sa saison (`saison_id`) : aucune lecture de la fiche.
      return portee === 'jusqu_ici' ? cocherUnePortee({ portee, episode_id: episode.id }) : cocherUnePortee({ portee, season_id: episode.saison_id })
    },
    // La réponse porte la carte à jour : elle remplace celle du cache, sans relecture ; finie, elle sort.
    onSuccess: async (reponse) => {
      await poser((telecommande) => poserLaCarte(telecommande, reponse.serie))
      dire(direLeLot(reponse.episode_ids.length))
    },
    onError: (erreur, { carte }) => dire(messageDe(erreur), true, { sujet: carte.id }),
    onSettled: (_reponse, _erreur, { carte }) => {
      perimerLaFiche(carte.id)
      verrous.current.delete(carte.id)
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
      if (carte) perimerLaFiche(carte.id)
      dire(confirmer ? 'Vu à deux noté' : 'Invitation refusée')
    },
    onError: async (erreur, { id }) => {
      // L'invitation qui reste garde son message sur sa carte ; celle qui n'est plus le laisse sans sujet.
      dire(messageDe(erreur), true, nEstPlus(erreur) ? {} : { sujet: id })
      if (!nEstPlus(erreur)) return
      await poser((telecommande) => retirerLInvitation(telecommande, id))
      await relire()
    },
    onSettled: (_reponse, _erreur, { id }) => {
      void perimerALaFin(client)
      verrous.current.delete(id)
    },
  })

  /** Prend le verrou d'une carte, ou dit non : le second toucher d'un double toucher. */
  const prendre = (cle: string) => {
    if (verrous.current.has(cle)) return false
    verrous.current.add(cle)
    return true
  }

  const maintenant = new Date()
  const telecommande = lecture.data
  const enCours = telecommande ? seriesEnCours(telecommande) : []
  const trouve = choix ? enCours.findIndex((serie) => serie.id === choix.id) : 0
  const rang = Math.max(0, Math.min(trouve === -1 ? (choix?.rang ?? 0) : trouve, enCours.length - 1))
  /** Une série en pause n'est pas du parcours des flèches : elle ne vient à l'écran que choisie (« ⋯ »), et y reste jusqu'à ce qu'on en sorte. */
  const horsParcours = choix ? telecommande?.series.find((serie) => serie.id === choix.id && serie.en_pause) : undefined
  const carte = horsParcours ?? enCours[rang]
  const invitation = telecommande?.a_confirmer[0]
  const regleeTrouvee = reglee !== null && telecommande?.series.some((serie) => serie.id === reglee)
  const panne = !telecommande && lecture.isError && !lecture.isFetching ? messageDe(lecture.error) : null

  let ecran: EtatDeLEcran
  if (!telecommande) ecran = panne === null ? { etat: 'attente' } : { etat: 'panne', message: panne }
  else if (invitation && !regleeTrouvee) ecran = { etat: 'invitation', sur: enCours.length, invitation: invitationALEcran(invitation, maintenant) }
  else if (carte) ecran = { etat: 'serie', serie: aLEcran(carte, maintenant), rang: rang + 1, sur: enCours.length }
  else ecran = { etat: 'vide' }

  const allerAuRang = (suivant: number) => {
    const serie = enCours[suivant]
    return serie ? () => setChoix({ id: serie.id, rang: suivant }) : undefined
  }
  /** La carte d'une série, en cours ou en pause : celle de l'écran, ou celle d'une carte de la liste. */
  const carteDe = (serieId: string) => telecommande?.series.find((serie) => serie.id === serieId)

  const cocherUnLot = (portee: 'jusqu_ici' | 'saison') => (serie: SerieALEcran) => {
    const cible = carteDe(serie.id)
    if (!cible?.prochain || !prendre(cible.id)) return
    lot.mutate({ carte: cible, portee })
  }
  const repondre = (confirmer: boolean) => (cible: InvitationALEcran) => {
    if (!prendre(cible.id)) return
    reponse.mutate({ id: cible.id, confirmer })
  }
  const onReessayer = () => void lecture.refetch()
  const onAvisParti = () => setAvis(null)
  const onVu = (vu: EpisodeCoche) => {
    const cible = carteDe(vu.serieId)
    if (!cible?.prochain || !prendre(cible.id)) return false
    dernierVu.current = { carte: cible, episodeId: cible.prochain.id }
    // Sur le petit écran elle reste : le choix la suit par son identifiant, et cochée elle passe en tête.
    setAvis(null)
    coche.mutate({ carte: cible, episodeId: cible.prochain.id, vu: true })
    return true
  }
  /**
   * « Annuler » décoche, et rien d'autre. `suivre` : sur le petit écran seulement, le choix suit la série
   * (décochée, elle quitte la tête : sans cela l'écran passerait à une autre). Dans la liste, le réglage
   * de la télécommande ne change pas.
   */
  const annulerLeVu = (suivre: boolean) => (vu: EpisodeCoche) => {
    const dernier = dernierVu.current
    if (!dernier || dernier.carte.id !== vu.serieId) return
    dernierVu.current = null
    if (aDeux.isPending) annules.current.add(dernier.episodeId)
    if (suivre) setChoix({ id: dernier.carte.id, rang })
    coche.mutate({ carte: dernier.carte, episodeId: dernier.episodeId, vu: false })
  }
  const onConfirmer = repondre(true)
  const onRefuser = repondre(false)

  /** Le « vu à deux » se propose pour la série de l'adresse, sinon pour celle regardée en dernier. */
  const aProposer = vue?.nom === 'a-deux' && vue.serie ? carteDe(vue.serie) : enCours[0]

  return {
    suivies: new Set((telecommande?.series ?? []).map((serie) => serie.id)),
    telecommande: {
      ecran,
      enCours: telecommande ? enCours.length : null,
      onReessayer,
      avis,
      onAvisParti,
      onPrecedente: horsParcours ? undefined : allerAuRang(rang - 1),
      onSuivante: horsParcours ? allerAuRang(0) : allerAuRang(rang + 1),
      onVu,
      onAnnulerLeVu: annulerLeVu(true),
      onToutJusquIci: cocherUnLot('jusqu_ici'),
      onTouteLaSaison: cocherUnLot('saison'),
      onConfirmer,
      onRefuser,
    },
    liste: {
      lecture: telecommande ? { etat: 'prete' } : panne === null ? { etat: 'attente' } : { etat: 'panne', message: panne },
      invitations: (telecommande?.a_confirmer ?? []).map((attendue) => invitationALEcran(attendue, maintenant)),
      enCours: enCours.map((serie) => aLEcran(serie, maintenant)),
      enPause: (telecommande ? seriesEnPause(telecommande) : []).map((serie) => aLEcran(serie, maintenant)),
      avis,
      onAvisParti,
      onReessayer,
      onVu,
      onAnnulerLeVu: annulerLeVu(false),
      onConfirmer,
      onRefuser,
    },
    aDeux: {
      lecture: telecommande ? { etat: 'prete' } : panne === null ? { etat: 'attente' } : { etat: 'panne', message: panne },
      serie: aProposer ? aLEcran(aProposer, maintenant) : null,
      onReessayer,
      onProposer: (serie: SerieALEcran, pour: Membre) => {
        const cible = carteDe(serie.id)
        const episode = cible?.prochain
        if (!cible || !episode || !prendre(cible.id)) return false
        dernierVu.current = { carte: cible, episodeId: episode.id }
        const vu: EpisodeCoche = { serieId: cible.id, serie: cible.titre, saison: episode.saison, numero: episode.numero, titre: episode.titre }
        // Dit d'avance, comme la carte avance d'avance : un échec le remplacera. « Annuler » décoche, ce qui retire l'invitation.
        dire(`Proposé à ${pour.pseudo} · ${codeDe(episode)}`, false, { sujet: cible.id, annuler: vu })
        aDeux.mutate({ carte: cible, episodeId: episode.id, pour })
        return true
      },
    },
  }
}
