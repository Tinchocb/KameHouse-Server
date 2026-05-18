package metadata_provider

import (
	"encoding/json"
	"strings"
)

// IntelligenceTagResult represents the output of the tagging engine
type IntelligenceTagResult struct {
	ID                string   `json:"episode_or_movie_id"`
	DetectedTags      []string `json:"detected_tags"`
	DominantVibe      string   `json:"dominant_vibe"`
	SuggestedSwimlane string   `json:"suggested_swimlane"`
}

// TagCategory defines a set of keywords and the tag they represent
type TagCategory struct {
	TagName  string
	Keywords []string
}

// IntelligenceTagger is the core engine for analyzing Dragon Ball content
type IntelligenceTagger struct {
	Dictionary map[string][]TagCategory
}

// NewIntelligenceTagger initializes the tagger with the v2 bilingual dictionary (ES + EN)
func NewIntelligenceTagger() *IntelligenceTagger {
	return &IntelligenceTagger{
		Dictionary: map[string][]TagCategory{
			"Thematic": {
				// ── Combate y Acción ─────────────────────────────────────────────
				{"Batalla Épica", []string{
					"combate", "duelo", "pelea", "venganza", "batalla", "derrotar", "lucha", "enfrentamiento", "golpiza",
					"battle", "fight", "combat", "clash", "confrontation", "defeat", "struggle", "duel", "showdown", "brawl",
				}},
				{"Técnicas de Ki", []string{
					"kamehameha", "ki", "energía", "genkidama", "power", "masenko", "kiensan", "final flash", "galick gun",
					"energy blast", "spirit bomb", "special beam cannon", "solar flare", "dodonpa", "solar",
				}},
				{"Técnicas Especiales", []string{
					"teletransportación", "kaioken", "mafuba", "danza", "ilusión", "barrera",
					"instant transmission", "evil containment", "dance", "technique", "ability",
				}},
				{"Técnicas Letales", []string{
					"rayo mortal", "kikouhou", "corte", "perforar",
					"destructo disc", "death beam", "tri-beam", "fatal",
				}},
				{"Técnicas de Sacrificio", []string{
					"autodestrucción", "explosión final", "sacrificio final",
					"self destruct", "final explosion", "sacrifice himself", "sacrifices",
				}},
				{"Súper Saiyajin", []string{
					"súper saiyajin", "super saiyan", "ssj", "golden", "instinto", "evolución", "despertar", "transformación",
					"super saiyan 2", "super saiyan 3", "super saiyan 4", "super saiyan god", "ssj2", "ssj3", "ssj4",
					"ssgss", "ultra instinct", "omen", "mastered", "blue", "godlike saiyan", "transforms",
				}},
				{"Transformación de Villano", []string{
					"forma final", "perfect cell", "super buu", "kid buu", "golden frieza",
					"final form", "perfect form", "true form", "100% power", "full power", "maximum power",
				}},
				{"Poderes Ocultos", []string{
					"potencial", "desatado", "ultra instinto", "ultra ego",
					"hidden power", "unleashed", "potential", "mystic gohan", "ultimate gohan",
				}},
				{"Poderes Psíquicos", []string{
					"telequinesis", "guldo", "chaoz", "control mental",
					"telekinesis", "psychic", "mind control",
				}},
				{"Espadachines y Armas", []string{
					"espada", "trunks del futuro",
					"sword", "future trunks", "weapon", "blade",
				}},
				{"Fusión de Guerreros", []string{
					"fusión", "danza de la fusión", "vegetto", "gogeta", "gotenks",
					"fusion", "potara", "vegito", "mergence", "fused",
				}},

				// ── Búsqueda y Aventura ──────────────────────────────────────────
				{"Búsqueda de las Esferas", []string{
					"esferas del dragón", "radar del dragón", "deseo", "shenlong", "porunga", "esfera",
					"dragon ball", "dragon balls", "wish", "shenron", "dragon radar",
				}},
				{"Artes Marciales Clásicas", []string{
					"torneo de las artes marciales", "torneo", "budokai", "ring", "eliminatoria", "campeonato",
					"martial arts tournament", "world tournament", "tenkaichi", "fighting tournament", "the tournament",
				}},
				{"El Torneo de Uranai Baba", []string{
					"uranai baba", "momia", "abuelo gohan",
					"fortuneteller baba", "grandpa gohan", "invisible man",
				}},
				{"Los Juegos de Cell", []string{
					"juegos de cell", "cell games", "cell's games",
				}},
				{"Torneo del Más Allá", []string{
					"torneo del otro mundo", "paikuhan", "gran kaio",
					"otherworld tournament", "other world", "king kai",
				}},
				{"Supervivencia Universal", []string{
					"sobrevivir", "destrucción", "fin del mundo", "salvar", "peligro", "torneo del poder",
					"tournament of power", "universe erased", "survive", "erasure", "omni-king",
				}},
				{"Cruce de Universos", []string{
					"universo 6", "champa", "hit", "jiren", "multiverso",
					"universe 6", "universe 7", "universe 11", "multiverse", "cross-universal",
				}},
				{"Viajes por el Espacio", []string{
					"nave", "espacio", "planeta", "namekusei", "galaxia",
					"space", "planet", "spaceship", "galaxy", "namek", "outer space",
				}},
				{"Viajes en el Tiempo", []string{
					"futuro", "máquina del tiempo", "línea temporal",
					"time machine", "future", "timeline", "time travel", "altered time",
				}},
				{"Invasión a la Tierra", []string{
					"invadir", "ejército", "llegada", "conquista", "invasor",
					"invade", "invasion", "army", "attack on earth", "conquer",
				}},

				// ── Entrenamiento ────────────────────────────────────────────────
				{"Entrenamiento Extremo", []string{
					"entrenar", "maestro roshi", "habitación del tiempo", "superación", "práctica", "kaiosama",
					"training", "master roshi", "hyperbolic time chamber", "gravity room", "train", "karin tower",
				}},
				{"Entrenamiento Divino", []string{
					"entrenamiento de whis", "ki divino",
					"whis training", "angel training", "divine ki", "god training",
				}},

				// ── Magia y Demonios ─────────────────────────────────────────────
				{"Magia y Hechizos", []string{
					"magia", "babidi", "maldición", "hechizo", "sello", "bibidi",
					"magic", "wizard", "spell", "sorcerer", "majin", "seal", "curse",
				}},
				{"Mundo de los Demonios", []string{
					"demonio", "rey demonio", "majin", "gomah", "degesu", "dabra", "dabura", "makai", "janemba", "towa",
					"demon", "demon realm", "demon king", "darkness", "demon world",
				}},
				{"Maldición Mini", []string{
					"encogidos", "mini", "daima", "pequeños",
					"miniaturized", "shrunken", "young", "child form", "daima",
				}},

				// ── Drama y Emociones ────────────────────────────────────────────
				{"Sacrificio Heroico", []string{
					"sacrificio", "morir", "lágrimas", "despedida", "tragedia", "muerte",
					"sacrifice", "death", "dies", "farewell", "tragedy", "goodbye", "tearful",
				}},
				{"Tensión Absoluta", []string{
					"miedo", "desesperación", "terror", "imposible", "angustia", "sin salida",
					"desperate", "hopeless", "terror", "impossible", "despair", "helpless",
				}},
				{"Vida Cotidiana", []string{
					"familia", "escuela", "trabajo", "cotidiano", "vida diaria", "casa", "satán city",
					"family", "school", "daily life", "work", "city", "peaceful", "normal life",
				}},
				{"Humor y Relleno", []string{
					"banquete", "gracioso", "fiesta", "vacaciones", "broma", "comedia", "relleno", "bingo",
					"funny", "comedy", "party", "vacation", "humorous", "filler", "picnic",
				}},
				{"Romance", []string{
					"boda", "amor", "casamiento", "pareja", "cita",
					"wedding", "love", "marriage", "couple", "romance",
				}},
				{"Superhéroes", []string{
					"gran saiyaman", "justicia", "saiyawoman",
					"great saiyaman", "superhero", "justice", "hero costume",
				}},

				// ── Facciones y Razas ────────────────────────────────────────────
				{"Los Guerreros Z", []string{
					"goku", "vegeta", "gohan", "piccolo", "krillin", "krilin", "yamcha", "tenshinhan", "yajirobe",
					"z fighters", "z warrior",
				}},
				{"Los Namekuseijin", []string{
					"namek", "dende", "nail", "porunga", "elder", "grand elder",
					"namekian", "elder namek",
				}},
				{"Los Saiyajins", []string{
					"saiyajin", "raditz", "nappa", "bardock", "kakarotto", "planet vegeta",
					"saiyan", "saiyans", "race of warriors",
				}},
				{"Saiyajins Legendarios", []string{
					"broly", "super saiyajin legendario", "kale", "berserker",
					"legendary super saiyan", "legendary saiyan",
				}},
				{"El Imperio de Freezer", []string{
					"freezer", "ginyu", "zarbon", "dodoria", "cooler", "rey cold",
					"frieza", "frieza force", "frieza's army", "ginyu force", "king cold",
				}},
				{"La Patrulla Roja", []string{
					"patrulla roja", "androide", "cell", "doctor gero",
					"red ribbon", "android", "androids", "dr. gero", "cell max", "gamma",
				}},
				{"Dioses de la Destrucción", []string{
					"bills", "whis", "beerus", "zeno", "dios de la destrucción",
					"god of destruction", "angel", "destroyer", "hakai",
				}},
				{"Entidades Supremas", []string{
					"zeno sama", "rey de todo", "daishinkan",
					"king of all", "omni-king", "grand priest",
				}},
				{"La Patrulla Galáctica", []string{
					"jaco", "merus", "moro", "patrulla galáctica",
					"galactic patrol", "galactic patrolman",
				}},
				{"Guerreras Poderosas", []string{
					"caulifla", "kale", "kefla", "videl", "android 18",
					"female warrior", "powerful woman",
				}},
				{"Nuevas Generaciones", []string{
					"pan", "uub", "goten", "trunks niño",
					"pan", "kid trunks", "next generation", "young fighters",
				}},
				{"Dragones Malignos", []string{
					"dragón maligno", "omega shenron",
					"shadow dragon", "evil dragon", "negative energy",
				}},
				{"Los Tsufurujin", []string{
					"baby", "tsufuru",
					"baby vegeta", "tuffle",
				}},
				{"Villanos de Películas", []string{
					"garlic jr", "turles", "lord slug", "cooler", "broly", "bojack", "janemba",
					"garlic junior", "movie villain",
				}},
				{"Objetos Místicos", []string{
					"senzu", "nube voladora",
					"senzu bean", "flying nimbus", "sacred water",
				}},
				{"Tecnología Cápsula", []string{
					"cápsula", "corporación cápsula",
					"capsule corp", "gravity chamber", "spaceship",
				}},
			},
		},
	}
}

