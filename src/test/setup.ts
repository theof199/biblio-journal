import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// `globals` reste à false — on importe `describe`/`it`/`expect` explicitement,
// comme tout le reste du projet. Le nettoyage automatique de Testing Library
// dépend d'un `afterEach` global : sans lui, le DOM d'un test fuiterait dans le
// suivant et `getByRole` trouverait deux fois la même chose.
afterEach(cleanup)
