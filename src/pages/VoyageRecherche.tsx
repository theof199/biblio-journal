import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import { IconSearch } from '@tabler/icons-react'
import { cles } from '../api/cles'
import { estPrete, lireAnnee, lireVoyage } from '../api/voyage'
import { ambianceDeLHeure } from '../carte/heure'
import { creerRegistre } from '../mondes'
import type { MotsDesPages } from '../mondes/types'
import Panne from '../ui/Panne'
import { useMouvementReduit } from '../ui/mouvement'
import { useRevenir } from '../ui/revenir'
import { aLAffiche, anneesDuCatalogue, catalogue, chercher, passage, type Vue } from '../voyage/catalogue'
import { anneeCivile, decennieDeLAdresse } from '../voyage/decennie'
import Toile, { LARGEUR_LOGIQUE } from '../voyage/Toile'
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
  const d = decennieDeLAdresse(decennie, anneeCivile())
  if (d === null) return <Navigate to="/voyage" replace />
  return <GuichetDeLaDecennie key={d} decennie={d} />
}

/** L'état d'une vue, en clair (maquette : `etatDe`) ; un film perdu dit le mot du monde. */
function etatLisible(v: Vue, m: MotsDesPages): string {
  switch (v.etat) {
    case 'vu':
      return v.note !== null ? `vu · ★ ${v.note}` : 'vu'
    case 'sur_le_plex':
      return 'sur ton Plex'
    case 'a_demander':
      return 'à demander'
    case 'demande':
      return 'demandé'
    case 'introuvable':
      return m.introuvable
  }
}

/** Un texte dont le passage que trouve la saisie est souligné ; tel quel s'il n'y est pas. */
function souligne(texte: string, saisie: string): ReactNode {
  const p = passage(texte, saisie)
  if (!p) return texte
  return (
    <>
      {p.avant}
      <mark>{p.trouve}</mark>
      {p.apres}
    </>
  )
}

/**
 * Le catalogue est celui des salles déjà écrites de la décennie : la page lit la carte, puis la
 * fiche de chaque année **déjà écrite et ouverte** (`anneesDuCatalogue`, le jumeau de l'aperçu de la
 * carte), jamais une autre — lire une année non visitée enfilerait son ouverture chez le
 * chroniqueur, et ouvrirait au second joueur une année que le Voyage suivi n'a pas faite. Rien ne
 * part à la frappe : la recherche se fait sur ce qui est lu.
 */
