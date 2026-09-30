import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../api/client'
import { lireContexte, type FichePrete, type Salle as SalleDeLAnnee } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import { useCalque } from '../calque'
import Feuille from '../Feuille'
import { contexteLisible, doitDemanderContexte } from '../salles'
import NouvelleSalle from './NouvelleSalle'
import Salle from './Salle'
import { majSalle } from './useFournee'

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
 */
export default function Salles({ monde, annee, fiche, ia }: Props) {
  const feuille = useCalque('feuille')
  const ouverte = feuille.valeur?.startsWith(PREFIXE) ? fiche.salles.find((s) => s.id === feuille.valeur!.slice(PREFIXE.length)) : undefined

  return (
    <>
      {fiche.salles.map((s) => (
        <Salle key={s.id} monde={monde} annee={annee} salle={s} ia={ia} onContexte={() => feuille.ouvrir(PREFIXE + s.id)} />
      ))}
      {ia ? <NouvelleSalle monde={monde} annee={annee} pistes={fiche.pistes} demande={fiche.demande_salle} /> : null}
      {ouverte && contexteLisible(ouverte, ia) ? <Contexte monde={monde} annee={annee} salle={ouverte} ia={ia} onFermer={feuille.fermer} /> : null}
    </>
  )
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
