import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { journalComplet } from '../api/journal'
import { lireReactions } from '../api/reactions'
import { lireStats } from '../api/stats'
import { useSession } from '../session/SessionContext'
import Panne from '../ui/Panne'
import { jourLocal } from '../ui/format'
import Ampoules from '../profil/Ampoules'
import CarteAdherent from '../profil/CarteAdherent'
import Jauge from '../profil/Jauge'
import Perforations from '../profil/Perforations'
import Section from '../profil/Section'
import SectionsEnAttente from '../profil/SectionsEnAttente'
import SoucheCaisse from '../profil/SoucheCaisse'
import Tickets from '../profil/Tickets'
import Vumetre from '../profil/Vumetre'
import {
  anneeDAdhesion,
  filmsParDecennie,
  filmsParMois,
  heuresDeFilms,
  noteMoyenne,
  reactionsComptees,
  repartitionNotes,
} from '../profil/bilan'
import styles from './Profil.module.css'

/**
 * Le profil, le portefeuille du membre (reprise de `ProfileScreen.kt`) : sa carte d'adhérent (les
 * chiffres de `GET /stats`), puis ses graphiques dessinés comme des objets de cinéma, calculés depuis
 * le journal entier : notes, réactions, décennies, mois. En bas, le ticket de caisse mène aux
 * réglages (`profil/reglages`). Un journal qui échoue se tait : il ne prive que les graphiques.
 */
export default function Profil() {
  const { user } = useSession()
  const stats = useQuery({ queryKey: cles.stats, queryFn: ({ signal }) => lireStats(signal) })
  const journal = useQuery({ queryKey: cles.journalComplet, queryFn: ({ signal }) => journalComplet(signal) })
  const reactions = useQuery({ queryKey: cles.reactions, queryFn: ({ signal }) => lireReactions(signal) })

  const tout = stats.data?.dashboard.periods.all
  const minutes = tout?.quantities.movie_minutes
  const aujourdhui = jourLocal()
  const annee = Number(aujourdhui.slice(0, 4))
  const moisCourant = Number(aujourdhui.slice(5, 7)) - 1

  // Pas de graphique sur un journal vide ou pas encore arrivé : dix zéros ne diraient rien.
  const films = journal.data && journal.data.length > 0 ? journal.data : null
  const reactionsMontrees = films && reactions.data ? reactionsComptees(films, reactions.data.reactions) : []
  const decennies = films ? filmsParDecennie(films) : []

  return (
    <div className={styles.fond}>
      {/* La couleur du membre : la carte la lit pour sa bande, les mois pour le leur. */}
      <div className={styles.page} style={{ '--identite': user.identity_color } as CSSProperties}>
        <h1 className="sr-only">Profil de {user.pseudo}</h1>

        <CarteAdherent
          pseudo={user.pseudo}
          films={tout?.counts.finished_by_type.movie ?? null}
          heures={minutes ? heuresDeFilms(minutes.value) : null}
          cetteAnnee={stats.data?.dashboard.periods.year.counts.finished_by_type.movie ?? null}
          sansDuree={minutes?.coverage.missing ?? 0}
          depuis={films ? anneeDAdhesion(films) : null}
          enAttente={stats.isPending}
        />

        {stats.error ? <Panne erreur={stats.error} onReessayer={() => void stats.refetch()} /> : null}

        {films ? (
          <>
            <Section titre="Notes">
              <div className={styles.objets}>
                <Jauge moyenne={noteMoyenne(films)} />
                <Vumetre comptes={repartitionNotes(films)} />
              </div>
            </Section>

            {reactionsMontrees.length > 0 ? (
              <Section titre="Réactions">
                <Tickets reactions={reactionsMontrees} />
              </Section>
            ) : null}

            <Section titre={`Décennies · ${decennies.filter((compte) => compte > 0).length} sur ${decennies.length}`}>
              <Perforations comptes={decennies} />
            </Section>

            <Section titre={`Mois · ${annee}`}>
              <Ampoules annee={annee} comptes={filmsParMois(films, annee)} moisCourant={moisCourant} />
            </Section>
          </>
        ) : journal.isPending ? (
          <SectionsEnAttente annee={annee} />
        ) : null}

        <div className={styles.souche}>
          <SoucheCaisse />
        </div>
      </div>
    </div>
  )
}
