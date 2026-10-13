import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PARAMETRE, VUE_D_OUVERTURE, ecrireLaVue, lireLaVue, rechercheAvec, type Vue } from './vues'

/**
 * Ce que chaque entrée d'historique du panneau sait d'elle-même (l'état de l'entrée, que le navigateur
 * garde avec elle : rien n'est écrit ailleurs).
 * - `sous` : le bouton l'a ouvert, la page fermée est donc l'entrée juste dessous ;
 * - `pas` : combien de vues ont été poussées depuis l'ouverture ;
 * - `avant` : la vue de l'entrée juste dessous, quand c'est une vue du panneau.
 * Une adresse ouverte telle quelle (un lien, un rechargement d'un autre appareil) n'a pas cet état :
 * rien dessous n'est sûr, on ne recule pas.
 */
interface Trace {
  sous: boolean
  pas: number
  avant?: string
}

/** `surPlace` : `coque/defilement.ts` ne remonte pas la page, qui reste où elle est sous le panneau. */
interface Etat {
  telecommande: Trace
  surPlace: true
}

const etat = (trace: Trace): Etat => ({ telecommande: trace, surPlace: true })

function traceDe(state: unknown): Trace {
  const trace = (state as Partial<Etat> | null)?.telecommande
  return trace && typeof trace.pas === 'number' ? trace : { sous: false, pas: 0 }
}

/**
 * Le panneau tient par l'adresse. Ouvrir et changer de vue **poussent** une entrée : le retour du
 * téléphone ferme, ou revient à la vue d'avant. Les gestes dessinés reculent dans l'historique quand
 * l'entrée d'avant est connue (le panneau ne s'empile pas sur lui-même), et remplacent l'adresse sinon.
 */
export function useTelecommande() {
  const naviguer = useNavigate()
  const { search, state, key } = useLocation()
  const vue = lireLaVue(search)
  const trace = traceDe(state)

  // La fermeture d'un panneau ouvert par son adresse, depuis une vue poussée : on recule jusqu'à l'entrée
  // de l'adresse, **puis** on lui ôte le paramètre. Sans ce second temps, le retour du téléphone
  // retrouverait cette entrée et rouvrirait le panneau.
  const aOter = useRef(false)
  useEffect(() => {
    if (!aOter.current) return
    aOter.current = false
    if (lireLaVue(search)) naviguer({ search: rechercheAvec(search, null) }, { replace: true, state: { surPlace: true } })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- à chaque entrée d'historique atteinte, pas à chaque rendu
  }, [key])

  return {
    /** La vue ouverte, ou `null` : le panneau est fermé. */
    vue,
    /** La vue d'où l'on vient, si c'en est une du panneau : c'est là que `revenir` ramène. */
    precedente: trace.pas > 0 && trace.avant ? lireLaVue(`?${PARAMETRE}=${trace.avant}`) : null,
    /** Ouvrir, du bouton rond. Déjà ouvert, il ne fait rien : un second toucher n'empile pas une entrée que « Fermer » ne quitterait pas. */
    ouvrir: () => {
      if (vue) return
      naviguer({ search: rechercheAvec(search, VUE_D_OUVERTURE) }, { state: etat({ sous: true, pas: 0 }) })
    },
    /** Passer à une autre vue du panneau. */
    allerA: (suivante: Vue) => naviguer({ search: rechercheAvec(search, suivante) }, { state: etat({ sous: trace.sous, pas: trace.pas + 1, avant: vue ? ecrireLaVue(vue) : undefined }) }),
    /** Le retour d'une vue : à celle d'avant si on en vient, sinon à `parente`, à sa place. */
    revenir: (parente: Vue = VUE_D_OUVERTURE) => {
      if (trace.pas > 0) naviguer(-1)
      else naviguer({ search: rechercheAvec(search, parente) }, { replace: true, state: etat(trace) })
    },
    /** Prendre la place de la vue ouverte, sans entrée de plus : la télécommande réglée sur la série qu'on vient d'ajouter remplace l'ajout. */
    remplacer: (suivante: Vue) => naviguer({ search: rechercheAvec(search, suivante) }, { replace: true, state: etat(trace) }),
    /**
     * Fermer **quitte toutes les entrées du panneau** : retrouver la page d'où le bouton a ouvert ;
     * sinon (une adresse ouverte telle quelle) reculer des vues poussées puis ôter le paramètre.
     */
    fermer: () => {
      if (trace.sous) naviguer(-(trace.pas + 1))
      else if (trace.pas > 0) {
        aOter.current = true
        naviguer(-trace.pas)
      } else naviguer({ search: rechercheAvec(search, null) }, { replace: true, state: { surPlace: true } })
    },
  }
}
