import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lireMesAbonnements, type Abonnement } from '../../api/abonnements'
import { cles } from '../../api/cles'
import { ApiError } from '../../api/client'
import { lireCourrier, marquerCarteLue, posterCartePostale, type CartePostaleEnvoyee, type CartePostaleRecue, type CorpsCartePostale, type Courrier as CourrierLu } from '../../api/voyage'
import type { GabaritsDesPages, Monde } from '../../mondes/types'
import { useSession } from '../../session/SessionContext'
import { useCalque } from '../calque'
import { gabaritSeul } from '../gabarit'
import type { PanneDeBloc } from '../sacoche'
import { motPostable, rangerLaPostee } from './mot'
import commun from './Sacoche.module.css'
import { useVisiteDeRubrique } from './visite'

/**
 * La carte ouverte : reçue ou envoyée, telle que servie. `lue_le` n'existe que sur une carte reçue
 * (le serveur ne le sert qu'au destinataire) : une carte envoyée ne dit rien de sa lecture.
 */
export type CarteOuverte = { sens: 'recue'; carte: CartePostaleRecue } | { sens: 'envoyee'; carte: CartePostaleEnvoyee }

/**
 * La carte à écrire (brief 14) : celle d'une gare de `en_attente`, que l'adresse ouvre (`?ecrire=<année>`).
 * Le dessin tient le brouillon (jamais gardé sur l'appareil : refermée, la carte est blanche), le
 * destinataire choisi et la confirmation ; le bloc tient la lecture de mes abonnements, l'envoi et son
 * verrou. **La gare du destinataire n'est pas connue avant l'envoi** : le serveur la décide et la sert
 * avec la carte postée.
 */
export interface CarteAEcrire {
  /** La gare bouclée d'où part la carte. */
  annee: number
  /** Mon pseudo, pour signer. */
  moi: string
  /** Les membres que je suis et à qui l'on peut écrire (aucun compte désactivé : `api/abonnements.ts`), toutes pages lues, dans l'ordre servi ; nul tant qu'ils ne sont pas lus, ou en panne. Vide : personne à qui écrire. */
  abonnements: readonly Abonnement[] | null
  /** Mes abonnements sont en panne : la carte le dit, et n'offre rien. */
  panne: PanneDeBloc | null
  /** Ce que le serveur a dit d'un envoi refusé ou tombé, tel quel ; la carte reste à écrire. Un `409` aussi, quand sa gare attend encore sa carte. */
  refus: string | null
  /** L'envoi est parti et n'est pas revenu. */
  enCours: boolean
  /** Poste la carte, **pour de bon** : le dessin a demandé la confirmation. Sans effet pour un mot vide ou trop long, ou pendant un envoi. */
  poster: (destinataireId: string, mot: string) => void
}

/**
 * Ce que reçoit le dessin du courrier (`GabaritsDesPages.courrierDeLaSacoche`, sans défaut) : ma
 * boîte **telle que servie** (les reçues de la plus récente à la plus ancienne, « nouvelle » tant que
 * `lue_le` est nul ; les envoyées par gare), la carte que l'adresse ouvre, et le calque.
 * `Courrier.tsx` garde la région, les lectures, les trois écritures (la rubrique vue, la carte lue, la carte postée) et
 * l'adresse : le dessin ne lit ni n'écrit rien. **Le mot d'une carte est un texte d'un autre membre** :
 * il se rend en texte, jamais en HTML, et ne s'écrit ni dans une adresse ni dans un titre.
 */
