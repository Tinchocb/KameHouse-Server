package handlers

import (
	"github.com/labstack/echo/v4"
)

// DragonballLore is the response shape consumed by the web client's
// CharacterDetailModal (loreData.characters_wiki).
type DragonballLore struct {
	CharactersWiki []DragonballLoreCharacter `json:"characters_wiki"`
}

type DragonballLoreCharacter struct {
	Name            string                       `json:"name"`
	Alias           []string                     `json:"alias,omitempty"`
	Race            string                       `json:"race,omitempty"`
	Origin          string                       `json:"origin,omitempty"`
	HeightCm        float64                      `json:"height_cm,omitempty"`
	WeightKg        float64                      `json:"weight_kg,omitempty"`
	Biography       string                       `json:"biography,omitempty"`
	Personality     string                       `json:"personality,omitempty"`
	Techniques      []string                     `json:"techniques,omitempty"`
	Transformations []DragonballLoreTransformation `json:"transformations,omitempty"`
}

type DragonballLoreTransformation struct {
	Name        string `json:"name"`
	Multiplier  string `json:"multiplier,omitempty"`
	Description string `json:"description,omitempty"`
}

// HandleGetDragonballLore returns the local Dragon Ball character wiki used to
// populate the character detail modal.
func (h *Handler) HandleGetDragonballLore(c echo.Context) error {
	characters := []DragonballLoreCharacter{
		{
			Name:        "Son Goku",
			Alias:       []string{"Kakarot", "Kakarotto", "Goku"},
			Race:        "Saiyajin",
			Origin:      "Planeta Vegeta / Planeta Tierra",
			HeightCm:    175,
			WeightKg:    62,
			Biography:   "Enviado a la Tierra cuando era un bebé, Goku fue criado por el abuelo Gohan. Con un corazón puro y una pasión inagotable por las artes marciales, se convirtió en el protector más grande del universo.",
			Personality: "Alegre, compasivo, valiente y apasionado por los combates desafiantes.",
			Techniques:  []string{"Kamehameha", "Kaio-ken", "Genkidama", "Teletransportación", "Puño del Dragón", "Hakai"},
			Transformations: []DragonballLoreTransformation{
				{Name: "Kaio-ken", Multiplier: "x2 - x20", Description: "Técnica del Kaio del Norte que multiplica la fuerza, velocidad y sentidos a costa de gran estrés físico."},
				{Name: "Super Saiyajin", Multiplier: "x50", Description: "El legendario guerrero dorado despertado por la ira tras la muerte de Krilin en Namek."},
				{Name: "Super Saiyajin 2", Multiplier: "x100", Description: "Estado perfeccionado con destellos eléctricos y poder desbordante."},
				{Name: "Super Saiyajin 3", Multiplier: "x400", Description: "Liberación extrema del potencial Saiyajin con cabello largo dorado."},
				{Name: "Super Saiyajin God", Multiplier: "Divino", Description: "Forma imbuida de Ki divino obtenida a través del ritual de seis Saiyajin de corazón puro."},
				{Name: "Super Saiyajin Blue", Multiplier: "Divino x50", Description: "Super Saiyajin combinado con el poder del Super Saiyajin God."},
				{Name: "Ultra Instinto", Multiplier: "Inconmensurable", Description: "El estado supremo de los ángeles donde el cuerpo reacciona y combate de forma autónoma sin intermediación del pensamiento."},
			},
		},
		{
			Name:        "Vegeta",
			Alias:       []string{"Príncipe Vegeta", "Príncipe de los Saiyajin"},
			Race:        "Saiyajin",
			Origin:      "Planeta Vegeta",
			HeightCm:    164,
			WeightKg:    56,
			Biography:   "El orgulloso Príncipe de todos los Saiyajin. Inicialmente un despiadado guerrero al servicio de Freezer, encontró en la Tierra un hogar, una familia y un eterno rival en Goku.",
			Personality: "Orgulloso, estratégico, reservado y ferozmente protector de su familia.",
			Techniques:  []string{"Galick Ho", "Big Bang Attack", "Final Flash", "Final Explosion", "Gamma Burst Flash"},
			Transformations: []DragonballLoreTransformation{
				{Name: "Super Saiyajin", Multiplier: "x50", Description: "Alcanzado mediante un entrenamiento implacable y pura frustración."},
				{Name: "Super Saiyajin 2", Multiplier: "x100", Description: "Poder maximizado como Majin Vegeta y dominado permanentemente."},
				{Name: "Super Saiyajin God", Multiplier: "Divino", Description: "Obtenido mediante riguroso entrenamiento divino junto a Whis."},
				{Name: "Super Saiyajin Blue", Multiplier: "Divino x50", Description: "Dominio absoluto del Ki divino y control emocional."},
				{Name: "Super Saiyajin Blue Evolution", Multiplier: "Trascendente", Description: "Evolución nacida del orgullo Saiyajin y la promesa a Cabba durante el Torneo del Poder."},
				{Name: "Ultra Ego", Multiplier: "Destructivo", Description: "Técnica suprema inspirada en el poder de los Dioses de la Destrucción."},
			},
		},
		{
			Name:        "Son Gohan",
			Alias:       []string{"Gohan", "Gran Saiyaman"},
			Race:        "Híbrido Saiyajin-Humano",
			Origin:      "Planeta Tierra",
			HeightCm:    176,
			WeightKg:    61,
			Biography:   "Hijo primogénito de Goku y Chi-Chi. Posee un potencial latente infinito que supera al de los Saiyajin puros cuando lucha por proteger a sus seres queridos.",
			Personality: "Pacífico, bondadoso, estudioso e implacable cuando se desata su furia.",
			Techniques:  []string{"Masenko", "Kamehameha", "Kamehameha Padre e Hijo", "Makankosappo"},
			Transformations: []DragonballLoreTransformation{
				{Name: "Super Saiyajin", Multiplier: "x50", Description: "Despertado en la Habitación del Tiempo junto a Goku."},
				{Name: "Super Saiyajin 2", Multiplier: "x100", Description: "El primer guerrero en alcanzar esta fase, desatado contra Cell Perfecto."},
				{Name: "Gohan Definitivo (Ultimate)", Multiplier: "Potencial Ilimitado", Description: "Poder liberado en su totalidad por el ritual del Anciano Kaio-shin sin necesidad de transformarse."},
				{Name: "Gohan Bestia (Beast)", Multiplier: "Incalculable", Description: "Evolución salvaje de su estado definitivo provocada por la furia ante Cell Max."},
			},
		},
		{
			Name:        "Piccolo",
			Alias:       []string{"Piccolo Jr.", "Ma Jr.", "Kami-sama"},
			Race:        "Namekiano (Guerrero)",
			Origin:      "Planeta Namek / Planeta Tierra",
			HeightCm:    226,
			WeightKg:    116,
			Biography:   "Reencarnación de Piccolo Daimaku que se transformó de enemigo mortal a uno de los más sabios mentores y protectores de la Tierra. Mentor de Gohan y Pan.",
			Personality: "Severo, inteligente, disciplinado y profundamente leal.",
			Techniques:  []string{"Makankosappo", "Masenko", "Renzoku Sen Kōdan", "Regeneración", "Gigantificación"},
			Transformations: []DragonballLoreTransformation{
				{Name: "Super Namekiano", Multiplier: "Fusión", Description: "Resultado de su asimilación con Nail y reunificación con Kami-sama."},
				{Name: "Piccolo Potencial Desbloqueado", Multiplier: "Shenlong", Description: "Poder latente liberado por Shenlong a petición de Piccolo."},
				{Name: "Orange Piccolo", Multiplier: "Divino Namekiano", Description: "Forma gigantesca con tono naranja concedida como regalo adicional por las Esferas del Dragón."},
			},
		},
		{
			Name:        "Freezer",
			Alias:       []string{"Frieza", "Lord Freezer", "Emperador del Mal"},
			Race:        "Mutante de la Raza de Changeling",
			Origin:      "Universo 7",
			HeightCm:    158,
			WeightKg:    50,
			Biography:   "Tirano intergaláctico responsable de la destrucción del Planeta Vegeta. Un prodigio natural de la violencia que nunca necesitó entrenar hasta enfrentarse a Goku.",
			Personality: "Sádico, refinado, arrogante, implacable y calculador.",
			Techniques:  []string{"Death Beam", "Death Ball", "Supernova", "Telequinesis", "Kienzan Doble"},
			Transformations: []DragonballLoreTransformation{
				{Name: "Primera a Tercera Forma", Multiplier: "Contención", Description: "Formas de contención corporal para regular su descomunal poder natural."},
				{Name: "Forma Final", Multiplier: "100% Real", Description: "Su verdadero aspecto esbelto con el que combatió en Namek a 120,000,000 de unidades."},
				{Name: "Golden Freezer", Multiplier: "Dorado", Description: "Alcanzado tras 4 meses de entrenamiento, rivalizando con el Super Saiyajin Blue."},
				{Name: "Black Freezer", Multiplier: "Dominio Supremo", Description: "Poder supremo obtenido tras entrenar 10 años en una Habitación del Tiempo espacial."},
			},
		},
		{
			Name:        "Trunks",
			Alias:       []string{"Trunks del Futuro", "Future Trunks", "Guerrero de la Esperanza"},
			Race:        "Híbrido Saiyajin-Humano",
			Origin:      "Planeta Tierra (Línea Temporal Alternativa)",
			HeightCm:    170,
			WeightKg:    60,
			Biography:   "Hijo de Vegeta y Bulma. Viajó en el tiempo para salvar la línea temporal principal de la enfermedad cardíaca de Goku y la aniquilación de los androides.",
			Personality: "Prudente, educado, decidido y traumatizado por un futuro en ruinas.",
			Techniques:  []string{"Burning Attack", "Buster Cannon", "Corte de Espada Luminosa", "Mafuba", "Espada de la Esperanza"},
			Transformations: []DragonballLoreTransformation{
				{Name: "Super Saiyajin", Multiplier: "x50", Description: "Despertado tras presenciar la muerte de Gohan del Futuro en la lluvia."},
				{Name: "Super Saiyajin Grado 3 (Ultra)", Multiplier: "Fuerza Bruta", Description: "Incremento muscular descomunal a expensas de la velocidad de combate."},
				{Name: "Super Saiyajin 2", Multiplier: "x100", Description: "Alcanzado tras entrenar con el Kaio-shin del Futuro y derrotar a Dabura."},
				{Name: "Super Saiyajin Rage (Furia)", Multiplier: "Furia Divina", Description: "Poder desatado contra Zamasu fusionando el Ki dorado con un aura divina azulada."},
			},
		},
		{
			Name:        "Cell",
			Alias:       []string{"Célula", "El Bio-Androide Perfecto"},
			Race:        "Bio-Androide Artificial",
			Origin:      "Laboratorio del Dr. Gero (Línea Temporal Alternativa)",
			HeightCm:    213,
			WeightKg:    105,
			Biography:   "Creado a partir de las células de Goku, Vegeta, Piccolo, Freezer y King Cold. Diseñado para alcanzar la perfección al absorber a los Androides 17 y 18.",
			Personality: "Obsesionado con la perfección estética, refinado, arrogante y buscador de desafíos.",
			Techniques:  []string{"Kamehameha Perfecto", "Makankosappo", "Death Beam", "Barrera Perfecta", "Engendrar Cell Jr."},
			Transformations: []DragonballLoreTransformation{
				{Name: "Forma Imperfecta", Multiplier: "Larva / Absorción", Description: "Aspecto insectoide que absorbe energía vital humana con su cola."},
				{Name: "Forma Semi-Perfecta", Multiplier: "Absorción N°17", Description: "Poder masivo con complexión gigantesca tras absorber a Número 17."},
				{Name: "Forma Perfecta", Multiplier: "Perfección Absoluta", Description: "El pináculo de la biotecnología del Dr. Gero tras absorber a Número 18."},
				{Name: "Super Cell Perfecto", Multiplier: "Poder Renacido", Description: "Resurrección potenciada por sus células Saiyajin (Zenkai) imitando el SSJ2."},
			},
		},
		{
			Name:        "Majin Buu",
			Alias:       []string{"Buu Gordo", "Super Buu", "Kid Buu", "Pequeño Buu"},
			Race:        "Demonio Majin Primordial",
			Origin:      "Origen del Universo",
			HeightCm:    145,
			WeightKg:    50,
			Biography:   "Fuerza caótica de la naturaleza controlada temporalmente por Bibidi y Babidi. Posee regeneración molecular infinita y la habilidad de convertir a sus oponentes en dulces.",
			Personality: "Infantil e inocente como Buu Gordo; sádico, calculador y despiadado como Super Buu; pura maldad y caos descontrolado como Kid Buu.",
			Techniques:  []string{"Rayo de Chocolate", "Regeneración Infinita", "Vanish Beam", "Kamehameha", "Grito Dimensional"},
			Transformations: []DragonballLoreTransformation{
				{Name: "Majin Buu Gordo", Multiplier: "Inocente", Description: "Aspecto bonachón resultante de absorber al Gran Kaio-shin."},
				{Name: "Super Buu", Multiplier: "Maldad Absorbente", Description: "Forma esbelta y voraz cuando la maldad pura devoró a Buu Gordo."},
				{Name: "Super Buu (Gotenks / Gohan)", Multiplier: "Poder Intelectual", Description: "Forma hiper-poderosa al asimilar los poderes de Gotenks SSJ3 y Gohan Místico."},
				{Name: "Kid Buu (Puro)", Multiplier: "Pura Maldad", Description: "La forma original despiadada e impredecible sin rastros de compasión."},
			},
		},
		{
			Name:        "Beerus",
			Alias:       []string{"Bills", "Dios de la Destrucción del Universo 7"},
			Race:        "Deidad Destructora",
			Origin:      "Planeta de Beerus / Universo 7",
			HeightCm:    180,
			WeightKg:    60,
			Biography:   "Dios de la Destrucción del Universo 7 encargado de mantener el equilibrio cósmico. Aficionado gourmet a la comida de la Tierra.",
			Personality: "Caprichoso, dormilón, glotón e inconmensurablemente temido por los mortales y deidades.",
			Techniques:  []string{"Hakai", "Esfera de Destrucción", "Presión de Ki Divino"},
			Transformations: []DragonballLoreTransformation{
				{Name: "Poder de la Destrucción (Ultra Ego)", Multiplier: "Divino", Description: "Dominio absoluto del Ki de la destrucción que transmuta la materia a la nada."},
			},
		},
		{
			Name:        "Whis",
			Alias:       []string{"Ángel Guía del Universo 7"},
			Race:        "Ángel Divino",
			Origin:      "Reino de los Ángeles",
			HeightCm:    200,
			WeightKg:    70,
			Biography:   "Asistente y maestro de artes marciales de Beerus. Posee el Ultra Instinto permanente y la capacidad de retroceder el tiempo.",
			Personality: "Elegante, imparcial, maestro paciente y amante de la alta cocina universal.",
			Techniques:  []string{"Retroceso Temporal (3 min)", "Teletransportación Interdimensional", "Báculo Mágico"},
			Transformations: []DragonballLoreTransformation{
				{Name: "Ultra Instinto Autónomo", Multiplier: "Ángel", Description: "Estado innato y permanente de reflejos corporales perfectos."},
			},
		},
		{
			Name:        "Broly",
			Alias:       []string{"El Saiyajin Legendario", "Broly (Super)"},
			Race:        "Saiyajin Mutante",
			Origin:      "Planeta Vegeta / Planeta Vampa",
			HeightCm:    230,
			WeightKg:    140,
			Biography:   "Exiliado al nacer por el Rey Vegeta debido a su poder anómalo. Creció en el hostil Planeta Vampa antes de ser reclutado por el ejército de Freezer.",
			Personality: "Gentil, pacífico y conectado con la naturaleza cuando está en calma; fuerza de destrucción imparable al perder el control.",
			Techniques:  []string{"Gigantic Roar", "Gigantic Breath", "Planet Crusher", "Eraser Cannon"},
			Transformations: []DragonballLoreTransformation{
				{Name: "Estado Ikari (Ira / Oozaru Humanoide)", Multiplier: "x10", Description: "Canaliza el poder del mono gigante en su forma humana sin perder agilidad."},
				{Name: "Super Saiyajin", Multiplier: "x50+", Description: "Desatado por el dolor ante la muerte de su padre Paragus en la Tierra."},
				{Name: "Super Saiyajin al Máximo Poder (Full Power)", Multiplier: "Legendario", Description: "Cabello verde brillante y masa muscular colosal que superó a Goku y Vegeta en SSJ Blue."},
			},
		},
		{
			Name:        "Glorio",
			Alias:       []string{"Glorio del Reino Demonio"},
			Race:        "Habitante del Reino Demoniaco",
			Origin:      "Tercer Mundo Demoníaco",
			HeightCm:    178,
			WeightKg:    68,
			Biography:   "Misterioso piloto y pistolero que guía a Goku y sus amigos a través de los mundos demoníacos en Dragon Ball Daima.",
			Personality: "Serio, pragmático, observador y leal a su propia agenda en el Reino Demonio.",
			Techniques:  []string{"Magia Demoníaca", "Disparo Preciso", "Pilotaje Interdimensional"},
			Transformations: []DragonballLoreTransformation{},
		},
		{
			Name:        "Panzy",
			Alias:       []string{"Princesa Panzy"},
			Race:        "Habitante del Reino Demoniaco",
			Origin:      "Tercer Mundo Demoníaco",
			HeightCm:    135,
			WeightKg:    32,
			Biography:   "Joven aventurera demoníaca del Tercer Mundo que se une a la tripulación de Goku en Daima para desafiar el régimen de Gomah.",
			Personality: "Enérgica, curiosa, valiente y defensora de los oprimidos.",
			Techniques:  []string{"Artes Marciales Demoníacas", "Mecánica Demoníaca"},
			Transformations: []DragonballLoreTransformation{},
		},
		{
			Name:        "Rey Gomah",
			Alias:       []string{"Gomah", "Nuevo Rey del Reino Demonio"},
			Race:        "Demonio Supremo",
			Origin:      "Palacio del Reino Demoniaco",
			HeightCm:    165,
			WeightKg:    75,
			Biography:   "Soberano supremo del Reino Demonio tras la caída de Dabura. Utilizó las Esferas del Dragón de la Tierra para convertir a los Guerreros Z en niños.",
			Personality: "Ambicioso, temeroso del poder de los Saiyajin y conspirador.",
			Techniques:  []string{"Ojo Demoníaco de Vigilancia", "Magia Oscura Real"},
			Transformations: []DragonballLoreTransformation{},
		},
	}

	return JSONSuccess(c, DragonballLore{
		CharactersWiki: characters,
	})
}
