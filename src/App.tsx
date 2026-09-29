import { Navigate, Route, Routes } from 'react-router-dom'
import RouteProtegee from './session/RouteProtegee'
import Coque from './coque/Coque'
import Connexion from './pages/Connexion'
import Accueil from './pages/Accueil'
import Voyage from './pages/Voyage'
import Suivis from './pages/Suivis'
import AuCine from './pages/AuCine'
import Profil from './pages/Profil'

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route element={<RouteProtegee />}>
        {/* Les onglets : leurs chemins sont ceux de `ONGLETS` (`coque/Coque.tsx`). */}
        <Route element={<Coque />}>
          <Route index element={<Accueil />} />
          <Route path="voyage" element={<Voyage />} />
          <Route path="suivis" element={<Suivis />} />
          <Route path="au-cine" element={<AuCine />} />
          <Route path="profil" element={<Profil />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
