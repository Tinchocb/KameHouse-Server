/**
 * synopsis-tagger.ts
 * Motor semántico y heurístico de tags temáticos, personajes, técnicas y lore
 * para episodios de Dragon Ball y series de animación.
 */

export type TagCategory =
  | "transformation"
  | "technique"
  | "fusion"
  | "villain"
  | "protagonist"
  | "artifact"
  | "location"
  | "narrative"
  | "tournament"

export interface EpisodeTag {
  id: string
  label: string
  category: TagCategory
  priority: number // 1 a 100 (mayor prioridad = aparece primero)
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[«»“”"'¡!¿?]/g, "")
    .replace(/<<|>>/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

interface RawTagRule {
  id: string
  label: string
  category: TagCategory
  priority: number
  patterns: RegExp[]
}

/**
 * Catálogo Maestro de Reglas con Expresiones Regulares precompiladas.
 * Más de 160 tags hiper-especializados que cubren toda la franquicia Dragon Ball y anime.
 */
const TAG_RULES: RawTagRule[] = [
  // ── 1. TRANSFORMACIONES & ESTADOS DE PODER (transformation - Prioridad 90-100) ────
  {
    id: "trans-ultra-instinct",
    label: "Ultra Instinto",
    category: "transformation",
    priority: 100,
    patterns: [/\bultra instinto\b/i, /\bdoctrina egoista\b/i, /\bmigatte no gokui\b/i],
  },
  {
    id: "trans-mega-instinct",
    label: "Mega Instinto",
    category: "transformation",
    priority: 100,
    patterns: [/\bmega instinto\b/i, /\bultra ego\b/i, /\bwagahamama no gokui\b/i],
  },
  {
    id: "trans-beast",
    label: "Gohan Bestia",
    category: "transformation",
    priority: 98,
    patterns: [/\bgohan bestia\b/i, /\bgohan beast\b/i],
  },
  {
    id: "trans-orange-piccolo",
    label: "Piccolo Naranja",
    category: "transformation",
    priority: 97,
    patterns: [/\bpiccolo naranja\b/i, /\borange piccolo\b/i],
  },
  {
    id: "trans-ssj4",
    label: "Super Saiyajin 4",
    category: "transformation",
    priority: 96,
    patterns: [/\bsuper saiyajin 4\b/i, /\bssj4\b/i, /\bsuper saiyan 4\b/i, /\bfase 4\b/i],
  },
  {
    id: "trans-ssj-blue",
    label: "Super Saiyajin Blue",
    category: "transformation",
    priority: 95,
    patterns: [/\bsuper saiyajin blue\b/i, /\bssj blue\b/i, /\bssgss\b/i, /\bsuper saiyajin azul\b/i],
  },
  {
    id: "trans-ssj-god",
    label: "Super Saiyajin Dios",
    category: "transformation",
    priority: 94,
    patterns: [/\bsuper saiyajin dios\b/i, /\bssj dios\b/i, /\bssj god\b/i, /\bfase dios\b/i, /\bdios super saiyajin\b/i],
  },
  {
    id: "trans-ssj-rose",
    label: "Super Saiyajin Rose",
    category: "transformation",
    priority: 94,
    patterns: [/\bsuper saiyajin rose\b/i, /\bssj rose\b/i],
  },
  {
    id: "trans-ssj3",
    label: "Super Saiyajin 3",
    category: "transformation",
    priority: 93,
    patterns: [/\bsuper saiyajin 3\b/i, /\bssj3\b/i, /\bsuper saiyan 3\b/i, /\bfase 3\b/i],
  },
  {
    id: "trans-ssj2",
    label: "Super Saiyajin 2",
    category: "transformation",
    priority: 92,
    patterns: [/\bsuper saiyajin 2\b/i, /\bssj2\b/i, /\bsuper saiyan 2\b/i, /\bfase 2\b/i],
  },
  {
    id: "trans-legendary-ssj",
    label: "Super Saiyajin Legendario",
    category: "transformation",
    priority: 92,
    patterns: [/\bsuper saiyajin legendario\b/i, /\blegendario super saiyajin\b/i, /\bssj legendario\b/i, /\bberserk\b/i],
  },
  {
    id: "trans-ssj",
    label: "Super Saiyajin",
    category: "transformation",
    priority: 90,
    patterns: [/\bsuper saiyajin\b/i, /\bssj\b/i, /\bsuper saiyan\b/i, /\bguerrero dorado\b/i],
  },
  {
    id: "trans-ultimate-gohan",
    label: "Gohan Definitivo",
    category: "transformation",
    priority: 91,
    patterns: [/\bgohan definitivo\b/i, /\bgohan mistico\b/i, /\bultimate gohan\b/i, /\bpoder desbloqueado\b/i],
  },
  {
    id: "trans-kaioken",
    label: "Kaioken",
    category: "transformation",
    priority: 89,
    patterns: [/\bkaioken\b/i, /\bkaio-ken\b/i, /\btecnica de kaio\b/i],
  },
  {
    id: "trans-golden-frieza",
    label: "Golden Freezer",
    category: "transformation",
    priority: 89,
    patterns: [/\bgolden freezer\b/i, /\bfreezer dorado\b/i, /\bforma dorada\b/i],
  },
  {
    id: "trans-black-frieza",
    label: "Black Freezer",
    category: "transformation",
    priority: 89,
    patterns: [/\bblack freezer\b/i, /\bfreezer negro\b/i],
  },
  {
    id: "trans-ozaru",
    label: "Ozaru",
    category: "transformation",
    priority: 88,
    patterns: [/\bozaru\b/i, /\bmono gigante\b/i, /\bgran mono\b/i, /\bozaru dorado\b/i],
  },
  {
    id: "trans-cell-perfect",
    label: "Forma Perfecta",
    category: "transformation",
    priority: 88,
    patterns: [/\bforma perfecta\b/i, /\bcuerpo perfecto\b/i, /\bsuper perfecto\b/i, /\bcell perfecto\b/i],
  },
  {
    id: "trans-super-namekian",
    label: "Super Namekiano",
    category: "transformation",
    priority: 86,
    patterns: [/\bsuper namekiano\b/i, /\bsuper namek\b/i],
  },
  {
    id: "trans-giant-form",
    label: "Forma Gigante",
    category: "transformation",
    priority: 84,
    patterns: [/\bforma gigante\b/i, /\bgigantificacion\b/i, /\bcuerpo gigante\b/i],
  },

  // ── 2. FUSIONES & UNIONES (fusion - Prioridad 85-95) ─────────────────────────
  {
    id: "fusion-vegetto",
    label: "Vegetto",
    category: "fusion",
    priority: 95,
    patterns: [/\bvegetto\b/i, /\bvegito\b/i, /\bvegerot\b/i],
  },
  {
    id: "fusion-gogeta",
    label: "Gogeta",
    category: "fusion",
    priority: 95,
    patterns: [/\bgogeta\b/i],
  },
  {
    id: "fusion-gotenks",
    label: "Gotenks",
    category: "fusion",
    priority: 93,
    patterns: [/\bgotenks\b/i],
  },
  {
    id: "fusion-kefla",
    label: "Kefla",
    category: "fusion",
    priority: 91,
    patterns: [/\bkefla\b/i, /\bkafla\b/i],
  },
  {
    id: "fusion-zamasu",
    label: "Fusión Zamasu",
    category: "fusion",
    priority: 92,
    patterns: [/\bfusion zamasu\b/i, /\bzamasu fusionado\b/i, /\bzamasu supremo\b/i],
  },
  {
    id: "fusion-super-17",
    label: "Super 17",
    category: "fusion",
    priority: 89,
    patterns: [/\bsuper 17\b/i, /\bsuper androide 17\b/i],
  },
  {
    id: "fusion-pothala",
    label: "Pendientes Pothala",
    category: "fusion",
    priority: 88,
    patterns: [/\bpothala\b/i, /\bpotara\b/i, /\bpendientes potara\b/i, /\baros pothala\b/i],
  },
  {
    id: "fusion-dance",
    label: "Danza de la Fusión",
    category: "fusion",
    priority: 88,
    patterns: [/\bdanza de la fusion\b/i, /\bdanza metamoru\b/i, /\bfusion metamorana\b/i],
  },
  {
    id: "fusion-namek",
    label: "Fusión Namekiana",
    category: "fusion",
    priority: 85,
    patterns: [/\bfusion namek\b/i, /\bunirse con kami\b/i, /\basimilacion namek\b/i, /\bfusion con nail\b/i],
  },
  {
    id: "fusion-absorption",
    label: "Absorción",
    category: "fusion",
    priority: 84,
    patterns: [/\babsorcion\b/i, /\babsorbe a\b/i, /\babsorbido por\b/i],
  },

  // ── 3. TÉCNICAS & ATAQUES KI (technique - Prioridad 75-88) ───────────────────
  {
    id: "tech-kamehameha",
    label: "Kamehameha",
    category: "technique",
    priority: 88,
    patterns: [/\bkamehameha\b/i, /\bkame hame ha\b/i, /\bkame-hame-ha\b/i],
  },
  {
    id: "tech-genkidama",
    label: "Genkidama",
    category: "technique",
    priority: 88,
    patterns: [/\bgenkidama\b/i, /\bgenki-dama\b/i, /\bbomba de energia\b/i, /\benergia universal\b/i],
  },
  {
    id: "tech-final-flash",
    label: "Final Flash",
    category: "technique",
    priority: 86,
    patterns: [/\bfinal flash\b/i, /\bdestello final\b/i],
  },
  {
    id: "tech-big-bang",
    label: "Big Bang Attack",
    category: "technique",
    priority: 84,
    patterns: [/\bbig bang attack\b/i, /\bataque big bang\b/i],
  },
  {
    id: "tech-makankosappo",
    label: "Makankosappo",
    category: "technique",
    priority: 85,
    patterns: [/\bmakankosappo\b/i, /\bcanon de haz especial\b/i, /\bcanon especial\b/i],
  },
  {
    id: "tech-kienzan",
    label: "Kienzan",
    category: "technique",
    priority: 83,
    patterns: [/\bkienzan\b/i, /\bdisco destructor\b/i, /\bdestructo disc\b/i],
  },
  {
    id: "tech-masenko",
    label: "Masenko",
    category: "technique",
    priority: 82,
    patterns: [/\bmasenko\b/i, /\brayo magico de gohan\b/i],
  },
  {
    id: "tech-galick-gun",
    label: "Galick Gun",
    category: "technique",
    priority: 83,
    patterns: [/\bgalick gun\b/i, /\bcanon garlick\b/i, /\bgarlick ho\b/i],
  },
  {
    id: "tech-kikoho",
    label: "Kikoho",
    category: "technique",
    priority: 83,
    patterns: [/\bkikoho\b/i, /\btri-beam\b/i, /\bshin kikoho\b/i, /\bcanon tri-haz\b/i],
  },
  {
    id: "tech-teleport",
    label: "Teletransportación",
    category: "technique",
    priority: 85,
    patterns: [/\bteletransportacion\b/i, /\bshunkan ido\b/i, /\bmovimiento instantaneo\b/i],
  },
  {
    id: "tech-mafuba",
    label: "Mafuba",
    category: "technique",
    priority: 86,
    patterns: [/\bmafuba\b/i, /\bola de contencion\b/i, /\bsello magico\b/i],
  },
  {
    id: "tech-taiyoken",
    label: "Taiyoken",
    category: "technique",
    priority: 81,
    patterns: [/\btaiyoken\b/i, /\bgolpe solar\b/i, /\bbengala solar\b/i],
  },
  {
    id: "tech-hakai",
    label: "Hakai",
    category: "technique",
    priority: 87,
    patterns: [/\bhakai\b/i, /\benergia de destruccion\b/i, /\bpoder destructor\b/i],
  },
  {
    id: "tech-dragon-fist",
    label: "Golpe del Dragón",
    category: "technique",
    priority: 86,
    patterns: [/\bgolpe del dragon\b/i, /\bdragon fist\b/i, /\bpuño del dragon\b/i, /\bryuken\b/i],
  },
  {
    id: "tech-spirit-sword",
    label: "Espada de Ki",
    category: "technique",
    priority: 82,
    patterns: [/\bespada de ki\b/i, /\bspirit sword\b/i, /\bcuchilla de ki\b/i],
  },
  {
    id: "tech-hellzone-grenade",
    label: "Hellzone Grenade",
    category: "technique",
    priority: 80,
    patterns: [/\bhellzone grenade\b/i, /\bgranada infernal\b/i, /\bdisparo disperso\b/i],
  },
  {
    id: "tech-death-beam",
    label: "Death Beam",
    category: "technique",
    priority: 81,
    patterns: [/\bdeath beam\b/i, /\brayo de la muerte\b/i, /\brayo mortal\b/i],
  },
  {
    id: "tech-death-ball",
    label: "Death Ball",
    category: "technique",
    priority: 82,
    patterns: [/\bdeath ball\b/i, /\bbola mortal\b/i, /\bsupernova de freezer\b/i, /\bbola destructora\b/i],
  },
  {
    id: "tech-final-explosion",
    label: "Final Explosion",
    category: "technique",
    priority: 87,
    patterns: [/\bfinal explosion\b/i, /\bsacrificio de vegeta\b/i, /\bautodestruccion de vegeta\b/i],
  },
  {
    id: "tech-dodonpa",
    label: "Dodonpa",
    category: "technique",
    priority: 78,
    patterns: [/\bdodonpa\b/i, /\brayo dodon\b/i],
  },
  {
    id: "tech-sokidan",
    label: "Sokidan",
    category: "technique",
    priority: 76,
    patterns: [/\bsokidan\b/i, /\bbola giratoria de ki\b/i],
  },
  {
    id: "tech-candy-beam",
    label: "Rayo de Chocolate",
    category: "technique",
    priority: 79,
    patterns: [/\brayo de chocolate\b/i, /\btransformar en dulce\b/i, /\bconvertir en chocolate\b/i],
  },

  // ── 4. VILLANOS Y ANTAGONISTAS (villain - Prioridad 70-87) ───────────────────
  // DB Original Clásicos
  {
    id: "vil-pilaf",
    label: "Emperador Pilaf",
    category: "villain",
    priority: 74,
    patterns: [/\bemperador pilaf\b/i, /\bbanda de pilaf\b/i, /\bpilaf\b/i],
  },
  {
    id: "vil-monster-carrot",
    label: "Jefe Conejo",
    category: "villain",
    priority: 70,
    patterns: [/\bjefe conejo\b/i, /\bmonster carrot\b/i],
  },
  {
    id: "vil-red-ribbon",
    label: "Patrulla Roja",
    category: "villain",
    priority: 77,
    patterns: [/\bpatrulla roja\b/i, /\bred ribbon\b/i, /\bejercito red ribbon\b/i, /\bcomandante red\b/i, /\bgeneral black\b/i],
  },
  {
    id: "vil-general-blue",
    label: "General Blue",
    category: "villain",
    priority: 75,
    patterns: [/\bgeneral blue\b/i, /\bcomandante blue\b/i],
  },
  {
    id: "vil-tao-pai-pai",
    label: "Tao Pai Pai",
    category: "villain",
    priority: 79,
    patterns: [/\btao pai pai\b/i, /\btaopaipai\b/i, /\bcyborg tao\b/i],
  },
  {
    id: "vil-piccolo-daimaku",
    label: "Piccolo Daimaku",
    category: "villain",
    priority: 83,
    patterns: [/\bpiccolo daimaku\b/i, /\brey demonio piccolo\b/i, /\bgran rey demonio\b/i],
  },
  {
    id: "vil-tambourine",
    label: "Tambourine & Drum",
    category: "villain",
    priority: 75,
    patterns: [/\btambourine\b/i, /\bdrum\b/i, /\bcymbal\b/i, /\bpiano\b/i],
  },
  {
    id: "vil-master-tsuru",
    label: "Maestro Tsuru",
    category: "villain",
    priority: 72,
    patterns: [/\bmaestro tsuru\b/i, /\bescuela grulla\b/i, /\btsuru-sen'nin\b/i],
  },
  {
    id: "vil-akkuman",
    label: "Akkuman",
    category: "villain",
    priority: 71,
    patterns: [/\bakkuman\b/i, /\bdemonio del infierno\b/i],
  },

  // DB Z Canónicos
  {
    id: "vil-raditz",
    label: "Raditz",
    category: "villain",
    priority: 82,
    patterns: [/\braditz\b/i, /\bhermano de goku\b/i],
  },
  {
    id: "vil-nappa",
    label: "Nappa & Saibaman",
    category: "villain",
    priority: 80,
    patterns: [/\bnappa\b/i, /\bsaibaman\b/i, /\bsaibaimen\b/i],
  },
  {
    id: "vil-vegeta-invader",
    label: "Vegeta Invasor",
    category: "villain",
    priority: 84,
    patterns: [/\bvegeta invasor\b/i, /\bprincipe vegeta\b/i, /\bvegeta y nappa\b/i, /\bataque saiyajin\b/i],
  },
  {
    id: "vil-ginyu-force",
    label: "Fuerzas Ginyu",
    category: "villain",
    priority: 82,
    patterns: [/\bfuerzas especiales ginyu\b/i, /\bfuerzas ginyu\b/i, /\bcapitan ginyu\b/i, /\brecoome\b/i, /\bburter\b/i, /\bjeice\b/i, /\bguldo\b/i],
  },
  {
    id: "vil-zarbon-dodoria",
    label: "Zarbon & Dodoria",
    category: "villain",
    priority: 78,
    patterns: [/\bzarbon\b/i, /\bdodoria\b/i, /\bcui\b/i],
  },
  {
    id: "vil-freezer",
    label: "Freezer",
    category: "villain",
    priority: 87,
    patterns: [/\bfreezer\b/i, /\bfrieza\b/i, /\bemperador del mal\b/i, /\bmecha freezer\b/i, /\brey cold\b/i],
  },
  {
    id: "vil-androids-19-20",
    label: "Dr. Gero & Androide 19",
    category: "villain",
    priority: 80,
    patterns: [/\bdr\.? gero\b/i, /\bdoctor gero\b/i, /\bandroide 19\b/i, /\bandroide 20\b/i],
  },
  {
    id: "vil-androids-17-18",
    label: "Androides 17 y 18",
    category: "villain",
    priority: 83,
    patterns: [/\bandroide 17\b/i, /\bandroide 18\b/i, /\blos androides\b/i, /\bgemelos androides\b/i],
  },
  {
    id: "vil-android-16",
    label: "Androide 16",
    category: "villain",
    priority: 78,
    patterns: [/\bandroide 16\b/i, /\bnumero 16\b/i],
  },
  {
    id: "vil-cell",
    label: "Cell",
    category: "villain",
    priority: 87,
    patterns: [/\bcell\b/i, /\bcelula\b/i, /\bbio-androide\b/i, /\bcell juniors\b/i, /\bjuegos de cell\b/i],
  },
  {
    id: "vil-babidi-dabura",
    label: "Babidi & Dabura",
    category: "villain",
    priority: 81,
    patterns: [/\bbabidi\b/i, /\bdabura\b/i, /\bspopovich\b/i, /\byamu\b/i, /\bpui pui\b/i, /\byakon\b/i],
  },
  {
    id: "vil-majin-vegeta",
    label: "Majin Vegeta",
    category: "villain",
    priority: 86,
    patterns: [/\bmajin vegeta\b/i, /\bvegeta poseido\b/i, /\bsello majin\b/i],
  },
  {
    id: "vil-majin-buu",
    label: "Majin Buu",
    category: "villain",
    priority: 87,
    patterns: [/\bmajin buu\b/i, /\bbuu gordo\b/i, /\bsuper buu\b/i, /\bkid buu\b/i, /\bevil buu\b/i, /\bbuutenks\b/i, /\bbuuhan\b/i],
  },

  // Villanos de Películas Clásicas Z
  {
    id: "vil-garlic-jr",
    label: "Garlic Jr.",
    category: "villain",
    priority: 78,
    patterns: [/\bgarlic jr\b/i, /\bgarlic junior\b/i, /\bzona muerta\b/i, /\bdead zone\b/i],
  },
  {
    id: "vil-dr-wheelo",
    label: "Dr. Wheelo",
    category: "villain",
    priority: 76,
    patterns: [/\bdr\.? wheelo\b/i, /\bdoctor wheelo\b/i, /\bdoctor kochin\b/i],
  },
  {
    id: "vil-turles",
    label: "Turles",
    category: "villain",
    priority: 80,
    patterns: [/\bturles\b/i, /\btullece\b/i, /\barbol del poder\b/i, /\bfruto sagrado\b/i],
  },
  {
    id: "vil-lord-slug",
    label: "Lord Slug",
    category: "villain",
    priority: 77,
    patterns: [/\blord slug\b/i, /\bslug el namekiano\b/i],
  },
  {
    id: "vil-cooler",
    label: "Cooler",
    category: "villain",
    priority: 83,
    patterns: [/\bcooler\b/i, /\bmetal cooler\b/i, /\bhermano de freezer\b/i, /\bfuerzas de cooler\b/i],
  },
  {
    id: "vil-android-13",
    label: "Androide 13",
    category: "villain",
    priority: 78,
    patterns: [/\bandroide 13\b/i, /\bsuper 13\b/i, /\bandroide 14\b/i, /\bandroide 15\b/i],
  },
  {
    id: "vil-broly-classic",
    label: "Broly Clásico",
    category: "villain",
    priority: 86,
    patterns: [/\bbroly\b/i, /\bparagus\b/i, /\bbio-broly\b/i],
  },
  {
    id: "vil-bojack",
    label: "Bojack",
    category: "villain",
    priority: 80,
    patterns: [/\bbojack\b/i, /\bzangya\b/i, /\bguerreros de plata\b/i],
  },
  {
    id: "vil-janemba",
    label: "Janemba",
    category: "villain",
    priority: 84,
    patterns: [/\bjanemba\b/i, /\bdemonio janemba\b/i],
  },
  {
    id: "vil-hirudegarn",
    label: "Hirudegarn",
    category: "villain",
    priority: 80,
    patterns: [/\bhirudegarn\b/i, /\bhoi el hechicero\b/i, /\bataque del dragon\b/i],
  },
  {
    id: "vil-hatchiyack",
    label: "Hatchiyack",
    category: "villain",
    priority: 76,
    patterns: [/\bhatchiyack\b/i, /\bdr\.? raichi\b/i],
  },

  // DB GT
  {
    id: "vil-baby",
    label: "Baby",
    category: "villain",
    priority: 84,
    patterns: [/\bbaby\b/i, /\bbaby vegeta\b/i, /\btsufuru\b/i, /\bparasito baby\b/i],
  },
  {
    id: "vil-super-17-gt",
    label: "Super Androide 17",
    category: "villain",
    priority: 82,
    patterns: [/\bsuper androide 17\b/i, /\bdoctor myuu\b/i, /\bgeneral rilldo\b/i, /\bluud\b/i, /\bdon kee\b/i, /\bledgic\b/i],
  },
  {
    id: "vil-shadow-dragons",
    label: "Dragones Malignos",
    category: "villain",
    priority: 85,
    patterns: [/\bdragones malignos\b/i, /\bomega shenron\b/i, /\bsyn shenron\b/i, /\bnuova shenron\b/i, /\beis shenron\b/i],
  },

  // DB Super & Daima
  {
    id: "vil-beerus-rival",
    label: "Beerus",
    category: "villain",
    priority: 84,
    patterns: [/\bbeerus\b/i, /\bbills\b/i, /\bdios de la destruccion\b/i],
  },
  {
    id: "vil-hit",
    label: "Hit",
    category: "villain",
    priority: 83,
    patterns: [/\bhit\b/i, /\bsalto temporal\b/i, /\basesino hit\b/i],
  },
  {
    id: "vil-goku-black",
    label: "Goku Black",
    category: "villain",
    priority: 87,
    patterns: [/\bgoku black\b/i, /\bblack goku\b/i, /\bzamasu\b/i, /\bzamasu inmortal\b/i],
  },
  {
    id: "vil-jiren",
    label: "Jiren",
    category: "villain",
    priority: 86,
    patterns: [/\bjiren\b/i, /\btoppo\b/i, /\bdyspo\b/i, /\btropas del orgullo\b/i, /\buniverso 11\b/i],
  },
  {
    id: "vil-moro-gas",
    label: "Moro & Granola",
    category: "villain",
    priority: 82,
    patterns: [/\bmoro\b/i, /\bgranola\b/i, /\bgas\b/i, /\belec\b/i, /\bheaters\b/i],
  },
  {
    id: "vil-cell-max",
    label: "Cell Max",
    category: "villain",
    priority: 83,
    patterns: [/\bcell max\b/i, /\bdr\.? hedo\b/i, /\bgamma 1\b/i, /\bgamma 2\b/i],
  },
  {
    id: "vil-gomah-degesu",
    label: "Rey Gomah",
    category: "villain",
    priority: 81,
    patterns: [/\bgomah\b/i, /\bdegesu\b/i, /\barinsu\b/i, /\brey gomah\b/i],
  },

  // ── 5. PROTAGONISTAS Y ALIADOS POR SERIE (protagonist - Prioridad 65-80) ──────
  // DB Original
  {
    id: "pro-goku-kid",
    label: "Goku Niño",
    category: "protagonist",
    priority: 80,
    patterns: [/\bgoku nino\b/i, /\bson goku nino\b/i, /\bgoku pequeno\b/i],
  },
  {
    id: "pro-bulma",
    label: "Bulma",
    category: "protagonist",
    priority: 78,
    patterns: [/\bbulma\b/i, /\bcorporacion capsula\b/i],
  },
  {
    id: "pro-krillin",
    label: "Krilin",
    category: "protagonist",
    priority: 78,
    patterns: [/\bkrilin\b/i, /\bkuririn\b/i],
  },
  {
    id: "pro-roshi",
    label: "Maestro Roshi",
    category: "protagonist",
    priority: 79,
    patterns: [/\bmaestro roshi\b/i, /\bkame sen'nin\b/i, /\bjackie chun\b/i, /\banciano maestro\b/i],
  },
  {
    id: "pro-yamcha-puar",
    label: "Yamcha & Puar",
    category: "protagonist",
    priority: 72,
    patterns: [/\byamcha\b/i, /\bpuar\b/i],
  },
  {
    id: "pro-oolong",
    label: "Oolong",
    category: "protagonist",
    priority: 68,
    patterns: [/\boolong\b/i],
  },
  {
    id: "pro-chichi",
    label: "Chichi",
    category: "protagonist",
    priority: 70,
    patterns: [/\bchichi\b/i, /\bmilk\b/i, /\bprincesa chichi\b/i],
  },
  {
    id: "pro-grandpa-gohan",
    label: "Abuelo Gohan",
    category: "protagonist",
    priority: 74,
    patterns: [/\babuelo gohan\b/i, /\bson gohan abuelo\b/i],
  },
  {
    id: "pro-tien-chiaotzu",
    label: "Tenshinhan & Chaoz",
    category: "protagonist",
    priority: 75,
    patterns: [/\btenshinhan\b/i, /\bchaoz\b/i, /\bchiaotzu\b/i],
  },
  {
    id: "pro-korin-yajirobe",
    label: "Karin & Yajirobe",
    category: "protagonist",
    priority: 72,
    patterns: [/\bmaestro karin\b/i, /\btorre karin\b/i, /\byajirobe\b/i],
  },
  {
    id: "pro-kami-popo",
    label: "Kami-sama & Mr. Popo",
    category: "protagonist",
    priority: 73,
    patterns: [/\bkami-sama\b/i, /\bkamisama\b/i, /\bmr\.? popo\b/i, /\btemplo sagrado\b/i],
  },
  {
    id: "pro-lunch",
    label: "Lunch",
    category: "protagonist",
    priority: 69,
    patterns: [/\blunch\b/i, /\blanch\b/i],
  },
  {
    id: "pro-uranai-baba",
    label: "Uranai Baba",
    category: "protagonist",
    priority: 70,
    patterns: [/\buranai baba\b/i, /\bvidente baba\b/i],
  },

  // DB Z
  {
    id: "pro-goku",
    label: "Goku",
    category: "protagonist",
    priority: 80,
    patterns: [/\bgoku\b/i, /\bson goku\b/i, /\bkakarotto\b/i],
  },
  {
    id: "pro-gohan",
    label: "Gohan",
    category: "protagonist",
    priority: 79,
    patterns: [/\bgohan\b/i, /\bson gohan\b/i, /\bgran saiyaman\b/i],
  },
  {
    id: "pro-piccolo",
    label: "Piccolo",
    category: "protagonist",
    priority: 79,
    patterns: [/\bpiccolo\b/i, /\bma junior\b/i],
  },
  {
    id: "pro-vegeta",
    label: "Vegeta",
    category: "protagonist",
    priority: 80,
    patterns: [/\bvegeta\b/i, /\bprincipe saiyajin\b/i],
  },
  {
    id: "pro-future-trunks",
    label: "Trunks del Futuro",
    category: "protagonist",
    priority: 80,
    patterns: [/\btrunks del futuro\b/i, /\btrunks adulto\b/i, /\bjoven de la espada\b/i],
  },
  {
    id: "pro-goten-trunks",
    label: "Goten & Trunks",
    category: "protagonist",
    priority: 76,
    patterns: [/\bgoten\b/i, /\btrunks nino\b/i, /\bpequeno trunks\b/i],
  },
  {
    id: "pro-videl-satan",
    label: "Videl & Mr. Satán",
    category: "protagonist",
    priority: 73,
    patterns: [/\bvidel\b/i, /\bmr\.? satan\b/i, /\bmister satan\b/i, /\bhercule\b/i],
  },
  {
    id: "pro-android-18-ally",
    label: "Androide 18",
    category: "protagonist",
    priority: 75,
    patterns: [/\bandroide 18\b/i, /\bnumero 18\b/i, /\blazuli\b/i],
  },
  {
    id: "pro-dende",
    label: "Dende",
    category: "protagonist",
    priority: 71,
    patterns: [/\bdende\b/i, /\bnuevo kami\b/i],
  },
  {
    id: "pro-king-kai",
    label: "Kaio-sama",
    category: "protagonist",
    priority: 76,
    patterns: [/\bkaio-sama\b/i, /\bkaiosama\b/i, /\bplaneta de kaio\b/i, /\bgregory\b/i, /\bbubbles\b/i],
  },
  {
    id: "pro-supreme-kai",
    label: "Supremo Kaiosama",
    category: "protagonist",
    priority: 74,
    patterns: [/\bsupremo kaiosama\b/i, /\bshin\b/i, /\bkibito\b/i, /\bkibitoshin\b/i, /\banciano kaioshin\b/i, /\bro kaioshin\b/i],
  },
  {
    id: "pro-bardock",
    label: "Bardock",
    category: "protagonist",
    priority: 79,
    patterns: [/\bbardock\b/i, /\bpadre de goku\b/i],
  },
  {
    id: "pro-tapion",
    label: "Tapion",
    category: "protagonist",
    priority: 76,
    patterns: [/\btapion\b/i, /\bhéroe de la ocarina\b/i, /\bminotia\b/i],
  },

  // DB GT
  {
    id: "pro-pan-giru",
    label: "Pan & Giru",
    category: "protagonist",
    priority: 75,
    patterns: [/\bpan\b/i, /\bgiru\b/i, /\buub\b/i, /\bmajuub\b/i, /\bbra\b/i, /\bbulla\b/i],
  },

  // DB Super & Daima
  {
    id: "pro-whis",
    label: "Whis",
    category: "protagonist",
    priority: 78,
    patterns: [/\bwhis\b/i, /\bangel guardian\b/i, /\bvados\b/i],
  },
  {
    id: "pro-zeno-daishinkan",
    label: "Zen'o-sama & Daishinkan",
    category: "protagonist",
    priority: 77,
    patterns: [/\bzen'o-sama\b/i, /\bzeno-sama\b/i, /\bzeno\b/i, /\bdaishinkan\b/i, /\bgran sacerdote\b/i],
  },
  {
    id: "pro-u6-saiyans",
    label: "Caulifla & Kale",
    category: "protagonist",
    priority: 76,
    patterns: [/\bcaulifla\b/i, /\bkale\b/i, /\bcabba\b/i, /\bsaiyajins del universo 6\b/i],
  },
  {
    id: "pro-jaco",
    label: "Jaco",
    category: "protagonist",
    priority: 72,
    patterns: [/\bjaco\b/i, /\bpatrullero galactico\b/i, /\bmonaka\b/i],
  },
  {
    id: "pro-glorio-panzy",
    label: "Glorio & Panzy",
    category: "protagonist",
    priority: 75,
    patterns: [/\bglorio\b/i, /\bpanzy\b/i, /\bgoku mini\b/i, /\bvegeta mini\b/i],
  },

  // ── 6. ARTEFACTOS & MITOLOGÍA (artifact - Prioridad 65-78) ────────────────────
  {
    id: "art-dragon-balls",
    label: "Esferas del Dragón",
    category: "artifact",
    priority: 78,
    patterns: [/\besferas del dragon\b/i, /\besfera del dragon\b/i, /\bbolas de dragon\b/i, /\besferas magicas\b/i],
  },
  {
    id: "art-namek-dragon-balls",
    label: "Esferas de Namek",
    category: "artifact",
    priority: 78,
    patterns: [/\besferas de namek\b/i, /\bbolas de namek\b/i, /\bdragon de namek\b/i],
  },
  {
    id: "art-super-dragon-balls",
    label: "Super Esferas del Dragón",
    category: "artifact",
    priority: 79,
    patterns: [/\bsuper esferas del dragon\b/i, /\bsuper dragon balls\b/i, /\besferas del universo\b/i],
  },
  {
    id: "art-shenlong",
    label: "Shenlong",
    category: "artifact",
    priority: 77,
    patterns: [/\bshenlong\b/i, /\bshenron\b/i, /\bgran dragon sagrado\b/i, /\bsuper shenlong\b/i],
  },
  {
    id: "art-porunga",
    label: "Porunga",
    category: "artifact",
    priority: 76,
    patterns: [/\bporunga\b/i, /\bpolunga\b/i, /\bdragon de los tres deseos\b/i],
  },
  {
    id: "art-senzu-beans",
    label: "Semillas del Ermitaño",
    category: "artifact",
    priority: 75,
    patterns: [/\bsemillas del ermitano\b/i, /\bsemilla del ermitano\b/i, /\bsenzu\b/i, /\bsemillas senzu\b/i],
  },
  {
    id: "art-dragon-radar",
    label: "Radar del Dragón",
    category: "artifact",
    priority: 72,
    patterns: [/\bradar del dragon\b/i, /\bradar de bulma\b/i],
  },
  {
    id: "art-flying-nimbus",
    label: "Nube Voladora",
    category: "artifact",
    priority: 74,
    patterns: [/\bnube voladora\b/i, /\bnube kinto\b/i, /\bkinton\b/i],
  },
  {
    id: "art-power-pole",
    label: "Báculo Sagrado",
    category: "artifact",
    priority: 73,
    patterns: [/\bbaculo sagrado\b/i, /\bnyoibo\b/i, /\bbaston magico\b/i],
  },
  {
    id: "art-scouter",
    label: "Scouter",
    category: "artifact",
    priority: 71,
    patterns: [/\bscouter\b/i, /\brastreador\b/i, /\brastreadores de ki\b/i],
  },
  {
    id: "art-time-ring",
    label: "Anillo del Tiempo",
    category: "artifact",
    priority: 75,
    patterns: [/\banillo del tiempo\b/i, /\banillos temporales\b/i, /\bmaquina del tiempo\b/i],
  },
  {
    id: "art-gravity-chamber",
    label: "Máquina de Gravedad",
    category: "artifact",
    priority: 70,
    patterns: [/\bmaquina de gravedad\b/i, /\bgravedad aumentada\b/i, /\b100 de gravedad\b/i],
  },

  // ── 7. ESCENARIOS & DIMENSIONES (location - Prioridad 60-72) ──────────────────
  {
    id: "loc-planet-namek",
    label: "Planeta Namek",
    category: "location",
    priority: 72,
    patterns: [/\bplaneta namek\b/i, /\bnamekusei\b/i, /\btierra de los namekianos\b/i],
  },
  {
    id: "loc-hyperbolic-time-chamber",
    label: "Habitación del Tiempo",
    category: "location",
    priority: 74,
    patterns: [/\bhabitacion del tiempo\b/i, /\bsala del espiritu y el tiempo\b/i, /\broom of spirit and time\b/i],
  },
  {
    id: "loc-other-world",
    label: "Otro Mundo & Infierno",
    category: "location",
    priority: 70,
    patterns: [/\botro mundo\b/i, /\binfierno\b/i, /\bcamino de la serpiente\b/i, /\bpalacio de enma\b/i],
  },
  {
    id: "loc-sacred-world-kai",
    label: "Planeta Supremo",
    category: "location",
    priority: 71,
    patterns: [/\bplaneta supremo\b/i, /\bmundo sagrado de los kaioshin\b/i, /\btierra de los dioses\b/i],
  },
  {
    id: "loc-kami-lookout",
    label: "Templo Sagrado",
    category: "location",
    priority: 70,
    patterns: [/\btemplo sagrado\b/i, /\bpalacio de kami\b/i, /\btorre karin\b/i],
  },
  {
    id: "loc-planet-vegeta",
    label: "Planeta Vegeta",
    category: "location",
    priority: 71,
    patterns: [/\bplaneta vegeta\b/i, /\bplaneta plant\b/i, /\btierra natal saiyajin\b/i],
  },
  {
    id: "loc-beerus-planet",
    label: "Planeta de Beerus",
    category: "location",
    priority: 69,
    patterns: [/\bplaneta de beerus\b/i, /\bplaneta de bills\b/i, /\bmundo de los dioses destructores\b/i],
  },
  {
    id: "loc-demon-realm",
    label: "Reino de los Demonios",
    category: "location",
    priority: 70,
    patterns: [/\breino de los demonios\b/i, /\breino demoniaco\b/i, /\bmakai\b/i],
  },
  {
    id: "loc-kame-house",
    label: "Kame House",
    category: "location",
    priority: 68,
    patterns: [/\bkame house\b/i, /\bisla del maestro roshi\b/i],
  },
  {
    id: "loc-world-of-void",
    label: "Mundo del Vacío",
    category: "location",
    priority: 70,
    patterns: [/\bmundo del vacio\b/i, /\barena del torneo del poder\b/i],
  },

  // ── 8. DINÁMICAS NARRATIVAS (narrative - Prioridad 50-70) ────────────────────
  {
    id: "nar-epic-battle",
    label: "Batalla Épica",
    category: "narrative",
    priority: 68,
    patterns: [/\bbatalla epica\b/i, /\bgran combate\b/i, /\bchoque de poderes\b/i, /\bcombate a muerte\b/i, /\bduelo a muerte\b/i, /\bguerra total\b/i],
  },
  {
    id: "nar-heroic-sacrifice",
    label: "Sacrificio Heroico",
    category: "narrative",
    priority: 75,
    patterns: [/\bsacrificio heroico\b/i, /\bsacrificio\b/i, /\badios amigos\b/i, /\bdespedida emotiva\b/i, /\bda su vida\b/i, /\bautodestruccion\b/i],
  },
  {
    id: "nar-rage-awakening",
    label: "Despertar de Furia",
    category: "narrative",
    priority: 74,
    patterns: [/\bfuria\b/i, /\biracundo\b/i, /\bdespierta su poder\b/i, /\bestalla de ira\b/i, /\biracundo poder\b/i],
  },
  {
    id: "nar-arc-climax",
    label: "Clímax del Arco",
    category: "narrative",
    priority: 73,
    patterns: [/\bclimax\b/i, /\bdesenlace\b/i, /\bvictoria final\b/i, /\bderrota definitiva\b/i, /\bcapitulo final\b/i],
  },
  {
    id: "nar-training",
    label: "Entrenamiento & Superación",
    category: "narrative",
    priority: 65,
    patterns: [/\bentrenamiento\b/i, /\bentrenar\b/i, /\bentrenan\b/i, /\bsuperacion\b/i, /\bnueva tecnica\b/i, /\baprender\b/i],
  },
  {
    id: "nar-space-odyssey",
    label: "Viaje Espacial",
    category: "narrative",
    priority: 62,
    patterns: [/\bviaje espacial\b/i, /\bnave espacial\b/i, /\brumbo al espacio\b/i, /\bviaje interplanetario\b/i],
  },
  {
    id: "nar-time-travel",
    label: "Viaje Temporal",
    category: "narrative",
    priority: 66,
    patterns: [/\bviaje temporal\b/i, /\blinea temporal\b/i, /\bviaje al pasado\b/i, /\bviaje al futuro\b/i],
  },
  {
    id: "nar-wish-granted",
    label: "Deseo Concedido",
    category: "narrative",
    priority: 64,
    patterns: [/\bdeseo concedido\b/i, /\binvocacion del dragon\b/i, /\bconceder el deseo\b/i, /\bcumplir el deseo\b/i],
  },
  {
    id: "nar-comedy-slice",
    label: "Comedia & Vida Cotidiana",
    category: "narrative",
    priority: 55,
    patterns: [/\bcomedia\b/i, /\bhumor\b/i, /\bvida cotidiana\b/i, /\bescuela\b/i, /\bexamen de conducir\b/i, /\bdivertido\b/i],
  },

  // ── 9. TORNEOS & COMPETENCIAS (tournament - Prioridad 60-75) ─────────────────
  {
    id: "tourn-tenkaichi",
    label: "Torneo de las Artes Marciales",
    category: "tournament",
    priority: 75,
    patterns: [/\btorneo de las artes marciales\b/i, /\btenkaichi budokai\b/i, /\btorneo mundial\b/i, /\btorneo de artes marciales\b/i],
  },
  {
    id: "tourn-tournament-of-power",
    label: "Torneo del Poder",
    category: "tournament",
    priority: 78,
    patterns: [/\btorneo del poder\b/i, /\btournament of power\b/i, /\btorneo de los universos\b/i, /\bsupervivencia universal\b/i],
  },
  {
    id: "tourn-cell-games",
    label: "Los Juegos de Cell",
    category: "tournament",
    priority: 76,
    patterns: [/\blos juegos de cell\b/i, /\bcell games\b/i, /\bel ring de cell\b/i],
  },
  {
    id: "tourn-other-world",
    label: "Torneo del Otro Mundo",
    category: "tournament",
    priority: 72,
    patterns: [/\btorneo del otro mundo\b/i, /\btorneo de las galaxias\b/i, /\btorneo celestial\b/i],
  },
  {
    id: "tourn-champa",
    label: "Torneo de Champa",
    category: "tournament",
    priority: 73,
    patterns: [/\btorneo de champa\b/i, /\buniverso 6 vs universo 7\b/i, /\bcombate entre universos\b/i],
  },
  {
    id: "tourn-zen-exhibition",
    label: "Exhibición Zen",
    category: "tournament",
    priority: 71,
    patterns: [/\bexhibicion zen\b/i, /\bencuentro de exhibicion\b/i, /\btorneo previo\b/i],
  },
]

export interface ExtractTagOptions {
  maxTags?: number
  isFiller?: boolean
  sagaName?: string
}

/**
 * Devuelve el estilo visual Tailwind acorde al tema AMOLED de KameHouse según la categoría del tag.
 */
export function getTagCategoryStyle(category: TagCategory): string {
  switch (category) {
    case "transformation":
      return "bg-brand-warning/15 text-brand-warning border-brand-warning/35 hover:bg-brand-warning/25 shadow-brand-focus"
    case "technique":
      return "bg-brand-secondary/15 text-brand-secondary border-brand-secondary/35 hover:bg-brand-secondary/25 shadow-brand-secondary"
    case "fusion":
      return "bg-brand-magic/15 text-brand-magic border-brand-magic/35 hover:bg-brand-magic/25 shadow-brand-magic"
    case "villain":
      return "bg-brand-destructive/15 text-brand-destructive border-brand-destructive/35 hover:bg-brand-destructive/25 shadow-brand-destructive"
    case "protagonist":
      return "bg-brand-accent/15 text-brand-accent border-brand-accent/35 hover:bg-brand-accent/25 shadow-brand-primary"
    case "artifact":
      return "bg-brand-warning/15 text-brand-warning border-brand-warning/35 hover:bg-brand-warning/25 shadow-brand-focus"
    case "location":
      return "bg-brand-success/15 text-brand-success border-brand-success/35 hover:bg-brand-success/25 shadow-brand-success"
    case "narrative":
      return "bg-surface-container text-on-surface-variant border-outline-variant/40 hover:bg-surface-container-high"
    case "tournament":
      return "bg-brand-warning/15 text-brand-warning border-brand-warning/35 hover:bg-brand-warning/25 shadow-brand-focus"
    default:
      return "bg-surface-container/80 text-on-surface-variant/80 border-outline-variant/20"
  }
}

/**
 * Extrae objetos detallados `EpisodeTag[]` con scoring multi-señal,
 * desambiguación y ordenamiento por relevancia y prioridad.
 */
export function extractDetailedTags(
  title?: string,
  description?: string,
  options?: ExtractTagOptions
): EpisodeTag[] {
  const maxTags = options?.maxTags ?? 4
  const normTitle = normalizeText(title || "")
  const normDesc = normalizeText(description || "")
  const normSaga = normalizeText(options?.sagaName || "")

  if (!normTitle && !normDesc && !normSaga) return []

  interface ScoredTag {
    tag: EpisodeTag
    score: number
  }

  const matches: ScoredTag[] = []
  const seenIds = new Set<string>()

  for (const rule of TAG_RULES) {
    let score = 0

    // Title Match (Weight: 3.0)
    for (const pattern of rule.patterns) {
      if (normTitle && pattern.test(normTitle)) {
        score += 3.0
        break
      }
    }

    // Synopsis Match (Weight: 1.5)
    for (const pattern of rule.patterns) {
      if (normDesc && pattern.test(normDesc)) {
        score += 1.5
        break
      }
    }

    // Saga Context Match (Weight: 1.0)
    if (score > 0 && normSaga) {
      for (const pattern of rule.patterns) {
        if (pattern.test(normSaga)) {
          score += 1.0
          break
        }
      }
    }

    if (score > 0 && !seenIds.has(rule.id)) {
      seenIds.add(rule.id)
      matches.push({
        tag: {
          id: rule.id,
          label: rule.label,
          category: rule.category,
          priority: rule.priority,
        },
        score: score * 100 + rule.priority,
      })
    }
  }

  // Ordenar por score descendente (relevancia + prioridad de la categoría)
  matches.sort((a, b) => b.score - a.score)

  return matches.slice(0, maxTags).map((m) => m.tag)
}

/**
 * Función de compatibilidad que retorna array de strings con los nombres de tags.
 */
export function extractSynopsisTags(
  title?: string,
  description?: string,
  options?: ExtractTagOptions
): string[] {
  const detailed = extractDetailedTags(title, description, options)
  return detailed.map((t) => t.label)
}
