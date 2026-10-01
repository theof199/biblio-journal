import { useEffect, useState, type CSSProperties } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { journalDesAnnees } from '../api/journal'
import { lireVoyage, type FicheAnnee } from '../api/voyage'
import { creerRegistre } from '../mondes'
import { useSession } from '../session/SessionContext'
import { formatDateVisionnage } from '../ui/format'
import Panne from '../ui/Panne'
import { useRevenir } from '../ui/revenir'
import { billetRange, oublierLeBillet } from '../voyage/billet/range'
import { billetsDeLaDecennie, casier, intercalaires, numeroLisible } from '../voyage/billets'
import Casier from '../voyage/boite/Casier'
import { filmDuVisionnage } from '../voyage/boite/correction'
import Visionneuse from '../voyage/boite/Visionneuse'
import { useCalque } from '../voyage/calque'
import { anneeCivile, decennieDeLAdresse } from '../voyage/decennie'
import styles from './VoyageBoite.module.css'

/** Un registre pour la page, comme la carte et la page d'une décennie ont le leur. */
const mondes = creerRegistre()

/**
 * La boîte à billets d'une décennie (plan 2c, idée 5 ; maquette 1890, écran VII) :
 * `/voyage/decennies/:decennie/billets`. Même garde d'adresse que la page de la décennie : une
 * adresse qui n'est pas une décennie du Voyage ramène à la carte.
 */
export default function VoyageBoite() {
  const { decennie } = useParams()
  const d = decennieDeLAdresse(decennie, anneeCivile())
  if (d === null) return <Navigate to="/voyage" replace />
  return <BoiteDeLaDecennie key={d} decennie={d} />
}

/**
 * Un billet par visionnage d'un film sorti dans la décennie, numéroté du premier vu au dernier
 * (décision D3, `billetsDeLaDecennie` : le même numéro que le billet tamponné). La page ne lit que
 * la carte (pour le départ du Voyage) et mes films de la décennie : jamais une fiche d'année, qui
 * enfilerait une ouverture chez le chroniqueur. L'intercalaire choisi vit dans l'adresse
 * (`?annee=1897`), le billet ouvert en grand aussi (`?billet=<id>`) : le geste « retour » le ferme.
 */
function BoiteDeLaDecennie({ decennie: d }: { decennie: number }) {
  const monde = mondes(d)
  const { jetons, mots: m } = monde.pages
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }
  const client = useQueryClient()
  const { user } = useSession()
  const revenir = useRevenir(`/voyage/decennies/${d}`)
  const [params, poser] = useSearchParams()
  const vue = useCalque('billet')

  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const journal = useQuery({ queryKey: cles.journalDesAnnees(d, d + 9), queryFn: ({ signal }) => journalDesAnnees(d, d + 9, signal) })
  const v = voyage.data

  // Le billet que la séance vient de ranger, lu une fois à l'ouverture : le liseré tient tant que la
  // page reste montée, même une fois la boîte l'ayant oublié.
  const [rangee] = useState(() => billetRange(user.id))
  // La carte dit le départ du Voyage : sans elle, ni billet ni numéro (un film d'avant le départ
  // n'en a pas, et le compter décalerait tous les numéros).
  const billets = v && journal.data ? billetsDeLaDecennie(journal.data, d, v.depart) : null
  const nouveau = rangee !== null ? (billets?.find((b) => b.item.entry.id === rangee) ?? null) : null
  const anneeDuNouveau = nouveau?.item.media.year ?? null

  const liste = v && billets ? intercalaires(billets, d, v.depart) : []
  const demandee = Number(params.get('annee'))
  const choisi = liste.some((i) => i.annee === demandee) ? demandee : null
  const choisir = (annee: number | null) => {
    const suivants = new URLSearchParams(params)
    if (annee === null) suivants.delete('annee')
    else suivants.set('annee', String(annee))
    poser(suivants, { replace: true })
  }

  // Le billet rangé : son casier s'ouvre, puis la boîte l'oublie (il n'est montré qu'une fois).
  // Un billet rangé d'une autre décennie reste pour la boîte qui le porte. La carte attendue (elle
  // fait les billets et les intercalaires), rien ne se tranche avant elle. Chaque billet de la boîte a
  // son intercalaire : un film d'avant le départ n'y est pas.
  const pret = anneeDuNouveau !== null && liste.length > 0
  useEffect(() => {
    if (!pret) return
    if (choisi !== null && choisi !== anneeDuNouveau) choisir(anneeDuNouveau)
    oublierLeBillet()
    // Une fois, quand le billet paraît dans la boîte et que la carte est lue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret, anneeDuNouveau])

  const ouvert = vue.valeur !== null && billets ? (billets.find((b) => b.item.entry.id === vue.valeur) ?? null) : null
  // Un `?billet=` qui ne désigne aucun billet de la boîte se ferme, une fois la boîte lue.
  const inconnu = vue.valeur !== null && billets !== null && ouvert === null
  useEffect(() => {
    if (inconnu) vue.fermer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inconnu])

  const entete = (
    <>
      {/* Comme la page de la décennie : un lien vers elle, qui recule dans l'historique quand il y a de quoi. */}
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
      <div className={styles.tete}>
        <span className={styles.sur}>{`${m.boite.sur} · années ${d}`}</span>
        <h1 className={styles.titre}>{m.boite.titre}</h1>
        {billets ? <p className={styles.compte}>{billets.length === 0 ? 'Aucun billet encore' : `${billets.length} billet${billets.length > 1 ? 's' : ''}, un par visionnage`}</p> : null}
      </div>
    </>
  )

  let corps
  if (voyage.error || journal.error) {
    const erreur = voyage.error ?? journal.error
    corps = (
      <div className={styles.etat}>
        <Panne
          erreur={erreur}
          onReessayer={() => {
            if (voyage.error) void voyage.refetch()
            if (journal.error) void journal.refetch()
          }}
        />
      </div>
    )
  } else if (!v || !billets) {
    corps = (
      <p role="status" className={styles.etat}>
        Chargement…
      </p>
    )
  } else {
    const premier = billets[0]
    const dernier = billets[billets.length - 1]
    corps = (
      <>
        <Casier
          monde={monde}
          intercalaires={liste}
          choisi={choisi}
          onChoisir={choisir}
          billets={casier(billets, choisi)}
          nouveau={nouveau?.item.entry.id ?? null}
          onOuvrir={(id) => vue.ouvrir(id)}
        />
        {premier && dernier ? (
          <p className={styles.pied}>
            {`Premier billet : ${numeroLisible(premier.numero)}, le ${formatDateVisionnage(premier.item.entry.finished_at)}, ${premier.item.media.title}.`}
            <br />
            {`Le dernier porte le ${numeroLisible(dernier.numero)}.`}
          </p>
        ) : null}
      </>
    )
  }

  // Le billet de correction ne se trouve que par la fiche de l'année du film, si elle est déjà lue :
  // la boîte ne la lit jamais.
  const annee = ouvert?.item.media.year ?? null
  const film = ouvert && annee !== null ? filmDuVisionnage(client.getQueryData<FicheAnnee>(cles.annee(annee)), ouvert.item) : null

  return (
    <section className={styles.page} style={style} aria-label={`${m.boite.titre}, années ${d}`}>
      {entete}
      {corps}
      {ouvert ? <Visionneuse monde={monde} billet={ouvert} corriger={film !== null ? `/voyage/${annee}/films/${film}/billet/corriger` : null} onFermer={vue.fermer} /> : null}
    </section>
  )
}
