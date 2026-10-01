import { useMemo, useRef, type CSSProperties } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { journalDesAnnees } from '../api/journal'
import { lireTickets, lireVoyage } from '../api/voyage'
import { ambianceDeLHeure } from '../carte/heure'
import { creerRegistre } from '../mondes'
import Panne from '../ui/Panne'
import { useMouvementReduit } from '../ui/mouvement'
import { useRevenir } from '../ui/revenir'
import { PAGES_DE_LA_DECENNIE, anneeCivile, chevaux, decennieDeLAdresse, figureTouchee, palissade, registre, type Figure } from '../voyage/decennie'
import Livret from '../voyage/decennie/Livret'
import Palissade from '../voyage/decennie/Palissade'
import Registre from '../voyage/decennie/Registre'
import { anneauDuPasseport, ceQuiManque, phraseDuPasseport, tamponDe } from '../voyage/passeport'
import { decennieDe, etatDeCase } from '../voyage/regles'
import Toile, { LARGEUR_LOGIQUE } from '../voyage/Toile'
import styles from './VoyageDecennie.module.css'

/** Un registre pour la page, comme la carte et la fiche d'une année ont le leur. */
const mondes = creerRegistre()

/**
 * La page d'une décennie (plan 2c, décision D5 ; maquette 1890, écran IV) : `/voyage/decennies/:decennie`.
 * Une adresse qui n'est pas une décennie du Voyage (pas un multiple de dix, avant 1890, après la
 * décennie de l'année civile à Paris) ramène à la carte.
 */
export default function VoyageDecennie() {
  const { decennie } = useParams()
  const d = decennieDeLAdresse(decennie, anneeCivile())
  if (d === null) return <Navigate to="/voyage" replace />
  return <PageDeLaDecennie key={d} decennie={d} />
}

/**
 * Le manège, le passeport, la palissade et le registre. La page ne lit que la carte, mes tickets
 * et mes films sortis dans la décennie : jamais une fiche d'année, qui enfilerait une ouverture chez
 * le chroniqueur sur une année non visitée, ni tout le journal.
 */