export interface PropsCourrierDeLaSacoche {
  /** La boîte est en panne : le bloc le dit, et lui seul. */
  panne: PanneDeBloc | null
  /** Mes cartes reçues, dans l'ordre servi ; nul en panne. */
  recues: readonly CartePostaleRecue[] | null
  /** Mes cartes envoyées, dans l'ordre servi ; nul en panne. */
  envoyees: readonly CartePostaleEnvoyee[] | null
  /** La carte ouverte : l'adresse porte son identifiant (`?carte`), le retour du téléphone la referme. Nulle si la boîte ne la connaît pas. */
  ouverte: CarteOuverte | null
  ouvrir: (id: string) => void
  /** Referme ce que l'adresse ouvre : la carte lue, ou la carte à écrire. */
  fermer: () => void
  /** Mes gares bouclées qui attendent leur carte (`en_attente`), **telles que servies** : une carte à écrire pour chacune, et pour elles seules. Nul en panne. */
  enAttente: readonly number[] | null
  /** La carte à écrire que l'adresse ouvre (`?ecrire`) ; nulle si sa gare n'attend pas de carte. */
  aEcrire: CarteAEcrire | null
  /** `ouverte` est la carte qu'on vient de poster : le tampon vient d'être frappé. */
  vientDePartir: boolean
  /** Un `409` à l'envoi dont la gare n'attend plus de carte dans la boîte relue (une carte en est déjà partie), ou arrivé la carte refermée : le message du serveur se dit ici. Si la gare attend encore (le destinataire n'est plus suivi), il se dit sur la carte, restée ouverte (`CarteAEcrire.refus`). */
  refus: string | null
  ecrire: (annee: number) => void
}

/** Le nom du calque dans l'adresse de la sacoche : il porte l'identifiant de la carte, jamais son mot. */
const CALQUE = 'carte'
/** Le calque de la carte à écrire : il porte l'année de sa gare, jamais le brouillon. */
const CALQUE_D_ECRITURE = 'ecrire'
/** L'année d'une gare lue dans l'adresse, ou rien. */
const gareLue = (valeur: string | null): number | null => (valeur !== null && /^\d{1,4}$/.test(valeur) ? Number(valeur) : null)

function trouver(boite: CourrierLu, id: string | null): CarteOuverte | null {
  if (id === null) return null
  const recue = boite.recues.find((c) => c.id === id)
  if (recue) return { sens: 'recue', carte: recue }
  const envoyee = boite.envoyees.find((c) => c.id === id)
  return envoyee ? { sens: 'envoyee', carte: envoyee } : null
}

