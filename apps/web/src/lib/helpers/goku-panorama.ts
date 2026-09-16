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
        colors: ["var(--spotlight-dbz-vivid-2)", "var(--spotlight-dbz-vivid)", "var(--era-dbz-hex)"]
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
        colors: ["var(--spotlight-dbgt-vivid-2)", "var(--spotlight-dbgt-vivid)", "var(--era-dbgt-hex)"]
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
        colors: ["var(--spotlight-dbkai-vivid-2)", "var(--spotlight-dbkai-vivid)", "var(--era-dbkai-hex)"]
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
        colors: ["var(--spotlight-dbs-vivid-2)", "var(--spotlight-dbs-vivid)", "var(--era-dbs-hex)"]
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
        eraYears: "2024–PRESENTE",
        auraColor: "color-mix(in srgb, var(--spotlight-daima-vivid) 60%, transparent)",
        colors: ["var(--spotlight-daima-vivid-2)", "var(--spotlight-daima-vivid)", "var(--era-daima-hex)"]
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
        colors: cfg.colors
    };
};

const collapsedGradients: Record<string, string> = {
    dragon_ball: "linear-gradient(to bottom, var(--spotlight-db-vivid-2) 0%, var(--spotlight-db-vivid) 26%, color-mix(in srgb, var(--spotlight-db-vivid) 32%, #140d08) 58%, #1a0e06 82%, #0d0603 100%)",
    dragon_ball_z: "linear-gradient(to bottom, var(--spotlight-dbz-vivid-2) 0%, var(--spotlight-dbz-vivid) 26%, color-mix(in srgb, var(--spotlight-dbz-vivid) 32%, #140d04) 58%, #1c0f04 82%, #0d0602 100%)",
    dragon_ball_gt: "linear-gradient(to bottom, var(--spotlight-dbgt-vivid-2) 0%, var(--spotlight-dbgt-vivid) 26%, color-mix(in srgb, var(--spotlight-dbgt-vivid) 35%, #120a14) 58%, #1c0d14 82%, #0d0508 100%)",
    dragon_ball_kai: "linear-gradient(to bottom, var(--spotlight-dbkai-vivid-2) 0%, var(--spotlight-dbkai-vivid) 26%, color-mix(in srgb, var(--spotlight-dbkai-vivid) 35%, #070f18) 58%, #0a1626 82%, #04080f 100%)",
    dragon_ball_super: "linear-gradient(to bottom, var(--spotlight-dbs-vivid-2) 0%, var(--spotlight-dbs-vivid) 26%, color-mix(in srgb, var(--spotlight-dbs-vivid) 35%, #070d18) 58%, #0a1626 82%, #04080f 100%)",
    dragon_ball_daima: "linear-gradient(to bottom, var(--spotlight-daima-vivid-2) 0%, var(--spotlight-daima-vivid) 26%, color-mix(in srgb, var(--spotlight-daima-vivid) 32%, #09130e) 58%, #0e1d15 82%, #050b08 100%)",
};

export function getCollapsedBg(spine: SpineTheme, seriesId?: string): string {
    if (seriesId && collapsedGradients[seriesId]) {
        return collapsedGradients[seriesId];
    }
    if (spine.kanji === "亀" || spine.subtitle === "DRAGON BALL") return collapsedGradients.dragon_ball;
    if (spine.kanji === "悟" || spine.subtitle === "DBZ") return collapsedGradients.dragon_ball_z;
    if (spine.kanji === "星" || spine.subtitle === "DBGT") return collapsedGradients.dragon_ball_gt;
    if (spine.kanji === "改" || spine.subtitle === "DB KAI") return collapsedGradients.dragon_ball_kai;
    if (spine.kanji === "超" || spine.subtitle === "DB SUPER") return collapsedGradients.dragon_ball_super;
    if (spine.kanji === "魔" || spine.subtitle === "DB DAIMA") return collapsedGradients.dragon_ball_daima;

    if (spine.colors && spine.colors.length >= 3) {
        return `linear-gradient(to bottom, ${spine.colors[0]} 0%, ${spine.colors[1]} 30%, ${spine.colors[2]} 70%, #050505 100%)`;
    }
    return spine.bg;
}
