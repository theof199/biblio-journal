import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { ApiError } from '../api/client'
import { corrigerVisionnage, creerVisionnage, journalDesAnnees, supprimerVisionnage, type JournalItem } from '../api/journal'
import { lireReactions } from '../api/reactions'
import { anneeSansSalles, estPrete, lireMalle, lireVoyage, type FicheAnnee, type Malle, type Voyage } from '../api/voyage'
import type { CandidatFilm } from '../formulaire/candidat'
import { brouillonInitial, construirePatch, type FormulaireBrouillon } from '../formulaire/patch'
import { creerRegistre } from '../mondes'
import type { Monde } from '../mondes/types'
import { useSession } from '../session/SessionContext'
import { vibrer } from '../ui/haptique'
import { useMouvementReduit } from '../ui/mouvement'
import Panne from '../ui/Panne'
import { historiqueDerriere, useRevenir } from '../ui/revenir'
import { doitGuetterVerdict } from '../voyage/annee'
import { confierLeRetour, type EtatBillet, type Retour } from '../voyage/annee/retour'
import { etatDeFete } from '../voyage/celebrations/scenes'
import { useFiche } from '../voyage/annee/useFiche'
import { FRAPPE, VIBRATION } from '../voyage/billet'
import { STYLE_DU_TEMPO } from '../voyage/tempo'
import BilletDeSeance, { type Etape } from '../voyage/billet/BilletDeSeance'
import { rangerLeBillet } from '../voyage/billet/range'
import { billetsDeLaDecennie, numeroDe } from '../voyage/billets'
import { bobineDuFilm, candidatDuBillet, filmDeLaFiche } from '../voyage/film'
import { gabaritDe, gabaritSeul } from '../voyage/gabarit'
import { decennieDe } from '../voyage/regles'
import styles from './VoyageBillet.module.css'

/** Un registre pour la page, comme la carte et les fiches ont le leur. */
const mondes = creerRegistre()

/**
 * Ce qu'un visionnage écrit ou effacé périme, comme le formulaire du journal (`pages/Formulaire.tsx`),
 * son jumeau : le journal (et « Tes séances », sous son préfixe), les chiffres, la carte et toutes
 * les fiches du Voyage, les filmographies et les sagas suivies.
 */
const PERIMES = [cles.journal, cles.stats, cles.voyage, cles.realisateurs, cles.sagas] as const

const messageDe = (e: unknown, repli: string) => (e instanceof ApiError ? e.message : repli)

/**
 * Mes visionnages des films de la décennie, sous la clé de la boîte à billets (`pages/VoyageBoite.tsx`)
 * : le billet y lit son numéro (décision D3), à la correction comme au compostage — une seule lecture,
 * donc un seul numéro, celui que la boîte montre.
 */
const laBoite = (d: number) =>
  queryOptions({ queryKey: cles.journalDesAnnees(d, d + 9), queryFn: ({ signal }) => journalDesAnnees(d, d + 9, signal) })

