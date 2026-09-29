/**
 * Un ZIP fabriqué à la main pour les tests (l'app ne fait que le lire) : des entrées stockées ou
 * déflatées, un répertoire central, sa fin. Le CRC reste à zéro : la lecture ne le vérifie pas.
 */
export interface EntreeZip {
  nom: string
  contenu: string
  /** `deflate` compresse pour de vrai, comme un export Letterboxd. */
  methode?: 'stocke' | 'deflate'
}

async function deflater(donnees: Uint8Array): Promise<Uint8Array> {
  const flux = new Response(donnees as BodyInit).body!.pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(flux).arrayBuffer())
}

export async function fabriquerZip(entrees: EntreeZip[]): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const morceaux: Uint8Array[] = []
  const centrale: Uint8Array[] = []
  let decalage = 0

  for (const e of entrees) {
    const brut = enc.encode(e.contenu)
    const deflate = e.methode === 'deflate'
    const donnees = deflate ? await deflater(brut) : brut
    const nom = enc.encode(e.nom)

    const locale = new Uint8Array(30 + nom.length)
    const lv = new DataView(locale.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(8, deflate ? 8 : 0, true)
    lv.setUint32(18, donnees.length, true)
    lv.setUint32(22, brut.length, true)
    lv.setUint16(26, nom.length, true)
    locale.set(nom, 30)

    const c = new Uint8Array(46 + nom.length)
    const cv = new DataView(c.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(10, deflate ? 8 : 0, true)
    cv.setUint32(20, donnees.length, true)
    cv.setUint32(24, brut.length, true)
    cv.setUint16(28, nom.length, true)
    cv.setUint32(42, decalage, true)
    c.set(nom, 46)

    morceaux.push(locale, donnees)
    centrale.push(c)
    decalage += locale.length + donnees.length
  }

  const tailleCentrale = centrale.reduce((n, c) => n + c.length, 0)
  const fin = new Uint8Array(22)
  const fv = new DataView(fin.buffer)
  fv.setUint32(0, 0x06054b50, true)
  fv.setUint16(8, entrees.length, true)
  fv.setUint16(10, entrees.length, true)
  fv.setUint32(12, tailleCentrale, true)
  fv.setUint32(16, decalage, true)

  const tout = [...morceaux, ...centrale, fin]
  const zip = new Uint8Array(tout.reduce((n, m) => n + m.length, 0))
  let p = 0
  for (const m of tout) {
    zip.set(m, p)
    p += m.length
  }
  return zip
}
