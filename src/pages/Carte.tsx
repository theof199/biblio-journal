import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconBriefcase, IconCurrentLocation, IconMap2, IconVolume, IconVolumeOff } from '@tabler/icons-react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { ApiError } from '../api/client'
import { estPrete, lireAnnee, lireCourrier, lireMalle, lireTickets, lireVoyage, lireVoyageur, ramasserObjet, utiliserTicket, type BilletDemande, type FicheAnnee, type Voyageur } from '../api/voyage'
import CarteCanvas, { type Moteur } from '../carte/CarteCanvas'
import Apercu from '../carte/Apercu'
import type { CaseCarte, EtatCarte } from '../carte/moteur'
import { jouerAvancee } from '../carte/avancee'
import { ecrireAnneeVue, ecrireBobines, ecrireSon, lireAnneeVue, lireBobines, lireSon } from '../carte/memoire'
import { ambianceDeLaPage } from '../carte/son'
import { auTempo, STYLE_DU_TEMPO } from '../voyage/tempo'
import { creerRegistre } from '../mondes'
import type { BobinePerdue, DateVraie, ObjetCache } from '../mondes/types'
import { useSession } from '../session/SessionContext'
import Panne from '../ui/Panne'
import { vibrer } from '../ui/haptique'
import { useMouvementReduit } from '../ui/mouvement'
import Celebrations from '../voyage/celebrations/Celebrations'
import { sceneDuRattrapage, type Scene } from '../voyage/celebrations/scenes'
import Controleur from '../voyage/controleur/Controleur'
import { useCalque } from '../voyage/calque'
import { gabaritSeul } from '../voyage/gabarit'
import Halte from '../voyage/halte/Halte'
import { compteDeLaHalte } from '../voyage/halte/compte'
import { horaireDePlaque } from '../voyage/horaire'
import { tamponDe } from '../voyage/passeport'
import { nomDeLaSacoche, nouveautesDeLaSacoche, rubriquesDeLaPastille } from '../voyage/voyageur'
import Tampon from '../voyage/passeport/Tampon'
import {
  affichesDeColonne,
  anneesMontrees,
  compterRecompenses,
  decennieDe,
  detecterFrontiereAvancee,
  estFermee,
  estMontree,
  etatDeCase,
  halteOfferte,
  jauge,
  premiereDecennieCachee,
  prochainPas,
  recompensesJusquaAnneeEnCours,
  rattrapeBientot,
  ticketOffert,
  tropLent,
  type FrontiereAvancee,
} from '../voyage/regles'
import styles from '../carte/Carte.module.css'

const mondes = creerRegistre()
/** Le déblocage (plan 3b) : seul un monde à scène collante se ferme à qui ne l'a pas atteint. */
const aUneScene = (decennie: number) => mondes(decennie).scene !== null
/**
 * Ce que la liste des années dit de l'horaire d'une gare à qui ne voit pas sa plaque (plan des écrans
 * des lots, brief 11) : la règle de la plaque (`horaireDePlaque` : « à l'heure », « avant dimanche »,
 * rien pour un horaire manqué ni pour une année fermée), et seulement dans un monde qui compose
 * l'horaire (`horaireDeLAnnee`, la présence que regarde aussi la fiche d'année) : en 1890 la liste se tait.
 * Fermée se dit par la règle que lit la plaque (`estFermee`, `voyage/regles.ts`), et la liste se tait
 * comme elle tant que l'avatar n'est pas arrivé à l'année (`aDevelopper` du monde : le trajet).
 */
function horaireLu(c: Pick<CaseCarte, 'annee' | 'etat' | 'attente' | 'horaire'>, anneeAvatar: number | null): string {
  if (gabaritSeul(mondes(decennieDe(c.annee)), 'horaireDeLAnnee') === null) return ''
  const dit = horaireDePlaque(c.horaire, estFermee(c) || anneeAvatar === null || c.annee > anneeAvatar)
  return dit ? `, ${dit.mention}` : ''
}

/**
 * **L'ordre des dialogues de la carte** : ce qui tient l'écran, du plus fort au plus faible. Un seul
 * est le « dialogue courant » (`dialogueCourant`, dans la page), le premier de cet ordre dont le
 * prétendant est vrai ; les autres attendent qu'il retombe. D'abord ce qui tient l'écran seul
 * (l'avancée, la fête du rattrapage, un passage, la vue d'ensemble, l'affiche d'une date, l'aperçu),
 * puis la portière du contrôleur, puis la halte. **Un dialogue neuf s'ajoute ici, à son rang** : le
 * type oblige alors la page à dire quand il prétend à l'écran, et rien d'autre n'est à retoucher.
 */
export const ORDRE_DES_DIALOGUES = ['avancee', 'fete', 'passage', 'ensemble', 'affiche', 'apercu', 'portiere', 'halte'] as const
export type DialogueDeLaCarte = (typeof ORDRE_DES_DIALOGUES)[number]
/** Le premier de l'ordre qui prétend à l'écran, ou nul : l'écran est à qui veut. */
export const premierDialogue = (pretendants: Record<DialogueDeLaCarte, boolean>): DialogueDeLaCarte | null => ORDRE_DES_DIALOGUES.find((d) => pretendants[d]) ?? null

/** Le passage d'entrée (plan 3b) : un monde à scène dont `entree` porte au moins un temps. */
const aUnPassage = (decennie: number) => (mondes(decennie).scene?.entree.length ?? 0) > 0
/**
 * Hors du composant, donc stable : `useQueries` ne rend alors un nouveau tableau que si une
 * fiche change (constaté, TanStack Query 5.104). Sans lui, un tableau neuf à chaque rendu
 * referait l'état de la carte, et le moteur jetterait ses tuiles à chaque rendu de la page (un aperçu, une petite affiche).
 */
const donneesDesFiches = (r: Array<{ data: FicheAnnee | undefined }>) => r.map((q) => q.data)
/**
 * Le message d'une bobine qui arrive au compteur s'efface après trois secondes ; celui des trois
 * retrouvées vient après lui (maquette : `toast`, et le `setTimeout` de 3300 ms d'`arriver`). Des
 * temps de lecture, pas d'animation : ils ne suivent pas le tempo.
 */
const LECTURE_MS = 3000
const APRES_LA_DERNIERE_MS = 3300
/**
 * Le temps que tient l'annonce hors de vue d'un monde à passage (plan 3b, tâche 13), au tempo, ici
 * seulement : aujourd'hui aussi longtemps que le carton qu'elle remplace. `voyage/tempo.test.ts` la garde.
 */
const DUREE_DE_L_ANNONCE = auTempo(1550)
const LIBELLE = { palme: 'Palme', lion: 'Lion', ours: 'Ours', encours: 'en cours', passee: 'passée', verrou: 'à tourner' } as const

/**
 * `inert` : ni toucher, ni focus, ni clavier, sans rien changer à l'œil. React 18 ne le connaît pas et
 * le pose tel quel, d'où la chaîne vide ; à React 19, il devient un booléen.
 */
const INERTE = { inert: '' }
/**
 * L'envol d'un objet ramassé, du quai à la pastille de la sacoche (maquette « Voyage immobile 1900 » :
 * `.objet-vol`, 1300 ms), au tempo : la même durée que `.vol` dans `carte/Carte.module.css`. Au calme,
 * rien ne vole et rien n'attend.
 */