function PageDeLaDecennie({ decennie: d }: { decennie: number }) {
  const monde = mondes(d)
  const { jetons, mots: m, hauteurs } = monde.pages
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }
  const calme = useMouvementReduit()
  const navigate = useNavigate()
  const revenir = useRevenir('/voyage')

  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  // Les tickets, par la requête et la clé de la carte : `GET /me/voyage` ne porte que le ticket à
  // montrer, et le passeport demande si celui de la décennie suivante est utilisé.
  const tickets = useQuery({ queryKey: cles.tickets, queryFn: ({ signal }) => lireTickets(signal) })
  const journal = useQuery({ queryKey: cles.journalDesAnnees(d, d + 9), queryFn: ({ signal }) => journalDesAnnees(d, d + 9, signal) })
  const v = voyage.data

  // Le manège : où se tient chaque figure à l'image en cours (vidé à chaque image), l'instant de la
  // toile, et le dernier toucher hors d'une année qui s'ouvre (il s'emballe).
  const figures = useRef<Figure[]>([])
  const dernierT = useRef(0)
  const touche = useRef(-9)
  const nuit = useMemo(() => {
    const maintenant = new Date()
    return ambianceDeLHeure(maintenant.getHours() + maintenant.getMinutes() / 60).nuit
  }, [])

  if (voyage.isPending) {
    return (
      <section className={styles.page} style={style} aria-label={`Années ${d}`}>
        <p role="status" className={styles.etat}>
          Chargement…
        </p>
      </section>
    )
  }
  if (voyage.error || !v) {
    return (
      <section className={styles.page} style={style} aria-label={`Années ${d}`}>
        <div className={styles.etat}>
          <Panne erreur={voyage.error} onReessayer={() => void voyage.refetch()} />
        </div>
      </section>
    )
  }

  const items = journal.data ?? []
  const lignes = registre(v, items, d)
  const annees = chevaux(v, d)
  const cases = v.annees.filter((a) => decennieDe(a.annee) === d).map((a) => ({ annee: a.annee, etat: etatDeCase(a, v.ia).etat, profondeur: a.profondeur }))
  const tampon = tamponDe(v.tampons, d)
  /** L'année sous le doigt, si elle a sa page ; nulle sinon (aucune figure, ou une année sans page). */
  const anneeOuvrable = (p: { x: number; y: number }) => {
    const annee = figureTouchee(figures.current, p)
    return lignes.find((l) => l.annee === annee)?.ouvrable ? annee : null
  }
  return (
    <section className={styles.page} style={style} aria-label={`Années ${d}`}>
      <div className={styles.bandeau}>
        <Toile
          hauteur={hauteurs.monument}
          libelle={monde.aVenir ? `${m.decennie.annonce} ${d}.` : `${m.decennie.annonce} ${d} : touchez un cheval pour ouvrir son année.`}
          // Le premier contact emballe le manège hors d'une année qui s'ouvre ; il n'ouvre jamais
          // rien : un défilement de la page commence aussi par là.
          onToucher={(p) => {
            if (!calme && anneeOuvrable(p) === null) touche.current = dernierT.current
          }}
          // Le toucher achevé, sans défilement, ouvre l'année de la figure, si elle a sa page.
          onChoisir={(p) => {
            const annee = anneeOuvrable(p)
            if (annee !== null) navigate(`/voyage/${annee}`)
          }}
          dessiner={(ctx, t, vivant) => {
            dernierT.current = t
            figures.current = []
            monde.pages.dessinerMonument({
              ctx,
              W: LARGEUR_LOGIQUE,
              H: hauteurs.monument,
              t,
              vivant,
              nuit,
              annees,
              cases,
              bouclee: tampon !== null,
              touche: touche.current,
              zone: (annee, x, y, r, devant) => void figures.current.push({ annee, x, y, r, devant }),
            })
          }}
        />
        {/* Comme la fiche d'une année : un lien vers la carte, qui recule dans l'historique quand il y a de quoi. */}
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
        {monde.chapitre ? <span className={styles.plaque}>{monde.chapitre}</span> : null}
      </div>

      <div className={styles.fronton}>
        <p className={styles.annonce}>{m.decennie.annonce}</p>
        <h1 className={styles.millesime}>{`Années ${d}`}</h1>
        <p className={styles.monde}>{`${monde.nom} · ${monde.sous}`}</p>
      </div>

      <Livret
        monde={monde}
        decennie={d}
        tampon={tampon}
        anneau={anneauDuPasseport(v.annees, d, v.depart)}
        // Tant que les tickets ne sont pas lus, rien : nourrie d'une liste vide, la phrase réclamerait
        // le ticket de la décennie suivante à qui l'a déjà utilisé.
        manque={
          tickets.data
            ? { type: 'phrase', phrase: phraseDuPasseport(ceQuiManque(v.annees, tickets.data.tickets, d, v.depart), tampon) }
            : tickets.error
              ? { type: 'panne', erreur: tickets.error, onReessayer: () => void tickets.refetch() }
              : { type: 'attente' }
        }
      />

      <h2 className={styles.titreSec}>
        {m.decennie.palissade.titre} <small>{m.decennie.palissade.sous}</small>
      </h2>
      {journal.data ? (
        <Palissade monde={monde} panneaux={palissade(v, journal.data, d)} />
      ) : journal.error ? (
        <div className={styles.panne}>
          <Panne erreur={journal.error} onReessayer={() => void journal.refetch()} />
        </div>
      ) : (
        <p role="status" className={styles.etat}>
          Chargement…
        </p>
      )}

      {/* Sans mon journal, le registre se lit sans ses notes : la panne se dit une fois, sur la palissade. */}
      <Registre monde={monde} lignes={lignes} depart={v.depart} notes={!!journal.data} />

      {/* Seulement les pages qui ont leur route : sans elle, le lien ramènerait à l'accueil. */}
      {PAGES_DE_LA_DECENNIE.length > 0 ? (
        <nav className={styles.liens} aria-label={`Les billets et le catalogue des années ${d}`}>
          {PAGES_DE_LA_DECENNIE.map((p) => (
            <Link key={p} to={`/voyage/decennies/${d}/${p}`} className={styles.lien}>
              {p === 'billets' ? m.boite.titre : m.recherche.catalogue}
            </Link>
          ))}
        </nav>
      ) : null}
    </section>
  )
}