const attendre = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Le billet de séance (plan 2b, tâche 11 ; maquette 1890 : `initNotation`, écran VI ; plan 2c,
 * décision D4) : `…/billet` enregistre un visionnage (`?bobine=` pour une bobine d'un programme) et le
 * tamponne, `…/billet/corriger` corrige celui que porte l'état de navigation (`state.item`). Un
 * `:annee` qui n'est pas un entier ramène à la carte.
 */
export default function VoyageBillet({ correction = false }: { correction?: boolean }) {
  const { annee, filmId } = useParams()
  const [params] = useSearchParams()
  if (!annee || !/^\d+$/.test(annee) || !filmId) return <Navigate to="/voyage" replace />
  const bobine = params.get('bobine')
  // Un autre billet est une autre page : son brouillon et sa garde repartent de zéro.
  return <BilletDuFilm key={`${annee}/${filmId}/${bobine ?? ''}/${correction}`} annee={Number(annee)} filmId={filmId} bobine={bobine} correction={correction} />
}

type Cible = { type: 'creation'; candidat: CandidatFilm } | { type: 'correction'; item: JournalItem }

function BilletDuFilm({ annee, filmId, bobine, correction }: { annee: number; filmId: string; bobine: string | null; correction: boolean }) {
  const monde = mondes(decennieDe(annee))
  const { jetons } = monde.pages
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  // Le tempo aussi : les feuilles du compostage multiplient leurs durées par `var(--tempo)`.
  const style: CSSProperties & typeof jetons = { ...jetons, ...STYLE_DU_TEMPO }
  const location = useLocation()
  const etat = location.state as (EtatBillet & { item?: JournalItem }) | null
  // « Retour » recule vers ce qui a ouvert le billet (la fiche du film, ou l'année) ; ouvert d'un lien, le film.
  const vers = `/voyage/${annee}/films/${filmId}`
  const revenir = useRevenir(vers)

  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  // La fiche de **son** année : le film s'y retrouve, et la progression d'avant se lit dans son cache.
  const { requete, reessayer } = useFiche(annee)
  const fiche = requete.data
  const v = voyage.data
  const trouve = estPrete(fiche) ? filmDeLaFiche(fiche, filmId) : null
  const item = correction ? etat?.item : undefined

  // Une adresse tapée vers une année sans salles (fermée, en attente, en préparation) : comme la
  // fiche du film, la page de l'année, qui dit pourquoi, plutôt que « pas dans les salles », juste
  // mais trompeur.
  if (anneeSansSalles(fiche)) return <Navigate to={`/voyage/${annee}`} replace />

  const absent = (texte: string, lien: string, nom: string) => (
    <div className={styles.etat}>
      <p>{texte}</p>
      <Link to={lien} className={styles.lien}>
        {nom}
      </Link>
    </div>
  )

  let corps: ReactNode
  if (correction && !item) {
    // Rien à corriger sans l'entrée : il n'existe pas de `GET /me/journal/{id}` (adresse rechargée ou tapée).
    corps = absent('Ce visionnage n’est plus disponible.', vers, 'Retour au film')
  } else if (!fiche || !v) {
    const erreur = requete.error ?? voyage.error
    corps =
      erreur && !(requete.isFetching || voyage.isFetching) ? (
        <div className={styles.etat}>
          <Panne
            erreur={erreur}
            onReessayer={() => {
              if (voyage.error) void voyage.refetch()
              if (requete.error) reessayer()
            }}
          />
        </div>
      ) : (
        <p role="status" className={styles.etat}>
          Chargement…
        </p>
      )
  } else if (!trouve) {
    corps = absent(`Ce film n’est pas dans les salles de ${annee}.`, `/voyage/${annee}`, `L’année ${annee}`)
  } else if (item) {
    corps = <Billet monde={monde} annee={annee} filmId={filmId} voyage={v} cible={{ type: 'correction', item }} depuisLAnnee={false} />
  } else {
    const { film } = trouve
    const laBobine = bobine !== null ? bobineDuFilm(film, Number(bobine)) : undefined
    // Un programme se note bobine par bobine, et porte l'identifiant de sa première : sans bobine
    // reconnue, le billet noterait celle-là, fût-elle déjà vue.
    corps =
      (bobine !== null || film.programme) && !laBobine ? (
        absent(`Cette bobine n’est pas au programme de « ${film.title} ».`, vers, 'Retour au film')
      ) : (
        <Billet
          monde={monde}
          annee={annee}
          filmId={filmId}
          voyage={v}
          cible={{ type: 'creation', candidat: candidatDuBillet(film, laBobine) }}
          depuisLAnnee={etat?.depuis === 'annee'}
        />
      )
  }

  return (
    <section className={styles.page} aria-label="Le billet de séance" style={style}>
      <button type="button" className={styles.retour} aria-label="Retour" onClick={revenir}>
        <span aria-hidden="true">‹</span>
      </button>
      {corps}
    </section>
  )
}

interface PropsBillet {
  monde: Monde
  annee: number
  filmId: string
  voyage: Voyage
  cible: Cible
  /** Ouvert depuis la fiche de l'année (la séance) : l'année est l'entrée juste derrière. */
  depuisLAnnee: boolean
}

/**
 * Le billet proprement dit : le brouillon et sa garde, l'écriture, la suppression, le numéro et la
 * séquence du compostage. Son dessin (`BilletDeSeance`, ou celui du monde) ne fait que rendre.
 */
function Billet({ monde, annee, filmId, voyage: v, cible, depuisLAnnee }: PropsBillet) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const { key } = useLocation()
  const { user } = useSession()
  const calme = useMouvementReduit()
  const item = cible.type === 'correction' ? cible.item : undefined
  const candidat = cible.type === 'creation' ? cible.candidat : undefined
  const decennie = decennieDe(annee)

  // Le numéro du billet corrigé se lit en tête (décision D3) ; un billet neuf l'apprend en se tamponnant.
  const boite = useQuery({ ...laBoite(decennie), enabled: item !== undefined })
  const numeroCorrige = item && boite.data ? numeroDe(billetsDeLaDecennie(boite.data, decennie, v.depart), item.entry.id) : null

  // Le compostage (décision D4) : l'étape, le numéroteur (son tirage, le numéro qu'il pose), et le
  // support du billet, que la frappe amène à l'écran.
  const [etape, setEtape] = useState<Etape>('repos')
  const [roue, setRoue] = useState<{ tirage: number | null; numero: number | null }>({ tirage: null, numero: null })
  const support = useRef<HTMLDivElement>(null)
  // La séquence attend entre ses étapes : le rappel de `mutate` ne se tait qu'à son appel, pas après ses
  // attentes. Elle relit ce drapeau après chacune, et ne navigue jamais depuis un billet quitté.
  const monte = useRef(true)
  useEffect(() => {
    monte.current = true
    return () => void (monte.current = false)
  }, [])
  const [brouillon, setBrouillon] = useState(() => brouillonInitial(item, candidat))
  const [confirmer, setConfirmer] = useState(false)
  // Le focus suit la confirmation : « Annuler » (le geste sans risque) à son ouverture, qui la montre
  // au-dessus de la barre d'onglets ; « Supprimer » à sa fermeture. Rien au montage.
  const annuler = useRef<HTMLButtonElement>(null)
  const demander = useRef<HTMLButtonElement>(null)
  const ouverte = useRef(false)
  useEffect(() => {
    if (confirmer) annuler.current?.focus()
    else if (ouverte.current) demander.current?.focus()
    ouverte.current = confirmer
  }, [confirmer])

  const reactions = useQuery({ queryKey: cles.reactions, queryFn: ({ signal }) => lireReactions(signal) })
  // La malle d'avant l'écriture (plan des écrans des lots, brief 6, décision 4) : le billet la lit en
  // s'ouvrant, un `GET` qui n'écrit rien, seulement si le monde de son année fête ses étiquettes (une
  // clé sans défaut : 1890 et « à venir » ne lisent rien). Il ne l'attend pas, et sa panne se tait :
  // sans elle, aucune étiquette ne se fêtera au retour, et la sacoche le dira.
  const feteLaMalle = gabaritSeul(monde, 'feteDuBadge') !== null
  useQuery({ queryKey: cles.malle(decennie), queryFn: ({ signal }) => lireMalle(decennie, signal), enabled: feteLaMalle })

  const perimer = () => {
    for (const cle of PERIMES) void client.invalidateQueries({ queryKey: cle })
  }

  // Ce que le cache doit apprendre reste ici (les péremptions) ; la navigation va dans les rappels de
  // `mutate`, qui se taisent si le billet est quitté pendant l'envoi (le « retour » du téléphone).
  const ecrire = useMutation({
    mutationFn: async (b: FormulaireBrouillon): Promise<{ retour: Retour; entree: JournalItem }> => {
      // L'avant : la fiche en cache avant l'écriture, que l'année compare à sa relecture.
      const f = client.getQueryData<FicheAnnee>(cles.annee(annee))
      // La malle se prend ici, **avant** l'écriture, jamais après : périmée par ce billet, elle se relit.
      const malle = feteLaMalle ? (client.getQueryData<Malle>(cles.malle(decennie))?.etiquettes ?? null) : null
      const avant = estPrete(f) ? { profondeur: f.profondeur, progression: f.progression, fete: etatDeFete(f, v.annee_en_cours, malle) } : null
      const depuis = estPrete(f) ? (f.maturite?.jugee_le ?? null) : null
      const entree = item
        ? await corrigerVisionnage(item.entry.id, construirePatch(item, b))
        : await creerVisionnage(
            { source: candidat!.source, external_id: candidat!.external_id, type: 'movie' },
            {
              finished_at: b.date,
              rating: b.note,
              reactions: b.reactions.length > 0 ? b.reactions : undefined,
              comment: b.remarque.trim() || undefined,
            },
          )
      const guetter = doitGuetterVerdict({ ia: v.ia, creation: !item, anneeDuFilm: entree.media.year, anneeEnCours: v.annee_en_cours })
      return { retour: { avant, guet: guetter ? { depuis } : null }, entree }
    },
    // Confiés dès l'écriture, même billet quitté : le membre qui recule vers l'année pendant l'envoi
    // ou le tampon y trouve son « +1 » et son verdict guetté, puis son billet mis en avant dans la
    // boîte. Ce n'est pas une navigation : elle seule attend les rappels de `mutate`. Corriger ne
    // range rien (le billet a déjà son numéro).
    onSuccess: ({ retour, entree }) => {
      perimer()
      confierLeRetour(annee, user.id, retour)
      if (!item) rangerLeBillet(user.id, entree.entry.id)
    },
  })

  const suppression = useMutation({
    mutationFn: (id: string) => supprimerVisionnage(id),
    onSuccess: (_rien, id) => {
      // Ouvert de la boîte à billets, le billet effacé recule vers elle, sur l'adresse qui l'ouvrait en
      // grand (`?billet=`) : sans l'entrée retirée de ses listes en cache, la boîte l'y rouvrirait le
      // temps que le journal soit relu. Retirée d'abord, puis périmée : la relecture part quand même.
      client.setQueriesData<JournalItem[]>({ queryKey: ['journal', 'annees'] }, (items) => items?.filter((i) => i.entry.id !== id))
      perimer()
    },
  })

  // `isPending` ne se voit qu'au rendu suivant : deux touchers rapprochés écriraient deux fois. Une
  // seule garde pour les deux gestes : on ne corrige pas un visionnage qu'on est en train d'effacer.
  // Elle se dit aussi au rendu (`garde`) : le compostage la tient levée, bouton éteint, jusqu'au retour
  // à l'année, bien après la fin de l'écriture ; seul un refus la relâche.
  const envoi = useRef(false)
  const [garde, setGarde] = useState(false)
  const lever = () => {
    envoi.current = true
    setGarde(true)
  }
  const relacher = () => {
    envoi.current = false
    setGarde(false)
  }
  // Le brouillon parti ne se retouche plus : ce qu'on y changerait pendant l'envoi ou sous le tampon
  // se verrait à l'écran sans être écrit. La même garde, lue au geste ; le dessin la dit au navigateur (`INERTE`).
  const retoucher = (f: (b: FormulaireBrouillon) => FormulaireBrouillon) => {
    if (envoi.current) return
    setBrouillon(f)
  }

  const revenirALAnnee = () => {
    // Le retour est déjà confié (`onSuccess` de l'écriture). Depuis l'année, reculer : la remplacer par elle-même la doublerait dans l'historique.
    if (depuisLAnnee && historiqueDerriere(key)) navigate(-1)
    else navigate(`/voyage/${annee}`, { replace: true })
  }

  /**
   * Le billet se tamponne, se numérote, et son talon part (décision D4 ; maquette 1890 : `tamponner`),
   * puis l'année revient. Le numéro se lit dans la boîte de la décennie, lue dès le succès : si elle n'a
   * pas répondu à la fin des tirages, le numéroteur s'arrête sur « N° ···· » et la séquence continue.
   */
  const tamponner = async (entree: JournalItem) => {
    let lu: number | null = null
    client.fetchQuery(laBoite(decennie)).then(
      (items) => void (lu = numeroDe(billetsDeLaDecennie(items, decennie, v.depart), entree.entry.id)),
      () => undefined,
    )
    support.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    setEtape('descend')
    await attendre(FRAPPE.descend)
    if (!monte.current) return
    setEtape('pose')
    vibrer(VIBRATION)
    await attendre(FRAPPE.pause)
    if (!monte.current) return
    setEtape('remonte')
    await attendre(FRAPPE.remonte)
    if (!monte.current) return
    setEtape('numerote')
    for (let k = 0; k < FRAPPE.tirages; k += 1) {
      setRoue({ tirage: k, numero: lu })
      await attendre(FRAPPE.tirage)
      if (!monte.current) return
    }
    setRoue({ tirage: null, numero: lu })
    await attendre(FRAPPE.avantTalon)
    if (!monte.current) return
    setEtape('talon')
    await attendre(FRAPPE.talon)
    if (!monte.current) return
    revenirALAnnee()
  }

  const composter = () => {
    if (envoi.current) return
    lever()
    suppression.reset()
    ecrire.mutate(brouillon, {
      onSuccess: ({ entree }) => {
        // Corriger ne tamponne pas : le billet a déjà son numéro, lu en tête. Au calme, ni tampon, ni
        // numéroteur, ni talon, ni vibration : l'année revient aussitôt.
        if (item || calme) revenirALAnnee()
        else void tamponner(entree)
      },
      onError: relacher,
    })
  }
  const supprimer = () => {
    if (!item || envoi.current) return
    lever()
    ecrire.reset()
    suppression.mutate(item.entry.id, {
      // Le billet effacé ne reste pas dans l'historique : reculer vers la fiche du film qui l'a ouvert.
      onSuccess: () => (historiqueDerriere(key) ? navigate(-1) : navigate(`/voyage/${annee}/films/${filmId}`, { replace: true })),
      onSettled: relacher,
    })
  }

  const occupe = ecrire.isPending || suppression.isPending || garde
  // Le dessin du billet est celui du monde, s'il en a un : la page lui passe ce qu'elle a lu et ses gestes.
  const Dessin = gabaritDe(monde, 'billetDeSeance', BilletDeSeance)

  return (
    <Dessin
      monde={monde}
      annee={annee}
      film={
        item
          ? { titre: item.media.title, realisateur: item.media.director, sortie: item.media.year, couverture: item.media.cover_url }
          : { titre: candidat!.title, realisateur: candidat!.director, sortie: candidat!.year, couverture: candidat!.cover_url }
      }
      correction={item !== undefined}
      brouillon={brouillon}
      onRetoucher={retoucher}
      reactions={{
        catalogue: reactions.data?.reactions ?? null,
        panne: reactions.error && !reactions.isFetching ? reactions.error : null,
        onReessayer: () => void reactions.refetch(),
      }}
      pseudo={user.pseudo}
      // Le numéro du billet corrigé se lit dans la boîte ; un billet neuf l'apprend du numéroteur.
      numero={item ? numeroCorrige : roue.numero}
      tirage={roue.tirage}
      etape={etape}
      support={support}
      occupe={occupe}
      refus={ecrire.error ? messageDe(ecrire.error, 'Le billet n’a pas pu s’enregistrer. Réessaie.') : null}
      onComposter={composter}
      suppression={
        // « Supprimer » (décision D6) : discret, sous le billet, avec la confirmation du formulaire.
        item ? (
          confirmer ? (
            <div className={styles.confirmation}>
              <p>Supprimer ce visionnage ? Le commentaire et les réactions partent avec.</p>
              {suppression.error ? (
                <p role="alert" className={styles.erreur}>
                  {messageDe(suppression.error, 'Le visionnage n’a pas pu être supprimé. Réessaie.')}
                </p>
              ) : null}
              <div className={styles.choix}>
                <button
                  ref={annuler}
                  type="button"
                  className={styles.discret}
                  onClick={() => {
                    suppression.reset()
                    setConfirmer(false)
                  }}
                >
                  Annuler
                </button>
                <button type="button" className={styles.supprimer} disabled={occupe} onClick={supprimer}>
                  Supprimer
                </button>
              </div>
            </div>
          ) : (
            <button ref={demander} type="button" className={styles.discret} onClick={() => setConfirmer(true)}>
              Supprimer
            </button>
          )
        ) : null
      }
    />
  )
}
