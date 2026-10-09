import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { ApiError } from '../api/client'
import { journalDesAnnees } from '../api/journal'
import { estPrete, lireGenerique, lireMalle, lireVoyage, utiliserTicket, type FicheAnnee, type FichePrete, type Voyage } from '../api/voyage'
import { creerRegistre } from '../mondes'
import type { Monde, VueBandeau } from '../mondes/types'
import { useSession } from '../session/SessionContext'
import Panne from '../ui/Panne'
import { vibrer } from '../ui/haptique'
import { VIBRATION } from '../voyage/billet'
import { useMouvementReduit } from '../ui/mouvement'
import { useRevenir } from '../ui/revenir'
import { afficherGenerique, arriveesDeLAnnee, avancees, billetsDeProgression, estBouclee, ligneDuBas, statutDeLAnnee, verdictAChange, type Avancee } from '../voyage/annee'
import { annonceDesAvancees, franchitUnPalier, oublierLeRetour, retourConfie } from '../voyage/annee/retour'
import { RELECTURES } from '../voyage/relecture'
import { useGuet } from '../voyage/salles/useFournee'
import { useCalque } from '../voyage/calque'
import Celebrations from '../voyage/celebrations/Celebrations'
import { etatDeFete, scenesDuRetour, type EtatDeFete, type Scene } from '../voyage/celebrations/scenes'
import Feuille from '../voyage/Feuille'
import { gabaritDe, gabaritSeul } from '../voyage/gabarit'
import { decennieDe, etatDeCase, prochainPas } from '../voyage/regles'
import Toile, { LARGEUR_LOGIQUE } from '../voyage/Toile'
import AnneeFermee from '../voyage/annee/AnneeFermee'
import Bandeau from '../voyage/annee/Bandeau'
import Boniment from '../voyage/annee/Boniment'
import Corde from '../voyage/annee/Corde'
import { NOM_DE_RECOMPENSE } from '../voyage/annee/Embleme'
import Fronton from '../voyage/annee/Fronton'
import Horaire from '../voyage/annee/Horaire'
import Porte from '../voyage/wagon/Porte'
import LigneDuBas from '../voyage/annee/LigneDuBas'
import Manivelle from '../voyage/annee/Manivelle'
import Ordre from '../voyage/annee/Ordre'
import Programme from '../voyage/annee/Programme'
import { useFiche } from '../voyage/annee/useFiche'
import Parade from '../voyage/parade/Parade'
import Salles from '../voyage/salles/Salles'
import Seance from '../voyage/seance/Seance'
import styles from './VoyageAnnee.module.css'

/** Un registre pour la page, comme la carte a le sien : rien de ce qu'un monde tient ne passe de l'une à l'autre. */
const mondes = creerRegistre()

const ECRIT = 'Le chroniqueur écrit…'

/**
 * La fiche d'une année du Voyage (plan 2b, tâche 7), habillée par le monde de sa décennie : ses
 * jetons sur la racine, ses mots, son bandeau. Un `:annee` qui n'est pas un entier ramène à la carte.
 */
export default function VoyageAnnee() {
  const { annee } = useParams()
  if (!annee || !/^\d+$/.test(annee)) return <Navigate to="/voyage" replace />
  const n = Number(annee)
  // Une autre année est une autre page : ses comptes, son toucher, sa garde repartent de zéro.
  return <FicheDeLAnnee key={n} annee={n} />
}

type Mode = VueBandeau['mode']
const MODE_DU_STATUT = { ouverte: 'bouclee', en_cours: 'encours', verrouillee: 'fermee' } as const

/**
 * Le mode du bandeau : la forme de la fiche d'abord, sinon (tant qu'elle charge ou s'écrit) la carte,
 * qui sait déjà, pour un membre hors IA, qu'une année attend le Voyage suivi (`etatDeCase`).
 */
function modeDuBandeau(annee: number, fiche: FicheAnnee | undefined, v: Voyage | undefined): Mode {
  if (fiche && 'statut' in fiche) {
    if (fiche.statut === 'verrouillee') return 'fermee'
    if (fiche.statut === 'en_attente') return 'attente'
  }
  if (!v) return 'encours'
  const a = v.annees.find((x) => x.annee === annee)
  if (!fiche && a && etatDeCase(a, v.ia).attente) return 'attente'
  return MODE_DU_STATUT[statutDeLAnnee(annee, v.annee_en_cours)]
}

