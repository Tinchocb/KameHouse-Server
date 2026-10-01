import { useState, useCallback, memo } from 'react';

/** Transform compartido por los dos halos de fondo (exterior + interior del shelf). */
export function getGlowTransform(selectedIndex: number, total: number, offsetPx: number) {
    const pct = (selectedIndex / Math.max(total - 1, 1)) * 80 + 10;
    return `translate3d(calc(${pct}% - ${offsetPx}px), -50%, 0)`;
}

export const AmbientAura = memo(function AmbientAura({
    src,
    allowGlowFx,
}: {
    src: string | null;
    allowGlowFx: boolean;
}) {
    const [prevPropSrc, setPrevPropSrc] = useState(src);
    const [activeSrc, setActiveSrc] = useState<string | null>(src);
    const [incomingSrc, setIncomingSrc] = useState<string | null>(null);
    const [isIncomingLoaded, setIsIncomingLoaded] = useState(false);

    // Ajuste de estado durante el render (patrón documentado de React para
    // derivar estado del prop anterior): arranca el crossfade sin efecto extra.
    if (src !== prevPropSrc) {
        setPrevPropSrc(src);
        if (!src) {
            setActiveSrc(null);
            setIncomingSrc(null);
            setIsIncomingLoaded(false);
        } else if (!activeSrc) {
            setActiveSrc(src);
            setIncomingSrc(null);
            setIsIncomingLoaded(false);
        } else if (src !== activeSrc) {
            setIncomingSrc(src);
            setIsIncomingLoaded(false);
        }
    }

    const handleIncomingLoad = useCallback(() => {
        setIsIncomingLoaded(true);
        const timer = setTimeout(() => {
            setActiveSrc(incomingSrc);
            setIncomingSrc(null);
            setIsIncomingLoaded(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [incomingSrc]);

    const targetOpacity = allowGlowFx ? 0.28 : 0.18;

    return (
        <div
            className="absolute inset-0 pointer-events-none overflow-hidden transform-gpu will-change-[opacity]"
            style={{
                filter: "blur(48px) saturate(140%)",
                maskImage: "radial-gradient(ellipse 90% 80% at 70% 40%, black 0%, transparent 75%)",
                WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 70% 40%, black 0%, transparent 75%)",
            }}
        >
            {activeSrc && (
                <img
                    src={activeSrc}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover object-[center_20%] pointer-events-none transition-opacity duration-slow ease-smooth-out"
                    style={{
                        opacity: incomingSrc && isIncomingLoaded ? 0 : targetOpacity,
                    }}
                />
            )}
            {incomingSrc && (
                <img
                    src={incomingSrc}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    decoding="async"
                    loading="lazy"
                    onLoad={handleIncomingLoad}
                    onError={handleIncomingLoad}
                    className="absolute inset-0 w-full h-full object-cover object-[center_20%] pointer-events-none transition-opacity duration-slow ease-smooth-out"
                    style={{
                        opacity: isIncomingLoaded ? targetOpacity : 0,
                    }}
                />
            )}
        </div>
    );
});
