import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lireMesAbonnements } from '../../api/abonnements'
import { cles } from '../../api/cles'
import { ApiError } from '../../api/client'
import type { JournalItem } from '../../api/journal'
import { demanderFilm, marquerIntrouvable, retirerIntrouvable } from '../../api/realisateurs'
import { dresserUneTable, lireVoyage, poserSurLePodium, type CorpsTable, type FilmDeSalle, type Podium, type Tables } from '../../api/voyage'
import { creerRegistre } from '../../mondes'
import type { Monde } from '../../mondes/types'
import Panne from '../../ui/Panne'
import { useCalque } from '../calque'
import Feuillet from '../Feuillet'
import { bobineAVoir, boutonsDuFilm, tmdbVise, type GesteDuGuichet as Geste } from '../film'
import { gabaritDe, gabaritSeul } from '../gabarit'
import { choixDesMarches, corpsPodium, type Candidat } from '../podium'
import { decennieDe } from '../regles'
import { VERS_LE_WAGON } from '../wagon/tables'
import Comptoir from './Comptoir'
import styles from './Guichet.module.css'

const messageDe = (e: unknown, repli: string) => (e instanceof ApiError ? e.message : repli)
const estUnConflit = (e: unknown) => e instanceof ApiError && e.status === 409

/** Un registre pour le guichet : le monde de mon année en cours, où une table se montre. */
const mondes = creerRegistre()
/** Le calque du choix de l'invité, dans l'adresse de la fiche du film. */
const CALQUE_DE_TABLE = 'table'

/**
 * Ce que chaque geste périme, comme la fiche d'un film des Suivis (`pages/FicheFilm.tsx`), son
 * jumeau : la fiche de l'année et la carte (`cles.voyage`) ; une marque « introuvable » change aussi
 * le prochain à voir des filmographies et des sagas ; une demande, les filmographies et le Plex.
 * Oublier les Suivis laisserait la page d'un réalisateur d'où la fiche s'est ouverte (décision D5)
 * sur l'ancien état au retour.
 */
const PERIMES: Record<Geste, readonly (readonly string[])[]> = {
  demander: [cles.voyage, cles.realisateurs, cles.plex],
  introuvable: [cles.voyage, cles.realisateurs, cles.sagas],
  remettre: [cles.voyage, cles.realisateurs, cles.sagas],
}

interface Props {
  monde: Monde
  annee: number
  film: FilmDeSalle
  podium: Podium
  /** Mon dernier visionnage de ce film, retrouvé dans mon journal (seulement pour un film vu). */
  entree: JournalItem | undefined
  /** « Le film » : la feuille du chroniqueur, et son carton. */
  onFilm: () => void
}

/**
 * Le guichet de la fiche d'un film (maquette 1890 : `initFilm`, `.guichet-zone`) : les boutons de
 * `boutonsDuFilm`, dans l'ordre rendu, puis « Le film » toujours. Les écritures sont gardées contre
 * le double toucher (`isPending` ne se voit qu'au rendu suivant), relisent la fiche, et un refus
 * s'affiche tel que l'API l'a écrit.
 *
 * Le dessin est celui du monde (`GabaritsDesPages.guichetDuFilm`), `Comptoir` sinon : ce qui écrit, le
 * verrou, les adresses du billet et le feuillet du podium restent ici.
 *
 * **Dresser une table** (plan des écrans des lots, brief 16, décision 10 : du guichet d'un film du
 * Voyage, pour tout membre). Le geste s'ajoute à `boutonsDuFilm` quand le monde du film **et** celui de
 * mon année en cours composent le wagon-restaurant : le premier le dessine, le second montre la table.
 * Le guichet lit donc la carte, dans un monde qui compose `wagonRestaurant` seulement ; ailleurs il ne
 * lit rien de plus et n'offre rien. L'invité se choisit parmi mes abonnements, lus à l'ouverture du
 * feuillet seulement. Le corps : `invite_id`, `tmdb_id`, rien d'autre ; le serveur décide du soir. Un
 * verrou par référence. `201` : la table rendue se pose en tête de `cles.tables` (si elles sont en
 * cache ; une relecture en vol annulée d'abord, rien de périmé) et la page du wagon s'ouvre **à la
 * place** du feuillet. **Un `409` n'est pas une panne** (j'ai déjà une table ce soir, je ne suis plus
 * ce membre, le film est inconnu) : le feuillet se referme, les tables se relisent, et le message du
 * serveur se dit au guichet, tel quel. Tout autre refus se dit dans le feuillet, qui reste.
 */
