import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// `globals` reste à false — on importe `describe`/`it`/`expect` explicitement,
// comme tout le reste du projet. Le nettoyage automatique de Testing Library
// dépend d'un `afterEach` global : sans lui, le DOM d'un test fuiterait dans le
// suivant et `getByRole` trouverait deux fois la même chose.
afterEach(cleanup)

// Le stockage de session vit autant que le fichier de tests : la première entrée d'un
// `MemoryRouter` porte toujours la clé `default`, et le guichet retenu sous elle par un test
// (`voyage/recherche/memoire.ts`) se rouvrirait dans le suivant.
afterEach(() => window.sessionStorage.clear())

// jsdom n'a pas de canvas : `getContext` y rend `null` en écrivant « Not implemented » dans la
// console. Le moteur de la carte le sait et reste inerte ; on lui épargne le bruit.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