function FicheDeLAnnee({ annee }: { annee: number }) {
  const monde = mondes(decennieDe(annee))
  const { jetons, mots: m, hauteurs } = monde.pages
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }
  const calme = useMouvementReduit()
  const navigate = useNavigate()
  const revenir = useRevenir('/voyage')
  const client = useQueryClient()

  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const { requete, abandon, reessayer } = useFiche(annee)
  const v = voyage.data
  const fiche = requete.data
  const forme = fiche ? ('statut' in fiche ? fiche.statut : 'non_configure') : null
  const prete = estPrete(fiche) ? fiche : undefined
  const fermee = fiche && 'statut' in fiche && (fiche.statut === 'verrouillee' || fiche.statut === 'en_attente') ? fiche : undefined

  // Mes films sortis cette année-là : les films vus en avance d'une année fermée ou en attente,
  // jamais pour une fiche prête, et jamais tout le journal pour quelques films.
  const journal = useQuery({
    queryKey: cles.journalDesAnnees(annee, annee),
    queryFn: ({ signal }) => journalDesAnnees(annee, annee, signal),
    enabled: !!fermee,
  })

  // Le retour d'un billet (tâche 11) : confié par le billet, pris une fois par cette page. Une fois la
  // fiche relue après le montage, ce qui a été gagné roule sur la corde, se dit, et le téléphone vibre
  // au palier ; puis plus rien, ni à la relecture suivante, ni au retour suivant, ni au rechargement.
  const { user } = useSession()
  const [retour] = useState(() => retourConfie(annee, user.id))
  useEffect(() => {
    oublierLeRetour(annee)
  }, [annee])
  const [gains, setGains] = useState<readonly Avancee[]>([])
  const joue = useRef(false)
  // Relue **avec succès** : `isFetchedAfterMount` devient vrai aussi sur une panne, la fiche du cache
  // encore à l'écran ; la comparer consommerait le retour sans rien avoir à jouer, et la relecture
  // réussie suivante ne jouerait plus rien.
  const relue = requete.isFetchedAfterMount && !requete.isError
  useEffect(() => {
    if (joue.current || !retour?.avant || !relue || !prete) return
    joue.current = true
    const liste = avancees(retour.avant, { profondeur: prete.profondeur, progression: prete.progression })
    if (liste.length === 0) return
    setGains(liste)
    // Au calme, le téléphone ne vibre pas (la maquette, `initNotation`) : l'annonce et la corde suffisent.
    if (!calme && franchitUnPalier(liste, prete.progression)) vibrer(VIBRATION)
  }, [retour, relue, prete, calme])
  // Le verdict du jury, guetté au compte IA après une création (le billet l'a décidé) : la fiche se
  // relit toutes les cinq secondes, douze fois au plus, jusqu'à un verdict changé ou un ticket ; la
  // minuterie s'arrête en quittant la page.
  const guet = retour?.guet ?? null
  // Les célébrations : ce que le billet a bouclé (une salle, la récompense, l'année), comparé une fois
  // sur la fiche relue, comme les gains. Rien ne se mémorise : ni un rechargement ni le retour suivant
  // ne les rejouent. Tant que le verdict est guetté, le ticket que le jury accorde boucle l'année à
  // son tour, lui seul ; un ticket que personne n'a regardé arriver se rattrape sur la carte.
  const [fete, setFete] = useState<readonly Scene[]>([])
  const compare = useRef<EtatDeFete | null>(retour?.avant?.fete ?? null)
  const fetee = useRef(false)
  const anneeEnCours = v?.annee_en_cours
  // Les étiquettes de la malle (plan des écrans des lots, brief 6) : la malle ne se relit ici que si
  // le billet a confié celle d'avant, dans un monde qui fête ses étiquettes (une clé sans défaut) ;
  // une année ouverte sans retour, ou rechargée, ne la lit pas. Elle se relit **toujours** (le billet
  // l'a périmée, mais sa relecture a pu finir avant ce montage) et ne compte que relue avec succès
  // après le montage : celle du cache, que la sacoche a pu rafraîchir, ne fête rien. Indéfinie, on
  // l'attend, pour que ses scènes prennent leur rang avant l'année bouclée ; nulle (en panne, ou rien
  // à relire), la fête se joue sans elle.
  const attendLaMalle = gabaritSeul(monde, 'feteDuBadge') !== null && !!retour?.avant?.fete?.malle
  const malle = useQuery({
    queryKey: cles.malle(decennieDe(annee)),
    queryFn: ({ signal }) => lireMalle(decennieDe(annee), signal),
    enabled: attendLaMalle,
    refetchOnMount: 'always',
  })
  const malleRelue = !attendLaMalle ? null : !malle.isFetchedAfterMount || malle.isFetching ? undefined : malle.isError || !malle.data ? null : malle.data.etiquettes
  useEffect(() => {
    if (!compare.current || !relue || !prete || anneeEnCours === undefined || malleRelue === undefined) return
    if (fetee.current && guet === null) return
    const apres = etatDeFete(prete, anneeEnCours, malleRelue)
    const scenes = scenesDuRetour(annee, compare.current, apres).filter((s) => !fetee.current || s.type === 'annee')
    compare.current = apres
    fetee.current = true
    if (scenes.length > 0) setFete((f) => [...f, ...scenes])
  }, [annee, relue, prete, anneeEnCours, guet, malleRelue])
  useGuet(annee, guet !== null && !!prete && !verdictAChange(guet.depuis, prete.maturite?.jugee_le ?? null, prete.ticket), RELECTURES.verdict)

  const feuille = useCalque('feuille')
  // Le générique s'écrit à sa première lecture ; la route rend ensuite le texte écrit, sans appel.
  const generique = useQuery({
    queryKey: ['voyage', 'generique', annee],
    queryFn: () => lireGenerique(annee),
    enabled: feuille.valeur === 'generique' && !!prete && prete.generique === null,
    retry: false,
    staleTime: Infinity,
  })
  const ecrit = generique.data?.generique
  useEffect(() => {
    if (ecrit === undefined) return
    client.setQueryData<FicheAnnee>(cles.annee(annee), (f) => (estPrete(f) ? { ...f, generique: ecrit } : f))
  }, [client, annee, ecrit])

  // « Utiliser » (décision D3) : encaisser, puis la carte, qui joue la marche vers l'année neuve. Ce
  // que le cache doit apprendre reste ici (la carte se relit, page quittée ou non) ; la navigation va
  // dans les rappels de `mutate`, qui se taisent si l'année est quittée pendant l'envoi (le « retour »
  // du téléphone) : ceux de `useMutation` lui survivent, et ramèneraient à la carte depuis ailleurs.
  const utiliser = useMutation({
    mutationFn: (a: number) => utiliserTicket(a),
    onSuccess: () => void client.invalidateQueries({ queryKey: cles.voyage }),
  })
  // `isPending` ne se voit qu'au rendu suivant : deux touchers rapprochés encaisseraient deux fois.
  const envoi = useRef(false)
  const encaisser = (a: number) => {
    if (envoi.current) return
    envoi.current = true
    utiliser.mutate(a, { onSuccess: () => navigate('/voyage'), onSettled: () => void (envoi.current = false) })
  }

  // La tête et le fronton sont des sections que le monde peut composer (`gabarits.teteDAnnee`, `gabarits.fronton`).
  const Tete = gabaritDe(monde, 'teteDAnnee', Bandeau)
  const Titre = gabaritDe(monde, 'fronton', Fronton)
  const mode = modeDuBandeau(annee, fiche, v)
  // « Bouclée » ne se dit que d'une façon (`estBouclee`) : la tête d'un monde qui la tamponne suit la
  // même règle que le corps de la fiche. Jamais sur une année fermée ou en attente ; le ticket ne se
  // connaît qu'à la fiche prête.
  const anneeBouclee = !!v && (mode === 'encours' || mode === 'bouclee') && estBouclee(statutDeLAnnee(annee, v.annee_en_cours), prete?.ticket ?? null)
  const recompense = prete?.recompense ?? v?.annees.find((a) => a.annee === annee)?.recompense ?? null
  const cases = v ? v.annees.filter((a) => decennieDe(a.annee) === monde.decennie).map((a) => ({ annee: a.annee, etat: etatDeCase(a, v.ia).etat, profondeur: a.profondeur })) : []
  const bouclee = !!v?.tampons.some((t) => t.decennie === monde.decennie)
  // La roulotte du Voyage suivi, dans tous les modes dès que le membre en suit un ; jamais au compte IA.
  const roulotte = v && !v.ia && v.source ? { pseudo: v.source.pseudo, annee: v.source.annee_en_cours } : null
  // L'horaire tenu se dit aussi à la tête (plan des écrans des lots, brief 10), dans un monde qui
  // compose l'horaire seulement : ailleurs la page n'en dit rien, quoi que serve la fiche.
  const aLHeure = gabaritSeul(monde, 'horaireDeLAnnee') !== null && prete?.horaire?.etat === 'tenu'

  let corps: ReactNode
  if (!fiche || !v) {
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
  } else if (forme === 'non_configure') {
    corps = <p className={styles.etat}>Le chroniqueur n’est pas configuré sur ce serveur : cette année ne peut pas encore s’ouvrir.</p>
  } else if (forme === 'en_preparation') {
    const enCours = statutDeLAnnee(annee, v.annee_en_cours) !== 'ouverte'
    corps = (
      <>
        <Titre annee={annee} annonce={enCours ? m.annonce.enCours : m.annonce.bouclee} millesime={enCours ? 'encours' : 'bouclee'} monde={monde} />
        <Toile
          hauteur={hauteurs.estrade}
          libelle="Le chroniqueur sur son estrade."
          dessiner={(ctx, t, vivant) => monde.pages.dessinerEstrade({ ctx, W: LARGEUR_LOGIQUE, H: hauteurs.estrade, t, vivant, parle: abandon ? 'non' : 'tape' })}
        />
        {abandon ? (
          <div role="alert" className={styles.etat}>
            <p>Le chroniqueur n’a pas répondu, reviens plus tard.</p>
            <button type="button" className={styles.bouton} onClick={reessayer}>
              Réessayer
            </button>
          </div>
        ) : (
          <p role="status" aria-label={ECRIT} className={styles.etat}>
            {ECRIT}
          </p>
        )}
      </>
    )
  } else if (fermee) {
    // Le corps d'une année fermée est une section que le monde peut composer (`gabarits.anneeFermee`).
    const Fermee = gabaritDe(monde, 'anneeFermee', AnneeFermee)
    corps = (
      <Fermee
        variante={fermee.statut === 'verrouillee' ? 'fermee' : 'attente'}
        monde={monde}
        annee={annee}
        voyage={v}
        profondeur={fermee.profondeur}
        journal={{ items: journal.data, erreur: journal.error, onReessayer: () => void journal.refetch() }}
        // Le podium se pose sur toute année ouverte : une année en attente a déjà sa parade (sans
        // salles, donc sans programme), une année fermée n'en a pas (l'API la rend toujours vide).
        parade={fermee.statut === 'en_attente' ? <Parade monde={monde} annee={annee} podium={fermee.podium} salles={[]} /> : null}
      />
    )
  } else if (prete) {
    corps = (
      <FichePreteDeLAnnee
        monde={monde}
        annee={annee}
        fiche={prete}
        voyage={v}
        feuille={feuille}
        generique={{ texte: prete.generique ?? ecrit ?? null, erreur: generique.error, onReessayer: () => void generique.refetch() }}
        onUtiliser={encaisser}
        occupe={utiliser.isPending}
        erreur={utiliser.error ? (utiliser.error instanceof ApiError ? utiliser.error.message : 'Le ticket n’a pas pu être utilisé. Réessaie.') : null}
        gains={gains}
      />
    )
  }

  // La manivelle (plan 2c, décision D8) relit la fiche et la carte, elles seules : `exact`, sinon le
  // préfixe `voyage` relirait toutes les fiches en cache (et, au compte IA, ouvrirait une année non
  // visitée chez le chroniqueur). Jamais le journal ni le générique.
  const recharger = () =>
    Promise.all([
      client.refetchQueries({ queryKey: cles.annee(annee), exact: true }, { throwOnError: true }),
      client.refetchQueries({ queryKey: cles.voyage, exact: true }, { throwOnError: true }),
    ])

  return (
    <section className={styles.page} aria-label={`L’année ${annee}`} style={style}>
      {/* Autour de toute fiche : prête, fermée, en attente, en préparation, en panne. */}
      <Manivelle monde={monde} onRecharger={recharger}>
        <div className={styles.bandeau}>
          <Tete monde={monde} calme={calme} mode={mode} annee={annee} recompense={recompense} cases={cases} bouclee={bouclee} roulotte={roulotte} anneeBouclee={anneeBouclee} aLHeure={aLHeure} />
          {/* Un lien vers la carte (ouvrir ailleurs, le nom lu), qui recule pourtant dans l'historique
              quand il y a de quoi : comme le geste du téléphone, sans empiler l'année derrière la carte. */}
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
          {/* La plaque du chapitre ouvre la page de la décennie de l'année (plan 2c, décision D5). */}
          {monde.chapitre ? (
            <Link to={`/voyage/decennies/${decennieDe(annee)}`} className={styles.plaque}>
              {monde.chapitre}
            </Link>
          ) : null}
        </div>
        {corps}
      </Manivelle>
      {/* Hors de la manivelle : la fête couvre la page, et ne se tire pas. */}
      {fete.length > 0 ? <Celebrations monde={monde} membre={user.id} scenes={fete} onUtiliser={encaisser} onFin={() => setFete([])} horsCarte fiche={prete ?? null} /> : null}
    </section>
  )
}