// Analyze returns a result based on the provided title and description
func (t *IntelligenceTagger) Analyze(id string, title, description string, isMovie bool) IntelligenceTagResult {
	tags := t.ExtractAbstractTags(description, title)

	if isMovie {
		// Ensure MOVIE is present if it's a movie
		found := false
		for _, tag := range tags {
			if tag == "Película" {
				found = true
				break
			}
		}
		if !found {
			tags = append([]string{"Película"}, tags...)
			if len(tags) > 6 {
				tags = tags[:6] // Keep it clean
			}
		}
	}

	result := IntelligenceTagResult{
		ID:           id,
		DetectedTags: tags,
	}

	// Determine Dominant Vibe
	result.DominantVibe = t.determineVibe(tags)

	// Suggest Swimlane
	result.SuggestedSwimlane = t.suggestSwimlane(tags)

	return result
}

func (t *IntelligenceTagger) determineVibe(tags []string) string {
	hasTag := func(name string) bool {
		for _, tag := range tags {
			if tag == name {
				return true
			}
		}
		return false
	}

	if hasTag("Supervivencia Universal") || hasTag("Tensión Absoluta") {
		return "Tensión Absoluta"
	}
	if hasTag("Sacrificio Heroico") {
		return "Emoción Pura"
	}
	if hasTag("Humor y Relleno") || hasTag("Vida Cotidiana") {
		return "Relajado"
	}
	if hasTag("Búsqueda de las Esferas") || hasTag("Viajes por el Espacio") || hasTag("Mundo de los Demonios") {
		return "Aventura"
	}
	if hasTag("Batalla Épica") || hasTag("Artes Marciales Clásicas") {
		return "Épico"
	}
	return "Emocionante"
}

