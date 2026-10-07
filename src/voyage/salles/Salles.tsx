import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../api/client'
import { lireContexte, type FichePrete, type Salle as SalleDeLAnnee } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import { useCalque } from '../calque'
import Feuille from '../Feuille'
import { gabaritDe } from '../gabarit'
import { contexteLisible, doitDemanderContexte, numeroDeLaSalle } from '../salles'
import NouvelleSalle from './NouvelleSalle'
import Rayons from './Rayons'
import Salle, { type PropsSalle } from './Salle'
import { majSalle, useFournee } from './useFournee'

/** Le paramètre de la feuille d'une salle : `?feuille=salle-<id>`. */
const PREFIXE = 'salle-'

interface Props {
  monde: Monde
  annee: number
  fiche: Pick<FichePrete, 'salles' | 'pistes' | 'demande_salle'>
  ia: boolean
}

/**
 * Les salles d'une fiche prête (plan 2b, tâche 8), dans l'ordre de l'API, puis « Ouvrir une
 * nouvelle salle » au compte IA seulement (un membre hors IA ne voit aucun geste que l'API lui
 * refuse). Le contexte d'une salle s'ouvre sur la feuille du chroniqueur, dans l'adresse.
 *
 * Le cadre des salles et chaque salle sont des sections que le monde peut composer (`gabarits.salles`,
 * `gabarits.salle`). Ce qui lit ou écrit reste ici : « En voir plus » et son guet, le contexte, la
 * nouvelle salle, et les calques de l'adresse, dont `voiture`, qui dit quelle salle est dépliée pour
 * un monde qui range ses films derrière elle.
 */
export default function Salles({ monde, annee, fiche, ia }: Props) {
  const feuille = useCalque('feuille')
  const voiture = useCalque('voiture')
  const ouverte = feuille.valeur?.startsWith(PREFIXE) ? fiche.salles.find((s) => s.id === feuille.valeur!.slice(PREFIXE.length)) : undefined
  const LesSalles = gabaritDe(monde, 'salles', Rayons)

  return (
    <>
      <LesSalles monde={monde} annee={annee} salles={fiche.salles}>
        {fiche.salles.map((s) => (
          <SalleGuettee
            key={s.id}
            monde={monde}
            annee={annee}
            salle={s}
            ia={ia}
            onContexte={() => feuille.ouvrir(PREFIXE + s.id)}
            numero={numeroDeLaSalle(s)}
            ouverte={voiture.valeur === s.id}
            onOuvrir={() => voiture.ouvrir(s.id)}
            onFermer={voiture.fermer}
          />
        ))}
      </LesSalles>
      {ia ? <NouvelleSalle monde={monde} annee={annee} pistes={fiche.pistes} demande={fiche.demande_salle} /> : null}
      {ouverte && contexteLisible(ouverte, ia) ? <Contexte monde={monde} annee={annee} salle={ouverte} ia={ia} onFermer={feuille.fermer} /> : null}
    </>
  )
}

/**
 * Une salle et sa fournée : « En voir plus » et le guet d'une salle qui se remplit vivent ici, une
 * fois par salle, que le monde la montre dépliée ou non ; le composant de la salle n'en reçoit que
 * les gestes.
 */
function SalleGuettee(props: Omit<PropsSalle, 'fournee'>) {
  const UneSalle = gabaritDe(props.monde, 'salle', Salle)
  const fournee = useFournee(props.annee, props.salle)
  return <UneSalle {...props} fournee={fournee} />
}

/**
 * La feuille du contexte d'une salle : le texte déjà écrit se lit tel quel, sans appel ; sinon, au
 * compte IA seulement, il s'écrit à sa première lecture (synchrone) et s'inscrit dans la fiche en
 * cache : rouvrir la feuille ne le redemande pas.
 */
function Contexte({ monde, annee, salle, ia, onFermer }: { monde: Monde; annee: number; salle: SalleDeLAnnee; ia: boolean; onFermer: () => void }) {
  const client = useQueryClient()
  const demande = useQuery({
    queryKey: ['voyage', 'contexte', salle.id],
    queryFn: () => lireContexte(annee, salle.id),
    // `ia` redit ce que `contexteLisible` garde déjà au montage de la feuille : jamais un `403` demandé.
    enabled: ia && doitDemanderContexte(salle),
    retry: false,
    staleTime: Infinity,
  })
  const ecrit = demande.data?.contexte
  useEffect(() => {
    if (ecrit === undefined) return
    majSalle(client, annee, salle.id, (s) => ({ ...s, contexte: ecrit }))
  }, [client, annee, salle.id, ecrit])

  const texte = salle.contexte ?? ecrit ?? null
  return (
    <Feuille
      monde={monde}
      quoi="salle"
      esp="Salle"
      titre={salle.nom}
      sous={String(annee)}
      etat={
        texte !== null
          ? { type: 'texte', texte }
          : demande.error
            ? { type: 'erreur', message: demande.error instanceof ApiError ? demande.error.message : 'Le contexte n’a pas pu s’écrire. Réessaie.' }
            : { type: 'attente' }
      }
      onReessayer={() => void demande.refetch()}
      onFermer={onFermer}
    />
  )
}
