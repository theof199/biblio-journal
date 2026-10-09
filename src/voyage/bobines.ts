import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { ApiError } from '../api/client'
import type { Session } from '../api/schema'
import { cleDeBobineDuMonde, ramasserUneBobine, type BobineRamassee, type Voyageur } from '../api/voyage'
import { ecrireBobines, lireBobines } from '../carte/memoire'

/**
 * Les bobines perdues entre l'appareil et le compte. **Le compte fait foi là où la carte lit l'état
 * du voyageur** (un membre arrivé en 1900) ; **en 1890, qui ne le lit jamais, l'appareil fait foi** et
 * chaque ramassage s'écrit aussi au compte, sans rien lire. Tout passe ici par les clés **du monde**
 * (à tirets) : la traduction est dans `api/voyage.ts`.
 */

/**
 * Les bobines que le compte tient, par clé du monde. Absent : l'état n'est pas lu, ou en panne sans
 * rien en cache, **ou servi sans le champ** (une API d'avant les bobines au compte, un cache d'avant) :
 * le contrat le dit toujours là, la course d'une livraison non. Sans lui, rien ne se propose, rien
 * n'est versé, rien ne quitte l'appareil.
 */
export const bobinesAuCompte = (voyageur: Voyageur | undefined): readonly string[] | undefined =>
  (voyageur as Partial<Voyageur> | undefined)?.bobines?.map((b) => cleDeBobineDuMonde(b.cle))

/**
 * Ce que le cache apprend d'un ramassage : **son champ, `bobines`, et rien d'autre**. La réponse est
 * une ligne, pas l'état : la poser à sa place effacerait les objets, les rubriques vues, le contrôleur
 * et les poinçons. Rejouée, la ligne déjà rangée reste telle quelle (le serveur garde la première date).
 */
export const rangerLaBobine = (etat: Voyageur | undefined, ligne: BobineRamassee): Voyageur | undefined => {
  const tenues = (etat as Partial<Voyageur> | undefined)?.bobines
  // Un état sans le champ n'est pas lu (`bobinesAuCompte`) : rien n'y est posé, il se relira.
  return etat && tenues && !tenues.some((b) => b.cle === ligne.cle) ? { ...etat, bobines: [...tenues, ligne] } : etat
}

/** Ce que l'appareil tient et que le compte n'a pas : ce qui reste à verser, dans l'ordre de l'appareil. */
export const resteAVerser = (appareil: readonly string[], compte: readonly string[]): string[] => appareil.filter((cle) => !compte.includes(cle))

/**
 * Le serveur refuse **la demande** (`404`, `400`). Le statut ne dit pas pourquoi : une clé hors de son
 * catalogue, mais aussi une route qu'une API plus ancienne ou un mandataire ne connaît pas. Il ne
 * suffit donc pas à abandonner une bobine : `verser` y ajoute ce que les mondes en savent.
 */
export const cleRefusee = (erreur: unknown): boolean => erreur instanceof ApiError && (erreur.status === 404 || erreur.status === 400)

/**
 * Le versement : une clé après l'autre, jamais deux ensemble, chacune une fois par visite.
 *
 * - Acceptée, la clé est **réglée** et quitte l'appareil.
 * - Refusée (`cleRefusee`) : **une clé qu'un monde connaît (`connue`) n'est jamais abandonnée**, elle
 *   reste sur l'appareil et le versement passe à la suivante ; la visite suivante la réessaie. Seule
 *   une clé qu'aucun monde ne connaît est réglée sur un refus : rien ne la ferait accepter un jour.
 * - Toute autre panne (l'API injoignable, un `500`) arrête là, sans rien régler.
 * - `encore` se relit **avant chaque clé** : la carte démontée ou le membre changé, la suivante ne
 *   part pas (elle partirait sous le cookie d'un autre).
 */
export async function verser(
  restantes: readonly string[],
  ramasser: (cle: string) => Promise<unknown>,
  reglee: (cle: string) => void,
  connue: (cle: string) => boolean,
  encore: () => boolean = () => true,
): Promise<void> {
  for (const cle of restantes) {
    if (!encore()) return
    try {
      await ramasser(cle)
    } catch (erreur) {
      if (!cleRefusee(erreur)) return
      if (connue(cle)) continue
    }
    reglee(cle)
  }
}

const sansDoublon = (cles: readonly string[]) => [...new Set(cles)]

/**
 * Les bobines trouvées, pour la carte.
 *
 * - `faitFoi` faux (1890 : la carte ne lit pas l'état du voyageur) : les bobines de l'appareil, comme
 *   avant ; ramasser les y écrit **et** les range au compte, d'une écriture au geste dont l'échec se
 *   tait (l'appareil la tient, le versement la reprendra en 1900).
 * - `faitFoi` vrai : celles du compte (`etat`), plus ce que l'appareil n'a pas encore versé et ce qui
 *   est en main. À la première lecture de l'état, ce que le compte tient déjà quitte l'appareil et le
 *   reste est versé (`verser`), sans rien montrer. Ramasser n'écrit plus qu'au compte : la promesse
 *   rendue échoue avec le refus du serveur, et la bobine reste en main jusqu'à `rendre`.
 *
 * `connue` dit si un monde du registre cache cette bobine : le versement n'abandonne que les autres.
 */