function GuichetDeLaDecennie({ decennie: d }: { decennie: number }) {
  const monde = mondes(d)
  const { jetons, mots: m, hauteurs } = monde.pages
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }
  const calme = useMouvementReduit()
  const revenir = useRevenir(`/voyage/decennies/${d}`)

  // La saisie et les années cochées vivent dans la page, pas dans l'adresse : chaque navigation
  // ramène la zone de contenu en haut (`coque/defilement.ts`), une lettre tapée la ferait sauter.
  const [saisie, setSaisie] = useState('')
  const [cochees, setCochees] = useState<ReadonlySet<number>>(() => new Set())

  // Le guichet : l'instant de la toile, et celui de la dernière lettre tapée (le guichetier se penche).
  const dernierT = useRef(0)
  const frappe = useRef(-9)
  const champ = useRef<HTMLInputElement>(null)
  const nuit = useMemo(() => {
    const maintenant = new Date()
    return ambianceDeLHeure(maintenant.getHours() + maintenant.getMinutes() / 60).nuit
  }, [])

  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const v = voyage.data
  const annees = v ? anneesDuCatalogue(v.annees, d) : []
  const fiches = useQueries({
    queries: annees.map((a) => ({ queryKey: cles.annee(a), queryFn: ({ signal }) => lireAnnee(a, signal) })),
  })

  const vues = catalogue(fiches.flatMap((q) => (estPrete(q.data) ? [q.data] : [])))
  const enPanne = fiches.filter((q) => q.isError).length
  const enCours = fiches.some((q) => q.isPending)
  const filtres = new Set([...cochees].filter((a) => annees.includes(a)))
  const sansFiltre = saisie.trim() === '' && filtres.size === 0
  const trouvees = sansFiltre ? aLAffiche(vues) : chercher(vues, saisie, filtres)

  const taper = (valeur: string) => {
    if (!calme) frappe.current = dernierT.current
    setSaisie(valeur)
  }
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
      <>
        {annees.length > 0 ? (
          <div className={styles.annees} role="group" aria-label="Années">
            {annees.map((a) => (
              <button key={a} type="button" aria-pressed={filtres.has(a)} onClick={() => basculer(a)}>
                {a}
              </button>
            ))}
          </div>
        ) : null}
        <div className={styles.catalogue}>
          <h1 className={styles.titre}>{m.recherche.catalogue}</h1>
          <p className={styles.sous} aria-live="polite">
            {sansFiltre ? m.recherche.affiche : `${trouvees.length} résultat${trouvees.length > 1 ? 's' : ''}`}
          </p>
          {enCours ? (
            <p role="status" className={styles.rien}>
              Le catalogue se charge…
            </p>
          ) : null}
          {enPanne > 0 ? (
            <p className={styles.rien}>{enPanne === 1 ? 'Une année n’a pas pu être lue.' : `${enPanne} années n’ont pas pu être lues.`}</p>
          ) : null}
          {trouvees.length > 0 ? (
            <ol className={styles.liste} aria-label="Les films du catalogue">
              {trouvees.map((vue, i) => (
                <li key={vue.tmdbId}>
                  <Link to={`/voyage/${vue.annee}/films/${vue.filmId}`} className={styles.entree}>
                    <span className={styles.l1}>
                      <span className={styles.no} aria-hidden="true">{`N° ${i + 1}`}</span>
                      <span className={styles.ti}>{souligne(vue.titre, saisie)}</span>
                      <span className={styles.points} aria-hidden="true" />
                      <span className={styles.an}>{vue.annee}</span>
                    </span>
                    <span className={styles.l2}>
                      <span>{souligne(vue.realisateur, saisie)}</span>
                      <span>{etatLisible(vue, m)}</span>
                    </span>
                    <span className={styles.ouvrir}>{`${m.recherche.ouvrir} ›`}</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : enCours ? null : (
            <p className={styles.rien}>{vide}</p>
          )}
        </div>
      </>
    )
  }

  return (
    <section className={styles.page} style={style} aria-label={`${m.recherche.catalogue}, années ${d}`}>
      <div className={styles.bandeau}>
        <Toile
          hauteur={hauteurs.guichet}
          libelle={`Le guichet des années ${d}.`}
          dessiner={(ctx, t, vivant) => {
            dernierT.current = t
            monde.pages.dessinerGuichet({ ctx, W: LARGEUR_LOGIQUE, H: hauteurs.guichet, t, vivant, nuit, frappe: frappe.current })
          }}
        />
        {/* Comme la boîte : un lien vers la décennie, qui recule dans l'historique quand il y a de quoi. */}
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
      </div>

      <form
        className={styles.fenetre}
        role="search"
        onSubmit={(e) => {
          // Rien ne part : « Rechercher » du clavier ne fait que le replier.
          e.preventDefault()
          champ.current?.blur()
        }}
      >
        <span className={styles.enseigne} aria-hidden="true">
          Guichet
        </span>
        <label>
          <IconSearch aria-hidden="true" />
          <input
            ref={champ}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder={m.recherche.champ}
            aria-label={m.recherche.champ}
            value={saisie}
            onChange={(e) => taper(e.target.value)}
          />
        </label>
      </form>

      {corps}

      {/* Hors du catalogue : la recherche du journal (décision D7). */}
      <p className={styles.pied}>
        <Link to="/recherche" className={styles.partout}>
          {m.recherche.partout}
        </Link>
      </p>
    </section>
  )
}