function CourrierDuVoyageur({ Dessin }: { Dessin: GabaritsDesPages['courrierDeLaSacoche'] }) {
  const client = useQueryClient()
  const { user } = useSession()
  const boite = useQuery({ queryKey: cles.courrier, queryFn: ({ signal }) => lireCourrier(signal) })
  const calque = useCalque(CALQUE)
  const ecriture = useCalque(CALQUE_D_ECRITURE)
  const lue = boite.data ?? null

  // Poster une carte (brief 14). **Elle ne se corrige ni ne se retire** : un verrou par référence
  // (`isPending` ne se voit qu'au rendu suivant), deux touchers ne font qu'un envoi. Le corps porte
  // `annee`, `destinataire_id` et `mot`, rien d'autre : le serveur, strict, décide de l'expéditeur, de
  // la date et de la gare du destinataire. Postée, le cache apprend la carte rendue et sa gare quitte
  // `en_attente`, sur `cles.courrier` en `exact`, une relecture en vol annulée d'abord : **rien n'est
  // périmé**, surtout pas le préfixe `voyage`. Dans `useMutation`, pas dans les rappels de `mutate` :
  // le cache l'apprend même la sacoche quittée.
  const envoi = useRef(false)
  const [refus, setRefus] = useState<{ annee: number | null; message: string } | null>(null)
  const poste = useMutation({
    mutationFn: (corps: CorpsCartePostale) => posterCartePostale(corps),
    onSuccess: async (carte) => {
      await client.cancelQueries({ queryKey: cles.courrier, exact: true })
      client.setQueryData<CourrierLu>(cles.courrier, (b) => (b ? { ...b, envoyees: rangerLaPostee(b.envoyees, carte), en_attente: b.en_attente.filter((a) => a !== carte.annee) } : b))
    },
    // `400` et `409` : le serveur a refusé, la boîte se relit (la gare a pu partir ailleurs), en
    // `exact`. Une panne ne relit rien. **Un `409` attend sa relecture** (la promesse rendue : l'envoi
    // reste en cours, son verrou tenu, et le rappel de `mutate` ne court qu'après) : ce qu'il advient
    // de la carte se décide sur la boîte relue, jamais sur celle d'avant.
    onError: (e) => {
      if (!(e instanceof ApiError) || (e.status !== 400 && e.status !== 409)) return
      const relue = client.invalidateQueries({ queryKey: cles.courrier, exact: true })
      return e.status === 409 ? relue : undefined
    },
    onSettled: () => void (envoi.current = false),
  })

  const gare = gareLue(ecriture.valeur)
  // La carte qu'on vient de poster reste à l'écran, tamponnée, **tant que son calque n'a pas été
  // quitté** : dès que l'adresse ne porte plus sa gare, l'envoi est oublié (le jumeau du guichet fait
  // `dresse.reset()` à la réouverture), et ni « suivant » ni une réouverture ne la remontrent. La carte
  // est aux envoyées, où elle s'ouvre comme une autre. **Une gare de `en_attente` montre toujours sa
  // carte à écrire** : revenue dans la liste (le compte du destinataire supprimé rouvre la gare), la
  // carte postée ne la masque pas.
  const { data: postee, reset: oublier } = poste
  useEffect(() => {
    if (postee && postee.annee !== gare) oublier()
  }, [postee, gare, oublier])
  const partie = gare !== null && postee?.annee === gare && !lue?.en_attente.includes(gare) ? postee : null
  const enVol = gare !== null && poste.isPending && poste.variables?.annee === gare
  // **Une carte à écrire par gare de `en_attente`, et pour elles seules** : une année que la boîte
  // n'attend pas (une gare pas bouclée, une carte déjà partie, une adresse écrite à la main) n'ouvre
  // rien. Elle reste le temps de son envoi : le cache la retire de `en_attente` avant que la carte
  // rendue arrive à l'écran.
  const aEcrire = lue !== null && gare !== null && partie === null && (enVol || lue.en_attente.includes(gare)) ? gare : null
  const parAdresse = lue ? trouver(lue, calque.valeur) : null
  const ouverte: CarteOuverte | null = parAdresse ?? (partie ? { sens: 'envoyee', carte: partie } : null)
  const vientDePartir = partie !== null && ouverte?.carte.id === partie.id

  // Mes abonnements ne se lisent que la carte à écrire ouverte, et se relisent à chaque ouverture :
  // aucune page hors Voyage ne périme cette clé quand je suis ou cesse de suivre un membre.
  const abonnements = useQuery({ queryKey: cles.abonnements, queryFn: ({ signal }) => lireMesAbonnements(signal), enabled: aEcrire !== null, staleTime: 0 })

  // Le dernier calque d'écriture rendu : le rappel d'un envoi court après le rendu qui l'a lancé, et
  // refermer deux fois reculerait de deux entrées dans l'historique.
  const dernier = useRef(ecriture)
  dernier.current = ecriture
  const poster = (annee: number, destinataireId: string, mot: string) => {
    if (envoi.current || !motPostable(mot)) return
    envoi.current = true
    setRefus(null)
    poste.mutate(
      { annee, destinataire_id: destinataireId, mot },
      {
        // **Le message du serveur, tel quel**, jamais un repli. Un `409` n'est pas une panne, et il a
        // deux causes. **La gare n'attend plus sa carte** dans la boîte relue (une carte en est déjà
        // partie) : la carte se referme, si elle est encore celle de l'adresse, et le refus se dit sur
        // la rubrique. **La gare l'attend encore** (le destinataire que je ne suis plus) : la carte
        // reste à écrire, son brouillon intact, le refus se dit sur elle comme un `400`, et mes
        // abonnements se relisent, pour ne plus proposer qui n'est plus suivi. Une boîte qui ne se
        // relit pas garde la gare : la carte reste. Refermée pendant l'envoi, la carte ne se rouvre
        // pas : le refus se dit sur la rubrique. Tout autre refus se dit sur la carte.
        onError: (e) => {
          const conflit = e instanceof ApiError && e.status === 409
          const ouverteIci = gareLue(dernier.current.valeur) === annee
          const attendEncore = client.getQueryData<CourrierLu>(cles.courrier)?.en_attente.includes(annee) ?? false
          if (conflit && !(ouverteIci && attendEncore)) {
            setRefus({ annee: null, message: e.message })
            if (ouverteIci) dernier.current.fermer()
            return
          }
          setRefus({ annee, message: e.message })
          if (conflit) void client.invalidateQueries({ queryKey: cles.abonnements, exact: true })
        },
      },
    )
  }

  // Une carte ouverte, lue ou à écrire, reste à l'écran si la relecture de la boîte tombe en panne,
  // comme la malle : le dialogue ne se referme pas seul sous le doigt. La panne se dit sur la
  // rubrique, la carte refermée.
  const erreur = ouverte || aEcrire !== null ? null : boite.error
  // Le point rouge se date sur les reçues : sans carte reçue, rien à dater, rien à marquer ; en panne non plus.
  useVisiteDeRubrique('courrier', !boite.error && lue !== null && lue.recues.length > 0)

  // Ouvrir une carte **reçue** et pas encore lue la marque lue : une fois par carte (un verrou, pas
  // `isPending`), jamais une carte envoyée (`404`), jamais pendant une relecture de la boîte ni après
  // une relecture en panne (poser la réponse effacerait cette panne). Le cache n'apprend que la carte
  // rendue, dont la date est celle du serveur : « nouvelle » tient jusqu'à sa réponse. Une panne rend
  // le verrou : la carte reste nouvelle, et sa prochaine ouverture la remarque.
  const parties = useRef(new Set<string>())
  const { mutate } = useMutation({
    mutationFn: (id: string) => marquerCarteLue(id),
    // Une relecture de la boîte partie pendant le `POST` rendrait la carte d'avant : annulée d'abord.
    onSuccess: async (carte) => {
      await client.cancelQueries({ queryKey: cles.courrier, exact: true })
      client.setQueryData<CourrierLu>(cles.courrier, (b) => (b ? { ...b, recues: b.recues.map((r) => (r.id === carte.id ? carte : r)) } : b))
    },
    onError: (_, id) => void parties.current.delete(id),
  })
  const aMarquer = ouverte?.sens === 'recue' && ouverte.carte.lue_le === null && !boite.isFetching && !boite.error ? ouverte.carte.id : null
  useEffect(() => {
    if (aMarquer === null || parties.current.has(aMarquer)) return
    parties.current.add(aMarquer)
    mutate(aMarquer)
  }, [aMarquer, mutate])

  // Rien avant la réponse, comme la malle et les objets : la région arrive avec ce qu'elle a à dire.
  if (!erreur && !lue) return null
  return (
    <section className={commun.bloc} aria-label="Courrier">
      <Dessin
        panne={erreur ? { erreur, reessayer: () => void boite.refetch() } : null}
        recues={erreur ? null : lue!.recues}
        envoyees={erreur ? null : lue!.envoyees}
        ouverte={ouverte}
        ouvrir={calque.ouvrir}
        fermer={parAdresse || ecriture.valeur === null ? calque.fermer : ecriture.fermer}
        enAttente={erreur ? null : lue!.en_attente}
        aEcrire={
          aEcrire === null || ouverte
            ? null
            : {
                annee: aEcrire,
                moi: user.pseudo,
                abonnements: abonnements.error ? null : (abonnements.data ?? null),
                panne: abonnements.error ? { erreur: abonnements.error, reessayer: () => void abonnements.refetch() } : null,
                refus: refus?.annee === aEcrire ? refus.message : null,
                enCours: enVol,
                poster: (destinataireId, mot) => poster(aEcrire, destinataireId, mot),
              }
        }
        vientDePartir={vientDePartir}
        refus={refus?.annee === null ? refus.message : null}
        ecrire={(annee) => {
          setRefus(null)
          ecriture.ouvrir(String(annee))
        }}
      />
    </section>
  )
}

/**
 * Le courrier de la sacoche, entre le portefeuille et les objets trouvés. **Sans défaut** : le bloc ne
 * se monte que si le monde de mon année en cours compose `courrierDeLaSacoche` (`gabaritSeul`), et ne
 * lit rien sinon. Monté, il lit ma boîte et l'état du voyageur (par le crochet de la visite), marque
 * la rubrique `courrier` vue une fois par visite quand j'ai reçu une carte, marque lue la carte reçue
 * qu'on ouvre, et tombe seul en panne. **Une carte ne se montre qu'ici.** On y écrit la carte d'une
 * gare bouclée (brief 14) : une par gare de `en_attente`, à un membre que je suis (`api/abonnements.ts`,
 * lus à l'ouverture de la carte à écrire seulement), postée sous un verrou.
 */
export default function Courrier({ monde }: { monde: Monde | null }) {
  const Dessin = monde ? gabaritSeul(monde, 'courrierDeLaSacoche') : null
  return Dessin ? <CourrierDuVoyageur Dessin={Dessin} /> : null
}