export default function Guichet({ monde, annee, film, podium, entree, onFilm }: Props) {
  const client = useQueryClient()
  const feuillet = useCalque('podium')
  // Un programme vu en partie : les gestes visent la bobine qui reste à voir (`tmdbVise`).
  const tmdb = tmdbVise(film)

  const ecrire = useMutation({
    mutationFn: async (g: Geste): Promise<void> => {
      if (g === 'demander') await demanderFilm(tmdb)
      else if (g === 'introuvable') await marquerIntrouvable(tmdb)
      else await retirerIntrouvable(tmdb)
    },
    onSuccess: (_r, g) => {
      for (const cle of PERIMES[g]) void client.invalidateQueries({ queryKey: cle })
    },
  })
  const envoi = useRef(false)
  const geste = (g: Geste) => {
    if (envoi.current) return
    envoi.current = true
    ecrire.mutate(g, { onSettled: () => void (envoi.current = false) })
  }

  // Dresser une table. `enabled` ne retient que la lecture : la carte déjà en cache se rendrait
  // quand même, d'où la garde sur `avecWagon` avant de la regarder.
  const naviguer = useNavigate()
  const avecWagon = gabaritSeul(monde, 'wagonRestaurant') !== null
  const carte = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal), enabled: avecWagon })
  const enCours = avecWagon ? carte.data?.annee_en_cours : undefined
  const tableOfferte = enCours !== undefined && gabaritSeul(mondes(decennieDe(enCours)), 'wagonRestaurant') !== null
  const choix = useCalque(CALQUE_DE_TABLE)
  const [conflit, setConflit] = useState<string | null>(null)
  const envoiDeTable = useRef(false)
  // Dans `useMutation`, pas dans les rappels de `mutate` : le cache l'apprend même la fiche quittée.
  const dresse = useMutation({
    mutationFn: (corps: CorpsTable) => dresserUneTable(corps),
    onSuccess: async (table) => {
      await client.cancelQueries({ queryKey: cles.tables, exact: true })
      client.setQueryData<Tables>(cles.tables, (t) => (t ? { ...t, tables: [table, ...t.tables.filter((x) => x.id !== table.id)] } : t))
    },
    onError: (e) => {
      if (estUnConflit(e)) void client.invalidateQueries({ queryKey: cles.tables, exact: true })
    },
    onSettled: () => void (envoiDeTable.current = false),
  })
  // Le dernier calque rendu : le rappel d'un envoi court après le rendu qui l'a lancé, et refermer
  // deux fois reculerait de deux entrées dans l'historique.
  const dernier = useRef(choix)
  dernier.current = choix
  const dresser = (inviteId: string) => {
    if (envoiDeTable.current) return
    envoiDeTable.current = true
    dresse.mutate(
      { invite_id: inviteId, tmdb_id: tmdb },
      {
        // La page du wagon prend la place du feuillet dans l'historique : le retour ramène à la fiche,
        // feuillet fermé. Refermé pendant l'envoi, on reste sur la fiche : la table est au cache.
        onSuccess: () => {
          if (dernier.current.valeur !== null) naviguer(VERS_LE_WAGON, { replace: true })
        },
        onError: (e) => {
          if (!estUnConflit(e)) return
          setConflit((e as ApiError).message)
          dernier.current.fermer()
        },
      },
    )
  }
  const ouvrirLeChoix = () => {
    dresse.reset()
    setConflit(null)
    choix.ouvrir('choisir')
  }

  // Un programme monte sur le podium par sa ligne de salle, un film par son identifiant TMDB.
  const cible: Candidat = film.programme
    ? { type: 'programme', programmeId: film.id, titre: film.title, affiche: film.cover_url }
    : { type: 'film', tmdbId: tmdb, titre: film.title, affiche: film.cover_url, note: film.note }
  const billet = `/voyage/${annee}/films/${film.id}/billet`
  // Un programme se note bobine par bobine, et porte l'identifiant TMDB de sa première bobine
  // (l'API) : sans `?bobine=`, le billet noterait la première, fût-elle déjà vue. « Je l'ai vu »
  // ouvre donc celui de la première bobine qui reste à voir (un programme non vu en a toujours une).
  const aVoir = bobineAVoir(film)
  const billetVu = aVoir ? `${billet}?bobine=${aVoir.tmdb_id}` : billet

  const Dessin = gabaritDe(monde, 'guichetDuFilm', Comptoir)
  return (
    <>
      <Dessin
        monde={monde}
        film={film}
        boutons={boutonsDuFilm(film.etat, film.plex_url, entree !== undefined, tableOfferte)}
        billet={{ vu: billetVu, corriger: `${billet}/corriger` }}
        entree={entree}
        occupe={ecrire.isPending}
        erreur={conflit ?? (ecrire.error ? messageDe(ecrire.error, 'Le guichet n’a pas pu l’écrire. Réessaie.') : null)}
        onEcrire={geste}
        onPodium={() => feuillet.ouvrir('choisir')}
        onTable={ouvrirLeChoix}
        onFilm={onFilm}
      />
      {feuillet.valeur === 'choisir' ? (
        <Feuillet monde={monde} titre="Mettre sur le podium" onFermer={feuillet.fermer}>
          <ChoixDuPodium annee={annee} podium={podium} cible={cible} onFermer={feuillet.fermer} />
        </Feuillet>
      ) : null}
      {tableOfferte && choix.valeur === 'choisir' ? (
        <Feuillet monde={monde} titre="Dresser une table" onFermer={choix.fermer}>
          <ChoixDeLInvite
            titre={film.title}
            enCours={dresse.isPending}
            erreur={dresse.error && !estUnConflit(dresse.error) ? messageDe(dresse.error, 'La table n’a pas pu être dressée. Réessaie.') : null}
            onDresser={dresser}
          />
        </Feuillet>
      ) : null}
    </>
  )
}

