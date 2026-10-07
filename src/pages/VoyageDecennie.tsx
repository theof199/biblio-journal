import type { CSSProperties } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { journalDesAnnees } from '../api/journal'
import { lireTickets, lireVoyage } from '../api/voyage'
import { creerRegistre } from '../mondes'
import Panne from '../ui/Panne'
import { useRevenir } from '../ui/revenir'
import { billetsDeLaDecennie } from '../voyage/billets'
import { PAGES_DE_LA_DECENNIE, anneeCivile, arrets, chevaux, decennieDeLAdresse, palissade, type LienDeDecennie } from '../voyage/decennie'
import FrontonParDefaut from '../voyage/decennie/FrontonDeDecennie'
import LiensParDefaut from '../voyage/decennie/Liens'
import LivretParDefaut from '../voyage/decennie/Livret'
import MonumentParDefaut from '../voyage/decennie/Monument'
import OrdreParDefaut from '../voyage/decennie/Ordre'
import Palissade from '../voyage/decennie/Palissade'
import RegistreParDefaut from '../voyage/decennie/Registre'
import { gabaritDe } from '../voyage/gabarit'
import { anneauDuPasseport, ceQuiManque, entreeFaite, phraseDuPasseport, sortieDe, tamponDe } from '../voyage/passeport'
import { decennieDe, etatDeCase, rattrapeBientot, tropLent } from '../voyage/regles'
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
  const { jetons, mots: m } = monde.pages
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }
  const navigate = useNavigate()
  const revenir = useRevenir('/voyage')

  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  // Les tickets, par la requête et la clé de la carte : `GET /me/voyage` ne porte que le ticket à
  // montrer, et le passeport demande si celui de la décennie suivante est utilisé.
  const tickets = useQuery({ queryKey: cles.tickets, queryFn: ({ signal }) => lireTickets(signal) })
  const journal = useQuery({ queryKey: cles.journalDesAnnees(d, d + 9), queryFn: ({ signal }) => journalDesAnnees(d, d + 9, signal) })
  const v = voyage.data

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
  // Le ticket de l'année suivante boucle une année en cours : tant que mes tickets ne sont pas lus,
  // elle ne se dit pas encore bouclée, jamais l'inverse.
  const lignes = arrets(v, items, tickets.data?.tickets ?? [], d)
  const tampon = tamponDe(v.tampons, d)
  const sortie = sortieDe(v.tampons, d)
  const Monument = gabaritDe(monde, 'monument', MonumentParDefaut)
  const Fronton = gabaritDe(monde, 'frontonDeDecennie', FrontonParDefaut)
  const Livret = gabaritDe(monde, 'livret', LivretParDefaut)
  const Registre = gabaritDe(monde, 'registre', RegistreParDefaut)
  const Liens = gabaritDe(monde, 'liensDeDecennie', LiensParDefaut)
  const Ordre = gabaritDe(monde, 'ordreDeDecennie', OrdreParDefaut)
  // Seulement les pages qui ont leur route : sans elle, le lien ramènerait à l'accueil. Le compte de
  // la boîte est celui qu'elle dit en tête (`billetsDeLaDecennie`), sur la lecture que la page fait déjà.
  const liens: LienDeDecennie[] = PAGES_DE_LA_DECENNIE.map((p) => ({
    page: p,
    vers: `/voyage/decennies/${d}/${p}`,
    titre: p === 'billets' ? m.boite.titre : m.recherche.catalogue,
    compte: p === 'billets' && journal.data ? billetsDeLaDecennie(journal.data, d, v.depart).length : null,
  }))
  return (
    <section className={styles.page} style={style} aria-label={`Années ${d}`}>
      <div className={styles.bandeau}>
        <Monument
          monde={monde}
          decennie={d}
          annees={chevaux(v, d)}
          cases={v.annees.filter((a) => decennieDe(a.annee) === d).map((a) => ({ annee: a.annee, etat: etatDeCase(a, v.ia).etat, profondeur: a.profondeur }))}
          bouclee={tampon !== null}
          ouvrable={(annee) => !!lignes.find((l) => l.annee === annee)?.ouvrable}
          onOuvrir={(annee) => navigate(`/voyage/${annee}`)}
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

      <Fronton monde={monde} decennie={d} arrets={lignes} />

      <Ordre
        livret={
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
            sortie={sortie ? { ...sortie, nom: mondes(sortie.decennie).nom } : null}
            entree={entreeFaite(v.annee_en_cours, d)}
          />
        }
        palissade={
          <>
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
          </>
        }
        // Sans mon journal, le registre se lit sans ses notes : la panne se dit une fois, sur la palissade.
        registre={<Registre monde={monde} lignes={lignes} depart={v.depart} notes={!!journal.data} tropLent={tropLent(v.source)} rattrape={rattrapeBientot(v)} />}
        liens={<Liens monde={monde} decennie={d} liens={liens} />}
      />
    </section>
  )
}
