import { Navigate, Route, Routes } from 'react-router-dom'
import RouteProtegee from './session/RouteProtegee'
import Coque from './coque/Coque'
import Connexion from './pages/Connexion'
import Accueil from './pages/Accueil'
import Recherche from './pages/Recherche'
import Formulaire from './pages/Formulaire'
import Fiche from './pages/Fiche'
import PapierRendu from './pages/PapierRendu'
import MesFilms from './pages/MesFilms'
import Suivis from './pages/Suivis'
import PageRealisateur from './pages/PageRealisateur'
import PageSaga from './pages/PageSaga'
import FicheFilm from './pages/FicheFilm'
import AuCine from './pages/AuCine'
import Profil from './pages/Profil'
import Caisse from './pages/Caisse'
import ImportLetterboxd from './pages/ImportLetterboxd'
import AppariementSensCritique from './pages/AppariementSensCritique'
import { paresseux } from './pwa/morceau'
import { FournisseurPosition } from './cinema/FournisseurPosition'

// Le Voyage (moteur de la carte, mondes, pages) pèse plus de 40 % du code de l'app : il ne se charge
// qu'à la première visite d'une de ses pages (`test/decoupage.test.ts` garde qu'aucun import n'y est statique).
const Carte = paresseux(() => import('./pages/Carte'))
const VoyageAnnee = paresseux(() => import('./pages/VoyageAnnee'))
const VoyageDecennie = paresseux(() => import('./pages/VoyageDecennie'))
const VoyageBoite = paresseux(() => import('./pages/VoyageBoite'))
const VoyageRecherche = paresseux(() => import('./pages/VoyageRecherche'))
const VoyageFilm = paresseux(() => import('./pages/VoyageFilm'))
const VoyageBillet = paresseux(() => import('./pages/VoyageBillet'))
const VoyageSacoche = paresseux(() => import('./pages/VoyageSacoche'))
const VoyageWagonRestaurant = paresseux(() => import('./pages/VoyageWagonRestaurant'))

export default function App() {
  return (
    <FournisseurPosition>
      <Routes>
        <Route path="/connexion" element={<Connexion />} />
        <Route element={<RouteProtegee />}>
          {/* Les onglets : leurs chemins sont ceux de `ONGLETS` (`coque/Coque.tsx`). */}
          <Route element={<Coque />}>
            <Route index element={<Accueil />} />
            {/* Sans onglet à elles : la barre reste visible (toujours sous `<Coque />`), le retour
                de chaque page en tient lieu (`ui/BoutonRetour.tsx`). */}
            <Route path="recherche" element={<Recherche />} />
            <Route path="journal/nouveau" element={<Formulaire />} />
            <Route path="journal/:id" element={<Fiche />} />
            <Route path="journal/:id/corriger" element={<Formulaire />} />
            {/* Après une création : la critique imprimée, puis « En bref ». Elle vit de l'état de navigation du formulaire. */}
            <Route path="journal/:id/papier" element={<PapierRendu />} />
            <Route path="voyage" element={<Carte />} />
            {/* La sacoche du voyageur (passeport, portefeuille, coulisses) : on y entre par une pastille
                de la carte. Un segment fixe : React Router le préfère à `voyage/:annee`, et un test le garde. */}
            <Route path="voyage/sacoche" element={<VoyageSacoche />} />
            {/* Le wagon-restaurant (mes tables) : un segment fixe lui aussi, gardé par un test. */}
            <Route path="voyage/wagon-restaurant" element={<VoyageWagonRestaurant />} />
            <Route path="voyage/:annee" element={<VoyageAnnee />} />
            {/* La page d'une décennie (plan 2c, décision D5) : on y entre par la plaque du chapitre. */}
            <Route path="voyage/decennies/:decennie" element={<VoyageDecennie />} />
            {/* La boîte à billets d'une décennie (idée 5) : on y entre par la page de la décennie. */}
            <Route path="voyage/decennies/:decennie/billets" element={<VoyageBoite />} />
            {/* Le guichet d'une décennie (décision D7) : on y entre par la page de la décennie. */}
            <Route path="voyage/decennies/:decennie/recherche" element={<VoyageRecherche />} />
            {/* La fiche d'un film du Voyage (décision D5) : l'onglet Voyage reste marqué, d'où qu'on vienne. */}
            <Route path="voyage/:annee/films/:filmId" element={<VoyageFilm />} />
            {/* Le billet de séance : un visionnage à enregistrer (`?bobine=` pour une bobine), ou à corriger (`state.item`). */}
            <Route path="voyage/:annee/films/:filmId/billet" element={<VoyageBillet />} />
            <Route path="voyage/:annee/films/:filmId/billet/corriger" element={<VoyageBillet correction />} />
            <Route path="suivis" element={<Suivis />} />
            <Route path="suivis/realisateurs/:tmdbId" element={<PageRealisateur />} />
            <Route path="suivis/sagas/:tmdbId" element={<PageSaga />} />
            <Route path="suivis/films/:tmdbId" element={<FicheFilm />} />
            <Route path="au-cine" element={<AuCine />} />
            {/* La fiche d'un film ouverte depuis une séance ou une tuile : l'onglet Au ciné reste marqué. */}
            <Route path="au-cine/films/:tmdbId" element={<FicheFilm />} />
            <Route path="profil" element={<Profil />} />
            {/* Sous-page du profil (README, « La coque à onglets ») : l'onglet Profil reste marqué,
                comme sur l'appli Android où « Mes films » ne se pousse que depuis lui. */}
            <Route path="profil/mes-films" element={<MesFilms />} />
            <Route path="profil/reglages" element={<Caisse />} />
            <Route path="profil/import-letterboxd" element={<ImportLetterboxd />} />
            <Route path="profil/senscritique" element={<AppariementSensCritique />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </FournisseurPosition>
  )
}
