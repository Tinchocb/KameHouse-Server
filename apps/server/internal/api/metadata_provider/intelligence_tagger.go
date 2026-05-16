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

// NewIntelligenceTagger initializes the tagger with the v2 dictionary
func NewIntelligenceTagger() *IntelligenceTagger {
	return &IntelligenceTagger{
		Dictionary: map[string][]TagCategory{
			"Thematic": {
				// Combate y Acción
				{"Batalla Épica", []string{"combate", "duelo", "pelea", "venganza", "revancha", "batalla", "derrotar", "lucha", "enfrentamiento", "enemigo", "golpiza", "combate mortal"}},
				{"Técnicas de Ki", []string{"kamehameha", "resplandor final", "makankosappo", "ki", "energía", "genkidama", "ataque", "poder", "ráfaga", "masenko", "kiensan", "tayoken", "cañón de luz", "dodompa"}},
				{"Técnicas Especiales", []string{"teletransportación", "kaioken", "mafuba", "destello solar", "danza", "clonación", "ilusión", "barrera de energía", "puño del dragón"}},
				{"Técnicas Letales", []string{"rayo mortal", "rayo de la muerte", "kikouhou", "akkumaito kosen", "corte", "perforar"}},
				{"Técnicas de Sacrificio", []string{"autodestrucción", "explosión final", "sacrificio final", "inmolación", "kikouhou"}},
				{"Súper Saiyajin", []string{"súper saiyajin", "super saiyan", "ssj", "ozaru", "fase", "golden", "instinto", "evolución", "poder oculto", "despertar", "transformación", "mono gigante", "fase dios", "blue"}},
				{"Transformación de Villano", []string{"forma final", "100% de poder", "perfect cell", "célula perfecta", "súper buu", "kid buu", "golden freezer", "black goku", "estado perfecto", "corrupción"}},
				{"Poderes Ocultos", []string{"estado definitivo", "místico", "potencial", "desatado", "mega instinto", "ultra instinto", "ultra ego"}},
				{"Poderes Psíquicos", []string{"telequinesis", "parálisis", "guldo", "chaoz", "general blue", "control mental", "hipnosis"}},
				{"Espadachines y Armas", []string{"espada z", "espada", "tapion", "yajirobe", "cortar", "trunks del futuro"}},
				
				// Aventura, Eventos y Fantasía Clásica
				{"Búsqueda de las Esferas", []string{"esferas del dragón", "radar del dragón", "deseo", "shenlong", "porunga", "reunir", "esfera", "dragón mágico", "super esferas", "zarama"}},
				{"Artes Marciales Clásicas", []string{"torneo de las artes marciales", "torneo", "budokai", "ring", "arena", "plataforma", "eliminatoria", "campeonato", "participante", "artes marciales", "dojo", "karate"}},
				{"El Torneo de Uranai Baba", []string{"uranai baba", "momia", "hombre invisible", "dracula man", "diablo", "abuelo gohan"}},
				{"Los Juegos de Cell", []string{"juegos de cell", "cell games", "torneo de cell"}},
				{"Torneo Infantil", []string{"torneo infantil", "niños", "categoría infantil"}},
				{"Torneo del Más Allá", []string{"torneo del otro mundo", "más allá", "paikuhan", "gran kaio", "cielo", "infierno", "almas", "enma daio", "paraíso", "mahogany"}},
				{"Entrenamiento Extremo", []string{"entrenar", "maestro roshi", "maestro", "gravedad", "habitación del tiempo", "superación", "práctica", "enseñanza", "kaiosama", "pesos", "entrenamiento", "torre de karin", "agua ultra sagrada", "mutaito"}},
				{"Entrenamiento Divino", []string{"entrenamiento de whis", "ki divino", "báculo de whis", "presión divina"}},
				
				// Objetos, Lugares y Tecnología
				{"Objetos Místicos", []string{"semillas del ermitaño", "senzu", "nube voladora", "báculo sagrado", "arcillos pothala", "anillo del tiempo", "agua sagrada", "agua ultra divina"}},
				{"Tecnología Cápsula", []string{"cápsula hoi poi", "corporación cápsula", "máquina de gravedad", "armadura saiyajin", "nave espacial", "tecnología", "laboratorio"}},
				{"Escenarios Míticos", []string{"kame house", "palacio de kami", "montaña paoz", "planeta sagrado", "planeta yardrat", "habitación del tiempo", "planeta supremo", "torre músculo", "aldea jingle", "villa pingüino"}},
				{"Vehículos Clásicos", []string{"aerodeslizador", "coche volador", "motocicleta", "submarino pirata", "tren"}},
				
				// Tramas Universales y Sci-Fi (Z/Super/GT)
				{"Supervivencia Universal", []string{"sobrevivir", "amenaza", "destrucción", "fin del mundo", "apocalipsis", "salvar", "peligro", "torneo del poder", "supervivencia", "eliminación", "borrar"}},
				{"Cruce de Universos", []string{"universo 6", "universo 11", "champa", "hit", "jiren", "multiverso", "torneo de exhibición"}},
				{"Viajes por el Espacio", []string{"nave", "espacio", "planeta", "namekusei", "universo", "galaxia", "alienígena", "tsufuru", "viaje estelar", "extraterrestre"}},
				{"Viajes en el Tiempo", []string{"futuro", "máquina del tiempo", "trunks del futuro", "línea temporal", "alterar el pasado", "pasado", "viajero", "goku black", "zamasu", "patrullero del tiempo"}},
				{"Invasión a la Tierra", []string{"invadir", "ejército", "llegada", "aterrizaje", "nave espacial", "conquista", "soldado", "invasor", "amenaza a la tierra"}},
				
				// Magia y Mundo Demoníaco (Daima / Buu)
				{"Magia y Hechizos", []string{"magia", "hechicero", "babidi", "maldición", "hechizo", "sello", "convertir", "brujería", "abracadabra", "bibidi"}},
				{"Mundo de los Demonios", []string{"demonio", "rey demonio", "majin", "gomah", "degesu", "neva", "reino demoníaco", "dabra", "dabura", "makai", "inframundo", "janemba", "towa", "mira"}},
				{"Maldición Mini", []string{"encogidos", "mini", "pequeños", "niños", "volver a ser niño", "daima", "juventud"}},
				
				// Tono y Slice of Life
				{"Humor y Relleno", []string{"banquete", "hambre", "comer", "gracioso", "divertido", "fiesta", "vacaciones", "broma", "comedia", "licencia de conducir", "béisbol", "relleno", "bingo"}},
				{"Sacrificio Heroico", []string{"sacrificio", "morir", "lágrimas", "despedida", "tragedia", "muerte", "tristeza", "adiós", "inmolación", "dar la vida"}},
				{"Tensión Absoluta", []string{"miedo", "desesperación", "terror", "pánico", "imposible", "angustia", "temblar", "sin salida"}},
				{"Vida Cotidiana", []string{"familia", "escuela", "trabajo", "cotidiano", "vida diaria", "ciudad", "pueblo", "casa", "tranquilidad", "satán city", "gran saiyaman"}},
				{"Superhéroes", []string{"gran saiyaman", "poses de pelea", "justicia", "pose ridícula", "super sentai", "saiyawoman", "patrullero galáctico"}},
				{"Romance", []string{"boda", "novia", "amor", "casamiento", "pareja", "cita"}},
				{"Animales Fantásticos", []string{"olong", "puar", "tortuga", "dinosaurio", "dinosaurios", "ikarose", "dragón", "mascota", "lobo"}},
				
				// Facciones, Razas y Aliados
				{"Fusión de Guerreros", []string{"unir fuerzas", "fusión", "danza de la fusión", "pothala", "vegetto", "gogeta", "gotenks", "arcillos", "kefla", "asimilación"}},
				{"Nuevas Generaciones", []string{"pan", "bra", "uub", "goten", "trunks niño", "marron", "descendencia"}},
				{"Trabajo en Equipo", []string{"equipo", "juntos", "aliados", "compañero", "estrategia", "apoyo"}},
				{"Guerreras Poderosas", []string{"videl", "caulifla", "kale", "bulma", "milk", "launch", "kefla", "número 18", "guerrera"}},
				{"Los Guerreros Z", []string{"goku", "vegeta", "gohan", "pícoro", "piccolo", "krilin", "guerreros z", "yamcha", "tenshinhan", "chaoz", "yajirobe", "mr satán"}},
				{"Los Namekuseijin", []string{"namekusei", "gran patriarca", "dende", "nail", "porunga", "namek", "gurú", "asimilación namekiana", "curación namekiana"}},
				{"Los Tsufurujin", []string{"tsufurujin", "tsufuru", "baby", "dr lychee", "hatchiyack", "planeta plant", "venganza tsufuru"}},
				{"Maestros Divinos", []string{"mr popo", "karin", "supremo kaiosama", "shin", "kibito", "anciano kaioshin", "ro kaioshin", "maestro divino"}},
				{"Entidades Supremas", []string{"super shenlong", "zarama", "zeno sama", "rey de todo", "gran sacerdote", "daishinkan"}},
				{"Dioses de la Destrucción", []string{"dios", "kaioshin", "bills", "ángel", "kami", "zeno", "whis", "dios de la destrucción", "kamisama"}},
				{"La Patrulla Galáctica", []string{"patrulla galáctica", "jaco", "merus", "prisioneros galácticos", "moro", "rey galáctico"}},
				{"Los Saiyajins", []string{"saiyajin", "saiya", "raza guerrera", "raditz", "nappa", "orgullo saiyajin", "planeta vegeta", "bardock", "rey vegeta", "kakaroto"}},
				{"Saiyajins Legendarios", []string{"broly", "super saiyajin legendario", "yamoshi", "kale", "berserker"}},
				{"La Patrulla Roja", []string{"patrulla roja", "red ribbon", "androide", "cell", "cyborg", "robot", "doctor gero", "n° 17", "n° 18", "n° 16", "magenta", "carmine", "cell max", "gamma 1", "gamma 2", "general blue", "ninja murasaki"}},
				{"Criaturas y Clones", []string{"saibaiman", "cell jr", "metal cooler", "bio broly", "hildegarn", "yakon", "pui pui", "monstruo"}},
				{"El Imperio de Freezer", []string{"freezer", "fuerzas especiales", "emperador", "ginyu", "soldados de freezer", "rey cold", "cooler", "zarbon", "dodoria"}},
				{"Villanos de Películas", []string{"garlic jr", "dr wheelo", "turles", "lord slug", "cooler", "androide 13", "broly", "bojack", "janemba", "hirudegarn"}},
				{"Cazadores del Espacio", []string{"piratas espaciales", "mercenarios", "esbirro"}},
				{"Dragones Malignos", []string{"dragón maligno", "dragones oscuros", "energía negativa", "omega shenron", "gt", "baby"}},
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

	if hasTag("Batalla Épica") && (hasTag("Transformaciones") || hasTag("Técnicas de Ki") || hasTag("Supervivencia Universal")) {
		return "¡Eleva tu Ki!: Batallas que rompieron los límites"
	}
	if hasTag("Entrenamiento Extremo") {
		return "El Camino del Guerrero: Entrenamientos"
	}
	if hasTag("Viajes en el Tiempo") || hasTag("Supervivencia Universal") {
		return "Crónicas de Supervivencia: El Futuro en Llamas"
	}
	if hasTag("Fusión de Guerreros") || hasTag("Trabajo en Equipo") {
		return "¡Fusión y Equipo!: Guerreros Definitivos"
	}
	if hasTag("Búsqueda de las Esferas") {
		return "Deseos Prohibidos y Dragones Sagrados"
	}
	if hasTag("Artes Marciales Clásicas") {
		return "¡Fuera del Ring!: Los Grandes Torneos"
	}
	if hasTag("Película") {
		return "Esencia de Cinema: Películas Legendarias"
	}
	if hasTag("Mundo de los Demonios") || hasTag("Magia y Hechizos") {
		return "Artes Oscuras: Magia y Demonios"
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
