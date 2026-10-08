import { useEffect, useRef, useState, type RefObject } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { ApiError } from '../../api/client'
import { curseurSuivant, itemAuJournal, lireJournal, type JournalItem } from '../../api/journal'
import { repondreAuControleur, type BilletDemande, type PassageDuControleur, type ReponseAuControleur, type Voyageur } from '../../api/voyage'
import type { GabaritsDesPages, Monde } from '../../mondes/types'
import { billetsDeLaDecennie, numeroDe } from '../billets'
import { useDialogue } from '../dialogue'
import { decennieDe } from '../regles'

/** La taille des pages du journal : celle de l'accueil et de la fiche d'un film, qui partagent `cles.journal`. */
const LIMITE = 20

/** Le repli d'une erreur qui ne vient pas du client de l'API (lui dit déjà le réseau coupé, en français). */
const PANNE_DU_CONTROLE = 'Ta réponse n’est pas partie. Réessaie.'

/**
 * Le billet que le contrôleur demande, tel que mon journal le montre (décision 6 du propriétaire) :
 * le contrat n'en donne que deux identifiants. Le numéro est celui de la boîte à billets de sa
 * décennie, si elle est en cache ; nul sinon.
 */
export interface BilletMontre {
  item: JournalItem
  numero: number | null
}

/** Où en est le contrôle : il demande, puis ce que **le serveur** a enregistré de ma réponse. */
export type EtatDuControle = 'demande' | ReponseAuControleur

/**
 * Ce que reçoit le dessin du contrôleur (`GabaritsDesPages.controleurDeLaCarte`, sans défaut) : il
 * dessine le dialogue entier et ne lit ni n'écrit rien. `Controleur.tsx` garde la lecture du billet,
 * l'écriture de la réponse et son verrou, Échap et le focus.
 */
export interface PropsControleurDeLaCarte {
  monde: Monde
  /** Le billet demandé ; nul tant que mon journal ne l'a pas montré, et s'il n'est pas sur sa première page. */
  billet: BilletMontre | null
  etat: EtatDuControle
  /** La réponse n'est pas partie : ce qu'il faut en dire, dans le dialogue. Nul sinon. */
  panne: string | null
  /**
   * À poser sur le premier bouton du dialogue, quel que soit l'état (« Présenter le billet », puis
   * « Refermer la portière ») : il prend le focus à l'entrée, et de nouveau après la réponse.
   */
  premier: RefObject<HTMLButtonElement>
  /** Les deux réponses : elles écrivent. Offertes tant que `etat` vaut `demande`. */
  presenter: () => void
  refuser: () => void
  /** Refermer la portière : n'écrit rien, quel que soit l'état. */
  fermer: () => void
}

interface Props {
  monde: Monde
  Dessin: GabaritsDesPages['controleurDeLaCarte']
  /** Le billet que l'état du voyageur annonçait quand il est entré. */
  billet: BilletDemande
  /** Le départ du Voyage, celui de la carte : la boîte à billets numérote à partir de lui. */
  depart: number
  /** La portière se referme : par son bouton, par Échap, ou parce que le serveur dit qu'il n'attendait plus. */
  onFermer: () => void
}

/**
 * Le contrôleur des billets, entré sur la carte (plan des écrans des lots, brief 7). `pages/Carte.tsx`
 * décide quand il entre et ne monte ce bloc que si le monde de mon année en cours compose
 * `controleurDeLaCarte` : monté, il est déjà là.
 *
 * **Le billet** : la première page de mon journal (la clé de l'accueil et de la fiche d'un film), où
 * le dernier billet de film se trouve presque toujours ; jamais la page suivante. Sa panne se tait :
 * la portière reste, sans carton.
 *
 * **La réponse** : un verrou (une référence, `isPending` ne se voit qu'au rendu suivant), un seul
 * `POST`. Acceptée, le cache de l'état du voyageur apprend qu'il n'attend plus et le poinçon rendu,
 * champ par champ, une lecture en vol annulée d'abord : la route n'écrit que `voyage_controles`, que
 * seul cet état sert, donc rien d'autre n'est périmé. `409` (il n'attendait plus : déjà répondu
 * ailleurs, le billet supprimé) : la portière se referme et l'état se relit, sans un mot. Toute autre
 * panne se dit dans le dialogue, et la réponse se refait.
 *
 * **Refermer n'est pas refuser** (décision 5) : ni le bouton ni Échap n'écrivent. Rien n'est retenu
 * sur l'appareil.
 */
export default function Controleur({ monde, Dessin, billet, depart, onFermer }: Props) {
  const client = useQueryClient()
  const [etat, setEtat] = useState<EtatDuControle>('demande')
  const [panne, setPanne] = useState<string | null>(null)
  const premier = useDialogue<HTMLButtonElement>(onFermer)
  // Après la réponse, le premier bouton n'est plus le même : il reprend le focus.
  useEffect(() => {
    premier.current?.focus()
  }, [etat, premier])

  const journal = useInfiniteQuery({
    queryKey: cles.journal,
    queryFn: ({ pageParam, signal }) => lireJournal({ limit: LIMITE, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => curseurSuivant(page),
  })
  const item = itemAuJournal(journal.data?.pages ?? [], billet.log_entry_id) ?? null
  // Le numéro se recalcule sur la boîte de la décennie du film, seulement si elle est déjà lue.
  const decennie = item && item.media.year !== null ? decennieDe(item.media.year) : null
  const boite = decennie === null ? undefined : client.getQueryData<JournalItem[]>(cles.journalDesAnnees(decennie, decennie + 9))
  const montre: BilletMontre | null = item ? { item, numero: boite && decennie !== null ? numeroDe(billetsDeLaDecennie(boite, decennie, depart), item.entry.id) : null } : null

  // Ce que le cache apprend d'une réponse acceptée. Une lecture de l'état partie avant atterrirait
  // après et le ferait attendre encore : elle est annulée d'abord.
  const apprendre = async ({ poincon }: PassageDuControleur) => {
    await client.cancelQueries({ queryKey: cles.voyageur, exact: true })
    client.setQueryData<Voyageur>(
      cles.voyageur,
      (e) => e && { ...e, controleur: { attend: false, billet: null }, poincons: poincon ? [...e.poincons.filter((p) => p.log_entry_id !== poincon.log_entry_id), poincon] : e.poincons },
    )
  }
  const repondre = useMutation({
    mutationFn: (reponse: ReponseAuControleur) => repondreAuControleur(reponse),
    // Ici et non dans le rappel du geste : le casier doit le voir même si la carte est quittée avant
    // la réponse.
    onSuccess: apprendre,
    onError: (erreur) => {
      if (erreur instanceof ApiError && erreur.status === 409) void client.invalidateQueries({ queryKey: cles.voyageur, exact: true })
    },
  })
  const envoi = useRef(false)
  const dire = (reponse: ReponseAuControleur) => {
    if (envoi.current || etat !== 'demande') return
    envoi.current = true
    setPanne(null)
    repondre.mutate(reponse, {
      onSuccess: (passage) => setEtat(passage.reponse),
      onError: (erreur) => {
        if (erreur instanceof ApiError && erreur.status === 409) onFermer()
        else setPanne(erreur instanceof ApiError ? erreur.message : PANNE_DU_CONTROLE)
      },
      onSettled: () => void (envoi.current = false),
    })
  }

  return <Dessin monde={monde} billet={montre} etat={etat} panne={panne} premier={premier} presenter={() => dire('presente')} refuser={() => dire('refuse')} fermer={onFermer} />
}
