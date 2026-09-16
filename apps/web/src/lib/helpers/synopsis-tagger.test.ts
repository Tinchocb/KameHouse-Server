import { describe, expect, it } from "vitest"
import {
  extractDetailedTags,
  extractSynopsisTags,
  getTagCategoryStyle,
  normalizeText,
} from "./synopsis-tagger"

describe("normalizeText", () => {
  it("removes accents, guillemets and punctuation", () => {
    expect(normalizeText("«¡Gokū se transforma!»")).toBe("goku se transforma")
    expect(normalizeText("<<Kaio-ken x20>>")).toBe("kaio-ken x20")
  })
})

describe("extractDetailedTags - Categorías", () => {
  it("extrae transformaciones mayores y de alto nivel", () => {
    const tags = extractDetailedTags(
      "El despertar del Ultra Instinto",
      "Goku alcanza la doctrina egoista en el Torneo del Poder tras el impacto de la Genkidama."
    )
    const labels = tags.map((t) => t.label)
    expect(labels).toContain("Ultra Instinto")
    expect(labels).toContain("Genkidama")
    expect(labels).toContain("Torneo del Poder")
  })

  it("extrae transformaciones avanzadas como SSJ4, Gohan Bestia y Piccolo Naranja", () => {
    const ssj4Tags = extractDetailedTags("Goku alcanza el Super Saiyajin 4", "El poder definitivo de la fase 4").map((t) => t.label)
    expect(ssj4Tags).toContain("Super Saiyajin 4")

    const beastTags = extractDetailedTags("La furia desatada: Gohan Bestia", "Gohan alcanza una nueva transformacion").map((t) => t.label)
    expect(beastTags).toContain("Gohan Bestia")

    const orangeTags = extractDetailedTags("Piccolo Naranja entra en combate", "El nuevo poder otorgado por Shenlong").map((t) => t.label)
    expect(orangeTags).toContain("Piccolo Naranja")
  })

  it("extrae técnicas legendarias como Kamehameha, Final Flash, Mafuba y Makankosappo", () => {
    const tags = extractDetailedTags(
      "El Kamehameha Padre e Hijo",
      "Gohan dispara un colosal Kamehameha mientras Vegeta distrae a Cell con un Big Bang Attack."
    )
    const labels = tags.map((t) => t.label)
    expect(labels).toContain("Kamehameha")
    expect(labels).toContain("Big Bang Attack")
    expect(labels).toContain("Cell")

    const mafubaTags = extractDetailedTags("El secreto del Mafuba", "El Maestro Roshi prepara la ola de contencion del mal").map((t) => t.label)
    expect(mafubaTags).toContain("Mafuba")
    expect(mafubaTags).toContain("Maestro Roshi")
  })

  it("extrae fusiones legendarias como Vegetto, Gogeta, Gotenks y Kefla", () => {
    const vegitoTags = extractDetailedTags("El nacimiento de Vegetto", "Goku y Vegeta usan los pendientes Pothala para fusionarse contra Super Buu").map((t) => t.label)
    expect(vegitoTags).toContain("Vegetto")
    expect(vegitoTags).toContain("Pendientes Pothala")
    expect(vegitoTags).toContain("Majin Buu")

    const gogetaTags = extractDetailedTags("La fusion definitiva: Gogeta", "La danza de la fusion da sus frutos").map((t) => t.label)
    expect(gogetaTags).toContain("Gogeta")
    expect(gogetaTags).toContain("Danza de la Fusión")
  })

  it("extrae villanos clásicos de DB Original (Pilaf, Red Ribbon, Tao Pai Pai, Piccolo Daimaku)", () => {
    const pilafTags = extractDetailedTags("La trampa del Emperador Pilaf", "Goku y Bulma quedan atrapados por la banda de Pilaf").map((t) => t.label)
    expect(pilafTags).toContain("Emperador Pilaf")

    const redRibbonTags = extractDetailedTags("El asalto al cuartel de la Patrulla Roja", "El temible ejercito Red Ribbon liderado por el Comandante Red").map((t) => t.label)
    expect(redRibbonTags).toContain("Patrulla Roja")

    const taoTags = extractDetailedTags("El asesino legendario Tao Pai Pai", "Tao Pai Pai derrota a Goku con un Dodonpa").map((t) => t.label)
    expect(taoTags).toContain("Tao Pai Pai")
    expect(taoTags).toContain("Dodonpa")

    const daimakuTags = extractDetailedTags("El despertar de Piccolo Daimaku", "El Rey Demonio Piccolo busca la juventud eterna").map((t) => t.label)
    expect(daimakuTags).toContain("Piccolo Daimaku")
  })

  it("extrae villanos de películas clásicas Z (Garlic Jr, Turles, Cooler, Broly, Janemba, Hirudegarn)", () => {
    const coolerTags = extractDetailedTags("Los guerreros mas poderosos: Cooler", "Metal Cooler invade el nuevo Planeta Namek").map((t) => t.label)
    expect(coolerTags).toContain("Cooler")
    expect(coolerTags).toContain("Planeta Namek")

    const brolyTags = extractDetailedTags("El poder destructor de Broly", "El legendario super saiyajin destruye todo a su paso").map((t) => t.label)
    expect(brolyTags).toContain("Broly Clásico")
    expect(brolyTags).toContain("Super Saiyajin Legendario")

    const janembaTags = extractDetailedTags("El demonio Janemba", "El caos en el Otro Mundo").map((t) => t.label)
    expect(janembaTags).toContain("Janemba")
    expect(janembaTags).toContain("Otro Mundo & Infierno")
  })

  it("extrae villanos de DB GT, Super y Daima (Baby, Super 17, Goku Black, Jiren, Rey Gomah)", () => {
    const babyTags = extractDetailedTags("La venganza del parasito Baby", "Baby Vegeta toma el control de los habitantes").map((t) => t.label)
    expect(babyTags).toContain("Baby")

    const blackTags = extractDetailedTags("Aparece Goku Black", "Zamasu destruye el futuro alternativo").map((t) => t.label)
    expect(blackTags).toContain("Goku Black")

    const jirenTags = extractDetailedTags("El combate definitivo contra Jiren", "El guerrero mas fuerte del Universo 11 supera sus limites").map((t) => t.label)
    expect(jirenTags).toContain("Jiren")

    const gomahTags = extractDetailedTags("El Reino de los Demonios y el Rey Gomah", "Degesu y Gomah observan la conspiracion").map((t) => t.label)
    expect(gomahTags).toContain("Rey Gomah")
    expect(gomahTags).toContain("Reino de los Demonios")
  })

  it("extrae artefactos y mitología (Esferas del Dragón, Shenlong, Semillas Senzu, Nube Voladora)", () => {
    const tags = extractDetailedTags("Reunan las Esferas del Dragon", "Invocan a Shenlong con ayuda del Radar del Dragon para pedir un deseo").map((t) => t.label)
    expect(tags).toContain("Esferas del Dragón")
    expect(tags).toContain("Shenlong")
    expect(tags).toContain("Radar del Dragón")
  })

  it("extrae torneos y competiciones (Tenkaichi Budokai, Torneo del Poder, Juegos de Cell)", () => {
    const cellGamesTags = extractDetailedTags("Comienzan Los Juegos de Cell", "Cell espera en su ring a los Guerreros Z").map((t) => t.label)
    expect(cellGamesTags).toContain("Los Juegos de Cell")
    expect(cellGamesTags).toContain("Cell")

    const tenkaichiTags = extractDetailedTags("La gran final del Torneo de las Artes Marciales", "Jackie Chun vs Son Goku en el Tenkaichi Budokai").map((t) => t.label)
    expect(tenkaichiTags).toContain("Torneo de las Artes Marciales")
  })
})

describe("getTagCategoryStyle", () => {
  it("entrega clases AMOLED consistentes para cada categoría", () => {
    expect(getTagCategoryStyle("transformation")).toContain("brand-warning")
    expect(getTagCategoryStyle("technique")).toContain("brand-secondary")
    expect(getTagCategoryStyle("fusion")).toContain("brand-magic")
    expect(getTagCategoryStyle("villain")).toContain("brand-destructive")
    expect(getTagCategoryStyle("protagonist")).toContain("brand-accent")
    expect(getTagCategoryStyle("artifact")).toContain("brand-warning")
    expect(getTagCategoryStyle("location")).toContain("brand-success")
    expect(getTagCategoryStyle("narrative")).toContain("surface-container")
    expect(getTagCategoryStyle("tournament")).toContain("brand-warning")
  })
})

describe("extractSynopsisTags (Retrocompatibilidad)", () => {
  it("retorna un array de strings", () => {
    const tags = extractSynopsisTags("El Kaio-ken y la Genkidama", "Goku lucha ferozmente contra Vegeta")
    expect(Array.isArray(tags)).toBe(true)
    expect(tags).toContain("Kaioken")
    expect(tags).toContain("Genkidama")
    expect(tags).toContain("Vegeta")
  })
})
