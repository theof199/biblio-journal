import { useRef, useState, type CSSProperties } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { ApiError } from '../api/client'
import { declinerLaTable, lireTables, lireVoyage, prendreMaPlace, type Tables, type Voyage } from '../api/voyage'
import { creerRegistre } from '../mondes'
import type { GabaritsDesPages, Monde } from '../mondes/types'
import { useSession } from '../session/SessionContext'
import { useRevenir } from '../ui/revenir'
import { gabaritSeul } from '../voyage/gabarit'
import { decennieDe } from '../voyage/regles'
import { gestesOfferts, roleA, soirPasse } from '../voyage/wagon/tables'
import styles from './VoyageWagonRestaurant.module.css'

/** Un registre pour la page, comme la sacoche a le sien. */
const mondes = creerRegistre()

/** Le départ du Voyage, tel que le contrat le fige : la décennie de la page quand la carte est en panne. */
const DEPART: Voyage['depart'] = 1895

type Geste = { id: string; quoi: 'place' | 'decliner' }

/**
 * Mes tables, lues et écrites. Monté seulement dans un monde qui compose `wagonRestaurant`.
 *
 * **Deux écritures, un verrou** (une référence : `isPending` ne se voit qu'au rendu suivant) : deux
 * touchers ne font qu'un appel. Acceptée, la table rendue se pose à sa place sur `cles.tables`, en
 * `exact`, une relecture en vol annulée d'abord (atterrie après, elle rendrait la table d'avant) :
 * **rien n'est périmé**, surtout pas le préfixe `voyage`. **Un `409` n'est pas une panne** (le soir
 * est passé, la table est déclinée, je suis déjà à table ce soir) : les tables se relisent, en
 * `exact`, et son message se dit sur sa table (règle commune 4 : sans lui, « Prendre ma place » sur une
 * seconde invitation du même soir ne répondait rien). Tout autre refus s'y dit aussi, par le message
 * du serveur, sans relecture, et se refait. Le refus s'efface au geste suivant.
 * Dans `useMutation`, pas dans les rappels de `mutate` : le cache l'apprend même la page quittée.
 */
function TablesDuVoyageur({ monde, Dessin }: { monde: Monde; Dessin: GabaritsDesPages['wagonRestaurant'] }) {
  const client = useQueryClient()
  const { user } = useSession()
  const lues = useQuery({ queryKey: cles.tables, queryFn: ({ signal }) => lireTables(signal) })
  const envoi = useRef(false)
  const [refus, setRefus] = useState<{ id: string; message: string } | null>(null)
  const geste = useMutation({
    mutationFn: ({ id, quoi }: Geste) => (quoi === 'place' ? prendreMaPlace(id) : declinerLaTable(id)),
    onSuccess: async (table) => {
      await client.cancelQueries({ queryKey: cles.tables, exact: true })
      client.setQueryData<Tables>(cles.tables, (t) => (t ? { ...t, tables: t.tables.map((x) => (x.id === table.id ? table : x)) } : t))
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) void client.invalidateQueries({ queryKey: cles.tables, exact: true })
    },
    onSettled: () => void (envoi.current = false),
  })
  const ecrire = (g: Geste) => {
    if (envoi.current) return
    envoi.current = true
    setRefus(null)
    geste.mutate(g, { onError: (e) => setRefus({ id: g.id, message: e.message }) })
  }

  // Rien avant la réponse : la page attend ses tables comme elle a attendu la carte.
  if (!lues.error && !lues.data) {
    return (
      <p role="status" className={styles.etat}>
        Chargement…
      </p>
    )
  }
  // L'horloge de l'appareil ne sert qu'à cacher un geste que le serveur refuserait : lue à chaque rendu.
  const maintenant = Date.now()
  return (
    <Dessin
      monde={monde}
      moi={user.pseudo}
      panne={lues.error ? { erreur: lues.error, reessayer: () => void lues.refetch() } : null}
      tables={
        lues.error
          ? null
          : lues.data!.tables.map((table) => ({
              table,
              role: roleA(table, user.id),
              passee: soirPasse(table.soir, maintenant),
              gestes: gestesOfferts(table, user.id, maintenant),
              enCours: geste.isPending && geste.variables?.id === table.id,
              refus: refus?.id === table.id ? refus.message : null,
            }))
      }
      prendre={(id) => ecrire({ id, quoi: 'place' })}
      decliner={(id) => ecrire({ id, quoi: 'decliner' })}
    />
  )
}

/**
 * Le wagon-restaurant (`/voyage/wagon-restaurant`, plan des écrans des lots, brief 15) : mes tables,
 * celles que j'ai dressées et celles où je suis invité. Une route, un segment fixe que React Router
 * préfère à `voyage/:annee` (décision 2 du propriétaire). Habillée par le monde de mon année en cours.
 *
 * **Son dessin est une clé de gabarit sans défaut** (`wagonRestaurant`) : dans un monde qui ne la
 * compose pas (1890, « à venir », ou la carte en panne, qui rend le monde du départ), la page renvoie
 * à la carte **et ne lit aucune table**. La lecture des tables vit dans un composant monté après la
 * clé, jamais avant. Tant que la carte n'a pas répondu, aucun monde n'habille rien : la page attend.
 * Aucune fiche d'année n'est lue.
 */
export default function VoyageWagonRestaurant() {
  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const revenir = useRevenir('/voyage')
  const enCours = voyage.data?.annee_en_cours ?? (voyage.error ? DEPART : null)
  const monde = enCours === null ? null : mondes(decennieDe(enCours))
  const Dessin = monde ? gabaritSeul(monde, 'wagonRestaurant') : null
  if (monde && !Dessin) return <Navigate to="/voyage" replace />
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: (CSSProperties & Record<string, string>) | undefined = monde ? { ...monde.pages.jetons } : undefined

  return (
    <section className={styles.page} style={style} aria-label="Le wagon-restaurant">
      <Link
        to="/voyage"
        className={styles.retour}
        aria-label="Retour à la carte"
        onClick={(e) => {
          // Ouvrir dans un autre onglet reste au navigateur.
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
          e.preventDefault()
          revenir()
        }}
      >
        <span aria-hidden="true">‹</span>
      </Link>
      {monde && Dessin ? (
        <TablesDuVoyageur monde={monde} Dessin={Dessin} />
      ) : (
        <p role="status" className={styles.etat}>
          Chargement…
        </p>
      )}
    </section>
  )
}
