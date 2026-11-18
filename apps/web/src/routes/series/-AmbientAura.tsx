import { memo } from 'react';
import { AnimatePresence, m } from 'framer-motion';

interface AmbientAuraProps {
    src: string | null;
    accent?: string | null;
    seriesKey?: string | number | null;
    allowGlowFx: boolean;
}

export const AmbientAura = memo(function AmbientAura({
    src,
    accent,
    seriesKey,
    allowGlowFx,
}: AmbientAuraProps) {
    const targetOpacity = allowGlowFx ? 0.28 : 0.18;
    const auraKey = seriesKey != null ? String(seriesKey) : (src || accent || 'aura-empty');

    return (
        <div
            className="absolute -inset-16 pointer-events-none overflow-hidden transform-gpu will-change-[opacity]"
            style={{
                filter: "blur(54px) saturate(135%)",
                maskImage: "radial-gradient(ellipse 105% 85% at 50% 30%, black 15%, transparent 85%)",
                WebkitMaskImage: "radial-gradient(ellipse 105% 85% at 50% 30%, black 15%, transparent 85%)",
            }}
        >
            <AnimatePresence mode="sync" initial={false}>
                <m.div
                    key={auraKey}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 w-full h-full pointer-events-none transform-gpu"
                >
                    {src && (
                        <img
                            src={src}
                            alt=""
                            aria-hidden="true"
                            draggable={false}
                            decoding="async"
                            className="w-full h-full object-cover object-[center_20%] pointer-events-none"
                            style={{
                                opacity: targetOpacity,
                            }}
                        />
                    )}
                    {accent && (
                        <div
                            aria-hidden="true"
                            data-testid="aura-accent"
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)`,
                                maskImage: 'radial-gradient(ellipse 85% 65% at 50% 35%, black 0%, transparent 70%)',
                                WebkitMaskImage: 'radial-gradient(ellipse 85% 65% at 50% 35%, black 0%, transparent 70%)',
                            }}
                        />
                    )}
                </m.div>
            </AnimatePresence>
        </div>
    );
});
