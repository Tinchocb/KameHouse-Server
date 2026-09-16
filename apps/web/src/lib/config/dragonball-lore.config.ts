export const SCOUTER_POWER_LEVELS: Record<string, string> = {
    goku: "> 150,000,000",
    vegeta: "> 150,000,000",
    vegetto: "INCONMENSURABLE",
    vegito: "INCONMENSURABLE",
    gogeta: "INCONMENSURABLE",
    broly: "INCONMENSURABLE",
    freezer: "120,000,000",
    frieza: "120,000,000",
    gohan: "POTENCIAL OCULTO",
    bills: "NIVEL DIVINO",
    beerus: "NIVEL DIVINO",
    whis: "NIVEL DIVINO",
    jiren: "NIVEL DIVINO",
    zeno: "OMNIPOTENTE",
};

export function getScouterKi(name?: string, customKi?: string): string {
    if (customKi) return customKi;
    if (!name) return "> 1,000,000";
    const lower = name.toLowerCase();
    for (const [key, value] of Object.entries(SCOUTER_POWER_LEVELS)) {
        if (lower.includes(key)) {
            return value;
        }
    }
    return "> 1,000,000";
}
