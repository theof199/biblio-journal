/**
 * Les dix objets trouvés des années 1900 (maquette, `OBJETS`, l. 3907-3918 ; plan des écrans des lots,
 * brief 3) : un objet d'époque oublié par gare, **par `cle` du contrat**. Le serveur ne sert que ceux
 * que j'ai ramassés (`GET /me/voyage/voyageur`) : les places vides se déduisent d'ici, et une clé qu'il
 * servirait sans qu'elle soit ici s'ignore. Sans rendu ni lecture.
 *
 * **Un seul dessin par objet**, dans une vue de 40 sur 40 centrée sur zéro : une suite de tracés, que
 * la sacoche pose en SVG (`pages/ObjetsDeLaSacoche.tsx`) et que le quai pourra poser sur une toile
 * (`new Path2D(d)`), sans le redessiner. Ses couleurs sont sa donnée, comme celles d'un badge de la
 * malle : elles ne passent pas par un jeton, et aucune feuille ne les porte.
 */

/** Un tracé du dessin : son chemin, son fond, son trait. Sans fond, il n'est pas rempli. */
export type TraitDObjet = {
  d: string
  fond?: string
  trait?: string
  /** L'épaisseur du trait ; un trait sans épaisseur en a une de 1. */
  epais?: number
  /** Les bouts du trait sont ronds. */
  rond?: boolean
  /** Un trait en tirets (la chaîne de la montre) : pleins et vides. */
  tirets?: readonly [number, number]
}

export type ObjetTrouve = {
  /** La clé du contrat : celle que le serveur sert et que la carte enverra pour ramasser. */
  cle: string
  /** L'année de la gare où il a été oublié : la même qu'au catalogue du serveur. */
  annee: number
  /** Son nom, avec son article : « une lanterne de chef de gare ». Jamais dit d'une place vide. */
  nom: string
  /** Son nom court, écrit sous lui. */
  court: string
  /** L'angle dont tout le dessin tourne, en degrés ; rien pour un objet posé droit. */
  tourne?: number
  traits: readonly TraitDObjet[]
}

const rect = (x: number, y: number, l: number, h: number, r = 0): string =>
  r === 0
    ? `M${x} ${y}h${l}v${h}h${-l}Z`
    : `M${x + r} ${y}h${l - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(l - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`
