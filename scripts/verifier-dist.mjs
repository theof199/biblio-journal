// Ce que le build doit être pour servir sous /journal/ et s'installer.
// Lancé après `npm run build`, en CI ici et dans `livrer.yml` (biblio-back).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const lire = (f) => readFileSync(join(dist, f), 'utf8')
const echecs = []
const exiger = (vrai, libelle) => {
  if (!vrai) echecs.push(libelle)
}

// 1. Le manifeste.
const m = JSON.parse(lire('manifest.webmanifest'))
exiger(m.scope === '/journal/', 'manifeste : scope /journal/')
exiger(m.start_url === '/journal/', 'manifeste : start_url /journal/')
exiger(m.display === 'standalone', 'manifeste : display standalone')
exiger(m.orientation === 'portrait', 'manifeste : orientation portrait')
exiger(m.lang === 'fr', 'manifeste : lang fr')
const icones = (m.icons ?? []).map((i) => `${i.sizes}${i.purpose ? ` ${i.purpose}` : ''}`)
for (const i of ['192x192', '512x512', '512x512 maskable']) exiger(icones.includes(i), `manifeste : icône ${i}`)

// 2. index.html : tout chemin absolu reste sous /journal/.
const html = lire('index.html')
const chemins = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((r) => r[1])
exiger(chemins.length > 0, 'index.html : aucun chemin absolu trouvé')
for (const c of chemins) exiger(c.startsWith('/journal/'), `index.html : ${c} hors de /journal/`)
exiger(html.includes('rel="apple-touch-icon"'), 'index.html : apple-touch-icon')
exiger(html.includes('rel="manifest"'), 'index.html : manifeste lié')

// 3. Le service worker : l'enveloppe, et une seule route, celle de la navigation.
const sw = lire('sw.js')
exiger(sw.includes('createHandlerBoundToURL("index.html")'), 'sw.js : repli de navigation sur index.html')
exiger((sw.match(/registerRoute\(/g) ?? []).length === 1, 'sw.js : une route de plus que la navigation')
const precache = [...sw.matchAll(/url:"([^"]+)"/g)].map((r) => r[1])
exiger(precache.includes('index.html'), 'sw.js : index.html hors du précache')
exiger(precache.some((u) => u.endsWith('.woff2')), 'sw.js : polices hors du précache')

// 4. Aucun outil de dev dans le livrable.
const fichiers = (d) =>
  readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? fichiers(join(d, n)) : [join(d, n)]))
for (const f of fichiers(dist).filter((f) => /\.(js|html)$/.test(f)))
  exiger(!readFileSync(f, 'utf8').includes('dev-login'), `${f} : dev-login dans le livrable`)

if (echecs.length) {
  console.error(echecs.map((e) => `ECHEC ${e}`).join('\n'))
  process.exit(1)
}
console.log('dist conforme')
