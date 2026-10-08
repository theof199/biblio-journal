import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { ApiError } from '../../api/client'
import { accepterHoraire, estPrete, retirerHoraire, type FicheAnnee, type FichePrete, type Horaire as HoraireServi, type Voyage } from '../../api/voyage'
import type { GabaritsDesPages, Monde } from '../../mondes/types'

/**
 * Ce que reçoit le dessin de l'horaire d'une gare (`GabaritsDesPages.horaireDeLAnnee`, sans défaut) :
 * ce que la fiche sert, **tel quel**, et les deux gestes quand ils s'offrent. `Horaire.tsx` garde les
 * écritures, leur verrou et ce que le cache en apprend : le dessin ne lit ni n'écrit rien, et ne
 * calcule aucune date (`voyage/horaire.ts` dit un jour servi).
 */
export interface PropsHoraireDeLAnnee {
  monde: Monde
  annee: number
  /** L'horaire que j'ai accepté sur cette gare, son état et son échéance tels que servis ; nul : la gare en propose un. */
  horaire: HoraireServi | null
  /** L'échéance qu'accepter poserait, celle du serveur ; nulle dès que la gare porte un horaire. */
  proposable: string | null
  /** L'instant où la gare a été bouclée (le ticket de l'année suivante émis), pour un horaire tenu ; nul sinon. */
  arriveeLe: string | null
  /** « Tenir l'horaire » : seulement quand la fiche le propose. */
  onTenir: (() => void) | null
  /** « Sans horaire » : seulement tant que l'horaire est accepté, ni tenu ni manqué. */
  onRetirer: (() => void) | null
  /** Une écriture est partie (ou, après un retrait, la fiche se relit) : les deux gestes attendent. */
  occupe: boolean
  /** Ce que mon dernier geste vient de faire sur cette page, pour le dire une fois ; nul sinon. */
  vient: 'accepte' | 'retire' | null
  /** Une écriture en échec, dite avec le message du serveur ou du client ; le geste se refait. */
  erreur: string | null
}

type Geste = 'accepter' | 'retirer'

/** Ni le refus d'une gare qui a changé (`409`), ni celui d'un horaire déjà retiré (`404`) ne sont des pannes. */
const aChange = (e: unknown): boolean => e instanceof ApiError && (e.status === 409 || e.status === 404)

interface Props {
  monde: Monde
  annee: number
  fiche: FichePrete
  /** Le dessin du monde (`gabaritSeul`) : la page ne monte ce bloc que s'il existe. */
  Dessin: GabaritsDesPages['horaireDeLAnnee']
}

/**
 * L'horaire d'une gare (plan des écrans des lots, brief 10), sous l'indicateur. **Sans défaut** : la
 * page ne le monte que si le monde de l'année compose `horaireDeLAnnee`. Il ne lit **aucune** route :
 * `horaire` et `horaire_proposable` viennent de la fiche que la page tient. Ni l'un ni l'autre, le
 * bloc n'existe pas.
 *
 * Deux écritures, sous un verrou par référence (`isPending` ne se voit qu'au rendu suivant). **Le
 * serveur décide de l'échéance** : le `POST` part sans corps. Une écriture ne change que l'horaire de
 * cette gare, sur sa fiche et sur sa case de la carte : le cache n'apprend que ces deux champs, puis
 * ces deux clés se relisent en `exact`, jamais le préfixe `voyage` (la malle, que la fête d'un retour
 * attend, les tickets, l'état du voyageur et les autres fiches seraient relus pour rien, et relire
 * une fiche n'est pas anodin). Un `409` ou un `404` : la gare a changé ailleurs, la fiche et la carte
 * se relisent, rien ne se dit.
 */
export default function Horaire({ monde, annee, fiche, Dessin }: Props) {
  const client = useQueryClient()
  const [vient, setVient] = useState<'accepte' | 'retire' | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  /** L'horaire de cette gare sur la carte en cache, s'il y en a une : sa case seule. */
  const poserSurLaCarte = (h: HoraireServi | null) =>
    client.setQueryData<Voyage>(cles.voyage, (v) => (v ? { ...v, annees: v.annees.map((a) => (a.annee === annee ? { ...a, horaire: h } : a)) } : v))
  const poserSurLaFiche = (h: HoraireServi | null) =>
    client.setQueryData<FicheAnnee>(cles.annee(annee), (f) => (estPrete(f) ? { ...f, horaire: h, horaire_proposable: null } : f))
  const relire = () =>
    Promise.all([client.invalidateQueries({ queryKey: cles.annee(annee), exact: true }), client.invalidateQueries({ queryKey: cles.voyage, exact: true })])

  const ecrire = useMutation({
    mutationFn: async (geste: Geste) => {
      if (geste === 'accepter') return { geste, horaire: await accepterHoraire(annee) }
      await retirerHoraire(annee)
      return { geste, horaire: null }
    },
    // Dans `useMutation`, pas dans les rappels de `mutate` : le cache l'apprend même la page quittée.
    onSuccess: async ({ geste, horaire }) => {
      poserSurLaCarte(horaire)
      if (geste === 'accepter') {
        // Accepté, tout est su : l'horaire rendu, et plus rien à proposer. La relecture ne s'attend pas.
        poserSurLaFiche(horaire)
        void relire()
        return
      }
      // Retiré, la gare en repropose un, dont l'échéance n'est qu'au serveur : la fiche se relit
      // d'abord, et ne s'écrit à la main (sans horaire, sans proposition) que si sa relecture échoue.
      await relire()
      if (client.getQueryState(cles.annee(annee))?.status === 'error') poserSurLaFiche(null)
    },
    onError: (e) => {
      if (aChange(e)) void relire()
    },
  })

  const envoi = useRef(false)
  const lancer = (geste: Geste) => {
    if (envoi.current) return
    envoi.current = true
    setErreur(null)
    setVient(null)
    ecrire.mutate(geste, {
      onSuccess: () => setVient(geste === 'accepter' ? 'accepte' : 'retire'),
      onError: (e) => {
        if (!aChange(e)) setErreur(e.message)
      },
      onSettled: () => void (envoi.current = false),
    })
  }

  const { horaire, horaire_proposable: proposable } = fiche
  if (!horaire && proposable === null) return null
  return (
    <Dessin
      monde={monde}
      annee={annee}
      horaire={horaire}
      proposable={horaire ? null : proposable}
      arriveeLe={horaire?.etat === 'tenu' ? (fiche.ticket?.emis_le ?? null) : null}
      onTenir={horaire ? null : () => lancer('accepter')}
      onRetirer={horaire?.etat === 'accepte' ? () => lancer('retirer') : null}
      occupe={ecrire.isPending}
      vient={vient}
      erreur={erreur}
    />
  )
}