const cercle = (cx: number, cy: number, r: number): string => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`

const NOIR = '#221910'
const LAITON = '#c9a257'
const LAITON_SOMBRE = '#6e5222'
const ROUGE = '#a8352a'
const CUIR = '#6b4324'
const CUIR_SOMBRE = '#2a1508'

/** Dans l'ordre des années : une gare, un objet. */
export const OBJETS: readonly ObjetTrouve[] = [
  {
    cle: 'lanterne',
    annee: 1900,
    nom: 'une lanterne de chef de gare',
    court: 'Lanterne',
    traits: [
      { d: 'M-7 -6 h14 l2 16 h-18 Z', fond: '#f0d27a', trait: NOIR, epais: 1.6 },
      { d: rect(-9, 10, 18, 4), fond: NOIR },
      { d: 'M-8 -6 L0 -13 L8 -6 Z', fond: NOIR },
      { d: 'M-5 -13 C-5 -20 5 -20 5 -13', trait: NOIR, epais: 1.6 },
      { d: 'M0 -5 V9 M-7.6 2 H7.6', trait: NOIR },
      { d: cercle(0, 3, 2.6), fond: ROUGE },
    ],
  },
  {
    cle: 'melon',
    annee: 1901,
    nom: 'un chapeau melon',
    court: 'Chapeau melon',
    traits: [
      { d: 'M-10 4 C-10 -12 10 -12 10 4 Z', fond: NOIR },
      { d: rect(-10, 1, 20, 3.4), fond: '#5a3a1c' },
      { d: 'M-17 5 C-10 9 10 9 17 5 C14 3 -14 3 -17 5 Z', fond: NOIR },
      { d: 'M-6 -5 C-4 -9 2 -9 4 -8', trait: '#8a8073', epais: 1.2, rond: true },
    ],
  },
  {
    cle: 'parapluie',
    annee: 1902,
    nom: 'un parapluie',
    court: 'Parapluie',
    tourne: 28,
    traits: [
      { d: 'M0 -17 L4.5 8 H-4.5 Z', fond: '#1d3767' },
      { d: 'M0 -17 L1.5 8 M0 -17 L-1.5 8', trait: '#0f1f3d', epais: 0.8 },
      { d: rect(-0.9, -19, 1.8, 3), fond: NOIR },
      { d: 'M0 8 V14 C0 18 6 18 6 14', trait: CUIR, epais: 2.2, rond: true },
      { d: rect(-3, 3, 6, 2), fond: LAITON },
    ],
  },
  {
    cle: 'montre',
    annee: 1903,
    nom: 'une montre de gousset',
    court: 'Montre',
    traits: [
      { d: cercle(0, 3, 11), fond: LAITON, trait: LAITON_SOMBRE, epais: 1.4 },
      { d: cercle(0, 3, 8.4), fond: '#f4efe2' },
      { d: 'M0 3 V-3 M0 3 L4 5', trait: NOIR, epais: 1.4, rond: true },
      { d: rect(-2, -12, 4, 4), fond: LAITON, trait: LAITON_SOMBRE },
      { d: cercle(0, -15, 3), trait: LAITON_SOMBRE, epais: 1.5 },
      { d: 'M3 -15 C10 -16 14 -12 17 -6', trait: LAITON, epais: 1.3, tirets: [1.6, 1.4] },
    ],
  },
  {
    cle: 'programme',
    annee: 1904,
    nom: 'un programme de séance',
    court: 'Programme',
    tourne: -8,
    traits: [
      { d: rect(-10, -14, 20, 28), fond: '#efe6d0', trait: NOIR, epais: 1.2 },
      { d: rect(-10, -14, 20, 7), fond: ROUGE },
      { d: 'M-6 -3 H6 M-6 1 H6 M-6 5 H3', trait: NOIR, epais: 1.1 },
      { d: 'M0 7.5 l1 2.2 2.4 .2 -1.8 1.6 .6 2.3 -2.2 -1.3 -2.2 1.3 .6 -2.3 -1.8 -1.6 2.4 -.2 Z', fond: LAITON },
    ],
  },
  {
    cle: 'facteur',
    annee: 1905,
    nom: 'une sacoche de facteur',
    court: 'Sacoche de facteur',
    traits: [
      { d: 'M-11 -4 C-11 -18 11 -18 11 -4', trait: '#4a2812', epais: 2 },
      { d: rect(-13, -5, 26, 19, 2.5), fond: CUIR, trait: CUIR_SOMBRE, epais: 1.3 },
      { d: 'M-13 -5 H13 V3 C7 8 -7 8 -13 3 Z', fond: '#8a5a34', trait: CUIR_SOMBRE, epais: 1.3 },
      { d: rect(-2.4, 3, 4.8, 5, 1), fond: LAITON, trait: LAITON_SOMBRE },
    ],
  },
  {
    cle: 'longuevue',
    annee: 1906,
    nom: 'une longue-vue',
    court: 'Longue-vue',
    tourne: -24,
    traits: [
      { d: rect(-17, -4.5, 13, 9), fond: CUIR, trait: CUIR_SOMBRE },
      { d: rect(-4, -3.5, 11, 7), fond: LAITON, trait: LAITON_SOMBRE },
      { d: rect(7, -2.6, 9, 5.2), fond: '#e2c27a', trait: LAITON_SOMBRE },
      { d: rect(-18.5, -5.5, 2.5, 11), fond: LAITON, trait: LAITON_SOMBRE },
      { d: rect(15.5, -3.4, 2, 6.8), fond: NOIR },
    ],
  },
  {
    cle: 'eventail',
    annee: 1907,
    nom: 'un éventail',
    court: 'Éventail',
    traits: [
      { d: 'M0 12 L-16 -6 A22 22 0 0 1 16 -6 Z', fond: ROUGE, trait: NOIR, epais: 1.2 },
      { d: 'M0 12 L-9 -11.6 M0 12 L0 -14 M0 12 L9 -11.6', trait: NOIR, epais: 0.9 },
      { d: 'M-12.5 -2.2 A17 17 0 0 1 12.5 -2.2', trait: '#f0d27a', epais: 1.6 },
      { d: cercle(0, 12, 2), fond: LAITON, trait: NOIR },
    ],
  },
  {
    cle: 'sifflet',
    annee: 1908,
    nom: 'un sifflet de chef de train',
    court: 'Sifflet',
    traits: [
      { d: 'M-14 -4 H4 A8 8 0 1 1 -4 4 H-14 Z', fond: LAITON, trait: LAITON_SOMBRE, epais: 1.4 },
      { d: rect(-10, -4, 5, 3), fond: NOIR },
      { d: cercle(4, 4, 2.2), fond: LAITON_SOMBRE },
      { d: 'M12 6 C16 10 12 15 16 17', trait: ROUGE, epais: 1.4 },
    ],
  },
  {
    cle: 'valise',
    annee: 1909,
    nom: 'une valise',
    court: 'Valise',
    traits: [
      { d: 'M-6 -8 V-12 C-6 -15 6 -15 6 -12 V-8', trait: CUIR_SOMBRE, epais: 2 },
      { d: rect(-15, -8, 30, 21, 2), fond: '#7a4a26', trait: CUIR_SOMBRE, epais: 1.3 },
      { d: 'M-8 -8 V13 M8 -8 V13', trait: CUIR_SOMBRE, epais: 2.4 },
      { d: rect(-2.5, -1, 5, 4), fond: LAITON, trait: LAITON_SOMBRE },
      { d: cercle(-12, -5, 1), fond: LAITON },
      { d: cercle(12, -5, 1), fond: LAITON },
    ],
  },
]