const DUREE_DE_L_ENVOL = auTempo(1300)

export default function Carte() {
  const { user } = useSession()
  const navigate = useNavigate()
  const client = useQueryClient()
  const calme = useMouvementReduit()
  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const tickets = useQuery({ queryKey: cles.tickets, queryFn: ({ signal }) => lireTickets(signal) })
  const v = voyage.data

  // Les fiches déjà en cache (une visite, un aperçu) garnissent les colonnes Morris, sans rien lire.
  const fiches = useQueries({
    queries: (v?.annees ?? []).map((a) => ({
      queryKey: cles.annee(a.annee),
      queryFn: () => lireAnnee(a.annee),
      enabled: false,
    })),
    combine: donneesDesFiches,
  })

  const [anneeAvatar, setAnneeAvatar] = useState<number | null>(null)
  const [avancee, setAvancee] = useState<{ av: FrontiereAvancee; vers: number } | null>(null)
  const [moteur, setMoteur] = useState<Moteur | null>(null)
  const [apercu, setApercu] = useState<{ annee: number; ancre: { x: number; y: number } } | null>(null)
  const [ensemble, setEnsemble] = useState(false)
  /** Vrai tant que le moteur n'a pas dit le contraire : « Tu es ici » ne s'offre qu'à l'avatar perdu de vue. */
  const [avatarVu, setAvatarVu] = useState(true)
  /** L'année à bâtir sous les yeux dès que le moteur est là : la toute première visite, au départ du Voyage (idée 8). */
  const [chantierDuDepart, setChantierDuDepart] = useState<number | null>(null)
  const [date, setDate] = useState<DateVraie | null>(null)
  const [roulotteDite, setRoulotteDite] = useState(false)
  const [calque, setCalque] = useState<{ type: 'tampon'; decennie: number } | { type: 'carton'; annee: number } | null>(null)
  // Le passage d'entrée d'un monde (plan 3b). `bonjour` : l'avancée en est à ce temps-là, le seul où
  // la toile répond (un toucher pose le passage à sa fin). `annonce` : la décennie dont les lignes du
  // carton sont dites hors de vue, le passage tenant lieu de carton. `proche` : celle dont le moteur
  // dit le passage à portée de geste.
  const [bonjour, setBonjour] = useState(false)
  const [annonce, setAnnonce] = useState<number | null>(null)
  const [proche, setProche] = useState<number | null>(null)

  // Le son (plan 2d) : une ambiance par page, qui ne crée rien avant le bouton « Son ». Le réglage
  // retenu ne rallume rien de lui-même : il dit seulement au bouton de proposer de le reprendre.
  const [ambiance] = useState(() => ambianceDeLaPage(user.id))
  const [sonEnMarche, setSonEnMarche] = useState(() => ambiance.enMarche)
  const [sonVoulu, setSonVoulu] = useState(() => lireSon(user.id))
  useEffect(() => {
    const cache = () => ambiance.taire(document.hidden)
    cache()
    document.addEventListener('visibilitychange', cache)
    return () => {
      document.removeEventListener('visibilitychange', cache)
      ambiance.taire(true)
    }
  }, [ambiance])
  const basculerSon = () => {
    if (ambiance.enMarche) {
      ambiance.couper()
      setSonEnMarche(false)
      setSonVoulu(false)
      ecrireSon(user.id, false)
    } else if (ambiance.allumer()) {
      setSonEnMarche(true)
      setSonVoulu(true)
      ecrireSon(user.id, true)
    } else {
      setMessage({ titre: 'Le son n’est pas disponible dans ce navigateur.', texte: null })
    }
  }

  // Les bobines perdues (plan 2d) : trouvées sur cet appareil, par membre. Celle qui vole vers le
  // compteur n'y est comptée qu'à son arrivée.
  const [trouvees, setTrouvees] = useState(() => lireBobines(user.id))
  const trouveesRef = useRef(trouvees)
  const [enVol, setEnVol] = useState<string | null>(null)
  const [pulsation, setPulsation] = useState(0)
  const [message, setMessage] = useState<{ titre: string; texte: string | null } | null>(null)
  const compteurRef = useRef<HTMLParagraphElement>(null)
  // Le compteur va par décennie (plan 3a) : il montre celle qui est à l'écran, que le moteur dit à
  // chaque image. La référence retient la dernière qu'il a dite, sans rendre la page ; l'état est la
  // décennie montrée, qui ne bouge que lorsque le moteur en dit une autre ou qu'une bobine arrive.
  // Nul tant que rien ne l'a posé : le compteur montre alors la décennie d'ouverture.
  const [decennieVue, setDecennieVue] = useState<number | null>(null)
  const decennieVueRef = useRef<number | null>(null)
  const ecranRef = useRef<HTMLDivElement>(null)
  const derniereRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (derniereRef.current !== null && clearTimeout(derniereRef.current)), [])
  useEffect(() => {
    if (!message) return
    const j = setTimeout(() => setMessage(null), LECTURE_MS)
    return () => clearTimeout(j)
  }, [message])

  // La frontière : à l'ouverture, depuis la dernière année que cet appareil a montrée ; ensuite,
  // depuis là où se tient l'avatar.
  useEffect(() => {
    if (!v || avancee) return
    const apres = v.annee_en_cours
    const depuis = anneeAvatar ?? lireAnneeVue(user.id)
    const av = detecterFrontiereAvancee(depuis, apres)
    if (av) {
      setAnneeAvatar(av.anneeQuittee)
      setAvancee({ av, vers: apres })
      // La petite affiche d'une date est derrière l'avancée : ouverte, son « Refermer » ne répondrait plus.
      setDate(null)
    } else if (anneeAvatar !== apres) {
      // Aucune année vue, ni ici ni en mémoire, au départ du Voyage : la toute première visite voit
      // la séance de 1895 s'installer. La mémoire écrite ici, la visite suivante ne la revoit pas.
      if (depuis === null && apres === v.depart) setChantierDuDepart(apres)
      setAnneeAvatar(apres)
      ecrireAnneeVue(user.id, apres)
    }
  }, [v, anneeAvatar, avancee, user.id])

  useEffect(() => {
    if (!moteur || chantierDuDepart === null) return
    moteur.ouvrirSousLesYeux(chantierDuDepart)
    setChantierDuDepart(null)
  }, [moteur, chantierDuDepart])

  const decenniesDuVoyage = useMemo(() => [...new Set((v?.annees ?? []).map((a) => decennieDe(a.annee)))].sort((a, b) => a - b), [v])

  const attendre = useCallback((ms: number) => new Promise<void>((fin) => setTimeout(fin, ms)), [])

  // La phrase de la roulotte s'efface d'elle-même, au rythme du carton.
  useEffect(() => {
    if (!roulotteDite) return
    const j = setTimeout(() => setRoulotteDite(false), 3100)
    return () => clearTimeout(j)
  }, [roulotteDite])

  // L'annonce hors de vue s'efface d'elle-même (`DUREE_DE_L_ANNONCE`).
  useEffect(() => {
    if (annonce === null) return
    const j = setTimeout(() => setAnnonce(null), DUREE_DE_L_ANNONCE)
    return () => clearTimeout(j)
  }, [annonce])

  useEffect(() => {
    if (!avancee || !moteur || !v) return
    let vivant = true
    // La fin de l'avancée, quelle qu'elle soit : un temps qui échoue ne laisse ni l'avatar en chemin
    // ni la carte inerte (`.fond`). La mise en scène est un décor, le membre est déjà dans son année.
    const finir = () => {
      if (!vivant) return
      setAnneeAvatar(avancee.vers)
      ecrireAnneeVue(user.id, avancee.vers)
      setAvancee(null)
    }
    void jouerAvancee(avancee.av, avancee.vers, v.tampons.map((t) => t.decennie), {
      // La porte passée, le monde quitté dit adieu (idée 7) : `passerLaPorte` n'est appelée qu'au
      // changement de décennie, `decennieQuittee` n'y est jamais nulle.
      passerLaPorte: async () => {
        await moteur.passerLaPorte()
        if (vivant && avancee.av.decennieQuittee !== null) await moteur.direAdieu(avancee.av.decennieQuittee)
      },
      marcher: async (vers) => {
        if (vivant) await moteur.marcher(vers)
      },
      montrerTampon: async (decennie) => {
        if (!vivant) return
        setCalque({ type: 'tampon', decennie })
        await attendre(1800)
        if (vivant) setCalque(null)
      },
      montrerCarton: async (annee) => {
        if (!vivant) return
        setCalque({ type: 'carton', annee })
        await attendre(3100)
        if (vivant) setCalque(null)
      },
      claquer: () => {
        if (!vivant) return
        moteur.claquer()
        vibrer(20)
      },
      aUnPassage,
      // Le monde d'arrivée dit bonjour : une avancée ne va que vers l'avant, le passage se joue à
      // l'endroit. Le temps de ce passage, et lui seul, la toile sort de l'inertie.
      direBonjour: async (decennie) => {
        if (!vivant) return
        setAnnonce(decennie)
        setBonjour(true)
        try {
          await moteur.direBonjour(decennie, 'endroit')
        } finally {
          if (vivant) setBonjour(false)
        }
      },
    }).then(finir, finir)
    // L'avancée abandonnée (rejouée parce que le Voyage est relu, ou page quittée) s'arrête là : chacun
    // de ses temps relit `vivant` avant de commander le moteur ou de poser un calque, et le calque
    // qu'elle montrait part avec elle. Une seule avancée mène le moteur à la fois.
    return () => {
      vivant = false
      setCalque(null)
      setBonjour(false)
    }
  }, [avancee, moteur, v, attendre, user.id])

  // Les années des tickets émis, en une chaîne : relus sans changement, ils ne refont pas l'état de
  // la carte (chaque `majEtat` vide les tuiles du sol).
  const ticketsEmis = (tickets.data?.tickets ?? []).map((t) => t.annee).join(',')
  const etat = useMemo<EtatCarte | null>(() => {
    if (!v || anneeAvatar === null) return null
    // Le rang d'une année dans `v.annees` est celui de sa fiche dans `fiches` : chaque case prend la
    // sienne d'abord, les années cachées sont ôtées ensuite (`anneesMontrees`), jamais l'inverse.
    const cases = v.annees.map((a, i) => {
      const { etat, attente } = etatDeCase(a, v.ia)
      const fiche = fiches[i]
      return {
        annee: a.annee,
        etat,
        attente,
        // L'horaire tel que servi : son état et son échéance, que le serveur décide (brief 9 des écrans
        // des lots). Le monde le reçoit par `CaseVue.horaire`, 1900 le dit sur sa plaque (brief 11), et
        // la liste des années le lit ici (`horaireLu`).
        horaire: a.horaire ? { etat: a.horaire.etat, echeance: a.horaire.echeance } : null,
        profondeur: a.profondeur,
        jauge: jauge(a.progression, a.recompense),
        affiches: affichesDeColonne(a, estPrete(fiche) ? fiche : undefined),
      }
    })
    const cachee = premiereDecennieCachee(v.annees, v.annee_en_cours, aUneScene)
    const montrees = anneesMontrees(cases, v.annee_en_cours, aUneScene)
    return {
      anneeAvatar,
      tampons: v.tampons.map((t) => t.decennie),
      tickets: ticketsEmis === '' ? [] : ticketsEmis.split(',').map(Number),
      // La roulotte (idée 1) : garée là où en est le Voyage suivi ; la sienne, pour qui le mène. Le
      // Voyage suivi rendu dans une décennie cachée n'a pas de case où se garer : aucune roulotte
      // (`null`), et non `annee: null`, qui dirait « je mène » et ferait traverser son pseudo.
      roulotte: !v.source
        ? { pseudo: user.pseudo, annee: null }
        : estMontree(v.source.annee_en_cours, cachee)
          ? { pseudo: v.source.pseudo, annee: v.source.annee_en_cours }
          : null,
      // La liste pour lecteur d'écran se lit sur ces cases : elle ne nomme pas plus une année cachée.
      cases: montrees,
      // Les haltes servies, pour le monde qui en dessinera l'embranchement : jamais celle d'une année
      // que la carte ne montre pas (une décennie cachée, `premiereDecennieCachee`), ni celle d'une
      // décennie que j'ai quittée, ni celle dont la gare est encore à développer (`halteOfferte` :
      // rendu en 1910, la ligne de 1900 n'a plus ni levier ni poteau ; en 1901, la gare de 1902 n'a
      // pas encore le sien ; et ni le toucher ni l'adresse n'ouvrent ces haltes, qui se lisent ici). Le
      // compte se fait sur ce qui est servi, jamais sur un catalogue de l'appli.
      haltes: v.haltes
        .filter((h) => halteOfferte(h.apres, v.annee_en_cours, montrees.find((c) => c.annee === h.apres)))
        .map((h) => ({ cle: h.cle, nom: h.nom, apres: h.apres, ...compteDeLaHalte(h.films) })),
    }
  }, [v, anneeAvatar, fiches, user.pseudo, ticketsEmis])

  const ticket = v && tickets.data ? ticketOffert(v.annee_en_cours, tickets.data.tickets) : undefined
  const utiliser = useMutation({
    mutationFn: (annee: number) => utiliserTicket(annee),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: cles.voyage })
    },
  })
  // `isPending` ne se voit qu'au rendu suivant (TanStack notifie par `setTimeout`) : deux
  // touchers rapprochés encaisseraient deux fois, et le second répondrait 404 « déjà utilisé ».
  const envoi = useRef(false)
  const encaisser = (annee: number) => {
    if (envoi.current) return
    envoi.current = true
    utiliser.mutate(annee, { onSettled: () => void (envoi.current = false) })
  }

  // Le rattrapage de l'année bouclée : un ticket gagné et pas encore montré (`ticket_a_montrer`, le
  // verdict du jury tombé loin de la fiche) joue sa scène à l'ouverture de la carte, une fois ; le
  // choix le marque montré. Jamais pendant une avancée, ni deux fois pour le même ticket tant que la
  // carte est ouverte (un `/montre` refusé le rendrait à la relecture). L'avatar rendu à mon année en
  // cours dit qu'aucune avancée n'attend : `avancee` seule ne le dit pas, l'effet de la frontière la
  // pose dans le rendu même où celui-ci la lirait encore nulle.
  const [fete, setFete] = useState<Extract<Scene, { type: 'annee' }> | null>(null)
  const [ticketFete, setTicketFete] = useState<number | null>(null)
  const rattrapage = useMemo(() => (v ? sceneDuRattrapage(v) : null), [v])
  // La fête qui va se lancer, dite dès le rendu qui la décide : l'effet ci-dessous ne la pose dans
  // `fete` qu'au rendu suivant, et `pleinEcranOccupe`, lu dans la même passe d'effets, la croirait absente.
  const feteAVenir = !!v && !avancee && anneeAvatar === v.annee_en_cours && rattrapage !== null && ticketFete !== rattrapage.ticket
  useEffect(() => {
    if (!feteAVenir || !rattrapage) return
    setTicketFete(rattrapage.ticket)
    setFete(rattrapage)
  }, [feteAVenir, rattrapage])

  // Les objets oubliés dans le décor (lot d'écrans, brief 4) : ceux des mondes que la carte montre.
  // Aucun en 1890 ni devant le monde « à venir », et 1900 est caché à qui ne l'a pas atteint : la
  // carte ne lit alors pas l'état du voyageur. `etat` est mémoïsé, la liste l'est avec lui.
  const objetsDeLaCarte = useMemo<readonly ObjetCache[]>(() => [...new Set((etat?.cases ?? []).map((c) => decennieDe(c.annee)))].flatMap((d) => mondes(d).objets), [etat])
  // Le point rouge de la pastille (brief 5) : les rubriques dont la sacoche du monde de mon année en
  // cours monte le bloc. Aucune en 1890 ni dans le monde « à venir » : rien de plus ne part alors.
  const anneeEnCours = v?.annee_en_cours
  const rubriquesDuPoint = useMemo(() => (anneeEnCours === undefined ? [] : rubriquesDeLaPastille(mondes(decennieDe(anneeEnCours)))), [anneeEnCours])
  // Le contrôleur des billets (brief 7) : la seule clé de gabarit que la carte lit, sans défaut, au
  // monde de mon année en cours. Sans elle (1890, le monde « à venir »), ni lecture ni portière.
  const DessinDuControleur = anneeEnCours === undefined ? null : gabaritSeul(mondes(decennieDe(anneeEnCours)), 'controleurDeLaCarte')
  // Une seule lecture de l'état du voyageur, pour les objets du quai, le point et le contrôleur.
  // **Elle seule se relit quand la fenêtre revient au premier plan** (`refetchOnWindowFocus`, coupé
  // pour tout le reste dans `api/queryClient.ts`) : `controleur.attend` change avec l'horloge du
  // serveur, sans écriture, et une carte restée ouverte ne le verrait pas entrer. Posé sur cet
  // observateur, donc pour cette clé seulement, et jamais là où la lecture est coupée (1890) : ni la
  // carte, ni les tickets, ni la malle, ni le courrier ne se relisent.
  const voyageur = useQuery({
    queryKey: cles.voyageur,
    queryFn: ({ signal }) => lireVoyageur(signal),
    enabled: objetsDeLaCarte.length > 0 || rubriquesDuPoint.length > 0 || DessinDuControleur !== null,
    refetchOnWindowFocus: 'always',
  })
  // La malle de ma décennie, pour les `collee_le` : seulement si une rubrique montée s'y date. En
  // panne ou pas encore lue, elle se tait : sa rubrique reste éteinte, et la carte reste.
  const decennieDeLaMalle = anneeEnCours !== undefined && rubriquesDuPoint.some((r) => r.malle) ? decennieDe(anneeEnCours) : null
  const malle = useQuery({ queryKey: cles.malle(decennieDeLaMalle ?? 0), queryFn: ({ signal }) => lireMalle(decennieDeLaMalle!, signal), enabled: decennieDeLaMalle !== null })
  // Ma boîte aux cartes postales, pour les `postee_le` des reçues (brief 13) : seulement si une
  // rubrique montée s'y date, donc jamais en 1890. **La carte n'en montre rien** : une carte postale
  // ne se lit que dans la sacoche. En panne ou pas encore lue, elle se tait comme la malle.
  const courrier = useQuery({ queryKey: cles.courrier, queryFn: ({ signal }) => lireCourrier(signal), enabled: rubriquesDuPoint.some((r) => r.boite) })
  // Le point se lit sur le cache, que la sacoche (une rubrique vue) et le quai (un objet ramassé)
  // écrivent champ par champ : il s'éteint et se rallume sans rien relire.
  const nouveautes = nouveautesDeLaSacoche(rubriquesDuPoint, { voyageur: voyageur.data, malle: malle.data, courrier: courrier.data })
  const nomDuLien = nomDeLaSacoche(nouveautes)
  // Ce que le moteur ne propose pas. Tant que l'état n'est pas lu, ou en panne sans rien en cache, on
  // ignore ce qui est ramassé : rien ne se propose, sans un mot, et la carte reste.
  const ramasses = voyageur.data?.objets
  const objetsRamasses = useMemo(() => (ramasses ?? objetsDeLaCarte).map((o) => o.cle), [ramasses, objetsDeLaCarte])
  const ramasser = useMutation({
    mutationFn: (cle: string) => ramasserObjet(cle),
    // Le cache n'apprend que la ligne rendue, à sa place dans `objets` : périmer le préfixe `voyage`
    // relirait la carte, les tickets, la malle et les fiches montées, et poser la réponse à la place
    // de l'état effacerait les rubriques vues, le contrôleur et les poinçons. Ici et non dans le
    // rappel du geste : la sacoche doit le voir même si la carte est quittée avant la réponse.
    // Une lecture de l'état partie avant la réponse atterrirait après et effacerait la ligne : elle
    // est annulée d'abord (l'état rendu à ce qu'il était, toujours périmé s'il l'était).
    onSuccess: async (ligne) => {
      await client.cancelQueries({ queryKey: cles.voyageur, exact: true })
      client.setQueryData<Voyageur>(cles.voyageur, (e) => e && { ...e, objets: [...e.objets.filter((o) => o.cle !== ligne.cle), ligne].sort((a, b) => a.annee - b.annee) })
    },
  })
  // Le verrou du geste, par objet (une référence, comme `envoi`) : le rappel du moteur rejoué pour le
  // même objet n'écrit pas deux fois. Deux objets différents se ramassent l'un pendant l'autre.
  const objetsEnMain = useRef(new Set<string>())
  const [vols, setVols] = useState<Array<{ objet: ObjetCache; de: { x: number; y: number }; vers: { x: number; y: number } }>>([])
  // Le refus du serveur à un ramassage (`{ code, message, retryable }`, `message` fait pour l'affichage) :
  // il se dit là où la carte dit ses messages, **sans prendre le plein écran** (il n'entre pas dans
  // `passager` : il ne retombe pas seul, et tiendrait le contrôleur et la halte dehors), et s'efface
  // au geste suivant, un doigt posé sur la carte ou un objet touché. L'API injoignable se dit de même,
  // par le message que `api/client.ts` lui donne.
  const [refusDuRamassage, setRefusDuRamassage] = useState<string | null>(null)
  const oublierLeRefus = useCallback(() => setRefusDuRamassage(null), [])
  const sacocheRef = useRef<HTMLAnchorElement>(null)
  // La séquence d'un ramassage attend l'envol : elle relit ce drapeau avant de toucher à la page.
  const monte = useRef(true)
  useEffect(() => {
    monte.current = true
    return () => void (monte.current = false)
  }, [])

  // Le contrôleur entre seul quand le serveur dit qu'il attend (décision 5 du propriétaire), une fois
  // par visite de la carte : la référence ne vit que le temps de la page, rien n'est retenu sur
  // l'appareil, et la carte remontée le revoit entrer tant qu'il attend. Jamais par-dessus autre
  // chose : il entre quand `pleinEcranOccupe` retombe. Le billet est celui que l'état annonçait alors.
  const [controle, setControle] = useState<BilletDemande | null>(null)
  const controleurPasse = useRef(false)
  const [passage, setPassage] = useState(false)
  // Une halte ouverte (brief 12) : **l'adresse le dit** (`?halte=<clé>` : le retour du téléphone la
  // ferme, un rechargement la rouvre), et rien d'autre. Elle n'existe que servie, montrée par la
  // carte (`etat.haltes` : jamais celle d'une décennie cachée, ni celle d'une décennie que j'ai
  // quittée, ni celle d'une gare à développer, `halteOfferte` : le toucher et l'adresse y lisent la même garde) et dessinée par le monde de sa
  // décennie (`halteDeLaCarte`, sans défaut) : une clé inconnue dans l'adresse n'ouvre rien. Portée
  // par l'adresse avant que l'écran soit libre (un rechargement, l'historique avancé), elle attend
  // son tour dans l'ordre des dialogues : jamais deux dialogues, jamais par-dessus une avancée.
  const calqueDeLaHalte = useCalque('halte')
  const halteDemandee = etat?.haltes?.some((h) => h.cle === calqueDeLaHalte.valeur) ? v?.haltes.find((h) => h.cle === calqueDeLaHalte.valeur) : undefined
  const DessinDeLaHalte = halteDemandee ? gabaritSeul(mondes(decennieDe(halteDemandee.apres)), 'halteDeLaCarte') : null
  /**
   * **Le dialogue courant** : le seul qui tient l'écran, le premier de `ORDRE_DES_DIALOGUES` qui y
   * prétend ; nul, l'écran est libre de tout dialogue. Calculé au rendu, sans référence : il vaut dans
   * la passe d'effets du rendu même qui le décide. `portiereOuverte`, `halteOuverte`, `dialogueOuvert`
   * et `pleinEcranOccupe` ne lisent que lui : jamais une garde à part. Ce que chacun prétend :
   *
   * - `avancee` : une avancée en cours **ou à venir**, l'avatar pas encore rendu à mon année en cours
   *   (`avancee` seule ne le dit pas, l'effet de la frontière la pose dans la passe où on la lirait
   *   encore nulle ; son passage d'entrée, son tampon et son carton y sont compris) ;
   * - `fete` : la fête du rattrapage, lancée (`fete`) ou sur le point de l'être (`feteAVenir`) ;
   * - `passage` : lancé par le bouton ou par le moteur sans lui (`Rappels.passage` : la halte au bout
   *   de la foire, le repos d'un défilement dans l'entrée) ; `ensemble` : la vue d'ensemble ;
   * - `affiche` : la petite affiche d'une date ; `apercu` : l'aperçu d'une année ;
   * - `portiere` : le billet retenu **et** le dessin du monde (mon année en cours passée, portière
   *   ouverte, à un monde sans la clé : des enveloppes inertes sans dialogue feraient une carte morte) ;
   * - `halte` : l'adresse porte une halte servie, montrée et dessinée.
   *
   * Aucun terme passager n'y entre (un message, la carte relue, un vol) : une halte que l'adresse
   * porte se fermerait à chaque relecture de la carte.
   */
  const dialogueCourant = premierDialogue({
    avancee: !v || anneeAvatar !== v.annee_en_cours,
    fete: feteAVenir || fete !== null,
    passage,
    ensemble,
    affiche: date !== null,
    apercu: apercu !== null,
    portiere: controle !== null && DessinDuControleur !== null,
    halte: halteDemandee !== undefined && DessinDeLaHalte !== null,
  })
  const portiereOuverte = dialogueCourant === 'portiere'
  const halteOuverte = dialogueCourant === 'halte'
  // Un dialogue de la carte est ouvert, la portière ou une halte : les deux enveloppes sont inertes
  // dessous, et le focus rendu au document revient au titre quand il se ferme.
  const dialogueOuvert = portiereOuverte || halteOuverte
  /**
   * Ce qui occupe l'écran **un instant** et retombe seul, sans geste : un ticket en cours
   * d'encaissement (`utiliser.isPending`, vrai dès le rendu qui suit le geste : celui qui ferme la
   * fête), puis la carte en relecture (`voyage.isFetching` : `onSuccess` la périme avant que la
   * mutation ne se dise finie, et la relue peut poser une avancée) ; une bobine ou un objet en vol,
   * un objet en cours de ramassage, un message d'état, la phrase de la roulotte.
   */
  const passager = utiliser.isPending || voyage.isFetching || enVol !== null || vols.length > 0 || ramasser.isPending || message !== null || roulotteDite
  /**
   * **Le plein écran est occupé** : le seul fait que lit un dialogue de la carte qui entre de lui-même
   * (le contrôleur) ou sous un toucher (l'aiguillage d'une halte), à la place de gardes dispersées.
   * Vrai tant qu'un dialogue tient l'écran ou va le prendre (`dialogueCourant`), ou que quelque chose
   * y passe (`passager`).
   *
   * Qui ajoute à la carte un calque ou un dialogue l'ajoute à `ORDRE_DES_DIALOGUES`
   * (`docs/cerveau/carte-et-moteur.md`).
   */
  const pleinEcranOccupe = dialogueCourant !== null || passager
  const billetDemande = DessinDuControleur && voyageur.data?.controleur.attend ? voyageur.data.controleur.billet : null
  useEffect(() => {
    if (pleinEcranOccupe || !billetDemande || controleurPasse.current) return
    controleurPasse.current = true
    setControle(billetDemande)
  }, [pleinEcranOccupe, billetDemande])
  const fermerLaPortiere = useCallback(() => setControle(null), [])
  // L'aiguillage touché (`Rappels.aiguillage`, la clé d'une halte) : la halte s'ouvre dans l'adresse,
  // jamais par-dessus autre chose (`pleinEcranOccupe`, le seul fait lu), et seulement si un monde la
  // dessine. Le moteur ne dédoublonne pas : deux touchers avant le rendu suivant n'empilent pas deux
  // entrées d'historique (une référence, que l'adresse rend dès qu'elle ne dit plus cette halte).
  const halteEnRoute = useRef<string | null>(null)
  const halteDeLAdresse = calqueDeLaHalte.valeur
  useEffect(() => {
    if (halteDeLAdresse !== halteEnRoute.current) halteEnRoute.current = null
  }, [halteDeLAdresse])
  // Le levier touché pendant que quelque chose **passe** (`passager` : en gare de 1902, le parapluie
  // qu'on vient de ramasser et son message tiennent l'écran plus de quatre secondes) n'est pas jeté :
  // sa clé est retenue, la dernière seulement, et la halte s'ouvre quand l'écran se libère. Sous ce
  // qui tient l'écran seul (`dialogueCourant`), le refus reste sec, et une demande retenue est
  // abandonnée : le membre a fait autre chose.
  const halteAttendue = useRef<string | null>(null)
  const ouvrirLaHalte = (cle: string) => {
    const halte = etat?.haltes?.find((h) => h.cle === cle)
    if (!halte || gabaritSeul(mondes(decennieDe(halte.apres)), 'halteDeLaCarte') === null) return false
    halteEnRoute.current = cle
    calqueDeLaHalte.ouvrir(cle)
    return true
  }
  const prendreLAiguillage = (cle: string) => {
    if (dialogueCourant !== null || halteEnRoute.current !== null) return
    if (!passager) return void ouvrirLaHalte(cle)
    if (etat?.haltes?.some((h) => h.cle === cle)) halteAttendue.current = cle
  }
  // À chaque rendu, sans dépendances : il ne lit que des faits du rendu et une référence.
  useEffect(() => {
    if (dialogueCourant !== null) halteAttendue.current = null
    if (pleinEcranOccupe || halteAttendue.current === null || halteEnRoute.current !== null) return
    const cle = halteAttendue.current
    halteAttendue.current = null
    ouvrirLaHalte(cle)
  })
  // Il est entré seul : le plus souvent rien n'avait le focus, et `useDialogue` n'a rien à qui le
  // rendre. La portière refermée, un focus tombé au document revient au titre de la carte (hors des
  // enveloppes, jamais inerte) ; rendu par le dialogue à l'élément qui l'avait, il y reste.
  const titreRef = useRef<HTMLHeadingElement>(null)
  const portiereVue = useRef(false)
  useEffect(() => {
    if (portiereVue.current && !dialogueOuvert && (document.activeElement === null || document.activeElement === document.body)) titreRef.current?.focus()
    portiereVue.current = dialogueOuvert
  }, [dialogueOuvert])

  if (voyage.isPending) return <p role="status">Chargement…</p>
  if (voyage.error || !v) return <Panne erreur={voyage.error} onReessayer={() => void voyage.refetch()} />

  const enCours = v.annees.find((a) => a.annee === v.annee_en_cours)
  const monde = mondes(Math.floor(v.annee_en_cours / 10) * 10)
  const compte = compterRecompenses(recompensesJusquaAnneeEnCours(v.annees, v.annee_en_cours))
  const ticketConnu = !!tickets.data?.tickets.some((t) => t.annee === v.annee_en_cours + 1)
  // Une année en attente du Voyage suivi le dit de lui (`tropLent`), nulle part ailleurs.
  const lent = tropLent(v.source)
  // La lectrice derrière le voyageur suivi : son année en cours le dit, nulle autre.
  const rattrape = rattrapeBientot(v)
  // Sans progression, l'année n'est pas encore ouverte : « Tout est vu » y serait faux.
  const objectif = !enCours
    ? null
    : !enCours.progression
      ? etatDeCase(enCours, v.ia).attente
        ? lent
        : 'Touche l’année pour l’ouvrir'
      : prochainPas(enCours.profondeur, enCours.progression, enCours.recompense, ticketConnu, v.ia)[0] ?? 'Tout est vu'
  const j = enCours ? jauge(enCours.progression, enCours.recompense) : null
  const apercuAnnee = apercu ? v.annees.find((a) => a.annee === apercu.annee) : undefined
  // À l'ouverture, la décennie de l'année en cours ; si son monde ne cache aucune bobine, la dernière
  // avant elle qui en cache. Ensuite celle que le moteur a dite à l'écran (`montrerDecennie`).
  const decennieDOuverture = decenniesDuVoyage.filter((d) => d <= decennieDe(v.annee_en_cours) && mondes(d).bobines.length > 0).pop() ?? null
  const decennieDeLaBobine = (cle: string) => decenniesDuVoyage.find((d) => mondes(d).bobines.some((b) => b.cle === cle)) ?? null
  // Une bobine en vol l'emporte : le compteur où elle arrive est celui de sa décennie, même ramassée
  // à une frontière, devant un autre monde. Il dit alors ce que dira le message.
  const decennieDuCompteur = (enVol === null ? null : decennieDeLaBobine(enVol)) ?? decennieVue ?? decennieDOuverture
  const bobinesDuCompteur = decennieDuCompteur === null ? [] : mondes(decennieDuCompteur).bobines
  const comptees = (bobines: readonly BobinePerdue[], cles: readonly string[], sauf: string | null) => bobines.filter((b) => cles.includes(b.cle) && b.cle !== sauf).length
  const nBobines = comptees(bobinesDuCompteur, trouvees, enVol)
  // Dit à chaque image : la page n'en retient que le changement. Devant un monde sans bobines, le
  // compteur garde la décennie qu'il montrait.
  const montrerDecennie = (decennie: number | null) => {
    if (decennie === null || decennie === decennieVueRef.current || mondes(decennie).bobines.length === 0) return
    decennieVueRef.current = decennie
    setDecennieVue(decennie)
  }
  const ramassee = (cle: string) => {
    if (!trouveesRef.current.includes(cle)) trouveesRef.current = [...trouveesRef.current, cle]
    setTrouvees(trouveesRef.current)
    ecrireBobines(user.id, trouveesRef.current)
    setEnVol(cle)
    ambiance.carillon()
  }
  const arrivee = (cle: string) => {
    setEnVol(null)
    setPulsation((p) => p + 1)
    // Le message compte dans la décennie de la bobine, et le compteur y reste : `decennieVueRef`
    // n'est pas touchée, elle garde ce que le moteur a dit en dernier. Le compteur ne revient donc à
    // la décennie à l'écran que lorsque le moteur en dit une autre, jamais à l'image suivante (il
    // apparaîtrait pour une bobine de 1900 et disparaîtrait aussitôt devant un 1890 sans trouvaille).
    const decennie = decennieDeLaBobine(cle)
    if (decennie !== null) setDecennieVue(decennie)
    const sienne = decennie === null ? [] : mondes(decennie).bobines
    const b = sienne.find((x) => x.cle === cle)
    const n = comptees(sienne, trouveesRef.current, null)
    const total = sienne.length
    if (b) setMessage({ titre: `Bobine retrouvée ${n}/${total}`, texte: `« ${b.titre} », ${b.qui} : un film perdu.` })
    if (b && n === total) {
      if (derniereRef.current !== null) clearTimeout(derniereRef.current)
      derniereRef.current = setTimeout(() => setMessage({ titre: total === 3 ? 'Les trois bobines perdues sont retrouvées.' : 'Toutes les bobines perdues sont retrouvées.', texte: null }), APRES_LA_DERNIERE_MS)
    }
  }
  // Maquette : `cibleHud`. Le compteur caché (avant la première trouvaille), le coin haut droit.
  const cibleBobines = () => {
    const e = ecranRef.current?.getBoundingClientRect()
    const r = compteurRef.current?.getBoundingClientRect()
    if (e && r && r.width) return { x: r.left - e.left + 14, y: r.top - e.top + r.height / 2 }
    return { x: (e?.width || 390) - 40, y: 40 }
  }

  // Un objet oublié touché (le rappel `objet` du moteur, qui l'a déjà ôté du décor) : la page l'écrit.
  // Accepté, il vole vers la pastille de la sacoche, puis la région d'état dit son compte dans son
  // monde et sa phrase ; au calme, il arrive d'un coup. Refusé ou en panne, il est rendu au moteur
  // et revient sur le quai : le toucher se refait. Refusé, le message du serveur se dit
  // (`refusDuRamassage`) jusqu'au geste suivant ; l'API injoignable aussi, par le message du client.
  const objetTouche = (cle: string, de: { x: number; y: number }) => {
    const sien = decenniesDuVoyage.map((d) => mondes(d).objets).find((objets) => objets.some((o) => o.cle === cle))
    const objet = sien?.find((o) => o.cle === cle)
    if (!sien || !objet || objetsEnMain.current.has(cle)) return
    objetsEnMain.current.add(cle)
    oublierLeRefus()
    let envol = Promise.resolve()
    if (!calme) {
      const e = ecranRef.current?.getBoundingClientRect()
      const r = sacocheRef.current?.getBoundingClientRect()
      const vers = e && r && r.width ? { x: r.left - e.left + r.width / 2, y: r.top - e.top + r.height / 2 } : { x: (e?.width || 390) - 34, y: (e?.height || 760) - 90 }
      setVols((v) => [...v, { objet, de, vers }])
      envol = attendre(DUREE_DE_L_ENVOL)
    }
    const lacher = () => {
      objetsEnMain.current.delete(cle)
      if (monte.current) setVols((v) => v.filter((x) => x.objet.cle !== cle))
    }
    // `mutateAsync` et non les rappels de `mutate` : TanStack ne garde que ceux du dernier appel, et
    // deux objets peuvent être en main ensemble.
    ramasser.mutateAsync(cle).then(
      async () => {
        await envol
        lacher()
        if (!monte.current) return
        const ranges = client.getQueryData<Voyageur>(cles.voyageur)?.objets ?? []
        oublierLeRefus()
        setMessage({ titre: `Objet trouvé ${sien.filter((o) => ranges.some((r) => r.cle === o.cle)).length} sur ${sien.length}`, texte: objet.phrase })
      },
      (erreur: unknown) => {
        lacher()
        if (!monte.current) return
        moteur?.rendreObjet(cle)
        if (erreur instanceof ApiError) setRefusDuRamassage(erreur.message)
      },
    )
  }

  return (
    <div ref={ecranRef} className={styles.ecran} style={{ ['--accent' as string]: monde.palette.accent, ...STYLE_DU_TEMPO }} onPointerDownCapture={refusDuRamassage === null ? undefined : oublierLeRefus}>
      <h1 ref={titreRef} tabIndex={-1} className="sr-only">
        Le Voyage de {user.pseudo}
      </h1>
      {/* Ce qui est derrière l'avancée (la porte, l'adieu, le tampon, la marche, le carton) : rien n'y
          répond tant qu'elle joue, ni au doigt ni au clavier. Le moteur, lui, mène toujours la caméra.
          Deux enveloppes : la toile seule répond pendant le passage d'entrée (`bonjour`), où le moteur
          ne fait d'un toucher que poser le passage à sa fin ; le reste attend la fin de l'avancée. */}
      <div className={styles.fond} {...((avancee && !bonjour) || dialogueOuvert ? INERTE : null)}>
        {etat ? (
          <CarteCanvas
            etat={etat}
            calme={calme}
            bobines={trouvees}
            objets={objetsRamasses}
            // Le levier de la halte ouverte bascule, et revient quand elle se referme : un fait d'état,
            // la halte que le dialogue courant montre, jamais celle que l'adresse porte en attendant.
            halteOuverte={halteOuverte && halteDemandee ? halteDemandee.cle : null}
            surMoteur={setMoteur}
            rappels={{
              toucherAnnee: (a) => navigate(`/voyage/${a}`),
              apercu: (annee, ancre) => setApercu({ annee, ancre }),
              finApercu: () => setApercu(null),
              ensemble: setEnsemble,
              date: setDate,
              roulotte: () => setRoulotteDite(true),
              avatarVisible: setAvatarVu,
              bobine: ramassee,
              bobineArrivee: arrivee,
              cibleBobines,
              clap: () => ambiance.clap(),
              presences: (liste, decennie) => {
                ambiance.presences(liste)
                montrerDecennie(decennie)
              },
              entreeProche: setProche,
              objet: objetTouche,
              // Le passage que le moteur joue sans le bouton (la halte au bout de la foire, le repos d'un
              // défilement dans l'entrée) : la page l'apprend ici, et aucun dialogue n'entre par-dessus.
              passage: setPassage,
              aiguillage: prendreLAiguillage,
            }}
          />
        ) : null}
      </div>
      <div className={styles.fond} {...(avancee || dialogueOuvert ? INERTE : null)}>

        <header className={styles.hud}>
          <div>
            {/* Le chapitre ouvre la page de la décennie en cours (plan 2c, décision D5). */}
            <Link to={`/voyage/decennies/${decennieDe(v.annee_en_cours)}`} className={styles.chapitre}>
              {[monde.chapitre, monde.nom].filter(Boolean).join(' · ')}
            </Link>
            <span className={styles.annee}>{v.annee_en_cours}</span>
          </div>
          <p className={styles.recompenses} aria-label={`${compte.palme} Palmes, ${compte.lion} Lions, ${compte.ours} Ours`}>
            <span>{compte.palme}</span> <span>{compte.lion}</span> <span>{compte.ours}</span>
          </p>
          {objectif ? (
            <p className={styles.objectif}>
              <span>{objectif}</span>
              {j ? <b>{`${j.vus}/${j.total}`}</b> : null}
            </p>
          ) : null}
          {v.source ? <p className={styles.source}>{`Tu suis le Voyage de ${v.source.pseudo}${rattrape ? ' · tu le rattrapes bientôt' : ''}`}</p> : null}
          {/* Le compteur des bobines perdues : discret, il n'apparaît qu'à la première (maquette : `#hudBob`). */}
          <p ref={compteurRef} key={pulsation} className={`${styles.bobines}${pulsation ? ` ${styles.pulse}` : ''}`} hidden={nBobines === 0 && enVol === null}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="8.6" fill="currentColor" />
              <circle cx="10" cy="10" r="6.8" fill="#3a2a12" />
              <g fill="currentColor">
                <circle cx="10" cy="5.9" r="1.7" />
                <circle cx="13.9" cy="8.7" r="1.7" />
                <circle cx="12.4" cy="13.3" r="1.7" />
                <circle cx="7.6" cy="13.3" r="1.7" />
                <circle cx="6.1" cy="8.7" r="1.7" />
              </g>
              <circle cx="10" cy="10" r="1.1" fill="currentColor" />
            </svg>
            <span>{`Bobines retrouvées ${nBobines}/${bobinesDuCompteur.length}`}</span>
          </p>
        </header>

        <nav className={`sr-only ${styles.annees}`} aria-label="Les années du Voyage">
          <ul>
            {etat?.cases.map((c) => (
              <li key={c.annee}>
                <Link to={`/voyage/${c.annee}`}>{`${c.annee}, ${c.attente && lent ? lent : LIBELLE[c.etat]}${horaireLu(c, anneeAvatar)}${rattrape && c.annee === v.annee_en_cours ? ', tu le rattrapes bientôt' : ''}`}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.boutons}>
          <button
            type="button"
            aria-label="Son"
            title={sonEnMarche ? 'Son : allumé' : sonVoulu ? 'Son : touche pour le reprendre' : 'Son : coupé'}
            aria-pressed={sonEnMarche}
            onClick={basculerSon}
          >
            {sonEnMarche || sonVoulu ? <IconVolume size={20} aria-hidden="true" /> : <IconVolumeOff size={20} aria-hidden="true" />}
          </button>
          {/* La sacoche du voyageur : le passeport, le portefeuille et les coulisses, sur leur page. */}
          {/* Son point rouge dit qu'il y a du neuf, et son nom pourquoi ; éteint, le nom ne change pas. */}
          <Link ref={sacocheRef} to="/voyage/sacoche" aria-label={nomDuLien} title={nomDuLien}>
            <IconBriefcase size={20} aria-hidden="true" />
            {nouveautes.length > 0 ? <span className={styles.point} aria-hidden="true" /> : null}
          </Link>
          {!avatarVu && !ensemble ? (
            <button type="button" aria-label="Tu es ici" title="Tu es ici" onClick={() => moteur?.allerIci()}>
              <IconCurrentLocation size={20} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={ensemble ? 'Revenir à la carte' : 'Vue d’ensemble'}
            title={ensemble ? 'Revenir à la carte' : 'Vue d’ensemble'}
            aria-pressed={ensemble}
            onClick={() => moteur?.basculerEnsemble(!ensemble)}
          >
            <IconMap2 size={20} aria-hidden="true" />
          </button>
        </div>

        {ticket && !avancee ? (
          <div className={styles.ticketOmbre}>
            <button type="button" className={styles.ticket} disabled={utiliser.isPending} onClick={() => encaisser(ticket.annee)}>
              <span>Utiliser le ticket</span>
              <span>{`${v.annee_en_cours} → ${ticket.annee % 10 === 0 ? 'nouveau monde' : ticket.annee}`}</span>
            </button>
          </div>
        ) : null}
        {/* Le passage au geste (maquette « Voyage immobile 1900 », `#b-action`) : offert quand le moteur
            dit l'entrée d'un monde à portée, à qui a atteint sa décennie, jamais pendant une avancée ni
            sous la vue d'ensemble (le passage s'y jouerait sans être vu). Il
            ne joue que le passage : ni porte ni adieu, qui n'appartiennent qu'à l'avancée. */}
        {proche !== null && !avancee && !ensemble && v.annee_en_cours >= proche ? (
          <div className={`${styles.trainOmbre}${ticket ? ` ${styles.auDessusDuTicket}` : ''}`}>
            <button
              type="button"
              className={styles.train}
              onClick={() => {
                if (!moteur) return
                // Le temps de ce passage, le contrôleur n'entre pas ; fini ou en échec, la page le sait.
                const fin = () => void (monte.current && setPassage(false))
                setPassage(true)
                void moteur.direBonjour(proche, 'endroit').then(fin, fin)
              }}
            >
              {`Prendre le train pour ${proche}`}
            </button>
          </div>
        ) : null}
        {utiliser.error ? (
          <p role="alert" className={styles.erreur}>
            {utiliser.error instanceof ApiError ? utiliser.error.message : 'Le ticket n’a pas pu être utilisé. Réessaie.'}
          </p>
        ) : null}

        {apercu && apercuAnnee ? (
          <Apercu annee={apercuAnnee} anneeEnCours={v.annee_en_cours} ia={v.ia} attente={etatDeCase(apercuAnnee, v.ia).attente} tropLent={lent} rattrape={rattrape} ancre={apercu.ancre} />
        ) : null}

        {date ? (
          <div className={styles.affiche} role="dialog" aria-modal="true" aria-labelledby="affiche-titre">
            <small>{date.lieu}</small>
            <strong id="affiche-titre">{date.titre}</strong>
            <span>{date.jour}</span>
            <p>{date.texte}</p>
            {date.image ? (
              <figure>
                <img src={date.image.url} alt="" decoding="async" />
                <figcaption>{date.image.legende}</figcaption>
              </figure>
            ) : null}
            <button type="button" onClick={() => setDate(null)}>
              Refermer
            </button>
          </div>
        ) : null}
        {/* Un objet ramassé vole du quai à la pastille de la sacoche : un décor, que le calme ne monte pas. */}
        {vols.map(({ objet, de, vers }) => (
          <span
            key={objet.cle}
            className={styles.vol}
            aria-hidden="true"
            style={{ ['--x0' as string]: `${de.x}px`, ['--y0' as string]: `${de.y}px`, ['--xm' as string]: `${(de.x + vers.x) / 2}px`, ['--ym' as string]: `${Math.min(de.y, vers.y) - 70}px`, ['--x1' as string]: `${vers.x}px`, ['--y1' as string]: `${vers.y}px` }}
          >
            <objet.Dessin />
          </span>
        ))}
        {refusDuRamassage !== null ? (
          <p role="status" className={styles.message}>
            {refusDuRamassage}
          </p>
        ) : message ? (
          <p role="status" className={styles.message}>
            <b>{message.titre}</b>
            {message.texte ? (
              <>
                <br />
                {message.texte}
              </>
            ) : null}
          </p>
        ) : null}
        {roulotteDite && v.source ? (
          <p role="status" className={styles.roulotte}>
            {`La roulotte de ${v.source.pseudo} : il est rendu en ${v.source.annee_en_cours}, ses salles t’attendent là-bas.`}
          </p>
        ) : null}
      </div>

      {calque?.type === 'tampon' ? (
        <div className={styles.tampon} role="status">
          <Tampon monde={mondes(calque.decennie)} decennie={calque.decennie} tampon={tamponDe(v.tampons, calque.decennie)} frappe />
        </div>
      ) : null}
      {fete ? (
        <Celebrations
          monde={mondes(decennieDe(fete.annee))}
          membre={user.id}
          scenes={[fete]}
          // Le ticket ne s'utilise que s'il ouvre l'année qui suit mon année en cours (`ticketOffert`).
          onUtiliser={fete.ticket === v.annee_en_cours + 1 ? encaisser : undefined}
          onFin={() => setFete(null)}
        />
      ) : null}
      {/* Le contrôleur des billets, par-dessus la carte, que son dialogue rend inerte. */}
      {portiereOuverte && controle && DessinDuControleur ? <Controleur monde={monde} Dessin={DessinDuControleur} billet={controle} depart={v.depart} onFermer={fermerLaPortiere} /> : null}
      {/* Une halte ouverte, par-dessus la carte inerte : le dessin du monde de sa décennie. */}
      {halteOuverte && halteDemandee && DessinDeLaHalte ? <Halte monde={mondes(decennieDe(halteDemandee.apres))} Dessin={DessinDeLaHalte} halte={halteDemandee} onFermer={calqueDeLaHalte.fermer} /> : null}
      {/* Un monde à passage n'a pas de carton : ses lignes sont dites, hors de vue. */}
      {annonce !== null ? (
        <p role="status" className="sr-only">
          {[mondes(annonce).chapitre, mondes(annonce).nom, mondes(annonce).sous].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      {calque?.type === 'carton' ? (
        <div className={styles.carton} role="status">
          <p>{mondes(Math.floor(calque.annee / 10) * 10).chapitre}</p>
          <p className="celebration">{mondes(Math.floor(calque.annee / 10) * 10).nom}</p>
          <p>{mondes(Math.floor(calque.annee / 10) * 10).sous}</p>
        </div>
      ) : null}
    </div>
  )
}