export function useBobinesPerdues(membre: string, faitFoi: boolean, etat: Voyageur | undefined, connue: (cle: string) => boolean) {
  const client = useQueryClient()
  const [appareil, setAppareil] = useState(() => lireBobines(membre))
  const appareilRef = useRef(appareil)
  const [enMain, setEnMain] = useState<readonly string[]>([])
  const enMainRef = useRef(enMain)
  const faitFoiRef = useRef(faitFoi)
  faitFoiRef.current = faitFoi

  // L'appareil se change, il ne se réécrit pas : le stockage est relu d'abord, et ce qu'un autre
  // onglet vient d'y écrire est gardé (deux cartes ouvertes en 1890 s'effaceraient l'une l'autre).
  const retenir = useCallback(
    (changer: (cles: readonly string[]) => readonly string[]) => {
      const clesDeLAppareil = [...changer(sansDoublon([...lireBobines(membre), ...appareilRef.current]))]
      appareilRef.current = clesDeLAppareil
      setAppareil(clesDeLAppareil)
      ecrireBobines(membre, clesDeLAppareil)
    },
    [membre],
  )
  const tenir = useCallback((clesEnMain: readonly string[]) => {
    enMainRef.current = clesEnMain
    setEnMain(clesEnMain)
  }, [])
  // Une lecture de l'état partie avant la réponse atterrirait après et effacerait la ligne : elle est
  // annulée d'abord, comme pour un objet. Jamais le préfixe `voyage` : rien n'est périmé, rien n'est relu.
  const rangerAuCompte = useCallback(
    async (cle: string) => {
      const ligne = await ramasserUneBobine(cle)
      // Partie sous la session de ce membre, revenue après son départ : le cache est celui d'un autre.
      if (client.getQueryData<Session | null>(cles.session)?.user.id !== membre) return
      await client.cancelQueries({ queryKey: cles.voyageur, exact: true })
      client.setQueryData<Voyageur>(cles.voyageur, (e) => rangerLaBobine(e, ligne))
    },
    [client, membre],
  )

  // La visite : celle de ce membre, tant que la carte est montée (la garde de session démonte la
  // carte entre deux membres : `membre` ne change pas sous un crochet monté). Le versement la relit avant chaque
  // clé (`verser`, `encore`) : un `POST` qui pend pendant une déconnexion puis une reconnexion ne
  // laisse pas partir la clé suivante sous le cookie du membre arrivé.
  const verse = useRef(false)
  const visite = useRef({ vivante: true })
  useEffect(() => {
    const laVisite = { vivante: true }
    visite.current = laVisite
    return () => {
      laVisite.vivante = false
      verse.current = false
    }
  }, [membre])

  // Le versement, une fois par visite de la carte, à la première lecture de l'état.
  useEffect(() => {
    const auCompte = bobinesAuCompte(etat)
    if (!faitFoi || !auCompte || verse.current) return
    verse.current = true
    if (appareilRef.current.some((cle) => auCompte.includes(cle))) retenir((cles) => resteAVerser(cles, auCompte))
    const laVisite = visite.current
    void verser(
      resteAVerser(appareilRef.current, auCompte),
      rangerAuCompte,
      (cle) => retenir((cles) => cles.filter((c) => c !== cle)),
      connue,
      () => laVisite.vivante,
    )
  }, [faitFoi, etat, retenir, rangerAuCompte, connue])

  const auCompte = useMemo(() => bobinesAuCompte(etat), [etat])
  const trouvees = useMemo(() => (faitFoi ? sansDoublon([...(auCompte ?? []), ...appareil, ...enMain]) : appareil), [faitFoi, auCompte, appareil, enMain])
  /** Les mêmes, lues à l'instant du geste : les références et le cache, sans attendre un rendu. */
  const connues = useCallback(
    () =>
      faitFoiRef.current
        ? sansDoublon([...(bobinesAuCompte(client.getQueryData<Voyageur>(cles.voyageur)) ?? []), ...appareilRef.current, ...enMainRef.current])
        : appareilRef.current,
    [client],
  )
  /**
   * Une bobine touchée. Nul si elle est déjà connue ou en main : rien ne part. Sinon la promesse de
   * son écriture : là où le compte fait foi, elle échoue avec le refus ; en 1890, elle réussit toujours.
   */
  const ramasser = useCallback(
    (cle: string): Promise<void> | null => {
      if (connues().includes(cle)) return null
      if (!faitFoiRef.current) {
        retenir((cles) => [...cles, cle])
        return rangerAuCompte(cle).catch(() => undefined)
      }
      tenir([...enMainRef.current, cle])
      return rangerAuCompte(cle).then(() => tenir(enMainRef.current.filter((c) => c !== cle)))
    },
    [connues, retenir, tenir, rangerAuCompte],
  )
  /** La bobine refusée quitte la main : le moteur la remontre, le toucher se refait. */
  const rendre = useCallback((cle: string) => tenir(enMainRef.current.filter((c) => c !== cle)), [tenir])

  return { trouvees, lues: !faitFoi || auCompte !== undefined, connues, ramasser, rendre }
}
