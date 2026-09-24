export interface SpineTheme {
    bg: string;
    text: string;
    accent: string;
    vol: string;
    subtitle: string;
    borderColor: string;
    colIndex: number;
    kanji: string;
    eraYears: string;
    auraColor: string;
    colors: string[];
    rawImg: string;
}

// Fuente única de color: tokens --spotlight-*-vivid (styles/tokens/colors.css:101-106)
// + --era-*-hex. Nada hardcodeado por era: colapsado y expandido derivan del
// mismo vivid, así el hue no cambia al expandir. Kanjis canónicos = ERAS (eras.ts:3-8).
const spineThemes: Record<string, SpineTheme> = {
    "dragon_ball": {
        bg: "linear-gradient(to bottom, color-mix(in srgb, var(--spotlight-db-vivid) 34%, #14100c) 0%, #1a130d 45%, #0d0a08 75%, #070505 100%)",
        text: "#ffffff",
        accent: "var(--spotlight-db-vivid)",
        vol: "1",
        subtitle: "DRAGON BALL",
        borderColor: "var(--spotlight-border-db)",
        colIndex: 0,
        kanji: "亀",
        eraYears: "1986–1989",
        auraColor: "color-mix(in srgb, var(--spotlight-db-vivid) 60%, transparent)",
        colors: ["var(--spotlight-db-vivid-2)", "var(--spotlight-db-vivid)", "var(--era-db-hex)"],
        rawImg: "/icons/series-icons/goku-raw-db.webp",
    },
    "dragon_ball_z": {
        bg: "linear-gradient(to bottom, color-mix(in srgb, var(--spotlight-dbz-vivid) 34%, #14100c) 0%, #1a130d 45%, #0d0a08 75%, #070505 100%)",
        text: "#ffffff",
        accent: "var(--spotlight-dbz-vivid)",
        vol: "2",
        subtitle: "DBZ",
        borderColor: "var(--spotlight-border-dbz)",
        colIndex: 1,
        kanji: "悟",
        eraYears: "1989–1996",
        auraColor: "color-mix(in srgb, var(--spotlight-dbz-vivid) 60%, transparent)",
        colors: ["var(--spotlight-dbz-vivid-2)", "var(--spotlight-dbz-vivid)", "var(--era-dbz-hex)"],
        rawImg: "/icons/series-icons/goku-raw-dbz.webp",
    },
    "dragon_ball_gt": {
        bg: "linear-gradient(to bottom, color-mix(in srgb, var(--spotlight-dbgt-vivid) 34%, #120a14) 0%, #1c1020 45%, #0d070d 75%, #070405 100%)",
        text: "#ffffff",
        accent: "var(--spotlight-dbgt-vivid)",
        vol: "3",
        subtitle: "DBGT",
        borderColor: "var(--spotlight-border-dbgt)",
        colIndex: 2,
        kanji: "星",
        eraYears: "1996–1997",
        auraColor: "color-mix(in srgb, var(--spotlight-dbgt-vivid) 60%, transparent)",
        colors: ["var(--spotlight-dbgt-vivid-2)", "var(--spotlight-dbgt-vivid)", "var(--era-dbgt-hex)"],
        rawImg: "/icons/series-icons/goku-raw-dbgt.webp",
    },
    "dragon_ball_kai": {
        bg: "linear-gradient(to bottom, color-mix(in srgb, var(--spotlight-dbkai-vivid) 34%, #070f18) 0%, #0d1b2c 45%, #080f18 75%, #04070c 100%)",
        text: "#ffffff",
        accent: "var(--spotlight-dbkai-vivid-2)",
        vol: "4",
        subtitle: "DB KAI",
        borderColor: "var(--spotlight-border-dbkai)",
        colIndex: 3,
        kanji: "改",
        eraYears: "2009–2015",
        auraColor: "color-mix(in srgb, var(--spotlight-dbkai-vivid) 55%, transparent)",
        colors: ["var(--spotlight-dbkai-vivid-2)", "var(--spotlight-dbkai-vivid)", "var(--era-dbkai-hex)"],
        rawImg: "/icons/series-icons/goku-raw-dbz.webp",
    },
    "dragon_ball_super": {
        bg: "linear-gradient(to bottom, color-mix(in srgb, var(--spotlight-dbs-vivid) 34%, #070d18) 0%, #0d172b 45%, #080f1c 75%, #04070d 100%)",
        text: "#ffffff",
        accent: "var(--spotlight-dbs-vivid)",
        vol: "5",
        subtitle: "DB SUPER",
        borderColor: "var(--spotlight-border-dbs)",
        colIndex: 4,
        kanji: "超",
        eraYears: "2015–2018",
        auraColor: "color-mix(in srgb, var(--spotlight-dbs-vivid) 55%, transparent)",
        colors: ["var(--spotlight-dbs-vivid-2)", "var(--spotlight-dbs-vivid)", "var(--era-dbs-hex)"],
        rawImg: "/icons/series-icons/goku-raw-dbs.webp",
    },
    "dragon_ball_daima": {
        bg: "linear-gradient(to bottom, color-mix(in srgb, var(--spotlight-daima-vivid) 32%, #09130e) 0%, #0f1e16 45%, #0a140f 75%, #050a08 100%)",
        text: "#ffffff",
        accent: "var(--spotlight-daima-vivid)",
        vol: "6",
        subtitle: "DB DAIMA",
        borderColor: "var(--spotlight-border-daima)",
        colIndex: 5,
        kanji: "魔",
        eraYears: "2024–2025",
        auraColor: "color-mix(in srgb, var(--spotlight-daima-vivid) 60%, transparent)",
        colors: ["var(--spotlight-daima-vivid-2)", "var(--spotlight-daima-vivid)", "var(--era-daima-hex)"],
        rawImg: "/icons/series-icons/goku-raw-daima.webp",
    }
};

export const getSpineConfig = (seriesId: string, id: number, fallbackTitle?: string): SpineTheme => {
    const theme = spineThemes[seriesId];
    if (theme) return theme;

    const colors = [
        { bg: "linear-gradient(to bottom, #ff7043, #d84315, #bf360c)", colors: ["#ff7043", "#d84315", "#bf360c"], borderColor: "#bf360c", accent: "#ff7043" },
        { bg: "linear-gradient(to bottom, #ab47bc, #7b1fa2, #4a148c)", colors: ["#ab47bc", "#7b1fa2", "#4a148c"], borderColor: "#4a148c", accent: "#ab47bc" },
        { bg: "linear-gradient(to bottom, #66bb6a, #388e3c, #1b5e20)", colors: ["#66bb6a", "#388e3c", "#1b5e20"], borderColor: "#1b5e20", accent: "#66bb6a" },
        { bg: "linear-gradient(to bottom, #42a5f5, #1976d2, #0d47a1)", colors: ["#42a5f5", "#1976d2", "#0d47a1"], borderColor: "#0d47a1", accent: "#42a5f5" }
    ];
    const cfg = colors[id % colors.length];
    return {
        bg: cfg.bg,
        text: "#ffffff",
        accent: cfg.accent || "var(--brand-accent-hex)",
        vol: String((id % 5) + 1),
        subtitle: fallbackTitle ? fallbackTitle.toUpperCase() : "SERIE",
        borderColor: cfg.borderColor,
        colIndex: id % 5,
        kanji: "★",
        eraYears: "SERIE",
        auraColor: "color-mix(in srgb, var(--brand-accent-hex) 60%, transparent)",
        colors: cfg.colors,
        rawImg: ""
    };
};