interface PropsInvite {
  titre: string
  enCours: boolean
  /** Un refus qui n'est pas un `409`, ou une panne : il se dit ici, et le feuillet reste. */
  erreur: string | null
  onDresser: (inviteId: string) => void
}

/**
 * Le feuillet « Dresser une table » : l'invité se choisit parmi **tous** mes abonnements
 * (`api/abonnements.ts`), lus à l'ouverture seulement et relus à chaque ouverture (aucune page hors
 * Voyage ne périme cette clé). **Choisir n'envoie rien** : une table dressée ne se retire pas, le
 * bouton seul l'envoie. Un membre désactivé reste proposé : le serveur refuse. Sans abonnement, le
 * feuillet le dit et n'offre rien.
 */
function ChoixDeLInvite({ titre, enCours, erreur, onDresser }: PropsInvite) {
  const abonnements = useQuery({ queryKey: cles.abonnements, queryFn: ({ signal }) => lireMesAbonnements(signal), staleTime: 0 })
  const [choisi, setChoisi] = useState<string | null>(null)
  if (abonnements.error) return <Panne erreur={abonnements.error} onReessayer={() => void abonnements.refetch()} />
  if (!abonnements.data) return <p role="status">Chargement…</p>
  if (abonnements.data.length === 0) return <p className={styles.aide}>Tu ne suis encore personne : une table se dresse pour un membre que tu suis.</p>
  const pret = choisi !== null && !enCours
  return (
    <form
      className={styles.table}
      onSubmit={(e) => {
        e.preventDefault()
        if (pret) onDresser(choisi)
      }}
    >
      <p className={styles.aide}>{`${titre}, à deux, ce soir seulement. Une table dressée ne se retire pas.`}</p>
      <fieldset className={styles.invites}>
        <legend>Qui inviter ?</legend>
        {abonnements.data.map((m) => (
          <label key={m.id}>
            <input type="radio" name="invite" value={m.id} checked={choisi === m.id} onChange={() => setChoisi(m.id)} />
            <span>{m.pseudo}</span>
          </label>
        ))}
      </fieldset>
      {erreur ? (
        <p role="alert" className={styles.erreurFeuillet}>
          {erreur}
        </p>
      ) : null}
      <button type="submit" className={styles.dresser} aria-disabled={!pret}>
        Dresser la table
      </button>
    </form>
  )
}

interface PropsChoix {
  annee: number
  podium: Podium
  cible: Candidat
  onFermer: () => void
}

/**
 * Le feuillet « Mettre sur le podium » : une ligne par marche, celle qui porte déjà ce film cochée
 * (`choixDesMarches`). Le feuillet porte sa mutation : sa fermeture passe par les rappels de
 * `mutate`, qui se taisent une fois le feuillet démonté (le « retour » du téléphone pendant l'envoi) ;
 * une mutation qui lui survivrait reculerait une seconde fois, hors de la fiche.
 */
function ChoixDuPodium({ annee, podium, cible, onFermer }: PropsChoix) {
  const client = useQueryClient()
  const poser = useMutation({
    mutationFn: (place: number) => poserSurLePodium(annee, place, corpsPodium(cible)),
    // La fiche et la carte (l'affiche du n°1) se relisent.
    onSuccess: () => void client.invalidateQueries({ queryKey: cles.voyage }),
  })
  const envoi = useRef(false)
  const choisir = (place: number) => {
    if (envoi.current) return
    envoi.current = true
    poser.mutate(place, { onSuccess: onFermer, onSettled: () => void (envoi.current = false) })
  }

  return (
    <>
      <ul className={styles.marches}>
        {choixDesMarches(podium, cible).map((c) => (
          <li key={c.place}>
            <button type="button" aria-pressed={c.cochee} disabled={poser.isPending} onClick={() => choisir(c.place)}>
              <span className={styles.place}>{c.place}</span>
              <span>{c.occupant ?? 'à venir'}</span>
            </button>
          </li>
        ))}
      </ul>
      {poser.error ? (
        <p role="alert" className={styles.erreurFeuillet}>
          {messageDe(poser.error, 'Le podium n’a pas pu s’écrire. Réessaie.')}
        </p>
      ) : null}
    </>
  )
}