func (t *IntelligenceTagger) suggestSwimlane(tags []string) string {
	hasTag := func(name string) bool {
		for _, tag := range tags {
			if tag == name {
				return true
			}
		}
		return false
	}

	// ── Batallas y Poder ──────────────────────────────────────────────────────
	if hasTag("Batalla Épica") && (hasTag("Súper Saiyajin") || hasTag("Poderes Ocultos")) {
		return "Capítulos Imperdibles: Las Batallas Más Épicas"
	}
	if hasTag("Batalla Épica") && (hasTag("Técnicas de Ki") || hasTag("Supervivencia Universal")) {
		return "¡Eleva tu Ki!: Batallas que rompieron los límites"
	}
	if hasTag("Súper Saiyajin") || hasTag("Poderes Ocultos") {
		return "Más Allá del Límite: Transformaciones Saiyajin"
	}
	if hasTag("Transformación de Villano") {
		return "Cuando el Villano Alcanza su Forma Final"
	}
	if hasTag("Técnicas de Sacrificio") {
		return "El Último Recurso: Técnicas de Sacrificio"
	}
	if hasTag("Técnicas Letales") {
		return "Técnicas Letales: Sin Vuelta Atrás"
	}
	if hasTag("Fusión de Guerreros") {
		return "¡Fusión HA!: Las Uniones Más Poderosas"
	}
	if hasTag("Espadachines y Armas") {
		return "Espadachines y Guerreros con Armas"
	}

	// ── Torneos y Eventos ──────────────────────────────────────────────────────
	if hasTag("Artes Marciales Clásicas") {
		return "¡Fuera del Ring!: Los Grandes Torneos"
	}
	if hasTag("El Torneo de Uranai Baba") {
		return "El Misterioso Torneo de Uranai Baba"
	}
	if hasTag("Los Juegos de Cell") {
		return "Los Juegos de Cell: El Torneo del Terror"
	}
	if hasTag("Torneo del Más Allá") {
		return "Torneo del Más Allá: Combates en el Otro Mundo"
	}
	if hasTag("Supervivencia Universal") && hasTag("Cruce de Universos") {
		return "Torneo del Poder: Supervivencia Universal"
	}

	// ── Sagas y Facciones ─────────────────────────────────────────────────────
	if hasTag("El Imperio de Freezer") {
		return "El Imperio de Freezer: El Tirano del Universo"
	}
	if hasTag("La Patrulla Roja") {
		return "La Patrulla Roja: Androides y Cell"
	}
	if hasTag("Saiyajins Legendarios") {
		return "Saiyajins Legendarios: El Poder Berserker"
	}
	if hasTag("Los Saiyajins") {
		return "Los Saiyajins: La Raza Guerrera Más Poderosa"
	}
	if hasTag("Los Tsufurujin") {
		return "Los Tsufurujin: La Venganza de Baby"
	}
	if hasTag("Dragones Malignos") {
		return "Los Dragones Malignos: La Amenaza Final de GT"
	}
	if hasTag("Dioses de la Destrucción") || hasTag("Entidades Supremas") {
		return "Dioses y Entidades Supremas del Universo"
	}
	if hasTag("La Patrulla Galáctica") {
		return "La Patrulla Galáctica: Policías del Cosmos"
	}
	if hasTag("Guerreras Poderosas") {
		return "Guerreras Indomables del Universo"
	}
	if hasTag("Nuevas Generaciones") {
		return "El Futuro: Las Nuevas Generaciones de Guerreros"
	}
	if hasTag("Los Namekuseijin") {
		return "Los Namekuseijin: Guardianes de las Esferas"
	}

	// ── Sci-Fi y Aventura ──────────────────────────────────────────────────────
	if hasTag("Viajes en el Tiempo") {
		return "Guardianes del Tiempo: Crónicas del Futuro"
	}
	if hasTag("Supervivencia Universal") {
		return "Crónicas de Supervivencia: El Futuro en Llamas"
	}
	if hasTag("Cruce de Universos") {
		return "Multiverso: El Cruce de Universos"
	}
	if hasTag("Invasión a la Tierra") {
		return "¡La Tierra Bajo Ataque! Invasiones Alienígenas"
	}
	if hasTag("Viajes por el Espacio") {
		return "Más Allá de las Estrellas: Aventura Espacial"
	}
	if hasTag("Búsqueda de las Esferas") {
		return "Deseos Prohibidos y Dragones Sagrados"
	}

	// ── Magia y Sobrenatural ───────────────────────────────────────────────────
	if hasTag("Mundo de los Demonios") || hasTag("Magia y Hechizos") {
		return "Artes Oscuras: Magia y Demonios"
	}
	if hasTag("Maldición Mini") {
		return "¡Encogidos! La Maldición Mini de Daima"
	}

	// ── Emociones y Drama ──────────────────────────────────────────────────────
	if hasTag("Sacrificio Heroico") {
		return "Cuando los Héroes lo Dan Todo: Sacrificios"
	}
	if hasTag("Tensión Absoluta") {
		return "Tensión Absoluta: Al Borde del Abismo"
	}
	if hasTag("Romance") {
		return "Amor en el Universo Dragon Ball"
	}
	if hasTag("Superhéroes") {
		return "Gran Saiyaman: El Héroe Enmascarado"
	}
	if hasTag("Humor y Relleno") || hasTag("Vida Cotidiana") {
		return "Momentos para Reír: El Lado Cómico del Universo"
	}

	// ── Entrenamiento ──────────────────────────────────────────────────────────
	if hasTag("Entrenamiento Divino") {
		return "Entrenamiento Divino: El Camino de los Dioses"
	}
	if hasTag("Entrenamiento Extremo") {
		return "El Camino del Guerrero: Entrenamientos"
	}

	// ── Películas ──────────────────────────────────────────────────────────────
	if hasTag("Película") || hasTag("Villanos de Películas") {
		return "Esencia de Cinema: Películas Legendarias"
	}

	return ""
}


