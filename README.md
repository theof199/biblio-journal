# Journal — le web app de la médiathèque

Le journal des films du propriétaire, en application web installable, servie sous
`https://mini-mediatheque.fr/journal/` par-dessus l'API de `../biblio-back`. Conception dans
`../biblio-back/docs/superpowers/specs/2026-09-28-journal-web-design.md`, apparence héritée de
`../biblio-android/docs/design.md`.

## Démarrer

    npm ci
    npm run dev

`http://localhost:5174/journal/`, par-dessus l'instance locale de l'API (`http://localhost:3000`),
lancée dans `../biblio-back` par `bin/dev`. Une autre cible se fixe par `VITE_API_TARGET`, en
variable de shell ou dans un `.env.local` : `vite.config.ts` la lit par `loadEnv`, et son proxy
relaie `/api` (préfixe retiré) et `/covers` vers elle, pour que le cookie de session reparte sur la
même origine (`SameSite=Lax`). L'instance en ligne se vise **avec** son `/api`
(`VITE_API_TARGET=https://mini-mediatheque.fr/api`) : le proxy retire le préfixe, la cible le
remet. L'origine nue enverrait `/api/auth/me` sur `/auth/me`, que le nginx du front sert par son
`index.html` : l'app répondrait `MALFORMED` partout.

## Commandes

    npm run dev            # serveur de développement
    npm run build           # tsc --noEmit puis vite build, dans dist/
    npm run preview          # sert dist/ localement, port 5174
    npm run lint             # eslint, zéro avertissement toléré
    npm test                 # vitest, une fois
    npm run types:check      # le contrat régénère-t-il les mêmes types ?

## Le contrat

`contract/openapi.json` est une copie de `../biblio-back/docs/openapi.json`, et `src/api/types.ts`
en est engendré par `openapi-typescript` : ni l'un ni l'autre ne se modifie à la main.

    npm run contract:pull   # recopie le contrat depuis ../biblio-back (BACK_REPO pour un autre chemin), puis régénère les types
    npm run types            # régénère seulement les types, si le contrat a déjà bougé

La CI (`npm run types:check`) refuse une dérive entre les deux, et `livrer.yml` (dans
`biblio-back`) refuse un tag si `contract/openapi.json` n'est pas identique au contrat commité du
back : la copie se refait à la main après chaque tag.