interface PropsPrete {
  monde: Monde
  annee: number
  fiche: FichePrete
  voyage: Voyage
  feuille: ReturnType<typeof useCalque>
  generique: { texte: string | null; erreur: unknown; onReessayer: () => void }
  onUtiliser: (annee: number) => void
  occupe: boolean
  erreur: string | null
  /** Ce que le retour d'un billet a gagné : la corde le fait rouler, la région d'état le dit. */
  gains: readonly Avancee[]
}

/** La fiche prête (maquette 1890 : `htmlAnnee`, écrans I et II) : l'année en cours, ou bouclée. */
function FichePreteDeLAnnee({ monde, annee, fiche, voyage: v, feuille, generique, onUtiliser, occupe, erreur, gains }: PropsPrete) {
  const m = monde.pages.mots
  const statut = statutDeLAnnee(annee, v.annee_en_cours)
  const enCours = statut !== 'ouverte'
  const billets = billetsDeProgression(fiche.profondeur, fiche.progression).map((b) => ({
    ...b,
    tete: b.cle === 'essentiels' ? 'Essentiels' : b.cle === 'salles' ? 'Salles' : undefined,
  }))
  const sous = `${monde.nom} · ${monde.sous}`
  const Titre = gabaritDe(monde, 'fronton', Fronton)
  // La corde, le boniment et le programme sont des sections que le monde peut composer
  // (`gabarits.corde`, `gabarits.boniment`, `gabarits.programme`). Une seule règle compte les
  // objectifs de l'année pour qui les montre.
  const LaCorde = gabaritDe(monde, 'corde', Corde)
  const LeBoniment = gabaritDe(monde, 'boniment', Boniment)
  const LeProgramme = gabaritDe(monde, 'programme', Programme)
  // L'ordre des sections est lui aussi au monde (`gabarits.ordreDAnnee`) : il les reçoit montées.
  const LOrdre = gabaritDe(monde, 'ordreDAnnee', Ordre)
  const LeBas = gabaritDe(monde, 'ligneDuBas', LigneDuBas)
  const arrivees = arriveesDeLAnnee(fiche.profondeur, fiche.progression, fiche.recompense, fiche.ticket)
  // L'horaire de la gare (plan des écrans des lots, brief 10) : une clé sans défaut. Sans dessin, le
  // bloc ne se monte pas, et le programme ne reçoit rien de l'horaire que la fiche sert pourtant.
  const DessinDeLHoraire = gabaritSeul(monde, 'horaireDeLAnnee')
  const tenu = DessinDeLHoraire && fiche.horaire?.etat === 'tenu' ? { echeance: fiche.horaire.echeance, arriveeLe: fiche.ticket?.emis_le ?? null } : null
  const bouclee = estBouclee(statut, fiche.ticket)
  // La porte du wagon-restaurant (brief 16) : une clé sans défaut, et sur **mon année en cours**
  // seulement. Sans dessin, ou sur une autre année, le bloc ne se monte pas et aucune table n'est lue.
  const DessinDeLaPorte = annee === v.annee_en_cours ? gabaritSeul(monde, 'porteDuWagon') : null

  return (
    <>
      <Titre annee={annee} annonce={enCours ? m.annonce.enCours : m.annonce.bouclee} millesime={enCours ? 'encours' : 'bouclee'} monde={monde}>
        {enCours ? null : <span className={styles.ruban}>{fiche.recompense ? `Bouclée · ${NOM_DE_RECOMPENSE[fiche.recompense]}` : 'Bouclée'}</span>}
      </Titre>
      <LOrdre
        corde={
          <>
            <LaCorde billets={billets} gains={gains} arrivees={arrivees} bouclee={bouclee} />
            {/* Présente dès la fiche montée, vide : une région d'état ne se lit qu'à son changement. */}
            <p role="status" className="sr-only">
              {annonceDesAvancees(gains)}
            </p>
          </>
        }
        boniment={
          <LeBoniment
            monde={monde}
            annee={annee}
            recompense={fiche.recompense}
            ouverture={fiche.ouverture}
            faits={fiche.faits}
            generique={afficherGenerique(fiche.ticket)}
            onLire={() => feuille.ouvrir('ouverture')}
            onGenerique={() => feuille.ouvrir('generique')}
          />
        }
        // Les pas ne se disent que pour l'année en cours : sans pas, le programme par défaut ne rend rien.
        programme={
          <LeProgramme
            monde={monde}
            annee={annee}
            etapes={enCours ? prochainPas(fiche.profondeur, fiche.progression, fiche.recompense, fiche.ticket !== null, v.ia) : []}
            progression={fiche.progression}
            arrivees={arrivees}
            gains={gains}
            bouclee={bouclee}
            recompense={fiche.recompense}
            ia={v.ia}
            horaireTenu={tenu}
          />
        }
        horaire={DessinDeLHoraire ? <Horaire monde={monde} annee={annee} fiche={fiche} Dessin={DessinDeLHoraire} /> : null}
        parade={<Parade monde={monde} annee={annee} podium={fiche.podium} salles={fiche.salles} />}
        // La séance n'appartient qu'au compte IA (l'API la refuse aux autres), et à l'année en cours.
        seance={enCours && v.ia ? <Seance monde={monde} annee={annee} fiche={fiche} /> : null}
        // Hors de la séance : la porte est à tout membre, compte IA ou non.
        porte={DessinDeLaPorte ? <Porte monde={monde} Dessin={DessinDeLaPorte} /> : null}
        salles={<Salles monde={monde} annee={annee} fiche={fiche} ia={v.ia} />}
        // Le jury n'appartient qu'au compte IA : jamais promis à un autre membre, quoi que porte la fiche.
        ligneDuBas={<LeBas monde={monde} annee={annee} ligne={ligneDuBas(fiche.ticket, v.ia ? fiche.maturite : null, v.annee_en_cours)} onUtiliser={onUtiliser} occupe={occupe} erreur={erreur} />}
      />

      {feuille.valeur === 'ouverture' ? (
        <Feuille monde={monde} quoi="ouverture" esp="Ouverture" titre={String(annee)} sous={sous} etat={{ type: 'texte', texte: fiche.ouverture }} onReessayer={() => undefined} onFermer={feuille.fermer} />
      ) : feuille.valeur === 'generique' ? (
        <Feuille
          monde={monde}
          quoi="generique"
          esp="Générique"
          titre="Le générique de fin"
          sous={String(annee)}
          etat={
            generique.texte !== null
              ? { type: 'texte', texte: generique.texte }
              : generique.erreur
                ? { type: 'erreur', message: generique.erreur instanceof ApiError ? generique.erreur.message : 'Le générique n’a pas pu s’écrire. Réessaie.' }
                : { type: 'attente' }
          }
          onReessayer={generique.onReessayer}
          onFermer={feuille.fermer}
        />
      ) : null}
    </>
  )
}
