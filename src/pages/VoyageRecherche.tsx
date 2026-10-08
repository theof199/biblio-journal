import { useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { estPrete, lireAnnee, lireVoyage, type FicheAnnee } from '../api/voyage'
import { creerRegistre } from '../mondes'
import Panne from '../ui/Panne'
import { useMouvementReduit } from '../ui/mouvement'
import { useRevenir } from '../ui/revenir'
import { aLAffiche, anneesDuCatalogue, catalogue, chercher } from '../voyage/catalogue'
import { anneeCivile, decennieDeLAdresse } from '../voyage/decennie'
import { gabaritDe } from '../voyage/gabarit'
import Catalogue from '../voyage/recherche/Catalogue'
import { noterLeGuichet, relireLeGuichet } from '../voyage/recherche/memoire'
import Tete from '../voyage/recherche/Tete'
import styles from './VoyageRecherche.module.css'

/** Un registre pour la page, comme la page d'une décennie et la boîte ont le leur. */
const mondes = creerRegistre()

/**
 * Le guichet, la recherche du Voyage (plan 2c, décision D7 ; maquette 1890, écran X, `initRecherche`) :
 * `/voyage/decennies/:decennie/recherche`. Même garde d'adresse que la page de la décennie : une
 * adresse qui n'est pas une décennie du Voyage ramène à la carte.
 */
export default function VoyageRecherche() {
  const { decennie } = useParams()
  const { key } = useLocation()
  const d = decennieDeLAdresse(decennie, anneeCivile())
  if (d === null) return <Navigate to="/voyage" replace />
  // Une entrée d'historique, un guichet : une navigation nouvelle vers la même adresse en ouvre un vide.
  return <GuichetDeLaDecennie key={`${d}/${key}`} decennie={d} entree={key} />
}

/**
 * Le catalogue des fiches lues, et ce qui manque encore. Hors du composant : TanStack ne refait la
 * combinaison que si une fiche change (même fonction, mêmes résultats), jamais à chaque lettre tapée.
 */
function lireLeCatalogue(fiches: UseQueryResult<FicheAnnee>[]) {
  const pretes = fiches.flatMap((q) => (estPrete(q.data) ? [q.data] : []))
  return {
    vues: catalogue(pretes),
    // Les années qui ont des salles : une fiche en attente (le second joueur, avant le compte IA) ou
    // verrouillée (hors de ses années lisibles) n'en a pas, et ne se propose pas au guichet.
    lues: pretes.map((f) => f.annee),
    enPanne: fiches.filter((q) => q.isError).length,
    enCours: fiches.some((q) => q.isPending),
  }
}

/** Un écran qu'on touche du doigt : le champ y ouvre un clavier qui couvre le bas de l'écran. */
const auDoigt = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches

/**
 * Le catalogue est celui des salles déjà écrites de la décennie : la page lit la carte, puis la
 * fiche de chaque année **déjà écrite et ouverte** (`anneesDuCatalogue`, le jumeau de l'aperçu de la
 * carte), jamais une autre — lire une année non visitée enfilerait son ouverture chez le
 * chroniqueur, et ouvrirait au second joueur une année que le Voyage suivi n'a pas faite. Rien ne
 * part à la frappe : la recherche se fait sur ce qui est lu.
 *
 * Deux sections sont des dessins que le monde peut composer (`GabaritsDesPages.teteDuGuichet`,
 * `catalogueDuGuichet`). La page garde les lectures, la saisie et sa mémoire, la recherche, le
 * comportement du champ au doigt, le retour et le lien hors du Voyage.
 */
function GuichetDeLaDecennie({ decennie: d, entree }: { decennie: number; entree: string }) {
  const monde = mondes(d)
  const { jetons, mots: m, hauteurs } = monde.pages
  const TeteDuGuichet = gabaritDe(monde, 'teteDuGuichet', Tete)
  const CatalogueDuGuichet = gabaritDe(monde, 'catalogueDuGuichet', Catalogue)
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }
  const calme = useMouvementReduit()
  const revenir = useRevenir(`/voyage/decennies/${d}`)

  // La saisie et les années cochées vivent dans la page, pas dans l'adresse : chaque navigation
  // ramène la zone de contenu en haut (`coque/defilement.ts`), une lettre tapée la ferait sauter.
  // Elles sont retenues sous l'entrée d'historique : le retour d'une fiche de film les retrouve.
  const [retenu] = useState(() => relireLeGuichet(entree, d))
  const [saisie, setSaisie] = useState(retenu.saisie)
  const [cochees, setCochees] = useState<ReadonlySet<number>>(() => new Set(retenu.annees))
  useEffect(() => noterLeGuichet(entree, d, { saisie, annees: [...cochees] }), [entree, d, saisie, cochees])

  const champ = useRef<HTMLInputElement>(null)
  const fenetre = useRef<HTMLFormElement>(null)

  // Le clavier du téléphone couvre le bas de l'écran : sous le bandeau, il ne laisserait voir qu'une
  // ligne du catalogue. Au toucher du champ, la fenêtre monte en haut, une fois ; la frappe ne fait
  // rien bouger. Le clavier ne rétrécit pas la page (Chrome sur Android) : un catalogue court ne
  // laisserait pas la fenêtre monter, la page gagne en bas la hauteur du bandeau tant qu'il est ouvert.
  const [auClavier, setAuClavier] = useState(false)
  useEffect(() => {
    if (auClavier) fenetre.current?.scrollIntoView?.({ block: 'start', behavior: calme ? 'auto' : 'smooth' })
  }, [auClavier, calme])
  // Toucher un résultat retire le doigt du champ **avant** le `click` : rendre la place à cet instant
  // raccourcirait la page sous le doigt, la liste glisserait et le toucher ne tomberait sur rien (vu
  // au navigateur : trois ou quatre résultats, on restait au guichet). Tant qu'un toucher commencé
  // dans la page n'a pas donné son `click` (ou n'est pas devenu un défilement), la place reste ; elle
  // se rend après lui, si le champ n'a plus le doigt.
  const touche = useRef(false)
  const finDuToucher = () => {
    touche.current = false
    if (document.activeElement !== champ.current) setAuClavier(false)
  }

  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const v = voyage.data
  const annees = useMemo(() => (v ? anneesDuCatalogue(v.annees, d) : []), [v, d])
  const { vues, lues, enPanne, enCours } = useQueries({
    queries: annees.map((a) => ({ queryKey: cles.annee(a), queryFn: ({ signal }) => lireAnnee(a, signal) })),
    combine: lireLeCatalogue,
  })
  const filtres = useMemo(() => new Set([...cochees].filter((a) => lues.includes(a))), [cochees, lues])
  // La liste suit la saisie différée : la lettre se montre d'abord, la liste se refait ensuite.
  const cherchee = useDeferredValue(saisie)
  const sansFiltre = cherchee.trim() === '' && filtres.size === 0
  const trouvees = useMemo(() => (sansFiltre ? aLAffiche(vues) : chercher(vues, cherchee, filtres)), [sansFiltre, vues, cherchee, filtres])

  const basculer = (annee: number) =>
    setCochees((avant) => {
      const apres = new Set(avant)
      if (apres.has(annee)) apres.delete(annee)
      else apres.add(annee)
      return apres
    })

  let corps: ReactNode
  if (voyage.error) {
    corps = (
      <div className={styles.etat}>
        <Panne erreur={voyage.error} onReessayer={() => void voyage.refetch()} />
      </div>
    )
  } else if (!v) {
    corps = (
      <p role="status" className={styles.etat}>
        Chargement…
      </p>
    )
  } else {
    let vide: string
    if (!sansFiltre) vide = m.recherche.vide
    else if (vues.length === 0) vide = 'Aucune salle de la décennie n’est encore écrite.'
    else vide = 'Les essentiels de la décennie sont tous vus.'
    corps = (
      <CatalogueDuGuichet
        monde={monde}
        decennie={d}
        annees={lues}
        cochees={filtres}
        onBasculer={basculer}
        vues={trouvees}
        saisie={cherchee}
        aLAffiche={sansFiltre}
        enCours={enCours}
        enPanne={enPanne}
        vide={vide}
      />
    )
  }

  return (
    <section
      className={styles.page}
      style={style}
      aria-label={`${m.recherche.catalogue}, années ${d}`}
      onPointerDownCapture={() => {
        touche.current = true
      }}
      onPointerCancel={finDuToucher}
      onClick={finDuToucher}
    >
      <TeteDuGuichet
        monde={monde}
        decennie={d}
        calme={calme}
        retour={
          // Comme la boîte : un lien vers la décennie, qui recule dans l'historique quand il y a de quoi.
          <Link
            to={`/voyage/decennies/${d}`}
            className={styles.retour}
            aria-label={`Retour aux années ${d}`}
            onClick={(e) => {
              // Ouvrir dans un autre onglet reste au navigateur.
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
              e.preventDefault()
              revenir()
            }}
          >
            <span aria-hidden="true">‹</span>
          </Link>
        }
        guichet={{
          ref: fenetre,
          role: 'search',
          onSubmit: (e) => {
            // Rien ne part : « Rechercher » du clavier ne fait que le replier.
            e.preventDefault()
            touche.current = false
            champ.current?.blur()
          },
        }}
        champ={{
          ref: champ,
          type: 'search',
          enterKeyHint: 'search',
          autoComplete: 'off',
          placeholder: m.recherche.champ,
          'aria-label': m.recherche.champ,
          value: saisie,
          onFocus: () => {
            if (auDoigt()) setAuClavier(true)
          },
          onBlur: () => {
            if (!touche.current) setAuClavier(false)
          },
          onChange: (e) => setSaisie(e.target.value),
        }}
      />

      {corps}

      {/* Hors du catalogue : la recherche du journal (décision D7). */}
      <p className={styles.pied}>
        <Link to="/recherche" className={styles.partout}>
          {m.recherche.partout}
        </Link>
      </p>
      {auClavier ? <div aria-hidden="true" data-testid="place-du-clavier" style={{ height: hauteurs.guichet }} /> : null}
    </section>
  )
}