// ExtractAbstractTags generates exactly 5 to 6 thematic tags by reading the synopsis and title, applying fallbacks if necessary.
func (t *IntelligenceTagger) ExtractAbstractTags(synopsis string, title string) []string {
	combined := strings.ToLower(title + " " + synopsis)
	detected := make(map[string]bool)
	var tags []string

	// Check each category for keywords
	for _, categories := range t.Dictionary {
		for _, cat := range categories {
			for _, kw := range cat.Keywords {
				if strings.Contains(combined, strings.ToLower(kw)) {
					if !detected[cat.TagName] {
						detected[cat.TagName] = true
						tags = append(tags, cat.TagName)
					}
					break // Found one keyword for this tag, move to next thematic tag
				}
			}
		}
	}

	// Fallback categories to ensure we always hit the minimum of 5 tags
	fallbacks := []string{"Shonen Clásico", "Artes Marciales", "Acción", "Aventura", "Fantasía", "Desafío Constante", "Los Guerreros Z"}

	// Inject fallbacks until we have at least 5 tags
	idx := 0
	for len(tags) < 5 && idx < len(fallbacks) {
		fallbackTag := fallbacks[idx]
		if !detected[fallbackTag] {
			detected[fallbackTag] = true
			tags = append(tags, fallbackTag)
		}
		idx++
	}

	// Cap at 6 tags to keep the UI clean
	if len(tags) > 6 {
		tags = tags[:6]
	}

	return tags
}

// GetTagsAsJSON returns the tags as a JSON RawMessage for the database
func (r *IntelligenceTagResult) GetTagsAsJSON() []byte {
	b, _ := json.Marshal(r.DetectedTags)
	return b
}
