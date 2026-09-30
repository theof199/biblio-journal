import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { ApiError } from '../api/client'
import { journalComplet } from '../api/journal'
import { estPrete, lireGenerique, lireVoyage, utiliserTicket, type FicheAnnee, type FichePrete, type Voyage } from '../api/voyage'
import { ambianceDeLHeure } from '../carte/heure'
import { creerRegistre } from '../mondes'
import type { Monde, VueBandeau } from '../mondes/types'
import Panne from '../ui/Panne'
import { useMouvementReduit } from '../ui/mouvement'
import { useRevenir } from '../ui/revenir'
import { afficherGenerique, billetsDeProgression, ligneDuBas, statutDeLAnnee } from '../voyage/annee'
import { useCalque } from '../voyage/calque'
import Feuille from '../voyage/Feuille'
import { decennieDe, etatDeCase, prochainPas } from '../voyage/regles'
import Toile, { LARGEUR_LOGIQUE } from '../voyage/Toile'
import AnneeFermee from '../voyage/annee/AnneeFermee'
import Boniment from '../voyage/annee/Boniment'
import Corde from '../voyage/annee/Corde'
import { NOM_DE_RECOMPENSE } from '../voyage/annee/Embleme'
import Fronton from '../voyage/annee/Fronton'
import LigneDuBas from '../voyage/annee/LigneDuBas'
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

/** Le mode du bandeau : la forme de la fiche d'abord, sinon (tant qu'elle charge ou s'écrit) la carte. */
function modeDuBandeau(annee: number, fiche: FicheAnnee | undefined, v: Voyage | undefined): Mode {
  if (fiche && 'statut' in fiche) {
    if (fiche.statut === 'verrouillee') return 'fermee'
    if (fiche.statut === 'en_attente') return 'attente'
  }
  return v ? MODE_DU_STATUT[statutDeLAnnee(annee, v.annee_en_cours)] : 'encours'
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

  // Mon journal : pour les films vus en avance d'une année fermée ou en attente, jamais pour une fiche prête.
  const journal = useQuery({
    queryKey: cles.journalComplet,
    queryFn: ({ signal }) => journalComplet(signal),
    enabled: !!fermee,
  })

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

  // « Utiliser » (décision D3) : encaisser, puis la carte, qui joue la marche vers l'année neuve.
  const utiliser = useMutation({
    mutationFn: (a: number) => utiliserTicket(a),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: cles.voyage })
      navigate('/voyage')
    },
  })
  // `isPending` ne se voit qu'au rendu suivant : deux touchers rapprochés encaisseraient deux fois.
  const envoi = useRef(false)
  const encaisser = (a: number) => {
    if (envoi.current) return
    envoi.current = true
    utiliser.mutate(a, { onSettled: () => void (envoi.current = false) })
  }

  // Le bandeau : le dernier toucher, en secondes de la toile, rouvre le rideau et emballe le manège.
  const dernierT = useRef(0)
  const touche = useRef(-9)
  const nuit = useMemo(() => {
    const d = new Date()
    return ambianceDeLHeure(d.getHours() + d.getMinutes() / 60).nuit
  }, [])
  const mode = modeDuBandeau(annee, fiche, v)
  const recompense = prete?.recompense ?? v?.annees.find((a) => a.annee === annee)?.recompense ?? null
  const cases = v ? v.annees.filter((a) => decennieDe(a.annee) === monde.decennie).map((a) => ({ annee: a.annee, etat: etatDeCase(a, v.ia).etat, profondeur: a.profondeur })) : []
  const bouclee = !!v?.tampons.some((t) => t.decennie === monde.decennie)
  // La roulotte du Voyage suivi, dans tous les modes dès que le membre en suit un ; jamais au compte IA.
  const roulotte = v && !v.ia && v.source ? { pseudo: v.source.pseudo, annee: v.source.annee_en_cours } : null

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
        <Fronton annee={annee} annonce={enCours ? m.annonce.enCours : m.annonce.bouclee} millesime={enCours ? 'encours' : 'bouclee'} monde={monde} />
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
    corps = (
      <AnneeFermee
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
      />
    )
  }

  return (
    <section className={styles.page} aria-label={`L’année ${annee}`} style={style}>
      <div className={styles.bandeau}>
        <Toile
          hauteur={hauteurs.bandeau}
          libelle={`Le décor de ${annee}.`}
          onToucher={() => {
            if (!calme) touche.current = dernierT.current
          }}
          dessiner={(ctx, t, vivant) => {
            dernierT.current = t
            monde.pages.dessinerBandeau({ ctx, W: LARGEUR_LOGIQUE, H: hauteurs.bandeau, t, vivant, nuit, mode, annee, recompense, cases, bouclee, roulotte, touche: touche.current })
          }}
        />
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
        {monde.chapitre ? <span className={styles.plaque}>{monde.chapitre}</span> : null}
      </div>
      {corps}
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
}

/** La fiche prête (maquette 1890 : `htmlAnnee`, écrans I et II) : l'année en cours, ou bouclée. */
function FichePreteDeLAnnee({ monde, annee, fiche, voyage: v, feuille, generique, onUtiliser, occupe, erreur }: PropsPrete) {
  const m = monde.pages.mots
  const enCours = statutDeLAnnee(annee, v.annee_en_cours) !== 'ouverte'
  const billets = billetsDeProgression(fiche.profondeur, fiche.progression).map((b) => ({
    ...b,
    tete: b.cle === 'essentiels' ? 'Essentiels' : b.cle === 'salles' ? 'Salles' : undefined,
  }))
  const sous = `${monde.nom} · ${monde.sous}`

  return (
    <>
      <Fronton annee={annee} annonce={enCours ? m.annonce.enCours : m.annonce.bouclee} millesime={enCours ? 'encours' : 'bouclee'} monde={monde}>
        {enCours ? null : <span className={styles.ruban}>{fiche.recompense ? `Bouclée · ${NOM_DE_RECOMPENSE[fiche.recompense]}` : 'Bouclée'}</span>}
      </Fronton>
      <Corde billets={billets} />
      <Boniment
        monde={monde}
        annee={annee}
        recompense={fiche.recompense}
        ouverture={fiche.ouverture}
        faits={fiche.faits}
        generique={afficherGenerique(fiche.ticket)}
        onLire={() => feuille.ouvrir('ouverture')}
        onGenerique={() => feuille.ouvrir('generique')}
      />
      {enCours ? <Programme monde={monde} etapes={prochainPas(fiche.profondeur, fiche.progression, fiche.recompense, fiche.ticket !== null, v.ia)} progression={fiche.progression} /> : null}
      <Parade monde={monde} annee={annee} podium={fiche.podium} salles={fiche.salles} />
      {/* La séance n'appartient qu'au compte IA (l'API la refuse aux autres), et à l'année en cours. */}
      {enCours && v.ia ? <Seance monde={monde} annee={annee} fiche={fiche} /> : null}
      <Salles monde={monde} annee={annee} fiche={fiche} ia={v.ia} />
      {/* Le jury n'appartient qu'au compte IA : jamais promis à un autre membre, quoi que porte la fiche. */}
      <LigneDuBas monde={monde} annee={annee} ligne={ligneDuBas(fiche.ticket, v.ia ? fiche.maturite : null, v.annee_en_cours)} onUtiliser={onUtiliser} occupe={occupe} erreur={erreur} />

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
