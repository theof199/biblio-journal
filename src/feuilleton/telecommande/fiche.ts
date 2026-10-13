import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { cocherLEpisode, cocherUnePortee, type EpisodeDeSaison, type FicheDeSerie, type Telecommande } from '../../api/feuilleton'
import { poserLaCarte } from './donnees'
import { ECRITURE, FILE, direLeLot, messageDe, perimerALaFin } from './vivante'

/** Un message de la fiche, sur la saison dont il parle : un lot noté, ou son échec. */
export interface AvisDeSaison {
  cle: number
  saisonId: string
  texte: string
  alerte: boolean
}

interface Coche {
  saisonId: string
  episodeId: string
  vu: boolean
}

/** La progression d'une saison de la fiche, d'un épisode de plus ou de moins. */
function compter(fiche: FicheDeSerie, saisonId: string, pas: number): FicheDeSerie {
  return {
    ...fiche,
    seasons: fiche.seasons?.map((saison) =>
      saison.id === saisonId ? { ...saison, progress: { ...saison.progress, me: { ...saison.progress.me, checked: Math.max(0, saison.progress.me.checked + pas) } } } : saison,
    ),
  }
}

/**
 * Les écritures de la fiche d'une série : cocher et décocher un épisode, « Toute la saison ». Elles
 * partent dans **la file de la télécommande** (`FILE`, `vivante.ts`) : un « Vu » de la télécommande et
 * une case de la fiche ne se croisent pas.
 *
 * **Une case est optimiste**, aux trois temps de `vivante.ts`, à une différence près : le retour arrière
 * ne repose pas une photo, il **défait la seule case** qui a échoué. Plusieurs cases d'une saison
 * peuvent attendre leur tour dans la file ; la photo de la première effacerait l'avance des suivantes.
 * `onSettled` périme la fiche (elle et ses saisons dépliées, par préfixe) **et la télécommande**, dont la
 * carte ne vient pas dans la réponse de cette route ; quand une autre écriture attend, c'est elle qui le fera.
 *
 * **« Toute la saison »** n'est pas optimiste : sa réponse porte la carte, qui entre au cache de la
 * télécommande (finie, elle en sort), et la fiche se relit. Le verrou est par épisode, et par saison.
 */
export function useEcrituresDeLaFiche(serieId: string) {
  const client = useQueryClient()
  const verrous = useRef(new Set<string>())
  const numero = useRef(0)
  /** Le message de l'échec d'une case, sur sa ligne, jusqu'à ce qu'on la retouche. */
  const [echecs, setEchecs] = useState<Record<string, string>>({})
  const [avis, setAvis] = useState<AvisDeSaison | null>(null)
  const cleDeLaFiche = cles.ficheDeSerie(serieId)

  const poser = ({ saisonId, episodeId }: Coche, vu: boolean) => {
    client.setQueryData<EpisodeDeSaison[]>(cles.episodesDeSaison(serieId, saisonId), (episodes) =>
      episodes?.map((episode) => (episode.id === episodeId && episode.watched.me !== vu ? { ...episode, watched: { ...episode.watched, me: vu } } : episode)),
    )
    client.setQueryData<FicheDeSerie>(cleDeLaFiche, (fiche) => (fiche ? compter(fiche, saisonId, vu ? 1 : -1) : fiche))
  }

  const coche = useMutation({
    mutationKey: ECRITURE,
    scope: FILE,
    mutationFn: ({ episodeId, vu }: Coche) => cocherLEpisode(episodeId, vu),
    onMutate: async (geste) => {
      // Une lecture en vol de ces deux clés ne repasse pas sur ce qu'on pose (en `exact` : une saison qui se déplie continue de se lire).
      await Promise.all([client.cancelQueries({ queryKey: cleDeLaFiche, exact: true }), client.cancelQueries({ queryKey: cles.episodesDeSaison(serieId, geste.saisonId), exact: true })])
      poser(geste, geste.vu)
    },
    onError: (erreur, geste) => {
      poser(geste, !geste.vu)
      setEchecs((avant) => ({ ...avant, [geste.episodeId]: messageDe(erreur) }))
    },
    onSettled: async (_reponse, _erreur, { episodeId }) => {
      try {
        // À la fin de la file seulement : cette fiche (et celles que la télécommande a périmées entre-temps,
        // `perimerALaFin`), et la télécommande, dont la carte ne vient pas dans la réponse.
        const fin = client.isMutating({ mutationKey: ECRITURE }) === 1
        await Promise.all([perimerALaFin(client, serieId), fin ? client.invalidateQueries({ queryKey: cles.telecommande }) : null])
      } finally {
        verrous.current.delete(episodeId)
      }
    },
  })

  const lot = useMutation({
    mutationKey: ECRITURE,
    scope: FILE,
    mutationFn: ({ saisonId }: { saisonId: string }) => cocherUnePortee({ portee: 'saison', season_id: saisonId }),
    onSuccess: async (reponse, { saisonId }) => {
      await client.cancelQueries({ queryKey: cles.telecommande })
      client.setQueryData<Telecommande>(cles.telecommande, (telecommande) => (telecommande ? poserLaCarte(telecommande, reponse.serie) : telecommande))
      setAvis({ cle: ++numero.current, saisonId, texte: direLeLot(reponse.episode_ids.length), alerte: false })
      await perimerALaFin(client, serieId)
    },
    onError: (erreur, { saisonId }) => setAvis({ cle: ++numero.current, saisonId, texte: messageDe(erreur), alerte: true }),
    onSettled: (_reponse, _erreur, { saisonId }) => {
      void perimerALaFin(client)
      verrous.current.delete(saisonId)
    },
  })

  return {
    echecs,
    avis,
    onAvisParti: () => setAvis(null),
    /** Cocher ou décocher un épisode. Un second toucher du même épisode avant la fin du premier ne part pas. */
    cocher: (saisonId: string, episode: EpisodeDeSaison) => {
      if (verrous.current.has(episode.id)) return
      verrous.current.add(episode.id)
      setEchecs(({ [episode.id]: _oublie, ...autres }) => autres)
      coche.mutate({ saisonId, episodeId: episode.id, vu: !episode.watched.me })
    },
    /** « Toute la saison » : le diffusé seulement, sans redater ce qui est déjà vu. Jamais pour la saison 0, que la route refuse. */
    cocherLaSaison: (saisonId: string) => {
      if (verrous.current.has(saisonId)) return
      verrous.current.add(saisonId)
      lot.mutate({ saisonId })
    },
  }
}

export type EcrituresDeLaFiche = ReturnType<typeof useEcrituresDeLaFiche>
