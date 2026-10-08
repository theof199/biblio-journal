import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { lireCourrier, marquerCarteLue, type CartePostaleEnvoyee, type CartePostaleRecue, type Courrier as CourrierLu } from '../../api/voyage'
import type { GabaritsDesPages, Monde } from '../../mondes/types'
import { useCalque } from '../calque'
import { gabaritSeul } from '../gabarit'
import type { PanneDeBloc } from '../sacoche'
import commun from './Sacoche.module.css'
import { useVisiteDeRubrique } from './visite'

/**
 * La carte ouverte : reçue ou envoyée, telle que servie. `lue_le` n'existe que sur une carte reçue
 * (le serveur ne le sert qu'au destinataire) : une carte envoyée ne dit rien de sa lecture.
 */
export type CarteOuverte = { sens: 'recue'; carte: CartePostaleRecue } | { sens: 'envoyee'; carte: CartePostaleEnvoyee }

/**
 * Ce que reçoit le dessin du courrier (`GabaritsDesPages.courrierDeLaSacoche`, sans défaut) : ma
 * boîte **telle que servie** (les reçues de la plus récente à la plus ancienne, « nouvelle » tant que
 * `lue_le` est nul ; les envoyées par gare), la carte que l'adresse ouvre, et le calque.
 * `Courrier.tsx` garde la région, la lecture, les deux écritures (la rubrique vue, la carte lue) et
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
  fermer: () => void
}

/** Le nom du calque dans l'adresse de la sacoche : il porte l'identifiant de la carte, jamais son mot. */
const CALQUE = 'carte'

function trouver(boite: CourrierLu, id: string | null): CarteOuverte | null {
  if (id === null) return null
  const recue = boite.recues.find((c) => c.id === id)
  if (recue) return { sens: 'recue', carte: recue }
  const envoyee = boite.envoyees.find((c) => c.id === id)
  return envoyee ? { sens: 'envoyee', carte: envoyee } : null
}

function CourrierDuVoyageur({ Dessin }: { Dessin: GabaritsDesPages['courrierDeLaSacoche'] }) {
  const client = useQueryClient()
  const boite = useQuery({ queryKey: cles.courrier, queryFn: ({ signal }) => lireCourrier(signal) })
  const calque = useCalque(CALQUE)
  const lue = boite.data ?? null
  const ouverte = lue ? trouver(lue, calque.valeur) : null
  // Une carte ouverte reste à l'écran si la relecture de la boîte tombe en panne, comme la malle : le
  // dialogue ne se referme pas seul sous le doigt. La panne se dit sur la rubrique, la carte refermée.
  const erreur = ouverte ? null : boite.error
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
        fermer={calque.fermer}
      />
    </section>
  )
}

/**
 * Le courrier de la sacoche, entre le portefeuille et les objets trouvés. **Sans défaut** : le bloc ne
 * se monte que si le monde de mon année en cours compose `courrierDeLaSacoche` (`gabaritSeul`), et ne
 * lit rien sinon. Monté, il lit ma boîte et l'état du voyageur (par le crochet de la visite), marque
 * la rubrique `courrier` vue une fois par visite quand j'ai reçu une carte, marque lue la carte reçue
 * qu'on ouvre, et tombe seul en panne. **Une carte ne se montre qu'ici.** On n'y écrit pas de carte.
 */
export default function Courrier({ monde }: { monde: Monde | null }) {
  const Dessin = monde ? gabaritSeul(monde, 'courrierDeLaSacoche') : null
  return Dessin ? <CourrierDuVoyageur Dessin={Dessin} /> : null
}
